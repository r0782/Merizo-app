"""
AI Tool Registry — Merizo expense assistant.

Two responsibilities:
  1. TOOL_SCHEMAS  — JSON-Schema-compatible declarations sent to the LLM.
     Provider-agnostic: Gemini, Groq, and OpenAI all accept the same shape.

  2. ToolExecutor  — executes tool calls by calling the Merizo REST API with
     the user's JWT token.  The AI never touches the database directly.

Security model:
  - The LLM decides WHICH function to call and WHAT arguments to use.
  - The backend validates every request (auth, ownership, limits).
  - Internal IDs are never exposed in system prompts; only group/member names.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger("merizo.tools")

# ── Tool schema registry ──────────────────────────────────────────────────────

TOOL_SCHEMAS: list[dict] = [
    {
        "name": "list_groups",
        "description": "List all the user's expense groups with name, ID, currency, and their net balance.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "create_group",
        "description": "Create a new expense group or trip. Optionally add initial members.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Group name, e.g. 'Goa Trip 2025'",
                },
                "members": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Names of people to add (in addition to the current user).",
                },
                "currency": {
                    "type": "string",
                    "description": "ISO currency code. Default: INR",
                },
                "category": {
                    "type": "string",
                    "description": "Group type: trip, home, office, other. Default: trip",
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "rename_group",
        "description": "Rename an existing group to a new name.",
        "parameters": {
            "type": "object",
            "properties": {
                "group_id": {"type": "string", "description": "ID of the group to rename"},
                "new_name": {"type": "string", "description": "New name for the group"},
            },
            "required": ["group_id", "new_name"],
        },
    },
    {
        "name": "delete_group",
        "description": "Permanently delete a group and all its expenses. Only use when the user has explicitly confirmed the deletion.",
        "parameters": {
            "type": "object",
            "properties": {
                "group_id": {"type": "string", "description": "ID of the group to delete"},
                "confirmed": {
                    "type": "boolean",
                    "description": "Must be true — user must have explicitly said 'yes, delete it' or similar.",
                },
            },
            "required": ["group_id", "confirmed"],
        },
    },
    {
        "name": "add_member",
        "description": "Add a person to an existing group by name.",
        "parameters": {
            "type": "object",
            "properties": {
                "group_id": {"type": "string", "description": "ID of the group"},
                "member_name": {"type": "string", "description": "Full name of the person to add"},
            },
            "required": ["group_id", "member_name"],
        },
    },
    {
        "name": "remove_member",
        "description": "Remove a member from a group. Only the group owner can do this.",
        "parameters": {
            "type": "object",
            "properties": {
                "group_id": {"type": "string", "description": "ID of the group"},
                "member_name": {"type": "string", "description": "Name of the member to remove"},
            },
            "required": ["group_id", "member_name"],
        },
    },
    {
        "name": "create_expense",
        "description": (
            "Add a new expense to a group. Infer relative dates (e.g. 'yesterday' → ISO date). "
            "If split_among is omitted, the expense is split equally among all group members."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "group_id": {"type": "string", "description": "ID of the group"},
                "title": {
                    "type": "string",
                    "description": "Short descriptive name, e.g. 'Dinner at Barbeque Nation'",
                },
                "amount": {"type": "number", "description": "Total amount in the group's currency"},
                "paid_by_name": {
                    "type": "string",
                    "description": "Exact name of the person who paid (must match a group member)",
                },
                "split_among": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Names of members to split among. Omit to split among everyone.",
                },
                "category": {
                    "type": "string",
                    "description": "food | travel | accommodation | entertainment | shopping | utilities | other",
                },
                "date": {
                    "type": "string",
                    "description": "ISO date YYYY-MM-DD. Omit or null for today.",
                },
            },
            "required": ["group_id", "title", "amount", "paid_by_name"],
        },
    },
    {
        "name": "delete_expense",
        "description": "Delete a specific expense permanently.",
        "parameters": {
            "type": "object",
            "properties": {
                "expense_id": {"type": "string", "description": "ID of the expense to delete"},
            },
            "required": ["expense_id"],
        },
    },
    {
        "name": "settle_debt",
        "description": "Record that one person has paid another to settle a debt within a group.",
        "parameters": {
            "type": "object",
            "properties": {
                "group_id": {"type": "string", "description": "ID of the group"},
                "from_member_name": {"type": "string", "description": "Name of the person paying"},
                "to_member_name": {"type": "string", "description": "Name of the person receiving"},
                "amount": {"type": "number", "description": "Amount being settled"},
            },
            "required": ["group_id", "from_member_name", "to_member_name", "amount"],
        },
    },
    {
        "name": "show_balance",
        "description": "Show who owes what in a group, including optimised settlement suggestions.",
        "parameters": {
            "type": "object",
            "properties": {
                "group_id": {"type": "string", "description": "ID of the group"},
            },
            "required": ["group_id"],
        },
    },
    {
        "name": "list_expenses",
        "description": "List recent expenses in a group, newest first.",
        "parameters": {
            "type": "object",
            "properties": {
                "group_id": {"type": "string", "description": "ID of the group"},
                "limit": {"type": "integer", "description": "Max expenses to return (default 10, max 50)"},
            },
            "required": ["group_id"],
        },
    },
    {
        "name": "search_expenses",
        "description": "Search and filter expenses by keyword, category, date range, or amount range across one or all groups.",
        "parameters": {
            "type": "object",
            "properties": {
                "group_id": {
                    "type": "string",
                    "description": "Limit to this group. Omit to search all groups.",
                },
                "query": {"type": "string", "description": "Text to search in expense names"},
                "category": {"type": "string", "description": "Filter by category"},
                "date_from": {"type": "string", "description": "Start date YYYY-MM-DD"},
                "date_to": {"type": "string", "description": "End date YYYY-MM-DD"},
                "min_amount": {"type": "number", "description": "Minimum amount"},
                "max_amount": {"type": "number", "description": "Maximum amount"},
            },
        },
    },
    {
        "name": "summarize_group",
        "description": "Get a full summary of a group: total spent, category breakdown, top expenses, and member balances.",
        "parameters": {
            "type": "object",
            "properties": {
                "group_id": {"type": "string", "description": "ID of the group"},
            },
            "required": ["group_id"],
        },
    },
    {
        "name": "show_statistics",
        "description": "Show the user's personal spending stats, trends, and category breakdown for a time period.",
        "parameters": {
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "description": "week | month | 3M | 6M | year. Default: month",
                },
            },
        },
    },
]

TOOLS_BY_NAME: dict[str, dict] = {t["name"]: t for t in TOOL_SCHEMAS}


# ── Tool executor ─────────────────────────────────────────────────────────────

class ToolExecutor:
    """
    Translates AI tool calls into validated REST API calls.

    The LLM only decides WHAT to call.  This class handles:
    - Name → ID resolution for members
    - Request construction & auth headers
    - Error normalisation back to the AI
    """

    def __init__(self, base_url: str, token: str, context: dict):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.context = context  # {groups, current_group_id, user_name, ...}

    @property
    def _auth(self) -> dict:
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    # ── Context helpers ───────────────────────────────────────────────────────

    def _group(self, group_id: str) -> Optional[dict]:
        for g in self.context.get("groups", []):
            if g["id"] == group_id:
                return g
        return None

    def _member_id(self, group_id: str, name: str) -> Optional[str]:
        """Resolve a member name to ID within a group (fuzzy, case-insensitive)."""
        group = self._group(group_id)
        if not group:
            return None
        nl = name.lower().strip()
        for m in group.get("members") or []:
            mn = (m.get("name") or "").lower()
            if mn == nl or nl in mn or mn in nl:
                return m.get("id")
        return None

    # ── Dispatcher ────────────────────────────────────────────────────────────

    async def execute(self, tool_name: str, args: dict) -> dict:
        logger.info(f"[tool] {tool_name} args={args}")
        handler = getattr(self, f"_exec_{tool_name}", None)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}
        try:
            return await handler(args)
        except httpx.HTTPStatusError as e:
            body = e.response.text[:300]
            return {"success": False, "error": f"API {e.response.status_code}: {body}"}
        except Exception as e:
            logger.exception(f"Tool {tool_name} raised: {e}")
            return {"success": False, "error": str(e)}

    # ── Tool implementations ──────────────────────────────────────────────────

    async def _exec_list_groups(self, args: dict) -> dict:
        groups = self.context.get("groups", [])
        return {
            "success": True,
            "count": len(groups),
            "groups": [
                {
                    "id": g["id"],
                    "name": g["name"],
                    "currency": g.get("currency", "INR"),
                    "my_net": g.get("my_net", 0),
                    "member_count": len(g.get("members") or []),
                }
                for g in groups
            ],
        }

    async def _exec_create_group(self, args: dict) -> dict:
        async with httpx.AsyncClient(timeout=25) as http:
            r = await http.post(
                f"{self.base_url}/api/trips",
                json={
                    "name": args["name"],
                    "currency": args.get("currency", "INR"),
                    "category": args.get("category", "trip"),
                    "members": [],
                },
                headers=self._auth,
            )
            r.raise_for_status()
            gid = r.json().get("id") or r.json().get("trip_id")
            added = []
            for mname in args.get("members") or []:
                mr = await http.post(
                    f"{self.base_url}/api/trips/{gid}/members",
                    json={"name": mname},
                    headers=self._auth,
                )
                if mr.status_code in (200, 201):
                    added.append(mname)
        return {
            "success": True,
            "group_id": gid,
            "name": args["name"],
            "currency": args.get("currency", "INR"),
            "members_added": added,
        }

    async def _exec_rename_group(self, args: dict) -> dict:
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.patch(
                f"{self.base_url}/api/trips/{args['group_id']}",
                json={"name": args["new_name"]},
                headers=self._auth,
            )
            r.raise_for_status()
        return {"success": True, "group_id": args["group_id"], "new_name": args["new_name"]}

    async def _exec_delete_group(self, args: dict) -> dict:
        if not args.get("confirmed"):
            return {
                "success": False,
                "error": "Deletion requires explicit user confirmation. Ask the user to confirm first.",
            }
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.delete(
                f"{self.base_url}/api/trips/{args['group_id']}",
                headers=self._auth,
            )
            r.raise_for_status()
        return {"success": True, "group_id": args["group_id"], "message": "Group permanently deleted."}

    async def _exec_add_member(self, args: dict) -> dict:
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.post(
                f"{self.base_url}/api/trips/{args['group_id']}/members",
                json={"name": args["member_name"]},
                headers=self._auth,
            )
            r.raise_for_status()
            data = r.json()
        return {
            "success": True,
            "group_id": args["group_id"],
            "member_name": args["member_name"],
            "member_id": data.get("id"),
        }

    async def _exec_remove_member(self, args: dict) -> dict:
        mid = self._member_id(args["group_id"], args["member_name"])
        if not mid:
            group = self._group(args["group_id"])
            names = [m.get("name") for m in (group or {}).get("members") or []]
            return {
                "success": False,
                "error": f"Member '{args['member_name']}' not found. Available: {names}",
            }
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.delete(
                f"{self.base_url}/api/trips/{args['group_id']}/members/{mid}",
                headers=self._auth,
            )
            r.raise_for_status()
        return {"success": True, "group_id": args["group_id"], "member_name": args["member_name"]}

    async def _exec_create_expense(self, args: dict) -> dict:
        group = self._group(args["group_id"])
        members = (group or {}).get("members") or []

        # If group members have no names, fetch them fresh
        if members and not members[0].get("name"):
            members = await self._fetch_members(args["group_id"])

        member_map_by_name: dict = {}
        for m in members:
            mn = (m.get("name") or "").lower().strip()
            member_map_by_name[mn] = m

        # Resolve payer
        paid_by_name = (args["paid_by_name"] or "").strip()
        paid_by_id = None
        canonical_name = paid_by_name
        pbl = paid_by_name.lower()
        for mn, m in member_map_by_name.items():
            if mn == pbl or pbl in mn or mn in pbl:
                paid_by_id = m["id"]
                canonical_name = m.get("name", paid_by_name)
                break

        if not paid_by_id:
            available = [m.get("name") for m in members]
            return {
                "success": False,
                "error": (
                    f"Payer '{paid_by_name}' not found in group. "
                    f"Available members: {available}"
                ),
            }

        # Resolve split_among
        split_ids = None
        split_names: list[str] = []
        if args.get("split_among"):
            split_ids = []
            for sname in args["split_among"]:
                sl = sname.lower().strip()
                for mn, m in member_map_by_name.items():
                    if mn == sl or sl in mn or mn in sl:
                        split_ids.append(m["id"])
                        split_names.append(m.get("name", sname))
                        break

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        date = args.get("date") or today

        async with httpx.AsyncClient(timeout=20) as http:
            r = await http.post(
                f"{self.base_url}/api/trips/{args['group_id']}/expenses",
                json={
                    "name": args["title"],
                    "amount": float(args["amount"]),
                    "paid_by": paid_by_id,
                    "split_among": split_ids,
                    "category": args.get("category", "other"),
                    "date": date,
                },
                headers=self._auth,
            )
            r.raise_for_status()

        return {
            "success": True,
            "expense_id": r.json().get("id"),
            "title": args["title"],
            "amount": args["amount"],
            "currency": (group or {}).get("currency", "INR"),
            "paid_by": canonical_name,
            "split_among": split_names or "everyone",
            "date": date,
            "group_id": args["group_id"],
        }

    async def _exec_delete_expense(self, args: dict) -> dict:
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.delete(
                f"{self.base_url}/api/expenses/{args['expense_id']}",
                headers=self._auth,
            )
            r.raise_for_status()
        return {"success": True, "expense_id": args["expense_id"]}

    async def _exec_settle_debt(self, args: dict) -> dict:
        members = await self._fetch_members(args["group_id"])
        member_map = {(m.get("name") or "").lower(): m for m in members}

        from_id = to_id = None
        for mn, m in member_map.items():
            fl = args["from_member_name"].lower()
            tl = args["to_member_name"].lower()
            if fl in mn or mn in fl:
                from_id = m["id"]
            if tl in mn or mn in tl:
                to_id = m["id"]

        if not from_id or not to_id:
            return {
                "success": False,
                "error": (
                    f"Could not resolve member names. "
                    f"Available: {[m.get('name') for m in members]}"
                ),
            }

        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.post(
                f"{self.base_url}/api/trips/{args['group_id']}/settle",
                json={
                    "from_member": from_id,
                    "to_member": to_id,
                    "amount": float(args["amount"]),
                },
                headers=self._auth,
            )
            r.raise_for_status()

        return {
            "success": True,
            "from": args["from_member_name"],
            "to": args["to_member_name"],
            "amount": args["amount"],
            "group_id": args["group_id"],
        }

    async def _exec_show_balance(self, args: dict) -> dict:
        async with httpx.AsyncClient(timeout=20) as http:
            r = await http.get(
                f"{self.base_url}/api/trips/{args['group_id']}",
                headers=self._auth,
            )
            r.raise_for_status()
        data = r.json()
        group = self._group(args["group_id"])
        currency = (group or {}).get("currency") or data.get("currency", "INR")
        return {
            "success": True,
            "group_name": data.get("name"),
            "total_spent": data.get("total_spent", 0),
            "currency": currency,
            "balances": [
                {"name": b.get("name"), "net": round(b.get("net", 0), 2)}
                for b in data.get("balances", [])
            ],
            "settlement_transactions": [
                {
                    "from": t["from_name"],
                    "to": t["to_name"],
                    "amount": t["amount"],
                }
                for t in data.get("settlement_transactions", [])
            ],
        }

    async def _exec_list_expenses(self, args: dict) -> dict:
        limit = min(int(args.get("limit") or 10), 50)
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.get(
                f"{self.base_url}/api/expenses/{args['group_id']}",
                headers=self._auth,
            )
            r.raise_for_status()
        expenses = [e for e in r.json() if not e.get("is_settlement")]
        expenses.sort(key=lambda x: x.get("date", ""), reverse=True)
        return {
            "success": True,
            "group_id": args["group_id"],
            "count": len(expenses),
            "expenses": [
                {
                    "id": e.get("id"),
                    "name": e.get("name") or e.get("description"),
                    "amount": e.get("amount"),
                    "date": e.get("date"),
                    "category": e.get("category"),
                    "paid_by_name": e.get("paid_by_name"),
                }
                for e in expenses[:limit]
            ],
        }

    async def _exec_search_expenses(self, args: dict) -> dict:
        gid = args.get("group_id")
        groups = [gid] if gid else [g["id"] for g in self.context.get("groups", [])]

        all_exp: list[dict] = []
        async with httpx.AsyncClient(timeout=20) as http:
            for group_id in groups[:6]:
                r = await http.get(
                    f"{self.base_url}/api/expenses/{group_id}",
                    headers=self._auth,
                )
                if r.status_code == 200:
                    all_exp.extend(r.json() or [])

        q = (args.get("query") or "").lower()
        cat = (args.get("category") or "").lower()
        df = args.get("date_from")
        dt = args.get("date_to")
        mn = args.get("min_amount")
        mx = args.get("max_amount")

        results = []
        for e in all_exp:
            if e.get("is_settlement"):
                continue
            name = ((e.get("name") or e.get("description")) or "").lower()
            if q and q not in name:
                continue
            if cat and (e.get("category") or "").lower() != cat:
                continue
            edate = e.get("date", "")
            if df and edate < df:
                continue
            if dt and edate > dt:
                continue
            amt = e.get("amount", 0)
            if mn is not None and amt < mn:
                continue
            if mx is not None and amt > mx:
                continue
            results.append({
                "id": e.get("id"),
                "name": e.get("name") or e.get("description"),
                "amount": amt,
                "date": edate,
                "category": e.get("category"),
                "paid_by_name": e.get("paid_by_name"),
                "trip_id": e.get("trip_id"),
            })

        results.sort(key=lambda x: x.get("date", ""), reverse=True)
        return {"success": True, "count": len(results), "expenses": results[:20]}

    async def _exec_summarize_group(self, args: dict) -> dict:
        async with httpx.AsyncClient(timeout=20) as http:
            r = await http.get(
                f"{self.base_url}/api/trips/{args['group_id']}",
                headers=self._auth,
            )
            r.raise_for_status()
        data = r.json()
        expenses = [e for e in data.get("expenses", []) if not e.get("is_settlement")]
        top = sorted(expenses, key=lambda x: x.get("amount", 0), reverse=True)[:5]
        return {
            "success": True,
            "name": data.get("name"),
            "total_spent": data.get("total_spent", 0),
            "currency": data.get("currency", "INR"),
            "expense_count": len(expenses),
            "by_category": data.get("by_category", {}),
            "top_expenses": [
                {
                    "name": e.get("name"),
                    "amount": e.get("amount"),
                    "paid_by": e.get("paid_by_name"),
                }
                for e in top
            ],
            "member_count": len(data.get("members", [])),
            "settlement_transactions": data.get("settlement_transactions", [])[:5],
        }

    async def _exec_show_statistics(self, args: dict) -> dict:
        period = args.get("period", "month")
        async with httpx.AsyncClient(timeout=20) as http:
            r = await http.get(
                f"{self.base_url}/api/insights?period={period}",
                headers=self._auth,
            )
            r.raise_for_status()
        return {"success": True, "period": period, **r.json()}

    # ── Internal helpers ──────────────────────────────────────────────────────

    async def _fetch_members(self, group_id: str) -> list[dict]:
        """Fetch full member details (name + ID) for a group from the API."""
        # First try local context
        group = self._group(group_id)
        if group:
            members = group.get("members") or []
            if members and all(m.get("name") for m in members):
                return members

        try:
            async with httpx.AsyncClient(timeout=15) as http:
                r = await http.get(
                    f"{self.base_url}/api/trips/{group_id}",
                    headers=self._auth,
                )
                if r.status_code == 200:
                    return [
                        {"id": m.get("id"), "name": m.get("name")}
                        for m in r.json().get("members", [])
                    ]
        except Exception as e:
            logger.warning(f"Could not fetch members for {group_id}: {e}")
        return []
