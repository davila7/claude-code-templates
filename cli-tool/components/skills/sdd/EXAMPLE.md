# SDD Step-by-Step Example: OAuth2 User Authentication

> A complete walkthrough of the SDD pipeline using a real feature as the example.
> Feature: "Add user authentication with OAuth2 (GitHub + Google)"

---

## Paso 0 — Inicializar SDD (una vez por proyecto)

```
/sdd-init
```

Claude ejecuta:
1. Verifica que estés en un git repo
2. Crea `specs/` y `.claude/sdd-context.md`
3. Genera `CONSTITUTION.md` con principios base

Resultado:
```
✅ SDD initialized!
  specs/              — directorio de specs
  CONSTITUTION.md     — principios de gobernanza
  .claude/sdd-context.md
```

---

## Paso 1 — Afinar la Constitución (una vez, actualizar según evolucione el proyecto)

```
/sdd-constitution TypeScript only, TDD mandatory, PostgreSQL as primary DB
```

Claude actualiza `CONSTITUTION.md`:
- Agrega sección `Technical Constraints`: TypeScript, PostgreSQL, TDD obligatorio
- Bumps versión `1.0.0 → 1.1.0`
- Reporta: "Added 3 technical constraints"

---

## Paso 2 — Especificar el feature

```
/sdd-specify Add user authentication with OAuth2 so users can log in with GitHub or Google
```

Claude:
1. Calcula el número de feature (ej: `001`)
2. Crea branch: `git checkout -b 001-user-auth`
3. Genera `specs/001-user-auth/spec.md`

Extracto del spec generado:

```markdown
# Feature Specification: User Authentication

**Branch**: `001-user-auth`
**Status**: Draft

## Overview
Allow users to authenticate using OAuth2 providers (GitHub, Google)
to access the platform without managing passwords.

## User Scenarios

### User Story 1 — Login with GitHub (Priority: P1)
A developer clicks "Login with GitHub", authorizes the app,
and lands on the dashboard with their profile loaded.

**Acceptance Scenarios**:
1. Given user is unauthenticated, When they click "Login with GitHub",
   Then they are redirected to GitHub OAuth flow
2. Given OAuth completes successfully, When callback is received,
   Then user session is created and user is redirected to /dashboard

### User Story 2 — Login with Google (Priority: P2)
...

## Functional Requirements
- **FR-001**: System MUST redirect unauthenticated users to login page
- **FR-002**: System MUST support GitHub OAuth2 provider
- **FR-003**: System MUST create user profile on first login

## Success Criteria
- **SC-001**: Login flow completes in under 5 seconds
- **SC-002**: 99.9% uptime for auth endpoints

## Out of Scope
- Email/password authentication
- Two-factor authentication
```

> **Regla clave**: spec.md nunca menciona tecnología (eso va en plan.md).

Si hay ambigüedades (`[NEEDS CLARIFICATION]`), Claude las presenta una a una y espera respuesta antes de continuar.

---

## Paso 3 — Clarificar ambigüedades

```
/sdd-clarify
```

Claude analiza el spec y presenta hasta 5 preguntas, **de una en una**:

```
## Clarification 1/5: Session persistence

**Why this matters**: Affects architecture choice between JWT vs session cookies

**Recommended**: Option A (JWT) — stateless, works well with API-first apps

| Option | Description |
|--------|-------------|
| A | JWT tokens (stateless, 24h expiry) |
| B | Server-side sessions (Redis-backed) |
| C | Cookie-based sessions |

Reply with option letter, "yes" to accept recommended, or custom answer.
```

Tú respondes: `A`

Claude actualiza `spec.md` inmediatamente (agrega en Clarifications + FR correspondiente), luego presenta la pregunta 2/5, y así hasta completar.

```
## Clarification Complete
Questions asked: 3/5
Sections updated: Functional Requirements, Success Criteria, Edge Cases

✅ Spec ready for planning.
Next: /sdd-plan [tech stack]
```

---

## Paso 4 — Generar el plan técnico

```
/sdd-plan TypeScript, Express 5, PostgreSQL 16, Jest, Docker
```

