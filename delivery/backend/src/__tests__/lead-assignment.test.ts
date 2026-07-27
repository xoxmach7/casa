import { describe, it, expect, vi, afterEach } from 'vitest';
import { pickBroker } from '../lib/lead-assignment';

describe('pickBroker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the explicit brokerId when provided, ignoring the pool', () => {
    const result = pickBroker({
      explicitBrokerId: 'broker_explicit',
      distributionType: 'MANUAL',
      brokerPool: ['broker_a', 'broker_b'],
    });
    expect(result).toEqual({ brokerId: 'broker_explicit', isFallback: false });
  });

  it('picks randomly from the pool on ROUND_ROBIN with no explicit broker', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // forces last index
    const result = pickBroker({
      explicitBrokerId: undefined,
      distributionType: 'ROUND_ROBIN',
      brokerPool: ['broker_a', 'broker_b'],
    });
    expect(result).toEqual({ brokerId: 'broker_b', isFallback: false });
  });

  it('returns isFallback=true and no brokerId when the pool is empty and no fallback is given', () => {
    const result = pickBroker({
      explicitBrokerId: undefined,
      distributionType: 'ROUND_ROBIN',
      brokerPool: [],
    });
    expect(result).toEqual({ brokerId: undefined, isFallback: true });
  });

  it('uses the fallback broker id when the pool is empty', () => {
    const result = pickBroker({
      explicitBrokerId: undefined,
      distributionType: 'MANUAL',
      brokerPool: [],
      fallbackBrokerId: 'admin_001',
    });
    expect(result).toEqual({ brokerId: 'admin_001', isFallback: true });
  });
});
