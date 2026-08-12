"""
Sarvam AI provider — chat LLM via OpenAI-compatible endpoint.

Sarvam's chat API accepts the same message/tool schema as OpenAI,
so this provider is a thin adapter over the base class.

Swap-in: set SARVAM_API_KEY in .env and pass provider="sarvam" to the orchestrator.
"""
import logging
from typing import Optional

import httpx

from .base import LLMProvider, LLMResponse

logger = logging.getLogger("merizo.providers.sarvam")

SARVAM_BASE = "https://api.sarvam.ai"
SARVAM_CHAT_MODEL = "sarvam-m"   # Sarvam's multilingual model


class SarvamProvider(LLMProvider):
    """
    LLM provider backed by Sarvam AI (sarvam-m).

    Sarvam's /v1/chat/completions is OpenAI-compatible, so tool calling
    uses the same {"type":"function","function":{...}} schema.
    """

    def __init__(self, api_key: str):
        self._key = api_key
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    # ── helpers ──────────────────────────────────────────────────────────────

    def _to_openai_tools(self, tools: list[dict]) -> list[dict]:
        """Convert provider-agnostic tool schemas to OpenAI format."""
        result = []
        for t in tools:
            result.append({
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "parameters": t.get("parameters", {"type": "object", "properties": {}}),
                },
            })
        return result

    def _to_openai_messages(self, system: str, messages: list[dict]) -> list[dict]:
        """Convert generic messages to OpenAI-compatible format."""
        out = [{"role": "system", "content": system}]
        for m in messages:
            role = m.get("role", "user")
            # Normalize "model" → "assistant" (Gemini convention → OpenAI)
            if role == "model":
                role = "assistant"
            out.append({"role": role, "content": m.get("content", "")})
        return out

    async def _call(self, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{SARVAM_BASE}/v1/chat/completions",
                json=payload,
                headers=self._headers,
            )
            r.raise_for_status()
            return r.json()

    # ── LLMProvider interface ─────────────────────────────────────────────────

    async def generate(
        self,
        system: str,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
    ) -> LLMResponse:
        payload: dict = {
            "model": SARVAM_CHAT_MODEL,
            "messages": self._to_openai_messages(system, messages),
            "max_tokens": 1024,
            "temperature": 0.4,
        }
        if tools:
            payload["tools"] = self._to_openai_tools(tools)
            payload["tool_choice"] = "auto"

        data = await self._call(payload)
        choice = data["choices"][0]
        msg = choice["message"]

        # Tool call?
        if msg.get("tool_calls"):
            tc = msg["tool_calls"][0]
            import json
            return LLMResponse(
                type="tool_call",
                tool_name=tc["function"]["name"],
                tool_args=json.loads(tc["function"]["arguments"] or "{}"),
            )

        return LLMResponse(type="text", content=msg.get("content") or "")

    async def generate_after_tool(
        self,
        system: str,
        messages: list[dict],
        tool_name: str,
        tool_args: dict,
        tool_result: dict,
    ) -> str:
        import json
        oai_messages = self._to_openai_messages(system, messages)

        # Append the assistant's tool call turn
        oai_messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": [{
                "id": "tc_0",
                "type": "function",
                "function": {
                    "name": tool_name,
                    "arguments": json.dumps(tool_args),
                },
            }],
        })
        # Append the tool result
        oai_messages.append({
            "role": "tool",
            "tool_call_id": "tc_0",
            "content": json.dumps(tool_result),
        })

        payload = {
            "model": SARVAM_CHAT_MODEL,
            "messages": oai_messages,
            "max_tokens": 512,
            "temperature": 0.4,
        }
        data = await self._call(payload)
        return data["choices"][0]["message"].get("content") or ""
