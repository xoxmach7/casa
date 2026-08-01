import { describe, it, expect } from 'vitest';
import { detectImageExtension } from '../lib/image-sniff';

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
