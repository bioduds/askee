#!/usr/bin/env node

/**
 * P2P AI Collective Test Network Creator
 * 
 * This script creates a test network that simulates the P2P AI collective
 * described in your roadmap, using the existing Askee testing infrastructure
 * as a foundation while preparing for the libp2p transition.
 */

import { TestingNetwork } from './dist/network/testing-network.js';
import { NetworkTracer } from './dist/network/network-tracer.js';

class P2PTestNetwork {
    constructor() {
        this.network = new TestingNetwork('p2p-ai-collective-testnet');
        this.tracer = new NetworkTracer();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Connect tracer to network events
        this.network.on('traceAdded', (trace) => {
            this.tracer.addTrace(trace);
        });

        this.network.on('nodeAdded', (node) => {
            console.log(`🔗 P2P Node joined: ${node.id} (${node.role}, ${node.region})`);
            this.tracer.addMetric('node_count', 1, { action: 'added', role: node.role });
        });

        this.network.on('taskCompleted', (event) => {
            const status = event.success ? '✅ SUCCESS' : '❌ FAILURE';
            console.log(`🤖 AI Task ${event.taskId}: ${status} (${event.clientId} → ${event.workerId})`);
            this.tracer.addMetric('task_completion', 1, {
                success: event.success.toString(),
                client: event.clientId,
                worker: event.workerId
            });
        });

        this.network.on('nodesConnected', ({ nodeA, nodeB, latency }) => {
            console.log(`🔌 P2P Connection: ${nodeA} ↔ ${nodeB} (${latency}ms latency)`);
        });
    }

    async createP2PTestNetwork() {
        console.log('🚀 Creating P2P AI Collective Test Network...\n');

        // Add specialized AI model nodes based on your roadmap
        this.addAIModelNodes();

        // Add client nodes that will request AI services
        this.addClientNodes();

        // Add coordinator nodes (future libp2p DHT nodes)
        this.addCoordinatorNodes();

        // Create P2P-style connections (simulating libp2p behavior)
        this.createP2PTopology();

        console.log('✅ P2P Test Network Created!\n');
        return this.getNetworkInfo();
    }

    addAIModelNodes() {
        console.log('🧠 Adding AI Model Nodes...');

        // Language model nodes
        for (let i = 1; i <= 3; i++) {
            this.network.addNode({
                id: `llm-node-${i}`,
                publicKey: `ed25519-llm-${i}`,
                region: ['us-west', 'eu-central', 'asia-pacific'][i - 1],
                role: 'worker',
                resources: {
                    cpu: { cores: 8 + (i * 4), usage: 0.1 },
                    memory: { total: 32768 + (i * 16384), available: 26214 + (i * 13107) },
                    storage: { total: 500000, available: 400000 },
                    gpu: { model: 'A100', memory: 80 }
                },
                reputation: 85 + (i * 5),
                balance: 50000 + (i * 25000),
                isOnline: true,
                lastSeen: new Date(),
                connections: new Set(),
                networkTracing: [],
                // P2P-specific metadata
                modelType: 'language',
                aiModels: [`llama-3.1-${8 + i * 8}b`, `mistral-${7 + i}b`],
                specializations: ['reasoning', 'coding', 'analysis']
            });
        }

        // Image generation nodes
        for (let i = 1; i <= 2; i++) {
            this.network.addNode({
                id: `img-node-${i}`,
                publicKey: `ed25519-img-${i}`,
                region: ['us-east', 'eu-west'][i - 1],
                role: 'worker',
                resources: {
                    cpu: { cores: 16, usage: 0.2 },
                    memory: { total: 65536, available: 52429 },
                    storage: { total: 1000000, available: 800000 },
                    gpu: { model: 'RTX 4090', memory: 24 }
                },
                reputation: 90 + (i * 3),
                balance: 75000 + (i * 15000),
                isOnline: true,
                lastSeen: new Date(),
                connections: new Set(),
                networkTracing: [],
                modelType: 'image',
                aiModels: [`stable-diffusion-xl-${i}`, `midjourney-v${5 + i}`],
                specializations: ['image-generation', 'art', 'design']
            });
        }

        // Specialized nodes (code, embeddings, etc.)
        this.network.addNode({
            id: 'code-node-1',
            publicKey: 'ed25519-code-1',
            region: 'us-central',
            role: 'worker',
            resources: {
                cpu: { cores: 12, usage: 0.15 },
                memory: { total: 49152, available: 39322 },
                storage: { total: 750000, available: 600000 }
            },
            reputation: 95,
            balance: 100000,
            isOnline: true,
            lastSeen: new Date(),
            connections: new Set(),
            networkTracing: [],
            modelType: 'code',
            aiModels: ['codellama-34b', 'starcoder-15b'],
            specializations: ['programming', 'debugging', 'code-review']
        });

        console.log('   ✓ Added 6 AI model nodes with different specializations');
    }

