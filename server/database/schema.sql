-- Ghost Casino Database Schema
-- Real money + Demo mode gaming platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS (Anonymous, minimal data)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    -- Real money balance (internal units: display × 100000)
    balance BIGINT DEFAULT 0,
    -- Demo/practice balance (starts with 1000.00 credits)
    demo_balance BIGINT DEFAULT 100000000,
    -- Mode toggle: new users start in demo
    is_demo_mode BOOLEAN DEFAULT TRUE,
    -- Contact info (optional)
    phone VARCHAR(15),
    email VARCHAR(100),
    -- Admin/role flags
    role VARCHAR(20) DEFAULT 'user', -- user, admin, superadmin
    last_nonce INTEGER DEFAULT 0,
    total_wagered BIGINT DEFAULT 0,
    total_won BIGINT DEFAULT 0,
    total_lost BIGINT DEFAULT 0,
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- ============================================
-- GAME SESSIONS (Play sessions)
-- ============================================
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_type VARCHAR(30) NOT NULL,
    bet_amount BIGINT NOT NULL,
    multiplier NUMERIC(10, 4),
    payout BIGINT,
    profit BIGINT,
    result VARCHAR(10),
    -- Provably Fair
    client_seed VARCHAR(64),
    server_seed_hash VARCHAR(64),
    server_seed_revealed VARCHAR(64),
    nonce INTEGER,
    provably_fair_seed_id UUID,
    -- Game data (JSON)
    game_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LEADERBOARD (Rankings)
-- ============================================
CREATE TABLE leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(32) NOT NULL,
    game_type VARCHAR(30),
    total_wagered BIGINT DEFAULT 0,
    total_won BIGINT DEFAULT 0,
    biggest_win BIGINT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_leaderboard_user_game ON leaderboard(user_id, game_type);

-- ============================================
-- PROVABLY FAIR SEEDS
-- ============================================
CREATE TABLE provably_fair_seeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_seed VARCHAR(128) NOT NULL,
    server_seed_hash VARCHAR(64) NOT NULL,
    client_seed VARCHAR(64),
    nonce INTEGER NOT NULL DEFAULT 0,
    revealed BOOLEAN DEFAULT FALSE,
    revealed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE game_sessions
    ADD CONSTRAINT fk_game_sessions_pf_seed
    FOREIGN KEY (provably_fair_seed_id) REFERENCES provably_fair_seeds(id);

-- ============================================
-- FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION update_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO leaderboard (user_id, username, game_type, total_wagered, total_won)
    SELECT 
        NEW.user_id,
        u.username,
        NEW.game_type,
        NEW.bet_amount,
        CASE WHEN NEW.payout > NEW.bet_amount THEN NEW.payout - NEW.bet_amount ELSE 0 END
    FROM users u WHERE u.id = NEW.user_id
    ON CONFLICT (user_id, game_type) DO UPDATE SET
        total_wagered = leaderboard.total_wagered + NEW.bet_amount,
        total_won = leaderboard.total_won + CASE WHEN NEW.payout > NEW.bet_amount THEN NEW.payout - NEW.bet_amount ELSE 0 END,
        biggest_win = CASE WHEN NEW.payout - NEW.bet_amount > leaderboard.biggest_win 
                      THEN NEW.payout - NEW.bet_amount 
                      ELSE leaderboard.biggest_win END,
        updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leaderboard_trigger AFTER INSERT ON game_sessions
    FOR EACH ROW EXECUTE FUNCTION update_leaderboard();

-- Update user balance function
CREATE OR REPLACE FUNCTION update_user_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.result = 'WIN' THEN
        UPDATE users SET balance = balance + (NEW.payout - NEW.bet_amount), last_seen = CURRENT_TIMESTAMP
        WHERE id = NEW.user_id;
    ELSIF NEW.result = 'LOSS' THEN
        UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_balance_trigger AFTER INSERT ON game_sessions
    FOR EACH ROW EXECUTE FUNCTION update_user_balance();

-- ============================================
-- AGENTS (P2P Payment Agents/Merchants)
-- ============================================
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    -- UPI/Bank details for receiving payments
    upi_id VARCHAR(100),
    bank_name VARCHAR(100),
    account_number VARCHAR(30),
    ifsc_code VARCHAR(15),
    -- Limits and capacity
    min_amount BIGINT DEFAULT 10000000,    -- 100.00 min deposit
    max_amount BIGINT DEFAULT 5000000000,  -- 50000.00 max deposit
    daily_limit BIGINT DEFAULT 50000000000, -- 500000.00 daily
    daily_processed BIGINT DEFAULT 0,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    current_orders INTEGER DEFAULT 0,
    max_concurrent_orders INTEGER DEFAULT 5,
    -- Stats
    total_orders INTEGER DEFAULT 0,
    total_verified INTEGER DEFAULT 0,
    total_rejected INTEGER DEFAULT 0,
    total_volume BIGINT DEFAULT 0,
    avg_response_time_ms INTEGER DEFAULT 0,
    -- Meta
    last_active TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BANK ACCOUNTS (Platform QR accounts)
-- ============================================
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label VARCHAR(64) NOT NULL,
    upi_id VARCHAR(100) NOT NULL,
    bank_name VARCHAR(100),
    account_holder VARCHAR(100),
    account_number VARCHAR(30),
    ifsc_code VARCHAR(15),
    -- Limits
    daily_limit BIGINT DEFAULT 50000000000, -- 500000.00
    daily_received BIGINT DEFAULT 0,
    daily_reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- WALLETS (Per-user crypto wallets)
