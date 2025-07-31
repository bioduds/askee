/**
 * Consent Token Types and Interfaces
 * Based on the TLA+ specification for the Benevolent Spider System
 */

export interface ConsentToken {
    tokenId: string;
    userId: string;
    permissions: TaskPermissions;
    resourceLimits: ResourceLimits;
    expiresAt: Date;
    issuedAt: Date;
    revoked: boolean;
    signature: string; // Ed25519 signature
}

export interface TaskPermissions {
    ml_training: boolean;
    data_processing: boolean;
    scientific_compute: boolean;
    [taskType: string]: boolean;
}

export interface ResourceLimits {
    CPU: number; // percentage (0-100)
    RAM: number; // MB
    Storage: number; // GB
    Bandwidth: number; // Mbps
    [resource: string]: number;
}

export interface ConsentTokenRequest {
    userId: string;
    requestedPermissions: TaskPermissions;
    requestedLimits: ResourceLimits;
    duration: number; // hours
    verificationChannel: DiscoveryChannel;
}

export type DiscoveryChannel = 'DNS' | 'WebKnown' | 'QR';

export interface VerifiedInvitation {
    userId: string;
    channel: DiscoveryChannel;
    verifiedAt: Date;
    signature: string;
}

export interface NodeProfile {
    nodeId: string;
    osType: 'linux' | 'windows' | 'macos';
    cpuCores: number;
    memoryMB: number;
    storageGB: number;
    containerSupport: boolean;
    owner: string;
    reputation: number; // 0-100
}

export interface SandboxConfig {
    nodeId: string;
    osType: 'linux' | 'windows' | 'macos';
    limits: ResourceLimits;
    securityPolicy: 'strict' | 'permissive';
    monitoringEnabled: boolean;
    containerConfig?: LinuxContainerConfig | WindowsJobConfig | MacOSTaskConfig;
}

export interface LinuxContainerConfig {
    cgroupPath: string;
    namespace: string;
    seccompProfile: string;
}

export interface WindowsJobConfig {
    jobName: string;
    processLimits: {
        activeProcessLimit: number;
        priorityClass: number;
    };
}

export interface MacOSTaskConfig {
    taskPolicy: string;
    priorityBand: number;
}

export interface TaskDefinition {
    taskId: string;
    taskType: keyof TaskPermissions;
    workloadHash: string;
    requiredResources: ResourceLimits;
    maxExecutionTime: number; // seconds
    replicationFactor: number;
    allowedNodes?: string[]; // if specified, restrict to these nodes
}

export interface TaskResult {
    taskId: string;
    nodeId: string;
    result: any;
    executionTime: number;
    resourceUsage: ResourceLimits;
    status: 'success' | 'failure' | 'timeout';
    timestamp: Date;
}

export interface SecurityViolation {
    nodeId: string;
    violationType: 'unauthorized_access' | 'resource_violation' | 'process_violation';
    details: string;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export enum NodeState {
    UNREGISTERED = 'unregistered',
    ASSESSING = 'assessing',
    SANDBOXED = 'sandboxed',
    ACTIVE = 'active',
    COMPROMISED = 'compromised'
}
