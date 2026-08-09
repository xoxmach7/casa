import { describe, it, expect } from 'vitest';
import { typo } from './typography';

const NBSP = ' ';

/** Renders the result readably: shows where a non-breaking space landed. */
const show = (s: string) => s.replace(/ /g, '_');

describe('typo', () => {
  it('binds a one-letter conjunction to the word after it', () => {
    // The case from the landing: "и" must not be left dangling at line end.
    expect(show(typo('Контроль комиссий и выплат'))).toBe('Контроль комиссий и_выплат');
  });

  it('binds two-letter prepositions', () => {
    expect(show(typo('Объекты в одной системе'))).toBe('Объекты в_одной системе');
    expect(show(typo('заявки от партнёров'))).toBe('заявки от_партнёров');
    expect(show(typo('путь по этапам'))).toBe('путь по_этапам');
  });

  it('binds a run of short words, not just the first', () => {
    expect(show(typo('Объекты, ипотека и в одной системе'))).toBe(
      'Объекты, ипотека и_в_одной системе'
    );
  });

  it('binds longer prepositions and conjunctions from the list', () => {
    expect(show(typo('каталог для застройщика'))).toBe('каталог для_застройщика');
    expect(show(typo('оценка при подаче'))).toBe('оценка при_подаче');
  });

  it('keeps an em dash off the start of a line', () => {
    expect(show(typo('CASA Pro — закрытая платформа'))).toBe('CASA Pro_— закрытая платформа');
  });

  it('handles a short word at the very start of the string', () => {
    expect(show(typo('и выплаты партнёрам'))).toBe('и_выплаты партнёрам');
  });

  it('leaves long words alone', () => {
    expect(typo('Актуальный каталог новостроек')).toBe('Актуальный каталог новостроек');
  });

  it('does not touch a short word at the end — there is nothing to bind it to', () => {
    expect(typo('всё это и')).toBe('всё это и');
  });

  it('is idempotent, so re-running it never doubles spaces', () => {
    const once = typo('Контроль комиссий и выплат — важно');
    expect(typo(once)).toBe(once);
  });

  it('never introduces a double space or drops a character', () => {
    const source = 'CASA Pro — единая система продаж новостроек, которая объединяет застройщиков и агентства.';
    const result = typo(source);
    expect(result).not.toMatch(/ {2}/);
    expect(result.replace(/ /g, ' ')).toBe(source);
  });

  it('binds after an opening quote', () => {
    expect(show(typo('«и выплаты»'))).toBe('«и_выплаты»');
  });
});
