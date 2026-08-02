import { ShieldCheck, Briefcase, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TrustLabelProps {
  text?: string;
  icon?: 'shield' | 'briefcase';
  content?: string | string[];
  isOpen?: boolean;
  onToggle?: () => void;
}

const TrustLabel = ({
  text = 'Проверенная квартира',
  icon = 'shield',
  content,
  isOpen = false,
  onToggle,
}: TrustLabelProps) => {
  const Icon = icon === 'briefcase' ? Briefcase : ShieldCheck;

  return (
    <div className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-casa-ghost text-casa-success text-sm font-medium transition-colors active:bg-casa-success/15"
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">{text}</span>
        <ChevronRight
          className={`w-4 h-4 shrink-0 text-casa-success/60 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pt-2 pb-3">
              {Array.isArray(content) ? (
                <div className="space-y-0.5">
                  {content.map((line, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrustLabel;