    addClientNodes() {
        console.log('👥 Adding Client Nodes...');

        for (let i = 1; i <= 8; i++) {
            this.network.addNode({
                id: `p2p-client-${i}`,
                publicKey: `ed25519-client-${i}`,
                region: ['us-west', 'us-east', 'eu-west', 'eu-central', 'asia-pacific', 'oceania'][i % 6],
                role: 'client',
                resources: {
                    cpu: { cores: 4, usage: 0.05 },
                    memory: { total: 8192, available: 6553 },
                    storage: { total: 100000, available: 80000 }
                },
                reputation: 50 + Math.floor(Math.random() * 30),
                balance: 5000 + Math.floor(Math.random() * 15000),
                isOnline: Math.random() > 0.15, // 85% uptime
                lastSeen: new Date(Date.now() - Math.random() * 300000),
                connections: new Set(),
                networkTracing: [],
                // P2P client metadata
                clientType: 'ai-consumer',
                preferredModels: ['language', 'image'],
                maxLatency: 5000,
                maxCostPerRequest: 200
            });
        }

        console.log('   ✓ Added 8 client nodes simulating AI service consumers');
    }

    addCoordinatorNodes() {
        console.log('🎛️  Adding P2P Coordinator Nodes...');

        // These simulate future libp2p DHT bootstrap nodes
        for (let i = 1; i <= 3; i++) {
            this.network.addNode({
                id: `p2p-coordinator-${i}`,
                publicKey: `ed25519-coord-${i}`,
                region: ['us-central', 'eu-central', 'asia-central'][i - 1],
                role: 'seed',
                resources: {
                    cpu: { cores: 8, usage: 0.1 },
                    memory: { total: 16384, available: 13107 },
                    storage: { total: 200000, available: 160000 }
                },
                reputation: 100,
                balance: 200000,
                isOnline: true,
                lastSeen: new Date(),
                connections: new Set(),
                networkTracing: [],
                // P2P coordinator metadata
                coordinatorType: 'dht-bootstrap',
                supportedProtocols: ['kademlia', 'gossipsub', 'quic'],
                maxPeers: 1000,
                isBootstrapNode: true
            });
        }

        console.log('   ✓ Added 3 P2P coordinator nodes (future DHT bootstraps)');
    }

    createP2PTopology() {
        console.log('🕸️  Creating P2P Network Topology...');

        const topology = this.network.getTopology();
        const coordinators = topology.nodes.filter(n => n.role === 'seed');
        const workers = topology.nodes.filter(n => n.role === 'worker');
        const clients = topology.nodes.filter(n => n.role === 'client');

        // Connect coordinators to each other (simulates libp2p DHT)
        for (const coord1 of coordinators) {
            for (const coord2 of coordinators) {
                if (coord1.id !== coord2.id) {
                    this.network.connectNodes(coord1.id, coord2.id);
                }
            }
        }

        // Connect workers to multiple coordinators (simulates DHT participation)
        for (const worker of workers) {
            const shuffledCoords = [...coordinators].sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(2, shuffledCoords.length); i++) {
                this.network.connectNodes(worker.id, shuffledCoords[i].id);
            }
        }

