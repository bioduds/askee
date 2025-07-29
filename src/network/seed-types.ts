/**
 * Seed Node System for Askee Network Bootstrap
 * Similar to Bitcoin's seed nodes for network discovery
 */

export interface AIModelSpec {
    modelId: string;          // e.g., "llama-3.1-8b", "gpt-4o-mini", "claude-3-haiku"
    name: string;            // Human-readable name
    provider: string;        // "openai", "anthropic", "meta", "local"
    type: 'text' | 'image' | 'audio' | 'multimodal';
    size: number;            // Model size in GB
    requirements: {
        minRAM: number;      // Minimum RAM in GB
        minGPU?: number;     // Minimum GPU memory in GB (optional)
        minCPU: number;      // Minimum CPU cores
        accelerator?: 'cuda' | 'metal' | 'cpu'; // Preferred accelerator
    };
    capabilities: string[];  // e.g., ["text-generation", "code", "reasoning"]
    contextWindow: number;   // Maximum context length
    tokensPerSecond: number; // Expected throughput
}

export interface NodeSystemSpec {
    cpu: {
        cores: number;
        architecture: string; // "x64", "arm64"
        frequency: number;    // GHz
    };
    memory: {
        total: number;       // Total RAM in GB
        available: number;   // Available RAM in GB
    };
    gpu?: {
        model: string;       // e.g., "RTX 4090", "M1 Max"
        memory: number;      // GPU memory in GB
        accelerator: 'cuda' | 'metal' | 'opencl';
    };
    storage: {
        total: number;       // Total storage in GB
        available: number;   // Available storage in GB
        type: 'ssd' | 'hdd' | 'nvme';
    };
    network: {
        bandwidth: number;   // Mbps
        latency: number;     // ms to nearest datacenter
    };
}

export interface DeployedModel {
    modelId: string;
    status: 'downloading' | 'loading' | 'ready' | 'error';
    deployedAt: Date;
    lastUsed: Date;
    usageCount: number;
    healthScore: number;     // 0-100, based on performance metrics
    endpoint: string;        // API endpoint for this model
}

export interface SeedNode {
    id: string;
    publicKey: string;
    endpoints: {
        discovery: string;      // DNS or well-known URL
        api: string;           // REST API endpoint
        websocket?: string;    // WebSocket for real-time communication
        models: string;        // AI model inference endpoint
    };
    region: string;           // Geographic region (us-east, eu-west, asia-pacific, etc.)
    reputation: number;       // Trust score (0-100)
    lastSeen: Date;          // Last successful connection
    capabilities: {
        maxNodes: number;     // Maximum nodes this seed can help bootstrap
        supportedProtocols: string[];
        resourceTypes: string[];
    };
    systemSpec: NodeSystemSpec;     // Hardware specifications
    aiCapabilities: {
        maxConcurrentModels: number;  // How many models can run simultaneously
        supportedModelTypes: ('text' | 'image' | 'audio' | 'multimodal')[];
        deployedModels: DeployedModel[];
        modelDirectory: string[];     // Available models for download
        preferredAccelerator?: 'cuda' | 'metal' | 'cpu';
    };
}

export interface NetworkBootstrap {
    seedNodes: SeedNode[];
    networkId: string;        // Network identifier (mainnet, testnet, etc.)
    protocolVersion: string;  // Protocol version compatibility
    genesisBlock?: {          // Optional: for blockchain-based coordination
        hash: string;
        timestamp: Date;
        initialSeeds: string[];
    };
}

export interface PeerDiscoveryResponse {
    peers: {
        nodeId: string;
        publicKey: string;
        endpoint: string;
        lastSeen: Date;
        reputation: number;
        capabilities: string[];
        systemSpec: NodeSystemSpec;
        availableModels: string[]; // Model IDs that this peer can host
    }[];
    networkStats: {
        totalNodes: number;
        activeNodes: number;
        totalCredits: number;
        avgResponseTime: number;
        totalModelsDeployed: number;
        averageModelLatency: number;
    };
    suggestedSeeds: string[]; // Additional seed nodes to try
    modelCatalog: AIModelSpec[]; // Available AI models in the network
}

export interface ModelDeploymentRequest {
    nodeId: string;
    modelId: string;
    priority: 'low' | 'medium' | 'high';
    requesterPublicKey: string;
    maxWaitTime?: number; // Maximum time to wait for deployment in seconds
    creditBudget?: number; // Maximum credits willing to spend
}

export interface ModelDeploymentResponse {
    success: boolean;
    modelEndpoint?: string;
    estimatedDeploymentTime?: number; // seconds
    creditCost: number;
    error?: string;
}
