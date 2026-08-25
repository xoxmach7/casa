# CASA Pro — Development Knowledge Base V3.1

Порядок чтения для Codex и Даулета:

1. `00_DOCUMENT_INDEX.csv` — какие утверждённые источники действуют.
2. `12_GOVERNANCE_DECISIONS.csv` — решения владельца, не изменяющие исходный текст документов.
3. `01_REQUIREMENTS.csv` — canonical actionable requirements релиза и future boundaries.
4. `03_DEVELOPER_TASKS.csv` — неизменённые 157 задач в порядке M01 → M02 → M03 → M04 → M05 → M06.
5. `05_DATA_CONTRACTS.csv` и `05A_OBJECT_INVARIANTS.csv` — поля и отдельные объектные инварианты.
6. `06_API_CONTRACTS.csv` — source/canonical API paths и governance refs.
7. `07_STATES_AND_ERRORS.csv` — состояния, ошибки и quality codes.
8. `02_ACCEPTANCE_MATRIX.csv` — точный test oracle из XLSX; статусы и Expected не менять.
9. `04_OPEN_GATES.csv` — открытые решения и безопасное временное поведение.
10. `11_CONTRACT_CONFLICTS.csv` — история конфликтов и их owner decisions; открытые части не реализовывать.
11. `13_CURRENT_STATUS_OVERLAY.csv` — различие между source/matrix, governance и runtime status.
12. Fixtures: `08_FIXTURE_INDEX.csv`, `M06_FIXTURES.csv`, `M06_FORMULA_REGISTRY.csv`.

`10_SOURCE_EXTRACTS.csv` — неизменённый lossless trace-back к оригиналам. `01_REQUIREMENT_CANDIDATES.csv` — промежуточный слой V2, не source of truth. Без новой версии источника или отдельного owner decision нельзя менять product semantics, acceptance statuses, задачи, formulas, hashes, gates и contracts.

`14_RELEASE_MAPPING_AUDIT.csv` — точный delta V3 → V3.1 для release/applicability и удаления non-actionable CORE history rows. Product semantics и lossless source layer не изменены.
