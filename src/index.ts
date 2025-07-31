/**
 * Askee - Benevolent Spider Distributed Agent System
 * Main entry point demonstrating the core functionality
 */

import { CryptoManager } from './crypto/crypto-manager';
import { DiscoveryManager } from './discovery/discovery-manager';
import { ConsentTokenManager } from './core/consent-token-manager';
import { LedgerCreditManager } from './core/ledger-credit-manager';
import { SeedManager } from './network/seed-manager';
import { AskeeProtocolManager } from './protocol/askee-protocol-manager';
import { accountId, assertCanonical, logBalance } from './utils/account-utils';
import { canAffordToHold, estimateTaskCost } from './utils/credit-policy';
import type { ConsentTokenRequest, TaskPermissions, ResourceLimits, VerifiedInvitation } from './core/types';
import type { AskeeWorkloadRequest } from './protocol/askee-protocol-types';

class AskeeSystem {
    private readonly cryptoManager: CryptoManager;
    private readonly discoveryManager: DiscoveryManager;
    private readonly creditManager: LedgerCreditManager;
    private readonly consentTokenManager: ConsentTokenManager;
    private readonly seedManager: SeedManager;
    private readonly protocolManager: AskeeProtocolManager;
    private readonly verifiedInvitations: VerifiedInvitation[] = [];

    constructor() {
        // Initialize core components
        this.cryptoManager = new CryptoManager();
        this.creditManager = new LedgerCreditManager(this.cryptoManager);
        this.discoveryManager = new DiscoveryManager(this.cryptoManager, {
            domain: 'askee.local',
            wellKnownEndpoint: 'https://askee.local/.well-known/askee',
        });
        this.consentTokenManager = new ConsentTokenManager(this.cryptoManager, this.creditManager as any);
        this.seedManager = new SeedManager(this.cryptoManager, this.discoveryManager, this.creditManager as any);
        this.protocolManager = new AskeeProtocolManager(this.cryptoManager, this.consentTokenManager, this.creditManager as any);

        console.log('🕷️  Askee System Initialized');
        console.log(`Public Key: ${this.cryptoManager.getPublicKeyHex()}`);
    }

    /**
     * Demonstrate the complete workflow: Discovery -> Verification -> Token Issuance
     */
    async demonstrateWorkflow(): Promise<void> {
        console.log('\n🚀 Starting Askee Workflow Demonstration\n');

        // Step 1: User publishes discovery signal
        const userId = 'user123';
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

        // Add to verified invitations store
        this.verifiedInvitations.push(verifiedInvitation);

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
        this.creditManager.printConservation();
    }

