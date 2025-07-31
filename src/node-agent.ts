import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import winston from 'winston';
import dotenv from 'dotenv';
import { DatabaseService } from './services/database';
import { OllamaService } from './services/ollama';
import { NetworkService } from './services/network';
import { HealthService } from './services/health';
import { MetricsService } from './services/metrics';
import path from 'path';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/node-agent.log' })
    ]
});

export class NodeAgent {
    private app: express.Application;
    private server: any;
    private wss: WebSocketServer | null = null;
    private db: DatabaseService;
    private ollama: OllamaService;
    private network: NetworkService;
    private health: HealthService;
    private metrics: MetricsService;
    private port: number;

    constructor() {
        this.app = express();
        this.port = parseInt(process.env.NODE_PORT || '8080');

        // Initialize services
        this.db = new DatabaseService();
        this.ollama = new OllamaService();
        this.network = new NetworkService();
        this.health = new HealthService();
        this.metrics = new MetricsService();

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:"]
                }
            }
        }));

        // CORS configuration
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true
        }));

        // Compression and parsing
        this.app.use(compression());
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Serve static files (React build)
        this.app.use(express.static(path.join(__dirname, '../frontend/build')));

        // Request logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    private setupRoutes(): void {
        // Health check
        this.app.get('/health', async (req, res) => {
            try {
                const healthStatus = await this.health.getStatus();
                res.json(healthStatus);
            } catch (error) {
                logger.error('Health check failed:', error);
                res.status(500).json({ status: 'error', error: 'Health check failed' });
            }
        });

        // Node information
        this.app.get('/api/node/info', async (req, res) => {
            try {
                const nodeInfo = {
                    id: process.env.NODE_ID || 'node-' + Math.random().toString(36).substr(2, 9),
                    status: 'online',
                    capabilities: await this.ollama.getAvailableModels(),
                    resources: await this.health.getResourceUsage(),
                    uptime: process.uptime(),
                    version: process.env.npm_package_version || '1.0.0'
                };
                res.json(nodeInfo);
            } catch (error) {
                logger.error('Failed to get node info:', error);
                res.status(500).json({ error: 'Failed to get node information' });
            }
        });

        // Chat endpoint
        this.app.post('/api/chat', async (req, res) => {
            try {
                const { message, model, conversationId } = req.body;

                if (!message) {
                    return res.status(400).json({ error: 'Message is required' });
                }

                // Try local model first
                let response;
                try {
                    response = await this.ollama.generateResponse(message, model);
                    this.metrics.recordRequest('local', true);
                } catch (localError) {
                    logger.warn('Local model failed, trying network:', localError);
                    // Fallback to network
                    response = await this.network.routeRequest(message, model);
                    this.metrics.recordRequest('network', true);
                }

                res.json({
                    response,
                    model: model || 'auto',
                    conversationId,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                logger.error('Chat request failed:', error);
                this.metrics.recordRequest('local', false);
                res.status(500).json({ error: 'Failed to process chat request' });
            }
        });

        // Available models
        this.app.get('/api/models', async (req, res) => {
            try {
                const localModels = await this.ollama.getAvailableModels();
                const networkModels = await this.network.getAvailableModels();

                res.json({
                    local: localModels,
                    network: networkModels,
                    total: localModels.length + networkModels.length
                });
            } catch (error) {
                logger.error('Failed to get models:', error);
                res.status(500).json({ error: 'Failed to get available models' });
            }
        });

        // Network status
        this.app.get('/api/network/status', async (req, res) => {
            try {
                const networkStatus = await this.network.getNetworkStatus();
                res.json(networkStatus);
            } catch (error) {
                logger.error('Failed to get network status:', error);
                res.status(500).json({ error: 'Failed to get network status' });
            }
        });

        // Metrics endpoint
        this.app.get('/api/metrics', async (req, res) => {
            try {
                const metrics = await this.metrics.getMetrics();
                res.json(metrics);
            } catch (error) {
                logger.error('Failed to get metrics:', error);
                res.status(500).json({ error: 'Failed to get metrics' });
            }
        });

        // Model management
        this.app.post('/api/models/pull', async (req, res) => {
            try {
                const { modelName } = req.body;
                if (!modelName) {
                    return res.status(400).json({ error: 'Model name is required' });
                }

                const result = await this.ollama.pullModel(modelName);
                res.json(result);
            } catch (error) {
                logger.error('Failed to pull model:', error);
                res.status(500).json({ error: 'Failed to pull model' });
            }
        });

        this.app.delete('/api/models/:modelName', async (req, res) => {
            try {
                const { modelName } = req.params;
                const result = await this.ollama.removeModel(modelName);
                res.json(result);
            } catch (error) {
                logger.error('Failed to remove model:', error);
                res.status(500).json({ error: 'Failed to remove model' });
            }
        });

        // Serve React app for all other routes
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
        });
    }

    private setupWebSocket(): void {
        this.wss = new WebSocketServer({ server: this.server });

        this.wss.on('connection', (ws, req) => {
            logger.info('WebSocket connection established', { ip: req.socket.remoteAddress });

            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());

                    switch (message.type) {
                        case 'ping':
                            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                            break;

                        case 'subscribe_metrics':
                            // Send periodic metrics updates
                            const interval = setInterval(async () => {
                                if (ws.readyState === ws.OPEN) {
                                    const metrics = await this.metrics.getMetrics();
                                    ws.send(JSON.stringify({ type: 'metrics', data: metrics }));
                                }
                            }, 5000);

                            ws.on('close', () => clearInterval(interval));
                            break;

                        default:
                            logger.warn('Unknown WebSocket message type:', message.type);
                    }
                } catch (error) {
                    logger.error('WebSocket message error:', error);
                }
            });

            ws.on('close', () => {
                logger.info('WebSocket connection closed');
            });
        });
    }

    public async start(): Promise<void> {
        try {
            // Initialize services
            await this.db.connect();
            await this.ollama.initialize();
            await this.network.initialize();

            // Create HTTP server
            this.server = createServer(this.app);

            // Setup WebSocket
            this.setupWebSocket();

            // Start listening
            this.server.listen(this.port, () => {
                logger.info(`Node agent started on port ${this.port}`);
                logger.info(`Frontend available at http://localhost:${this.port}`);
                logger.info(`API available at http://localhost:${this.port}/api`);
            });

            // Graceful shutdown
            process.on('SIGTERM', () => this.shutdown());
            process.on('SIGINT', () => this.shutdown());

        } catch (error) {
            logger.error('Failed to start node agent:', error);
            process.exit(1);
        }
    }

    public async shutdown(): Promise<void> {
        logger.info('Shutting down node agent...');

        try {
            if (this.wss) {
                this.wss.close();
            }

            if (this.server) {
                this.server.close();
            }

            await this.db.disconnect();
            await this.network.disconnect();

            logger.info('Node agent shutdown complete');
            process.exit(0);
        } catch (error) {
            logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
}

// Start the node agent if this file is run directly
if (require.main === module) {
    const nodeAgent = new NodeAgent();
    nodeAgent.start().catch((error) => {
        console.error('Failed to start node agent:', error);
        process.exit(1);
    });
}