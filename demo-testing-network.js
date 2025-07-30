/**
 * Testing Network Demonstration
 */

import { TestingNetwork } from './dist/network/testing-network.js';
import { NetworkTracer } from './dist/network/network-tracer.js';

async function demonstrateTestingNetwork() {
    console.log('🧪 Starting Askee Testing Network Demonstration\n');

    // Initialize testing network and tracer
    const network = new TestingNetwork('askee-testnet-demo');
    const tracer = new NetworkTracer();

    // Connect tracer to network events
    network.on('traceAdded', (trace) => {
        tracer.addTrace(trace);
    });

    network.on('nodeAdded', (node) => {
        console.log(`➕ Node added: ${node.id} (${node.role}, ${node.region})`);
        tracer.addMetric('node_count', 1, { action: 'added', role: node.role });
    });

    network.on('taskCompleted', (event) => {
        console.log(`✅ Task ${event.taskId} completed: ${event.success ? 'SUCCESS' : 'FAILURE'}`);
        tracer.addMetric('task_completion', 1, {
            success: event.success.toString(),
            client: event.clientId,
            worker: event.workerId
        });
    });

    // Start the network
    network.start();

    console.log('📊 Initial Network Status:');
    const initialStats = network.getNetworkStats();
    console.log(`   - Total nodes: ${initialStats.totalNodes}`);
    console.log(`   - Online nodes: ${initialStats.onlineNodes}`);
    console.log(`   - Seed nodes: ${initialStats.seedNodes}`);
    console.log(`   - Worker nodes: ${initialStats.workerNodes}`);
    console.log(`   - Client nodes: ${initialStats.clientNodes}`);
    console.log(`   - Total connections: ${initialStats.totalConnections}`);
    console.log(`   - Average reputation: ${initialStats.avgReputation.toFixed(1)}`);
    console.log(`   - Total credits: ${initialStats.totalCredits}\n`);

    // Get network topology
    console.log('🕸️  Network Topology:');
    const topology = network.getTopology();
    console.log(`   - Nodes: ${topology.nodes.length}`);
    console.log(`   - Connections: ${topology.edges.length}`);

    // Show some node details
    console.log('\n🖥️  Sample Nodes:');
    topology.nodes.slice(0, 5).forEach(node => {
        console.log(`   - ${node.id}: ${node.role} (${node.region})`);
        console.log(`     CPU: ${node.resources.cpu.cores} cores, Memory: ${node.resources.memory.total}MB`);
        console.log(`     Reputation: ${node.reputation}, Balance: ${node.balance} mCC`);
        console.log(`     Connections: ${node.connections.length}`);
    });

    // Simulate some tasks
    console.log('\n🎯 Simulating Network Tasks...');

    const clients = topology.nodes.filter(n => n.role === 'client' && n.isOnline && n.balance > 100);
    if (clients.length > 0) {
        for (let i = 0; i < 3; i++) {
            const client = clients[Math.floor(Math.random() * clients.length)];
            const taskTypes = ['inference', 'training', 'image_generation'];
            const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];

            try {
                const taskId = await network.simulateTask(client.id, taskType, { credits: 100 + i * 50 });
                console.log(`📝 Task ${taskId} started: ${taskType} by ${client.id}`);
            } catch (error) {
                console.warn(`⚠️  Task simulation failed: ${error.message}`);
            }

            // Wait a bit between tasks
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Wait for tasks to complete
    console.log('\n⏳ Waiting for tasks to complete...');
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Show network traces
    console.log('\n📈 Network Tracing Results:');
    const traces = tracer.getTraces({ limit: 10 });
    console.log(`   Total traces: ${traces.length}`);

    const recentTraces = traces.slice(0, 5);
    console.log('\n🔍 Recent Traces:');
    recentTraces.forEach(trace => {
        console.log(`   - ${trace.operation}: ${trace.sourceNode} -> ${trace.targetNode || 'N/A'}`);
        console.log(`     Status: ${trace.status}, Time: ${trace.timestamp.toISOString()}`);
        if (trace.latency) console.log(`     Latency: ${trace.latency}ms`);
    });

    // Show network health
    console.log('\n🏥 Network Health Status:');
    const health = tracer.getNetworkHealth();
    console.log(`   Overall: ${health.overall.toUpperCase()}`);
    console.log(`   Components:`);
    console.log(`     - Connectivity: ${health.components.connectivity}`);
    console.log(`     - Performance: ${health.components.performance}`);
    console.log(`     - Consensus: ${health.components.consensus}`);
    console.log(`     - Credit System: ${health.components.creditSystem}`);
    console.log(`   Metrics:`);
    console.log(`     - Success Rate: ${health.metrics.successRate.toFixed(1)}%`);
    console.log(`     - Avg Latency: ${health.metrics.avgLatency.toFixed(0)}ms`);
    console.log(`     - Node Availability: ${health.metrics.nodeAvailability.toFixed(1)}%`);
    console.log(`     - Active Alerts: ${health.alerts.length}`);

    // Show trace statistics
    console.log('\n📊 Trace Statistics:');
    const stats = tracer.getTraceStats();
    console.log(`   Total traces: ${stats.total}`);
    console.log(`   By operation:`, stats.byOperation);
    console.log(`   By status:`, stats.byStatus);

    // Show performance trends
    console.log('\n📈 Performance Trends (last hour):');
    const trends = tracer.getPerformanceTrends(1);
    const recentTrends = trends.slice(-5);
    recentTrends.forEach((trend, i) => {
        console.log(`   ${i + 1}. Success Rate: ${trend.successRate.toFixed(1)}%, Latency: ${trend.avgLatency.toFixed(0)}ms, Throughput: ${trend.throughput}`);
    });

    // Show final network stats
    console.log('\n📊 Final Network Status:');
    const finalStats = network.getNetworkStats();
    console.log(`   - Online nodes: ${finalStats.onlineNodes}/${finalStats.totalNodes}`);
    console.log(`   - Pending messages: ${finalStats.pendingMessages}`);
    console.log(`   - Total traces: ${finalStats.totalTraces}`);
    console.log(`   - Average reputation: ${finalStats.avgReputation.toFixed(1)}`);
    console.log(`   - Total credits: ${finalStats.totalCredits}`);

    // Export traces example
    console.log('\n💾 Exporting Traces...');
    const exportData = tracer.exportTraces('json', { limit: 5 });
    console.log(`   Exported ${JSON.parse(exportData).length} traces to JSON format`);

    // Stop the network
    network.stop();
    tracer.stop();

    console.log('\n🎉 Testing Network Demonstration Complete!');
    console.log('   This shows how Askee provides:');
    console.log('   - 🔍 Complete network observability');
    console.log('   - 📊 Real-time performance monitoring');
    console.log('   - 🏥 Health status tracking');
    console.log('   - 📈 Historical trend analysis');
    console.log('   - 🚨 Automated alerting');
    console.log('   - 💾 Data export capabilities');
    console.log('   - 🧪 Comprehensive testing infrastructure');
}

// Run the demonstration
demonstrateTestingNetwork().catch(console.error);
