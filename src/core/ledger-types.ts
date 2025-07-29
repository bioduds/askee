/**
 * Copy of accounting ledger types for src directory
 */

export type EntryKind = 'EARN' | 'REDEEM' | 'REFUND' | 'SLASH';

export interface LedgerEntry {
    id: string;                 // uuid
    ts: number;                 // epoch seconds
    userIdHash: string;
    taskId?: string;
    kind: EntryKind;
    ccDelta: number;            // + for EARN/REFUND, - for REDEEM/SLASH
    units?: Partial<{ NCU_s: number; GCU_s: number; IO_GB: number }>;
    sig?: string;               // coordinator signature
}

export interface AccountBalance {
    userIdHash: string;
    ccTotal: number;
    earnedLifetime: number;
    redeemedLifetime: number;
    lastUpdated: number;
}
