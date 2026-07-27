// export type DealStage = 'CONSULTATION' | 'CONTRACT' | 'PROMOTION' | 'SHOWINGS'; // Removed in favor of Enum

export interface Deal {
    id: string;
    amount: number;
    commission: number;
    casaFee: number;
    stage: DealStage;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    color: string;
    source: string;

    // Client Relation
    clientId?: string | null;
    client?: {
        id: string;
        firstName: string;
        lastName: string;
        phone: string;
        email?: string | null;
    } | null;

    // Broker Info (for Admin)
    broker?: {
        id: string;
        firstName: string;
        lastName: string;
    } | null;

    // Object Info
    objectType: string;
    objectId?: string | null;
    title?: string;

    notes?: string | null;
    completedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export enum DealStage {
    CONSULTATION = 'CONSULTATION',
    CONTRACT = 'CONTRACT',
    PROMOTION = 'PROMOTION',
    SHOWINGS = 'SHOWINGS'
}
