CREATE TABLE client (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    risk_profile VARCHAR(50),
    residency VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "case" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES client(id),
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE task (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES "case"(id),
    task_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE goal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES client(id),
    goal_type VARCHAR(50) NOT NULL,
    target_amount NUMERIC(18,2) NOT NULL
);

CREATE TABLE financial_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES client(id),
    status VARCHAR(50) NOT NULL,
    version_no INT NOT NULL DEFAULT 1,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    content JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE recommendation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_version_id UUID NOT NULL REFERENCES financial_plan(id),
    rec_type VARCHAR(50) NOT NULL,
    summary TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE decision (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES recommendation(id),
    decision_status VARCHAR(50) NOT NULL,
    decided_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES client(id),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE portfolio_allocation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolio(id),
    asset_class VARCHAR(50) NOT NULL,
    percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100)
);

CREATE TABLE audit_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE asset (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES client(id),
    asset_type VARCHAR(50) NOT NULL,
    value NUMERIC(18,2) NOT NULL
);
