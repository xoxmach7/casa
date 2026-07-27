import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { DealStage, DealStatus } from '@prisma/client';
import { z } from 'zod';

export const publicFormsRouter = Router();

// Get Form Definition (Public)
publicFormsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const form = await prisma.leadForm.findUnique({
            where: { id: req.params.id },
            select: { id: true, title: true, fields: true, isActive: true }
        });
        if (!form) {
            res.status(404).json({ error: 'Form not found' });
            return;
        }
        res.json(form);
    } catch (error: any) {
        console.error('Get public form error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Submit Form (Public)
publicFormsRouter.post('/:id/submit', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { brokerId, ...formData } = req.body; // Form data + optional brokerId

        const form = await prisma.leadForm.findUnique({
            where: { id },
            include: { brokers: true }
        });

        if (!form || !form.isActive) {
            res.status(404).json({ error: 'Form not found or inactive' });
            return;
        }

        let assignedBrokerId = brokerId;

        // Logic for Round Robin if no specific broker provided
        if (!assignedBrokerId && form.distributionType === 'ROUND_ROBIN' && form.brokers.length > 0) {
            // Find broker with LEAST deals today or just strict rotation
            // Simple Round Robin: Find last deal created from this form, see who got it, pick next.
            // OR: Random for now, or fetch usage stats.
            // Let's implement simple "Least Recently Used" or "Random" for simplicity first version.

            // Random distribution among enabled brokers
            const randomIndex = Math.floor(Math.random() * form.brokers.length);
            assignedBrokerId = form.brokers[randomIndex].id;
        }

        let isFallback = false;
        if (!assignedBrokerId) {
            // Fallback to Admin or leave unassigned?
            // Let's assign to first available admin if no broker found
            const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
            assignedBrokerId = admin?.id;
            isFallback = true;
        }

        if (!assignedBrokerId) {
            res.status(500).json({ error: 'No broker available to assign deal' });
            return;
        }

        // Create Deal
        // Extract Client info from form data
        // Usually form has: name, phone. We should parsing it.
        // We assume fields "name" and "phone" exist or mapping.
        // For MVP, we dump everything into notes, and try to find Name/Phone.

        // Find fields by label or key?
        // Let's assume frontend sends { "Имя": "John", "Телефон": "+7700..." } based on labels.

        // Robust way: key-value.
        // Intelligent Field Mapping
        const normalizedData: Record<string, string> = {};
        for (const [key, value] of Object.entries(formData)) {
            normalizedData[key.toLowerCase()] = String(value);
        }

        // Extract Standard Fields
        const nameVal =
            normalizedData['имя'] ||
            normalizedData['name'] ||
            normalizedData['fio'] ||
            'Unknown';

        const phoneVal =
            normalizedData['телефон'] ||
            normalizedData['phone'] ||
            normalizedData['tel'] ||
            '';

        const budgetVal =
            normalizedData['бюджет'] ||
            normalizedData['budget'] ||
            normalizedData['цена'] ||
            '0';

        const notesVal =
            normalizedData['примечание'] ||
            normalizedData['комментарий'] ||
            normalizedData['notes'] ||
            normalizedData['comment'] ||
            '';

        const typeVal =
            normalizedData['тип недвижимости'] ||
            normalizedData['тип'] ||
            normalizedData['type'] ||
            'PROPERTY';

        // Build generic notes from ALL fields for safety
        const fullNoteContent = Object.entries(formData)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        // Parse Name (Split into First/Last)
        const parts = nameVal.trim().split(/\s+/);
        const firstName = parts[0] || 'Unknown';
        const lastName = parts.slice(1).join(' ');

        // Check if Seller already exists
        let seller = await prisma.seller.findFirst({ where: { phone: phoneVal } });

        if (!seller) {
            // Create new Seller (Lead)
            seller = await prisma.seller.create({
                data: {
                    brokerId: assignedBrokerId,
                    firstName,
                    lastName,
                    phone: phoneVal,
                    source: `FORM: ${form.title}`,
                    managerComment: `Данные формы:\n${fullNoteContent}\n\n${isFallback ? '[WARNING: No brokers assigned, sent to Admin]' : ''}\n${brokerId ? '[PERSONAL LINK]' : ''}`,
                    funnelStage: 'CONTACT', // Start stage of Seller Funnel
                }
            });

            // Notify Broker
            await prisma.notification.create({
                data: {
                    userId: assignedBrokerId,
                    type: 'DEAL',
                    title: 'Новый лид',
                    message: `Новая заявка "${form.title}" от ${firstName} ${lastName}. Телефон: ${phoneVal}`,
                    isRead: false
                }
            });

            res.json({ success: true, message: 'Application received', sellerId: seller.id });
        } else {
            // Updated existing seller notes or notify broker about return
            await prisma.notification.create({
                data: {
                    userId: assignedBrokerId,
                    type: 'SYSTEM',
                    title: 'Повторная заявка',
                    message: `Существующий клиент ${firstName} ${lastName} (${phoneVal}) оставил повторную заявку через форму "${form.title}".`,
                    isRead: false
                }
            });

            res.json({ success: true, message: 'Application received (Existing client)', sellerId: seller.id });
        }

    } catch (error: any) {
        console.error('Submit form error - DETAILED:', {
            error: error.message,
            stack: error.stack,
            formId: req.params.id,
            body: req.body
        });
        res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});
