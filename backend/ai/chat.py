import os
from groq import Groq
from .prompts import SYSTEM_PROMPT, LANGUAGE_INSTRUCTIONS

client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))

def build_system_prompt(context: dict) -> str:
    language   = context.get("language", "en")
    members    = ", ".join([m.get("name", "") for m in context.get("members", [])])
    group_name = context.get("group_name", "your group")
    currency   = context.get("currency", "INR")
    lang_instr = LANGUAGE_INSTRUCTIONS.get(language, "Respond in English.")
    return f"{SYSTEM_PROMPT}\nContext:\n- Group: {group_name}\n- Members: {members}\n- Currency: {currency}\n- {lang_instr}"

async def get_chat_response(message: str, history: list, context: dict) -> str:
    messages = [{"role": "system", "content": build_system_prompt(context)}]
    for msg in history[-10:]:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": message})
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=1024,
        temperature=0.7,
    )
    return response.choices[0].message.content