        // Connect clients to some workers and coordinators (simulates P2P discovery)
        for (const client of clients) {
            if (!client.isOnline) continue;

            // Connect to 1-2 coordinators for discovery
            const shuffledCoords = [...coordinators].sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(2, shuffledCoords.length); i++) {
                this.network.connectNodes(client.id, shuffledCoords[i].id);
            }

            // Connect to 2-4 workers for AI services
            const shuffledWorkers = [...workers].sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(4, shuffledWorkers.length); i++) {
                if (Math.random() > 0.3) { // 70% connection probability
                    this.network.connectNodes(client.id, shuffledWorkers[i].id);
                }
            }
        }

        // Create some worker-to-worker connections (simulates peer collaboration)
        for (let i = 0; i < workers.length; i++) {
            for (let j = i + 1; j < workers.length; j++) {
                if (Math.random() > 0.6) { // 40% chance for worker-worker connection
                    this.network.connectNodes(workers[i].id, workers[j].id);
                }
            }
        }

        console.log('   ✓ Created P2P-style mesh topology with DHT simulation');
    }

    getNetworkInfo() {
        const stats = this.network.getNetworkStats();
        const topology = this.network.getTopology();

        const coordinators = topology.nodes.filter(n => n.role === 'seed');
        const workers = topology.nodes.filter(n => n.role === 'worker');
        const clients = topology.nodes.filter(n => n.role === 'client');

        return {
            networkId: stats.networkId,
            totalNodes: stats.totalNodes,
            onlineNodes: stats.onlineNodes,
            connections: stats.totalConnections,
            nodeTypes: {
                coordinators: coordinators.length,
                aiWorkers: workers.length,
                clients: clients.length
            },
            aiCapabilities: {
                languageModels: workers.filter(w => w.modelType === 'language').length,
                imageModels: workers.filter(w => w.modelType === 'image').length,
                codeModels: workers.filter(w => w.modelType === 'code').length
            },
            totalCredits: stats.totalCredits,
            avgReputation: stats.avgReputation
        };
    }

    async simulateP2PActivity() {
        console.log('🎯 Simulating P2P AI Collective Activity...\n');

        const topology = this.network.getTopology();
        const clients = topology.nodes.filter(n => n.role === 'client' && n.isOnline && n.balance > 100);

        if (clients.length === 0) {
            console.log('❌ No suitable clients available for simulation');
            return;
        }

        // Simulate different types of AI requests
        const aiTasks = [
            { type: 'language_generation', description: 'Generate a story about space exploration', credits: 150 },
            { type: 'code_generation', description: 'Create a Python web scraper', credits: 200 },
            { type: 'image_generation', description: 'Generate a futuristic city landscape', credits: 300 },
            { type: 'text_analysis', description: 'Analyze sentiment of customer reviews', credits: 100 },
            { type: 'code_review', description: 'Review JavaScript code for security issues', credits: 250 },
            { type: 'creative_writing', description: 'Write a product description for AI software', credits: 120 }
        ];

        // Execute multiple tasks in parallel (simulating P2P swarm behavior)
        const taskPromises = [];
        for (let i = 0; i < Math.min(4, clients.length); i++) {
            const client = clients[i];
            const task = aiTasks[i % aiTasks.length];

            console.log(`🚀 Starting ${task.type}: ${task.description} (Client: ${client.id})`);

            const taskPromise = this.network.simulateTask(client.id, task.type, {
                credits: task.credits,
                description: task.description
            }).catch(error => {
                console.log(`⚠️  Task failed for ${client.id}: ${error.message}`);
                return null;
            });

            taskPromises.push(taskPromise);

            // Stagger task starts slightly
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Wait for all tasks to complete
        await Promise.all(taskPromises);

        console.log('\n⏳ Waiting for task completion...');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    async showNetworkAnalysis() {
        console.log('📊 P2P Network Analysis:\n');

        // Network health
        const health = this.tracer.getNetworkHealth();
        console.log('🏥 Network Health:');
        console.log(`   Overall: ${health.overall.toUpperCase()}`);
        console.log(`   Connectivity: ${health.components.connectivity}`);
        console.log(`   Performance: ${health.components.performance}`);
        console.log(`   Consensus: ${health.components.consensus}\n`);

        // Task statistics
        const traces = this.tracer.getTraces({ limit: 20 });
        const taskTraces = traces.filter(t => t.operation === 'task');
        const successful = taskTraces.filter(t => t.status === 'success').length;
        const failed = taskTraces.filter(t => t.status === 'failure').length;

        console.log('📈 Task Execution Statistics:');
        console.log(`   Total tasks: ${taskTraces.length}`);
        console.log(`   Successful: ${successful} (${((successful / taskTraces.length) * 100).toFixed(1)}%)`);
        console.log(`   Failed: ${failed} (${((failed / taskTraces.length) * 100).toFixed(1)}%)`);

        if (taskTraces.length > 0) {
            const avgLatency = taskTraces
                .filter(t => t.latency)
                .reduce((sum, t) => sum + t.latency, 0) / taskTraces.filter(t => t.latency).length;
            console.log(`   Average latency: ${avgLatency.toFixed(0)}ms\n`);
        }

        // Network topology analysis
        const stats = this.network.getNetworkStats();
        console.log('🕸️  Network Topology:');
        console.log(`   Total nodes: ${stats.totalNodes}`);
        console.log(`   Online nodes: ${stats.onlineNodes} (${((stats.onlineNodes / stats.totalNodes) * 100).toFixed(1)}%)`);
        console.log(`   Total connections: ${stats.totalConnections}`);
        console.log(`   Average reputation: ${stats.avgReputation.toFixed(1)}`);
        console.log(`   Total credits: ${stats.totalCredits.toLocaleString()}\n`);

        // Show recent activity
        console.log('🔍 Recent Network Activity:');
        const recentTraces = traces.slice(0, 8);
        recentTraces.forEach(trace => {
            const timestamp = trace.timestamp.toISOString().substr(11, 8);
            console.log(`   [${timestamp}] ${trace.operation}: ${trace.sourceNode} → ${trace.targetNode || 'network'} (${trace.status})`);
        });
    }

    stop() {
        this.network.stop();
        this.tracer.stop();
        console.log('\n🛑 P2P Test Network stopped');
    }
}

// Main execution
async function createP2PTestNetwork() {
    const testNet = new P2PTestNetwork();

    try {
        // Create the network
        const info = await testNet.createP2PTestNetwork();

        console.log('📋 Network Information:');
        console.log(`   Network ID: ${info.networkId}`);
        console.log(`   Total Nodes: ${info.totalNodes} (${info.onlineNodes} online)`);
        console.log(`   Connections: ${info.connections}`);
        console.log(`   Node Types:`, info.nodeTypes);
        console.log(`   AI Capabilities:`, info.aiCapabilities);
        console.log(`   Total Credits: ${info.totalCredits.toLocaleString()}\n`);

        // Start the network
        testNet.network.start();
        console.log('🌐 P2P Test Network is now running!\n');

        // Simulate activity
        await testNet.simulateP2PActivity();

        // Show analysis
        await testNet.showNetworkAnalysis();

        console.log('\n🎉 P2P AI Collective Test Network Demonstration Complete!');
        console.log('\nThis network simulates your P2P AI Collective roadmap:');
        console.log('  🔗 Peer-to-peer topology (future libp2p DHT)');
        console.log('  🧠 Distributed AI model nodes');
        console.log('  🎛️  Coordinator nodes (bootstrap/discovery)');
        console.log('  🚫 Never-self-serve enforcement');
        console.log('  ⚡ Multi-peer task acceleration');
        console.log('  🏆 Reputation and credit systems');
        console.log('  📊 Comprehensive monitoring and tracing');

        // Keep running for a bit to show ongoing activity
        console.log('\n⏰ Keeping network alive for 30 seconds to show ongoing activity...');
        setTimeout(() => {
            testNet.stop();
            process.exit(0);
        }, 30000);

    } catch (error) {
        console.error('❌ Error creating P2P test network:', error);
        testNet.stop();
        process.exit(1);
    }
}

// Export for use as module
export { P2PTestNetwork };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    createP2PTestNetwork().catch(console.error);
}
