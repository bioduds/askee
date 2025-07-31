import winston from 'winston';
import { OllamaService } from './ollama';
import { NetworkService } from './network';
import { DatabaseService } from './database';
import os from 'os';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ]
});

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    services: {
        ollama: boolean;
        database: boolean;
        network: boolean;
    };
    resources: ResourceUsage;
    node_id: string;
}

export interface ResourceUsage {
    cpu: {
        usage: number; // percentage
        load: number[]; // 1, 5, 15 minute load averages
    };
    memory: {
        total: number; // bytes
        used: number; // bytes
        free: number; // bytes
        usage: number; // percentage
    };
    disk: {
        total: number; // bytes
        used: number; // bytes
        free: number; // bytes
        usage: number; // percentage
    };
    network: {
        bytesIn: number;
        bytesOut: number;
    };
}

export class HealthService {
    private ollama: OllamaService;
    private network: NetworkService;
    private db: DatabaseService;
    private startTime: number;

    constructor() {
        this.ollama = new OllamaService();
        this.network = new NetworkService();
        this.db = new DatabaseService();
        this.startTime = Date.now();
    }

    async getStatus(): Promise<HealthStatus> {
        const services = await this.checkServices();
        const resources = await this.getResourceUsage();

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

        // Determine overall status
        const serviceCount = Object.values(services).filter(Boolean).length;
        if (serviceCount === 0) {
            status = 'unhealthy';
        } else if (serviceCount < 3) {
            status = 'degraded';
        }

        // Check resource thresholds
        if (resources.cpu.usage > 90 || resources.memory.usage > 90 || resources.disk.usage > 95) {
            status = status === 'healthy' ? 'degraded' : 'unhealthy';
        }

        return {
            status,
            timestamp: new Date().toISOString(),
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            version: process.env.npm_package_version || '1.0.0',
            services,
            resources,
            node_id: this.network.getNodeId()
        };
    }

    private async checkServices(): Promise<HealthStatus['services']> {
        const [ollamaStatus, databaseStatus, networkStatus] = await Promise.allSettled([
            this.ollama.checkHealth(),
            this.checkDatabaseHealth(),
            this.checkNetworkHealth()
        ]);

        return {
            ollama: ollamaStatus.status === 'fulfilled' && ollamaStatus.value,
            database: databaseStatus.status === 'fulfilled' && databaseStatus.value,
            network: networkStatus.status === 'fulfilled' && networkStatus.value
        };
    }

    private async checkDatabaseHealth(): Promise<boolean> {
        try {
            // Simple query to check database connectivity
            await this.db.getAvailableNodes();
            return true;
        } catch (error) {
            logger.warn('Database health check failed:', error);
            return false;
        }
    }

    private async checkNetworkHealth(): Promise<boolean> {
        try {
            await this.network.getNetworkStatus();
            return true;
        } catch (error) {
            logger.warn('Network health check failed:', error);
            return false;
        }
    }

    async getResourceUsage(): Promise<ResourceUsage> {
        const memInfo = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // CPU usage approximation (not perfect but gives an indication)
        const cpuUsage = await this.getCpuUsage();

        // Disk usage (simplified - just for the current directory)
        const diskUsage = await this.getDiskUsage();

        return {
            cpu: {
                usage: cpuUsage,
                load: os.loadavg()
            },
            memory: {
                total: totalMem,
                used: usedMem,
                free: freeMem,
                usage: (usedMem / totalMem) * 100
            },
            disk: diskUsage,
            network: {
                bytesIn: 0, // TODO: Implement network stats
                bytesOut: 0
            }
        };
    }

    private async getCpuUsage(): Promise<number> {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            const startTime = process.hrtime();

            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const endTime = process.hrtime(startTime);

                const totalTime = endTime[0] * 1e6 + endTime[1] / 1e3; // microseconds
                const cpuTime = endUsage.user + endUsage.system; // microseconds

                const usage = (cpuTime / totalTime) * 100;
                resolve(Math.min(usage, 100)); // Cap at 100%
            }, 100);
        });
    }

    private async getDiskUsage(): Promise<ResourceUsage['disk']> {
        try {
            const fs = await import('fs/promises');
            const stats = await fs.statfs(process.cwd());

            const total = stats.bavail * stats.bsize;
            const free = stats.bfree * stats.bsize;
            const used = total - free;

            return {
                total,
                used,
                free,
                usage: total > 0 ? (used / total) * 100 : 0
            };
        } catch (error) {
            logger.warn('Failed to get disk usage:', error);
            return {
                total: 0,
                used: 0,
                free: 0,
                usage: 0
            };
        }
    }

    async getDetailedStatus(): Promise<any> {
        const status = await this.getStatus();

        return {
            ...status,
            details: {
                process: {
                    pid: process.pid,
                    platform: process.platform,
                    arch: process.arch,
                    nodeVersion: process.version,
                    memory: process.memoryUsage()
                },
                system: {
                    hostname: os.hostname(),
                    type: os.type(),
                    release: os.release(),
                    cpus: os.cpus().length,
                    networkInterfaces: Object.keys(os.networkInterfaces())
                },
                services: {
                    ollama: await this.ollama.getSystemInfo(),
                    network: await this.network.getNetworkStatus()
                }
            }
        };
    }

    async runHealthChecks(): Promise<{ [key: string]: boolean }> {
        const checks = {
            'ollama-connection': false,
            'database-connection': false,
            'network-discovery': false,
            'disk-space': false,
            'memory-usage': false,
            'cpu-usage': false
        };

        try {
            // Ollama connection
            checks['ollama-connection'] = await this.ollama.checkHealth();

            // Database connection
            checks['database-connection'] = await this.checkDatabaseHealth();

            // Network discovery
            checks['network-discovery'] = await this.checkNetworkHealth();

            // Resource checks
            const resources = await this.getResourceUsage();
            checks['disk-space'] = resources.disk.usage < 95;
            checks['memory-usage'] = resources.memory.usage < 90;
            checks['cpu-usage'] = resources.cpu.usage < 90;

        } catch (error) {
            logger.error('Health checks failed:', error);
        }

        return checks;
    }

    getUptime(): number {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    async logHealthMetrics(): Promise<void> {
        try {
            const status = await this.getStatus();

            // Log key metrics
            logger.info('Health metrics', {
                status: status.status,
                uptime: status.uptime,
                cpu_usage: status.resources.cpu.usage,
                memory_usage: status.resources.memory.usage,
                disk_usage: status.resources.disk.usage,
                services_healthy: Object.values(status.services).filter(Boolean).length
            });

        } catch (error) {
            logger.error('Failed to log health metrics:', error);
        }
    }
}
