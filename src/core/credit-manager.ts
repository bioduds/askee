/**
 * Credit Manager for Askee System
 * Handles the credit economy where users earn credits by sharing resources
 * and spend credits when consuming resources
 */

import type {
    CreditTransaction,
    CreditBalance,
    ResourceContribution,
    ResourceConsumption
} from './credit-types';
import type { ResourceLimits } from './types';
import { CryptoManager } from '../crypto/crypto-manager';

export class CreditManager {
    private readonly cryptoManager: CryptoManager;
    private readonly balances: Map<string, CreditBalance> = new Map();
    private readonly transactions: CreditTransaction[] = [];
    private readonly contributions: ResourceContribution[] = [];
    private readonly consumptions: ResourceConsumption[] = [];

    // Credit rates per resource type per hour
    private readonly baseRates: Record<string, number> = {
        CPU: 10,        // 10 credits per CPU core per hour
        RAM: 5,         // 5 credits per GB RAM per hour  
        Storage: 1,     // 1 credit per GB storage per hour
        Bandwidth: 2    // 2 credits per Mbps per hour
    };

    // Starting balance for new users
    private readonly startingCredits = 100;

    // Minimum balance to consume resources (prevents abuse)
    private readonly minimumBalance = 10;

    constructor(cryptoManager: CryptoManager) {
        this.cryptoManager = cryptoManager;
    }

    /**
     * Initialize a new user with starting credits
     */
    async initializeUser(userId: string): Promise<CreditBalance> {
        if (this.balances.has(userId)) {
            return this.balances.get(userId)!;
        }

        const balance: CreditBalance = {
            userId,
            balance: this.startingCredits,
            totalEarned: this.startingCredits,
            totalSpent: 0,
            lastUpdated: new Date()
        };

        this.balances.set(userId, balance);

        // Record the initial credit transaction
        const transactionWithoutSig: Omit<CreditTransaction, 'signature'> = {
            transactionId: this.cryptoManager.generateTokenId(),
            userId,
            type: 'earned',
            amount: this.startingCredits,
            reason: 'Initial account setup',
            timestamp: new Date()
        };
        await this.recordTransaction(transactionWithoutSig);

        console.log(`🎁 Initialized user ${userId} with ${this.startingCredits} credits`);
        return balance;
    }

    /**
     * Record credits earned for providing resources
     */
    async earnCredits(contribution: Omit<ResourceContribution, 'creditsEarned'>): Promise<number> {
        // Calculate credits based on resource type, amount, duration, and utilization
        const baseRate = this.baseRates[contribution.resourceType] || 1;
        const hours = contribution.duration / 3600; // convert seconds to hours
        const utilizationBonus = 1 + (contribution.utilizationRate * 0.5); // Up to 50% bonus for high utilization

        const creditsEarned = Math.round(
            baseRate * contribution.amountProvided * hours * utilizationBonus
        );

        // Record the contribution
        const fullContribution: ResourceContribution = {
            ...contribution,
            creditsEarned
        };
        this.contributions.push(fullContribution);

        // Update user balance
        await this.addCredits(contribution.userId, creditsEarned,
            `Resource contribution: ${contribution.amountProvided} ${contribution.resourceType} for ${Math.round(hours * 100) / 100}h`,
            contribution.nodeId
        );

        console.log(`💰 User ${contribution.userId} earned ${creditsEarned} credits for providing ${contribution.resourceType}`);
        return creditsEarned;
    }

    /**
     * Spend credits for consuming resources
     */
    async spendCredits(consumption: Omit<ResourceConsumption, 'creditsSpent'>): Promise<boolean> {
        // Calculate credit cost
        const baseRate = this.baseRates[consumption.resourceType] || 1;
        const hours = consumption.duration / 3600;
        const creditsRequired = Math.round(baseRate * consumption.amountConsumed * hours);

        // Check if user has sufficient balance
        const balance = this.getBalance(consumption.userId);
        if (balance.balance < creditsRequired) {
            console.log(`❌ Insufficient credits for ${consumption.userId}: needs ${creditsRequired}, has ${balance.balance}`);
            return false;
        }

        // Check minimum balance after spending
        if (balance.balance - creditsRequired < this.minimumBalance) {
            console.log(`❌ Would go below minimum balance for ${consumption.userId}`);
            return false;
        }

        // Record the consumption
        const fullConsumption: ResourceConsumption = {
            ...consumption,
            creditsSpent: creditsRequired
        };
        this.consumptions.push(fullConsumption);

        // Deduct credits
        await this.deductCredits(consumption.userId, creditsRequired,
            `Resource consumption: ${consumption.amountConsumed} ${consumption.resourceType} for ${Math.round(hours * 100) / 100}h`,
            consumption.taskId
        );

        console.log(`💸 User ${consumption.userId} spent ${creditsRequired} credits for consuming ${consumption.resourceType}`);
        return true;
    }

