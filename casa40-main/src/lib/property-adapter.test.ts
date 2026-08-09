import { describe, it, expect } from 'vitest';
import { adaptProperty, toAdminUpdatePayload, toPropertyLeadPayload } from './property-adapter';

// This module is the contract between the backend's CrmProperty shape and the
// snake_case shape every casa40 component reads. A silent change here shows up
// as blank fields on the live site, not as a crash — hence the tests.

const RAW = {
  id: 'prop_1',
  address: 'Жошы хана 27',
  area: '61.5',
  district: 'Есиль',
  residentialComplex: 'Prime Garden',
  rooms: 2,
  floor: 4,
  totalFloors: 12,
  price: '32500000',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-02T10:00:00.000Z',
  images: ['a.jpg', 'b.jpg'],
  status: 'ACTIVE',
  publicListingOps: { status: 'PUBLISHED', paymentStatus: 'PAID', paymentAmount: '50000' },
  seller: { firstName: 'Иван', lastName: 'Петров', phone: '+77011234567' },
};

describe('adaptProperty', () => {
  it('maps the fields the listing cards actually render', () => {
    const p = adaptProperty(RAW);
    expect(p.id).toBe('prop_1');
    expect(p.district).toBe('Есиль');
    expect(p.residential_complex).toBe('Prime Garden');
    expect(p.rooms).toBe(2);
    expect(p.photo_urls).toEqual(['a.jpg', 'b.jpg']);
  });

  it('converts Prisma decimal strings to numbers so arithmetic and formatting work', () => {
    const p = adaptProperty(RAW);
    expect(p.price).toBe(32500000);
    expect(p.area).toBe(61.5);
    expect(p.payment_amount).toBe(50000);
  });

  it('joins the seller name and never yields "undefined undefined"', () => {
    expect(adaptProperty(RAW).seller_name).toBe('Иван Петров');
    expect(adaptProperty({ ...RAW, seller: { firstName: 'Иван', phone: '+7' } }).seller_name).toBe('Иван');
    expect(adaptProperty({ ...RAW, seller: null }).seller_name).toBe('');
    expect(adaptProperty({ ...RAW, seller: null }).seller_phone).toBe('');
  });

  it('lowercases the payment status and defaults to unpaid when ops are missing', () => {
    expect(adaptProperty(RAW).payment_status).toBe('paid');
    expect(adaptProperty({ ...RAW, publicListingOps: null }).payment_status).toBe('unpaid');
  });

  it('translates every ops status the backend can send', () => {
    const statusFor = (status: string) =>
      adaptProperty({ ...RAW, publicListingOps: { status } }).status;
    expect(statusFor('NEW')).toBe('new');
    expect(statusFor('PUBLISHED')).toBe('published');
    expect(statusFor('SHOWING')).toBe('showing');
    expect(statusFor('IN_DEAL')).toBe('in_deal');
  });

  it('falls back to "new" on an unknown status rather than rendering an empty badge', () => {
    expect(adaptProperty({ ...RAW, publicListingOps: { status: 'SOMETHING_NEW' } }).status).toBe('new');
    expect(adaptProperty({ ...RAW, publicListingOps: null }).status).toBe('new');
  });

  it('carries archived state in is_archived, keeping the last working status visible', () => {
    const archived = adaptProperty({ ...RAW, publicListingOps: { status: 'ARCHIVED' } });
    expect(archived.is_archived).toBe(true);
    expect(archived.status).toBe('in_deal');
    expect(adaptProperty(RAW).is_archived).toBe(false);
  });

  it('derives furniture from the level, treating NONE as no furniture', () => {
    expect(adaptProperty({ ...RAW, furnitureLevel: 'FULL' }).has_furniture).toBe(true);
    expect(adaptProperty({ ...RAW, furnitureLevel: 'NONE' }).has_furniture).toBe(false);
    expect(adaptProperty(RAW).has_furniture).toBe(false);
  });

  it('survives a sparse record without throwing', () => {
    const p = adaptProperty({ id: 'x', createdAt: 'c', updatedAt: 'u' });
    expect(p.price).toBeNull();
    expect(p.area).toBeNull();
    expect(p.photo_urls).toEqual([]);
    expect(p.title).toBeNull();
  });
});

describe('toPropertyLeadPayload', () => {
  it('renames snake_case UI fields to the camelCase the API expects', () => {
    const body = toPropertyLeadPayload({
      district: 'Есиль',
      residential_complex: 'Prime Garden',
      address: 'Жошы хана 27',
      price: '32500000',
      rooms: '2',
      area: '61.5',
      seller_name: 'Иван Петров',
      seller_phone: '+77011234567',
      total_floors: '12',
    });

    expect(body).toMatchObject({
      district: 'Есиль',
      residentialComplex: 'Prime Garden',
      price: 32500000,
      rooms: 2,
      area: 61.5,
      contactName: 'Иван Петров',
      contactPhone: '+77011234567',
      totalFloors: 12,
    });
  });

  it('substitutes a placeholder house number, which the API requires', () => {
    expect(toPropertyLeadPayload({}).houseNumber).toBe('-');
  });

  it('maps free-text Russian building types onto backend enums', () => {
    expect(toPropertyLeadPayload({ building_type: 'Монолит' }).buildingType).toBe('MONOLITH');
    expect(toPropertyLeadPayload({ building_type: ' кирпич ' }).buildingType).toBe('BRICK');
    expect(toPropertyLeadPayload({ renovation_condition: 'Евроремонт' }).repairState).toBe('EURO');
  });

  it('drops an unrecognised value instead of sending it and failing validation', () => {
    expect(toPropertyLeadPayload({ building_type: 'саман' }).buildingType).toBeUndefined();
    expect(toPropertyLeadPayload({ renovation_condition: '' }).repairState).toBeUndefined();
  });

  it('sends rooms >= 1 and never NaN from an empty form', () => {
    const body = toPropertyLeadPayload({});
    expect(body.rooms).toBe(1);
    expect(body.price).toBe(0);
    expect(body.area).toBe(0);
    expect(Number.isNaN(body.price)).toBe(false);
  });
});

describe('toAdminUpdatePayload', () => {
  it('sends only the fields the editor actually touched', () => {
    expect(toAdminUpdatePayload({ price: '30000000' })).toEqual({ price: 30000000 });
  });

  it('preserves a deliberate zero or false instead of dropping it', () => {
    expect(toAdminUpdatePayload({ floor: 0, negotiable: false })).toEqual({ floor: 0, negotiable: false });
  });

  it('renames photo_urls to images, the field the backend stores', () => {
    expect(toAdminUpdatePayload({ photo_urls: ['a.jpg'] })).toEqual({ images: ['a.jpg'] });
  });

  it('returns an empty body when nothing changed', () => {
    expect(toAdminUpdatePayload({})).toEqual({});
  });
});
