/**
 * Consent Token Manager
 * Handles token issuance, validation, and revocation
 */

import type {
    ConsentToken,
    ConsentTokenRequest,
    TaskPermissions,
    ResourceLimits,
    VerifiedInvitation
} from './types.js';
import { CryptoManager } from '../crypto/crypto-manager.js';
import { CreditManager } from './credit-manager.js';

export class ConsentTokenManager {
    private cryptoManager: CryptoManager;
    private creditManager: CreditManager;
    private userTokenCounts: Map<string, number> = new Map();
    private validTokens: Map<string, ConsentToken> = new Map();
    private tokens: Map<string, Set<ConsentToken>> = new Map();
    private revokedTokens: Set<string> = new Set();
    private readonly maxTokensPerUser = 10;

    constructor(cryptoManager: CryptoManager, creditManager: CreditManager) {
        this.cryptoManager = cryptoManager;
        this.creditManager = creditManager;
    }

    /**
     * Issue a new consent token
     */
    async issueConsentToken(
        request: ConsentTokenRequest,
        verifiedInvitations: VerifiedInvitation[]
    ): Promise<ConsentToken | null> {
        // Verify user has a verified invitation
        const hasInvitation = verifiedInvitations.some(
            inv => inv.userId === request.userId && inv.channel === request.verificationChannel
        );

        if (!hasInvitation) {
            console.log(`No verified invitation found for user ${request.userId}`);
            return null;
        }

        // Check token limit per user
        const userTokens = this.tokens.get(request.userId) || new Set();
        const activeTokens = Array.from(userTokens).filter(token =>
            !token.revoked && !this.cryptoManager.isTokenExpired(token)
        );

        if (activeTokens.length >= this.maxTokensPerUser) {
            console.log(`Token limit exceeded for user ${request.userId}`);
            return null;
        }

        // Validate permissions and limits
        if (!this.validateTokenRequest(request)) {
            console.log(`Invalid token request for user ${request.userId}`);
            return null;
        }

        // Create token
        const tokenId = this.cryptoManager.generateTokenId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + request.duration * 60 * 60 * 1000); // hours to ms

        const token: Omit<ConsentToken, 'signature'> = {
            tokenId,
            userId: request.userId,
            permissions: { ...request.requestedPermissions },
            resourceLimits: { ...request.requestedLimits },
            expiresAt,
            issuedAt: now,
            revoked: false
        };

        // Sign the token
        const signedToken = await this.cryptoManager.signConsentToken(token);

        // Store the token
        if (!this.tokens.has(request.userId)) {
            this.tokens.set(request.userId, new Set());
        }
        this.tokens.get(request.userId)!.add(signedToken);