Claude:
1. Verifica que no haya `[NEEDS CLARIFICATION]` en spec.md
2. Chequea que el stack cumpla la CONSTITUTION (TypeScript ✅, PostgreSQL ✅)
3. Investiga versiones/integraciones en `research.md`
4. Genera `specs/001-user-auth/plan.md`

Extracto del plan:

```markdown
# Implementation Plan: User Authentication

**Language**: TypeScript 5.x / Node.js 22
**Framework**: Express 5
**Storage**: PostgreSQL 16 via pg
**Auth**: passport.js + passport-github2 + passport-google-oauth20
**Testing**: Jest + Supertest
**Platform**: Docker Compose (local), Vercel (prod)

## Architecture
Three-layer: API handlers → Auth Service → User Repository

## Project Structure
src/
├── models/user.ts
├── services/auth.service.ts
├── api/auth.router.ts
└── lib/passport.config.ts

## Constitution Check
| Principle | Status |
|-----------|--------|
| TypeScript only | ✅ |
| TDD mandatory | ✅ |
| PostgreSQL | ✅ |
```

También genera:
- `specs/001-user-auth/data-model.md` (entidades `User`, `Session`)
- `specs/001-user-auth/contracts/api-spec.md` (endpoints `/auth/github`, `/auth/callback/github`, etc.)
- `specs/001-user-auth/research.md` (decisiones técnicas justificadas)

---

## Paso 5 — Generar las tareas

```
/sdd-tasks TDD
```

Claude genera `specs/001-user-auth/tasks.md`:

```markdown
# Tasks: User Authentication

## Phase 1: Setup
- [ ] T001 Initialize project with TypeScript — tsconfig.json, package.json
- [ ] T002 Install dependencies (express@5, passport, pg, jest)
- [ ] T003 [P] Configure ESLint + Prettier — .eslintrc.ts
- [ ] T004 [P] Setup .env.example with required OAuth vars
- [ ] T005 Configure Jest — jest.config.ts

## Phase 2: Foundation
⚠️ No user story work begins until this phase is complete.

- [ ] T006 Create PostgreSQL schema + migrations — src/db/migrations/
- [ ] T007 [P] Setup error handling middleware — src/lib/errors.ts
- [ ] T008 Configure Passport base — src/lib/passport.config.ts

**Checkpoint**: DB migrations run, Express server boots, Passport configured.

## Phase 3: User Story 1 — GitHub Login (P1) 🎯 MVP

### Tests (write first — must FAIL)
- [ ] T009 [P] [US1] Contract test: GET /auth/github redirects — tests/auth.test.ts
- [ ] T010 [P] [US1] Integration test: full OAuth callback flow — tests/integration/github.test.ts

### Implementation
- [ ] T011 [P] [US1] Create User model — src/models/user.ts
- [ ] T012 [US1] Implement UserRepository — src/repositories/user.repo.ts
- [ ] T013 [US1] Implement AuthService (create/find user) — src/services/auth.service.ts
- [ ] T014 [US1] Configure passport-github2 strategy — src/lib/passport.config.ts
- [ ] T015 [US1] Add GitHub auth routes — src/api/auth.router.ts

**Checkpoint**: Login with GitHub funcional e independientemente testeable.

## Phase 4: User Story 2 — Google Login (P2)
...

## Dependency Map
- Phase 1 → Phase 2 → Phase 3 (MVP)
- Phase 3 y 4 pueden correr en paralelo (equipo grande)
```

> `[P]` = paralelizable (no bloquea otras tareas de la misma fase)
> `[US1]` = pertenece al User Story 1

---

## Paso 6 — Analizar consistencia

```
/sdd-analyze
```

Claude lee spec, plan, tasks, data-model y CONSTITUTION en modo **solo lectura** (no modifica nada) y reporta:

