import winston from 'winston';
import { DatabaseService } from './database';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ]
});

export interface RequestMetrics {
    total: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
    requestsPerMinute: number;
}

export interface ModelMetrics {
    [modelName: string]: {
        requests: number;
        avgResponseTime: number;
        successRate: number;
    };
}

export interface NodeMetrics {
    requests: RequestMetrics;
    models: ModelMetrics;
    resources: {
        cpuUsage: number;
        memoryUsage: number;
        diskUsage: number;
    };
    network: {
        connectionsIn: number;
        connectionsOut: number;
        bytesTransferred: number;
    };
    uptime: number;
    lastUpdated: string;
}

interface RequestRecord {
    timestamp: number;
    type: 'local' | 'network';
    success: boolean;
    responseTime?: number;
    model?: string;
    error?: string;
}

export class MetricsService {
    private db: DatabaseService;
    private requests: RequestRecord[] = [];
    private startTime: number;
    private readonly METRICS_RETENTION_HOURS = 24;
    private readonly MAX_MEMORY_RECORDS = 10000;

    constructor() {
        this.db = new DatabaseService();
        this.startTime = Date.now();

        // Clean up old metrics periodically
        setInterval(() => this.cleanupOldMetrics(), 60000); // Every minute
    }

    recordRequest(type: 'local' | 'network', success: boolean, options?: {
        responseTime?: number;
        model?: string;
        error?: string;
    }): void {
        const record: RequestRecord = {
            timestamp: Date.now(),
            type,
            success,
            ...options
        };

        this.requests.push(record);

        // Persist to database asynchronously
        this.persistMetric('request', success ? 1 : 0, {
            type,
            responseTime: options?.responseTime,
            model: options?.model,
            error: options?.error
        }).catch(error => {
            logger.warn('Failed to persist request metric:', error);
        });

        // Prevent memory overflow
        if (this.requests.length > this.MAX_MEMORY_RECORDS) {
            this.requests = this.requests.slice(-this.MAX_MEMORY_RECORDS / 2);
        }
    }

    async getMetrics(): Promise<NodeMetrics> {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        const recentRequests = this.requests.filter(r => r.timestamp > oneHourAgo);

        return {
            requests: this.calculateRequestMetrics(recentRequests),
            models: this.calculateModelMetrics(recentRequests),
            resources: await this.getResourceMetrics(),
            network: await this.getNetworkMetrics(),
            uptime: Math.floor((now - this.startTime) / 1000),
            lastUpdated: new Date().toISOString()
        };
    }

    private calculateRequestMetrics(requests: RequestRecord[]): RequestMetrics {
        const total = requests.length;
        const successful = requests.filter(r => r.success).length;
        const failed = total - successful;

        const responseTimes = requests
            .filter(r => r.responseTime !== undefined)
            .map(r => r.responseTime!);

        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
            : 0;

        // Calculate requests per minute for the last hour
        const requestsPerMinute = total > 0 ? total / 60 : 0;

        return {
            total,
            successful,
            failed,
            avgResponseTime,
            requestsPerMinute
        };
    }

    private calculateModelMetrics(requests: RequestRecord[]): ModelMetrics {
        const modelStats: { [key: string]: { requests: number; responseTimes: number[]; successes: number } } = {};

        requests.forEach(request => {
            if (request.model) {
                if (!modelStats[request.model]) {
                    modelStats[request.model] = { requests: 0, responseTimes: [], successes: 0 };
                }

                modelStats[request.model].requests++;

                if (request.success) {
                    modelStats[request.model].successes++;
                }

                if (request.responseTime !== undefined) {
                    modelStats[request.model].responseTimes.push(request.responseTime);
                }
            }
        });

        const modelMetrics: ModelMetrics = {};

        Object.entries(modelStats).forEach(([model, stats]) => {
            const avgResponseTime = stats.responseTimes.length > 0
                ? stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length
                : 0;

            const successRate = stats.requests > 0 ? (stats.successes / stats.requests) * 100 : 0;

            modelMetrics[model] = {
                requests: stats.requests,
                avgResponseTime,
                successRate
            };
        });

        return modelMetrics;
    }

