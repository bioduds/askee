import type {
    AskeeProtocolHeader,
    AskeeWorkloadRequest,
    AskeeWorkloadResponse,
    AgentRegistration,
    ModelAccessControl,
    NetworkWorkloadPolicy
} from './askee-protocol-types.js';
import type { CryptoManager } from '../crypto/crypto-manager.js';
import type { ConsentTokenManager } from '../core/consent-token-manager.js';
import type { CreditManager } from '../core/credit-manager.js';

/**
 * Askee Protocol Manager - Handles protocol validation, agent authorization, and workload routing
 */
export class AskeeProtocolManager {
    private crypto: CryptoManager;
    private consentTokens: ConsentTokenManager;
    private credits: CreditManager;
    private registeredAgents: Map<string, AgentRegistration> = new Map();
    private modelAccessControls: Map<string, ModelAccessControl> = new Map();
    private networkPolicy: NetworkWorkloadPolicy;
    private activeWorkloads: Map<string, AskeeWorkloadRequest> = new Map();
    private workloadHistory: AskeeWorkloadResponse[] = [];

    constructor(
        crypto: CryptoManager,
        consentTokens: ConsentTokenManager,
        credits: CreditManager,
        networkId: string = 'askee-mainnet'
    ) {
        this.crypto = crypto;
        this.consentTokens = consentTokens;
        this.credits = credits;

        this.networkPolicy = this.createDefaultNetworkPolicy(networkId);
        this.initializeModelAccessControls();
    }

    /**
     * Create default network policy for Askee
     */
    private createDefaultNetworkPolicy(networkId: string): NetworkWorkloadPolicy {
        return {
            networkId,
            policies: {
                requireAgentAuthorization: true,
                requireConsentToken: true,
                requireSignedRequests: true,
                allowedWorkloadTypes: ['inference', 'training', 'fine-tuning'],
                maxWorkloadDuration: 3600, // 1 hour max
                creditRequirements: {
                    minimumBalance: 100,
                    depositRequired: 50
                }
            },
            enforcement: {
                blacklistedAgents: [],
                blacklistedNodes: [],
                suspiciousActivityThreshold: 10,
                autoSuspendEnabled: true
            }
        };
    }

    /**
     * Initialize default model access controls
     */
    private initializeModelAccessControls(): void {
        const defaultControls: ModelAccessControl[] = [
            {
                modelId: 'llama-3.1-8b',
                accessLevel: 'public',
                authorizedAgents: [],
                authorizedNetworks: ['askee-mainnet', 'askee-testnet'],
                maxConcurrentRequests: 10,
                rateLimits: {
                    requestsPerMinute: 60,
                    requestsPerHour: 1000,
                    requestsPerDay: 10000
                }
            },
            {
                modelId: 'phi-3-mini',
                accessLevel: 'public',
                authorizedAgents: [],
                authorizedNetworks: ['askee-mainnet', 'askee-testnet'],
                maxConcurrentRequests: 20,
                rateLimits: {
                    requestsPerMinute: 120,
                    requestsPerHour: 2000,
                    requestsPerDay: 20000
                }
            },
            {
                modelId: 'stable-diffusion-xl',
                accessLevel: 'restricted',
                authorizedAgents: [],
                authorizedNetworks: ['askee-mainnet'],
                maxConcurrentRequests: 5,
                rateLimits: {
                    requestsPerMinute: 10,
                    requestsPerHour: 100,
                    requestsPerDay: 500
                }
            }
        ];

        defaultControls.forEach(control => {
            this.modelAccessControls.set(control.modelId, control);
        });
    }

    /**
     * Register a new agent in the network
     */
    async registerAgent(
        agentId: string,
        ownerId: string,
        publicKey: string,
        capabilities: string[],
        authorizationLevel: 'basic' | 'advanced' | 'expert' | 'admin' = 'basic'
    ): Promise<AgentRegistration> {
        const registration: AgentRegistration = {
            agentId,
            ownerId,          // Store the agent owner's user ID
            publicKey,
            capabilities,
            authorization: {
                level: authorizationLevel,
                allowedModels: this.getModelsForAuthLevel(authorizationLevel),
                maxConcurrentWorkloads: this.getMaxWorkloadsForAuthLevel(authorizationLevel),
                creditLimit: this.getCreditLimitForAuthLevel(authorizationLevel)
            },
            reputation: 50, // Start with neutral reputation
            registeredAt: new Date(),
            lastSeen: new Date()
        };

        this.registeredAgents.set(agentId, registration);
        console.log(`🤖 Registered agent: ${agentId} (${authorizationLevel} level)`);

        return registration;
    }

