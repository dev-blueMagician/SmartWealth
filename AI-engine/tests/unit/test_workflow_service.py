import asyncio

from app.adapters.audit.in_memory_audit_logger import InMemoryAuditLogger
from app.infrastructure.state.in_memory_state_repository import InMemoryStateRepository
from app.orchestration.smartwealth.agents.data_validation_agent import DataValidationAgent
from app.orchestration.smartwealth.agents.drafting_agent import DraftingAgent
from app.orchestration.smartwealth.graph import SmartWealthOrchestrator
from app.orchestration.smartwealth.tool_executor import RegistryToolExecutor
from app.tools.ssot_lookup_tool import SSOTLookupTool


def _orchestrator_and_state_repo() -> tuple[SmartWealthOrchestrator, InMemoryStateRepository]:
    """Hermetic harness without PostgreSQL (production container uses Postgres repositories)."""
    state_repository = InMemoryStateRepository()
    audit_logger = InMemoryAuditLogger()
    validation_agent = DataValidationAgent()
    drafting_agent = DraftingAgent()
    ssot_lookup_tool = SSOTLookupTool()
    tool_executor = RegistryToolExecutor(read_only_tools=[ssot_lookup_tool])
    tool_permissions = {drafting_agent.agent_id: {ssot_lookup_tool.tool_id}}
    orchestrator = SmartWealthOrchestrator(
        state_repository=state_repository,
        audit_logger=audit_logger,
        validation_agent=validation_agent,
        drafting_agent=drafting_agent,
        tool_executor=tool_executor,
        tool_permissions=tool_permissions,
    )
    return orchestrator, state_repository


def test_workflow_stops_at_human_gate() -> None:
    orchestrator, state_repository = _orchestrator_and_state_repo()
    state = state_repository.create({"customer_id": "C001", "amount": 1000})
    workflow_id = state.workflow_id

    result = asyncio.run(orchestrator.run_until_human_gate(workflow_id))

    assert result["status"] == "PENDING_HUMAN_APPROVAL"
    assert result["ai_draft"] is not None


def test_human_approval_completes_workflow() -> None:
    orchestrator, state_repository = _orchestrator_and_state_repo()
    state = state_repository.create({"customer_id": "C001"})
    workflow_id = state.workflow_id
    asyncio.run(orchestrator.run_until_human_gate(workflow_id))

    approved = orchestrator.apply_human_decision(
        workflow_id=workflow_id,
        approved=True,
        reviewer_id="reviewer_01",
        note="Approved after review",
    )

    assert approved["status"] == "HUMAN_APPROVED"