-- ============================================
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL, -- BTC, XMR, USDT_POLYGON
    address VARCHAR(128) NOT NULL,
    -- Encrypted private key / derivation path
    encrypted_key TEXT,
    derivation_path VARCHAR(50),
    hd_index INTEGER,
    -- Balance tracking
    balance BIGINT DEFAULT 0,
    confirmed_balance BIGINT DEFAULT 0,
    pending_balance BIGINT DEFAULT 0,
    -- Meta
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, currency)
);

CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallets_address ON wallets(address);

-- ============================================
-- DEPOSIT ADDRESSES (Generated addresses)
-- ============================================
CREATE TABLE deposit_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id),
    currency VARCHAR(10) NOT NULL,
    address VARCHAR(128) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(address, currency)
);

CREATE INDEX idx_deposit_addresses_user ON deposit_addresses(user_id);
CREATE INDEX idx_deposit_addresses_address ON deposit_addresses(address);

-- ============================================
-- TRANSACTIONS (Unified ledger)
-- ============================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id),
    -- Type: deposit_agent, deposit_qr, deposit_crypto, withdrawal, game_bet, game_payout, fee, bonus
    type VARCHAR(30) NOT NULL,
    -- Status: pending, processing, completed, failed, cancelled, expired
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Amounts (in internal units)
    amount BIGINT NOT NULL,
    fee BIGINT DEFAULT 0,
    net_amount BIGINT NOT NULL, -- amount - fee
    -- Currency
    currency VARCHAR(10) DEFAULT 'INR', -- INR, BTC, XMR, USDT
    -- Balance snapshot after this transaction
    balance_before BIGINT,
    balance_after BIGINT,
    -- Reference to related records
    reference_id UUID, -- deposit_order.id, withdrawal_request.id, game_session.id
    reference_type VARCHAR(30), -- deposit_order, withdrawal, game, bonus
    game_session_id UUID REFERENCES game_sessions(id),
    -- Blockchain details (for crypto)
    tx_hash VARCHAR(128),
    confirmations INTEGER DEFAULT 0,
    block_number BIGINT,
    -- Metadata
    description TEXT,
    metadata JSONB,
    is_demo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_reference ON transactions(reference_id);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- ============================================
-- DEPOSIT ORDERS (P2P Agent + QR deposits)
-- ============================================
CREATE TABLE deposit_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Method: agent, qr, crypto
    method VARCHAR(20) NOT NULL,
    -- Amount
    amount BIGINT NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    -- Status: pending, assigned, user_paid, verifying, completed, rejected, expired, cancelled
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Agent assignment (for P2P)
    agent_id UUID REFERENCES agents(id),
    agent_upi_id VARCHAR(100),
    -- User payment proof
    utr_number VARCHAR(30),
    user_paid_at TIMESTAMP,
    -- Bank account (for QR)
    bank_account_id UUID REFERENCES bank_accounts(id),
    qr_data TEXT, -- UPI intent URL or QR image data
    -- Verification
    verified_by UUID REFERENCES agents(id),
    verified_at TIMESTAMP,
    rejection_reason TEXT,
    -- Payment provider reference (for QR webhook)
    provider_order_id VARCHAR(100),
    provider_payment_id VARCHAR(100),
    -- Expiry
    expires_at TIMESTAMP,
    -- Meta
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deposit_orders_user ON deposit_orders(user_id);
CREATE INDEX idx_deposit_orders_agent ON deposit_orders(agent_id);
CREATE INDEX idx_deposit_orders_status ON deposit_orders(status);
CREATE INDEX idx_deposit_orders_expires ON deposit_orders(expires_at);

-- ============================================
-- HOUSE WALLETS (Platform wallet balances)
-- ============================================
CREATE TABLE house_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    currency VARCHAR(10) UNIQUE NOT NULL,
    wallet_type VARCHAR(10) NOT NULL DEFAULT 'hot', -- hot, cold
    address VARCHAR(128),
    balance BIGINT DEFAULT 0,
    -- For Polygon USDT escrow
    contract_address VARCHAR(64),
    -- Meta
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- WITHDRAWAL REQUESTS
-- ============================================
CREATE TABLE withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Amount
    amount BIGINT NOT NULL,
    fee BIGINT DEFAULT 0,
    net_amount BIGINT NOT NULL, -- amount - fee
    currency VARCHAR(10) DEFAULT 'INR',
    -- Method: upi, bank, btc, xmr, usdt_polygon
    method VARCHAR(20) NOT NULL,
    -- Destination
    destination VARCHAR(200) NOT NULL, -- UPI ID, wallet address, bank details JSON
    destination_details JSONB,
    -- Status: pending, approved, processing, completed, rejected, cancelled
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Admin handling
    reviewed_by UUID, -- admin user ID
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    -- Blockchain details
    tx_hash VARCHAR(128),
    -- Meta
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_withdrawal_requests_user ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);

-- ============================================
-- AUTH SESSIONS (Refresh token rotation store)
-- ============================================
CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(128) NOT NULL,
    ip_address VARCHAR(64),
    user_agent TEXT,
    replaced_by_session_id UUID,
    revoked_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires ON auth_sessions(expires_at);

-- ============================================
-- CHAT MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room VARCHAR(50) DEFAULT 'global',
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_messages_room ON chat_messages(room, created_at DESC);

-- ============================================
-- UPDATED FUNCTIONS (Demo mode aware)
-- ============================================

-- Replace the balance trigger to handle demo vs real mode
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
