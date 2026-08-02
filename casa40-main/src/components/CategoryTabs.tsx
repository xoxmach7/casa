import { useNavigate } from 'react-router-dom';

const CategoryTabs = ({ active }: { active: 'secondary' | 'new-builds' }) => {
  const navigate = useNavigate();

  return (
    <div className="px-4 pb-2">
      <div className="flex gap-1 p-1 rounded-full bg-accent w-fit">
        <button
          onClick={() => navigate('/')}
          className={
            active === 'secondary'
              ? 'px-4 py-1.5 rounded-full text-[13px] font-medium bg-card shadow-sm text-foreground'
              : 'px-4 py-1.5 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors'
          }
        >
          Вторичка
        </button>
        <button
          onClick={() => navigate('/novostroyki')}
          className={
            active === 'new-builds'
              ? 'px-4 py-1.5 rounded-full text-[13px] font-medium bg-card shadow-sm text-foreground'
              : 'px-4 py-1.5 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors'
          }
        >
          Новостройки
        </button>
      </div>
    </div>
  );
};

export default CategoryTabs;
