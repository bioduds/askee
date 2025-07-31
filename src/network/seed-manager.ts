import type { SeedNode, NetworkBootstrap, PeerDiscoveryResponse } from './seed-types';
import type { CryptoManager } from '../crypto/crypto-manager';
import type { DiscoveryManager } from '../discovery/discovery-manager';
import { AIModelManager } from '../ai/model-manager';
import type { CreditManager } from '../core/credit-manager';

/**
 * Seed Manager - Handles network bootstrap and peer discovery
 * Implements Bitcoin-style seed node system for distributed network discovery
 */
export class SeedManager {
    private crypto: CryptoManager;
    private discovery: DiscoveryManager;
    private aiModels: AIModelManager;
    private knownSeeds: Map<string, SeedNode> = new Map();
    private connectedPeers: Set<string> = new Set();
    private networkBootstrap: NetworkBootstrap;
    private bootstrapAttempts: Map<string, number> = new Map();
    private readonly maxBootstrapAttempts = 3;
    private readonly seedRefreshInterval = 300000; // 5 minutes

    constructor(
        crypto: CryptoManager,
        discovery: DiscoveryManager,
        credits: CreditManager,
        networkConfig?: Partial<NetworkBootstrap>
    ) {
        this.crypto = crypto;
        this.discovery = discovery;
        this.aiModels = new AIModelManager(crypto, credits);

        // Initialize with default mainnet configuration
        this.networkBootstrap = {
            networkId: 'askee-mainnet',
            protocolVersion: '1.0.0',
            seedNodes: this.getDefaultSeedNodes(),
            ...networkConfig
        };

        // Load known seeds into map
        this.networkBootstrap.seedNodes.forEach(seed => {
            this.knownSeeds.set(seed.id, seed);
        });

        // Start periodic seed refresh
        setInterval(() => this.refreshSeedNodes(), this.seedRefreshInterval);
    }

    /**
     * Bootstrap connection to the Askee network
     * Attempts to connect to seed nodes and discover peers
     */
    async bootstrap(): Promise<boolean> {
        console.log(`Bootstrapping to ${this.networkBootstrap.networkId}...`);

        const seeds = Array.from(this.knownSeeds.values())
            .sort((a, b) => b.reputation - a.reputation); // Try high-reputation seeds first

        let successfulConnections = 0;
        const minConnections = Math.min(3, seeds.length);

        for (const seed of seeds) {
            try {
                const success = await this.connectToSeed(seed);
                if (success) {
                    successfulConnections++;
                    console.log(`Connected to seed: ${seed.id} (${seed.region})`);

                    // Discover additional peers through this seed
                    await this.discoverPeersFromSeed(seed);

                    if (successfulConnections >= minConnections) {
                        break;
                    }
                }
            } catch (error) {
                console.warn(`Failed to connect to seed ${seed.id}:`, error);
                this.incrementBootstrapAttempts(seed.id);
            }
        }

        const success = successfulConnections > 0;
        console.log(`Bootstrap ${success ? 'successful' : 'failed'}: ${successfulConnections}/${seeds.length} seeds connected`);

        return success;
    }

    /**
     * Connect to a specific seed node
     */
    private async connectToSeed(seed: SeedNode): Promise<boolean> {
        const attempts = this.bootstrapAttempts.get(seed.id) || 0;
        if (attempts >= this.maxBootstrapAttempts) {
            console.log(`Skipping seed ${seed.id} (max attempts reached)`);
            return false;
        }

        try {
            // Try discovery endpoint first
            const discoveryResult = await this.discovery.discoverPeer(seed.endpoints.discovery);
            if (!discoveryResult) {
                throw new Error('Discovery failed');
            }

            // Verify seed's identity
            const isValid = await this.verifySeedIdentity(seed, discoveryResult);
            if (!isValid) {
                throw new Error('Seed identity verification failed');
            }

            // Update last seen
            seed.lastSeen = new Date();
            this.connectedPeers.add(seed.id);

            return true;
        } catch (error) {
            console.warn(`Seed connection failed for ${seed.id}:`, error);
            return false;
        }
    }

