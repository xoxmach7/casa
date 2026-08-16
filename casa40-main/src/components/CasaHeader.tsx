import { ArrowLeft, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import casaLogo from '@/assets/casa-logo.webp';

interface CasaHeaderProps {
  variant?: 'home' | 'property' | 'sell' | 'admin' | 'form';
  title?: string;
  onBack?: () => void;
  showShare?: boolean;
  onShare?: () => void;
}

const CasaHeader = ({ variant = 'home', title, onBack, showShare, onShare }: CasaHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between h-13 px-4 bg-background/95 backdrop-blur-sm">
      <div className="w-10">
        {variant !== 'home' && (
          <button onClick={handleBack} className="p-2 -ml-2 rounded-xl hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
        )}
      </div>
      {title ? (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">{title}</span>
      ) : (
        <button onClick={() => navigate('/')} className="active:scale-95 transition-transform">
          <img src={casaLogo} alt="CASA" className="h-6 object-contain" />
        </button>
      )}
      <div className="w-10 flex justify-end">
        {showShare && (
          <button onClick={onShare} className="p-2 -mr-2 rounded-xl hover:bg-accent transition-colors">
            <Share2 className="w-5 h-5 text-foreground" />
          </button>
        )}
      </div>
    </header>
  );
};

export default CasaHeader;
