/**
 * Askee Web Server - HTTP API for containerized deployment with Spider System
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { readFileSync } from 'fs';
import { CryptoManager } from './crypto/crypto-manager';
import { DiscoveryManager } from './discovery/discovery-manager';
import { ConsentTokenManager } from './core/consent-token-manager';
import { LedgerCreditManager, CreditUsage } from './core/ledger-credit-manager';
import { SeedManager } from './network/seed-manager';
import { AskeeProtocolManager } from './protocol/askee-protocol-manager';
import { TestingNetwork } from './network/testing-network';
import { NetworkTracer } from './network/network-tracer';
import { accountId, assertCanonical, logBalance } from './utils/account-utils';
import { canAffordToHold, estimateTaskCost } from './utils/credit-policy';
import type { ConsentTokenRequest, TaskPermissions, ResourceLimits, VerifiedInvitation } from './core/types';

class AskeeServer {
    private readonly app: express.Application;
    private readonly cryptoManager: CryptoManager;
    private readonly discoveryManager: DiscoveryManager;
    private readonly creditManager: LedgerCreditManager;
    private readonly consentTokenManager: ConsentTokenManager;
    private readonly seedManager: SeedManager;
    private readonly protocolManager: AskeeProtocolManager;
    private webSpiderManager: any; // Dynamic import for spider
    private readonly verifiedInvitations: VerifiedInvitation[] = [];
    private testingNetwork?: TestingNetwork;
    private networkTracer: NetworkTracer;

    constructor() {
        this.app = express();
        this.app.use(express.json());

        // Add CORS middleware to allow dashboard to access API
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

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

        // Initialize testing network and tracer
        this.networkTracer = new NetworkTracer();

        // Initialize testing network if enabled
        if (process.env.ASKEE_ENABLE_TESTING_NETWORK === 'true') {
            this.testingNetwork = new TestingNetwork('askee-testnet');
            this.setupTestingNetworkIntegration();
        }

        // Initialize spider manager dynamically
        this.initializeSpiderManager();

        this.setupRoutes();
        this.setupDashboard();
        console.log('🕷️  Askee Web Server with Spider System Initialized');
        console.log(`Public Key: ${this.cryptoManager.getPublicKeyHex()}`);
    }

    private async initializeSpiderManager(): Promise<void> {
        try {
            // Use a more compatible import approach
            const spiderPath = './spider/web-spider-manager';
            const spiderModule = await import(spiderPath);

            if (spiderModule.WebSpiderManager) {
                this.webSpiderManager = new spiderModule.WebSpiderManager(
                    this.cryptoManager,
                    this.creditManager,
                    process.env.ASKEE_NODE_ID || 'askee-primary'
                );

                console.log('🕸️  Spider Manager initialized successfully');

                // Auto-start spider if enabled
                if (process.env.ASKEE_AUTO_START_SPIDER === 'true') {
                    await this.webSpiderManager.start();
                    console.log('🚀 Auto-started deployment hunting spider');
                }
            } else {
                console.log('⚠️  WebSpiderManager class not found in module');
            }
        } catch (error) {
            console.error('❌ Failed to initialize Spider Manager:', error);
            console.log('⚠️  Continuing without spider functionality');
        }
    }

    private setupRoutes(): void {
        // Health check endpoint
        this.app.get('/health', (req: Request, res: Response) => {
            const status = this.getSystemStatus();
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                system: status,
                uptime: process.uptime(),
                spider: this.webSpiderManager ? {
                    available: true,
                    active: this.webSpiderManager.isActive?.() || false,
                    metrics: this.webSpiderManager.getMetrics?.() || {}
                } : { available: false }
            });
        });

        // Metrics endpoint for Prometheus
        this.app.get('/metrics', (req: Request, res: Response) => {
            const status = this.getSystemStatus();
            const spiderMetrics = this.webSpiderManager?.getMetrics?.() || {};

            const metrics = [
                `# HELP askee_users_total Total number of users`,
                `# TYPE askee_users_total counter`,
                `askee_users_total ${status.tokenStats.totalUsers}`,
                ``,
                `# HELP askee_tokens_active Active consent tokens`,
                `# TYPE askee_tokens_active gauge`,
                `askee_tokens_active ${status.tokenStats.activeTokens}`,
                ``,
                `# HELP askee_users_verified Verified users count`,
                `# TYPE askee_users_verified gauge`,
                `askee_users_verified ${status.verifiedUsers}`,
                ``,
                `# HELP askee_credits_circulation Total credits in circulation`,
                `# TYPE askee_credits_circulation gauge`,
                `askee_credits_circulation ${this.getTotalCreditsInCirculation()}`,
                ``,
                `# HELP askee_spider_targets_scanned Total targets scanned by spider`,
                `# TYPE askee_spider_targets_scanned counter`,
                `askee_spider_targets_scanned ${spiderMetrics.targetsScanned || 0}`,
                ``,
                `# HELP askee_spider_opportunities_found Total deployment opportunities found`,
                `# TYPE askee_spider_opportunities_found counter`,
                `askee_spider_opportunities_found ${spiderMetrics.opportunitiesFound || 0}`,
                ``,
                `# HELP askee_spider_deployments_successful Successful deployments`,
                `# TYPE askee_spider_deployments_successful counter`,
                `askee_spider_deployments_successful ${spiderMetrics.successfulDeployments || 0}`,
                ``
            ].join('\n');

            res.setHeader('Content-Type', 'text/plain');
            res.send(metrics);
        });

        // System status endpoint
        this.app.get('/status', (req: Request, res: Response) => {
            res.json(this.getSystemStatus());
        });

        // Credit balance endpoint
        this.app.get('/credits/balance/:userId', async (req: Request, res: Response) => {
            try {
                const { userId } = req.params;
                const balance = await this.creditManager.getBalance(userId);

                res.json({
                    userId,
                    balance: balance.balance,
                    totalEarned: balance.totalEarned,
                    totalSpent: balance.totalSpent,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(400).json({
                    error: 'Failed to get balance',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Credit reservation endpoint
        this.app.post('/credits/reserve', async (req: Request, res: Response) => {
            try {
                const { userId, amount, taskId } = req.body;

                if (!userId || !amount || !taskId) {
                    return res.status(400).json({ error: 'Missing required fields: userId, amount, taskId' });
                }

                const reserved = await this.creditManager.reserveCredits(userId, amount, taskId);

                res.json({
                    success: true,
                    message: `Reserved ${amount} credits for task ${taskId}`,
                    reserved,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(400).json({
                    error: 'Failed to reserve credits',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Credit redemption endpoint
        this.app.post('/credits/redeem', async (req: Request, res: Response) => {
            try {
                const { taskId, usage } = req.body;

                if (!taskId || !usage) {
                    return res.status(400).json({ error: 'Missing required fields: taskId, usage' });
                }

                const redeemed = await this.creditManager.redeemCredits(taskId, usage as CreditUsage[]);

                res.json({
                    success: true,
                    message: `Redeemed credits for task ${taskId}`,
                    redeemed,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(400).json({
                    error: 'Failed to redeem credits',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Credit refund endpoint
        this.app.post('/credits/refund', async (req: Request, res: Response) => {
            try {
                const { taskId, reason } = req.body;

                if (!taskId) {
                    return res.status(400).json({ error: 'Missing required field: taskId' });
                }

                const refundAmount = await this.creditManager.refundCredits(taskId, reason);

                res.json({
                    success: true,
                    message: `Refunded ${refundAmount} credits for task ${taskId}`,
                    refundAmount,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(400).json({
                    error: 'Failed to refund credits',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Spider API endpoints
        this.setupSpiderRoutes();

        // Testing network and tracing endpoints
        this.setupTestingNetworkRoutes();
        this.setupTracingRoutes();
    }

    private setupSpiderRoutes(): void {
        // Spider status endpoint
        this.app.get('/spider/status', (req: Request, res: Response) => {
            if (!this.webSpiderManager) {
                return res.json({
                    available: false,
                    message: 'Spider Manager not initialized'
                });
            }

            try {
                const status = {
                    available: true,
                    active: this.webSpiderManager.isActive(),
                    metrics: this.webSpiderManager.getMetrics(),
                    targetCount: this.webSpiderManager.getTargets().length,
                    opportunityCount: this.webSpiderManager.getOpportunities().length,
                    timestamp: new Date().toISOString()
                };
                res.json(status);
            } catch (error) {
                res.status(500).json({
                    error: 'Spider status unavailable',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Start spider endpoint
        this.app.post('/spider/start', async (req: Request, res: Response) => {
            if (!this.webSpiderManager) {
                return res.status(503).json({ error: 'Spider Manager not available' });
            }

            try {
                await this.webSpiderManager.start();
                res.json({
                    message: 'Spider deployment hunting started',
                    status: 'active',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to start spider',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Stop spider endpoint
        this.app.post('/spider/stop', async (req: Request, res: Response) => {
            if (!this.webSpiderManager) {
                return res.status(503).json({ error: 'Spider Manager not available' });
            }

            try {
                await this.webSpiderManager.stop();
                res.json({
                    message: 'Spider deployment hunting stopped',
                    status: 'inactive',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to stop spider',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Get deployment targets
        this.app.get('/spider/targets', (req: Request, res: Response) => {
            if (!this.webSpiderManager) {
                return res.status(503).json({ error: 'Spider Manager not available' });
            }

            try {
                const targets = this.webSpiderManager.getTargets();
                res.json({
                    targets: targets.slice(0, 50), // Limit response size
                    total: targets.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to get targets',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Get deployment opportunities
        this.app.get('/spider/opportunities', (req: Request, res: Response) => {
            if (!this.webSpiderManager) {
                return res.status(503).json({ error: 'Spider Manager not available' });
            }

            try {
                const opportunities = this.webSpiderManager.getOpportunities();
                res.json({
                    opportunities: opportunities.slice(0, 100), // Limit response size
                    total: opportunities.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to get opportunities',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Add custom deployment target
        this.app.post('/spider/targets', async (req: Request, res: Response) => {
            if (!this.webSpiderManager) {
                return res.status(503).json({ error: 'Spider Manager not available' });
            }

            try {
                const { url, priority = 5 } = req.body;
                if (!url) {
                    return res.status(400).json({ error: 'URL is required' });
                }

                await this.webSpiderManager.addCustomTarget(url, priority);
                res.json({
                    message: 'Target added successfully',
                    url,
                    priority,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to add target',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        console.log('🕸️  Spider API endpoints registered');
    }

    private setupDashboard(): void {
        // Serve the dashboard at /dashboard
        this.app.get('/dashboard', (req: Request, res: Response) => {
            try {
                const dashboardPath = path.join(process.cwd(), 'dashboard.html');
                const dashboardContent = readFileSync(dashboardPath, 'utf8');
                res.setHeader('Content-Type', 'text/html');
                res.send(dashboardContent);
            } catch (error) {
                res.status(404).json({
                    error: 'Dashboard not found',
                    message: 'The dashboard.html file could not be loaded'
                });
            }
        });

        // Also serve at root for convenience
        this.app.get('/', (req: Request, res: Response) => {
            res.redirect('/dashboard');
        });

        console.log('📊 Dashboard endpoints registered');
    }

    private getSystemStatus() {
        return {
            tokenStats: {
                totalUsers: this.verifiedInvitations.length,
                activeTokens: 0, // Placeholder
            },
            verifiedUsers: this.verifiedInvitations.length,
            nodeId: process.env.ASKEE_NODE_ID || 'unknown',
            networkMode: process.env.ASKEE_NETWORK_MODE || 'standalone',
            spider: this.webSpiderManager ? {
                initialized: true,
                active: this.webSpiderManager.isActive?.() || false
            } : { initialized: false }
        };
    }

    private getTotalCreditsInCirculation(): number {
        // This would need to be implemented in the credit manager
        // For now, return a placeholder
        return 0;
    }

    public start(): void {
        const port = parseInt(process.env.PORT || '8080');
        const host = process.env.HOST || '0.0.0.0';

        this.app.listen(port, host, () => {
            console.log(`🌐 Askee API Server listening on ${host}:${port}`);
            console.log(`🏥 Health check: http://${host}:${port}/health`);
            console.log(`📊 Metrics: http://${host}:${port}/metrics`);
            console.log(`📈 Status: http://${host}:${port}/status`);
            console.log(`🕸️  Spider status: http://${host}:${port}/spider/status`);
            console.log(`🎯 Spider targets: http://${host}:${port}/spider/targets`);

            if (this.testingNetwork) {
                console.log(`🧪 Testing network: http://${host}:${port}/testing/network/status`);
                console.log(`📈 Network traces: http://${host}:${port}/tracing/traces`);
            }
        });

        // Start testing network if enabled
        if (this.testingNetwork) {
            this.testingNetwork.start();
            console.log('🧪 Testing network started');
        }
    }

    private setupTestingNetworkIntegration(): void {
        if (!this.testingNetwork) return;

        // Forward testing network traces to the tracer
        this.testingNetwork.on('traceAdded', (trace) => {
            this.networkTracer.addTrace(trace);
        });

        // Add metrics for testing network events
        this.testingNetwork.on('nodeAdded', (node) => {
            this.networkTracer.addMetric('node_count', 1, { action: 'added', role: node.role });
        });

        this.testingNetwork.on('nodeRemoved', (event) => {
            this.networkTracer.addMetric('node_count', -1, { action: 'removed', role: event.node.role });
        });

        this.testingNetwork.on('taskCompleted', (event) => {
            this.networkTracer.addMetric('task_completion', 1, {
                success: event.success.toString(),
                client: event.clientId,
                worker: event.workerId
            });
        });
    }

    private setupTestingNetworkRoutes(): void {
        // Get testing network status
        this.app.get('/testing/network/status', (req: Request, res: Response) => {
            if (!this.testingNetwork) {
                return res.status(404).json({ error: 'Testing network not enabled' });
            }

            try {
                const stats = this.testingNetwork.getNetworkStats();
                res.json(stats);
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to get network status',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Get network topology
        this.app.get('/testing/network/topology', (req: Request, res: Response) => {
            if (!this.testingNetwork) {
                return res.status(404).json({ error: 'Testing network not enabled' });
            }

            try {
                const topology = this.testingNetwork.getTopology();
                res.json(topology);
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to get network topology',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Get specific node details
        this.app.get('/testing/network/nodes/:nodeId', (req: Request, res: Response) => {
            if (!this.testingNetwork) {
                return res.status(404).json({ error: 'Testing network not enabled' });
            }

            const { nodeId } = req.params;
            const node = this.testingNetwork.getNode(nodeId);

            if (!node) {
                return res.status(404).json({ error: 'Node not found' });
            }

            res.json(node);
        });

        // Simulate a task on the testing network
        this.app.post('/testing/network/simulate-task', async (req: Request, res: Response) => {
            if (!this.testingNetwork) {
                return res.status(404).json({ error: 'Testing network not enabled' });
            }

            try {
                const { clientId, taskType = 'inference', credits = 100 } = req.body;

                if (!clientId) {
                    return res.status(400).json({ error: 'clientId is required' });
                }

                const taskId = await this.testingNetwork.simulateTask(clientId, taskType, { credits });

                res.json({
                    success: true,
                    taskId,
                    message: `Task simulation started for client ${clientId}`,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(400).json({
                    error: 'Failed to simulate task',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Start/stop testing network
        this.app.post('/testing/network/start', (req: Request, res: Response) => {
            if (!this.testingNetwork) {
                return res.status(404).json({ error: 'Testing network not enabled' });
            }

            this.testingNetwork.start();
            res.json({ message: 'Testing network started', timestamp: new Date().toISOString() });
        });

        this.app.post('/testing/network/stop', (req: Request, res: Response) => {
            if (!this.testingNetwork) {
                return res.status(404).json({ error: 'Testing network not enabled' });
            }

            this.testingNetwork.stop();
            res.json({ message: 'Testing network stopped', timestamp: new Date().toISOString() });
        });

        console.log('🧪 Testing network API endpoints registered');
    }

    private setupTracingRoutes(): void {
        // Get traces with filtering
        this.app.get('/tracing/traces', (req: Request, res: Response) => {
            try {
                const {
                    nodeId,
                    operation,
                    status,
                    since,
                    until,
                    limit = '100',
                    offset = '0'
                } = req.query;

                const filter: any = {};

                if (nodeId) filter.nodeId = nodeId as string;
                if (operation) filter.operation = operation as string;
                if (status) filter.status = status as string;
                if (limit) filter.limit = parseInt(limit as string);
                if (offset) filter.offset = parseInt(offset as string);

                if (since || until) {
                    filter.timeRange = {};
                    if (since) filter.timeRange.start = new Date(since as string);
                    if (until) filter.timeRange.end = new Date(until as string);
                }

                const traces = this.networkTracer.getTraces(filter);

                res.json({
                    traces,
                    total: traces.length,
                    filter,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(400).json({
                    error: 'Failed to get traces',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Get network health
        this.app.get('/tracing/health', (req: Request, res: Response) => {
            try {
                const health = this.networkTracer.getNetworkHealth();
                res.json(health);
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to get network health',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Get trace statistics
        this.app.get('/tracing/stats', (req: Request, res: Response) => {
            try {
                const { hours = '24' } = req.query;
                const hoursNum = parseInt(hours as string);

                const timeRange = {
                    start: new Date(Date.now() - hoursNum * 60 * 60 * 1000),
                    end: new Date()
                };

                const stats = this.networkTracer.getTraceStats(timeRange);
                res.json(stats);
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to get trace statistics',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Get performance trends
        this.app.get('/tracing/trends', (req: Request, res: Response) => {
            try {
                const { hours = '24' } = req.query;
                const hoursNum = parseInt(hours as string);

                const trends = this.networkTracer.getPerformanceTrends(hoursNum);
                res.json({
                    trends,
                    timeRange: hoursNum,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to get performance trends',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Get active alerts
        this.app.get('/tracing/alerts', (req: Request, res: Response) => {
            try {
                const alerts = this.networkTracer.getActiveAlerts();
                res.json({
                    alerts,
                    count: alerts.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to get alerts',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Resolve an alert
        this.app.post('/tracing/alerts/:alertId/resolve', (req: Request, res: Response) => {
            try {
                const { alertId } = req.params;
                const resolved = this.networkTracer.resolveAlert(alertId);

                if (resolved) {
                    res.json({
                        success: true,
                        message: `Alert ${alertId} resolved`,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    res.status(404).json({
                        error: 'Alert not found or already resolved'
                    });
                }
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to resolve alert',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Export traces
        this.app.get('/tracing/export', (req: Request, res: Response) => {
            try {
                const {
                    format = 'json',
                    nodeId,
                    operation,
                    status,
                    since,
                    until,
                    limit
                } = req.query;

                const filter: any = {};

                if (nodeId) filter.nodeId = nodeId as string;
                if (operation) filter.operation = operation as string;
                if (status) filter.status = status as string;
                if (limit) filter.limit = parseInt(limit as string);

                if (since || until) {
                    filter.timeRange = {};
                    if (since) filter.timeRange.start = new Date(since as string);
                    if (until) filter.timeRange.end = new Date(until as string);
                }

                const exportData = this.networkTracer.exportTraces(format as 'json' | 'csv', filter);

                if (format === 'csv') {
                    res.setHeader('Content-Type', 'text/csv');
                    res.setHeader('Content-Disposition', 'attachment; filename="askee_traces.csv"');
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Content-Disposition', 'attachment; filename="askee_traces.json"');
                }

                res.send(exportData);
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to export traces',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        console.log('📈 Network tracing API endpoints registered');
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    const server = new AskeeServer();
    server.start();
}

export { AskeeServer };
