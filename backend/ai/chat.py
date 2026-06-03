import os, json, httpx
from groq import Groq
from .prompts import SYSTEM_PROMPT, LANGUAGE_INSTRUCTIONS

client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
BACKEND_URL = os.environ.get("BACKEND_URL", "https://merizo-app.onrender.com")

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_group",
            "description": "Create a new expense group/trip",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Group name"},
                    "members": {"type": "array", "items": {"type": "string"}, "description": "List of member names"},
                    "currency": {"type": "string", "default": "INR"}
                },
                "required": ["name", "members"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_expense",
            "description": "Add an expense to a group",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_id": {"type": "string"},
                    "title": {"type": "string"},
                    "amount": {"type": "number"},
                    "paid_by_name": {"type": "string"},
                    "split_type": {"type": "string", "enum": ["equal", "exact"]},
                    "currency": {"type": "string", "default": "INR"},
                    "category": {"type": "string", "default": "other"}
                },
                "required": ["title", "amount", "paid_by_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_groups",
            "description": "Get list of user groups",
            "parameters": {"type": "object", "properties": {}}
        }
    }
]

def build_system_prompt(context: dict) -> str:
    language   = context.get("language", "en")
    members    = ", ".join([m.get("name", "") for m in context.get("members", [])])
    group_name = context.get("group_name", "")
    currency   = context.get("currency", "INR")
    group_id   = context.get("group_id", "")
    lang_instr = LANGUAGE_INSTRUCTIONS.get(language, "Respond in English.")
    
    ctx = f"\nContext:\n- Currency: {currency}\n- {lang_instr}"
    if group_name:
        ctx += f"\n- Current group: {group_name} (id: {group_id})"
        ctx += f"\n- Members: {members}"
    return SYSTEM_PROMPT + ctx

async def execute_tool(tool_name: str, args: dict, token: str) -> str:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient() as http:
        if tool_name == "create_group":
            r = await http.post(f"{BACKEND_URL}/api/trips", 
                json={"name": args["name"], "currency": args.get("currency", "INR"), "category": "trip"},
                headers=headers, timeout=10)
            if r.status_code in (200, 201):
                trip = r.json()
                # Add members
                for member_name in args.get("members", []):
                    await http.post(f"{BACKEND_URL}/api/trips/{trip['id']}/members",
                        json={"name": member_name}, headers=headers, timeout=10)
                return json.dumps({"success": True, "group_id": trip["id"], "name": trip["name"]})
            return json.dumps({"success": False, "error": r.text})

        elif tool_name == "create_expense":
            group_id = args.get("group_id", "")
            if not group_id:
                return json.dumps({"success": False, "error": "No group selected"})
            r = await http.post(f"{BACKEND_URL}/api/trips/{group_id}/expenses",
                json={
                    "name": args["title"], "amount": args["amount"],
                    "currency": args.get("currency", "INR"),
                    "category": args.get("category", "other"),
                    "paid_by_name": args["paid_by_name"],
                    "split_type": args.get("split_type", "equal")
                },
                headers=headers, timeout=10)
            if r.status_code in (200, 201):
                return json.dumps({"success": True, "expense": args["title"], "amount": args["amount"]})
            return json.dumps({"success": False, "error": r.text})

        elif tool_name == "get_groups":
            r = await http.get(f"{BACKEND_URL}/api/trips", headers=headers, timeout=10)
            if r.status_code == 200:
                groups = r.json()
                return json.dumps({"groups": [{"id": g["id"], "name": g["name"]} for g in groups[:10]]})
            return json.dumps({"groups": []})

    return json.dumps({"error": "unknown tool"})

async def get_chat_response(message: str, history: list, context: dict, token: str = "") -> str:
    import logging
    logger = logging.getLogger("merizo.ai")
    messages = [{"role": "system", "content": build_system_prompt(context)}]
    for msg in history[-10:]:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": message})
    
    # First call with tools
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        tools=TOOLS,
        tool_choice="auto",
        max_tokens=1024,
        temperature=0.7,
    )
    
    msg = response.choices[0].message
    logger.info(f"AI response: tool_calls={bool(msg.tool_calls)}, content={msg.content[:50] if msg.content else None}")
    
    # If AI wants to call a tool
    if msg.tool_calls:
        messages.append({"role": "assistant", "content": msg.content or "", "tool_calls": [
            {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
            for tc in msg.tool_calls
        ]})
        
        # Execute each tool call
        for tc in msg.tool_calls:
            args = json.loads(tc.function.arguments)
            # Inject group_id from context if not provided
            if tc.function.name == "create_expense" and "group_id" not in args:
                args["group_id"] = context.get("group_id", "")
            
            result = await execute_tool(tc.function.name, args, token)
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})
        
        # Get final response after tool execution
        final = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=512,
            temperature=0.7,
        )
        return final.choices[0].message.content
    
    return msg.content or ""
