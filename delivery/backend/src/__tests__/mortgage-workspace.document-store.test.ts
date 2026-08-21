import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  saveDocument, readMeta, readPdf, updateMeta, isValidId, newDocumentId, sha256Of,
  type StoredDocumentMeta,
} from '../lib/mortgage-workspace/document-store';

const ids: string[] = [];

describe('document-store — приватное хранение roundtrip', () => {
  it('сохраняет и читает PDF + метаданные, обновляет статус', () => {
    const id = newDocumentId();
    ids.push(id);
    const buf = Buffer.from('%PDF-1.4 test bytes');
    const meta: StoredDocumentMeta = {
      id, type: 'credit_history', fileName: 'test.pdf', size: buf.length,
      sha256: sha256Of(buf), status: 'needs_review', storedAt: new Date().toISOString(),
      extraction: { docType: 'credit_history' },
    };
    saveDocument(buf, meta);

    expect(readMeta(id)?.fileName).toBe('test.pdf');
    expect(readPdf(id)?.equals(buf)).toBe(true);

    const upd = updateMeta(id, { status: 'confirmed' });
    expect(upd?.status).toBe('confirmed');
    expect(readMeta(id)?.status).toBe('confirmed');
  });

  it('sha256 стабилен', () => {
    expect(sha256Of(Buffer.from('abc'))).toBe(sha256Of(Buffer.from('abc')));
  });

  it('isValidId защищает от path traversal', () => {
    expect(isValidId('a'.repeat(32))).toBe(true);
    expect(isValidId('../../etc/passwd')).toBe(false);
    expect(isValidId('nope.pdf')).toBe(false);
  });

  it('несуществующий документ → null', () => {
    expect(readMeta('deadbeefdeadbeefdeadbeefdeadbeef')).toBeNull();
    expect(readPdf('deadbeefdeadbeefdeadbeefdeadbeef')).toBeNull();
  });
});

afterAll(() => {
  const dir = process.env.MORTGAGE_PRIVATE_DIR || path.join(process.cwd(), 'uploads', 'mortgage-private');
  for (const id of ids) {
    try { fs.unlinkSync(path.join(dir, `${id}.pdf`)); } catch { /* ignore */ }
    try { fs.unlinkSync(path.join(dir, `${id}.json`)); } catch { /* ignore */ }
  }
});
