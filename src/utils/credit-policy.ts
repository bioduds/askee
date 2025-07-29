/**
 * Credit system policy configuration - all amounts in milli-credits (mCC)
 */

export const ECON_POLICY = {
    minBalance: 0,          // Minimum balance required (in mCC)
    requireHold: true,      // Whether to use credit holds for reservations
    conservationCheck: true // Whether to assert conservation in development
};

/**
 * Convert credits to milli-credits (mCC)
 */
export function toMilliCredits(credits: number): number {
    const mCC = credits * 1000;
    const roundedMCC = Math.round(mCC);

    // Check if the conversion would lose significant precision
    if (Math.abs(mCC - roundedMCC) > 0.001) {
        throw new Error(`Non-integer credit amount not allowed: ${credits} credits would result in ${mCC} mCC`);
    }

    return roundedMCC;
}

/**
 * Convert milli-credits back to credits for display
 */
export function fromMilliCredits(mCC: number): number {
    if (!Number.isInteger(mCC)) {
        throw new Error(`Invalid mCC value: ${mCC} (must be integer)`);
    }
    return mCC / 1000;
}

/**
 * Check if user can afford to hold the specified amount (in credits)
 */
export function canAffordToHold(userId: string, estimateCredits: number, getBalance: (id: string) => any): boolean {
    const balance = getBalance(userId);
    const currentBalanceMCC = typeof balance === 'object' ? (balance.ccTotal || balance.balance * 1000 || 0) : balance * 1000;
    const estimateMCC = toMilliCredits(estimateCredits);
    return (currentBalanceMCC - estimateMCC) >= ECON_POLICY.minBalance;
}

/**
 * Estimate credit cost for a task (returns credits, converts to mCC internally)
 */
export function estimateTaskCost(requirements: {
    CPU: number;
    RAM: number;
    Storage: number;
    Bandwidth: number;
}, durationSeconds: number): number {
    // Base rates per unit per second (low cost for demonstration)
    const rates = {
        CPU: 0.001,      // credits per CPU% per second  
        RAM: 0.00001,    // credits per MB per second (very low)
        Storage: 0.00001, // credits per GB per second
        Bandwidth: 0.0001 // credits per Mbps per second
    };

    const cost = (
        requirements.CPU * rates.CPU +
        requirements.RAM * rates.RAM +
        requirements.Storage * rates.Storage +
        requirements.Bandwidth * rates.Bandwidth
    ) * durationSeconds;

    return Math.ceil(cost);
}
