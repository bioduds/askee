/**
 * Cryptographic utilities for Ed25519 signatures and consent token validation
 */

import * as ed25519 from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { randomBytes } from 'crypto';
import type { ConsentToken, ConsentTokenRequest, VerifiedInvitation } from '../core/types.js';

// Set up SHA-512 for ed25519 at module level
ed25519.etc.sha512Sync = sha512;

export class CryptoManager {
    private readonly keyPair: { privateKey: Uint8Array; publicKey: Uint8Array };

    constructor(privateKey?: Uint8Array) {
        if (privateKey) {
            this.keyPair = {
                privateKey,
                publicKey: ed25519.getPublicKey(privateKey)
            };
        } else {
            // Generate new key pair
            const priv = ed25519.utils.randomPrivateKey();
            this.keyPair = {
                privateKey: priv,
                publicKey: ed25519.getPublicKey(priv)
            };
        }
    }    /**
     * Get the public key for verification
     */
    getPublicKey(): Uint8Array {
        return this.keyPair.publicKey;
    }

    /**
     * Get the public key as hex string
     */
    getPublicKeyHex(): string {
        return Buffer.from(this.keyPair.publicKey).toString('hex');
    }

    /**
     * Sign a consent token
     */
    async signConsentToken(token: Omit<ConsentToken, 'signature'>): Promise<ConsentToken> {
        const tokenData = this.serializeTokenForSigning(token);
        const hash = sha256(tokenData);
        const signature = await ed25519.sign(hash, this.keyPair.privateKey);

        return {
            ...token,
            signature: Buffer.from(signature).toString('hex')
        };
    }

    /**
     * Verify a consent token signature
     */
    async verifyConsentToken(token: ConsentToken, issuerPublicKey: Uint8Array): Promise<boolean> {
        try {
            const { signature, ...tokenWithoutSig } = token;
            const tokenData = this.serializeTokenForSigning(tokenWithoutSig);
            const hash = sha256(tokenData);
            const signatureBytes = Buffer.from(signature, 'hex');

            return await ed25519.verify(signatureBytes, hash, issuerPublicKey);
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }

    /**
     * Sign a verified invitation
     */
    async signVerifiedInvitation(invitation: Omit<VerifiedInvitation, 'signature'>): Promise<VerifiedInvitation> {
        const invitationData = this.serializeInvitationForSigning(invitation);
        const hash = sha256(invitationData);
        const signature = await ed25519.sign(hash, this.keyPair.privateKey);

        return {
            ...invitation,
            signature: Buffer.from(signature).toString('hex')
        };
    }

    /**
     * Verify a verified invitation signature
     */
    async verifyInvitation(invitation: VerifiedInvitation, verifierPublicKey: Uint8Array): Promise<boolean> {
        try {
            const { signature, ...invitationWithoutSig } = invitation;
            const invitationData = this.serializeInvitationForSigning(invitationWithoutSig);
            const hash = sha256(invitationData);
            const signatureBytes = Buffer.from(signature, 'hex');

            return await ed25519.verify(signatureBytes, hash, verifierPublicKey);
        } catch (error) {
            console.error('Invitation verification failed:', error);
            return false;
        }
    }

    /**
     * Generate a cryptographically secure token ID
     */
    generateTokenId(): string {
        const bytes = randomBytes(16);
        return Buffer.from(bytes).toString('hex');
    }

    /**
     * Hash a string using SHA-256
     */
    async hashString(input: string): Promise<string> {
        const hash = sha256(new TextEncoder().encode(input));
        return Buffer.from(hash).toString('hex');
    }

    /**
     * Validate token expiration
     */
    isTokenExpired(token: ConsentToken): boolean {
        return new Date() > token.expiresAt;
    }

    /**
     * Validate token permissions for a specific task type
     */
    hasPermission(token: ConsentToken, taskType: string): boolean {
        return token.permissions[taskType] === true && !token.revoked && !this.isTokenExpired(token);
    }

    /**
     * Serialize token for consistent signing
     */
    private serializeTokenForSigning(token: Omit<ConsentToken, 'signature'>): Uint8Array {
        const serializable = {
            tokenId: token.tokenId,
            userId: token.userId,
            permissions: Object.keys(token.permissions).sort().reduce((sorted, key) => {
                sorted[key] = token.permissions[key];
                return sorted;
            }, {} as Record<string, boolean>),
            resourceLimits: Object.keys(token.resourceLimits).sort().reduce((sorted, key) => {
                sorted[key] = token.resourceLimits[key];
                return sorted;
            }, {} as Record<string, number>),
            expiresAt: token.expiresAt.toISOString(),
            issuedAt: token.issuedAt.toISOString(),
            revoked: token.revoked
        };

        return new TextEncoder().encode(JSON.stringify(serializable));
    }

    /**
     * Serialize invitation for consistent signing
     */
    private serializeInvitationForSigning(invitation: Omit<VerifiedInvitation, 'signature'>): Uint8Array {
        const serializable = {
            userId: invitation.userId,
            channel: invitation.channel,
            verifiedAt: invitation.verifiedAt.toISOString()
        };

        return new TextEncoder().encode(JSON.stringify(serializable));
    }
}

/**
 * Utility functions for key management
 */
export class KeyManager {
    /**
     * Generate a new Ed25519 key pair
     */
    static generateKeyPair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
        const privateKey = ed25519.utils.randomPrivateKey();
        const publicKey = ed25519.getPublicKey(privateKey);
        return { privateKey, publicKey };
    }

    /**
     * Import a private key from hex string
     */
    static importPrivateKey(hexKey: string): Uint8Array {
        return new Uint8Array(Buffer.from(hexKey, 'hex'));
    }

    /**
     * Export a private key to hex string
     */
    static exportPrivateKey(privateKey: Uint8Array): string {
        return Buffer.from(privateKey).toString('hex');
    }

    /**
     * Import a public key from hex string
     */
    static importPublicKey(hexKey: string): Uint8Array {
        return new Uint8Array(Buffer.from(hexKey, 'hex'));
    }

    /**
     * Export a public key to hex string
     */
    static exportPublicKey(publicKey: Uint8Array): string {
        return Buffer.from(publicKey).toString('hex');
    }
}
