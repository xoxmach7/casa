import { useEffect, useState } from 'react';

const DOCS = [
  'Техпаспорт',
  'Договор',
  'Уведомление о госрегистрации',
  'Форма 2',
] as const;

interface Props {
  value?: Record<string, boolean>;
  onChange?: (checklist: Record<string, boolean>) => void;
  readOnly?: boolean;
}

const DocChecklist = ({ value, onChange, readOnly = false }: Props) => {
  const [checked, setChecked] = useState<Record<string, boolean>>(value ?? {});

  useEffect(() => {
    if (value) setChecked(value);
  }, [value]);

  const toggle = (doc: string) => {
    if (readOnly) return;
    const next = { ...checked, [doc]: !checked[doc] };
    setChecked(next);
    onChange?.(next);
  };

  const count = Object.values(checked).filter(Boolean).length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-0.5">
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Проверка документов
        </h3>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {count}/{DOCS.length}
        </span>
      </div>
      <div className="casa-card px-4 py-1">
        {DOCS.map(doc => (
          <label
            key={doc}
            className={`flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0 transition-opacity ${
              readOnly ? 'cursor-default' : 'cursor-pointer active:opacity-70'
            }`}
          >
            <div
              onClick={e => { e.preventDefault(); toggle(doc); }}
              className={`w-4 h-4 rounded-sm border shrink-0 flex items-center justify-center transition-colors ${
                checked[doc]
                  ? 'bg-primary border-primary'
                  : 'border-muted-foreground/30'
              } ${readOnly ? 'opacity-70' : ''}`}
            >
              {checked[doc] && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span className={`text-[13px] transition-colors ${
              checked[doc] ? 'text-muted-foreground line-through' : 'text-foreground'
            }`}>
              {doc}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default DocChecklist;
