/**
 * Account utilities for canonical IDs and balance formatting
 */

import { fromMilliCredits } from './credit-policy';

/**
 * Canonicalize account IDs - removes file extensions and descriptors
 */
export function accountId(userLike: string): string {
    // Turn "bob_consumer.js" -> "bob", "alice_provider.js" -> "alice"
    return userLike.trim().toLowerCase().replace(/[_\-\.].*$/, '');
}

/**
 * Assert canonical account ID format
 */
export function assertCanonical(userId: string): void {
    if (userId.includes('') || userId.includes('_')) {
        throw new Error(`Non-canonical userId: ${userId}. Use accountId() to normalize.`);
    }
}

/**
 * Log balance in a readable format, handling both mCC ledger format and legacy formats
 */
export function logBalance(label: string, userId: string, balance: any): void {
    if (typeof balance === 'object' && balance !== null) {
        if ('ccTotal' in balance) {
            // New ledger format with milli-credits
            const credits = fromMilliCredits(balance.ccTotal);
            const earned = fromMilliCredits(balance.earnedLifetime || 0);
            const spent = fromMilliCredits(balance.redeemedLifetime || 0);
            console.log(`- ${label}: ${credits} credits (earned=${earned}, spent=${spent})`);
        } else if ('balance' in balance) {
            // Legacy format
            const earned = balance.totalEarned || 0;
            const spent = balance.totalSpent || 0;
            console.log(`- ${label}: ${balance.balance} credits (earned=${earned}, spent=${spent})`);
        } else {
            console.log(`- ${label}: ${JSON.stringify(balance)}`);
        }
    } else {
        console.log(`- ${label}: ${balance || 0} credits`);
    }
}