```markdown
## Specification Analysis Report
Artifacts: spec.md ✅ | plan.md ✅ | tasks.md ✅ | CONSTITUTION.md ✅

### Findings
| ID | Severity | Location    | Summary                      | Recommendation                          |
|----|----------|-------------|------------------------------|-----------------------------------------|
| A1 | MEDIUM   | spec SC-001 | "under 5 seconds" es vago    | Add: "p95 < 5s measured via Supertest"  |

Coverage: 100% (6/6 FRs tienen ≥1 task)
Critical Issues: 0
High Issues: 0
Medium Issues: 1
```

```
✅ No blockers. Puedes proceder a /sdd-implement.

¿Quieres sugerencias de remediación para los issues MEDIUM?
```

Si hay issues CRITICAL → **no puedes continuar** hasta resolverlos.

---

## Paso 7 — Implementar

```
/sdd-implement
```

Claude ejecuta fase por fase:

```
## Phase 1: Setup
Tasks: 5 (2 parallelizable)

✅ T001 complete — tsconfig.json + package.json initialized
✅ T002 complete — express@5, passport, pg installed
✅ T003 complete — ESLint configured
✅ T004 complete — .env.example created
✅ T005 complete — jest.config.ts configured

✅ Phase 1 complete. 5/5 tasks done.
Checkpoint: proyecto inicializado, dependencias instaladas.
Verify before proceeding to Phase 2.
```

Para cada tarea, Claude:
- Escribe el archivo en el path exacto de `tasks.md`
- Marca `- [ ]` → `- [x]` en `tasks.md`
- Si algo falla: para, reporta el error, espera tu instrucción (nunca saltea tareas sin aprobación)

Para TDD (si se incluyó en `/sdd-tasks TDD`):
1. Escribe el test primero
2. Lo ejecuta — debe **fallar** (confirma que el test es válido)
3. Escribe la implementación
4. Ejecuta el test de nuevo — debe **pasar**

Al finalizar:

```
✅ Implementation complete!

Tasks completed: 18/18
Tests: 12 passing

Next steps:
  git add src/ tests/ specs/
  git commit -m "feat(001-user-auth): implement OAuth2 authentication"
  git push -u origin 001-user-auth
  gh pr create
```

---

## Resumen del flujo completo

| Comando | Produce | Regla clave |
|---------|---------|-------------|
| `/sdd-init` | `specs/`, `CONSTITUTION.md`, `sdd-context.md` | Una vez por proyecto |
| `/sdd-constitution` | `CONSTITUTION.md` actualizado | Principios no negociables |
| `/sdd-specify` | branch `001-user-auth` + `spec.md` | Solo WHAT/WHY, nunca HOW |
| `/sdd-clarify` | `spec.md` enriquecido | Máx 5 preguntas, una a la vez |
| `/sdd-plan` | `plan.md` + `data-model.md` + `contracts/` | HOW: stack, arquitectura, contratos |
| `/sdd-tasks` | `tasks.md` con fases, deps y `[P]` markers | Paths exactos por tarea |
| `/sdd-analyze` | Reporte de consistencia | Solo lectura, no modifica |
| `/sdd-implement` | Código real, tasks marcadas `[x]` | Para en cada checkpoint |

---

## Opciones avanzadas de `/sdd-implement`

```bash
/sdd-implement phase 1        # Solo ejecuta Phase 1
/sdd-implement phase 3        # Solo ejecuta Phase 3 (US1)
/sdd-implement resume         # Retoma desde la última tarea incompleta
/sdd-implement story 2        # Solo ejecuta la fase de User Story 2
```

---

## Archivos generados por feature

```
specs/
└── 001-user-auth/
    ├── spec.md          ← /sdd-specify  (WHAT + WHY)
    ├── plan.md          ← /sdd-plan     (HOW + stack)
    ├── research.md      ← /sdd-plan     (decisiones técnicas)
    ├── data-model.md    ← /sdd-plan     (entidades y relaciones)
    ├── tasks.md         ← /sdd-tasks    (ejecución ordenada)
    └── contracts/
        └── api-spec.md  ← /sdd-plan     (contratos de API)

CONSTITUTION.md              ← /sdd-constitution (raíz del proyecto)
.claude/sdd-context.md       ← auto-actualizado por cada comando
```
