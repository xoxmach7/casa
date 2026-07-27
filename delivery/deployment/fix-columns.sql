-- Добавляем недостающие колонки в crm_properties
ALTER TABLE crm_properties ADD COLUMN IF NOT EXISTS recommended_strategy TEXT;
ALTER TABLE crm_properties ADD COLUMN IF NOT EXISTS is_strategy_manual BOOLEAN DEFAULT false;

-- Проверяем
SELECT column_name FROM information_schema.columns 
WHERE table_name='crm_properties' AND column_name IN ('recommended_strategy', 'is_strategy_manual');
