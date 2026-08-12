"""
Groq provider — llama-3.3-70b-versatile with native tool calling.
Used as fallback when Gemini is unavailable or as a fast alternative.
"""
import asyncio
import json
import logging
from typing import Optional

from .base import LLMProvider, LLMResponse

logger = logging.getLogger("merizo.groq_provider")


class GroqProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile"):
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not configured")
        self.api_key = api_key
        self.model = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            from groq import Groq
            self._client = Groq(api_key=self.api_key)
        return self._client

    def _to_openai_tools(self, tools: list[dict]) -> list[dict]:
        """Convert generic tool dicts to OpenAI/Groq format."""
        result = []
        for t in tools:
            fn = t.get("function", t)
            result.append({
                "type": "function",
                "function": {
                    "name": fn["name"],
                    "description": fn["description"],
                    "parameters": fn.get("parameters", {"type": "object", "properties": {}}),
                },
            })
        return result

    def _to_groq_messages(self, system: str, messages: list[dict]) -> list[dict]:
        result = [{"role": "system", "content": system}]
        for m in messages:
            role = m.get("role", "user")
            if role == "model":
                role = "assistant"
            result.append({"role": role, "content": m.get("content") or ""})
        return result

    async def generate(self, system: str, messages: list[dict], tools: Optional[list[dict]] = None) -> LLMResponse:
        client = self._get_client()
        groq_messages = self._to_groq_messages(system, messages)
        kwargs: dict = {
            "model": self.model,
            "messages": groq_messages,
            "temperature": 0.3,
            "max_tokens": 2048,
        }
        if tools:
            kwargs["tools"] = self._to_openai_tools(tools)
            kwargs["tool_choice"] = "auto"

        try:
            response = await asyncio.to_thread(
                lambda: client.chat.completions.create(**kwargs)
            )
        except Exception as e:
            logger.error(f"Groq generate error: {e}")
            raise

        msg = response.choices[0].message
        if msg.tool_calls:
            tc = msg.tool_calls[0]
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            return LLMResponse(type="tool_call", tool_name=tc.function.name, tool_args=args)
        return LLMResponse(type="text", content=msg.content or "")

    async def generate_after_tool(
        self,
        system: str,
        messages: list[dict],
        tool_name: str,
        tool_args: dict,
        tool_result: dict,
    ) -> str:
        client = self._get_client()
        groq_messages = self._to_groq_messages(system, messages)

        # Append tool call from assistant
        groq_messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": [{
                "id": "call_merizo_1",
                "type": "function",
                "function": {
                    "name": tool_name,
                    "arguments": json.dumps(tool_args),
                },
            }],
        })
        # Append tool result
        groq_messages.append({
            "role": "tool",
            "tool_call_id": "call_merizo_1",
            "content": json.dumps(tool_result),
        })

        try:
            response = await asyncio.to_thread(
                lambda: client.chat.completions.create(
                    model=self.model,
                    messages=groq_messages,
                    temperature=0.3,
                    max_tokens=512,
                )
            )
        except Exception as e:
            logger.error(f"Groq generate_after_tool error: {e}")
            raise

        return response.choices[0].message.content or ""
