export interface PickBrokerInput {
  explicitBrokerId?: string;
  distributionType: 'MANUAL' | 'ROUND_ROBIN';
  brokerPool: string[];
  fallbackBrokerId?: string;
}

export interface PickBrokerResult {
  brokerId: string | undefined;
  isFallback: boolean;
}

export function pickBroker(input: PickBrokerInput): PickBrokerResult {
  if (input.explicitBrokerId) {
    return { brokerId: input.explicitBrokerId, isFallback: false };
  }

  if (input.distributionType === 'ROUND_ROBIN' && input.brokerPool.length > 0) {
    const randomIndex = Math.floor(Math.random() * input.brokerPool.length);
    return { brokerId: input.brokerPool[randomIndex], isFallback: false };
  }

  if (input.fallbackBrokerId) {
    return { brokerId: input.fallbackBrokerId, isFallback: true };
  }

  return { brokerId: undefined, isFallback: true };
}
