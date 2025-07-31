import { Client } from 'pg';
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ]
});

export interface NodeRecord {
    id: string;
    status: 'online' | 'offline' | 'busy';
    capabilities: string[];
    last_seen: Date;
    endpoint: string;
    metadata: any;
}

export interface ChatHistory {
    id: string;
    conversation_id: string;
    message: string;
    response: string;
    model: string;
    timestamp: Date;
    node_id: string;
}

export class DatabaseService {
    private client: Client | null = null;
    private connected: boolean = false;

    constructor() {
        this.client = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'askee_network',
            user: process.env.DB_USER || 'askee',
            password: process.env.DB_PASSWORD || 'askee_password',
        });
    }

    async connect(): Promise<void> {
        try {
            if (!this.client) return;

            await this.client.connect();
            this.connected = true;

            // Initialize tables
            await this.initializeTables();

            logger.info('Database connected successfully');
        } catch (error) {
            logger.error('Database connection failed:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.client && this.connected) {
                await this.client.end();
                this.connected = false;
                logger.info('Database disconnected');
            }
        } catch (error) {
            logger.error('Database disconnection error:', error);
        }
    }

    private async initializeTables(): Promise<void> {
        if (!this.client) return;

        const queries = [
            `CREATE TABLE IF NOT EXISTS nodes (
        id VARCHAR(255) PRIMARY KEY,
        status VARCHAR(50) NOT NULL,
        capabilities JSONB,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        endpoint VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

            `CREATE TABLE IF NOT EXISTS chat_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id VARCHAR(255),
        message TEXT NOT NULL,
        response TEXT NOT NULL,
        model VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        node_id VARCHAR(255) REFERENCES nodes(id)
      )`,

            `CREATE TABLE IF NOT EXISTS network_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        node_id VARCHAR(255) REFERENCES nodes(id),
        metric_type VARCHAR(100),
        value NUMERIC,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      )`,

            `CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status)`,
            `CREATE INDEX IF NOT EXISTS idx_chat_conversation ON chat_history(conversation_id)`,
            `CREATE INDEX IF NOT EXISTS idx_metrics_node_time ON network_metrics(node_id, timestamp)`
        ];

        for (const query of queries) {
            try {
                await this.client.query(query);
            } catch (error) {
                logger.error('Failed to execute query:', { query, error });
                throw error;
            }
        }
    }

    async registerNode(node: Omit<NodeRecord, 'last_seen'>): Promise<void> {
        if (!this.client || !this.connected) return;

        const query = `
      INSERT INTO nodes (id, status, capabilities, endpoint, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        status = $2,
        capabilities = $3,
        endpoint = $4,
        metadata = $5,
        last_seen = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `;

        try {
            await this.client.query(query, [
                node.id,
                node.status,
                JSON.stringify(node.capabilities),
                node.endpoint,
                JSON.stringify(node.metadata)
            ]);
        } catch (error) {
            logger.error('Failed to register node:', error);
            throw error;
        }
    }

    async updateNodeStatus(nodeId: string, status: NodeRecord['status']): Promise<void> {
        if (!this.client || !this.connected) return;

        const query = `
      UPDATE nodes 
      SET status = $1, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

        try {
            await this.client.query(query, [status, nodeId]);
        } catch (error) {
            logger.error('Failed to update node status:', error);
            throw error;
        }
    }

    async getAvailableNodes(): Promise<NodeRecord[]> {
        if (!this.client || !this.connected) return [];

        const query = `
      SELECT id, status, capabilities, last_seen, endpoint, metadata
      FROM nodes
      WHERE status = 'online' 
      AND last_seen > NOW() - INTERVAL '5 minutes'
      ORDER BY last_seen DESC
    `;

        try {
            const result = await this.client.query(query);
            return result.rows.map(row => ({
                ...row,
                capabilities: Array.isArray(row.capabilities) ? row.capabilities : []
            }));
        } catch (error) {
            logger.error('Failed to get available nodes:', error);
            return [];
        }
    }

    async saveChatHistory(chat: Omit<ChatHistory, 'id' | 'timestamp'>): Promise<string> {
        if (!this.client || !this.connected) throw new Error('Database not connected');

        const query = `
      INSERT INTO chat_history (conversation_id, message, response, model, node_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

        try {
            const result = await this.client.query(query, [
                chat.conversation_id,
                chat.message,
                chat.response,
                chat.model,
                chat.node_id
            ]);
            return result.rows[0].id;
        } catch (error) {
            logger.error('Failed to save chat history:', error);
            throw error;
        }
    }

    async getChatHistory(conversationId: string, limit = 50): Promise<ChatHistory[]> {
        if (!this.client || !this.connected) return [];

        const query = `
      SELECT id, conversation_id, message, response, model, timestamp, node_id
      FROM chat_history
      WHERE conversation_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;

        try {
            const result = await this.client.query(query, [conversationId, limit]);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get chat history:', error);
            return [];
        }
    }

    async recordMetric(nodeId: string, metricType: string, value: number, metadata: any = {}): Promise<void> {
        if (!this.client || !this.connected) return;

        const query = `
      INSERT INTO network_metrics (node_id, metric_type, value, metadata)
      VALUES ($1, $2, $3, $4)
    `;

        try {
            await this.client.query(query, [nodeId, metricType, value, JSON.stringify(metadata)]);
        } catch (error) {
            logger.error('Failed to record metric:', error);
        }
    }

    async getMetrics(nodeId?: string, metricType?: string, hours = 24): Promise<any[]> {
        if (!this.client || !this.connected) return [];

        let query = `
      SELECT node_id, metric_type, value, timestamp, metadata
      FROM network_metrics
      WHERE timestamp > NOW() - INTERVAL '${hours} hours'
    `;

        const params: any[] = [];
        let paramIndex = 1;

        if (nodeId) {
            query += ` AND node_id = $${paramIndex}`;
            params.push(nodeId);
            paramIndex++;
        }

        if (metricType) {
            query += ` AND metric_type = $${paramIndex}`;
            params.push(metricType);
            paramIndex++;
        }

        query += ' ORDER BY timestamp DESC';

        try {
            const result = await this.client.query(query, params);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get metrics:', error);
            return [];
        }
    }

    async cleanupOldData(daysToKeep = 30): Promise<void> {
        if (!this.client || !this.connected) return;

        const queries = [
            `DELETE FROM chat_history WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'`,
            `DELETE FROM network_metrics WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'`,
            `UPDATE nodes SET status = 'offline' WHERE last_seen < NOW() - INTERVAL '1 hour'`
        ];

        for (const query of queries) {
            try {
                const result = await this.client.query(query);
                logger.info(`Cleanup query executed:`, { query, rowCount: result.rowCount });
            } catch (error) {
                logger.error('Cleanup query failed:', { query, error });
            }
        }
    }
}