    private async getResourceMetrics(): Promise<NodeMetrics['resources']> {
        // This would typically come from system monitoring
        // For now, we'll use basic Node.js metrics
        const memUsage = process.memoryUsage();
        const totalMem = require('os').totalmem();

        return {
            cpuUsage: 0, // TODO: Implement proper CPU monitoring
            memoryUsage: (memUsage.heapUsed / totalMem) * 100,
            diskUsage: 0 // TODO: Implement disk usage monitoring
        };
    }

    private async getNetworkMetrics(): Promise<NodeMetrics['network']> {
        try {
            // Get network metrics from database
            const networkRequests = await this.db.getMetrics(undefined, 'network_request', 1);

            return {
                connectionsIn: networkRequests.filter((m: any) => m.metadata?.direction === 'in').length,
                connectionsOut: networkRequests.filter((m: any) => m.metadata?.direction === 'out').length,
                bytesTransferred: networkRequests.reduce((sum: number, m: any) => sum + (m.metadata?.bytes || 0), 0)
            };
        } catch (error) {
            logger.warn('Failed to get network metrics:', error);
            return {
                connectionsIn: 0,
                connectionsOut: 0,
                bytesTransferred: 0
            };
        }
    }

    async getHistoricalMetrics(hours = 24): Promise<any> {
        try {
            const metrics = await this.db.getMetrics(undefined, undefined, hours);

            // Group metrics by hour
            const hourlyMetrics: { [hour: string]: any } = {};

            metrics.forEach((metric: any) => {
                const hour = new Date(metric.timestamp).toISOString().slice(0, 13) + ':00:00';

                if (!hourlyMetrics[hour]) {
                    hourlyMetrics[hour] = {
                        timestamp: hour,
                        requests: 0,
                        successes: 0,
                        failures: 0,
                        avgResponseTime: 0,
                        responseTimes: []
                    };
                }

                if (metric.metric_type === 'request') {
                    hourlyMetrics[hour].requests++;

                    if (metric.value === 1) {
                        hourlyMetrics[hour].successes++;
                    } else {
                        hourlyMetrics[hour].failures++;
                    }

                    if (metric.metadata?.responseTime) {
                        hourlyMetrics[hour].responseTimes.push(metric.metadata.responseTime);
                    }
                }
            });

            // Calculate average response times
            Object.values(hourlyMetrics).forEach((hourData: any) => {
                if (hourData.responseTimes.length > 0) {
                    hourData.avgResponseTime = hourData.responseTimes.reduce((sum: number, time: number) => sum + time, 0) / hourData.responseTimes.length;
                }
                delete hourData.responseTimes; // Clean up
            });

            return Object.values(hourlyMetrics);
        } catch (error) {
            logger.error('Failed to get historical metrics:', error);
            return [];
        }
    }

    async persistMetric(type: string, value: number, metadata: any = {}): Promise<void> {
        try {
            await this.db.recordMetric('current-node', type, value, metadata);
        } catch (error) {
            logger.warn('Failed to persist metric:', error);
        }
    }

    private cleanupOldMetrics(): void {
        const cutoff = Date.now() - (this.METRICS_RETENTION_HOURS * 60 * 60 * 1000);
        this.requests = this.requests.filter(r => r.timestamp > cutoff);
    }

    async getTopModels(limit = 10): Promise<Array<{ model: string; requests: number; successRate: number }>> {
        const metrics = await this.getMetrics();

        return Object.entries(metrics.models)
            .map(([model, stats]) => ({
                model,
                requests: stats.requests,
                successRate: stats.successRate
            }))
            .sort((a, b) => b.requests - a.requests)
            .slice(0, limit);
    }

    async getErrorAnalysis(): Promise<{ [error: string]: number }> {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const recentErrors = this.requests
            .filter(r => !r.success && r.timestamp > oneHourAgo && r.error)
            .map(r => r.error!);

        const errorCounts: { [error: string]: number } = {};
        recentErrors.forEach(error => {
            errorCounts[error] = (errorCounts[error] || 0) + 1;
        });

        return errorCounts;
    }

    getRequestRate(): number {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const recentRequests = this.requests.filter(r => r.timestamp > fiveMinutesAgo);
        return recentRequests.length / 5; // requests per minute
    }

    async exportMetrics(): Promise<string> {
        const metrics = await this.getMetrics();
        const historical = await this.getHistoricalMetrics();

        return JSON.stringify({
            current: metrics,
            historical,
            exportTime: new Date().toISOString()
        }, null, 2);
    }
}
