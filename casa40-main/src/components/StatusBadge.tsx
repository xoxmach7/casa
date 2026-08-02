import { ObjectStatus, LeadStatus } from '@/types/casa';

const statusColors: Record<string, string> = {
  'Новая': 'bg-blue-50 text-blue-600',
  'Новый': 'bg-blue-50 text-blue-600',
  'Опубликован': 'bg-emerald-50 text-emerald-600',
  'Показ': 'bg-teal-50 text-teal-600',
  'В сделке': 'bg-violet-50 text-violet-600',
};

const StatusBadge = ({ status }: { status: ObjectStatus | LeadStatus }) => (
  <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium ${statusColors[status] || 'bg-muted text-muted-foreground'}`}>
    {status}
  </span>
);

export default StatusBadge;
