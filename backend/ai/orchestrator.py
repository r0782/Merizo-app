"""
AI Orchestrator — manages the full Gemini conversation loop.

Flow per request:
  1. Fetch user's groups from the API to build context
  2. Build a rich system prompt from that context
  3. Call the LLM (Gemini 2.5 Flash, Groq fallback)
  4. If tool_call → validate → execute via ToolExecutor → feed result back
  5. Return AIResult (reply + structured action metadata for the frontend)
"""
import logging
import os
from dataclasses import dataclass, field
from typing import Optional

import httpx

from .providers.base import LLMProvider, LLMResponse
from .tools import TOOL_SCHEMAS, ToolExecutor

logger = logging.getLogger("merizo.orchestrator")

BACKEND_URL = os.environ.get("BACKEND_URL", "https://merizo-app.onrender.com")

# Action type → friendly label (used by the frontend ActionCard)
_ACTION_LABELS: dict[str, str] = {
    "create_group":    "group_created",
    "rename_group":    "group_renamed",
    "delete_group":    "group_deleted",
    "add_member":      "member_added",
    "remove_member":   "member_removed",
    "create_expense":  "expense_added",
    "delete_expense":  "expense_deleted",
    "settle_debt":     "debt_settled",
    "show_balance":    "balance_shown",
    "list_expenses":   "expenses_listed",
    "search_expenses": "expenses_found",
    "summarize_group": "group_summarized",
    "show_statistics": "statistics_shown",
    "list_groups":     "groups_listed",
}


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class AIResult:
    reply: str
    tool_called: Optional[str] = None
    tool_args: Optional[dict] = None
    tool_result: Optional[dict] = None
    action_type: Optional[str] = None   # e.g. "expense_added"
    action_data: Optional[dict] = None  # rich data for the frontend card


# ── Provider factory ──────────────────────────────────────────────────────────

def _is_valid_gemini_key(key: str) -> bool:
    """
    Historically this rejected anything not prefixed 'AIza', on the
    assumption that 'AQ.'-prefixed keys were Emergent/proxy-only and
    incompatible with google-genai. Verified live against the actual
    configured key: an 'AQ.' key authenticates fine with google-genai
    (it just needed the model pinned to gemini-3.6-flash, not the
    now-retired gemini-2.5-flash). Prefix-sniffing isn't a reliable
    validity check — let the real API call be the judge, with the
    existing Groq fallback in handle_chat() covering genuine failures.
    """
    return bool(key)


def _make_provider(preferred: str = "gemini") -> LLMProvider:
    """
    Return the best available LLM provider.

    Priority order:
      1. sarvam  — Sarvam AI (sarvam-m), best for Indian-language responses
      2. gemini  — Gemini 3.6 Flash (GEMINI_API_KEY required)
      3. groq    — Groq llama-3.3-70b (always available as final fallback)
    """
    # ── Sarvam (explicit request or configured) ───────────────────────────────
    if preferred == "sarvam":
        key = os.environ.get("SARVAM_API_KEY", "")
        if key:
            from .providers.sarvam import SarvamProvider
            return SarvamProvider(api_key=key)
        logger.warning("SARVAM_API_KEY not set — falling through to next provider")

    # ── Gemini ────────────────────────────────────────────────────────────────
    if preferred not in ("groq", "sarvam"):
        key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_KEY", "")
        if _is_valid_gemini_key(key):
            from .providers.gemini import GeminiProvider
            return GeminiProvider(api_key=key)
        elif key:
            logger.info("GEMINI_KEY present but not a Google AI Studio key — skipping Gemini")

    # ── Auto-select best available ────────────────────────────────────────────
    if preferred == "auto":
        sarvam_key = os.environ.get("SARVAM_API_KEY", "")
        if sarvam_key:
            from .providers.sarvam import SarvamProvider
            return SarvamProvider(api_key=sarvam_key)
        gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GEMINI_KEY", "")
        if _is_valid_gemini_key(gemini_key):
            from .providers.gemini import GeminiProvider
            return GeminiProvider(api_key=gemini_key)

    # ── Groq (final fallback) ─────────────────────────────────────────────────
    key = os.environ.get("GROQ_API_KEY", "")
    if key:
        from .providers.groq_provider import GroqProvider
        return GroqProvider(api_key=key)

    raise RuntimeError(
        "No LLM API key configured. Set SARVAM_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY."
    )


