-- Runtime alignment migration (idempotent)
-- Date: 2026-03-02

-- USERS additions used by runtime services
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_wagered BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_won BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_lost BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- WALLETS compatibility field referenced by multiple game services
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS balance BIGINT DEFAULT 0;

-- GAME SESSIONS compatibility field for provably fair seed linkage
ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS provably_fair_seed_id UUID,
  ADD COLUMN IF NOT EXISTS profit BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_game_sessions_pf_seed'
  ) THEN
    ALTER TABLE game_sessions
      ADD CONSTRAINT fk_game_sessions_pf_seed
      FOREIGN KEY (provably_fair_seed_id) REFERENCES provably_fair_seeds(id);
  END IF;
END $$;

-- TRANSACTIONS compatibility fields used by services
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS wallet_id UUID,
  ADD COLUMN IF NOT EXISTS game_session_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_wallet_id'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT fk_transactions_wallet_id
      FOREIGN KEY (wallet_id) REFERENCES wallets(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_game_session_id'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT fk_transactions_game_session_id
      FOREIGN KEY (game_session_id) REFERENCES game_sessions(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_game_sessions_pf_seed_id ON game_sessions(provably_fair_seed_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_game_session_id ON transactions(game_session_id);

-- Auth refresh session store for rotation/revocation
CREATE TABLE IF NOT EXISTS auth_sessions (
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

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);
