/**
 * Core ledger implementation with milli-credit enforcement
 * Copy of packages/accounting/src/ledger.ts for src directory
 */

import { LedgerEntry, EntryKind, AccountBalance } from './ledger-types';

export class Ledger {
    private entries: LedgerEntry[] = [];
    private cachedBalances: Map<string, AccountBalance> = new Map();

    /**
     * Post a new entry to the ledger with strict mCC validation
     */
    post(entry: LedgerEntry): void {
        // Enforce integer mCC amounts
        if (!Number.isInteger(entry.ccDelta)) {
            throw new Error(`Non-integer credit amount not allowed: ${entry.ccDelta} mCC`);
        }

        this.entries.push({ ...entry });
        this.invalidateCache(entry.userIdHash);
        console.log(`[LEDGER] Posted ${entry.kind} ${entry.ccDelta > 0 ? '+' : ''}${entry.ccDelta} mCC for user ${entry.userIdHash.slice(0, 8)}...`);
    }

    /**
     * Reserve credits by posting a negative REDEEM entry
     */
    reserve(userIdHash: string, ccAmount: number, taskId: string): void {
        if (!Number.isInteger(ccAmount)) {
            throw new Error(`Non-integer credit amount not allowed: ${ccAmount} mCC`);
        }
        if (ccAmount <= 0) {
            throw new Error('Reserve amount must be positive');
        }

        const balance = this.getBalance(userIdHash);
        if (balance.ccTotal < ccAmount) {
            throw new Error(`Insufficient balance: ${balance.ccTotal} mCC available, ${ccAmount} mCC requested`);
        }

        this.post({
            id: crypto.randomUUID(),
            ts: Math.floor(Date.now() / 1000),
            userIdHash,
            taskId,
            kind: 'REDEEM',
            ccDelta: -ccAmount
        });
    }

    /**
     * Get all entries for a user
     */
    getEntriesForUser(userIdHash: string): LedgerEntry[] {
        return this.entries.filter(e => e.userIdHash === userIdHash);
    }

    /**
     * Get current balance for a user
     */
    getBalance(userIdHash: string): AccountBalance {
        if (this.cachedBalances.has(userIdHash)) {
            return this.cachedBalances.get(userIdHash)!;
        }

        const userEntries = this.getEntriesForUser(userIdHash);
        let ccTotal = 0;
        let earnedLifetime = 0;
        let redeemedLifetime = 0;
        let lastUpdated = 0;

        for (const entry of userEntries) {
            ccTotal += entry.ccDelta;
            lastUpdated = Math.max(lastUpdated, entry.ts);

            if (entry.kind === 'EARN' || entry.kind === 'REFUND') {
                earnedLifetime += Math.abs(entry.ccDelta);
            } else if (entry.kind === 'REDEEM' || entry.kind === 'SLASH') {
                redeemedLifetime += Math.abs(entry.ccDelta);
            }
        }

        const balance: AccountBalance = {
            userIdHash,
            ccTotal,
            earnedLifetime,
            redeemedLifetime,
            lastUpdated
        };

        this.cachedBalances.set(userIdHash, balance);
        return balance;
    }

    /**
     * Get total credits in circulation
     */
    getTotalCirculation(): number {
        return this.entries.reduce((sum, entry) => sum + entry.ccDelta, 0);
    }

    /**
     * Verify conservation: total circulation should equal sum of all balances
     */
    assertConservation(): boolean {
        const totalCirculation = this.getTotalCirculation();

        // Get unique users
        const userHashes = new Set(this.entries.map(e => e.userIdHash));
        const totalBalances = Array.from(userHashes)
            .map(hash => this.getBalance(hash).ccTotal)
            .reduce((sum, balance) => sum + balance, 0);

        const isConserved = totalCirculation === totalBalances;

        if (!isConserved) {
            console.error(`[LEDGER] CONSERVATION VIOLATION: circulation=${totalCirculation}, balances=${totalBalances}`);
            throw new Error(`Conservation violation: circulation=${totalCirculation} ≠ balances=${totalBalances}`);
        }

        return true;
    }

    /**
     * Get all entries (for debugging)
     */
    getAllEntries(): LedgerEntry[] {
        return [...this.entries];
    }

    /**
     * Clear all entries (for testing)
     */
    clear(): void {
        this.entries = [];
        this.cachedBalances.clear();
    }

    private invalidateCache(userIdHash: string): void {
        this.cachedBalances.delete(userIdHash);
    }
}