# ── Context fetcher ───────────────────────────────────────────────────────────

async def _fetch_context(token: str, current_group_id: Optional[str]) -> dict:
    """
    Fetches the user's groups.  For the currently active group we also pull
    full member details (name + ID) so the tool executor can resolve names.
    """
    headers = {"Authorization": f"Bearer {token}"}
    groups: list[dict] = []
    current_group_detail: Optional[dict] = None

    try:
        async with httpx.AsyncClient(timeout=12) as http:
            r = await http.get(f"{BACKEND_URL}/api/trips", headers=headers)
            if r.status_code == 200:
                raw = r.json() or []
                # Build lightweight group list (member list = IDs only here)
                for g in raw[:12]:
                    groups.append({
                        "id": g.get("id"),
                        "name": g.get("name"),
                        "currency": g.get("currency", "INR"),
                        "my_net": g.get("my_net", 0),
                        "total_spent": g.get("total_spent", 0),
                        "members": [],          # filled below for active group
                        "member_count": g.get("member_count", 0),
                    })

            # Enrich the active group with real member names so the executor
            # can resolve "Rahul paid" → member UUID
            if current_group_id:
                r2 = await http.get(
                    f"{BACKEND_URL}/api/trips/{current_group_id}",
                    headers=headers,
                )
                if r2.status_code == 200:
                    current_group_detail = r2.json()
                    members_with_names = [
                        {"id": m.get("id"), "name": m.get("name")}
                        for m in current_group_detail.get("members", [])
                        if m.get("id") and m.get("name")
                    ]
                    for g in groups:
                        if g["id"] == current_group_id:
                            g["members"] = members_with_names
                            break

    except Exception as e:
        logger.warning(f"Context fetch failed: {e}")

    return {"groups": groups, "current_group_detail": current_group_detail}


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_system(ctx: dict, language: str) -> str:
    from .prompts import build_system_prompt_v2
    return build_system_prompt_v2(ctx, language)


# ── Main entry point ──────────────────────────────────────────────────────────

