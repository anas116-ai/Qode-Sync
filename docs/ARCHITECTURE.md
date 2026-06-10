# Architecture Decision Records

## ADR-001: Database Choice - PostgreSQL

**Decision**: Use PostgreSQL with SQLAlchemy ORM

**Rationale**:
- JSONB support for flexible metadata storage
- Row-level security for multi-tenant
- Mature ecosystem, well-supported

## ADR-002: Background Jobs - Celery

**Decision**: Use Celery with Redis for background processing

**Rationale**:
- Reliable task queue with retry support
- Schedule support via Celery Beat
- Python-native integration

## ADR-003: Frontend Framework - React + Vite

**Decision**: Use React with Vite (not Next.js)

**Rationale**:
- Already scaffolded in existing codebase
- TanStack Router for routing
- Faster development experience

## ADR-004: Multi-tenant Architecture

**Decision**: Use RLS for data isolation

**Rationale**:
- Each user's data isolated by user_id
- Supabase supports RLS natively
- Simpler than separate schemas