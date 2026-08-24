# CASA Mortgage Pre-Score backend implementation plan

**Goal:** turn the audited mortgage specifications into a production-safe, deterministic backend core while keeping integrations that require legal/provider decisions fail-closed.

**Source documents:**

- `docs/casa-pro-ipoteka/CASA_Mortgage_PreScore_v1.1/CASA_Mortgage_PreScore_Product_Technical_Spec_v1.1_AUDITED.docx`
- `docs/casa-pro-ipoteka/CASA_Mortgage_PreScore_v1.1/CASA_Mortgage_PreScore_Independent_Audit_v1.0.docx`
- `docs/casa-pro-ipoteka/CASA_Pro_Ipoteka_Poleznye_Mehaniki_KZ_v1.0.docx`

## Verified current state

- Decimal-safe mortgage primitives and their golden tests already exist.
- `ClientConsent`, immutable `ConsentRevision`, versioned `MortgageRuleVersion`, and `ReasonCode` foundation models exist.
- The workspace, extraction flow, scenarios, properties, and conclusions are demo-only and fail closed in production.
- Persistence for mortgage cases, verified snapshots, assessments, scenarios, and audit events is not implemented.
- Direct bureau, pension, government, bank, SMS, external LLM, KMS, and malware-provider integrations remain gated.

## Increment 1 — deterministic Pre-Score domain core (this change)

1. Add tests for income/facility deduplication, invalid inputs, stale/unknown rules, exact conditional shortfall, FAIL exclusion, and the readiness matrix.
2. Add a pure service that accepts an immutable verified snapshot plus immutable program rule cards.
3. Compute income/load, annuity payment, KDN, collateral/LTV/down-payment constraints with Prisma Decimal only.
4. Return independent eligibility and affordability axes, deterministic reason codes, missing fields, exact required actions, trace inputs, and a reproducible output hash.
5. Keep UNKNOWN separate from FAIL/PASS; never rank UNKNOWN as suitable; rank PASS before CONDITIONAL; give CASA commission zero input.
6. Do not expose a production mutation route yet: consent, snapshot persistence, idempotency, object authorization, and append-only audit must land together.

## Increment 2 — persisted case and snapshot workflow

1. Add Prisma entities for cases, parties, documents/revisions, review tasks, immutable snapshots, runs/results, assessments, scenarios, recipient grants, and audit events.
2. Add forward-only migrations and object-scoped authorization.
3. Enforce active purpose-specific consent before upload, extraction, snapshot, calculation, or share.
4. Add idempotency scoped by actor/operation/key and optimistic `expected_version` checks.
5. Expose the `/api/v1/mortgage-cases` contract with stable error envelopes.

## Increment 3 — document and review pipeline

1. Replace demo in-memory storage with private object metadata and revisions.
2. Enforce MIME plus magic bytes, size/page limits, checksum, private keys, scan-before-extraction, and PII-safe logs.
3. Persist provenance and require human review for critical or conflicting fields.
4. Build immutable snapshots only from resolved critical fields.

## Increment 4 — governed rules, matching, and scenarios

1. Add maker-checker rule lifecycle, non-overlapping active intervals, and immutable active versions.
2. Validate rule payloads and sources; stale or unconfirmed mandatory facts become UNKNOWN.
3. Add property freshness recheck, copy-on-write scenarios, and safe client conclusion publishing.
4. Keep Otbasy as a dedicated adapter behind the common trace/result contract.

## Explicitly blocked external work

- Real SMS/OTP and approved consent evidence.
- Direct credit-bureau, ENPF, government, or bank integrations.
- Production KMS storage and malware provider.
- Kazakhstan residency, retention/deletion, and legal-hold policy.
- Predictive approval probability or recreation of private bank scoring.

These remain disabled until legal, security, data, and provider decisions are recorded.
## Implementation status (2026-08-24)

### Implemented in the isolated worktree

- Deterministic Decimal Pre-Score with fail-closed validation, deduplication, five-axis readiness, exact actions, stable reason ordering, trace data, and reproducible hashes.
- Governed rule activation with maker-checker, sourced/fresh/non-overlapping versions, and strict financial-term validation.
- Authenticated, object-scoped `/api/v1/mortgage-cases` create/read/update and party enrollment with consent checks, idempotency, optimistic versioning, stable errors, trace IDs, and append-only PII-safe audit.
- Case/party/grant/idempotency/audit persistence plus append-only database guards.
- Document/revision/field-review and encrypted verified-snapshot persistence, ownership/provenance constraints, hash-only sensitive extracted values, AES-256-GCM record-bound AAD, and ciphertext-only repository writes.
- Copy-on-write scenario engine with evidence gates and conservative co-borrower/risk handling.
- Source DOCX artifacts moved into `docs/casa-pro-ipoteka/`.

### Runtime evidence

- Fresh PostgreSQL 16: all 42 repository migrations applied; both new mortgage migrations finished and expected constraints exist.
- Backend: 80 test files / 567 tests passed; TypeScript typecheck and build passed.
- Independent review: case API, persistence/workflow, Pre-Score, rule governance, and scenarios approved after fixes.

### Intentionally not represented as production-ready

- Real SMS/OTP consent evidence, credit-bureau/ENPF/government/bank adapters, production KMS and malware scanning, and Kazakhstan retention/residency/legal-hold policy require named providers and legal/security decisions.
- Public mutation endpoints for document ingestion, extraction, snapshot calculation, scenario persistence, and bank sharing stay disabled until those adapters and policies are selected. The domain and persistence foundations are ready for those integrations without storing plaintext snapshots.