# Askee Testing Network & Traceability

This document explains how to use the comprehensive testing network and traceability features in the Askee system.

## 🧪 Testing Network

The testing network provides a complete simulated multi-node environment for testing distributed behaviors without deploying to real infrastructure.

### Features

- **Realistic Network Topology**: Seed nodes, worker nodes, and client nodes with authentic connection patterns
- **Resource Simulation**: CPU, memory, storage, and GPU resource modeling
- **Task Execution**: Simulated AI workload processing with credit transactions
- **Network Events**: Node failures, recoveries, and dynamic topology changes
- **Credit Economy**: Full credit earning, spending, and transfer simulation

### Network Architecture

```
Seed Nodes (2)
├── seed-test-001 (us-east-test)  - 16 cores, 32GB RAM, RTX 4090
└── seed-test-002 (eu-west-test)  - 12 cores, 16GB RAM

Worker Nodes (5)
├── worker-test-001 (eu-central-test)  - 6-16 cores, 8-18GB RAM
├── worker-test-002 (asia-pacific-test)
├── worker-test-003 (us-west-test)
├── worker-test-004 (eu-central-test)
└── worker-test-005 (asia-pacific-test)

Client Nodes (10)
├── client-test-001-010 - Various regions
└── 2-4 cores, 4GB RAM, basic resources
```

### API Endpoints

#### Network Status

```bash
GET /testing/network/status
```

Returns comprehensive network statistics including node counts, connections, credits, and reputation scores.

#### Network Topology

```bash
GET /testing/network/topology
```

Returns the complete network graph with nodes and connections for visualization.

#### Node Details

```bash
GET /testing/network/nodes/{nodeId}
```

Get detailed information about a specific node including resources, connections, and tracing history.

#### Task Simulation

```bash
POST /testing/network/simulate-task
{
  "clientId": "client-test-001",
  "taskType": "inference",
  "credits": 150
}
```

Simulate an AI workload execution with credit transactions and realistic latency.

#### Network Control

```bash
POST /testing/network/start   # Start network simulation
POST /testing/network/stop    # Stop network simulation
```

### Usage Examples

#### Enable Testing Network

```bash
# Start server with testing network enabled
ASKEE_ENABLE_TESTING_NETWORK=true npm run server
```

#### Check Network Status

```bash
curl http://localhost:8080/testing/network/status | jq '.'
```

#### Simulate AI Tasks

```bash
# Run inference task
curl -X POST http://localhost:8080/testing/network/simulate-task \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-test-003", "taskType": "inference", "credits": 100}'

# Run image generation task
curl -X POST http://localhost:8080/testing/network/simulate-task \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-test-007", "taskType": "image_generation", "credits": 200}'
```

## 📈 Network Traceability

The tracing system provides comprehensive observability into all network operations with automatic metric collection and alerting.

### Trace Types

- **Discovery**: Node joining, leaving, connection establishment
- **Task**: AI workload execution, task routing, completion
- **Credit Transfer**: Payment flows, balance updates, refunds
- **Consensus**: Network agreement, voting, finalization
- **Connection**: Node connectivity, latency, failures

### Trace Data Structure

```typescript
interface NetworkTrace {
  id: string;                    // Unique trace identifier
  timestamp: Date;               // When the event occurred
  sourceNode: string;            // Originating node
  targetNode?: string;           // Destination node (if applicable)
  operation: string;             // Type of operation
  payload: any;                  // Operation-specific data
  status: 'success' | 'failure' | 'pending';
  latency?: number;              // Operation duration in ms
  errorMessage?: string;         // Error details if failed
}
```

### API Endpoints

#### Get Traces

```bash
GET /tracing/traces?nodeId=client-test-001&operation=task&limit=50
```

**Query Parameters:**

- `nodeId`: Filter by source or target node
- `operation`: Filter by operation type (discovery, task, credit_transfer, consensus, connection)
- `status`: Filter by status (success, failure, pending)
- `since`: ISO timestamp for start of time range
- `until`: ISO timestamp for end of time range
- `limit`: Maximum number of traces to return (default: 100)
- `offset`: Pagination offset

#### Network Health

```bash
GET /tracing/health
```

Returns overall network health status with component-level assessments:

```json
{
  "overall": "healthy",
  "components": {
    "connectivity": "healthy",
    "performance": "degraded", 
    "consensus": "healthy",
    "creditSystem": "healthy"
  },
  "metrics": {
    "avgLatency": 250.5,
    "successRate": 98.7,
    "nodeAvailability": 95.2,
    "creditVelocity": 12500,
    "consensusLatency": 850.2
  },
  "alerts": []
}
```

#### Trace Statistics

```bash
GET /tracing/stats?hours=24
```

Aggregate statistics over specified time period:

