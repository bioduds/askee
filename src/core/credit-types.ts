/**
 * Credit System for Askee
 * Manages credits earned by providing resources and spent by consuming resources
 */

export interface CreditTransaction {
    transactionId: string;
    userId: string;
    type: 'earned' | 'spent';
    amount: number;
    reason: string;
    resourceType?: string;
    nodeId?: string;
    taskId?: string;
    timestamp: Date;
    signature: string;
}

export interface CreditBalance {
    userId: string;
    balance: number;
    totalEarned: number;
    totalSpent: number;
    lastUpdated: Date;
}

export interface ResourceContribution {
    nodeId: string;
    userId: string;
    resourceType: string;
    amountProvided: number;
    duration: number; // in seconds
    utilizationRate: number; // 0-1, how much was actually used
    creditsEarned: number;
    timestamp: Date;
}

export interface ResourceConsumption {
    taskId: string;
    userId: string;
    nodeId: string;
    resourceType: string;
    amountConsumed: number;
    duration: number;
    creditsSpent: number;
    timestamp: Date;
}
