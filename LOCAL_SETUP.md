# SmartWealth — Local Setup Guide

> Goal: get all three services (Java backend, Python AI-engine, React frontend) running
> locally against one PostgreSQL instance. Follow the sections **in order**.
>
> Ports: backend `8090` · AI-engine `8010` · frontend `3000` · Postgres `5432`

---

## 0. Prerequisites (install once)

| Tool | Version | Check |
|------|---------|-------|
| JDK | **21** | `java -version` |
| Maven | 3.9+ (or use `mvnw`) | `mvn -v` |
| Python | **3.11+** | `python --version` |
| Node.js | 20+ (LTS) | `node -v` |
| PostgreSQL | 14+ | `psql --version` |
| Git | any | `git --version` |

> The backend build tool is **Maven** (confirmed in `backend/pom.xml`). The handover note
> saying "Marvin library" is a transcription error.

---

## 1. Clone and branch

```powershell
git clone <repo-url> SmartWealth
cd SmartWealth
git checkout main
git pull
git checkout -b thanh/<feature>   # base your work on main (it is the only branch)
```

---

## 2. PostgreSQL — database, schema, and role

Both backend and AI-engine connect to **database `postgres`, schema `smartwealth`**.

When the service won't start, we can run our own Postgres instance as your normal user, against a data folder you own, on a local port. No admin, no service, no Docker.
This instance does not auto-start on reboot (that was the disabled service's job). After every reboot, run one command (no admin):

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" -D "C:\Users\Admin\pgdata-sw" -l "C:\Users\Admin\pgdata-sw\server.log" -o "-p 5432" start
```

The backend's `application.yml` ships with a personal dev login (`ducnv3.gfs` / `123123`).
Pick **one** of the two options below.

**Option A — create the role Duc used (no code change):**
```sql
-- run as a Postgres superuser, e.g. psql -U postgres
CREATE ROLE "ducnv3.gfs" LOGIN PASSWORD '123123';
ALTER ROLE "ducnv3.gfs" CREATEDB;
CREATE SCHEMA IF NOT EXISTS smartwealth AUTHORIZATION "ducnv3.gfs";
```

**Option B — use the stock `postgres` user (edit `backend/src/main/resources/application.yml`):**
```yaml
    username: postgres
    password: <your-postgres-password>
```
then:
```sql
CREATE SCHEMA IF NOT EXISTS smartwealth;
```

> The backend creates **its own** tables automatically on startup (Flyway `V1`–`V14`
> + JPA `ddl-auto: update`). You do **not** need a database dump.

---

## 3. Backend (Java / Spring Boot) — start FIRST

Starting the backend first lets Flyway build the shared `smartwealth` schema before the
AI-engine needs it.

```powershell
cd backend
mvn clean compile        # regenerates OpenAPI models from the 6 phase specs
mvn spring-boot:run
```

Verify:
- API up: <http://localhost:8090>
- Swagger UI: <http://localhost:8090/swagger-ui.html>

Default bootstrap admin (from `application.yml`): `admin` / `changeme`.

---

## 4. AI-engine (Python / FastAPI) — start SECOND

### 4a. Create the `.env`
```powershell
cd ..\AI-engine
copy .env.example .env
```
Edit `.env` and set **at minimum**:
```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_USER=ducnv3.gfs          # or postgres, matching section 2
DB_PASSWORD=123123          # or your postgres password
DB_NAME=postgres
DB_SCHEMA=smartwealth

# MUST match the backend's internal-token default (application.yml -> wealth.ai-engine.internal-token)
INTERNAL_WORKFLOW_EVENT_TOKEN=secret-test

# LLM is OPTIONAL for local dev — leave disabled to run rule-based agents with no API key.
ASSESSMENT_LLM_ENABLED=false
# To enable real LLM chat, set ASSESSMENT_LLM_ENABLED=true and provide ONE provider's key:
# DEEPSEEK_API_KEY=...        (default provider)
# or LLM_PROVIDER=azure_openai + AZURE_OPENAI_* keys
```

> **LLM note:** the code default is **DeepSeek** (not OpenAI, despite the handover note).
> No key is needed to boot; agents fall back to rule-based mode when
> `ASSESSMENT_LLM_ENABLED=false`. Confirm the intended provider with Duc.

### 4b. Install dependencies
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

### 4c. Create AI-engine tables + seed the catalog (one-time)
Unlike the backend, the AI-engine does **not** auto-migrate. Run its SQL once, in
**this order** (authoritative sequence per `AI-engine/docs/endpoint.md`):

```powershell
# 1. Orchestration + workflow-AI pipeline tables (orchestration_request, workflow_event, workflow_ai_trigger, ...)
psql -U ducnv3.gfs -d postgres -f scripts\sql\orchestration_minimal.sql
psql -U ducnv3.gfs -d postgres -f scripts\sql\workflow_ai_pipeline.sql

# 2. Interaction catalog tables (ai_interaction / case_phase), then seed phase -> assessment codes
psql -U ducnv3.gfs -d postgres -f scripts\sql\ai_interaction_catalog_tables.sql
python scripts\seed_ai_interaction_catalog.py

# 3. OPTIONAL — demo workflow/orchestration fixtures for end-to-end testing
psql -U ducnv3.gfs -d postgres -f scripts\sql\seed_workflow_ai_pipeline.sql
psql -U ducnv3.gfs -d postgres -f scripts\sql\seed_orchestration_complete.sql
```

> **Gotcha (from the VN docs):** the **`workflow_state` and `workflow_audit_event`**
> tables (used by the `/api/v1/workflows` HTTP API) are **not shipped as a DDL file**.
> If you exercise that API and hit a missing-table error, create them from the backend
> entity `WorkflowAuditEventEntity` / the `PostgresStateRepository` adapter, or skip the
> `/api/v1/workflows` path (the chat flow does not need it).

### 4d. Run
```powershell
$env:PYTHONPATH = (Get-Location).Path
uvicorn app.main:app --port 8010
```
Verify: <http://localhost:8010/docs>

---

## 5. Frontend (React / Vite) — start LAST

### 5a. Create `.env.local`
```powershell
cd ..\frontend
copy .env.example .env.local
```
Confirm these point at your local services (defaults already correct):
```dotenv
VITE_WEALTH_API_BASE_URL="http://localhost:8090"
VITE_AI_ENGINE_BASE_URL="http://localhost:8010"
VITE_WORKFLOW_API_BASE_URL="http://localhost:8090"
VITE_INTERNAL_WORKFLOW_TOKEN="secret-test"   # must match the AI-engine token above
# GEMINI_API_KEY is optional (only for the optional Gemini draft feature)
```

### 5b. Install and run
```powershell
npm install
npm run dev
```
Open: <http://localhost:3000>

---

## 6. Startup order (quick reference)

```
1. PostgreSQL      (running, schema smartwealth exists)
2. Backend         mvn spring-boot:run            -> :8090  (Flyway builds schema)
3. AI-engine       uvicorn app.main:app --port 8010 -> :8010 (after one-time SQL + seed)
4. Frontend        npm run dev                    -> :3000
```

---

## 7. Smoke test

1. Frontend loads at `:3000` and you can log in as `admin` / `changeme`.
2. Swagger reachable at `:8090/swagger-ui.html`.
3. AI-engine docs reachable at `:8010/docs`.
4. `GET http://localhost:8010/api/v1/case-phase-assessments` returns the seeded
   phase → assessment manifest (confirms the catalog seed worked).
5. Open a case and send a chat message — exercises backend ↔ AI-engine
   (`/internal/chat/turn`). A 401 here almost always means the internal token
   doesn't match between backend, AI-engine `.env`, and frontend.

---

## 8. Common gotchas

| Symptom | Cause / fix |
|---------|-------------|
| Backend fails on DB connect | Role `ducnv3.gfs` missing — see section 2 (create it or switch to `postgres`). |
| Chat / workflow calls return 401 | Token mismatch. Backend default is `secret-test`; set the same in AI-engine `.env` (`INTERNAL_WORKFLOW_EVENT_TOKEN`) and frontend (`VITE_INTERNAL_WORKFLOW_TOKEN`). |
| `case-phase-assessments` empty | Catalog not seeded — rerun `python scripts/seed_ai_interaction_catalog.py`. |
| AI-engine import errors | `PYTHONPATH` not set to the `AI-engine/` dir, or venv not activated. |
| LLM features do nothing | Expected when `ASSESSMENT_LLM_ENABLED=false`. Enable + add `DEEPSEEK_API_KEY` to use real LLM. |
| `mvn` build fails on Java version | Must be JDK **21** (`java -version`). |

---

## 9. Who to ask

- **Business / workflow** questions → **Loc**
- **Technical / setup** questions → **Duc**
- **VDI access + Jira** → **Duong**
- Sequence diagrams: Duc to send via email (also in `docs/sequence-diagram/`)

> Current focus of the project: the **chat function** (main workflow); onboarding is ongoing.

---

## Appendix A — Running PostgreSQL without admin rights (this machine's setup)

The Windows service `postgresql-x64-16` won't start without admin. You don't need it.
PostgreSQL 16 is already installed, so we run a **personal instance** as your own user,
against a data folder you own. No admin, no service, no Docker.

**One-time setup (already done on this machine):**
```powershell
$pgbin = "C:\Program Files\PostgreSQL\16\bin"
$data  = "C:\Users\Admin\pgdata-sw"        # a folder YOU own
& "$pgbin\initdb.exe" -D $data -U postgres -A trust -E UTF8 --locale=C
& "$pgbin\pg_ctl.exe" -D $data -l "$data\server.log" -o "-p 5432" start
# create the role + schema that application.yml expects:
& "$pgbin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "CREATE ROLE \""ducnv3.gfs\"" LOGIN SUPERUSER PASSWORD '123123';"
& "$pgbin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "CREATE SCHEMA IF NOT EXISTS smartwealth AUTHORIZATION \""ducnv3.gfs\"";"
& "$pgbin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "ALTER ROLE \""ducnv3.gfs\"" SET search_path = smartwealth, public;"
```

> `-A trust` = local connections need no password (dev only). The role's default
> `search_path` is set to `smartwealth` so every script/app lands in the right schema.

**Daily use — start / stop / status (NO admin needed):**
```powershell
$pgbin = "C:\Program Files\PostgreSQL\16\bin"; $data = "C:\Users\Admin\pgdata-sw"
& "$pgbin\pg_ctl.exe" -D $data -l "$data\server.log" -o "-p 5432" start    # start (run after every reboot)
& "$pgbin\pg_ctl.exe" -D $data status                                       # check
& "$pgbin\pg_ctl.exe" -D $data stop                                         # stop
```

> The server does **not** auto-start on boot (that's what the disabled service did).
> Run the `start` command once each time you reboot.
