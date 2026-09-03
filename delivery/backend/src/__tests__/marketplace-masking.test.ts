/**
 * Маскировка объекта до фиксации.
 *
 * Главное, что здесь проверяется, — не адрес. Адрес очевиден. Проверяется,
 * что наружу не уходят ССЫЛКИ НА ВНЕШНИЕ ПЛОЩАДКИ: оставленный krishaUrl
 * сводит на нет весь механизм, потому что даёт агенту маршрут в обход
 * платформы в один клик.
 */

import { describe, expect, it } from 'vitest';
import { maskProperty } from '../lib/marketplace/masking';

const PROPERTY = {
  id: 'prop_1',
  residentialComplex: 'ЖК Северное сияние',
  district: 'Есильский',
  address: 'ул. Достык, 12, кв. 45',
  lat: 51.128422,
  lng: 71.430564,
  rooms: 3,
  area: 78.5,
  price: '30000000.00',
  images: ['a.jpg', 'b.jpg'],
  krishaUrl: 'https://krisha.kz/a/show/1',
  olxUrl: 'https://olx.kz/obyavlenie/1',
  videoUrl: 'https://youtu.be/x',
  virtualTourUrl: 'https://tour/1',
  notes: 'Собственник торопится, готов уступить 2 млн',
  seller: { id: 'seller_1', firstName: 'Айгуль', phone: '+77771234567' },
  sellerId: 'seller_1',
};

describe('маскировка до фиксации', () => {
  it('прячет внешние ссылки — иначе обход площадки в один клик', () => {
    const masked = maskProperty(PROPERTY, { unlocked: false, tier: 'BASIC' });

    expect(masked.krishaUrl).toBeUndefined();
    expect(masked.olxUrl).toBeUndefined();
    expect(masked.videoUrl).toBeUndefined();
    expect(masked.virtualTourUrl).toBeUndefined();

    // Утекать не должны ЗНАЧЕНИЯ. Имена скрытых полей в maskedFields
    // остаются намеренно: интерфейсу нужно знать, что именно закрыто.
    const serialized = JSON.stringify(masked);
    expect(serialized).not.toContain('krisha.kz');
    expect(serialized).not.toContain('olx.kz');
    expect(serialized).not.toContain('youtu.be');
  });

  it('прячет адрес, контакты собственника и внутренние заметки', () => {
    const masked = maskProperty(PROPERTY, { unlocked: false, tier: 'BASIC' });

    expect(masked.address).toBeUndefined();
    expect(masked.seller).toBeUndefined();
    expect(masked.sellerId).toBeUndefined();
    expect(masked.notes).toBeUndefined();
    expect(JSON.stringify(masked)).not.toContain('77771234567');
  });

  it('оставляет то, по чему агент принимает решение', () => {
    const masked = maskProperty(PROPERTY, { unlocked: false, tier: 'BASIC' });

    expect(masked.residentialComplex).toBe('ЖК Северное сияние');
    expect(masked.district).toBe('Есильский');
    expect(masked.rooms).toBe(3);
    expect(masked.area).toBe(78.5);
    expect(masked.price).toBe('30000000.00');
    expect(masked.images).toEqual(['a.jpg', 'b.jpg']);
  });

  it('BASIC прячет координаты полностью', () => {
    const masked = maskProperty(PROPERTY, { unlocked: false, tier: 'BASIC' });

    expect(masked.lat).toBeNull();
    expect(masked.lng).toBeNull();
    expect(masked.coordinatesApproximate).toBe(false);
  });

  it('EXCLUSIVE показывает координаты приблизительно — карта работает, подъезд нет', () => {
    const masked = maskProperty(PROPERTY, { unlocked: false, tier: 'EXCLUSIVE' });

    expect(masked.coordinatesApproximate).toBe(true);
    expect(masked.lat).not.toBe(PROPERTY.lat);
    // Округление до ~500 м: сотые доли градуса сохраняются, точность теряется.
    expect(Math.abs((masked.lat as number) - PROPERTY.lat)).toBeLessThan(0.01);
  });

  it('после фиксации отдаёт объект как есть', () => {
    const masked = maskProperty(PROPERTY, { unlocked: true, tier: 'BASIC' });

    expect(masked.isMasked).toBe(false);
    expect(masked.address).toBe('ул. Достык, 12, кв. 45');
    expect(masked.krishaUrl).toBe('https://krisha.kz/a/show/1');
    expect(masked.seller).toEqual(PROPERTY.seller);
  });

  it('помечает себя маскированным явно, а не молчанием', () => {
    const masked = maskProperty(PROPERTY, { unlocked: false, tier: 'BASIC' });

    expect(masked.isMasked).toBe(true);
    expect(masked.maskedFields).toContain('address');
    expect(masked.maskedFields).toContain('krishaUrl');
    expect(masked.maskedFields).toContain('seller');
  });
});
