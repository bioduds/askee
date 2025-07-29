/**
 * Askee - Benevolent Spider Distributed Agent System
 * Main entry point demonstrating the core functionality
 */

import { CryptoManager } from './crypto/crypto-manager.js';
import { DiscoveryManager } from './discovery/discovery-manager.js';
import { ConsentTokenManager } from './core/consent-token-manager.js';
import { CreditManager } from './core/credit-manager.js';
import type { ConsentTokenRequest, TaskPermissions, ResourceLimits } from './core/types.js';

class AskeeSystem {
    private readonly cryptoManager: CryptoManager;
    private readonly discoveryManager: DiscoveryManager;
    private readonly creditManager: CreditManager;
    private readonly consentTokenManager: ConsentTokenManager;

    constructor() {
        // Initialize core components
        this.cryptoManager = new CryptoManager();
        this.creditManager = new CreditManager(this.cryptoManager);
        this.discoveryManager = new DiscoveryManager(this.cryptoManager, {
            domain: 'askee.local',
            wellKnownEndpoint: 'https://askee.local/.well-known/askee',
        });
        this.consentTokenManager = new ConsentTokenManager(this.cryptoManager, this.creditManager);

        console.log('🕷️  Askee System Initialized');
        console.log(`Public Key: ${this.cryptoManager.getPublicKeyHex()}`);
    }

