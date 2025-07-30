/**
 * Network Tracing and Observability System
 */

import { EventEmitter } from 'events';
import type { NetworkTrace } from './testing-network.js';

export interface TraceFilter {
    nodeId?: string;
    operation?: string;
    status?: 'success' | 'failure' | 'pending';
    timeRange?: {
        start: Date;
        end: Date;
    };
    limit?: number;
    offset?: number;
}

export interface MetricPoint {
    timestamp: Date;
    metric: string;
    value: number;
    tags: Record<string, string>;
}

export interface Alert {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    timestamp: Date;
    sourceNode?: string;
    tags: Record<string, string>;
    resolved: boolean;
    resolvedAt?: Date;
}

export interface NetworkHealth {
    overall: 'healthy' | 'degraded' | 'critical';
    components: {
        connectivity: 'healthy' | 'degraded' | 'critical';
        performance: 'healthy' | 'degraded' | 'critical';
        consensus: 'healthy' | 'degraded' | 'critical';
        creditSystem: 'healthy' | 'degraded' | 'critical';
    };
    metrics: {
        avgLatency: number;
        successRate: number;
        nodeAvailability: number;
        creditVelocity: number;
        consensusLatency: number;
    };
    alerts: Alert[];
}

export class NetworkTracer extends EventEmitter {
    private traces: NetworkTrace[] = [];
    private metrics: MetricPoint[] = [];
    private alerts: Alert[] = [];
    private alertRules: AlertRule[] = [];
    private retentionPeriod: number = 7 * 24 * 60 * 60 * 1000; // 7 days
    private cleanupInterval?: NodeJS.Timeout;

    constructor() {
        super();
        this.initializeDefaultAlertRules();
        this.startCleanupProcess();
    }

    /**
     * Add a trace to the system
     */
    addTrace(trace: NetworkTrace): void {
        this.traces.push(trace);
        this.emit('trace', trace);

        // Convert trace to metrics
        this.extractMetricsFromTrace(trace);

        // Check for alerts
        this.checkAlertRules(trace);

        // Log important events
        if (trace.status === 'failure' || trace.operation === 'consensus') {
            console.log(`[TRACE] ${trace.operation}: ${trace.sourceNode} -> ${trace.targetNode || 'N/A'} (${trace.status})`);
        }
    }

    /**
     * Add a metric point
     */
    addMetric(metric: string, value: number, tags: Record<string, string> = {}): void {
        const metricPoint: MetricPoint = {
            timestamp: new Date(),
            metric,
            value,
            tags
        };

        this.metrics.push(metricPoint);
        this.emit('metric', metricPoint);
    }

