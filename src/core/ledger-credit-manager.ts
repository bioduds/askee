/**
 * Ledger-based Credit Manager for Askee System
 * Uses the accounting ledger as the single source of truth for all balances and transactions
 * All amounts are in milli-credits (mCC) internally
 */

import type { CryptoManager } from '../crypto/crypto-manager.js';
import { Ledger } from './ledger.js';
import { LedgerEntry, AccountBalance } from './ledger-types.js';
import { toMilliCredits, fromMilliCredits, ECON_POLICY } from '../utils/credit-policy.js';
import { accountId } from '../utils/account-utils.js';
import type { ResourceContribution, ResourceConsumption, CreditBalance } from './credit-types.js';

export interface CreditReservation {
    userIdHash: string;
    taskId: string;
    reservedMCC: number;
    timestamp: number;
}

export interface CreditUsage {
    resourceType: 'NCU_s' | 'GCU_s' | 'IO_GB';
    amount: number;
    costMCC: number;
}

export class LedgerCreditManager {
    private ledger: Ledger;
    private crypto: CryptoManager;
    private activeReservations: Map<string, CreditReservation> = new Map();

    constructor(crypto: CryptoManager) {
        this.crypto = crypto;
        this.ledger = new Ledger();
    }

    /**
     * Get current balance for a user in credits (converted from mCC)
     */
    async getBalance(userId: string): Promise<{ balance: number; totalSpent: number; totalEarned: number }> {
        const userIdHash = await this.crypto.hashString(userId);
        const accountBalance = this.ledger.getBalance(userIdHash);

        return {
            balance: fromMilliCredits(accountBalance.ccTotal),
            totalSpent: fromMilliCredits(accountBalance.redeemedLifetime),
            totalEarned: fromMilliCredits(accountBalance.earnedLifetime)
        };
    }

    /**
     * Get current balance for a user (legacy synchronous version)
     */
    getBalanceSync(userId: string): { balance: number; totalSpent: number; totalEarned: number } {
        // For synchronous usage - we'll need to use a cached hash or simple hash
        // For now, return a default until we can make this properly async
        return { balance: 0, totalSpent: 0, totalEarned: 0 };
    }    /**
     * Check if user can afford to hold (reserve) a certain amount
     */
    async canAffordToHold(userId: string, credits: number): Promise<boolean> {
        const userIdHash = await this.crypto.hashString(userId);
        const currentBalance = this.ledger.getBalance(userIdHash);
        const requiredMCC = toMilliCredits(credits);

        return currentBalance.ccTotal >= requiredMCC;
    }    /**
     * Award credits to a user (provider earning)
     */
    async awardCredits(userId: string, credits: number, taskId?: string): Promise<void> {
        const userIdHash = await this.crypto.hashString(userId);
        const mccAmount = toMilliCredits(credits);

        const entry: LedgerEntry = {
            id: crypto.randomUUID(),
            ts: Math.floor(Date.now() / 1000),
            userIdHash,
            taskId,
            kind: 'EARN',
            ccDelta: mccAmount
        };

        this.ledger.post(entry);

        console.log(`[CREDIT] Awarded ${credits} credits (${mccAmount} mCC) to user ${userIdHash.slice(0, 8)}...`);
    }

    /**
     * Deduct credits from a user
     */
    async deductCredits(userId: string, credits: number, taskId?: string): Promise<void> {
        const userIdHash = await this.crypto.hashString(userId);
        const mccAmount = toMilliCredits(credits);

        // Check sufficient balance
        const currentBalance = this.ledger.getBalance(userIdHash);
        if (currentBalance.ccTotal < mccAmount) {
            throw new Error(`Insufficient balance: ${fromMilliCredits(currentBalance.ccTotal)} credits available, ${credits} credits requested`);
        }

        const entry: LedgerEntry = {
            id: crypto.randomUUID(),
            ts: Math.floor(Date.now() / 1000),
            userIdHash,
            taskId,
            kind: 'REDEEM',
            ccDelta: -mccAmount
        };

        this.ledger.post(entry);
    }

    /**
     * Reserve credits for a task (step 1 of reserve → redeem → refund flow)
     * This locks credits but doesn't spend them yet
     */
    async reserveCredits(userId: string, maxCredits: number, taskId: string): Promise<CreditReservation> {
        const userIdHash = await this.crypto.hashString(userId);
        const reserveMCC = toMilliCredits(maxCredits);

        // Reserve via the ledger
        try {
            this.ledger.reserve(userIdHash, reserveMCC, taskId);

            const reservation: CreditReservation = {
                userIdHash,
                taskId,
                reservedMCC: reserveMCC,
                timestamp: Date.now()
            };

            this.activeReservations.set(taskId, reservation);

            console.log(`[CREDIT] Reserved ${maxCredits} credits (${reserveMCC} mCC) for task ${taskId}`);
            return reservation;

        } catch (error) {
            console.error(`[CREDIT] Failed to reserve ${maxCredits} credits for task ${taskId}:`, error);
            throw error;
        }
    }

