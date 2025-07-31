import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import winston from 'winston';
import dotenv from 'dotenv';
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
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

export class SimpleNodeAgent {
    private app: express.Application;
    private server: any;
    private port: number;
    private nodeId: string;

    constructor() {
        this.app = express();
        this.port = parseInt(process.env.NODE_PORT || '3001');
        this.nodeId = process.env.NODE_ID || 'node-' + Math.random().toString(36).substr(2, 9);

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
            origin: ['http://localhost:3000', 'http://localhost:3001'],
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
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '1.0.0',
                services: {
                    ollama: false, // Will be true when Ollama is running
                    database: false, // Will be true when database is available
                    network: true
                },
                resources: {
                    memory: {
                        usage: 25,
                        total: 8000000000,
                        used: 2000000000,
                        free: 6000000000
                    },
                    cpu: {
                        usage: 15,
                        load: [0.5, 0.3, 0.2]
                    },
                    disk: {
                        usage: 45,
                        total: 500000000000,
                        used: 225000000000,
                        free: 275000000000
                    }
                },
                node_id: this.nodeId
            });
        });

        // Node information
        this.app.get('/api/node/info', (req, res) => {
            res.json({
                id: this.nodeId,
                status: 'online',
                capabilities: ['demo-model-1', 'demo-model-2'], // Mock models
                resources: {
                    cpu: 15,
                    memory: 25,
                    disk: 45
                },
                uptime: process.uptime(),
                version: '1.0.0'
            });
        });

        // Chat endpoint
        this.app.post('/api/chat', async (req, res) => {
            try {
                const { message, model, conversationId } = req.body;

                if (!message) {
                    return res.status(400).json({ error: 'Message is required' });
                }

                // Simulate AI response (replace with actual Ollama integration)
                await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time

                const responses = [
                    "I'm a demo AI assistant running on the Askee network. This is a simulated response.",
                    "Hello! I understand you said: \"" + message + "\". This is a mock response from the AI network.",
                    "Thanks for your message! I'm currently running in demo mode without a real AI model connected.",
                    "I received your message and I'm responding from the distributed AI network. In production, this would be processed by Ollama."
                ];

                const response = responses[Math.floor(Math.random() * responses.length)];

                res.json({
                    response,
                    model: model || 'demo-model',
                    conversationId,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                logger.error('Chat request failed:', error);
                res.status(500).json({ error: 'Failed to process chat request' });
            }
        });

        // Available models
        this.app.get('/api/models', (req, res) => {
            res.json({
                local: [
                    { name: 'demo-model-1', size: 4000000000, modified_at: new Date().toISOString() },
                    { name: 'demo-model-2', size: 7000000000, modified_at: new Date().toISOString() }
                ],
                network: [
                    { name: 'network-model-1' },
                    { name: 'network-model-2' }
                ],
                total: 4
            });
        });

        // Network status
        this.app.get('/api/network/status', (req, res) => {
            res.json({
                totalNodes: 3,
                onlineNodes: 2,
                totalModels: 6,
                avgResponseTime: 1250,
                networkLoad: 35
            });
        });

        // Metrics endpoint
        this.app.get('/api/metrics', (req, res) => {
            res.json({
                requests: {
                    total: 127,
                    successful: 119,
                    failed: 8,
                    avgResponseTime: 1150,
                    requestsPerMinute: 2.3
                },
                models: {
                    'demo-model-1': {
                        requests: 67,
                        avgResponseTime: 980,
                        successRate: 95.5
                    },
                    'demo-model-2': {
                        requests: 52,
                        avgResponseTime: 1350,
                        successRate: 92.3
                    }
                },
                resources: {
                    cpuUsage: 15,
                    memoryUsage: 25,
                    diskUsage: 45
                },
                network: {
                    connectionsIn: 12,
                    connectionsOut: 8,
                    bytesTransferred: 2048576
                },
                uptime: process.uptime(),
                lastUpdated: new Date().toISOString()
            });
        });

        // Model management (mock endpoints)
        this.app.post('/api/models/pull', async (req, res) => {
            const { modelName } = req.body;
            if (!modelName) {
                return res.status(400).json({ error: 'Model name is required' });
            }

            // Simulate model pulling
            await new Promise(resolve => setTimeout(resolve, 2000));

            res.json({
                success: true,
                message: `Model ${modelName} pulled successfully (simulated)`
            });
        });

        this.app.delete('/api/models/:modelName', (req, res) => {
            const { modelName } = req.params;
            res.json({
                success: true,
                message: `Model ${modelName} removed successfully (simulated)`
            });
        });

        // Serve React app for all other routes
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
        });
    }

    public async start(): Promise<void> {
        try {
            // Create HTTP server
            this.server = createServer(this.app);

            // Start listening
            this.server.listen(this.port, () => {
                logger.info(`Askee AI Network node started on port ${this.port}`);
                logger.info(`Frontend available at http://localhost:${this.port}`);
                logger.info(`API available at http://localhost:${this.port}/api`);
                logger.info(`Node ID: ${this.nodeId}`);
                logger.info('Note: Running in demo mode without database or Ollama');
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
            if (this.server) {
                this.server.close();
            }

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
    const nodeAgent = new SimpleNodeAgent();
    nodeAgent.start().catch((error) => {
        console.error('Failed to start node agent:', error);
        process.exit(1);
    });
}
