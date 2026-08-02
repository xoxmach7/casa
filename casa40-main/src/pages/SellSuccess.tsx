import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

const SellSuccess = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="text-center space-y-4 max-w-sm"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
        >
          <CheckCircle className="w-16 h-16 mx-auto text-casa-success" />
        </motion.div>
        <h1 className="text-xl font-bold text-foreground">Квартира отправлена</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Оператор CASA свяжется с вами, чтобы подтвердить квартиру и данные собственника.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          После подтверждения объявление будет подготовлено к публикации.
        </p>
        <div className="space-y-3 pt-4">
          <button onClick={() => navigate('/')} className="casa-btn-primary">
            На главную
          </button>
          <button onClick={() => navigate('/sell/add')} className="casa-btn-secondary">
            Добавить ещё одну квартиру
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SellSuccess;