    /**
     * Redeem reserved credits for actual usage (step 2 of reserve → redeem → refund flow)
     * This converts the reservation into actual spending based on resource usage
     */
    async redeemCredits(taskId: string, usage: CreditUsage[]): Promise<number> {
        const reservation = this.activeReservations.get(taskId);
        if (!reservation) {
            throw new Error(`No active reservation found for task ${taskId}`);
        }

        const actualCostMCC = usage.reduce((sum, u) => sum + u.costMCC, 0);
        const actualCostCredits = fromMilliCredits(actualCostMCC);

        if (actualCostMCC > reservation.reservedMCC) {
            throw new Error(`Actual cost ${actualCostCredits} exceeds reserved amount ${fromMilliCredits(reservation.reservedMCC)}`);
        }

        // Post earning entries for providers based on actual usage
        for (const u of usage) {
            const entry: LedgerEntry = {
                id: crypto.randomUUID(),
                ts: Math.floor(Date.now() / 1000),
                userIdHash: reservation.userIdHash, // This would be provider hash in real system
                taskId,
                kind: 'EARN',
                ccDelta: u.costMCC,
                units: { [u.resourceType]: u.amount }
            };

            this.ledger.post(entry);
        }

        // Clean up reservation
        this.activeReservations.delete(taskId);

        console.log(`[CREDIT] Redeemed ${actualCostCredits} credits (${actualCostMCC} mCC) for task ${taskId}`);
        return actualCostCredits;
    }

    /**
     * Refund unused reserved credits (step 3 of reserve → redeem → refund flow)
     * This returns unused credits from a reservation back to the user
     */
    async refundCredits(taskId: string, reason: string = 'Task cancelled'): Promise<number> {
        const reservation = this.activeReservations.get(taskId);
        if (!reservation) {
            throw new Error(`No active reservation found for task ${taskId}`);
        }

        const refundMCC = reservation.reservedMCC;
        const refundCredits = fromMilliCredits(refundMCC);

        // Post refund entry
        const entry: LedgerEntry = {
            id: crypto.randomUUID(),
            ts: Math.floor(Date.now() / 1000),
            userIdHash: reservation.userIdHash,
            taskId,
            kind: 'REFUND',
            ccDelta: refundMCC
        };

        this.ledger.post(entry);

        // Clean up reservation
        this.activeReservations.delete(taskId);

        console.log(`[CREDIT] Refunded ${refundCredits} credits (${refundMCC} mCC) for task ${taskId}: ${reason}`);
        return refundCredits;
    }

    /**
     * Assert that the credit system maintains conservation
     * Total circulation should equal sum of all balances
     */
    assertConservation(): boolean {
        return this.ledger.assertConservation();
    }

    /**
     * Get total credits in circulation
     */
    getTotalCirculation(): number {
        const totalCirculation = fromMilliCredits(this.ledger.getTotalCirculation());
        return totalCirculation;
    }

    /**
     * Get current system statistics
     */
    getSystemStats(): {
        totalCirculation: number;
        activeReservations: number;
        totalUsers: number;
    } {
        const entries = this.ledger.getAllEntries();
        const uniqueUsers = new Set(entries.map(e => e.userIdHash));

        return {
            totalCirculation: this.getTotalCirculation(),
            activeReservations: this.activeReservations.size,
            totalUsers: uniqueUsers.size
        };
    }

    /**
     * Clear all data (for testing)
     */
    clear(): void {
        this.ledger.clear();
        this.activeReservations.clear();
    }

    /**
     * Print conservation status with "Conservation OK" message
     */
    printConservation(): void {
        try {
            this.assertConservation();
            console.log('[CREDIT] Conservation OK ✓');
        } catch (error) {
            console.error('[CREDIT] Conservation FAILED ✗', error);
            throw error;
        }
    }

    // Legacy API Adapters - for backwards compatibility

