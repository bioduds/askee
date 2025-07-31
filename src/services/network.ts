import axios from 'axios';
import winston from 'winston';
import { DatabaseService } from './database';
import { OllamaService } from './ollama';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ]
});

export interface NetworkNode {
    id: string;
    endpoint: string;
    status: 'online' | 'offline' | 'busy';
    capabilities: string[];
    load: number;
    lastSeen: Date;
}

export interface NetworkStatus {
    totalNodes: number;
    onlineNodes: number;
    totalModels: number;
    avgResponseTime: number;
    networkLoad: number;
}

export class NetworkService {
    private db: DatabaseService;
    private ollama: OllamaService;
    private nodes: Map<string, NetworkNode> = new Map();
    private discoveryInterval: NodeJS.Timeout | null = null;
    private nodeId: string;
    private endpoint: string;

    constructor() {
        this.db = new DatabaseService();
        this.ollama = new OllamaService();
        this.nodeId = process.env.NODE_ID || 'node-' + Math.random().toString(36).substr(2, 9);
        this.endpoint = process.env.NODE_ENDPOINT || `http://localhost:${process.env.NODE_PORT || 8080}`;
    }

    async initialize(): Promise<void> {
        try {
            // Register this node
            await this.registerSelf();

            // Start network discovery
            this.startDiscovery();

            logger.info('Network service initialized', { nodeId: this.nodeId });
        } catch (error) {
            logger.error('Failed to initialize network service:', error);
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.discoveryInterval) {
                clearInterval(this.discoveryInterval);
            }

            // Mark this node as offline
            await this.db.updateNodeStatus(this.nodeId, 'offline');

            logger.info('Network service disconnected');
        } catch (error) {
            logger.error('Error disconnecting network service:', error);
        }
    }

    private async registerSelf(): Promise<void> {
        try {
            const capabilities = await this.ollama.getAvailableModels();

            await this.db.registerNode({
                id: this.nodeId,
                status: 'online',
                capabilities: capabilities.map(m => m.name),
                endpoint: this.endpoint,
                metadata: {
                    version: process.env.npm_package_version || '1.0.0',
                    platform: process.platform,
                    arch: process.arch,
                    startTime: new Date().toISOString()
                }
            });
        } catch (error) {
            logger.error('Failed to register self:', error);
        }
    }

    private startDiscovery(): void {
        // Discover nodes every 30 seconds
        this.discoveryInterval = setInterval(async () => {
            await this.discoverNodes();
            await this.updateNodeHealth();
        }, 30000);

        // Initial discovery
        this.discoverNodes();
    }

    private async discoverNodes(): Promise<void> {
        try {
            const dbNodes = await this.db.getAvailableNodes();

            for (const dbNode of dbNodes) {
                if (dbNode.id !== this.nodeId) {
                    const networkNode: NetworkNode = {
                        id: dbNode.id,
                        endpoint: dbNode.endpoint,
                        status: dbNode.status,
                        capabilities: dbNode.capabilities || [],
                        load: 0, // Will be updated by health check
                        lastSeen: dbNode.last_seen
                    };

                    this.nodes.set(dbNode.id, networkNode);
                }
            }
        } catch (error) {
            logger.error('Failed to discover nodes:', error);
        }
    }

    private async updateNodeHealth(): Promise<void> {
        const promises = Array.from(this.nodes.values()).map(async (node) => {
            try {
                const response = await axios.get(`${node.endpoint}/health`, {
                    timeout: 5000
                });

                if (response.status === 200) {
                    node.status = 'online';
                    node.lastSeen = new Date();

                    // Update load if available
                    if (response.data.load !== undefined) {
                        node.load = response.data.load;
                    }

                    await this.db.updateNodeStatus(node.id, 'online');
                }
            } catch (error) {
                logger.warn(`Node ${node.id} health check failed:`, error);
                node.status = 'offline';
                await this.db.updateNodeStatus(node.id, 'offline');
            }
        });

        await Promise.allSettled(promises);
    }

    async routeRequest(message: string, preferredModel?: string): Promise<string> {
        try {
            // Find the best node for this request
            const targetNode = await this.selectBestNode(preferredModel);

            if (!targetNode) {
                throw new Error('No available nodes for request');
            }

            // Route the request
            const response = await axios.post(`${targetNode.endpoint}/api/chat`, {
                message,
                model: preferredModel
            }, {
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data.response;
        } catch (error) {
            logger.error('Failed to route request:', error);
            throw error;
        }
    }

    private async selectBestNode(preferredModel?: string): Promise<NetworkNode | null> {
        const availableNodes = Array.from(this.nodes.values())
            .filter(node => node.status === 'online');

        if (availableNodes.length === 0) {
            return null;
        }

        // If preferred model specified, filter by capability
        let candidateNodes = availableNodes;
        if (preferredModel) {
            candidateNodes = availableNodes.filter(node =>
                node.capabilities.some(cap => cap.includes(preferredModel))
            );

            // Fallback to all nodes if no specific model match
            if (candidateNodes.length === 0) {
                candidateNodes = availableNodes;
            }
        }

        // Select node with lowest load
        candidateNodes.sort((a, b) => a.load - b.load);
        return candidateNodes[0];
    }

    async getAvailableModels(): Promise<string[]> {
        const allModels = new Set<string>();

        // Add local models
        const localModels = await this.ollama.getAvailableModels();
        localModels.forEach(model => allModels.add(model.name));

        // Add network models
        for (const node of this.nodes.values()) {
            if (node.status === 'online') {
                node.capabilities.forEach(model => allModels.add(model));
            }
        }

        return Array.from(allModels);
    }

    async getNetworkStatus(): Promise<NetworkStatus> {
        const onlineNodes = Array.from(this.nodes.values())
            .filter(node => node.status === 'online');

        const totalModels = await this.getAvailableModels();

        const avgLoad = onlineNodes.length > 0
            ? onlineNodes.reduce((sum, node) => sum + node.load, 0) / onlineNodes.length
            : 0;

        return {
            totalNodes: this.nodes.size + 1, // +1 for this node
            onlineNodes: onlineNodes.length + 1,
            totalModels: totalModels.length,
            avgResponseTime: 0, // TODO: Calculate from metrics
            networkLoad: avgLoad
        };
    }

    async getNodeList(): Promise<NetworkNode[]> {
        // Add self to the list
        const selfNode: NetworkNode = {
            id: this.nodeId,
            endpoint: this.endpoint,
            status: 'online',
            capabilities: (await this.ollama.getAvailableModels()).map(m => m.name),
            load: 0, // TODO: Calculate actual load
            lastSeen: new Date()
        };

        return [selfNode, ...Array.from(this.nodes.values())];
    }

    async findNodesWithModel(modelName: string): Promise<NetworkNode[]> {
        const allNodes = await this.getNodeList();
        return allNodes.filter(node =>
            node.status === 'online' &&
            node.capabilities.some(cap => cap.includes(modelName))
        );
    }

    async broadcastMessage(message: any): Promise<void> {
        const promises = Array.from(this.nodes.values())
            .filter(node => node.status === 'online')
            .map(async (node) => {
                try {
                    await axios.post(`${node.endpoint}/api/network/message`, message, {
                        timeout: 10000,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Node-ID': this.nodeId
                        }
                    });
                } catch (error) {
                    logger.warn(`Failed to send message to node ${node.id}:`, error);
                }
            });

        await Promise.allSettled(promises);
    }

    getNodeId(): string {
        return this.nodeId;
    }

    getNodeEndpoint(): string {
        return this.endpoint;
    }

    async recordNetworkMetric(metricType: string, value: number, metadata: any = {}): Promise<void> {
        try {
            await this.db.recordMetric(this.nodeId, metricType, value, metadata);
        } catch (error) {
            logger.error('Failed to record network metric:', error);
        }
    }
}
