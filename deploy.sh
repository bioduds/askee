#!/bin/bash
# Build and deploy Askee distributed spider system

set -e

echo "🕷️  Building Askee Benevolent Spider System..."

# Build the main application
echo "📦 Building Docker image..."
docker build -t askee:latest .

# Create necessary directories for volumes
echo "📁 Creating data directories..."
mkdir -p ./data/primary/{ledger,logs,cache}
mkdir -p ./data/secondary/{ledger,logs,cache}
mkdir -p ./data/postgres
mkdir -p ./data/redis
mkdir -p ./data/prometheus
mkdir -p ./data/grafana

# Set proper permissions
echo "🔒 Setting permissions..."
chmod -R 755 ./data

# Start the distributed system
echo "🚀 Starting distributed Askee system..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to initialize..."
sleep 10

# Check health of primary services
echo "🏥 Checking service health..."

# Check primary node
if curl -f http://localhost:8080/health >/dev/null 2>&1; then
    echo "✅ Primary node is healthy"
else
    echo "❌ Primary node health check failed"
fi

# Check secondary node
if curl -f http://localhost:8180/health >/dev/null 2>&1; then
    echo "✅ Secondary node is healthy"
else
    echo "❌ Secondary node health check failed"
fi

# Check Redis
if docker exec askee-redis redis-cli ping >/dev/null 2>&1; then
    echo "✅ Redis is healthy"
else
    echo "❌ Redis health check failed"
fi

# Check PostgreSQL
if docker exec askee-postgres pg_isready -U askee >/dev/null 2>&1; then
    echo "✅ PostgreSQL is healthy"
else
    echo "❌ PostgreSQL health check failed"
fi

echo ""
echo "🎉 Askee Distributed Spider System is deployed!"
echo ""
echo "📊 Services available at:"
echo "   • Primary Node API:    http://localhost:8080"
echo "   • Secondary Node API:  http://localhost:8180"
echo "   • Grafana Dashboard:   http://localhost:3000 (admin/askee_admin)"
echo "   • Prometheus Metrics:  http://localhost:9090"
echo "   • Redis:               localhost:6379"
echo "   • PostgreSQL:          localhost:5432 (askee/askee_secure_password)"
echo ""
echo "🕸️  Ready for web crawling and distributed AI work!"
echo ""
echo "📝 Next steps:"
echo "   1. Configure crawl targets via API"
echo "   2. Deploy additional nodes as needed"
echo "   3. Monitor system health via Grafana"
echo "   4. Scale horizontally by adding more docker-compose nodes"
