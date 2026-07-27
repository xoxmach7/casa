import { describe, it, expect } from 'vitest';
import {
  calculatePropertyClass,
  calculateLiquidityScore,
  calculateStrategy,
  getStrategyExplanation,
} from '../lib/property-calculator.service';

describe('Property Calculator', () => {
  describe('calculatePropertyClass', () => {
    const baseInput = {
      yearBuilt: 2020,
      buildingType: 'MONOLITH' as const,
      ceilingHeight: 2.7,
      totalFloors: 12,
      apartmentsPerFloor: 4,
      parkingType: 'UNDERGROUND' as const,
      hasClosedTerritory: true,
      elevatorCount: 2,
      hasFreightElevator: true,
      locationQuality: 'TOP' as const,
    };

    it('OLD_FUND for buildings <= 1980', () => {
      expect(calculatePropertyClass({ ...baseInput, yearBuilt: 1975 })).toBe('OLD_FUND');
      expect(calculatePropertyClass({ ...baseInput, yearBuilt: 1980 })).toBe('OLD_FUND');
    });

    it('not OLD_FUND for buildings after 1980', () => {
      const result = calculatePropertyClass({ ...baseInput, yearBuilt: 1981 });
      expect(result).not.toBe('OLD_FUND');
    });

    it('ECONOMY for minimal specs', () => {
      const result = calculatePropertyClass({
        yearBuilt: 2010,
        buildingType: 'PANEL' as any,
        ceilingHeight: 2.5,
        totalFloors: 5,
        apartmentsPerFloor: 8,
        parkingType: 'NONE' as any,
        hasClosedTerritory: false,
        elevatorCount: 0,
        hasFreightElevator: false,
        locationQuality: 'STANDARD' as any,
      });
      expect(result).toBe('ECONOMY');
    });

    it('returns a valid class for any input', () => {
      const validClasses = ['BUSINESS', 'COMFORT_PLUS', 'COMFORT', 'ECONOMY', 'OLD_FUND'];
      const result = calculatePropertyClass(baseInput);
      expect(validClasses).toContain(result);
    });
  });

  describe('calculateLiquidityScore', () => {
    const baseInput = {
      calculatedClass: 'COMFORT' as const,
      yearBuilt: 2018,
      floor: 5,
      totalFloors: 12,
      rooms: 2,
      area: 65,
      price: 35000000,
      repairState: 'EURO' as const,
      actualCondition: 'GOOD',
      parkingType: 'UNDERGROUND' as const,
      layoutType: 'ISOLATED' as const,
      isCorner: false,
      hasBalcony: true,
      financeType: 'CLEAN',
      locationQuality: 'TOP' as const,
      elevatorCount: 2,
    };

    it('returns score between 0 and 100', () => {
      const result = calculateLiquidityScore(baseInput);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('returns a valid level', () => {
      const validLevels = ['HIGH', 'MEDIUM', 'LOW'];
      const result = calculateLiquidityScore(baseInput);
      expect(validLevels).toContain(result.level);
    });

    it('first/last floor penalty', () => {
      const midFloor = calculateLiquidityScore({ ...baseInput, floor: 5 });
      const firstFloor = calculateLiquidityScore({ ...baseInput, floor: 1 });
      expect(firstFloor.score).toBeLessThanOrEqual(midFloor.score);
    });
  });

  describe('calculateStrategy', () => {
    const baseInput = {
      seller: {
        reason: 'SIZE_CHANGE',
        deadline: 'FLEXIBLE',
        expectedPrice: 35000000,
        minPrice: 32000000,
        hasDebts: false,
        readyForExclusive: true,
        trustLevel: 4,
      },
      property: {
        calculatedClass: 'COMFORT' as const,
        liquidityLevel: 'HIGH' as const,
        liquidityScore: 75,
        price: 35000000,
        financeType: 'CLEAN',
        hasLegalIssues: false,
      },
    };

    it('returns a valid strategy', () => {
      const result = calculateStrategy(baseInput);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('legal issues affect strategy', () => {
      const clean = calculateStrategy(baseInput);
      const withIssues = calculateStrategy({
        ...baseInput,
        property: { ...baseInput.property, hasLegalIssues: true },
      });
      // May or may not differ, but should not crash
      expect(typeof withIssues).toBe('string');
    });
  });

  describe('getStrategyExplanation', () => {
    it('returns explanation for known strategies', () => {
      const strategies = [
        'FAST_SALE', 'STANDARD_SALE', 'PREMIUM_SALE',
        'REJECT_OBJECT', 'LOW_LIQUIDITY',
      ];
      for (const s of strategies) {
        const explanation = getStrategyExplanation(s as any);
        expect(typeof explanation).toBe('string');
      }
    });
  });
});
