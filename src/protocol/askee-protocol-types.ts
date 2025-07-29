/**
 * Askee Network Protocol - Dedicated protocol for secure agent-based AI workloads
 * Ensures models only respond to authorized Askee network requests
 */

export interface AskeeProtocolHeader {
    version: string;           // Protocol version (e.g., "1.0.0")
    networkId: string;         // Network identifier (e.g., "askee-mainnet")
    requestId: string;         // Unique request identifier
    timestamp: number;         // Unix timestamp
    nodeId: string;           // Requesting node ID
    agentId: string;          // Agent executing the workload
    signature: string;        // Cryptographic signature
    nonce: number;           // Prevent replay attacks
}

export interface AskeeWorkloadRequest {
    header: AskeeProtocolHeader;
    workload: {
        type: 'inference' | 'training' | 'fine-tuning' | 'deployment';
        modelId: string;
        priority: 'low' | 'medium' | 'high' | 'critical';
        input: any;           // Model-specific input data
        parameters?: {        // Optional inference parameters
            temperature?: number;
            maxTokens?: number;
            topP?: number;
            topK?: number;
        };
        constraints: {
            maxExecutionTime: number;  // Maximum execution time in seconds
            maxMemoryUsage: number;    // Maximum memory usage in MB
            maxCredits: number;        // Maximum credits to spend
        };
    };
    agent: {
        id: string;
        type: string;         // e.g., "research", "coding", "creative", "analysis"
        capabilities: string[];
        authorization: string; // Agent authorization token
    };
    consent: {
        tokenId: string;      // Consent token for this workload
        permissions: string[];
        expiresAt: number;
    };
}

export interface AskeeWorkloadResponse {
    header: AskeeProtocolHeader;
    result: {
        success: boolean;
        output?: any;         // Model output
        metrics: {
            executionTime: number;     // Actual execution time
            memoryUsed: number;        // Memory usage in MB
            creditsConsumed: number;   // Credits consumed
            tokensGenerated?: number;  // For text models
            accuracy?: number;         // For classification tasks
        };
        error?: {
            code: string;
            message: string;
            details?: any;
        };
    };
    provenance: {
        nodeId: string;       // Node that executed the workload
        modelVersion: string; // Exact model version used
        startTime: number;
        endTime: number;
        resourcesUsed: {
            cpu: number;      // CPU usage percentage
            memory: number;   // Memory usage in MB
            gpu?: number;     // GPU usage percentage
        };
    };
}

export interface AgentRegistration {
    agentId: string;
    ownerId: string;          // The user ID who owns this agent
    publicKey: string;
    capabilities: string[];
    authorization: {
        level: 'basic' | 'advanced' | 'expert' | 'admin';
        allowedModels: string[];
        maxConcurrentWorkloads: number;
        creditLimit: number;
    };
    reputation: number;       // Agent reputation score (0-100)
    registeredAt: Date;
    lastSeen: Date;
}

export interface ModelAccessControl {
    modelId: string;
    accessLevel: 'public' | 'restricted' | 'private';
    authorizedAgents: string[];  // Whitelist of agent IDs
    authorizedNetworks: string[]; // Whitelist of network IDs
    maxConcurrentRequests: number;
    rateLimits: {
        requestsPerMinute: number;
        requestsPerHour: number;
        requestsPerDay: number;
    };
}

export interface NetworkWorkloadPolicy {
    networkId: string;
    policies: {
        requireAgentAuthorization: boolean;
        requireConsentToken: boolean;
        requireSignedRequests: boolean;
        allowedWorkloadTypes: string[];
        maxWorkloadDuration: number;
        creditRequirements: {
            minimumBalance: number;
            depositRequired: number;
        };
    };
    enforcement: {
        blacklistedAgents: string[];
        blacklistedNodes: string[];
        suspiciousActivityThreshold: number;
        autoSuspendEnabled: boolean;
    };
}
