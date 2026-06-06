from __future__ import annotations

from app.domain.smartwealth.interfaces.ports import (
    ComputationTool,
    ReadOnlyDataTool,
    RuleCheckTool,
    ToolExecutor,
)


class RegistryToolExecutor(ToolExecutor):
    """
    Resolves tools by name and executes them by category.
    """

    def __init__(
        self,
        read_only_tools: list[ReadOnlyDataTool] | None = None,
        rule_check_tools: list[RuleCheckTool] | None = None,
        computation_tools: list[ComputationTool] | None = None,
    ) -> None:
        self._read_only_tools = {
            tool.tool_id: tool for tool in (read_only_tools or [])
        }
        self._rule_check_tools = {
            tool.tool_id: tool for tool in (rule_check_tools or [])
        }
        self._computation_tools = {
            tool.tool_id: tool for tool in (computation_tools or [])
        }

    def execute_tool(self, tool_name: str, tool_input: dict[str, object]) -> dict[str, object]:
        if tool_name in self._read_only_tools:
            return self._read_only_tools[tool_name].fetch(tool_input)
        if tool_name in self._rule_check_tools:
            return {"passed": self._rule_check_tools[tool_name].check(tool_input)}
        if tool_name in self._computation_tools:
            return self._computation_tools[tool_name].compute(tool_input)
        raise ValueError(f"Unknown tool: {tool_name}")
