import { KanbanBoard } from "@/components/crm/kanban-board";

export default function CRMPage() {
  return (
    <div className="h-[calc(100vh-56px)] md:h-[calc(100vh-48px)] flex flex-col overflow-hidden -m-4 md:-m-6 lg:-m-8">
      <KanbanBoard />
    </div>
  );
}
