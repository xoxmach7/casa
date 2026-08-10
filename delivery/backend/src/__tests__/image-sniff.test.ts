import { describe, it, expect } from 'vitest';
import { detectImageExtension, detectDocumentExtension } from '../lib/image-sniff';

describe('detectImageExtension', () => {
  it('detects a real JPEG by its magic bytes', () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('rest of file')]);
    expect(detectImageExtension(buf)).toBe('.jpg');
  });

  it('detects a real PNG by its magic bytes', () => {
    const buf = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('rest of file'),
    ]);
    expect(detectImageExtension(buf)).toBe('.png');
  });

  it('detects a real WEBP by its RIFF/WEBP container', () => {
    const buf = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WEBP'),
      Buffer.from('rest of file'),
    ]);
    expect(detectImageExtension(buf)).toBe('.webp');
  });

  it('rejects an HTML/script payload renamed to look like an image', () => {
    const buf = Buffer.from('<script>alert(document.cookie)</script>');
    expect(detectImageExtension(buf)).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(detectImageExtension(Buffer.alloc(0))).toBeNull();
  });

  it('rejects a buffer that merely starts with a JPEG-like byte but is too short', () => {
    expect(detectImageExtension(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('detectDocumentExtension', () => {
  it('detects a real PDF by its %PDF signature', () => {
    const buf = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.from('rest of file')]);
    expect(detectDocumentExtension(buf)).toBe('.pdf');
  });

  it('detects a legacy .doc by its OLE compound file signature', () => {
    const buf = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.from('rest of file'),
    ]);
    expect(detectDocumentExtension(buf)).toBe('.doc');
  });

  it('detects a real .docx — zip signature plus the mandatory [Content_Types].xml part', () => {
    const buf = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('....[Content_Types].xml....word/document.xml'),
    ]);
    expect(detectDocumentExtension(buf)).toBe('.docx');
  });

  it('rejects a plain zip renamed to .docx (no OOXML content-types part)', () => {
    // Любой архив под видом docx: zip-сигнатура есть, но [Content_Types].xml нет.
    const buf = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('just a normal archive')]);
    expect(detectDocumentExtension(buf)).toBeNull();
  });

  it('rejects an HTML/script payload renamed to look like a PDF', () => {
    const buf = Buffer.from('<script>alert(document.cookie)</script>');
    expect(detectDocumentExtension(buf)).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(detectDocumentExtension(Buffer.alloc(0))).toBeNull();
  });
});
