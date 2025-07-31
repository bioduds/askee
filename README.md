# Askee AI Network

🤖 A distributed AI hosting network where users contribute AI models and access collective intelligence through dynamic orchestration.

## Overview

Askee is a **distributed AI hosting network** that allows users to host AI models locally using Ollama while sharing access to a collective network of AI capabilities. Users can run AI models on their own machines and, when their local resources are insufficient, seamlessly access models hosted by other network participants.

### Key Features

- 🤖 **Local AI Hosting** - Run AI models locally using Ollama integration
- 🌐 **Network Intelligence** - Access AI models from other network participants  
- ⚡ **Dynamic Orchestration** - Automatically route requests to the best available node
- 📊 **Real-time Monitoring** - Web dashboard for node status and network health
- 🔄 **Automatic Discovery** - Nodes automatically find and connect to each other
- 💬 **Chat Interface** - Browser-based chat interface using the network
- 📈 **Performance Metrics** - Track request success rates, response times, and node loads

## Architecture

The system is built around the concept of **AI hosting nodes** that each run:

1. **Ollama Service**: Hosts AI models locally (LLaMA, Mistral, CodeLlama, etc.)
2. **Node Agent**: Manages the node, handles requests, and discovers other nodes
3. **React Frontend**: Web interface for chat and node management
4. **Network Layer**: Handles inter-node communication and request routing

### Core Components

```text
src/
├── services/
│   ├── ollama.ts           # Ollama integration for local AI models
│   ├── network.ts          # Network discovery and communication
│   ├── database.ts         # Node and chat history storage
│   ├── health.ts           # System health monitoring
│   └── metrics.ts          # Performance metrics collection
├── node-agent.ts           # Main node agent server
└── simple-node-agent.ts    # Simplified standalone version

frontend/
├── src/
│   ├── components/
│   │   ├── Chat.tsx        # AI chat interface
│   │   ├── NodeStatus.tsx  # Node health dashboard
│   │   ├── Network.tsx     # Network overview
│   │   ├── Models.tsx      # AI model management
│   │   └── Settings.tsx    # Node configuration
│   └── App.tsx             # Main React application
└── package.json

docker-compose.ollama.yml   # Complete infrastructure setup
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for full setup)
- Ollama (for local AI models)

### Option 1: Simple Node (Standalone)

```bash
# Clone the repository
git clone https://github.com/bioduds/askee.git
cd askee

# Install dependencies
npm install

# Start the simple node agent (no database required)
npm run dev:simple

# Access the web interface
open http://localhost:3001
```

### Option 2: Full Node (With Database)

```bash
# Clone the repository
git clone https://github.com/bioduds/askee.git
cd askee

# Start the complete infrastructure
docker-compose -f docker-compose.ollama.yml up -d

# Install dependencies and build
npm install
npm run build

# Start the node agent
npm run start:node

# Access the web interface
open http://localhost:8080
```

### Option 3: Development Setup

```bash
# Clone the repository
git clone https://github.com/bioduds/askee.git
cd askee

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Set up environment
cp .env.example .env

# Start development servers
npm run dev:node          # Start node agent (terminal 1)
cd frontend && npm start   # Start React frontend (terminal 2)
```

## Using the Network

### 1. Install Ollama Models

First, install Ollama and pull some models:

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama service
ollama serve

# Pull some models (in another terminal)
ollama pull llama3.2:latest
ollama pull mistral:latest
ollama pull codellama:latest
```

### 2. Start Your Node

Run your Askee node to join the network:

```bash
npm run dev:simple
```

### 3. Access the Web Interface

Open your browser to `http://localhost:3001` (simple node) or `http://localhost:8080` (full node).

### 4. Start Chatting

- Use the **Chat** tab to interact with AI models
- Visit the **Node Status** tab to monitor your node's health
- Check the **Network** tab to see other connected nodes
- Manage models in the **Models** tab
- Configure settings in the **Settings** tab

## API Endpoints

The node agent exposes a REST API for programmatic access:

```bash
# Get node information
curl http://localhost:3001/api/node/info

# Chat with AI models
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'

# Get available models
curl http://localhost:3001/api/models

# Get network status
curl http://localhost:3001/api/network/status

# Get node health
curl http://localhost:3001/health

# Get performance metrics
curl http://localhost:3001/api/metrics
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Node Configuration
NODE_ID=askee-node-dev
NODE_PORT=8080
NODE_ENDPOINT=http://localhost:8080

# Ollama Configuration  
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TIMEOUT=30000

# Database Configuration (for full setup)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=askee_network
DB_USER=askee
DB_PASSWORD=askee_password

# Logging
LOG_LEVEL=info

# CORS Origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

### Docker Configuration

For production deployment, use the provided Docker Compose setup:

```yaml
# docker-compose.ollama.yml includes:
- Ollama service with GPU support
- PostgreSQL database
- Redis cache  
- Prometheus metrics
- Grafana dashboards
- Node agent with web interface
```

## How It Works

### Network Discovery

1. Nodes register themselves in a shared database
2. Each node periodically discovers other active nodes
3. Health checks ensure only online nodes are available
4. Load balancing routes requests to the best available node

### Request Routing

1. User sends a chat message through the web interface
2. Node agent tries to fulfill the request locally using Ollama
3. If local models are unavailable or overloaded, route to network
4. Response is returned to the user with model attribution

### Model Management

- **Local Models**: Managed through Ollama, displayed in the Models tab
- **Network Models**: Automatically discovered from other nodes
- **Model Pulling**: Pull new models directly through the web interface
- **Resource Monitoring**: Track model usage and performance

## Network Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Node A        │    │   Node B        │    │   Node C        │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ React UI    │ │    │ │ React UI    │ │    │ │ React UI    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Node Agent  │◄┼────┼►│ Node Agent  │◄┼────┼►│ Node Agent  │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Ollama      │ │    │ │ Ollama      │ │    │ │ Ollama      │ │
│ │ llama3.2    │ │    │ │ mistral     │ │    │ │ codellama   │ │
│ │ mistral     │ │    │ │ phi3        │ │    │ │ gemma2      │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Database      │
                    │   (PostgreSQL)  │
                    │                 │
                    │ • Node Registry │
                    │ • Chat History  │
                    │ • Metrics       │
                    └─────────────────┘
```

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Development Workflow

```bash
# Set up development environment
git clone https://github.com/bioduds/askee.git
cd askee
npm install

# Make changes to the code
# ...

# Build and test
npm run build
npm test

# Start development servers
npm run dev:node      # Backend
npm run dev:frontend  # Frontend (separate terminal)
```

## Roadmap

- [ ] **Model Marketplace** - Browse and install models from community
- [ ] **Credit System** - Earn credits for hosting, spend for usage
- [ ] **Advanced Routing** - Specialized model routing based on request type
- [ ] **Security Layer** - Authentication and authorization for network access
- [ ] **Mobile App** - Native mobile client for the network
- [ ] **Edge Deployment** - Deploy nodes on edge devices and IoT
- [ ] **Federation** - Connect multiple Askee networks
- [ ] **Plugin System** - Extend functionality with custom plugins

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 📝 **Documentation**: [GitHub Wiki](https://github.com/bioduds/askee/wiki)
- 🐛 **Issues**: [GitHub Issues](https://github.com/bioduds/askee/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/bioduds/askee/discussions)
- 📧 **Email**: Contact us via GitHub for support requests

---

**Askee AI Network** - Democratizing AI through distributed intelligence 🤖✨
