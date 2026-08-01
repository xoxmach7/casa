// Detects an image's real format from its file signature (magic bytes)
// instead of trusting the client-supplied mimetype/filename, both of which
// an attacker fully controls in a multipart upload.
export type SniffedImageExtension = '.jpg' | '.png' | '.webp';

export function detectImageExtension(buffer: Buffer): SniffedImageExtension | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return '.jpg';
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return '.png';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return '.webp';
  }

  return null;
}

// Same rationale as detectImageExtension, for the authenticated document
// upload endpoint (PDF / DOC / DOCX) — client-supplied mimetype/filename are
// attacker-controlled, so the real file signature decides the extension.
export type SniffedDocumentExtension = '.pdf' | '.doc' | '.docx';

export function detectDocumentExtension(buffer: Buffer): SniffedDocumentExtension | null {
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return '.pdf';
  }

  // Legacy .doc — OLE Compound File Binary signature.
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return '.doc';
  }

  // .docx is a zip (Office Open XML) — the zip local-file-header signature
  // is the strongest check available without unzipping and inspecting
  // [Content_Types].xml; sufficient here to rule out non-archive payloads
  // (HTML/JS/exe) being stored with a .docx extension.
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    return '.docx';
  }

  return null;
}
