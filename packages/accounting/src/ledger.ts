import { LedgerEntry, AccountBalance } from './types';

const ledger: LedgerEntry[] = [];
const balances = new Map<string, AccountBalance>();
const holds = new Map<string, number>();

export function post(entry: LedgerEntry): void {
    if (!Number.isFinite(entry.ccDelta)) throw new Error('Invalid ccDelta');
    if (!Number.isInteger(entry.ccDelta)) throw new Error('ccDelta must be integer mCC');

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
    if (!Number.isInteger(amount)) throw new Error('Amount must be integer mCC');

    const bal = balances.get(userIdHash);
    if (!bal || bal.ccTotal < amount) throw new Error('Insufficient balance for hold');
    bal.ccTotal -= amount;
    balances.set(userIdHash, bal);
    holds.set(userIdHash, (holds.get(userIdHash) ?? 0) + amount);
}

export function consumeFromHold(userIdHash: string, amount: number): void {
    if (!Number.isInteger(amount)) throw new Error('Amount must be integer mCC');

    const h = holds.get(userIdHash) ?? 0;
    if (h < amount) throw new Error('Insufficient hold');
    holds.set(userIdHash, h - amount);
}

export function refundHold(userIdHash: string, amount: number, ts: number, id: string) {
    if (!Number.isInteger(amount)) throw new Error('Amount must be integer mCC');

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

export function getTotalCirculation(): number {
    let total = 0;
    for (const balance of balances.values()) {
        total += balance.ccTotal;
    }
    // Add held amounts
    for (const hold of holds.values()) {
        total += hold;
    }
    return total;
}

export function assertConservation(): void {
    // Conservation check: total in ledger should equal sum of all EARN entries minus sum of all REDEEM entries
    let earnTotal = 0;
    let redeemTotal = 0;

    for (const entry of ledger) {
        if (entry.kind === 'EARN' || entry.kind === 'REFUND') {
            earnTotal += entry.ccDelta;
        } else if (entry.kind === 'REDEEM' || entry.kind === 'SLASH') {
            redeemTotal += Math.abs(entry.ccDelta);
        }
    }

    const expectedTotal = earnTotal - redeemTotal;
    const actualTotal = getTotalCirculation();

    if (Math.abs(expectedTotal - actualTotal) > 1) { // Allow 1 mCC tolerance for rounding
        throw new Error(`Conservation violation: expected ${expectedTotal} mCC, actual ${actualTotal} mCC`);
    }
}

export function entries(): ReadonlyArray<LedgerEntry> {
    return ledger;
}
