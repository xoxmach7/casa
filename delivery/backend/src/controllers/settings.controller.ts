import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await prisma.systemSettings.findMany();
        // Convert to object for easier frontend consumption, or list is fine.
        // Let's return list.
        res.json(settings);
    } catch (error) {
        next(error);
    }
};

export const updateSetting = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { key, value, description } = req.body;

        if (!key || value === undefined) {
            res.status(400).json({ error: 'Key and value are required' });
            return;
        }

        const setting = await prisma.systemSettings.upsert({
            where: { key },
            update: { value, description },
            create: { key, value, description }
        });

        res.json(setting);
    } catch (error) {
        next(error);
    }
};