    /**
     * Discover additional peers through a connected seed
     */
    private async discoverPeersFromSeed(seed: SeedNode): Promise<void> {
        try {
            // Mock API call - in real implementation, this would be HTTP/WebSocket
            const response = await this.queryPeerDiscovery(seed);

            // Add discovered peers to known nodes
            response.peers.forEach(peer => {
                console.log(`Discovered peer: ${peer.nodeId} (reputation: ${peer.reputation})`);
                // In a real implementation, we'd add these to our peer list
            });

            // Update our seed list with suggested seeds
            for (const suggestedSeedId of response.suggestedSeeds) {
                if (!this.knownSeeds.has(suggestedSeedId)) {
                    // Fetch seed details and add to known seeds
                    const newSeed = await this.fetchSeedDetails(suggestedSeedId);
                    if (newSeed) {
                        this.knownSeeds.set(newSeed.id, newSeed);
                        console.log(`Added new seed: ${newSeed.id} (${newSeed.region})`);
                    }
                }
            }

            console.log(`Network stats: ${response.networkStats.activeNodes} active nodes, ${response.networkStats.totalCredits} total credits`);
            console.log(`AI Models: ${response.networkStats.totalModelsDeployed} deployed, avg latency: ${response.networkStats.averageModelLatency}ms`);
        } catch (error) {
            console.warn(`Peer discovery failed for seed ${seed.id}:`, error);
        }
    }

    /**
     * Deploy AI models to all connected seed nodes
     */
    async deployAIModels(): Promise<void> {
        const seedNodes = Array.from(this.knownSeeds.values());
        await this.aiModels.autoDeployModels(seedNodes);
    }

    /**
     * Get AI model manager instance
     */
    getAIModelManager(): AIModelManager {
        return this.aiModels;
    }

    /**
     * Verify a seed node's identity using cryptographic proof
     */
    private async verifySeedIdentity(seed: SeedNode, discoveryData: any): Promise<boolean> {
        try {
            // In a real implementation, this would verify the seed's signature
            // For now, we'll do basic validation
            return discoveryData &&
                discoveryData.publicKey === seed.publicKey &&
                discoveryData.nodeId === seed.id;
        } catch (error) {
            console.error('Seed identity verification failed:', error);
            return false;
        }
    }

    /**
     * Query a seed for peer discovery information
     */
    private async queryPeerDiscovery(seed: SeedNode): Promise<PeerDiscoveryResponse> {
        // Mock implementation - in reality this would be an HTTP/WebSocket call
        const mockResponse: PeerDiscoveryResponse = {
            peers: [
                {
                    nodeId: 'peer-001',
                    publicKey: 'ed25519-key-001',
                    endpoint: 'https://peer1.askee.network',
                    lastSeen: new Date(),
                    reputation: 85,
                    capabilities: ['cpu', 'memory', 'storage'],
                    systemSpec: {
                        cpu: { cores: 8, architecture: 'x64', frequency: 3.2 },
                        memory: { total: 32, available: 24 },
                        gpu: { model: 'RTX 3080', memory: 10, accelerator: 'cuda' },
                        storage: { total: 1000, available: 800, type: 'nvme' },
                        network: { bandwidth: 1000, latency: 15 }
                    },
                    availableModels: ['llama-3.1-8b', 'stable-diffusion-xl']
                },
                {
                    nodeId: 'peer-002',
                    publicKey: 'ed25519-key-002',
                    endpoint: 'https://peer2.askee.network',
                    lastSeen: new Date(),
                    reputation: 92,
                    capabilities: ['gpu', 'memory'],
                    systemSpec: {
                        cpu: { cores: 16, architecture: 'x64', frequency: 3.8 },
                        memory: { total: 64, available: 48 },
                        gpu: { model: 'RTX 4090', memory: 24, accelerator: 'cuda' },
                        storage: { total: 2000, available: 1500, type: 'nvme' },
                        network: { bandwidth: 10000, latency: 8 }
                    },
                    availableModels: ['llama-3.1-8b', 'stable-diffusion-xl', 'whisper-large-v3']
                }
            ],
            networkStats: {
                totalNodes: 1247,
                activeNodes: 891,
                totalCredits: 45678900,
                avgResponseTime: 120,
                totalModelsDeployed: 2156,
                averageModelLatency: 250
            },
            suggestedSeeds: ['seed-004', 'seed-005'],
            modelCatalog: this.aiModels.getModelCatalog()
        };

        return mockResponse;
    }

