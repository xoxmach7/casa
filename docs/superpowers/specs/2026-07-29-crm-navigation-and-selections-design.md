# CRM Navigation Cleanup + Client Selections ("Подборки") — Design

**Goal:** Simplify the Casa Pro CRM sidebar (fewer dropdowns, hide dead sections) and add a new "Подборка" concept — a curated list of new-build apartments a broker assembles for a specific client — replacing the currently-unused "Мои объекты" (secondary-market `Property` listing management) section.

**Scope:** `delivery/frontend` (CRM dashboard) + `delivery/backend` (new `selections` API + schema).

---

## 1. Sidebar changes (`components/app-sidebar.tsx`)

- **"Новостройки"** stops being a collapsible group with sub-items. It becomes a single link pointing straight at `/dashboard/projects` (Каталог ЖК) — which already has full filtering (district/status/class/price/rooms/mortgage program), so no new filter work is needed there.
- **"Шахматка"** is removed as a standalone sidebar entry. It's already reachable from a project's own detail page (`/dashboard/projects/[id]`, "Квартиры" tab / "Забронировать квартиру" button) — the standalone `/dashboard/chess` project-picker page was only ever a redirect shim and stays unlinked from nav.
- **"Ипотека"** stops being a collapsible group. It becomes a single link to `/dashboard/mortgage` (the real, already-built calculator page). "Заявки в банки" (currently its own tiny page, `/dashboard/mortgage-applications`) becomes a second tab inside `/dashboard/mortgage` instead of a separate nav entry.
- **"Стратегии (CASA)"** is removed from `menuItems` entirely — hidden for every role, no exceptions.
- **"Мои объекты"** is renamed to **"Мои подборки"** and its `url` changes from `/dashboard/properties` to `/dashboard/selections` (new page, see below). The old secondary-market `Property` management UI (`/dashboard/properties`, `/properties/new`, `/properties/[id]/edit`) is not linked from anywhere after this change — routes stay in the codebase (untouched, unused) rather than being deleted, since deleting them is out of scope here.

## 2. New concept: Подборка (Selection)

A **Selection** belongs to one `Client` and one broker, and holds a set of `Apartment`s (new-build units from the "Новостройки" domain — not secondary-market `CrmProperty`/`Property`). A broker builds it by browsing the apartment catalog and adding units to a selection (new or existing) directly from the apartment's card.

**Schema (`delivery/backend/prisma/schema.prisma`):**

```prisma
model Selection {
  id        String   @id @default(cuid())
  name      String?
  brokerId  String   @map("broker_id")
  clientId  String   @map("client_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  broker    User               @relation(fields: [brokerId], references: [id])
  client    Client             @relation(fields: [clientId], references: [id])
  apartments SelectionApartment[]

  @@index([brokerId])
  @@index([clientId])
  @@map("selections")
}

model SelectionApartment {
  id          String   @id @default(cuid())
  selectionId String   @map("selection_id")
  apartmentId String   @map("apartment_id")
  addedAt     DateTime @default(now()) @map("added_at")

  selection Selection @relation(fields: [selectionId], references: [id], onDelete: Cascade)
  apartment Apartment @relation(fields: [apartmentId], references: [id], onDelete: Cascade)

  @@unique([selectionId, apartmentId])
  @@index([selectionId])
  @@index([apartmentId])
  @@map("selection_apartments")
}
```

`Client` gains `selections Selection[]` and `Apartment` gains `selectionApartments SelectionApartment[]` as back-relation fields (both required by Prisma for the relations above to compile).

**Backend routes (`delivery/backend/src/routes/selections.routes.ts`, mounted at `/api/selections`, authenticated, broker-scoped like `sellers`/`buyers` routes — brokers see only their own, ADMIN sees all):**

- `GET /` — list selections (id, name, client summary, apartment count, createdAt).
- `GET /:id` — full detail: client info + apartments (each with project name/address so the card has context outside its own project page).
- `POST /` — create `{ clientId, name? }`.
- `POST /:id/apartments` — add `{ apartmentId }` (idempotent — adding an apartment already in the selection is a no-op, not an error).
- `DELETE /:id/apartments/:apartmentId` — remove one apartment.
- `DELETE /:id` — delete the whole selection.

**Frontend:**

- `/dashboard/selections` (replaces the old properties list page): cards, one per selection — client name/phone, apartment count, created date, "Открыть" → detail.
- `/dashboard/selections/[id]`: client info panel + apartment cards (reusing the same `ApartmentCard` component from the catalog), each with a "Убрать из подборки" action.
- **`ApartmentCard`** (new shared component, replacing the current apartment `<Table>` rows on `/dashboard/projects/[id]`'s "Квартиры" tab): photo/planning thumbnail, number/floor/rooms/area/price/status badge, and action buttons:
  - "Забронировать" (existing behavior, `AVAILABLE` only) — unchanged.
  - **"В подборку"** — opens a dialog: pick one of the broker's existing selections (searchable, grouped by client) or create a new one (pick/search `Client` + optional name), then adds this apartment to it.
  - **"Рассчитать ипотеку"** — opens a dialog with a compact mortgage-calculator form (client picker + down payment / term / bank program), pre-filled with this apartment's price and id, submitting to the existing `POST /api/mortgage/calculate` endpoint (reused as-is, no backend change) and saving a `MortgageCalculation` row (schema already supports `apartmentId` + `clientId` — no schema change needed here). This is a new, purpose-built compact dialog component rather than embedding the existing 965-line `/dashboard/mortgage` page.

## 3. Out of scope (explicitly, per user's "пока так")

- No changes to the secondary-market `Property`/legacy `Client`-only flows beyond unlinking them from nav.
- No new filters on the apartment catalog (already has them).
- No change to how "Заявки в банки" itself works — just relocated into a tab.
- Selections only ever hold new-build `Apartment`s, never secondary-market objects.
