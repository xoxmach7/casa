# Implementation Plan v3: Hybrid CRM Architecture

## Goal
Implement a split CRM experience:
1.  **Internal Role (Admin, Broker)**: Use the "Pro-Casa Standard" CRM with fixed AI-driven stages, strategies, and scoring.
2.  **External Role (Developer, Agency, Realtor)**: Use the "Flexible CRM" (Old Logic) where users define their own funnels and stages.

## 1. Backend Updates

### Schema & Data Models
- **Roles**: `AGENCY` and `REALTOR` already exist in `UserRole`.
- **Data Linking**:
    - `Seller` and `CrmProperty` already have `customStageId` (Relation to `CustomStage`).
    - **Issue**: `funnelStage` is a required Enum.
    - **Fix**: We will use a mapping or set `funnelStage` to a neutral value (e.g. `CONTACT` or `CREATED`) when `customStageId` is present, OR reliance solely on `customStageId` for External roles.

### API logic
- **`GET /sellers` & `GET /crm-properties`**:
    - Add logic: If user is External, fetch items associated with their `customStageId`.
    - Returns grouped data based on Custom Stages, not Enums.
- **`PUT /sellers/:id` & `PUT /crm-properties/:id`**:
    - Support updating `customStageId` when moving items in the Custom CRM.

## 2. Frontend Updates

### 2.1 Funnel Selection & Management
- **Dashboard**:
    - External users see a "Funnels" selector if they have multiple, or default to their main funnel.
    - Use `FunnelEditor` (already built) to allow them to create/manage these funnels.

### 2.2 Dynamic Kanban Board (`KanbanBoard.tsx`)
- **Refactor `KanbanBoard`**:
    - **Props**: Add `mode: "standard" | "custom"` and `customStages?: CustomStage[]`.
    - **Columns**: 
        - If `mode === "standard"`: Use hardcoded `SELLER_COLUMNS` / `PROPERTY_COLUMNS`.
        - If `mode === "custom"`: Generate columns from `customStages`.
    - **Drag & Drop**:
        - `onDragEnd`:
            - Standard: Calls API to update `funnelStage` (Enum).
            - Custom: Calls API to update `customStageId`.

### 2.3 Role-Based Routing (`app-sidebar.tsx` & Page logic)
- **Sidebar**:
    - `CRM` link is visible to `DEVELOPER`, `AGENCY`, `REALTOR`, `ADMIN`, `BROKER`.
- **CRM Page (`/dashboard/crm`)**:
    - Check user role.
    - **Admin/Broker**: Render `KanbanBoard` with Standard Mode.
    - **external**:
        - Fetch active Custom Funnel.
        - If none exists, Prompt to create one.
        - Render `KanbanBoard` with Custom Mode (Dynamic Columns).

## 3. Verification
- **Test Internal Flow**: Admin/Broker sees standard stages.
- **Test External Flow**: 
    - Login as Developer/Agency.
    - Create a custom funnel (e.g., "Leads", "Meeting", "Sold").
    - Create a Deal. It appears in the custom funnel.
    - Move Deal -> `customStageId` updates.