    /**
     * Get allowed models based on authorization level
     */
    private getModelsForAuthLevel(level: string): string[] {
        switch (level) {
            case 'basic':
                return ['phi-3-mini', 'gemma-2b'];
            case 'advanced':
                return ['phi-3-mini', 'gemma-2b', 'llama-3.1-8b'];
            case 'expert':
                return ['phi-3-mini', 'gemma-2b', 'llama-3.1-8b', 'stable-diffusion-xl'];
            case 'admin':
                return ['*']; // All models
            default:
                return ['phi-3-mini'];
        }
    }

    /**
     * Get max concurrent workloads based on authorization level
     */
    private getMaxWorkloadsForAuthLevel(level: string): number {
        switch (level) {
            case 'basic': return 1;
            case 'advanced': return 3;
            case 'expert': return 5;
            case 'admin': return 10;
            default: return 1;
        }
    }

    /**
     * Get credit limit based on authorization level
     */
    private getCreditLimitForAuthLevel(level: string): number {
        switch (level) {
            case 'basic': return 1000;
            case 'advanced': return 5000;
            case 'expert': return 15000;
            case 'admin': return 50000;
            default: return 500;
        }
    }

    /**
     * Validate an Askee protocol request
     */
    async validateWorkloadRequest(request: AskeeWorkloadRequest): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // 1. Validate protocol header
        if (!this.validateProtocolHeader(request.header)) {
            errors.push('Invalid protocol header');
        }

        // 2. Validate network ID
        if (request.header.networkId !== this.networkPolicy.networkId) {
            errors.push(`Invalid network ID: expected ${this.networkPolicy.networkId}, got ${request.header.networkId}`);
        }

        // 3. Validate agent authorization
        const agent = this.registeredAgents.get(request.agent.id);
        if (!agent) {
            errors.push(`Unregistered agent: ${request.agent.id}`);
        } else {
            // Check if agent is blacklisted
            if (this.networkPolicy.enforcement.blacklistedAgents.includes(request.agent.id)) {
                errors.push(`Agent ${request.agent.id} is blacklisted`);
            }

            // Check model authorization
            if (!this.isAgentAuthorizedForModel(agent, request.workload.modelId)) {
                errors.push(`Agent ${request.agent.id} not authorized for model ${request.workload.modelId}`);
            }

            // Check concurrent workload limit
            const activeCount = this.getActiveWorkloadCountForAgent(request.agent.id);
            if (activeCount >= agent.authorization.maxConcurrentWorkloads) {
                errors.push(`Agent ${request.agent.id} has reached maximum concurrent workloads (${agent.authorization.maxConcurrentWorkloads})`);
            }
        }

        // 4. Validate consent token (simplified for now)
        if (this.networkPolicy.policies.requireConsentToken) {
            // For now, just check if consent token ID exists
            // In a full implementation, we'd validate the token properly
            if (!request.consent.tokenId || request.consent.tokenId.length === 0) {
                errors.push('Missing consent token');
            }
        }

        // 5. Validate model access control
        const accessControl = this.modelAccessControls.get(request.workload.modelId);
        if (accessControl) {
            if (!this.checkModelAccess(accessControl, request)) {
                errors.push(`Access denied for model ${request.workload.modelId}`);
            }
        } else {
            warnings.push(`No access control defined for model ${request.workload.modelId}`);
        }

        // 6. Validate credit requirements (check agent owner's balance, not agent's balance)
        if (agent) {
            const agentOwnerBalance = await this.credits.getBalance(agent.ownerId);
            if (agentOwnerBalance.balance < this.networkPolicy.policies.creditRequirements.minimumBalance) {
                errors.push(`Insufficient credits: ${agentOwnerBalance.balance} < ${this.networkPolicy.policies.creditRequirements.minimumBalance}`);
            }
        }

        // 7. Validate signature
        if (this.networkPolicy.policies.requireSignedRequests) {
            const isValidSignature = await this.validateRequestSignature(request);
            if (!isValidSignature) {
                errors.push('Invalid request signature');
            }
        }