    /**
     * Demonstrate multi-user scenario
     */
    async demonstrateMultiUser(): Promise<void> {
        console.log('\n👥 Multi-User Scenario Demonstration\n');

        const users = ['alice', 'bob', 'charlie'];

        // Verify multiple users
        for (const userId of users) {
            await this.discoveryManager.publishDiscoverySignal(userId, 'WebKnown');
            const invitation = await this.discoveryManager.verifyDiscoverySignal(userId, 'WebKnown');
            if (invitation) {
                this.verifiedInvitations.push(invitation);
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
                this.verifiedInvitations
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
        this.creditManager.printConservation();
    }

    /**
     * Demonstrate the complete credit economy workflow
     */
    async demonstrateCreditEconomy(): Promise<void> {
        console.log('\n💰 Credit Economy Demonstration\n');

        // Setup two users with canonical account IDs
        const alice = accountId('alice');  // Canonical: "alice" not "alice_provider.js"
        const bob = accountId('bob');      // Canonical: "bob" not "bob_consumer.js"

        // Validate canonical IDs
        assertCanonical(alice);
        assertCanonical(bob);

        console.log(`📊 Initial Credit Balances:`);
        logBalance('Alice', alice, await this.creditManager.getBalance(alice));
        logBalance('Bob', bob, await this.creditManager.getBalance(bob));

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
        logBalance('Alice', alice, aliceBalance);

        // Bob needs to run a task but check with proper affordability
        console.log(`\n🔍 Bob wants to run a computational task...`);
        const taskRequirements = {
            CPU: 50,     // 50% CPU
            RAM: 2048,   // 2GB RAM
            Storage: 10, // 10GB
            Bandwidth: 100 // 100 Mbps
        };

        const taskDuration = 1800; // 30 minutes
        const estimatedCost = estimateTaskCost(taskRequirements, taskDuration);
        console.log(`💰 Estimated task cost: ${estimatedCost} credits`);

        const bobBalanceCheck = await this.creditManager.getBalance(bob);
        const canBobAfford = bobBalanceCheck.balance >= estimatedCost;
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

        // Check if Bob can now afford the task (use same user ID consistently)
        const bobBalance = await this.creditManager.getBalance(bob);
        logBalance('Bob', bob, bobBalance);

        const canAffordNow = bobBalance.balance >= estimatedCost;
        console.log(`💳 Can Bob afford the task now? ${canAffordNow ? 'Yes' : 'No'}`);

        if (canAffordNow) {
            // Bob executes the task (use consistent account ID)
            console.log(`\n⚡ Bob executes his computational task...`);
            const consumption = {
                taskId: 'task_ml_training_001',
                userId: bob,  // Use canonical bob, not bob_consumer.js
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
                    userId: alice,  // Use canonical alice
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

        // Final balances with proper logging
        console.log(`\n📊 Final Credit Balances:`);
        const finalAliceBalance = await this.creditManager.getBalance(alice);
        const finalBobBalance = await this.creditManager.getBalance(bob);
        logBalance('Alice', alice, finalAliceBalance);
        logBalance('Bob', bob, finalBobBalance);

        // Show network statistics
        console.log(`\n📈 Network Economy Statistics:`);
        const stats = await this.creditManager.getNetworkStats();
        console.log(`- Total credits in circulation: ${stats.totalCreditsInCirculation}`);
        console.log(`- Total transactions: ${stats.totalTransactions}`);
        console.log(`- Active contributors: ${stats.activeContributors}`);
        console.log(`- Average contribution rate: ${stats.averageContributionRate.toFixed(2)} credits/hour`);

        console.log('\n🎉 Credit economy demonstration completed successfully!');
        this.creditManager.printConservation();
    }

    /**
     * Demonstrate agent-based AI workload processing with proper credit validation
     */
    async demonstrateAskeeProtocol(): Promise<void> {
        console.log('\n🤖 Askee Protocol Demonstration - Agent-Based AI Workloads\n');

        // Set up canonical user accounts for agent owners
        const researcherUserId = accountId('researcher');  // Canonical: "researcher"
        const analystUserId = accountId('analyst');        // Canonical: "analyst"

        // Validate canonical IDs
        assertCanonical(researcherUserId);
        assertCanonical(analystUserId);

        // Give agent owners initial credits for demonstration
        console.log('💰 Setting up agent owner credits...');

        // Give researcher bootstrap credits
        await this.creditManager.earnCredits({
            nodeId: 'bootstrap_node',
            userId: researcherUserId,
            resourceType: 'Bootstrap',
            amountProvided: 500, // Bootstrap contribution
            duration: 1,
            utilizationRate: 1.0,
            timestamp: new Date()
        });

        // Give analyst bootstrap credits  
        await this.creditManager.earnCredits({
            nodeId: 'bootstrap_node',
            userId: analystUserId,
            resourceType: 'Bootstrap',
            amountProvided: 300, // Bootstrap contribution
            duration: 1,
            utilizationRate: 1.0,
            timestamp: new Date()
        });

        logBalance('Researcher', researcherUserId, await this.creditManager.getBalance(researcherUserId));
        logBalance('Analyst', analystUserId, await this.creditManager.getBalance(analystUserId));

        // Register AI agents for different users
        console.log('\n=== Agent Registration ===');

        // Research agent owned by researcher user
        const researchAgent = await this.protocolManager.registerAgent(
            'research-agent-001',
            researcherUserId,               // Owner ID
            'ed25519-research-key-001',
            ['research', 'analysis', 'reasoning'],
            'advanced'
        );
        console.log(`✅ Registered: ${researchAgent.agentId} (Owner: ${researcherUserId})`);

        // Analysis agent owned by analyst user
        const analysisAgent = await this.protocolManager.registerAgent(
            'analysis-agent-001',
            analystUserId,                  // Owner ID
            'ed25519-analysis-key-001',
            ['data-analysis', 'visualization', 'reporting'],
            'basic'
        );
        console.log(`✅ Registered: ${analysisAgent.agentId} (Owner: ${analystUserId})`);

        // Create workload requests with proper Askee protocol format
        console.log('\n=== Workload Processing ===');

        // Research workload (researcher's agent processes workload using researcher's credits)
        const researchRequest: AskeeWorkloadRequest = {
            header: {
                version: '1.0.0',
                networkId: 'askee-mainnet',
                requestId: 'req_research_001',
                timestamp: Date.now(),
                nodeId: 'seed-001',
                agentId: researchAgent.agentId,
                signature: 'research-signature-001',
                nonce: Math.floor(Math.random() * 1000000)
            },
            workload: {
                type: 'inference',
                modelId: 'llama-3.1-8b',
                priority: 'high',
                input: {
                    prompt: 'Analyze the implications of distributed AI computing for scientific research'
                },
                parameters: {
                    maxTokens: 500,
                    temperature: 0.3
                },
                constraints: {
                    maxExecutionTime: 60,    // 60 seconds
                    maxMemoryUsage: 2048,    // 2GB RAM
                    maxCredits: 100          // 100 credits max
                }
            },
            agent: {
                id: researchAgent.agentId,
                type: 'research',
                capabilities: researchAgent.capabilities,
                authorization: 'bearer-token-research-001'
            },
            consent: {
                tokenId: 'consent-token-research-001',
                permissions: ['read', 'analyze', 'process'],
                expiresAt: Date.now() + 3600000 // 1 hour
            }
        };

        // Validate research workload
        console.log('🔍 Validating research workload...');
        const researchValidation = await this.protocolManager.validateWorkloadRequest(researchRequest);
        console.log(`   Validation: ${researchValidation.valid ? 'PASSED' : 'FAILED'}`);

        if (!researchValidation.valid) {
            console.log(`   ❌ Validation errors: ${researchValidation.errors.join(', ')}`);
        }

        if (researchValidation.valid) {
            // Check if researcher can afford the workload using unified policy
            const resourceRequirements = {
                CPU: 30,     // 30% CPU
                RAM: 2048,   // 2GB RAM
                Storage: 0,  // No storage required
                Bandwidth: 100 // 100 Mbps
            };
            const estimatedCost = estimateTaskCost(resourceRequirements, 60); // 60 seconds
            console.log(`   💰 Estimated cost: ${estimatedCost} credits`);

            const canAfford = canAffordToHold(researcherUserId, estimatedCost, (id) => this.creditManager.getBalance(id));
            console.log(`   💳 Can researcher afford workload? ${canAfford ? 'Yes' : 'No'}`);

            if (canAfford) {
                console.log('⚡ Processing research workload...');
                const researchResult = await this.protocolManager.processWorkloadRequest(researchRequest);

                if (researchResult.result.success) {
                    console.log(`✅ Research workload completed successfully`);
                    console.log(`   📊 Result: Generated research analysis (${researchResult.result.metrics.tokensGenerated || 0} tokens)`);
                    console.log(`   💰 Credits consumed: ${researchResult.result.metrics.creditsConsumed}`);
                    console.log(`   ⏱️  Execution time: ${researchResult.result.metrics.executionTime}ms`);
                } else {
                    console.log(`❌ Research workload failed: ${researchResult.result.error?.message}`);
                }
            } else {
                console.log('❌ Researcher cannot afford this workload - need more credits');
            }
        }

        // Show final credit balances after agent workloads
        console.log('\n💰 Final agent owner balances:');
        logBalance('Researcher', researcherUserId, await this.creditManager.getBalance(researcherUserId));
        logBalance('Analyst', analystUserId, await this.creditManager.getBalance(analystUserId));

        // Show protocol statistics
        console.log('\n=== Protocol Statistics ===');
        const stats = this.protocolManager.getProtocolStats();
        console.log(`Registered agents: ${stats.registeredAgents}`);
        console.log(`Active workloads: ${stats.activeWorkloads}`);
        console.log(`Completed workloads: ${stats.completedWorkloads}`);
        console.log(`Average execution time: ${stats.averageExecutionTime.toFixed(2)}ms`);
        console.log(`Total network credits spent: ${stats.totalCreditsSpent}`);

        console.log('\n🎉 Askee Protocol demonstration completed!');
        this.creditManager.printConservation();
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
            verifiedUsers: this.verifiedInvitations.length
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

        // Run agent workload demonstration
        await askee.demonstrateAskeeProtocol();

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
if (require.main === module) {
    main();
}