    /**
     * Check if user can afford a task
     */
    canAffordTask(userId: string, requiredResources: ResourceLimits, durationHours: number): {
        canAfford: boolean;
        estimatedCost: number;
        currentBalance: number;
    } {
        let estimatedCost = 0;

        for (const [resourceType, amount] of Object.entries(requiredResources)) {
            const rate = this.baseRates[resourceType] || 1;
            estimatedCost += rate * amount * durationHours;
        }

        const balance = this.getBalance(userId);
        const canAfford = balance.balance >= estimatedCost + this.minimumBalance;

        return {
            canAfford,
            estimatedCost: Math.round(estimatedCost),
            currentBalance: balance.balance
        };
    }

    /**
     * Get user's credit balance
     */
    getBalance(userId: string): CreditBalance {
        const balance = this.balances.get(userId);
        if (!balance) {
            // Return zero balance for unknown users
            return {
                userId,
                balance: 0,
                totalEarned: 0,
                totalSpent: 0,
                lastUpdated: new Date()
            };
        }
        return { ...balance };
    }

    /**
     * Get user's transaction history
     */
    getTransactionHistory(userId: string, limit?: number): CreditTransaction[] {
        const userTransactions = this.transactions
            .filter(tx => tx.userId === userId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return limit ? userTransactions.slice(0, limit) : userTransactions;
    }

    /**
     * Get user's contribution history
     */
    getContributionHistory(userId: string, limit?: number): ResourceContribution[] {
        const userContributions = this.contributions
            .filter(contrib => contrib.userId === userId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return limit ? userContributions.slice(0, limit) : userContributions;
    }

    /**
     * Get system-wide credit statistics
     */
    getSystemStats(): {
        totalUsers: number;
        totalCreditsInCirculation: number;
        totalTransactions: number;
        averageBalance: number;
        topContributors: { userId: string; totalEarned: number }[];
    } {
        const balances = Array.from(this.balances.values());
        const totalCreditsInCirculation = balances.reduce((sum, balance) => sum + balance.balance, 0);
        const averageBalance = balances.length > 0 ? totalCreditsInCirculation / balances.length : 0;

        const topContributors = balances
            .sort((a, b) => b.totalEarned - a.totalEarned)
            .slice(0, 5)
            .map(balance => ({
                userId: balance.userId,
                totalEarned: balance.totalEarned
            }));

        return {
            totalUsers: balances.length,
            totalCreditsInCirculation: Math.round(totalCreditsInCirculation),
            totalTransactions: this.transactions.length,
            averageBalance: Math.round(averageBalance),
            topContributors
        };
    }

    /**
     * Get base rate for a specific resource type
     */
    getBaseRateForResource(resourceType: string): number {
        return this.baseRates[resourceType] || 0.01; // Default rate if not found
    }

    /**
     * Get network-wide statistics about the credit economy
     */
    async getNetworkStats(): Promise<{
        totalCreditsInCirculation: number;
        totalTransactions: number;
        activeContributors: number;
        averageContributionRate: number;
    }> {
        const totalCredits = Array.from(this.balances.values())
            .reduce((sum, balance) => sum + balance.balance, 0);

        const totalTransactions = this.transactions.length;

        const uniqueContributors = new Set(
            this.contributions.map(c => c.userId)
        ).size;

        const totalContributionHours = this.contributions.reduce(
            (sum, c) => sum + (c.duration / 3600), 0
        );
        const totalCreditsEarned = this.contributions.reduce(
            (sum, c) => sum + c.creditsEarned, 0
        );
        const averageRate = totalContributionHours > 0 ?
            totalCreditsEarned / totalContributionHours : 0;

        return {
            totalCreditsInCirculation: totalCredits,
            totalTransactions,
            activeContributors: uniqueContributors,
            averageContributionRate: averageRate
        };
    }    /**
     * Calculate daily rewards for consistent contributors
     */
    async distributeDailyRewards(): Promise<void> {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // Find users who contributed yesterday
        const yesterdayContributions = this.contributions.filter(
            contrib => contrib.timestamp >= yesterday
        );

        const userContributions = new Map<string, number>();
        yesterdayContributions.forEach(contrib => {
            const current = userContributions.get(contrib.userId) || 0;
            userContributions.set(contrib.userId, current + contrib.creditsEarned);
        });

        // Give bonus for consistent contributors
        for (const [userId, earnedYesterday] of userContributions.entries()) {
            if (earnedYesterday >= 50) { // Threshold for daily bonus
                const bonus = Math.min(25, Math.round(earnedYesterday * 0.1)); // 10% bonus, max 25 credits
                await this.addCredits(userId, bonus, 'Daily consistency bonus');
                console.log(`🏆 Daily bonus of ${bonus} credits awarded to ${userId}`);
            }
        }
    }

    /**
     * Transfer credits between users (for future marketplace features)
     */
    async transferCredits(fromUserId: string, toUserId: string, amount: number, reason: string): Promise<boolean> {
        const fromBalance = this.getBalance(fromUserId);

        if (fromBalance.balance < amount + this.minimumBalance) {
            console.log(`❌ Insufficient balance for transfer from ${fromUserId}`);
            return false;
        }

        await this.deductCredits(fromUserId, amount, `Transfer to ${toUserId}: ${reason}`);
        await this.addCredits(toUserId, amount, `Transfer from ${fromUserId}: ${reason}`);

        console.log(`💸 Transferred ${amount} credits from ${fromUserId} to ${toUserId}`);
        return true;
    }

    /**
     * Add credits to a user's balance
     */
    private async addCredits(userId: string, amount: number, reason: string, nodeId?: string): Promise<void> {
        const balance = this.balances.get(userId) || await this.initializeUser(userId);

        balance.balance += amount;
        balance.totalEarned += amount;
        balance.lastUpdated = new Date();

        this.balances.set(userId, balance);

        const transactionWithoutSig: Omit<CreditTransaction, 'signature'> = {
            transactionId: this.cryptoManager.generateTokenId(),
            userId,
            type: 'earned',
            amount,
            reason,
            nodeId,
            timestamp: new Date()
        };
        await this.recordTransaction(transactionWithoutSig);
    }

    /**
     * Deduct credits from a user's balance
     */
    private async deductCredits(userId: string, amount: number, reason: string, taskId?: string): Promise<void> {
        const balance = this.balances.get(userId);
        if (!balance) {
            throw new Error(`User ${userId} not found`);
        }

        balance.balance -= amount;
        balance.totalSpent += amount;
        balance.lastUpdated = new Date();

        this.balances.set(userId, balance);

        const transactionWithoutSig: Omit<CreditTransaction, 'signature'> = {
            transactionId: this.cryptoManager.generateTokenId(),
            userId,
            type: 'spent',
            amount,
            reason,
            taskId,
            timestamp: new Date()
        };
        await this.recordTransaction(transactionWithoutSig);
    }

    /**
     * Record a credit transaction with cryptographic signature
     */
    private async recordTransaction(transaction: Omit<CreditTransaction, 'signature'>): Promise<void> {
        // Create signature for transaction integrity
        const transactionData = JSON.stringify({
            transactionId: transaction.transactionId,
            userId: transaction.userId,
            type: transaction.type,
            amount: transaction.amount,
            timestamp: transaction.timestamp.toISOString()
        });

        // In a real implementation, this would be signed by the system's private key
        // For now, we'll create a simple hash
        const signature = Buffer.from(transactionData).toString('base64');

        const signedTransaction: CreditTransaction = {
            ...transaction,
            signature
        };

        this.transactions.push(signedTransaction);
    }
}