    /**
     * Fetch details for a newly discovered seed
     */
    private async fetchSeedDetails(seedId: string): Promise<SeedNode | null> {
        // Mock implementation - would query seed registry or DNS
        const mockSeed: SeedNode = {
            id: seedId,
            publicKey: `ed25519-${seedId}-key`,
            endpoints: {
                discovery: `https://${seedId}.askee.network/.well-known/askee`,
                api: `https://${seedId}.askee.network/api/v1`,
                websocket: `wss://${seedId}.askee.network/ws`,
                models: `https://${seedId}.askee.network/models`
            },
            region: 'us-west',
            reputation: 88,
            lastSeen: new Date(),
            capabilities: {
                maxNodes: 1000,
                supportedProtocols: ['http', 'websocket'],
                resourceTypes: ['cpu', 'memory', 'storage', 'gpu']
            },
            systemSpec: {
                cpu: { cores: 12, architecture: 'x64', frequency: 3.5 },
                memory: { total: 48, available: 36 },
                gpu: { model: 'RTX 3090', memory: 12, accelerator: 'cuda' },
                storage: { total: 1500, available: 1200, type: 'ssd' },
                network: { bandwidth: 2000, latency: 12 }
            },
            aiCapabilities: {
                maxConcurrentModels: 3,
                supportedModelTypes: ['text', 'image'],
                deployedModels: [],
                modelDirectory: ['llama-3.1-8b', 'phi-3-mini', 'stable-diffusion-xl'],
                preferredAccelerator: 'cuda'
            }
        };

        return mockSeed;
    }

    /**
     * Refresh seed node information periodically
     */
    private async refreshSeedNodes(): Promise<void> {
        console.log('Refreshing seed node information...');

        for (const [seedId, seed] of this.knownSeeds) {
            try {
                // Check if seed is still responsive
                const isResponsive = await this.pingSeed(seed);
                if (isResponsive) {
                    seed.lastSeen = new Date();
                    // Could also update reputation, capabilities, etc.
                } else {
                    console.warn(`Seed ${seedId} is unresponsive`);
                    // Reduce reputation for unresponsive seeds
                    seed.reputation = Math.max(0, seed.reputation - 5);
                }
            } catch (error) {
                console.warn(`Failed to refresh seed ${seedId}:`, error);
            }
        }
    }

    /**
     * Ping a seed to check responsiveness
     */
    private async pingSeed(seed: SeedNode): Promise<boolean> {
        try {
            // Mock ping - in reality would be HTTP HEAD request or websocket ping
            return Math.random() > 0.1; // 90% success rate for mock
        } catch {
            return false;
        }
    }

    /**
     * Track bootstrap attempts for rate limiting
     */
    private incrementBootstrapAttempts(seedId: string): void {
        const current = this.bootstrapAttempts.get(seedId) || 0;
        this.bootstrapAttempts.set(seedId, current + 1);
    }

