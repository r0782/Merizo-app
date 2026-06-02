import os
from google import genai
from google.genai import types
from .prompts import SYSTEM_PROMPT, LANGUAGE_INSTRUCTIONS

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))

def build_system_prompt(context: dict) -> str:
    language   = context.get("language", "en")
    members    = ", ".join([m.get("name", "") for m in context.get("members", [])])
    group_name = context.get("group_name", "your group")
    currency   = context.get("currency", "INR")
    lang_instr = LANGUAGE_INSTRUCTIONS.get(language, "Respond in English.")
    return f"{SYSTEM_PROMPT}\nContext:\n- Group: {group_name}\n- Members: {members}\n- Currency: {currency}\n- {lang_instr}"

async def get_chat_response(message: str, history: list, context: dict) -> str:
    contents = []
    for msg in history[-10:]:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=msg.get("content", ""))]))
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=build_system_prompt(context))
    )
    return response.text
