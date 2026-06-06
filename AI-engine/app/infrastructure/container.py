from __future__ import annotations

from app.adapters.audit.postgres_audit_logger import PostgresAuditLogger
from app.application.services.assessment_execute_service import AssessmentExecuteService
from app.application.services.planning_agent_service import PlanningAgentService
from app.application.services.workflow_ai_event_processor import WorkflowAiEventProcessor
from app.application.services.workflow_orchestration_context_service import WorkflowOrchestrationContextService
from app.application.services.workflow_seed_service import WorkflowSeedService
from app.application.services.workflow_service import WorkflowService
from app.infrastructure.config.settings import Settings
from app.infrastructure.state.postgres_state_repository import PostgresStateRepository
from app.orchestration.smartwealth.agents.data_validation_agent import DataValidationAgent
from app.orchestration.smartwealth.agents.drafting_agent import DraftingAgent
from app.orchestration.smartwealth.graph import SmartWealthOrchestrator
from app.orchestration.smartwealth.tool_executor import RegistryToolExecutor
from app.tools.ssot_lookup_tool import SSOTLookupTool


class Container:
    """
    Explicit composition root (single location for runtime wiring).
    """

    def __init__(self) -> None:
        self.settings = Settings()
        _dsn = self.settings.resolved_database_url
        self.state_repository = PostgresStateRepository(_dsn)
        self.audit_logger = PostgresAuditLogger(_dsn)
        self.validation_agent = DataValidationAgent()
        self.drafting_agent = DraftingAgent()
        self.ssot_lookup_tool = SSOTLookupTool()
        self.tool_executor = RegistryToolExecutor(
            read_only_tools=[self.ssot_lookup_tool],
        )
        self.tool_permissions = {
            self.drafting_agent.agent_id: {
                self.ssot_lookup_tool.tool_id,
            }
        }
        self.orchestrator = SmartWealthOrchestrator(
            state_repository=self.state_repository,
            audit_logger=self.audit_logger,
            validation_agent=self.validation_agent,
            drafting_agent=self.drafting_agent,
            tool_executor=self.tool_executor,
            tool_permissions=self.tool_permissions,
        )
        self.workflow_service = WorkflowService(
            state_repository=self.state_repository,
            audit_logger=self.audit_logger,
            orchestrator=self.orchestrator,
        )
        self.planning_agent_service = PlanningAgentService(self.settings)
        self.assessment_execute_service = AssessmentExecuteService(self.settings)
        self.workflow_ai_event_processor = WorkflowAiEventProcessor(self.settings)
        self.workflow_seed_service = WorkflowSeedService(self.settings)
        self.workflow_orchestration_context_service = WorkflowOrchestrationContextService(self.settings)


container = Container()
