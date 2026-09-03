/**
 * Отпечаток покупателя и расчёт комиссии.
 *
 * Обе вещи держат деньги. Если нормализация телефона сломается, дубль-чек
 * начнёт пропускать одного и того же покупателя дважды. Если раздел комиссии
 * посчитать двумя умножениями, доли перестанут сходиться с целым.
 */

import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { buyerIdentityHash, normalizePhone, maskPhone } from '../lib/marketplace/identity';
import { computeCommission, CommissionError } from '../lib/marketplace/commission.service';

const KEY = 'x'.repeat(40);

describe('отпечаток покупателя', () => {
  it('три записи одного номера дают один отпечаток', () => {
    const forms = ['+7 (777) 123-45-67', '87771234567', '7771234567'];
    const hashes = forms.map((f) => buyerIdentityHash(f, KEY));

    expect(new Set(hashes).size).toBe(1);
  });

  it('разные номера дают разные отпечатки', () => {
    expect(buyerIdentityHash('+77771234567', KEY)).not.toBe(
      buyerIdentityHash('+77771234568', KEY),
    );
  });

  it('без ключа не строится вовсе — голый хэш телефона перебирается', () => {
    expect(() => buyerIdentityHash('+77771234567', undefined)).toThrow(/HMAC/);
    expect(() => buyerIdentityHash('+77771234567', 'короткий')).toThrow(/32/);
  });

  it('не восстанавливается обратно и не содержит номера', () => {
    const hash = buyerIdentityHash('+77771234567', KEY);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('7771234567');
  });

  it('нормализация не склеивает мусор в один номер', () => {
    // Пустая строка и явно не наш формат не должны стать одним «покупателем».
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone('123')).toBe('123');
  });

  it('маска показывает только последние четыре цифры', () => {
    expect(maskPhone('+77771234567')).toBe('+7 ••• ••• 4567');
    expect(maskPhone('+77771234567')).not.toContain('777123');
  });
});

describe('расчёт комиссии', () => {
  it('считает комиссию собственника и раздел по объявленной доле', () => {
    const b = computeCommission('30000000.00', '1.50', '50.00');

    expect(b.amount.toString()).toBe('450000');
    expect(b.partnerShare.toString()).toBe('225000');
    expect(b.casaShare.toString()).toBe('225000');
  });

  it('BASIC дороже собственнику, чем EXCLUSIVE — в этом весь смысл двух уровней', () => {
    const basic = computeCommission('30000000.00', '2.00', '50.00');
    const exclusive = computeCommission('30000000.00', '1.50', '50.00');

    expect(basic.amount.toString()).toBe('600000');
    expect(exclusive.amount.toString()).toBe('450000');
    expect(basic.amount.sub(exclusive.amount).toString()).toBe('150000');
  });

  it('доли всегда сходятся с целым, даже когда процент даёт копейки', () => {
    // 33.33% от суммы, которая не делится нацело: casaShare считается
    // вычитанием, поэтому сумма частей равна целому до копейки.
    const b = computeCommission('27777777.77', '1.37', '33.33');

    expect(b.partnerShare.add(b.casaShare).toString()).toBe(b.amount.toString());
  });

  it('копейки не теряются на округлении', () => {
    const b = computeCommission('10000000.01', '1.50', '50.00');

    expect(b.amount.decimalPlaces()).toBeLessThanOrEqual(2);
    expect(b.partnerShare.add(b.casaShare).equals(b.amount)).toBe(true);
  });

  it('нулевая и отрицательная цена отвергаются, а не считаются', () => {
    expect(() => computeCommission('0', '1.50', '50.00')).toThrow(CommissionError);
    expect(() => computeCommission('-1000', '1.50', '50.00')).toThrow(CommissionError);
  });

  it('работает от Decimal так же, как от строки', () => {
    const fromString = computeCommission('30000000.00', '1.50', '50.00');
    const fromDecimal = computeCommission(
      new Prisma.Decimal('30000000.00'),
      new Prisma.Decimal('1.50'),
      new Prisma.Decimal('50.00'),
    );

    expect(fromDecimal.amount.toString()).toBe(fromString.amount.toString());
  });
});
