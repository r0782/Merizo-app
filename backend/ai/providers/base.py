"""
Abstract LLM provider interface.

Swap Gemini ↔ Groq ↔ OpenAI ↔ any future provider without touching the
orchestration or tool-calling logic — only the provider class changes.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class LLMResponse:
    """Unified response from any LLM provider."""
    type: str                     # "text" | "tool_call"
    content: str = ""
    tool_name: str = ""
    tool_args: dict = field(default_factory=dict)


class LLMProvider(ABC):
    """
    All providers must implement two methods:

    generate()             — first turn, may return text or a tool_call
    generate_after_tool()  — second turn, feeds tool result back, returns text
    """

    @abstractmethod
    async def generate(
        self,
        system: str,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
    ) -> LLMResponse:
        """
        Single generation step.

        messages: list of {"role": "user"|"model", "content": str}
        tools:    list of generic tool schema dicts (name, description, parameters)
        Returns:  LLMResponse with type="text" or type="tool_call"
        """
        ...

    @abstractmethod
    async def generate_after_tool(
        self,
        system: str,
        messages: list[dict],
        tool_name: str,
        tool_args: dict,
        tool_result: dict,
    ) -> str:
        """
        Feed a tool execution result back to the model and get the final
        natural-language response.
        """
        ...
