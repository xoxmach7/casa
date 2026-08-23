import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('production backend startup', () => {
  it('applies versioned migrations instead of destructive schema push', () => {
    const dockerfile = readFileSync(resolve(process.cwd(), 'Dockerfile'), 'utf8');

    expect(dockerfile).toContain('npx prisma migrate deploy');
    expect(dockerfile).not.toContain('npx prisma db push');
  });
});