    /**
     * Add an alert
     */
    addAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
        const fullAlert: Alert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            resolved: false,
            ...alert
        };

        this.alerts.push(fullAlert);
        this.emit('alert', fullAlert);

        console.warn(`[ALERT] ${fullAlert.severity.toUpperCase()}: ${fullAlert.title}`);
    }

    /**
     * Resolve an alert
     */
    resolveAlert(alertId: string): boolean {
        const alert = this.alerts.find(a => a.id === alertId && !a.resolved);
        if (alert) {
            alert.resolved = true;
            alert.resolvedAt = new Date();
            this.emit('alertResolved', alert);
            return true;
        }
        return false;
    }

    /**
     * Get traces with filtering
     */
    getTraces(filter?: TraceFilter): NetworkTrace[] {
        let filtered = [...this.traces];

        if (filter) {
            if (filter.nodeId) {
                filtered = filtered.filter(t =>
                    t.sourceNode === filter.nodeId || t.targetNode === filter.nodeId
                );
            }

            if (filter.operation) {
                filtered = filtered.filter(t => t.operation === filter.operation);
            }

            if (filter.status) {
                filtered = filtered.filter(t => t.status === filter.status);
            }

            if (filter.timeRange) {
                filtered = filtered.filter(t =>
                    t.timestamp >= filter.timeRange!.start &&
                    t.timestamp <= filter.timeRange!.end
                );
            }
        }

        // Sort by timestamp (newest first)
        filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // Apply pagination
        if (filter?.offset) {
            filtered = filtered.slice(filter.offset);
        }

        if (filter?.limit) {
            filtered = filtered.slice(0, filter.limit);
        }

        return filtered;
    }

    /**
     * Get metrics with filtering
     */
    getMetrics(metricName?: string, timeRange?: { start: Date; end: Date }, tags?: Record<string, string>): MetricPoint[] {
        let filtered = [...this.metrics];

        if (metricName) {
            filtered = filtered.filter(m => m.metric === metricName);
        }

        if (timeRange) {
            filtered = filtered.filter(m =>
                m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
            );
        }

        if (tags) {
            filtered = filtered.filter(m => {
                return Object.entries(tags).every(([key, value]) => m.tags[key] === value);
            });
        }

        return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    /**
     * Get active alerts
     */
    getActiveAlerts(): Alert[] {
        return this.alerts.filter(a => !a.resolved);
    }

    /**
     * Get network health status
     */
    getNetworkHealth(): NetworkHealth {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const recentTraces = this.getTraces({
            timeRange: { start: oneHourAgo, end: now }
        });

        // Calculate metrics
        const totalTraces = recentTraces.length;
        const successfulTraces = recentTraces.filter(t => t.status === 'success').length;
        const successRate = totalTraces > 0 ? (successfulTraces / totalTraces) * 100 : 100;

        const latencies = recentTraces
            .filter(t => t.latency !== undefined)
            .map(t => t.latency!);
        const avgLatency = latencies.length > 0
            ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
            : 0;

        const nodeMetrics = this.getMetrics('node_availability', { start: oneHourAgo, end: now });
        const nodeAvailability = nodeMetrics.length > 0
            ? nodeMetrics.reduce((sum, m) => sum + m.value, 0) / nodeMetrics.length
            : 100;

        const creditMetrics = this.getMetrics('credit_velocity', { start: oneHourAgo, end: now });
        const creditVelocity = creditMetrics.length > 0
            ? creditMetrics[creditMetrics.length - 1].value
            : 0;

        const consensusTraces = recentTraces.filter(t => t.operation === 'consensus');
        const consensusLatency = consensusTraces.length > 0
            ? consensusTraces.reduce((sum, t) => sum + (t.latency || 0), 0) / consensusTraces.length
            : 0;

        // Determine component health
        const connectivity = this.determineComponentHealth('connectivity', {
            successRate,
            avgLatency,
            nodeAvailability
        });

        const performance = this.determineComponentHealth('performance', {
            avgLatency,
            successRate
        });

        const consensus = this.determineComponentHealth('consensus', {
            consensusLatency,
            successRate: consensusTraces.filter(t => t.status === 'success').length / Math.max(1, consensusTraces.length) * 100
        });

        const creditSystem = this.determineComponentHealth('creditSystem', {
            creditVelocity,
            successRate
        });

        // Determine overall health
        const components = { connectivity, performance, consensus, creditSystem };
        const overall = this.determineOverallHealth(components);

        return {
            overall,
            components,
            metrics: {
                avgLatency,
                successRate,
                nodeAvailability,
                creditVelocity,
                consensusLatency
            },
            alerts: this.getActiveAlerts()
        };
    }

    /**
     * Get trace statistics
     */
    getTraceStats(timeRange?: { start: Date; end: Date }) {
        const traces = timeRange ? this.getTraces({ timeRange }) : this.traces;

        const byOperation = new Map<string, number>();
        const byStatus = new Map<string, number>();
        const byNode = new Map<string, number>();

        for (const trace of traces) {
            byOperation.set(trace.operation, (byOperation.get(trace.operation) || 0) + 1);
            byStatus.set(trace.status, (byStatus.get(trace.status) || 0) + 1);
            byNode.set(trace.sourceNode, (byNode.get(trace.sourceNode) || 0) + 1);
        }

        return {
            total: traces.length,
            byOperation: Object.fromEntries(byOperation),
            byStatus: Object.fromEntries(byStatus),
            byNode: Object.fromEntries(byNode),
            timeRange: timeRange || {
                start: traces[traces.length - 1]?.timestamp,
                end: traces[0]?.timestamp
            }
        };
    }

    /**
     * Get performance trends
     */
    getPerformanceTrends(hours: number = 24) {
        const now = new Date();
        const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
        const buckets = 20; // Divide time range into 20 buckets
        const bucketSize = (hours * 60 * 60 * 1000) / buckets;

        const trends = [];
        for (let i = 0; i < buckets; i++) {
            const bucketStart = new Date(start.getTime() + i * bucketSize);
            const bucketEnd = new Date(bucketStart.getTime() + bucketSize);

            const bucketTraces = this.getTraces({
                timeRange: { start: bucketStart, end: bucketEnd }
            });

            const successful = bucketTraces.filter(t => t.status === 'success').length;
            const total = bucketTraces.length;
            const latencies = bucketTraces
                .filter(t => t.latency !== undefined)
                .map(t => t.latency!);

            trends.push({
                timestamp: bucketStart,
                successRate: total > 0 ? (successful / total) * 100 : 100,
                avgLatency: latencies.length > 0
                    ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
                    : 0,
                throughput: total
            });
        }

        return trends;
    }

    /**
     * Export traces for external analysis
     */
    exportTraces(format: 'json' | 'csv' = 'json', filter?: TraceFilter): string {
        const traces = this.getTraces(filter);

        if (format === 'csv') {
            const headers = ['timestamp', 'operation', 'sourceNode', 'targetNode', 'status', 'latency', 'payload'];
            const rows = traces.map(t => [
                t.timestamp.toISOString(),
                t.operation,
                t.sourceNode,
                t.targetNode || '',
                t.status,
                t.latency || '',
                JSON.stringify(t.payload)
            ]);

            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }

        return JSON.stringify(traces, null, 2);
    }

    private extractMetricsFromTrace(trace: NetworkTrace): void {
        // Extract latency metrics
        if (trace.latency !== undefined) {
            this.addMetric(`${trace.operation}_latency`, trace.latency, {
                sourceNode: trace.sourceNode,
                targetNode: trace.targetNode || 'none',
                status: trace.status
            });
        }

        // Extract throughput metrics
        this.addMetric(`${trace.operation}_count`, 1, {
            sourceNode: trace.sourceNode,
            status: trace.status
        });

        // Extract error rates
        if (trace.status === 'failure') {
            this.addMetric('error_count', 1, {
                operation: trace.operation,
                sourceNode: trace.sourceNode,
                error: trace.errorMessage || 'unknown'
            });
        }
    }

    private checkAlertRules(trace: NetworkTrace): void {
        for (const rule of this.alertRules) {
            rule.check(trace, this);
        }
    }

    private initializeDefaultAlertRules(): void {
        // High latency alert
        this.alertRules.push({
            name: 'high_latency',
            check: (trace: NetworkTrace, tracer: NetworkTracer) => {
                if (trace.latency && trace.latency > 5000) { // 5 seconds
                    tracer.addAlert({
                        severity: 'high',
                        title: 'High Latency Detected',
                        description: `Operation ${trace.operation} took ${trace.latency}ms`,
                        sourceNode: trace.sourceNode,
                        tags: { operation: trace.operation, latency: trace.latency.toString() }
                    });
                }
            }
        });

        // Repeated failures alert
        this.alertRules.push({
            name: 'repeated_failures',
            check: (trace: NetworkTrace, tracer: NetworkTracer) => {
                if (trace.status === 'failure') {
                    const recentFailures = tracer.getTraces({
                        nodeId: trace.sourceNode,
                        status: 'failure',
                        timeRange: {
                            start: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
                            end: new Date()
                        }
                    });

                    if (recentFailures.length >= 5) {
                        tracer.addAlert({
                            severity: 'critical',
                            title: 'Node Experiencing Repeated Failures',
                            description: `Node ${trace.sourceNode} has ${recentFailures.length} failures in the last 5 minutes`,
                            sourceNode: trace.sourceNode,
                            tags: { failureCount: recentFailures.length.toString() }
                        });
                    }
                }
            }
        });

        // Consensus delays alert
        this.alertRules.push({
            name: 'consensus_delay',
            check: (trace: NetworkTrace, tracer: NetworkTracer) => {
                if (trace.operation === 'consensus' && trace.latency && trace.latency > 10000) {
                    tracer.addAlert({
                        severity: 'medium',
                        title: 'Consensus Delay',
                        description: `Consensus operation took ${trace.latency}ms to complete`,
                        tags: { latency: trace.latency.toString() }
                    });
                }
            }
        });
    }

    private determineComponentHealth(component: string, metrics: Record<string, number>): 'healthy' | 'degraded' | 'critical' {
        switch (component) {
            case 'connectivity':
                if (metrics.successRate < 50 || metrics.nodeAvailability < 50) return 'critical';
                if (metrics.successRate < 80 || metrics.nodeAvailability < 80) return 'degraded';
                return 'healthy';

            case 'performance':
                if (metrics.avgLatency > 10000 || metrics.successRate < 50) return 'critical';
                if (metrics.avgLatency > 5000 || metrics.successRate < 80) return 'degraded';
                return 'healthy';

            case 'consensus':
                if (metrics.consensusLatency > 30000 || metrics.successRate < 70) return 'critical';
                if (metrics.consensusLatency > 15000 || metrics.successRate < 90) return 'degraded';
                return 'healthy';

            case 'creditSystem':
                if (metrics.creditVelocity < 10 || metrics.successRate < 80) return 'degraded';
                return 'healthy';

            default:
                return 'healthy';
        }
    }

    private determineOverallHealth(components: Record<string, 'healthy' | 'degraded' | 'critical'>): 'healthy' | 'degraded' | 'critical' {
        const values = Object.values(components);

        if (values.some(v => v === 'critical')) return 'critical';
        if (values.some(v => v === 'degraded')) return 'degraded';
        return 'healthy';
    }

    private startCleanupProcess(): void {
        // Clean up old data every hour
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60 * 60 * 1000);
    }

    private cleanup(): void {
        const cutoff = new Date(Date.now() - this.retentionPeriod);

        this.traces = this.traces.filter(t => t.timestamp > cutoff);
        this.metrics = this.metrics.filter(m => m.timestamp > cutoff);

        // Keep resolved alerts for 24 hours
        const alertCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.alerts = this.alerts.filter(a =>
            !a.resolved || (a.resolvedAt && a.resolvedAt > alertCutoff)
        );
    }

    /**
     * Stop the tracer and cleanup
     */
    stop(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

interface AlertRule {
    name: string;
    check: (trace: NetworkTrace, tracer: NetworkTracer) => void;
}
