/**
 * Калькулятор брокера — расчёт по параметрам на движке M06.
 *
 * DEC-API-003 (кандидат, вспомогательный): НЕ входит в 45 канонических
 * контрактов и не создаёт никаких артефактов кейса.
 *
 * Зачем отдельный эндпоинт. Канонический `POST /cases/{id}/calculation-runs`
 * по §21 требует опубликованный снапшот профиля M05 и порождает иммутабельный
 * calculation_snapshot — это артефакт кейса, доказательство. Брокеру же нужен
 * ещё и быстрый прикидочный расчёт «цена / взнос / ставка / срок → платёж» без
 * кейса. Раньше это считалось прямо в браузере через Math.pow — что и запретил
 * M06. Здесь тот же ввод, но считает СЕРВЕР теми же утверждёнными формулами
 * CALC-F-001/002 в decimal-контексте precision=50.
 *
 * Чем этот ответ ОТЛИЧАЕТСЯ от расчёта кейса, и почему их нельзя путать:
 *  - не создаёт calculation_run и calculation_snapshot;
 *  - не имеет input/output/replay-хэшей — воспроизводимым артефактом не является;
 *  - не привязан к участнику, согласию и снапшоту профиля;
 *  - помечен `is_case_artifact: false` и не годится как evidence.
 * Поэтому он принимает суммы в теле запроса — в отличие от канонического
 * прогона, где это запрещено: подменить им доказательство невозможно.
 *
 * Чего здесь нет и не будет: КДН, принимаемого банком дохода, вердиктов
 * программ, вероятности одобрения и любого балла (M06 §17, §10–§11).
 */

import { Prisma } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import {
  requiredFinancing,
  annuityPaymentByParameters,
  type CalcResult,
} from '../lib/mortgage-workspace/m06-calc';
import {
  M06_ENGINE_VERSION,
  M06_DECIMAL_CONTEXT_VERSION,
} from '../lib/mortgage-workspace/mortgage-calc.service';
import { M06_FORMULA_REGISTRY_VERSION } from '../lib/mortgage-workspace/m06-formula-registry';

export const mortgageCalcToolsRouter = Router();
mortgageCalcToolsRouter.use(authenticate);

const money = z.union([z.number().nonnegative(), z.string().trim().min(1)]);

const quoteSchema = z.object({
  target_price: money,
  available_now_down_payment: money.optional(),
  annual_nominal_rate_percent: money,
  term_months: z.number().int().min(1).max(1200),
}).strict();

const programQuoteSchema = quoteSchema.omit({ annual_nominal_rate_percent: true }).extend({
  /** Ограничение выборки каталога; ставка берётся из самой программы. */
  property_type: z.enum(['NEW_BUILDING', 'SECONDARY']).optional(),
}).strict();

/** Ответ формулы наружу — ровно то, что вернул движок. */
function formulaView(r: CalcResult) {
  return {
    formula_id: r.formulaId,
    machine_name: r.machineName,
    formula_version: r.formulaVersion,
    raw: r.raw,
    value: r.value,
    display_kzt: r.displayKzt,
    status: r.status,
    codes: r.codes,
    currency: r.currency,
  };
}

function computeQuote(input: {
  targetPrice: string | number;
  downPayment: string | number | undefined;
  ratePercent: string | number;
  termMonths: number;
}) {
  const rf = requiredFinancing({
    targetPrice: input.targetPrice,
    // Взнос не указан — это ноль ВВЕДЁННЫЙ пользователем, а не «неизвестно»:
    // калькулятор не угадывает, он считает по тому, что дали.
    availableNowDownPayment: input.downPayment ?? 0,
  });

  const ann = annuityPaymentByParameters({
    principal: rf.value !== null ? rf.value : { status: 'UNKNOWN' },
    annualNominalRatePercent: input.ratePercent,
    termMonths: input.termMonths,
    paymentFrequency: 'MONTHLY',
  });

  return { rf, ann };
}

