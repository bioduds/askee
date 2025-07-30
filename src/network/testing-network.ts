/**
 * Testing Network Implementation - Simulated multi-node network for testing
 */

import { EventEmitter } from 'events';
import { CryptoManager } from '../crypto/crypto-manager.js';
import { DiscoveryManager } from '../discovery/discovery-manager.js';
import { LedgerCreditManager } from '../core/ledger-credit-manager.js';
import { SeedManager } from './seed-manager.js';
import type { VerifiedInvitation } from '../core/types.js';

export interface TestNode {
    id: string;
    publicKey: string;
    region: string;
    role: 'seed' | 'worker' | 'client';
    resources: {
        cpu: { cores: number; usage: number };
        memory: { total: number; available: number };
        storage: { total: number; available: number };
        gpu?: { model: string; memory: number };
    };
    reputation: number;
    balance: number;
    isOnline: boolean;
    lastSeen: Date;
    connections: Set<string>; // Connected node IDs
    networkTracing: NetworkTrace[];
}

export interface NetworkTrace {
    id: string;
    timestamp: Date;
    sourceNode: string;
    targetNode?: string;
    operation: 'discovery' | 'connection' | 'task' | 'credit_transfer' | 'consensus';
    payload: any;
    status: 'success' | 'failure' | 'pending';
    latency?: number;
    errorMessage?: string;
}

export interface NetworkTopology {
    nodes: Map<string, TestNode>;
    connections: Map<string, Set<string>>; // node -> connected nodes
    messageQueue: NetworkMessage[];
    globalTrace: NetworkTrace[];
    consensusState: ConsensusState;
}

export interface NetworkMessage {
    id: string;
    from: string;
    to: string;
    type: 'discovery' | 'task' | 'consensus' | 'heartbeat';
    payload: any;
    timestamp: Date;
    ttl: number;
}

export interface ConsensusState {
    currentRound: number;
    activeVotes: Map<string, any>;
    finalizedBlocks: any[];
    pendingTransactions: any[];
}

export class TestingNetwork extends EventEmitter {
    private topology: NetworkTopology;
    private networkId: string;
    private isRunning: boolean = false;
    private simulationInterval?: NodeJS.Timeout;
    private messageProcessingInterval?: NodeJS.Timeout;
    private traceRetentionMs: number = 24 * 60 * 60 * 1000; // 24 hours

    constructor(networkId: string = 'askee-testnet') {
        super();
        this.networkId = networkId;
        this.topology = {
            nodes: new Map(),
            connections: new Map(),
            messageQueue: [],
            globalTrace: [],
            consensusState: {
                currentRound: 0,
                activeVotes: new Map(),
                finalizedBlocks: [],
                pendingTransactions: []
            }
        };

        this.initializeDefaultNodes();
    }

    /**
     * Initialize a default test network topology
     */
    private initializeDefaultNodes(): void {
        // Seed nodes
        this.addNode({
            id: 'seed-test-001',
            publicKey: 'ed25519-seed-test-001',
            region: 'us-east-test',
            role: 'seed',
            resources: {
                cpu: { cores: 16, usage: 0.2 },
                memory: { total: 32768, available: 26214 },
                storage: { total: 1000000, available: 800000 },
                gpu: { model: 'RTX 4090', memory: 24 }
            },
            reputation: 100,
            balance: 1000000, // 1M mCC
            isOnline: true,
            lastSeen: new Date(),
            connections: new Set(),
            networkTracing: []
        });

        this.addNode({
            id: 'seed-test-002',
            publicKey: 'ed25519-seed-test-002',
            region: 'eu-west-test',
            role: 'seed',
            resources: {
                cpu: { cores: 12, usage: 0.15 },
                memory: { total: 16384, available: 13107 },
                storage: { total: 500000, available: 400000 }
            },
            reputation: 95,
            balance: 800000,
            isOnline: true,
            lastSeen: new Date(),
            connections: new Set(),
            networkTracing: []
        });

        // Worker nodes
        for (let i = 1; i <= 5; i++) {
            this.addNode({
                id: `worker-test-${i.toString().padStart(3, '0')}`,
                publicKey: `ed25519-worker-test-${i.toString().padStart(3, '0')}`,
                region: ['us-west', 'eu-central', 'asia-pacific'][i % 3] + '-test',
                role: 'worker',
                resources: {
                    cpu: { cores: 4 + (i * 2), usage: Math.random() * 0.3 },
                    memory: { total: 8192 + (i * 2048), available: 6144 + (i * 1536) },
                    storage: { total: 100000 + (i * 50000), available: 80000 + (i * 40000) }
                },
                reputation: 70 + Math.floor(Math.random() * 25),
                balance: 10000 + Math.floor(Math.random() * 50000),
                isOnline: Math.random() > 0.1, // 90% uptime
                lastSeen: new Date(Date.now() - Math.random() * 300000), // Random last seen within 5 minutes
                connections: new Set(),
                networkTracing: []
            });
        }

        // Client nodes
        for (let i = 1; i <= 10; i++) {
            this.addNode({
                id: `client-test-${i.toString().padStart(3, '0')}`,
                publicKey: `ed25519-client-test-${i.toString().padStart(3, '0')}`,
                region: ['us-east', 'us-west', 'eu-west', 'asia-pacific'][i % 4] + '-test',
                role: 'client',
                resources: {
                    cpu: { cores: 2, usage: Math.random() * 0.1 },
                    memory: { total: 4096, available: 3072 },
                    storage: { total: 50000, available: 40000 }
                },
                reputation: 50 + Math.floor(Math.random() * 30),
                balance: Math.floor(Math.random() * 10000),
                isOnline: Math.random() > 0.2, // 80% uptime for clients
                lastSeen: new Date(Date.now() - Math.random() * 600000), // Random last seen within 10 minutes
                connections: new Set(),
                networkTracing: []
            });
        }

        // Create initial connections
        this.createInitialTopology();
    }

