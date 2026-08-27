/**
 * M02 §11 / §16 — статическая проверка запрещённых механизмов.
 *
 * Спека запрещает не «плохо делать», а сам факт наличия механизма: обход или
 * распознавание CAPTCHA, solver, headless-браузер, приём и хранение пароля
 * eGov/КГД, OTP, cookies или ЭЦП клиента, автоматизация личного кабинета.
 *
 * Тест читает исходники M02 и падает, если такой механизм появится. Это
 * дешёвый и честный сторож: ревью можно пропустить, тест — нет.
 * (§23 п.11 «No prohibited mechanism in code/config/logs», AT-IIN-009/018.)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const M02_PATHS = [
  path.join(ROOT, 'lib', 'mortgage-m02'),
  path.join(ROOT, 'routes', 'm02-iin-check.routes.ts'),
];

function collectFiles(target: string): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs.readdirSync(target).flatMap((entry) => collectFiles(path.join(target, entry)));
}

const FILES = M02_PATHS.flatMap(collectFiles).filter((f) => f.endsWith('.ts'));

/**
 * Строки кода без комментариев: спека требует ОБСУЖДАТЬ запреты в комментариях
 * («CAPTCHA остаётся человеку»), поэтому искать нужно в исполняемом коде.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');
}

describe('M02 §11 — запрещённые механизмы отсутствуют в коде', () => {
  it('модули M02 найдены', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(5);
  });

  const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
    { pattern: /puppeteer|playwright|selenium|webdriver|headless/i, why: 'headless-браузер для обхода источника' },
    { pattern: /2captcha|anticaptcha|captcha[_-]?solver|solveCaptcha/i, why: 'сервис разгадывания CAPTCHA' },
    { pattern: /tesseract|ocr[._]?recognize/i, why: 'OCR-распознавание CAPTCHA' },
    { pattern: /\b(clientPassword|egovPassword|kgdPassword|userPassword)\b/i, why: 'пароль клиента' },
    { pattern: /\b(otpCode|smsOtp|clientOtp)\b/i, why: 'OTP клиента' },
    { pattern: /\b(edsKey|eczKey|digitalSignatureKey|clientCertificateKey)\b/i, why: 'ЭЦП клиента' },
    { pattern: /\b(clientCookies|sessionCookie|cookieJar)\b/i, why: 'cookies/сессия клиента' },
  ];

  for (const { pattern, why } of FORBIDDEN) {
    it(`не содержит: ${why}`, () => {
      for (const file of FILES) {
        const code = codeOnly(fs.readFileSync(file, 'utf8'));
        expect(pattern.test(code), `${path.basename(file)} содержит ${why}`).toBe(false);
      }
    });
  }

  it('не выполняет исходящих HTTP-запросов к источникам', () => {
    for (const file of FILES) {
      const code = codeOnly(fs.readFileSync(file, 'utf8'));
      // В R0 внешних вызовов нет вовсе: ни fetch, ни axios, ни http-клиента.
      expect(/\bfetch\s*\(/.test(code), `${path.basename(file)} вызывает fetch`).toBe(false);
      expect(/\baxios\b/.test(code), `${path.basename(file)} использует axios`).toBe(false);
      expect(/require\(['"]https?['"]\)/.test(code)).toBe(false);
    }
  });

  it('не логирует ИИН: в коде нет вывода поля iin в консоль', () => {
    for (const file of FILES) {
      const code = codeOnly(fs.readFileSync(file, 'utf8'));
      const logsIin = /console\.(log|info|warn|error)\([^)]*\biin\b(?!_?masked|LookupToken)/i.test(code);
      expect(logsIin, `${path.basename(file)} логирует ИИН`).toBe(false);
    }
  });

  it('официальные URL источников не содержат подстановки ИИН', () => {
    for (const file of FILES) {
      const code = codeOnly(fs.readFileSync(file, 'utf8'));
      // Шаблонная строка с URL и интерполяцией ИИН — прямой запрет §11.
      expect(/https?:\/\/[^'"`]*\$\{[^}]*iin/i.test(code)).toBe(false);
    }
  });
});