        // 8. Validate workload constraints
        if (request.workload.constraints.maxExecutionTime > this.networkPolicy.policies.maxWorkloadDuration) {
            errors.push(`Workload duration exceeds policy limit: ${request.workload.constraints.maxExecutionTime} > ${this.networkPolicy.policies.maxWorkloadDuration}`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate protocol header
     */
    private validateProtocolHeader(header: AskeeProtocolHeader): boolean {
        const now = Date.now();
        const timestampDiff = Math.abs(now - header.timestamp);

        // Check timestamp is within 5 minutes
        if (timestampDiff > 300000) {
            return false;
        }

        // Check required fields
        return !!(header.version && header.networkId && header.requestId &&
            header.nodeId && header.agentId && header.signature);
    }

    /**
     * Check if agent is authorized for a specific model
     */
    private isAgentAuthorizedForModel(agent: AgentRegistration, modelId: string): boolean {
        return agent.authorization.allowedModels.includes('*') ||
            agent.authorization.allowedModels.includes(modelId);
    }

    /**
     * Get active workload count for an agent
     */
    private getActiveWorkloadCountForAgent(agentId: string): number {
        return Array.from(this.activeWorkloads.values())
            .filter(workload => workload.agent.id === agentId).length;
    }

    /**
     * Check model access control
     */
    private checkModelAccess(accessControl: ModelAccessControl, request: AskeeWorkloadRequest): boolean {
        // Check network authorization
        if (!accessControl.authorizedNetworks.includes(request.header.networkId)) {
            return false;
        }

        // Check agent authorization for restricted models
        if (accessControl.accessLevel === 'restricted' || accessControl.accessLevel === 'private') {
            return accessControl.authorizedAgents.includes(request.agent.id);
        }

        return true;
    }

    /**
     * Validate request signature
     */
    private async validateRequestSignature(request: AskeeWorkloadRequest): Promise<boolean> {
        try {
            // In a real implementation, this would verify the cryptographic signature
            // For now, we'll do basic validation
            const agent = this.registeredAgents.get(request.agent.id);
            return !!(agent && agent.publicKey && request.header.signature.length > 0);
        } catch (error) {
            console.error('Signature validation failed:', error);
            return false;
        }
    }

    /**
     * Process a validated workload request
     */
    async processWorkloadRequest(request: AskeeWorkloadRequest): Promise<AskeeWorkloadResponse> {
        console.log(`🔄 Processing workload: ${request.header.requestId} by agent ${request.agent.id}`);

        // Add to active workloads
        this.activeWorkloads.set(request.header.requestId, request);

        const startTime = Date.now();

        try {
            // Get the agent registration to find the owner
            const agent = this.registeredAgents.get(request.agent.id);
            if (!agent) {
                throw new Error(`Agent ${request.agent.id} not registered`);
            }

            // Check agent owner's credit balance (not agent's balance)
            const agentOwnerBalance = await this.credits.getBalance(agent.ownerId);
            if (agentOwnerBalance.balance < request.workload.constraints.maxCredits) {
                throw new Error('Insufficient credits for workload');
            }

            // Simulate workload execution
            const executionResult = await this.executeWorkload(request);

            // Calculate actual credit cost
            const actualCost = this.calculateWorkloadCost(request, executionResult.metrics);

            // Charge actual cost to agent owner (not agent)
            await this.credits.spendCredits({
                taskId: request.header.requestId,
                userId: agent.ownerId,  // Use agent owner's ID, not agent ID
                nodeId: request.header.nodeId,
                resourceType: 'ai-inference',
                amountConsumed: executionResult.metrics.memoryUsed,
                duration: executionResult.metrics.executionTime / 1000,
                timestamp: new Date()
            });

            // Update agent reputation based on successful execution
            this.updateAgentReputation(request.agent.id, 'success');

            const response: AskeeWorkloadResponse = {
                header: {
                    ...request.header,
                    timestamp: Date.now()
                },
                result: {
                    success: true,
                    output: executionResult.output,
                    metrics: {
                        ...executionResult.metrics,
                        creditsConsumed: actualCost
                    }
                },
                provenance: {
                    nodeId: request.header.nodeId,
                    modelVersion: `${request.workload.modelId}-v1.0`,
                    startTime,
                    endTime: Date.now(),
                    resourcesUsed: executionResult.resourcesUsed
                }
            };

            // Store in history
            this.workloadHistory.push(response);

            // Remove from active workloads
            this.activeWorkloads.delete(request.header.requestId);

            console.log(`✅ Workload completed: ${request.header.requestId}, cost: ${actualCost} credits`);
            return response;

        } catch (error) {
            console.error(`❌ Workload failed: ${request.header.requestId}`, error);

            // Update agent reputation for failure
            this.updateAgentReputation(request.agent.id, 'failure');

            // Remove from active workloads
            this.activeWorkloads.delete(request.header.requestId);

            return {
                header: {
                    ...request.header,
                    timestamp: Date.now()
                },
                result: {
                    success: false,
                    metrics: {
                        executionTime: Date.now() - startTime,
                        memoryUsed: 0,
                        creditsConsumed: 0
                    },
                    error: {
                        code: 'EXECUTION_FAILED',
                        message: error instanceof Error ? error.message : 'Unknown error',
                        details: error
                    }
                },
                provenance: {
                    nodeId: request.header.nodeId,
                    modelVersion: `${request.workload.modelId}-v1.0`,
                    startTime,
                    endTime: Date.now(),
                    resourcesUsed: { cpu: 0, memory: 0 }
                }
            };
        }
    }

    /**
     * Execute workload (mock implementation)
     */
    private async executeWorkload(request: AskeeWorkloadRequest): Promise<{
        output: any;
        metrics: {
            executionTime: number;
            memoryUsed: number;
            tokensGenerated?: number;
        };
        resourcesUsed: {
            cpu: number;
            memory: number;
            gpu?: number;
        };
    }> {
        // Simulate execution time based on workload type
        const executionTime = request.workload.type === 'inference' ?
            Math.random() * 5000 + 1000 : // 1-6 seconds for inference
            Math.random() * 30000 + 10000; // 10-40 seconds for training

        await new Promise(resolve => setTimeout(resolve, Math.min(executionTime, 2000))); // Cap simulation time

        // Mock output based on model type
        let output: any;
        let tokensGenerated: number | undefined;

        if (request.workload.modelId.includes('text') || request.workload.modelId.includes('llama') || request.workload.modelId.includes('phi')) {
            output = `Mock response from ${request.workload.modelId} for agent ${request.agent.id}`;
            tokensGenerated = Math.floor(Math.random() * 500) + 50;
        } else if (request.workload.modelId.includes('diffusion')) {
            output = { imageUrl: `https://generated-image-${Date.now()}.jpg`, width: 1024, height: 1024 };
        } else if (request.workload.modelId.includes('whisper')) {
            output = { transcript: 'Mock audio transcription result', confidence: 0.95 };
        } else {
            output = { result: 'Generic model output' };
        }

        return {
            output,
            metrics: {
                executionTime,
                memoryUsed: Math.floor(Math.random() * 2000) + 500, // 500-2500 MB
                tokensGenerated
            },
            resourcesUsed: {
                cpu: Math.floor(Math.random() * 80) + 20, // 20-100%
                memory: Math.floor(Math.random() * 1500) + 500, // 500-2000 MB
                gpu: request.workload.modelId.includes('diffusion') ? Math.floor(Math.random() * 90) + 10 : undefined
            }
        };
    }

    /**
     * Calculate workload cost based on resources used
     */
    private calculateWorkloadCost(
        request: AskeeWorkloadRequest,
        metrics: { executionTime: number; memoryUsed: number; tokensGenerated?: number }
    ): number {
        const baseRate = 10; // Base rate per second
        const memoryRate = 0.1; // Rate per MB
        const tokenRate = 0.001; // Rate per token

        let cost = (metrics.executionTime / 1000) * baseRate;
        cost += metrics.memoryUsed * memoryRate;

        if (metrics.tokensGenerated) {
            cost += metrics.tokensGenerated * tokenRate;
        }

        // Apply priority multiplier
        const priorityMultiplier = request.workload.priority === 'critical' ? 3 :
            request.workload.priority === 'high' ? 2 :
                request.workload.priority === 'medium' ? 1.5 : 1;

        return Math.ceil(cost * priorityMultiplier);
    }

    /**
     * Update agent reputation
     */
    private updateAgentReputation(agentId: string, outcome: 'success' | 'failure'): void {
        const agent = this.registeredAgents.get(agentId);
        if (agent) {
            const change = outcome === 'success' ? 1 : -2;
            agent.reputation = Math.max(0, Math.min(100, agent.reputation + change));
            agent.lastSeen = new Date();
        }
    }

    /**
     * Get protocol statistics
     */
    getProtocolStats(): {
        registeredAgents: number;
        activeWorkloads: number;
        completedWorkloads: number;
        totalCreditsSpent: number;
        averageExecutionTime: number;
    } {
        const totalCredits = this.workloadHistory.reduce((sum, response) =>
            sum + (response.result.metrics?.creditsConsumed || 0), 0);

        const totalExecutionTime = this.workloadHistory.reduce((sum, response) =>
            sum + (response.result.metrics?.executionTime || 0), 0);

        return {
            registeredAgents: this.registeredAgents.size,
            activeWorkloads: this.activeWorkloads.size,
            completedWorkloads: this.workloadHistory.length,
            totalCreditsSpent: totalCredits,
            averageExecutionTime: this.workloadHistory.length > 0 ?
                totalExecutionTime / this.workloadHistory.length : 0
        };
    }

    /**
     * Get registered agents
     */
    getRegisteredAgents(): AgentRegistration[] {
        return Array.from(this.registeredAgents.values());
    }

    /**
     * Create a protocol header for requests
     */
    createProtocolHeader(
        networkId: string,
        nodeId: string,
        agentId: string,
        signature: string
    ): AskeeProtocolHeader {
        return {
            version: '1.0.0',
            networkId,
            requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            nodeId,
            agentId,
            signature,
            nonce: Math.floor(Math.random() * 1000000)
        };
    }
}
