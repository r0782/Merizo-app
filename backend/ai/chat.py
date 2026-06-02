# backend/ai/chat.py
import google.generativeai as genai
import os, json
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

TOOLS = [
    {
        "name": "create_expense",
        "description": "Create an expense in a group",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "amount": {"type": "number"},
                "paid_by": {"type": "string"},
                "participants": {"type": "array", "items": {"type": "string"}},
                "split_type": {"type": "string", "enum": ["equal", "exact", "percent"]},
                "category": {"type": "string"}
            },
            "required": ["title", "amount", "paid_by", "participants"]
        }
    },
    {
        "name": "get_balances",
        "description": "Get current balances for the group",
        "parameters": {"type": "object", "properties": {}}
    },
    {
        "name": "explain_balance",
        "description": "Explain balances in simple plain language",
        "parameters": {
            "type": "object",
            "properties": {
                "user_name": {"type": "string"}
            }
        }
    }
]

async def chat_stream(user_message: str, history: list, context: dict):
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=build_system_prompt(context),
    )
    
    chat = model.start_chat(history=history)
    
    async def generate():
        response = chat.send_message(user_message, stream=True)
        for chunk in response:
            if chunk.text:
                yield f"data: {json.dumps({'text': chunk.text})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

def build_system_prompt(context: dict) -> str:
    members = ", ".join([m["name"] for m in context.get("members", [])])
    currency = context.get("currency", "INR")
    language = context.get("language", "en")
    
    return f"""You are Merizo AI assistant.
Group: {context.get('group_name', 'General')}
Members: {members}
Currency: {currency}
Respond in language code: {language}

{MERIZO_SYSTEM_PROMPT}"""