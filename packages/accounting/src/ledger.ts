import { LedgerEntry, AccountBalance } from './types';

const ledger: LedgerEntry[] = [];
const balances = new Map<string, AccountBalance>();
const holds = new Map<string, number>();

export function post(entry: LedgerEntry): void {
    if (!Number.isFinite(entry.ccDelta)) throw new Error('Invalid ccDelta');
    ledger.push(entry);
    const bal = balances.get(entry.userIdHash) ?? {
        userIdHash: entry.userIdHash,
        ccTotal: 0,
        earnedLifetime: 0,
        redeemedLifetime: 0,
        lastUpdated: 0
    };
    if ((bal.ccTotal + entry.ccDelta) < 0) {
        throw new Error('Insufficient balance');
    }
    bal.ccTotal += entry.ccDelta;
    if (entry.ccDelta > 0) bal.earnedLifetime += entry.ccDelta;
    if (entry.ccDelta < 0) bal.redeemedLifetime += (-entry.ccDelta);
    bal.lastUpdated = entry.ts;
    balances.set(entry.userIdHash, bal);
}

export function reserve(userIdHash: string, amount: number): void {
    const bal = balances.get(userIdHash);
    if (!bal || bal.ccTotal < amount) throw new Error('Insufficient balance for hold');
    bal.ccTotal -= amount;
    balances.set(userIdHash, bal);
    holds.set(userIdHash, (holds.get(userIdHash) ?? 0) + amount);
}

export function consumeFromHold(userIdHash: string, amount: number): void {
    const h = holds.get(userIdHash) ?? 0;
    if (h < amount) throw new Error('Insufficient hold');
    holds.set(userIdHash, h - amount);
}

export function refundHold(userIdHash: string, amount: number, ts: number, id: string) {
    const h = holds.get(userIdHash) ?? 0;
    if (amount > h) throw new Error('Refund exceeds hold');
    holds.set(userIdHash, h - amount);
    post({ id, ts, userIdHash, kind: 'REFUND', ccDelta: amount });
}

export function getBalance(userIdHash: string): AccountBalance {
    return balances.get(userIdHash) ?? {
        userIdHash, ccTotal: 0, earnedLifetime: 0, redeemedLifetime: 0, lastUpdated: 0
    };
}

export function entries(): ReadonlyArray<LedgerEntry> { return ledger; }
