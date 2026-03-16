import { query } from '../config/database.js';

export class BalanceSyncService {
  private initialized = false;

  public async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await query(`
      INSERT INTO wallets (user_id, currency, address, balance, confirmed_balance, pending_balance)
      SELECT u.id, 'INR', 'INR-' || REPLACE(u.id::text, '-', ''), u.balance, u.balance, 0
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM wallets w WHERE w.user_id = u.id AND w.currency = 'INR'
      )
    `);

    await query(`
      UPDATE wallets w
      SET balance = u.balance,
          confirmed_balance = u.balance,
          updated_at = NOW()
      FROM users u
      WHERE w.user_id = u.id AND w.currency = 'INR'
    `);

    await query(`
      CREATE OR REPLACE FUNCTION sync_users_balance_to_wallet()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' OR NEW.balance IS DISTINCT FROM COALESCE(OLD.balance, NEW.balance) THEN
          INSERT INTO wallets (user_id, currency, address, balance, confirmed_balance, pending_balance, created_at, updated_at)
          VALUES (NEW.id, 'INR', 'INR-' || REPLACE(NEW.id::text, '-', ''), NEW.balance, NEW.balance, 0, NOW(), NOW())
          ON CONFLICT (user_id, currency)
          DO UPDATE SET
            balance = EXCLUDED.balance,
            confirmed_balance = EXCLUDED.confirmed_balance,
            updated_at = NOW();
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await query(`
      DROP TRIGGER IF EXISTS trg_sync_users_balance_to_wallet ON users;
      CREATE TRIGGER trg_sync_users_balance_to_wallet
      AFTER INSERT OR UPDATE OF balance ON users
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION sync_users_balance_to_wallet();
    `);

    await query(`
      CREATE OR REPLACE FUNCTION sync_wallet_balance_to_users()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.currency = 'INR' AND (TG_OP = 'INSERT' OR NEW.balance IS DISTINCT FROM COALESCE(OLD.balance, NEW.balance)) THEN
          UPDATE users
          SET balance = NEW.balance,
              last_seen = NOW()
          WHERE id = NEW.user_id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await query(`
      DROP TRIGGER IF EXISTS trg_sync_wallet_balance_to_users ON wallets;
      CREATE TRIGGER trg_sync_wallet_balance_to_users
      AFTER INSERT OR UPDATE OF balance ON wallets
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION sync_wallet_balance_to_users();
    `);

    this.initialized = true;
  }
}

export const balanceSyncService = new BalanceSyncService();
export default balanceSyncService;
