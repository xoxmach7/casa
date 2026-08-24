# Mortgage Production Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the authenticated CASA Pro mortgage workspace function in production as a truthful synthetic-data sandbox backed by the deterministic mortgage core.

**Architecture:** Keep public mortgage demo routes fail-closed. Replace the private workspace's broad demo gate with an authenticated sandbox adapter that validates synthetic PDFs before persistence and maps synthetic inputs into `runMortgagePreScore`/`previewMortgageScenario`. Update the existing Next.js page to consume the sandbox contract and never silently present local mock output as a successful server result.

**Tech Stack:** Express, Zod, Multer, Prisma Decimal, Vitest, Next.js/React, Testing Library, Playwright.

---

### Task 1: Synthetic PDF policy

**Files:**
- Create: `delivery/backend/src/lib/mortgage-sandbox-policy.ts`
- Create: `delivery/backend/src/__tests__/mortgage-sandbox-policy.test.ts`

- [ ] **Step 1: Write failing policy tests**

Cover `%PDF-` magic validation, required text layer, valid Kazakhstan IIN detection, missing attestation, and accepted anonymized text PDF. The desired API is:

```ts
inspectMortgageSandboxPdf({ buffer, extractedText, attestedSynthetic }):
  { allowed: true; policyVersion: '2026-08-24' }
  | { allowed: false; code: 'PDF_SIGNATURE_INVALID' | 'TEXT_LAYER_REQUIRED' | 'REAL_IIN_DETECTED' | 'SYNTHETIC_ATTESTATION_REQUIRED' }
```

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/__tests__/mortgage-sandbox-policy.test.ts`
Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement the minimal policy**

Implement PDF magic inspection, a Kazakhstan IIN checksum validator over 12-digit candidates, minimum normalized text length, and mandatory boolean attestation. Return stable codes without logging extracted text.

- [ ] **Step 4: Run GREEN**

Run the focused test and `npm run typecheck`; both must pass.

### Task 2: Authenticated sandbox backend adapter

**Files:**
- Modify: `delivery/backend/src/routes/mortgage-workspace.routes.ts`
- Modify: `delivery/backend/src/lib/mortgage-workspace/document-store.ts`
- Create: `delivery/backend/src/lib/mortgage-sandbox-adapter.ts`
- Create: `delivery/backend/src/__tests__/mortgage-sandbox-adapter.test.ts`
- Modify: `delivery/backend/src/__tests__/mortgage-workspace.routes.test.ts`
- Modify: `delivery/backend/src/__tests__/public-mortgage.routes.test.ts`

- [ ] **Step 1: Write failing route and adapter tests**

Prove that production + authenticated access returns sandbox status and deterministic analysis, while unauthenticated access returns 401 and public mortgage demo routes remain 404. Upload tests must prove rejection occurs before `saveDocument`, accepted PDF metadata records `sandbox: true` and `policyVersion`, ownership remains enforced, and confirmation rejects unresolved critical fields.

- [ ] **Step 2: Run RED**

Run the focused backend tests. Expected failures: private route is currently 404 in production; status/adapter endpoints do not exist; upload does not enforce synthetic policy.

- [ ] **Step 3: Implement the adapter**

Remove only the private router's `demoEndpointsEnabled()` middleware. Add `GET /sandbox/status`, `POST /sandbox/iin-check`, `GET /sandbox/analysis`, and `POST /sandbox/scenarios`. The IIN endpoint validates synthetic checksum/shape and returns `EXTERNAL_SOURCE_NOT_CONNECTED` instead of inventing an official result. Build the reference snapshot/rules in a focused adapter and call the real core services. Keep consent/conclusion legacy handlers disabled in production with stable `PROVIDER_INTEGRATION_REQUIRED` responses.

- [ ] **Step 4: Harden upload persistence**

Require multipart field `syntheticAttestation=true`, validate magic bytes, extract text, apply sandbox policy before generating an ID or writing files, and store only accepted PDF/meta. Extend metadata with `sandbox`, `policyVersion`, and hash-only diagnostics. On confirmation, reject any critical field whose presence/review state is unresolved.

- [ ] **Step 5: Run GREEN**

Run all focused tests, backend typecheck, and Prisma validate.

### Task 3: Truthful mortgage frontend

**Files:**
- Create: `delivery/frontend/lib/mortgage/sandbox-api.ts`
- Create: `delivery/frontend/lib/mortgage/sandbox-api.test.ts`
- Modify: `delivery/frontend/app/dashboard/mortgage/page.tsx`
- Modify: `delivery/frontend/components/mortgage/workspace/sections-early.tsx`
- Modify: `delivery/frontend/components/mortgage/workspace/sections-late.tsx`
- Create or modify: `delivery/frontend/app/dashboard/mortgage/page.test.tsx`

- [ ] **Step 1: Write failing frontend tests**

Prove the page renders a permanent “Безопасный sandbox” banner, requires the synthetic-document acknowledgement before upload, sends `syntheticAttestation=true`, shows server error details without inserting demo fields, loads analysis from `/mortgage-workspace/sandbox/analysis`, calls `/mortgage-workspace/sandbox/iin-check`, displays checksum validity separately from `EXTERNAL_SOURCE_NOT_CONNECTED`, and shows provider-gated states for public links.

- [ ] **Step 2: Run RED**

Run focused Vitest tests. Expected failures: banner/attestation/API client do not exist and current catch path injects mock fields.

- [ ] **Step 3: Implement a focused API client**

Create typed methods for status, document upload/confirm, analysis, and scenario evaluation using `credentials: 'include'`. Convert non-2xx responses into stable user-facing errors without local-success fallback.

- [ ] **Step 4: Update workspace orchestration and copy**

Fetch sandbox status on mount, add banner and policy checkbox, disable uploads until accepted, remove `runLocalDemoPipeline`, use server analysis/scenarios, retain the one-click fully synthetic local showcase but label it as synthetic, and replace fake IIN/public-link success with explicit provider-gated notices.

- [ ] **Step 5: Run GREEN**

Run focused frontend tests, frontend typecheck, and frontend build.

### Task 4: End-to-end verification and delivery

**Files:**
- Modify: `delivery/frontend/e2e/full-workflow.spec.ts`
- Modify: `docs/superpowers/plans/2026-08-24-mortgage-production-sandbox.md` for checked status only

- [ ] **Step 1: Add failing Playwright smoke**

Cover authenticated navigation to the mortgage page, visible sandbox banner, complete synthetic demo, and a synthetic text PDF upload fixture with successful “saved privately” state. Assert no “server unavailable” fallback appears.

- [ ] **Step 2: Run local stack and GREEN E2E**

Apply migrations to disposable PostgreSQL, seed test users, start backend/frontend with test secrets, run the focused Playwright spec, and stop only services started for the task.

- [ ] **Step 3: Run full gates**

Backend tests/typecheck/build/Prisma validate; frontend tests/typecheck/build; casa40 tests/typecheck/build; `git diff --check`; secret/temp scan.

- [ ] **Step 4: Independent review and delivery**

Review security boundaries and frontend behavior, fix only confirmed findings with RED/GREEN tests, commit one implementation commit after the design commit, push the feature branch, open a PR, wait for all CI, merge only when green, then wait for production deploy and independently verify login, casa.kz, protected backend, mortgage sandbox status through an authenticated browser session, upload smoke, and truthful provider-gated UI.