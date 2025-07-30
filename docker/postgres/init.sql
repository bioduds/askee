-- Initialize Askee database schema
-- This script sets up the core tables for the distributed credit system

BEGIN;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_crypto";

-- Create schema for Askee
CREATE SCHEMA IF NOT EXISTS askee;

-- Set search path
SET search_path TO askee, public;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_level INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

-- Ledger table for all credit transactions
CREATE TABLE IF NOT EXISTS ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    amount_mcc BIGINT NOT NULL, -- milli-credits (precision: 1000 = 1 credit)
    transaction_type VARCHAR(50) NOT NULL,
    reference_id UUID, -- Links to other transactions (refunds, etc.)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure valid transaction types
    CONSTRAINT valid_transaction_type CHECK (
        transaction_type IN ('initial', 'earned', 'spent', 'reserved', 'redeemed', 'refunded', 'bonus', 'penalty')
    )
);

-- Nodes table for distributed network
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id VARCHAR(255) NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p2p_port INTEGER NOT NULL,
    discovery_port INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    capabilities JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_node_status CHECK (
        status IN ('active', 'inactive', 'maintenance', 'banned')
    )
);

-- Work requests table for distributed task coordination
CREATE TABLE IF NOT EXISTS work_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id),
    node_id UUID REFERENCES nodes(id),
    work_type VARCHAR(100) NOT NULL,
    work_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    cost_mcc BIGINT NOT NULL,
    reserved_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_work_status CHECK (
        status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'expired', 'cancelled')
    )
);

-- Web crawling targets for spider work
CREATE TABLE IF NOT EXISTS crawl_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    crawl_depth INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending',
    last_crawled TIMESTAMP WITH TIME ZONE,
    next_crawl TIMESTAMP WITH TIME ZONE,
    crawl_interval INTERVAL DEFAULT '24 hours',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_crawl_status CHECK (
        status IN ('pending', 'crawling', 'completed', 'failed', 'banned', 'paused')
    )
);

-- Crawled data storage
CREATE TABLE IF NOT EXISTS crawled_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_id UUID NOT NULL REFERENCES crawl_targets(id),
    node_id UUID NOT NULL REFERENCES nodes(id),
    url TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    content_type VARCHAR(100),
    content_size BIGINT,
    content_data JSONB,
    extracted_links TEXT[],
    crawled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate content
    UNIQUE(url, content_hash)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_public_key ON users(public_key);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(is_verified);
CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction_type ON ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_nodes_node_id ON nodes(node_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_work_requests_status ON work_requests(status);
CREATE INDEX IF NOT EXISTS idx_work_requests_requester_id ON work_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_work_requests_node_id ON work_requests(node_id);
CREATE INDEX IF NOT EXISTS idx_crawl_targets_domain ON crawl_targets(domain);
CREATE INDEX IF NOT EXISTS idx_crawl_targets_status ON crawl_targets(status);
CREATE INDEX IF NOT EXISTS idx_crawl_targets_next_crawl ON crawl_targets(next_crawl);
CREATE INDEX IF NOT EXISTS idx_crawled_data_target_id ON crawled_data(target_id);
CREATE INDEX IF NOT EXISTS idx_crawled_data_url ON crawled_data(url);

-- Create functions for credit balance calculation
CREATE OR REPLACE FUNCTION get_user_balance_mcc(user_uuid UUID)
RETURNS BIGINT AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(amount_mcc) FROM ledger WHERE user_id = user_uuid),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to validate credit conservation
CREATE OR REPLACE FUNCTION validate_credit_conservation()
RETURNS BOOLEAN AS $$
DECLARE
    total_credits BIGINT;
BEGIN
    SELECT SUM(amount_mcc) INTO total_credits FROM ledger;
    
    -- Log the total for monitoring
    INSERT INTO system_logs (level, message, metadata)
    VALUES ('info', 'Credit conservation check', jsonb_build_object('total_mcc', total_credits));
    
    -- Return true if total is non-negative (credits can only be created through initial/earned transactions)
    RETURN total_credits >= 0;
END;
$$ LANGUAGE plpgsql;

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);

-- Insert initial system user (for system operations)
INSERT INTO users (id, public_key, is_verified, verification_level, metadata)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'system_key',
    true,
    100,
    '{"role": "system", "description": "System account for internal operations"}'
) ON CONFLICT (public_key) DO NOTHING;

COMMIT;

-- Grant permissions
GRANT USAGE ON SCHEMA askee TO askee;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA askee TO askee;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA askee TO askee;
