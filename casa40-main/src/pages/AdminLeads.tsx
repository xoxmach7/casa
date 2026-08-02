import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ChevronRight, Plus, Loader2, Pencil, Check } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { useLeads, mapLeadStatus, useUpdateLead } from '@/hooks/useLeads';
import { useAllProperties, mapPropertyStatus } from '@/hooks/useProperties';
import { toast } from 'sonner';
import type { LeadStatus } from '@/types/casa';

const statusTabs: (LeadStatus | 'Все')[] = ['Все', 'Новая', 'Показ', 'В сделке'];
const statusFilterMap: Record<string, string> = {
  'Новая': 'new',
  'Показ': 'showing',
  'В сделке': 'in_deal',
};

const AdminLeads = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('Все');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const { data: leads = [], isLoading } = useLeads();
  const { data: properties = [] } = useAllProperties();
  const updateLead = useUpdateLead();

  const filtered = leads.filter(l => {
    if (activeTab !== 'Все' && l.status !== statusFilterMap[activeTab]) return false;
    if (search && !l.buyer_name.toLowerCase().includes(search.toLowerCase()) && !l.buyer_phone.includes(search)) return false;
    return true;
  });

  const getProperty = (propertyId: string) => properties.find(pr => pr.id === propertyId);

  const getLeadNextAction = (lead: typeof leads[0]): string => {
    if (lead.status === 'new') return 'К показу';
    if (lead.status === 'showing') return 'В сделку';
    return '';
  };

  const startEdit = (lead: typeof leads[0]) => {
    setEditingId(lead.id);
    setEditForm({
      buyer_name: lead.buyer_name,
      buyer_phone: lead.buyer_phone,
      comment: lead.comment || '',
      financing_type: lead.financing_type || '',
      financing_bank: lead.financing_bank || '',
      expected_timeline: lead.expected_timeline || '',
    });
  };

  const saveEdit = async (id: string) => {
    try {
      const payload: Record<string, any> = {};
      for (const [key, value] of Object.entries(editForm)) {
        payload[key] = typeof value === 'string' && value.trim() === '' ? null : value;
      }
      await updateLead.mutateAsync({ id, ...payload });
      toast.success('Заявка обновлена');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка сохранения');
    }
    setEditingId(null);
    setEditForm({});
  };

  const editVal = (key: string) => editForm[key] ?? '';
  const setVal = (key: string, value: string) => setEditForm(p => ({ ...p, [key]: value }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center gap-3 h-13 px-4 bg-background/95 backdrop-blur-sm border-b border-border">
        <button onClick={() => navigate('/admin')} className="p-1 -ml-1 active:scale-90 transition-transform">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-[15px] font-bold text-foreground tracking-tight flex-1">Заявки</h1>
        <span className="text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
        <button
          onClick={() => navigate('/admin/leads/new')}
          className="p-1.5 rounded-lg bg-primary text-primary-foreground active:scale-90 transition-transform ml-1"
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>

      <div className="px-4 py-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или телефону"
            className="casa-input pl-10 h-11 text-sm"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {statusTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground border border-border'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">Нет заявок</p>
          )}
          {filtered.map(lead => {
            const property = getProperty(lead.property_id);
            const nextAction = getLeadNextAction(lead);
            const isEditing = editingId === lead.id;

            return (
              <div
                key={lead.id}
                className="casa-card p-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <input
                          value={editVal('buyer_name')}
                          onChange={e => setVal('buyer_name', e.target.value)}
                          className="text-sm font-semibold text-foreground bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 w-full"
                          placeholder="Имя"
                        />
                        <input
                          value={editVal('buyer_phone')}
                          onChange={e => setVal('buyer_phone', e.target.value)}
                          className="text-[11px] text-muted-foreground bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 w-full"
                          placeholder="Телефон"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-foreground">{lead.buyer_name}</p>
                        <p className="text-[11px] text-muted-foreground">{lead.buyer_phone}</p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={mapLeadStatus(lead.status) as any} />
                    <button
                      onClick={() => isEditing ? saveEdit(lead.id) : startEdit(lead)}
                      className={`p-1 rounded-md transition-all active:scale-90 ${isEditing ? 'bg-primary text-primary-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                    >
                      {isEditing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="space-y-1.5 pt-1 border-t border-border/30">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-[11px] text-muted-foreground shrink-0">Комментарий</span>
                      <input
                        value={editVal('comment')}
                        onChange={e => setVal('comment', e.target.value)}
                        className="text-[11px] text-foreground text-right bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 flex-1 max-w-[60%]"
                        placeholder="—"
                      />
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-[11px] text-muted-foreground shrink-0">Финансирование</span>
                      <input
                        value={editVal('financing_type')}
                        onChange={e => setVal('financing_type', e.target.value)}
                        className="text-[11px] text-foreground text-right bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 flex-1 max-w-[60%]"
                        placeholder="—"
                      />
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-[11px] text-muted-foreground shrink-0">Банк</span>
                      <input
                        value={editVal('financing_bank')}
                        onChange={e => setVal('financing_bank', e.target.value)}
                        className="text-[11px] text-foreground text-right bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 flex-1 max-w-[60%]"
                        placeholder="—"
                      />
                    </div>
                  </div>
                )}

                {property && (
                  <button
                    onClick={() => navigate(`/admin/objects/${property.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-accent/60 active:scale-[0.98] transition-transform"
                  >
                    <p className="text-[11px] text-foreground truncate">
                      {property.district}, {property.address} · <span className="font-semibold text-primary tabular-nums">{formatCompact(property.price ?? 0)}</span>
                    </p>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  </button>
                )}

                {!isEditing && lead.viewing_datetime && (
                  <p className="text-[11px] text-primary font-medium">
                    Показ: {new Date(lead.viewing_datetime).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}

                {!isEditing && lead.comment && (
                  <p className="text-[11px] text-muted-foreground/70 truncate">{lead.comment}</p>
                )}

                {!isEditing && nextAction && (
                  <p className="text-[11px] text-muted-foreground">→ {nextAction}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function formatCompact(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)} млн`;
  return `${(price / 1_000).toFixed(0)} тыс`;
}

export default AdminLeads;
