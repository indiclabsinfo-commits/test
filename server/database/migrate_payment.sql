-- Payment System Migration
-- Run this against existing database to add payment tables

-- ============================================
-- ALTER USERS TABLE
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_balance BIGINT DEFAULT 100000000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo_mode BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(15);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Set existing users: copy their current balance to demo_balance, zero out real balance
UPDATE users SET demo_balance = balance, balance = 0 WHERE demo_balance IS NULL OR demo_balance = 100000000;

-- ============================================
-- AGENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    upi_id VARCHAR(100),
    bank_name VARCHAR(100),
    account_number VARCHAR(30),
    ifsc_code VARCHAR(15),
    min_amount BIGINT DEFAULT 10000000,
    max_amount BIGINT DEFAULT 5000000000,
    daily_limit BIGINT DEFAULT 50000000000,
    daily_processed BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    current_orders INTEGER DEFAULT 0,
    max_concurrent_orders INTEGER DEFAULT 5,
    total_orders INTEGER DEFAULT 0,
    total_verified INTEGER DEFAULT 0,
    total_rejected INTEGER DEFAULT 0,
    total_volume BIGINT DEFAULT 0,
    avg_response_time_ms INTEGER DEFAULT 0,
    last_active TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BANK ACCOUNTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label VARCHAR(64) NOT NULL,
    upi_id VARCHAR(100) NOT NULL,
    bank_name VARCHAR(100),
    account_holder VARCHAR(100),
    account_number VARCHAR(30),
    ifsc_code VARCHAR(15),
    daily_limit BIGINT DEFAULT 50000000000,
    daily_received BIGINT DEFAULT 0,
    daily_reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- WALLETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    address VARCHAR(128) NOT NULL,
    encrypted_key TEXT,
    derivation_path VARCHAR(50),
    hd_index INTEGER,
    confirmed_balance BIGINT DEFAULT 0,
    pending_balance BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);

-- ============================================
-- DEPOSIT ADDRESSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS deposit_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id),
    currency VARCHAR(10) NOT NULL,
    address VARCHAR(128) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(address, currency)
);

CREATE INDEX IF NOT EXISTS idx_deposit_addresses_user ON deposit_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_address ON deposit_addresses(address);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    amount BIGINT NOT NULL,
    fee BIGINT DEFAULT 0,
    net_amount BIGINT NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    balance_before BIGINT,
    balance_after BIGINT,
    reference_id UUID,
    reference_type VARCHAR(30),
    tx_hash VARCHAR(128),
    confirmations INTEGER DEFAULT 0,
    block_number BIGINT,
    description TEXT,
    metadata JSONB,
    is_demo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

-- ============================================
-- DEPOSIT ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS deposit_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(20) NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    agent_id UUID REFERENCES agents(id),
    agent_upi_id VARCHAR(100),
    utr_number VARCHAR(30),
    user_paid_at TIMESTAMP,
    bank_account_id UUID REFERENCES bank_accounts(id),
    qr_data TEXT,
    verified_by UUID REFERENCES agents(id),
    verified_at TIMESTAMP,
    rejection_reason TEXT,
    provider_order_id VARCHAR(100),
    provider_payment_id VARCHAR(100),
    expires_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deposit_orders_user ON deposit_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_orders_agent ON deposit_orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_deposit_orders_status ON deposit_orders(status);
CREATE INDEX IF NOT EXISTS idx_deposit_orders_expires ON deposit_orders(expires_at);

-- ============================================
-- HOUSE WALLETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS house_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    currency VARCHAR(10) UNIQUE NOT NULL,
    wallet_type VARCHAR(10) NOT NULL DEFAULT 'hot',
    address VARCHAR(128),
    balance BIGINT DEFAULT 0,
    contract_address VARCHAR(64),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- WITHDRAWAL REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    fee BIGINT DEFAULT 0,
    net_amount BIGINT NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    method VARCHAR(20) NOT NULL,
    destination VARCHAR(200) NOT NULL,
    destination_details JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    tx_hash VARCHAR(128),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- ============================================
-- CHAT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room VARCHAR(50) DEFAULT 'global',
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room, created_at DESC);

-- ============================================
-- UPDATE BALANCE TRIGGER (Demo mode aware)
-- ============================================
CREATE OR REPLACE FUNCTION update_user_balance()
RETURNS TRIGGER AS $$
DECLARE
    user_demo BOOLEAN;
BEGIN
    SELECT is_demo_mode INTO user_demo FROM users WHERE id = NEW.user_id;

    IF NEW.result = 'WIN' THEN
        IF user_demo THEN
            UPDATE users SET demo_balance = demo_balance + (NEW.payout - NEW.bet_amount), last_seen = CURRENT_TIMESTAMP
            WHERE id = NEW.user_id;
        ELSE
            UPDATE users SET balance = balance + (NEW.payout - NEW.bet_amount), last_seen = CURRENT_TIMESTAMP
            WHERE id = NEW.user_id;
        END IF;
    ELSIF NEW.result = 'LOSS' THEN
        UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Seed house wallet entries
INSERT INTO house_wallets (currency, wallet_type) VALUES
    ('BTC', 'hot'),
    ('XMR', 'hot'),
    ('USDT', 'hot'),
    ('INR', 'hot')
ON CONFLICT (currency) DO NOTHING;

SELECT 'Migration complete. New tables: agents, bank_accounts, wallets, deposit_addresses, transactions, deposit_orders, house_wallets, withdrawal_requests, chat_messages. Users table updated with demo_balance, is_demo_mode, phone, email, role.' AS result;