    /**
     * Initialize user with starting balance (legacy adapter)
     */
    async initializeUser(userId: string): Promise<CreditBalance> {
        const balance = await this.getBalance(userId);

        // If user has no balance, give them starting credits
        if (balance.balance === 0) {
            await this.awardCredits(userId, 100, 'initialization'); // Starting credits
        }

        return {
            userId,
            balance: balance.balance,
            totalEarned: balance.totalEarned,
            totalSpent: balance.totalSpent,
            lastUpdated: new Date()
        };
    }

    /**
     * Earn credits from resource contribution (legacy adapter)
     */
    async earnCredits(contribution: Omit<ResourceContribution, 'creditsEarned'>): Promise<number> {
        // Calculate credits based on resource type, amount, duration, and utilization
        const baseRates: Record<string, number> = {
            CPU: 10,        // 10 credits per CPU core per hour
            RAM: 5,         // 5 credits per GB RAM per hour  
            Storage: 1,     // 1 credit per GB storage per hour
            Bandwidth: 2    // 2 credits per Mbps per hour
        };

        const baseRate = baseRates[contribution.resourceType] || 1;
        const hours = contribution.duration / 3600; // convert seconds to hours
        const utilizationBonus = 1 + (contribution.utilizationRate * 0.5); // Up to 50% bonus

        const creditsEarned = Math.round(
            baseRate * contribution.amountProvided * hours * utilizationBonus
        );

        await this.awardCredits(contribution.userId, creditsEarned, `contribution-${contribution.nodeId}`);

        console.log(`💰 User ${contribution.userId} earned ${creditsEarned} credits for providing ${contribution.resourceType}`);
        return creditsEarned;
    }

    /**
     * Spend credits for resource consumption (legacy adapter)
     */
    async spendCredits(consumption: Omit<ResourceConsumption, 'creditsSpent'>): Promise<boolean> {
        const baseRates: Record<string, number> = {
            CPU: 10,        // 10 credits per CPU core per hour
            RAM: 5,         // 5 credits per GB RAM per hour  
            Storage: 1,     // 1 credit per GB storage per hour
            Bandwidth: 2    // 2 credits per Mbps per hour
        };

        const baseRate = baseRates[consumption.resourceType] || 1;
        const hours = consumption.duration / 3600;
        const creditsRequired = Math.round(baseRate * consumption.amountConsumed * hours);

        try {
            await this.deductCredits(consumption.userId, creditsRequired, consumption.taskId);
            console.log(`💸 User ${consumption.userId} spent ${creditsRequired} credits for consuming ${consumption.resourceType}`);
            return true;
        } catch (error) {
            console.log(`❌ Failed to spend credits for ${consumption.userId}:`, error);
            return false;
        }
    }

    /**
     * Get network statistics (legacy adapter)
     */
    async getNetworkStats(): Promise<{
        totalUsers: number;
        totalCreditsInCirculation: number;
        totalTransactions: number;
        averageBalance: number;
        activeContributors: number;
        averageContributionRate: number;
    }> {
        const stats = this.getSystemStats();
        const avgBalance = stats.totalUsers > 0 ? stats.totalCirculation / stats.totalUsers : 0;
        const totalTransactions = this.ledger.getAllEntries().length;

        // Count contributors (users with EARN entries)
        const entries = this.ledger.getAllEntries();
        const contributors = new Set(entries.filter(e => e.kind === 'EARN').map(e => e.userIdHash));

        // Estimate contribution rate (simple calculation)
        const earnEntries = entries.filter(e => e.kind === 'EARN');
        const totalEarned = earnEntries.reduce((sum, e) => sum + e.ccDelta, 0);
        const avgContributionRate = earnEntries.length > 0 ? fromMilliCredits(totalEarned) / earnEntries.length : 0;

        return {
            totalUsers: stats.totalUsers,
            totalCreditsInCirculation: stats.totalCirculation,
            totalTransactions,
            averageBalance: avgBalance,
            activeContributors: contributors.size,
            averageContributionRate: avgContributionRate
        };
    }

    /**
     * Check if user can afford a task (legacy adapter)
     */
    async canAffordTask(userId: string, estimatedCost: number): Promise<boolean> {
        const balance = await this.getBalance(userId);
        return balance.balance >= estimatedCost + 10; // Include minimum balance buffer
    }

    /**
     * Get base rate for resource type (legacy adapter)
     */
    getBaseRateForResource(resourceType: string): number {
        const baseRates: Record<string, number> = {
            CPU: 10,        // 10 credits per CPU core per hour
            RAM: 5,         // 5 credits per GB RAM per hour  
            Storage: 1,     // 1 credit per GB storage per hour
            Bandwidth: 2    // 2 credits per Mbps per hour
        };
        return baseRates[resourceType] || 1;
    }
}
