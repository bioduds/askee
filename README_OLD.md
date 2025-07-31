# Askee - Benevolent Spider Distributed Agent System

🕷️ A consensual distributed computing platform with cryptographic consent tokens and credit-based resource sharing.

## Overview

Askee implements a **consensual distributed computing system** where users can voluntarily share their idle computing resources and earn credits, which they can then spend to run computational tasks on the network. The system ensures **explicit consent** at every step through cryptographic tokens and maintains **economic incentives** through a credit-based economy.

### Key Features

- 🔐 **Cryptographic Consent Tokens** - Ed25519-signed tokens ensuring explicit user consent
- 🕸️ **Opt-in Discovery System** - DNS TXT records, Well-known URLs, and QR codes for network discovery
- 💰 **Credit Economy** - Users earn credits by sharing resources and spend credits to consume resources
- 🏗️ **OS-specific Sandboxing** - Secure execution environments with resource limits
- ⚖️ **Formal Verification** - TLA+ specification ensuring system correctness and safety
- 🔄 **Byzantine Fault Tolerance** - Redundant verification and reputation-based task distribution

## Architecture

The system is built on several core principles:

1. **Explicit Consent**: Every resource sharing action requires a cryptographically signed consent token
2. **Economic Incentives**: Users are rewarded with credits for contributing resources
3. **Security First**: All operations are sandboxed with strict resource limits
4. **Formal Verification**: TLA+ specification ensures correctness of the distributed protocol

### Core Components

```
src/
├── core/
│   ├── types.ts                 # Core type definitions
│   ├── consent-token-manager.ts # Token lifecycle management
│   ├── credit-manager.ts        # Credit economy implementation
│   └── credit-types.ts          # Credit system types
├── crypto/
│   └── crypto-manager.ts        # Ed25519 cryptographic operations
├── discovery/
│   └── discovery-manager.ts     # Opt-in network discovery
└── index.ts                     # Main system demonstration

packages/
└── accounting/                  # Standalone accounting package
    ├── src/
    │   ├── types.ts            # Ledger and balance types
    │   ├── ledger.ts           # In-memory ledger implementation
    │   ├── pricing.ts          # Dynamic pricing engine
    │   └── index.ts            # Package exports
    └── package.json

plans/
└── feature-*/
    └── tla/
        ├── BenevolentSpiderSystem.tla  # TLA+ specification
        └── BenevolentSpiderSystem.cfg  # TLC model checker config
```

## Getting Started

### Prerequisites

- Node.js 18+ (ES2022 modules support)
- TypeScript 5.5+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/bioduds/askee.git
cd askee

# Install dependencies
npm install

# Build the project
npm run build

# Run the demonstration
npm start
```

### Quick Demo

The system includes comprehensive demonstrations:

```bash
npm start
```

This will run three demonstrations:

1. **Basic Workflow** - Discovery → Verification → Token Issuance → Validation
2. **Multi-User Scenario** - Multiple users with different permission levels
3. **Credit Economy** - Resource contribution, credit earning, and task execution

## Credit Economy

### How It Works

1. **Resource Contribution**: Users share idle resources (CPU, RAM, Storage, Bandwidth)
2. **Credit Earning**: Contributors earn credits based on:
   - Resource type (CPU: 1.5x, Storage: 1.0x, etc.)
   - Amount provided and duration
   - Utilization rate (how much was actually used)
   - User reputation (0.8x to 1.0x multiplier)

3. **Credit Spending**: Users spend credits to run computational tasks
4. **Dynamic Pricing**: Pricing adjusts based on supply and demand

### Base Rates

```typescript
const baseRates = {
  CPU: 0.02,        // credits per core per second
  RAM: 0.001,       // credits per MB per second
  Storage: 0.0001,  // credits per GB per second
  Bandwidth: 0.005  // credits per Mbps per second
};
```

### Example Credit Flow

```typescript
// Alice contributes 4 CPU cores for 1 hour at 75% utilization
const contribution = {
  nodeId: 'alice_node_1',
  userId: 'alice',
  resourceType: 'CPU',
  amountProvided: 4,
  duration: 3600,
  utilizationRate: 0.75
};