```json
{
  "total": 1456,
  "byOperation": {
    "task": 892,
    "discovery": 234,
    "credit_transfer": 267,
    "consensus": 63
  },
  "byStatus": {
    "success": 1398,
    "failure": 34,
    "pending": 24
  },
  "byNode": {
    "worker-test-001": 456,
    "client-test-003": 234,
    "seed-test-001": 187
  }
}
```

#### Performance Trends

```bash
GET /tracing/trends?hours=24
```

Historical performance data in time buckets for charting:

```json
{
  "trends": [
    {
      "timestamp": "2025-07-30T01:00:00.000Z",
      "successRate": 98.5,
      "avgLatency": 245.2,
      "throughput": 67
    }
  ]
}
```

#### Active Alerts

```bash
GET /tracing/alerts
```

Current system alerts requiring attention:

```json
{
  "alerts": [
    {
      "id": "alert-1753844123456-abc123",
      "severity": "high",
      "title": "High Latency Detected",
      "description": "Operation task took 8500ms",
      "timestamp": "2025-07-30T02:45:33.456Z",
      "sourceNode": "worker-test-003",
      "tags": {
        "operation": "task",
        "latency": "8500"
      },
      "resolved": false
    }
  ]
}
```

#### Resolve Alert

```bash
POST /tracing/alerts/{alertId}/resolve
```

#### Export Traces

```bash
GET /tracing/export?format=csv&operation=task&limit=1000
GET /tracing/export?format=json&since=2025-07-30T00:00:00Z
```

**Formats:**

- `json`: Structured JSON export for programmatic analysis
- `csv`: Comma-separated values for spreadsheet analysis

### Automated Alerting

The system includes built-in alert rules:

#### High Latency Alert

- **Trigger**: Any operation takes > 5 seconds
- **Severity**: High
- **Action**: Immediate notification

#### Repeated Failures Alert  

- **Trigger**: ≥5 failures from same node in 5 minutes
- **Severity**: Critical
- **Action**: Node investigation recommended

#### Consensus Delay Alert

- **Trigger**: Consensus operations take > 10 seconds
- **Severity**: Medium
- **Action**: Network performance review

### Health Assessment

The system continuously evaluates component health:

#### Connectivity Health

- **Healthy**: >90% success rate, >90% node availability
- **Degraded**: 70-90% success rate or availability
- **Critical**: <70% success rate or availability

#### Performance Health

- **Healthy**: <2s average latency, >90% success rate
- **Degraded**: 2-5s latency or 70-90% success rate
- **Critical**: >5s latency or <70% success rate

#### Consensus Health

- **Healthy**: <10s consensus time, >95% success rate
- **Degraded**: 10-20s consensus time or 85-95% success rate
- **Critical**: >20s consensus time or <85% success rate

## 🔍 Usage Scenarios

### Development Testing

1. Enable testing network during development
2. Simulate various network conditions
3. Test task distribution algorithms
4. Validate credit system mechanics
5. Debug consensus protocols

### Performance Analysis

1. Run load tests with simulated tasks
2. Monitor latency trends over time
3. Identify performance bottlenecks
4. Optimize resource allocation
5. Test scaling behavior

### Reliability Testing

1. Simulate node failures and recoveries
2. Test network partition scenarios
3. Validate fault tolerance mechanisms
4. Measure recovery times
5. Test Byzantine fault tolerance

### Economic Modeling

1. Analyze credit flow patterns
2. Test pricing mechanisms
3. Model market dynamics
4. Validate economic incentives
5. Test fraud detection

## 📊 Monitoring Dashboard

The system provides real-time monitoring capabilities:

### Key Metrics

- **Network Health**: Overall system status
- **Node Status**: Online/offline node tracking
- **Task Throughput**: Tasks completed per minute
- **Credit Velocity**: Credit transfers per hour
- **Error Rates**: Failure percentages by operation
- **Latency Distribution**: Response time percentiles

### Visualization Features

- **Network Topology Graph**: Interactive node and connection visualization
- **Performance Charts**: Time-series latency and throughput graphs
- **Health Dashboard**: Component status indicators
- **Alert Timeline**: Historical alert tracking
- **Credit Flow Diagram**: Economic activity visualization

## 🚀 Getting Started

### 1. Enable Testing Network

```bash
export ASKEE_ENABLE_TESTING_NETWORK=true
npm run server
```

### 2. Check Network Status

```bash
curl http://localhost:8080/testing/network/status
```

### 3. Simulate Some Tasks

```bash
curl -X POST http://localhost:8080/testing/network/simulate-task \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-test-001", "taskType": "inference"}'
```

### 4. Monitor Traces

```bash
curl http://localhost:8080/tracing/traces
curl http://localhost:8080/tracing/health
```

### 5. Export Analysis Data

```bash
curl "http://localhost:8080/tracing/export?format=csv" > traces.csv
```

This comprehensive testing and traceability system enables thorough validation of the Askee network's distributed behaviors, performance characteristics, and economic mechanisms.