    /**
     * Demonstrate the complete workflow: Discovery -> Verification -> Token Issuance
     */
    async demonstrateWorkflow(): Promise<void> {
        console.log('\n🚀 Starting Askee Workflow Demonstration\n');

        // Step 1: User publishes discovery signal
        const userId = 'user123.js';
        console.log(`📡 Step 1: Publishing discovery signal for ${userId}`);
        await this.discoveryManager.publishDiscoverySignal(userId, 'DNS');

        // Step 2: System verifies the discovery signal
        console.log(`✅ Step 2: Verifying discovery signal for ${userId}`);
        const verifiedInvitation = await this.discoveryManager.verifyDiscoverySignal(userId, 'DNS');

        if (!verifiedInvitation) {
            console.log('❌ Failed to verify discovery signal');
            return;
        }

        console.log(`✅ Verified invitation created for ${userId}`);

        // Step 3: User requests consent token
        console.log(`🎫 Step 3: Requesting consent token for ${userId}`);

        const permissions: TaskPermissions = {
            ml_training: true,
            data_processing: true,
            scientific_compute: false
        };

        const resourceLimits: ResourceLimits = {
            CPU: 50,    // 50% CPU
            RAM: 2048,  // 2GB RAM
            Storage: 10, // 10GB Storage
            Bandwidth: 100 // 100 Mbps
        };

        const tokenRequest: ConsentTokenRequest = {
            userId,
            requestedPermissions: permissions,
            requestedLimits: resourceLimits,
            duration: 24, // 24 hours
            verificationChannel: 'DNS'
        };

        const consentToken = await this.consentTokenManager.issueConsentToken(
            tokenRequest,
            [verifiedInvitation]
        );

        if (!consentToken) {
            console.log('❌ Failed to issue consent token');
            return;
        }

        console.log(`✅ Consent token issued: ${consentToken.tokenId}`);

        // Step 4: Validate the token
        console.log(`🔍 Step 4: Validating consent token`);

        const taskRequirements: ResourceLimits = {
            CPU: 25,    // Task needs 25% CPU
            RAM: 1024,  // Task needs 1GB RAM
            Storage: 5, // Task needs 5GB Storage
            Bandwidth: 50 // Task needs 50 Mbps
        };

        const isValid = await this.consentTokenManager.validateTokenForTask(
            consentToken,
            'ml_training',
            taskRequirements,
            this.cryptoManager.getPublicKey()
        );

        console.log(`Token validation result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);

        // Step 5: Display system stats
        console.log(`📊 Step 5: System Statistics`);
        const stats = this.consentTokenManager.getTokenStats();
        console.log(`- Total users: ${stats.totalUsers}`);
        console.log(`- Active tokens: ${stats.activeTokens}`);
        console.log(`- Total tokens: ${stats.totalTokens}`);

        console.log('\n🎉 Workflow demonstration completed successfully!');
    }

    /**
     * Demonstrate multi-user scenario
     */
    async demonstrateMultiUser(): Promise<void> {
        console.log('\n👥 Multi-User Scenario Demonstration\n');

        const users = ['alice', 'bob', 'charlie'];
        const verifiedInvitations = [];

        // Verify multiple users
        for (const userId of users) {
            await this.discoveryManager.publishDiscoverySignal(userId, 'WebKnown');
            const invitation = await this.discoveryManager.verifyDiscoverySignal(userId, 'WebKnown');
            if (invitation) {
                verifiedInvitations.push(invitation);
                console.log(`✅ Verified ${userId}`);
            }
        }

        // Issue tokens with different permissions
        for (let i = 0; i < users.length; i++) {
            const userId = users[i];
            const permissions: TaskPermissions = {
                ml_training: i < 2, // alice and bob can do ML training
                data_processing: true, // everyone can do data processing
                scientific_compute: i === 2 // only charlie can do scientific compute
            };

            const tokenRequest: ConsentTokenRequest = {
                userId,
                requestedPermissions: permissions,
                requestedLimits: {
                    CPU: 30 + i * 10, // 30%, 40%, 50%
                    RAM: 1024 * (i + 1), // 1GB, 2GB, 3GB
                    Storage: 5 * (i + 1), // 5GB, 10GB, 15GB
                    Bandwidth: 50 * (i + 1) // 50, 100, 150 Mbps
                },
                duration: 12 + i * 6, // 12h, 18h, 24h
                verificationChannel: 'WebKnown'
            };

            const token = await this.consentTokenManager.issueConsentToken(
                tokenRequest,
                verifiedInvitations
            );

            if (token) {
                console.log(`🎫 Issued token for ${userId}: ${token.tokenId}`);
            }
        }

        // Show final stats
        const finalStats = this.consentTokenManager.getTokenStats();
        console.log(`\n📊 Final Statistics:`);
        console.log(`- Total users: ${finalStats.totalUsers}`);
        console.log(`- Active tokens: ${finalStats.activeTokens}`);

        console.log('\n✅ Multi-user demonstration completed!');
    }

    /**
     * Demonstrate the complete credit economy workflow
     */
    async demonstrateCreditEconomy(): Promise<void> {
        console.log('\n💰 Credit Economy Demonstration\n');

        // Setup two users: Alice (provider) and Bob (consumer)
        const alice = 'alice_provider.js';
        const bob = 'bob_consumer.js';

        console.log(`📊 Initial Credit Balances:`);
        console.log(`- Alice: ${await this.creditManager.getBalance(alice)} credits`);
        console.log(`- Bob: ${await this.creditManager.getBalance(bob)} credits`);

        // Alice contributes resources and earns credits
        console.log(`\n🏗️  Alice contributes resources...`);
        const contribution = {
            nodeId: 'alice_node_1',
            userId: alice,
            resourceType: 'CPU',
            amountProvided: 4, // 4 CPU cores
            duration: 3600, // 1 hour
            utilizationRate: 0.75, // 75% utilized
            timestamp: new Date()
        };

        const creditsEarned = await this.creditManager.earnCredits(contribution);
        console.log(`✅ Alice earned ${creditsEarned} credits for providing CPU resources`);

        // Check Alice's new balance
        const aliceBalance = await this.creditManager.getBalance(alice);
        console.log(`📈 Alice's new balance: ${aliceBalance} credits`);

        // Bob needs to run a task but doesn't have enough credits
        console.log(`\n🔍 Bob wants to run a computational task...`);
        const taskRequirements = {
            CPU: 50,     // 50% CPU
            RAM: 2048,   // 2GB RAM
            Storage: 10, // 10GB
            Bandwidth: 100 // 100 Mbps
        };

        const taskDuration = 1800; // 30 minutes
        const canBobAfford = await this.creditManager.canAffordTask(bob, taskRequirements, taskDuration);
        console.log(`💳 Can Bob afford the task? ${canBobAfford ? 'Yes' : 'No'}`);

        if (!canBobAfford) {
            console.log(`❌ Bob needs to earn more credits first!`);

            // Bob contributes some resources to earn credits
            console.log(`\n🔧 Bob contributes storage resources...`);
            const bobContribution = {
                nodeId: 'bob_node_1',
                userId: bob,
                resourceType: 'Storage',
                amountProvided: 100, // 100GB storage
                duration: 7200, // 2 hours
                utilizationRate: 0.5, // 50% utilized
                timestamp: new Date()
            };

            const bobCreditsEarned = await this.creditManager.earnCredits(bobContribution);
            console.log(`✅ Bob earned ${bobCreditsEarned} credits for providing storage`);
        }

        // Check if Bob can now afford the task
        const bobBalance = await this.creditManager.getBalance(bob);
        console.log(`📊 Bob's balance: ${bobBalance} credits`);

        const canAffordNow = await this.creditManager.canAffordTask(bob, taskRequirements, taskDuration);
        console.log(`💳 Can Bob afford the task now? ${canAffordNow ? 'Yes' : 'No'}`);

        if (canAffordNow) {
            // Bob executes the task
            console.log(`\n⚡ Bob executes his computational task...`);
            const consumption = {
                taskId: 'task_ml_training_001',
                userId: bob,
                nodeId: 'alice_node_1', // Running on Alice's node
                resourceType: 'CPU',
                amountConsumed: 2, // 2 CPU cores
                duration: taskDuration / 1000, // Convert to seconds
                timestamp: new Date()
            };

            const success = await this.creditManager.spendCredits(consumption);
            console.log(`${success ? '✅' : '❌'} Task execution ${success ? 'succeeded' : 'failed'}`);

            if (success) {
                // Alice gets credits for hosting the task
                const hostingContribution = {
                    nodeId: 'alice_node_1',
                    userId: alice,
                    resourceType: 'CPU',
                    amountProvided: 2,
                    duration: taskDuration / 1000,
                    utilizationRate: 1.0, // Fully utilized
                    timestamp: new Date()
                };

                const aliceHostingCredits = await this.creditManager.earnCredits(hostingContribution);
                console.log(`💰 Alice earned ${aliceHostingCredits} additional credits for hosting the task`);
            }
        }

        // Final balances
        console.log(`\n📊 Final Credit Balances:`);
        const finalAliceBalance = await this.creditManager.getBalance(alice);
        const finalBobBalance = await this.creditManager.getBalance(bob);
        console.log(`- Alice: ${finalAliceBalance} credits`);
        console.log(`- Bob: ${finalBobBalance} credits`);

        // Show network statistics
        console.log(`\n📈 Network Economy Statistics:`);
        const stats = await this.creditManager.getNetworkStats();
        console.log(`- Total credits in circulation: ${stats.totalCreditsInCirculation}`);
        console.log(`- Total transactions: ${stats.totalTransactions}`);
        console.log(`- Active contributors: ${stats.activeContributors}`);
        console.log(`- Average contribution rate: ${stats.averageContributionRate.toFixed(2)} credits/hour`);

        console.log('\n🎉 Credit economy demonstration completed successfully!');
    }

    /**
     * Get system status
     */
    getSystemStatus(): {
        publicKey: string;
        tokenStats: any;
        verifiedUsers: number;
    } {
        return {
            publicKey: this.cryptoManager.getPublicKeyHex(),
            tokenStats: this.consentTokenManager.getTokenStats(),
            verifiedUsers: 0 // Would count from discovery manager in full implementation
        };
    }
}

// Main execution
async function main(): Promise<void> {
    try {
        const askee = new AskeeSystem();

        // Run workflow demonstration
        await askee.demonstrateWorkflow();

        // Run multi-user demonstration
        await askee.demonstrateMultiUser();

        // Run credit economy demonstration
        await askee.demonstrateCreditEconomy();

        // Show final system status
        console.log('\n🔍 Final System Status:');
        console.log(JSON.stringify(askee.getSystemStatus(), null, 2));

    } catch (error) {
        console.error('❌ Error during execution:', error);
        process.exit(1);
    }
}

// Export for use as a module
export { AskeeSystem };

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