async def handle_chat(
    message: str,
    history: list[dict],
    context: dict,
    token: str,
    language: str = "en",
    provider: str = "gemini",
) -> AIResult:
    """
    context: {
        group_id?:         str   — currently active group
        group_name?:       str   — display name for the active group
        user_name?:        str
        currency?:         str
    }
    history: list of {role: "user"|"assistant", content: str}
    """
    current_group_id: Optional[str] = context.get("group_id") or context.get("current_group_id")

    # 1. Build full context
    fetched = await _fetch_context(token, current_group_id)
    groups = fetched["groups"]
    # Fall back to groups passed from the frontend if server-side fetch failed
    if not groups and context.get("groups"):
        groups = [
            {
                "id": g.get("id", ""),
                "name": g.get("name", ""),
                "currency": g.get("currency", "INR"),
                "my_net": g.get("my_net", 0),
                "total_spent": 0,
                "members": [],
                "member_count": 0,
            }
            for g in context["groups"]
            if g.get("id") and g.get("name")
        ]
    cg_detail = fetched.get("current_group_detail")

    # Find current group object
    current_group: Optional[dict] = None
    if current_group_id:
        for g in groups:
            if g["id"] == current_group_id:
                current_group = g
                break

    full_ctx = {
        "groups": groups,
        "current_group_id": current_group_id,
        "current_group_name": (current_group or {}).get("name") or context.get("group_name"),
        "current_group": current_group,
        "user_name": context.get("user_name", ""),
        "language": language,
        "currency": (current_group or {}).get("currency") or context.get("currency", "INR"),
    }

    # 2. System prompt
    system = _build_system(full_ctx, language)

    # 3. Build message list for LLM (last 14 turns to keep context tight)
    llm_messages: list[dict] = []
    for msg in history[-14:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if not content:
            continue
        llm_messages.append({
            "role": "user" if role == "user" else "model",
            "content": content,
        })
    llm_messages.append({"role": "user", "content": message})

    # 4. Get provider
    try:
        llm = _make_provider(provider)
    except RuntimeError as e:
        return AIResult(reply=f"AI is unavailable: {e}")

    # 5. First LLM call — auto-retry with Groq if primary provider fails
    response: Optional[LLMResponse] = None
    try:
        response = await llm.generate(system, llm_messages, tools=TOOL_SCHEMAS)
    except Exception as primary_err:
        logger.error(f"Primary LLM ({type(llm).__name__}) failed: {primary_err}")
        groq_key = os.environ.get("GROQ_API_KEY", "")
        if groq_key and type(llm).__name__ != "GroqProvider":
            logger.info("Auto-retrying with Groq fallback")
            try:
                from .providers.groq_provider import GroqProvider
                llm = GroqProvider(api_key=groq_key)
                response = await llm.generate(system, llm_messages, tools=TOOL_SCHEMAS)
            except Exception as fallback_err:
                logger.error(f"Groq fallback failed: {fallback_err}")
                return AIResult(reply="I'm having trouble connecting right now. Please try again.")
        else:
            return AIResult(reply="I'm having trouble connecting right now. Please try again.")

    if response is None:
        return AIResult(reply="I'm having trouble connecting right now. Please try again.")

    # Pure text — no tool needed
    if response.type == "text":
        return AIResult(reply=response.content or "")

    # 6. Execute the tool
    tool_name = response.tool_name
    tool_args = response.tool_args
    logger.info(f"[orchestrator] tool_call={tool_name} args={tool_args}")

    executor = ToolExecutor(BACKEND_URL, token, full_ctx)
    tool_result = await executor.execute(tool_name, tool_args)

    # 7. Feed result back to LLM for natural-language response
    try:
        final_reply = await llm.generate_after_tool(
            system, llm_messages, tool_name, tool_args, tool_result
        )
    except Exception as e:
        logger.error(f"LLM generate_after_tool failed: {e}")
        final_reply = _fallback_reply(tool_name, tool_result, full_ctx)

    if not final_reply:
        final_reply = _fallback_reply(tool_name, tool_result, full_ctx)

    action_type = _ACTION_LABELS.get(tool_name, "action")
    if not tool_result.get("success"):
        action_type = "error"

    return AIResult(
        reply=final_reply,
        tool_called=tool_name,
        tool_args=tool_args,
        tool_result=tool_result,
        action_type=action_type,
        action_data=tool_result if tool_result.get("success") else None,
    )


# ── Fallback descriptions (if the LLM fails to produce the follow-up) ────────

def _fallback_reply(tool_name: str, result: dict, ctx: dict) -> str:
    sym = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£", "AED": "د.إ"}.get(
        ctx.get("currency", "INR"), "₹"
    )
    if not result.get("success"):
        err = result.get("error", "Something went wrong.")
        return f"I couldn't complete that action. {err}"

    if tool_name == "create_expense":
        return (
            f"Added '{result['title']}' — {sym}{result['amount']} "
            f"paid by {result['paid_by']}, split among {result['split_among']}."
        )
    if tool_name == "create_group":
        members = result.get("members_added") or []
        m_str = f" with {', '.join(members)}" if members else ""
        return f"Created group '{result['name']}'{m_str}."
    if tool_name == "add_member":
        return f"Added {result['member_name']} to the group."
    if tool_name == "remove_member":
        return f"Removed {result['member_name']} from the group."
    if tool_name == "rename_group":
        return f"Renamed to '{result['new_name']}'."
    if tool_name == "delete_group":
        return "Group deleted."
    if tool_name == "settle_debt":
        return f"Settlement recorded: {result['from']} paid {sym}{result['amount']} to {result['to']}."
    if tool_name == "delete_expense":
        return "Expense deleted."
    return "Done."