    /**
     * Create realistic network connections between nodes
     */
    private createInitialTopology(): void {
        const nodes = Array.from(this.topology.nodes.values());
        const seedNodes = nodes.filter(n => n.role === 'seed');
        const workerNodes = nodes.filter(n => n.role === 'worker');
        const clientNodes = nodes.filter(n => n.role === 'client');

        // Connect seeds to each other
        for (const seed1 of seedNodes) {
            for (const seed2 of seedNodes) {
                if (seed1.id !== seed2.id) {
                    this.connectNodes(seed1.id, seed2.id);
                }
            }
        }

        // Connect workers to 2-3 seeds
        for (const worker of workerNodes) {
            const shuffledSeeds = [...seedNodes].sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(3, shuffledSeeds.length); i++) {
                this.connectNodes(worker.id, shuffledSeeds[i].id);
            }
        }

        // Connect clients to 1-2 seeds and some workers
        for (const client of clientNodes) {
            const shuffledSeeds = [...seedNodes].sort(() => Math.random() - 0.5);
            const shuffledWorkers = [...workerNodes].sort(() => Math.random() - 0.5);

            // Connect to 1-2 seeds
            for (let i = 0; i < Math.min(2, shuffledSeeds.length); i++) {
                this.connectNodes(client.id, shuffledSeeds[i].id);
            }

            // Connect to 1-3 workers
            for (let i = 0; i < Math.min(3, shuffledWorkers.length); i++) {
                if (Math.random() > 0.3) { // 70% chance to connect
                    this.connectNodes(client.id, shuffledWorkers[i].id);
                }
            }
        }
    }

    /**
     * Add a node to the test network
     */
    addNode(node: TestNode): void {
        this.topology.nodes.set(node.id, node);
        this.topology.connections.set(node.id, new Set());

        this.addTrace({
            operation: 'discovery',
            sourceNode: node.id,
            payload: { action: 'node_joined', nodeRole: node.role, region: node.region },
            status: 'success'
        });

        this.emit('nodeAdded', node);
    }

    /**
     * Remove a node from the test network
     */
    removeNode(nodeId: string): void {
        const node = this.topology.nodes.get(nodeId);
        if (!node) return;

        // Disconnect from all nodes
        const connections = this.topology.connections.get(nodeId) || new Set();
        for (const connectedNodeId of connections) {
            this.disconnectNodes(nodeId, connectedNodeId);
        }

        this.topology.nodes.delete(nodeId);
        this.topology.connections.delete(nodeId);

        this.addTrace({
            operation: 'discovery',
            sourceNode: nodeId,
            payload: { action: 'node_left', reason: 'manual_removal' },
            status: 'success'
        });

        this.emit('nodeRemoved', { nodeId, node });
    }

    /**
     * Connect two nodes
     */
    connectNodes(nodeA: string, nodeB: string): boolean {
        const nodeAConnections = this.topology.connections.get(nodeA);
        const nodeBConnections = this.topology.connections.get(nodeB);
        const nodeAData = this.topology.nodes.get(nodeA);
        const nodeBData = this.topology.nodes.get(nodeB);

        if (!nodeAConnections || !nodeBConnections || !nodeAData || !nodeBData) {
            return false;
        }

        if (!nodeAData.isOnline || !nodeBData.isOnline) {
            return false;
        }

        nodeAConnections.add(nodeB);
        nodeBConnections.add(nodeA);
        nodeAData.connections.add(nodeB);
        nodeBData.connections.add(nodeA);

        const latency = this.calculateLatency(nodeAData.region, nodeBData.region);

        this.addTrace({
            operation: 'connection',
            sourceNode: nodeA,
            targetNode: nodeB,
            payload: { action: 'connected', latency },
            status: 'success',
            latency
        });

        this.emit('nodesConnected', { nodeA, nodeB, latency });
        return true;
    }

    /**
     * Disconnect two nodes
     */
    disconnectNodes(nodeA: string, nodeB: string): void {
        const nodeAConnections = this.topology.connections.get(nodeA);
        const nodeBConnections = this.topology.connections.get(nodeB);
        const nodeAData = this.topology.nodes.get(nodeA);
        const nodeBData = this.topology.nodes.get(nodeB);

        if (nodeAConnections) nodeAConnections.delete(nodeB);
        if (nodeBConnections) nodeBConnections.delete(nodeA);
        if (nodeAData) nodeAData.connections.delete(nodeB);
        if (nodeBData) nodeBData.connections.delete(nodeA);

        this.addTrace({
            operation: 'connection',
            sourceNode: nodeA,
            targetNode: nodeB,
            payload: { action: 'disconnected' },
            status: 'success'
        });

        this.emit('nodesDisconnected', { nodeA, nodeB });
    }

    /**
     * Send a message between nodes
     */
    sendMessage(from: string, to: string, type: NetworkMessage['type'], payload: any): string {
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const message: NetworkMessage = {
            id: messageId,
            from,
            to,
            type,
            payload,
            timestamp: new Date(),
            ttl: 5 // 5 hops max
        };

        this.topology.messageQueue.push(message);

        this.addTrace({
            operation: type === 'discovery' ? 'discovery' : 'task',
            sourceNode: from,
            targetNode: to,
            payload: { messageType: type, messageId, ...payload },
            status: 'pending'
        });

        return messageId;
    }

    /**
     * Simulate a task execution on the network
     */
    async simulateTask(clientId: string, taskType: string, resourceRequirements: any): Promise<string> {
        const client = this.topology.nodes.get(clientId);
        if (!client || !client.isOnline) {
            throw new Error(`Client ${clientId} not available`);
        }

        // Find suitable worker nodes
        const workers = Array.from(this.topology.nodes.values())
            .filter(n => n.role === 'worker' && n.isOnline && n.reputation > 60)
            .sort((a, b) => b.reputation - a.reputation);

        if (workers.length === 0) {
            throw new Error('No suitable workers available');
        }

        const selectedWorker = workers[0];
        const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Simulate task execution
        const executionTime = 1000 + Math.random() * 4000; // 1-5 seconds
        const creditCost = Math.floor(resourceRequirements.credits || 100);

        this.addTrace({
            operation: 'task',
            sourceNode: clientId,
            targetNode: selectedWorker.id,
            payload: {
                taskId,
                taskType,
                resourceRequirements,
                creditCost,
                status: 'started'
            },
            status: 'pending'
        });

        // Simulate credit transfer
        if (client.balance >= creditCost) {
            client.balance -= creditCost;
            selectedWorker.balance += creditCost;

            this.addTrace({
                operation: 'credit_transfer',
                sourceNode: clientId,
                targetNode: selectedWorker.id,
                payload: {
                    taskId,
                    amount: creditCost,
                    newClientBalance: client.balance,
                    newWorkerBalance: selectedWorker.balance
                },
                status: 'success'
            });
        }

        // Simulate task completion
        setTimeout(() => {
            const success = Math.random() > 0.05; // 95% success rate

            this.addTrace({
                operation: 'task',
                sourceNode: clientId,
                targetNode: selectedWorker.id,
                payload: {
                    taskId,
                    status: success ? 'completed' : 'failed',
                    executionTime
                },
                status: success ? 'success' : 'failure',
                latency: executionTime,
                errorMessage: success ? undefined : 'Simulated task failure'
            });

            if (success) {
                selectedWorker.reputation = Math.min(100, selectedWorker.reputation + 1);
            } else {
                selectedWorker.reputation = Math.max(0, selectedWorker.reputation - 2);
                // Refund credits on failure
                client.balance += creditCost;
                selectedWorker.balance -= creditCost;
            }

            this.emit('taskCompleted', { taskId, success, clientId, workerId: selectedWorker.id });
        }, executionTime);

        return taskId;
    }

    /**
     * Start the network simulation
     */
    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;

        // Process message queue every 100ms
        this.messageProcessingInterval = setInterval(() => {
            this.processMessageQueue();
        }, 100);

        // Run network simulation every 5 seconds
        this.simulationInterval = setInterval(() => {
            this.runSimulationCycle();
        }, 5000);

        this.addTrace({
            operation: 'discovery',
            sourceNode: 'network',
            payload: { action: 'network_started', networkId: this.networkId },
            status: 'success'
        });

        this.emit('networkStarted');
        console.log(`🕸️  Test network ${this.networkId} started`);
    }

    /**
     * Stop the network simulation
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;

        if (this.messageProcessingInterval) {
            clearInterval(this.messageProcessingInterval);
        }

        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }

        this.addTrace({
            operation: 'discovery',
            sourceNode: 'network',
            payload: { action: 'network_stopped', networkId: this.networkId },
            status: 'success'
        });

        this.emit('networkStopped');
        console.log(`🕸️  Test network ${this.networkId} stopped`);
    }

    /**
     * Process the message queue
     */
    private processMessageQueue(): void {
        const currentTime = Date.now();
        const processedMessages: NetworkMessage[] = [];

        for (let i = this.topology.messageQueue.length - 1; i >= 0; i--) {
            const message = this.topology.messageQueue[i];

            // Remove expired messages
            if (currentTime - message.timestamp.getTime() > 30000) { // 30 second timeout
                this.topology.messageQueue.splice(i, 1);
                continue;
            }

            // Process message if nodes are connected
            const fromConnections = this.topology.connections.get(message.from);
            const canDeliver = fromConnections?.has(message.to) ||
                this.findRoute(message.from, message.to).length > 0;

            if (canDeliver) {
                processedMessages.push(message);
                this.topology.messageQueue.splice(i, 1);

                // Update trace
                const trace = this.topology.globalTrace.find(t =>
                    t.payload.messageId === message.id && t.status === 'pending'
                );
                if (trace) {
                    trace.status = 'success';
                    trace.latency = currentTime - message.timestamp.getTime();
                }
            }
        }

        if (processedMessages.length > 0) {
            this.emit('messagesProcessed', processedMessages);
        }
    }

    /**
     * Run a simulation cycle
     */
    private runSimulationCycle(): void {
        // Simulate random node failures and recoveries
        for (const [nodeId, node] of this.topology.nodes) {
            if (node.role !== 'seed') { // Seeds are more stable
                const shouldChangeStatus = Math.random() < 0.02; // 2% chance
                if (shouldChangeStatus) {
                    node.isOnline = !node.isOnline;
                    node.lastSeen = new Date();

                    if (!node.isOnline) {
                        // Disconnect from all nodes
                        const connections = Array.from(node.connections);
                        for (const connectedNodeId of connections) {
                            this.disconnectNodes(nodeId, connectedNodeId);
                        }
                    }

                    this.addTrace({
                        operation: 'discovery',
                        sourceNode: nodeId,
                        payload: { action: node.isOnline ? 'came_online' : 'went_offline' },
                        status: 'success'
                    });
                }
            }
        }

        // Simulate random tasks
        const onlineClients = Array.from(this.topology.nodes.values())
            .filter(n => n.role === 'client' && n.isOnline && n.balance > 100);

        if (onlineClients.length > 0 && Math.random() < 0.3) { // 30% chance
            const client = onlineClients[Math.floor(Math.random() * onlineClients.length)];
            const taskTypes = ['inference', 'training', 'image_generation', 'text_analysis'];
            const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];

            this.simulateTask(client.id, taskType, { credits: 50 + Math.floor(Math.random() * 150) })
                .catch(error => {
                    console.warn(`Task simulation failed for ${client.id}:`, error.message);
                });
        }

        // Clean up old traces
        this.cleanupTraces();
    }

    /**
     * Find a route between two nodes using BFS
     */
    private findRoute(from: string, to: string): string[] {
        if (from === to) return [from];

        const visited = new Set<string>();
        const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }];

        while (queue.length > 0) {
            const { node, path } = queue.shift()!;

            if (visited.has(node)) continue;
            visited.add(node);

            const connections = this.topology.connections.get(node);
            if (!connections) continue;

            for (const connectedNode of connections) {
                if (connectedNode === to) {
                    return [...path, connectedNode];
                }

                if (!visited.has(connectedNode)) {
                    queue.push({ node: connectedNode, path: [...path, connectedNode] });
                }
            }
        }

        return []; // No route found
    }

    /**
     * Calculate latency between regions
     */
    private calculateLatency(regionA: string, regionB: string): number {
        const baseLatency = 10; // Base latency in ms

        if (regionA === regionB) return baseLatency;

        // Cross-region latency simulation
        const regionDistance = new Map([
            ['us-east-test,us-west-test', 70],
            ['us-east-test,eu-west-test', 120],
            ['us-east-test,asia-pacific-test', 180],
            ['us-west-test,eu-west-test', 150],
            ['us-west-test,asia-pacific-test', 130],
            ['eu-west-test,asia-pacific-test', 160]
        ]);

        const key = [regionA, regionB].sort().join(',');
        return baseLatency + (regionDistance.get(key) || 100) + Math.random() * 20;
    }

    /**
     * Add a trace to the global trace log
     */
    private addTrace(trace: Omit<NetworkTrace, 'id' | 'timestamp'>): void {
        const fullTrace: NetworkTrace = {
            id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            ...trace
        };

        this.topology.globalTrace.push(fullTrace);

        // Also add to source node's trace if it exists
        const sourceNode = this.topology.nodes.get(trace.sourceNode);
        if (sourceNode) {
            sourceNode.networkTracing.push(fullTrace);
        }

        this.emit('traceAdded', fullTrace);
    }

    /**
     * Clean up old traces (keep only last 24 hours)
     */
    private cleanupTraces(): void {
        const cutoffTime = Date.now() - this.traceRetentionMs;

        this.topology.globalTrace = this.topology.globalTrace.filter(
            trace => trace.timestamp.getTime() > cutoffTime
        );

        for (const node of this.topology.nodes.values()) {
            node.networkTracing = node.networkTracing.filter(
                trace => trace.timestamp.getTime() > cutoffTime
            );
        }
    }

    /**
     * Get network statistics
     */
    getNetworkStats() {
        const nodes = Array.from(this.topology.nodes.values());
        const onlineNodes = nodes.filter(n => n.isOnline);
        const totalConnections = Array.from(this.topology.connections.values())
            .reduce((sum, connections) => sum + connections.size, 0) / 2; // Divide by 2 because connections are bidirectional

        return {
            networkId: this.networkId,
            isRunning: this.isRunning,
            totalNodes: nodes.length,
            onlineNodes: onlineNodes.length,
            seedNodes: nodes.filter(n => n.role === 'seed').length,
            workerNodes: nodes.filter(n => n.role === 'worker').length,
            clientNodes: nodes.filter(n => n.role === 'client').length,
            totalConnections,
            pendingMessages: this.topology.messageQueue.length,
            totalTraces: this.topology.globalTrace.length,
            avgReputation: nodes.reduce((sum, n) => sum + n.reputation, 0) / nodes.length,
            totalCredits: nodes.reduce((sum, n) => sum + n.balance, 0),
            uptime: this.isRunning ? Date.now() : 0
        };
    }

    /**
     * Get all traces with optional filtering
     */
    getTraces(filter?: {
        nodeId?: string;
        operation?: string;
        status?: string;
        since?: Date;
        limit?: number;
    }): NetworkTrace[] {
        let traces = [...this.topology.globalTrace];

        if (filter) {
            if (filter.nodeId) {
                traces = traces.filter(t => t.sourceNode === filter.nodeId || t.targetNode === filter.nodeId);
            }
            if (filter.operation) {
                traces = traces.filter(t => t.operation === filter.operation);
            }
            if (filter.status) {
                traces = traces.filter(t => t.status === filter.status);
            }
            if (filter.since) {
                traces = traces.filter(t => t.timestamp >= filter.since!);
            }
        }

        traces.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (filter?.limit) {
            traces = traces.slice(0, filter.limit);
        }

        return traces;
    }

    /**
     * Get network topology for visualization
     */
    getTopology() {
        const nodes = Array.from(this.topology.nodes.entries()).map(([nodeId, node]) => ({
            ...node,
            id: nodeId, // Override the node's id with the map key
            connections: Array.from(node.connections)
        }));

        const edges = [];
        for (const [nodeId, connections] of this.topology.connections) {
            for (const connectedNodeId of connections) {
                if (nodeId < connectedNodeId) { // Avoid duplicate edges
                    edges.push({
                        from: nodeId,
                        to: connectedNodeId,
                        latency: this.calculateLatency(
                            this.topology.nodes.get(nodeId)?.region || '',
                            this.topology.nodes.get(connectedNodeId)?.region || ''
                        )
                    });
                }
            }
        }

        return { nodes, edges };
    }

    /**
     * Get node details by ID
     */
    getNode(nodeId: string): TestNode | undefined {
        return this.topology.nodes.get(nodeId);
    }
}
