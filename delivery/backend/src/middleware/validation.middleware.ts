// =========================================
// ZOD VALIDATION MIDDLEWARE
// Validates request body/params/query using Zod schemas
// =========================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationTarget = 'body' | 'params' | 'query';

interface ValidationConfig {
    schema: ZodSchema;
    target?: ValidationTarget;
}

/**
 * Middleware factory for Zod validation
 * Validates request data against a Zod schema
 */
export const validate = (config: ValidationConfig | ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const schema = 'schema' in config ? config.schema : config;
            const target = 'target' in config ? config.target || 'body' : 'body';

            const dataToValidate = req[target];
            const validatedData = schema.parse(dataToValidate);

            // Replace request data with validated/transformed data
            req[target] = validatedData;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                }));

                console.error('Validation error:', JSON.stringify(formattedErrors, null, 2)); // DEBUG LOG
                res.status(400).json({
                    error: 'Ошибка валидации',
                    details: formattedErrors,
                });
                return;
            }

            console.error('Validation middleware error:', error);
            res.status(500).json({ error: 'Внутренняя ошибка валидации' });
        }
    };
};

/**
 * Validates multiple parts of the request
 */
export const validateMultiple = (configs: {
    body?: ZodSchema;
    params?: ZodSchema;
    query?: ZodSchema;
}) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const errors: Array<{ field: string; message: string; target: string }> = [];

            if (configs.body) {
                const result = configs.body.safeParse(req.body);
                if (result.success) {
                    req.body = result.data;
                } else {
                    result.error.errors.forEach((err) => {
                        errors.push({
                            field: err.path.join('.'),
                            message: err.message,
                            target: 'body',
                        });
                    });
                }
            }

            if (configs.params) {
                const result = configs.params.safeParse(req.params);
                if (result.success) {
                    req.params = result.data;
                } else {
                    result.error.errors.forEach((err) => {
                        errors.push({
                            field: err.path.join('.'),
                            message: err.message,
                            target: 'params',
                        });
                    });
                }
            }

            if (configs.query) {
                const result = configs.query.safeParse(req.query);
                if (result.success) {
                    req.query = result.data as any;
                } else {
                    result.error.errors.forEach((err) => {
                        errors.push({
                            field: err.path.join('.'),
                            message: err.message,
                            target: 'query',
                        });
                    });
                }
            }

            if (errors.length > 0) {
                res.status(400).json({
                    error: 'Ошибка валидации',
                    details: errors,
                });
                return;
            }

            next();
        } catch (error) {
            console.error('Validation middleware error:', error);
            res.status(500).json({ error: 'Внутренняя ошибка валидации' });
        }
    };
};
