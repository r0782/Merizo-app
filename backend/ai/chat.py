import os
import google.generativeai as genai
from .prompts import SYSTEM_PROMPT, LANGUAGE_INSTRUCTIONS

def build_system_prompt(context: dict) -> str:
    language = context.get("language", "en")
    members = ", ".join([m.get("name", "") for m in context.get("members", [])])
    group_name = context.get("group_name", "your group")
    currency = context.get("currency", "INR")
    lang_instr = LANGUAGE_INSTRUCTIONS.get(language, "Respond in English.")
    return f"{SYSTEM_PROMPT}\nContext:\n- Group: {group_name}\n- Members: {members}\n- Currency: {currency}\n- {lang_instr}"
async def get_chat_response(message: str, history: list, context: dict) -> str:
    model = genai.GenerativeModel(model_name="gemini-1.5-flash", system_instruction=build_system_prompt(context))
    gemini_history = []
    for msg in history[-10:]:
        role = "user" if msg.get("role") == "user" else "model"
        gemini_history.append({"role": role, "parts": [msg.get("content", "")]})
    chat = model.start_chat(history=gemini_history)
    response = chat.send_message(message)
    return response.text