// Alice earns: 4 cores × 3600s × 0.02 rate × 0.75 utilization × 1.5 multiplier = 324 credits
const creditsEarned = await creditManager.earnCredits(contribution);
```

## Consent Token System

### Token Lifecycle

1. **Discovery**: Users publish discovery signals on DNS, Well-known URLs, or QR codes
2. **Verification**: System cryptographically verifies the discovery signals
3. **Token Issuance**: Verified users can request consent tokens with specific permissions
4. **Validation**: Tokens are validated before any resource access
5. **Revocation**: Tokens can be revoked at any time

### Token Structure

```typescript
interface ConsentToken {
  tokenId: string;
  userId: string;
  permissions: TaskPermissions;
  resourceLimits: ResourceLimits;
  expiresAt: Date;
  issuedAt: Date;
  revoked: boolean;
  signature: string; // Ed25519 signature
}
```

### Example Usage

```typescript
// Request a consent token
const tokenRequest = {
  userId: 'user123',
  requestedPermissions: {
    ml_training: true,
    data_processing: true,
    scientific_compute: false
  },
  requestedLimits: {
    CPU: 50,      // 50% CPU
    RAM: 2048,    // 2GB RAM
    Storage: 10,  // 10GB Storage
    Bandwidth: 100 // 100 Mbps
  },
  duration: 24, // 24 hours
  verificationChannel: 'DNS'
};

const token = await consentTokenManager.issueConsentToken(
  tokenRequest,
  verifiedInvitations
);
```

## Formal Verification

The system includes a complete TLA+ specification that models:

- **Discovery and verification protocols**
- **Consent token lifecycle**
- **Credit economy operations**
- **Byzantine fault tolerance**
- **Resource usage and limits**

### Key Invariants

- **NonNegativeBalances**: User credit balances never go negative
- **Conservation**: Credits are only earned for verified tasks
- **NoDoubleEarn**: Users cannot earn credits twice for the same task
- **ConsentBound**: All operations require valid consent tokens
- **ResourceBounds**: Resource usage never exceeds sandbox limits

### Running TLC Model Checker

```bash
cd plans/feature-*/tla/
java -jar tla2tools.jar -modelcheck -workers 4 BenevolentSpiderSystem.tla
```

## Security Features

### Sandboxing

- **OS-specific containers** (Docker on Linux, Hyper-V on Windows)
- **Resource limits** enforced at the OS level
- **Network isolation** for untrusted code
- **File system restrictions** with read-only access where appropriate

### Cryptographic Security

- **Ed25519 signatures** for all consent tokens
- **SHA-256 hashing** for data integrity
- **Public key cryptography** for user identification
- **Replay attack protection** through timestamps and nonces

### Byzantine Fault Tolerance

- **Redundant task execution** across multiple nodes
- **Consensus-based result verification**
- **Reputation scoring** based on successful task completions
- **Automatic node suspension** for detected security violations

## API Reference

### CryptoManager

```typescript
class CryptoManager {
  constructor(privateKey?: Uint8Array);
  getPublicKey(): Uint8Array;
  getPublicKeyHex(): string;
  signConsentToken(token: ConsentToken): Promise<string>;
  verifyConsentToken(token: ConsentToken, publicKey?: Uint8Array): Promise<boolean>;
  isTokenExpired(token: ConsentToken): boolean;
}
```

### CreditManager

```typescript
class CreditManager {
  async earnCredits(contribution: Omit<ResourceContribution, 'creditsEarned'>): Promise<number>;
  async spendCredits(consumption: Omit<ResourceConsumption, 'creditsSpent'>): Promise<boolean>;
  async canAffordTask(userId: string, requirements: ResourceLimits, duration: number): Promise<boolean>;
  async getBalance(userId: string): Promise<CreditBalance>;
  async getNetworkStats(): Promise<NetworkStats>;
}
```

### ConsentTokenManager

```typescript
class ConsentTokenManager {
  async issueConsentToken(request: ConsentTokenRequest, invitations: VerifiedInvitation[]): Promise<ConsentToken | null>;
  async validateTokenForTask(token: ConsentToken, taskType: string, requirements: ResourceLimits, issuerPublicKey: Uint8Array): Promise<boolean>;
  async revokeConsentToken(userId: string, tokenId: string): Promise<boolean>;
  getActiveTokens(userId: string): ConsentToken[];
}
```

## Development

### Project Structure

- **TypeScript** with ES2022 modules
- **Strict type checking** enabled
- **Comprehensive error handling**
- **Modular architecture** ready for microservices

### Building

```bash
npm run build    # Compile TypeScript
npm start        # Run demonstration
npm test         # Run tests (when implemented)
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. **Write TLA+ specification** for new features
4. **Verify with TLC** model checker
5. Implement in TypeScript
6. Add comprehensive tests
7. Submit pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- **TLA+** by Leslie Lamport for formal verification
- **@noble/ed25519** for cryptographic primitives
- **The "Benevolent Spider" concept** for consensual distributed computing

## Roadmap

- [ ] **Docker integration** for production sandboxing
- [ ] **Kubernetes deployment** for scalable infrastructure
- [ ] **Web UI** for user interaction
- [ ] **Mobile app** with QR code discovery
- [ ] **Smart contract integration** for transparent credit accounting
- [ ] **Machine learning workload** optimization
- [ ] **Real-time resource monitoring** and alerting

---

**Built with ❤️ for consensual distributed computing**