function quoteEnvelope(rf: CalcResult, ann: CalcResult) {
  return {
    // Явный маркер: это прикидка, а не артефакт кейса.
    is_case_artifact: false,
    note: 'Предварительный расчёт по параметрам. Не является решением банка '
      + 'и не заменяет расчёт по ипотечному кейсу.',
    engine_version: M06_ENGINE_VERSION,
    decimal_context_version: M06_DECIMAL_CONTEXT_VERSION,
    formula_registry_version: M06_FORMULA_REGISTRY_VERSION,
    required_financing: formulaView(rf),
    annuity_payment: formulaView(ann),
  };
}

/**
 * POST /api/v2/calculation-tools/quote — платёж по введённым параметрам.
 */
mortgageCalcToolsRouter.post('/quote', (req: Request, res: Response): void => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'validation_error', message: 'Ошибка валидации запроса', details: parsed.error.flatten() } });
    return;
  }
  const { rf, ann } = computeQuote({
    targetPrice: parsed.data.target_price,
    downPayment: parsed.data.available_now_down_payment,
    ratePercent: parsed.data.annual_nominal_rate_percent,
    termMonths: parsed.data.term_months,
  });
  res.json({ data: quoteEnvelope(rf, ann) });
});

/**
 * POST /api/v2/calculation-tools/program-quotes — платёж по каждой программе
 * из каталога, посчитанный ТЕМ ЖЕ движком по ставке программы.
 *
 * Это справочник со стоимостью обслуживания, а НЕ подбор и не отбор: здесь нет
 * вердикта «подходит/не подходит», нет КДН и нет вероятности одобрения.
 * Соответствие требованиям банка определяется Bank Rules (релиз 1.1) и здесь
 * намеренно отсутствует — иначе цифра превратилась бы в решение банка.
 *
 * Минимальный взнос и предельный срок программы отдаются как СПРАВОЧНЫЕ поля
 * банка: показать их можно, а трактовать за банк — нет.
 */
mortgageCalcToolsRouter.post('/program-quotes', async (req: Request, res: Response): Promise<void> => {
  const parsed = programQuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'validation_error', message: 'Ошибка валидации запроса', details: parsed.error.flatten() } });
    return;
  }
  try {
    const programs = await prisma.mortgageProgram.findMany({
      where: {
        isActive: true,
        ...(parsed.data.property_type ? { propertyType: parsed.data.property_type } : {}),
      },
      orderBy: [{ interestRate: 'asc' }, { id: 'asc' }],
      take: 50,
    });

    const quotes = programs.map((p) => {
      // Срок берём наименьший из запрошенного и предельного по программе —
      // считать платёж на невозможном сроке было бы вводом в заблуждение.
      const termMonths = Math.min(parsed.data.term_months, p.maxTerm);
      const { rf, ann } = computeQuote({
        targetPrice: parsed.data.target_price,
        downPayment: parsed.data.available_now_down_payment,
        ratePercent: p.interestRate.toString(),
        termMonths,
      });
      return {
        program: {
          id: p.id,
          bank_name: p.bankName,
          program_name: p.programName,
          interest_rate: p.interestRate.toString(),
          // Справочные требования банка. CASA их не оценивает.
          min_down_payment_percent: p.minDownPayment.toString(),
          max_term_months: p.maxTerm,
          property_type: p.propertyType,
        },
        term_months_used: termMonths,
        term_capped_by_program: termMonths !== parsed.data.term_months,
        ...quoteEnvelope(rf, ann),
      };
    });

    res.json({
      data: {
        disclaimer: 'Платёж рассчитан по ставке программы. Это не подбор, не одобрение '
          + 'и не решение банка: соответствие требованиям банка определяет банк.',
        quotes,
      },
    });
  } catch {
    res.status(500).json({ error: { code: 'internal_error', message: 'Не удалось рассчитать по программам' } });
  }
});

export default mortgageCalcToolsRouter;