        console.log(`Issued consent token ${tokenId} for user ${request.userId}`);
        return signedToken;
    }

    /**
     * Revoke a consent token
     */
    async revokeConsentToken(userId: string, tokenId: string): Promise<boolean> {
        const userTokens = this.tokens.get(userId);
        if (!userTokens) {
            return false;
        }

        const token = Array.from(userTokens).find(t => t.tokenId === tokenId);
        if (!token) {
            return false;
        }

        // Mark as revoked
        token.revoked = true;
        this.revokedTokens.add(tokenId);

        console.log(`Revoked consent token ${tokenId} for user ${userId}`);
        return true;
    }

    /**
     * Get all active tokens for a user
     */
    getActiveTokens(userId: string): ConsentToken[] {
        const userTokens = this.tokens.get(userId) || new Set();
        return Array.from(userTokens).filter(token =>
            !token.revoked &&
            !this.cryptoManager.isTokenExpired(token) &&
            !this.revokedTokens.has(token.tokenId)
        );
    }

    /**
     * Get all tokens for a user (including expired/revoked)
     */
    getAllTokens(userId: string): ConsentToken[] {
        const userTokens = this.tokens.get(userId) || new Set();
        return Array.from(userTokens);
    }

    /**
     * Validate a token for a specific task
     */
    async validateTokenForTask(
        token: ConsentToken,
        taskType: string,
        requiredResources: ResourceLimits,
        issuerPublicKey: Uint8Array
    ): Promise<boolean> {
        // Check basic token validity
        if (token.revoked || this.revokedTokens.has(token.tokenId)) {
            return false;
        }

        if (this.cryptoManager.isTokenExpired(token)) {
            return false;
        }

        // Verify signature
        const signatureValid = await this.cryptoManager.verifyConsentToken(token, issuerPublicKey);
        if (!signatureValid) {
            return false;
        }

        // Check if user can afford the task
        const estimatedDuration = requiredResources.maxExecutionTimeMs || 60000; // Default 1 minute
        const canAfford = await this.creditManager.canAffordTask(
            token.userId,
            requiredResources,
            estimatedDuration
        );
        if (!canAfford) {
            return false;
        }

        // Check permissions
        if (!this.cryptoManager.hasPermission(token, taskType)) {
            return false;
        }

        // Check resource limits
        if (!this.checkResourceLimits(token.resourceLimits, requiredResources)) {
            return false;
        }

        return true;
    }

    /**
     * Execute task and handle credit billing
     */
    async executeTaskWithBilling(
        token: ConsentToken,
        taskType: string,
        requiredResources: ResourceLimits,
        executionTimeMs: number,
        issuerPublicKey: Uint8Array,
        taskId: string,
        nodeId: string
    ): Promise<{ success: boolean; creditsSpent?: number; reason?: string }> {
        // Validate token first
        const isValid = await this.validateTokenForTask(
            token,
            taskType,
            requiredResources,
            issuerPublicKey
        );

        if (!isValid) {
            return { success: false, reason: 'Token validation failed' };
        }

        // Create consumption records for each resource type
        let totalCreditsSpent = 0;
        const executionTimeSeconds = executionTimeMs / 1000;

        for (const [resourceType, amount] of Object.entries(requiredResources)) {
            const consumption = {
                taskId,
                userId: token.userId,
                nodeId,
                resourceType,
                amountConsumed: amount,
                duration: executionTimeSeconds,
                timestamp: new Date()
            };

            // Charge credits for this resource
            const success = await this.creditManager.spendCredits(consumption);

            if (!success) {
                return { success: false, reason: `Insufficient credits for ${resourceType}` };
            }

            // Add to total credits spent (we'll calculate this from the base rates)
            const baseRate = this.creditManager.getBaseRateForResource(resourceType);
            totalCreditsSpent += amount * executionTimeSeconds * baseRate;
        }

        return { success: true, creditsSpent: totalCreditsSpent };
    }

    /**
     * Check if a user has valid tokens
     */
    hasValidTokens(userId: string): boolean {
        return this.getActiveTokens(userId).length > 0;
    }

    /**
     * Get token statistics
     */
    getTokenStats(): {
        totalUsers: number;
        totalTokens: number;
        activeTokens: number;
        revokedTokens: number;
    } {
        let totalTokens = 0;
        let activeTokens = 0;

        for (const userTokens of this.tokens.values()) {
            totalTokens += userTokens.size;
            activeTokens += Array.from(userTokens).filter(token =>
                !token.revoked &&
                !this.cryptoManager.isTokenExpired(token) &&
                !this.revokedTokens.has(token.tokenId)
            ).length;
        }

        return {
            totalUsers: this.tokens.size,
            totalTokens,
            activeTokens,
            revokedTokens: this.revokedTokens.size
        };
    }

    /**
     * Cleanup expired tokens
     */
    cleanupExpiredTokens(): number {
        let cleanedCount = 0;

        for (const [userId, userTokens] of this.tokens.entries()) {
            const activeTokens = new Set(
                Array.from(userTokens).filter(token => {
                    const isExpired = this.cryptoManager.isTokenExpired(token);
                    if (isExpired) {
                        cleanedCount++;
                    }
                    return !isExpired;
                })
            );

            if (activeTokens.size !== userTokens.size) {
                this.tokens.set(userId, activeTokens);
            }
        }

        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} expired tokens`);
        }

        return cleanedCount;
    }

    /**
     * Validate token request parameters
     */
    private validateTokenRequest(request: ConsentTokenRequest): boolean {
        // Validate permissions
        if (!request.requestedPermissions || Object.keys(request.requestedPermissions).length === 0) {
            return false;
        }

        // Validate resource limits
        if (!request.requestedLimits || Object.keys(request.requestedLimits).length === 0) {
            return false;
        }

        // Check reasonable resource limits
        const { CPU, RAM, Storage, Bandwidth } = request.requestedLimits;
        if (CPU < 0 || CPU > 100 || RAM < 0 || Storage < 0 || Bandwidth < 0) {
            return false;
        }

        // Validate duration (1 hour to 30 days)
        if (request.duration < 1 || request.duration > 24 * 30) {
            return false;
        }

        return true;
    }

    /**
     * Check if token resource limits are sufficient for task requirements
     */
    private checkResourceLimits(tokenLimits: ResourceLimits, required: ResourceLimits): boolean {
        for (const [resource, requiredAmount] of Object.entries(required)) {
            const tokenLimit = tokenLimits[resource];
            if (tokenLimit === undefined || tokenLimit < requiredAmount) {
                return false;
            }
        }
        return true;
    }
}