    /**
     * Get default seed nodes for mainnet
     */
    private getDefaultSeedNodes(): SeedNode[] {
        return [
            {
                id: 'seed-001',
                publicKey: 'ed25519-seed-001-mainnet',
                endpoints: {
                    discovery: 'https://seed1.askee.network/.well-known/askee',
                    api: 'https://seed1.askee.network/api/v1',
                    websocket: 'wss://seed1.askee.network/ws',
                    models: 'https://seed1.askee.network/models'
                },
                region: 'us-east',
                reputation: 100,
                lastSeen: new Date(),
                capabilities: {
                    maxNodes: 5000,
                    supportedProtocols: ['http', 'websocket', 'grpc'],
                    resourceTypes: ['cpu', 'memory', 'storage', 'gpu']
                },
                systemSpec: {
                    cpu: { cores: 32, architecture: 'x64', frequency: 4.2 },
                    memory: { total: 128, available: 96 },
                    gpu: { model: 'A100', memory: 40, accelerator: 'cuda' },
                    storage: { total: 4000, available: 3200, type: 'nvme' },
                    network: { bandwidth: 25000, latency: 5 }
                },
                aiCapabilities: {
                    maxConcurrentModels: 8,
                    supportedModelTypes: ['text', 'image', 'audio', 'multimodal'],
                    deployedModels: [],
                    modelDirectory: ['llama-3.1-8b', 'phi-3-mini', 'stable-diffusion-xl', 'whisper-large-v3'],
                    preferredAccelerator: 'cuda'
                }
            },
            {
                id: 'seed-002',
                publicKey: 'ed25519-seed-002-mainnet',
                endpoints: {
                    discovery: 'https://seed2.askee.network/.well-known/askee',
                    api: 'https://seed2.askee.network/api/v1',
                    websocket: 'wss://seed2.askee.network/ws',
                    models: 'https://seed2.askee.network/models'
                },
                region: 'eu-west',
                reputation: 98,
                lastSeen: new Date(),
                capabilities: {
                    maxNodes: 3000,
                    supportedProtocols: ['http', 'websocket'],
                    resourceTypes: ['cpu', 'memory', 'storage']
                },
                systemSpec: {
                    cpu: { cores: 24, architecture: 'x64', frequency: 3.8 },
                    memory: { total: 96, available: 72 },
                    gpu: { model: 'RTX 4090', memory: 24, accelerator: 'cuda' },
                    storage: { total: 2000, available: 1600, type: 'nvme' },
                    network: { bandwidth: 10000, latency: 8 }
                },
                aiCapabilities: {
                    maxConcurrentModels: 5,
                    supportedModelTypes: ['text', 'image'],
                    deployedModels: [],
                    modelDirectory: ['llama-3.1-8b', 'phi-3-mini', 'gemma-2b', 'stable-diffusion-xl'],
                    preferredAccelerator: 'cuda'
                }
            },
            {
                id: 'seed-003',
                publicKey: 'ed25519-seed-003-mainnet',
                endpoints: {
                    discovery: 'https://seed3.askee.network/.well-known/askee',
                    api: 'https://seed3.askee.network/api/v1',
                    models: 'https://seed3.askee.network/models'
                },
                region: 'asia-pacific',
                reputation: 95,
                lastSeen: new Date(),
                capabilities: {
                    maxNodes: 2000,
                    supportedProtocols: ['http'],
                    resourceTypes: ['cpu', 'memory', 'gpu']
                },
                systemSpec: {
                    cpu: { cores: 16, architecture: 'arm64', frequency: 3.2 },
                    memory: { total: 64, available: 48 },
                    gpu: { model: 'M2 Ultra', memory: 16, accelerator: 'metal' },
                    storage: { total: 1000, available: 800, type: 'ssd' },
                    network: { bandwidth: 5000, latency: 12 }
                },
                aiCapabilities: {
                    maxConcurrentModels: 3,
                    supportedModelTypes: ['text', 'audio'],
                    deployedModels: [],
                    modelDirectory: ['phi-3-mini', 'gemma-2b', 'whisper-large-v3'],
                    preferredAccelerator: 'metal'
                }
            }
        ];
    }

    /**
     * Get current network statistics
     */
    getNetworkStats(): {
        connectedSeeds: number;
        totalSeeds: number;
        connectedPeers: number;
        networkId: string;
    } {
        return {
            connectedSeeds: this.connectedPeers.size,
            totalSeeds: this.knownSeeds.size,
            connectedPeers: this.connectedPeers.size,
            networkId: this.networkBootstrap.networkId
        };
    }

    /**
     * Add a custom seed node
     */
    addSeed(seed: SeedNode): void {
        this.knownSeeds.set(seed.id, seed);
        console.log(`Added custom seed: ${seed.id} (${seed.region})`);
    }

    /**
     * Get list of known seeds
     */
    getKnownSeeds(): SeedNode[] {
        return Array.from(this.knownSeeds.values());
    }
}
