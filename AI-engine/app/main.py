from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.case_phase_assessments import router as case_phase_assessments_router
from app.api.routes.internal_assessment import router as internal_assessment_router
from app.api.routes.internal_chat import router as internal_chat_router
from app.api.routes.internal_planning import router as internal_planning_router
from app.api.routes.internal_workflow import router as internal_workflow_router
from app.api.routes.workflow import router as workflow_router

_LOCAL_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def create_app() -> FastAPI:
    app = FastAPI(title="SmartWealth AI Core")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_LOCAL_DEV_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(workflow_router)
    app.include_router(case_phase_assessments_router)
    app.include_router(internal_workflow_router)
    app.include_router(internal_assessment_router)
    app.include_router(internal_planning_router)
    app.include_router(internal_chat_router)
    return app


app = create_app()
