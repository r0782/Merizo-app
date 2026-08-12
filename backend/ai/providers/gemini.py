"""
Google Gemini 2.5 Flash provider.

Uses the official google-genai SDK (>=2.0.0) with native function calling.
Falls back to asyncio.to_thread when the async client is unavailable.
"""
import asyncio
import logging
from typing import Optional

from .base import LLMProvider, LLMResponse

logger = logging.getLogger("merizo.gemini_provider")


class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        self.api_key = api_key
        self.model = model
        self._client = None

    # ── Client singleton ──────────────────────────────────────────────────────

    def _get_client(self):
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    # ── Conversion helpers ────────────────────────────────────────────────────

    def _build_contents(self, messages: list[dict]):
        from google.genai import types
        contents = []
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            text = msg.get("content") or ""
            if text:
                contents.append(types.Content(role=role, parts=[types.Part(text=text)]))
        return contents

    def _build_tools(self, tools: list[dict]):
        from google.genai import types
        declarations = []
        for t in tools:
            fn = t.get("function", t)
            declarations.append(
                types.FunctionDeclaration(
                    name=fn["name"],
                    description=fn["description"],
                    parameters=fn.get("parameters"),
                )
            )
        return [types.Tool(function_declarations=declarations)]

    # ── Core generation ───────────────────────────────────────────────────────

    async def generate(self, system: str, messages: list[dict], tools: Optional[list[dict]] = None) -> LLMResponse:
        from google.genai import types
        client = self._get_client()
        contents = self._build_contents(messages)

        cfg: dict = {
            "system_instruction": system,
            "temperature": 0.3,
            "max_output_tokens": 2048,
        }
        if tools:
            cfg["tools"] = self._build_tools(tools)
            cfg["tool_config"] = types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="AUTO")
            )
        config = types.GenerateContentConfig(**cfg)

        try:
            # Use async client path
            response = await client.aio.models.generate_content(
                model=self.model, contents=contents, config=config
            )
        except Exception as e:
            logger.warning(f"Gemini async failed ({e}), retrying via thread")
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self.model, contents=contents, config=config,
            )

        return self._parse_response(response)

    def _parse_response(self, response) -> LLMResponse:
        try:
            candidate = response.candidates[0]
            for part in candidate.content.parts:
                fc = getattr(part, "function_call", None)
                if fc and getattr(fc, "name", None):
                    return LLMResponse(
                        type="tool_call",
                        tool_name=fc.name,
                        tool_args=dict(fc.args) if fc.args else {},
                    )
                txt = getattr(part, "text", None)
                if txt:
                    return LLMResponse(type="text", content=txt)
        except (IndexError, AttributeError) as e:
            logger.warning(f"Could not parse Gemini response: {e}")
        return LLMResponse(type="text", content="")

    async def generate_after_tool(
        self,
        system: str,
        messages: list[dict],
        tool_name: str,
        tool_args: dict,
        tool_result: dict,
    ) -> str:
        from google.genai import types
        client = self._get_client()
        contents = self._build_contents(messages)

        # Append the model's tool call
        contents.append(types.Content(
            role="model",
            parts=[types.Part(function_call=types.FunctionCall(name=tool_name, args=tool_args))],
        ))
        # Append the tool result as a user turn
        contents.append(types.Content(
            role="user",
            parts=[types.Part(function_response=types.FunctionResponse(
                name=tool_name,
                response={"result": tool_result},
            ))],
        ))

        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.3,
            max_output_tokens=1024,
        )

        try:
            response = await client.aio.models.generate_content(
                model=self.model, contents=contents, config=config
            )
        except Exception as e:
            logger.warning(f"Gemini async failed ({e}), retrying via thread")
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self.model, contents=contents, config=config,
            )

        try:
            for part in response.candidates[0].content.parts:
                txt = getattr(part, "text", None)
                if txt:
                    return txt
        except (IndexError, AttributeError):
            pass
        return ""
