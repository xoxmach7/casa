import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { getSettings, updateSetting } from '../controllers/settings.controller';

export const settingsRouter = Router();

// Only ADMIN can access settings
settingsRouter.use(authenticate, requireRole('ADMIN'));

settingsRouter.get('/', getSettings);
settingsRouter.post('/', updateSetting);
