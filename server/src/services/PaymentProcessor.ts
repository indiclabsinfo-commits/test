import { query } from '../config/database.js';
import { ethers } from 'ethers';

/**
 * Payment Processor
 * Monitors blockchain for crypto deposits
 * Supports: BTC (Blockstream API), XMR (xmrchain), USDT on Polygon
 */

// Polygon USDT contract address (mainnet)
const POLYGON_USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const POLYGON_RPC = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

export class PaymentProcessor {
  private btcInterval: ReturnType<typeof setInterval> | null = null;
  private xmrInterval: ReturnType<typeof setInterval> | null = null;
  private usdtInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  private readonly BTC_API = 'https://blockstream.info/api';
  private readonly XMR_API = 'https://xmrchain.net/api';

  private polygonProvider: ethers.JsonRpcProvider | null = null;

  constructor() {}

  startMonitoring(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('Starting Payment Processor...');

    this.startBitcoinListener();
    this.startMoneroListener();
    this.startPolygonUSDTListener();

    setInterval(() => this.cleanupOldDeposits(), 3600000);
  }

  stop(): void {
    this.isRunning = false;
    if (this.btcInterval) clearInterval(this.btcInterval);
    if (this.xmrInterval) clearInterval(this.xmrInterval);
    if (this.usdtInterval) clearInterval(this.usdtInterval);
    console.log('Payment Processor stopped');
  }

  // ============================================
  // BITCOIN LISTENER
  // ============================================

  private startBitcoinListener(): void {
    console.log('  BTC listener started (30s interval)');
    this.btcInterval = setInterval(async () => {
      try { await this.checkBitcoinDeposits(); } catch (err) {
        console.error('Bitcoin listener error:', err);
      }
    }, 30000);
  }

  private async checkBitcoinDeposits(): Promise<void> {
    // Get active BTC deposit addresses
    const addresses = await query(
      `SELECT da.address, da.user_id, w.id as wallet_id
       FROM deposit_addresses da
       JOIN wallets w ON da.wallet_id = w.id
       WHERE da.currency = 'BTC' AND da.is_used = FALSE`
    );

    for (const row of addresses.rows) {
      try {
        const resp = await fetch(`${this.BTC_API}/address/${row.address}`);
        if (!resp.ok) continue;
        const info: any = await resp.json();

        if (info.chain_stats?.funded_txo_sum > 0) {
          const txsResp = await fetch(`${this.BTC_API}/address/${row.address}/txs`);
          if (!txsResp.ok) continue;
          const txs = (await txsResp.json()) as any[];

          for (const btcTx of txs) {
            const vout = btcTx.vout?.find((v: any) => v.scriptpubkey_address === row.address);
            if (!vout) continue;
            const amount = vout.value; // satoshis
            const confirmations = btcTx.status?.confirmed ? 1 : 0;
            await this.processDeposit(row.user_id, 'BTC', row.address, btcTx.txid, amount, confirmations);
          }
        }
      } catch (err) {
        console.error(`BTC check failed for ${row.address}:`, err);
      }
    }
  }

  // ============================================
  // MONERO LISTENER
  // ============================================

  private startMoneroListener(): void {
    console.log('  XMR listener started (60s interval)');
    this.xmrInterval = setInterval(async () => {
      try { await this.checkMoneroDeposits(); } catch (err) {
        console.error('Monero listener error:', err);
      }
    }, 60000);
  }

  private async checkMoneroDeposits(): Promise<void> {
    const addresses = await query(
      `SELECT da.address, da.user_id, w.id as wallet_id
       FROM deposit_addresses da
       JOIN wallets w ON da.wallet_id = w.id
       WHERE da.currency = 'XMR' AND da.is_used = FALSE`
    );

    const viewKey = process.env.XMR_VIEW_KEY;
    if (!viewKey) return;

    for (const row of addresses.rows) {
      try {
        const resp = await fetch(
          `${this.XMR_API}/output?address=${row.address}&viewkey=${viewKey}`
        );
        if (!resp.ok) continue;
        const data: any = await resp.json();

        if (data.outputs?.length > 0) {
          for (const output of data.outputs) {
            const txResp = await fetch(`${this.XMR_API}/transaction/${output.tx_hash}`);
            const txData: any = await txResp.json();
            const confirmations = txData.data?.confirmations || 0;
            await this.processDeposit(
              row.user_id, 'XMR', row.address,
              output.tx_hash, Number(output.amount), confirmations
            );
          }
        }
      } catch (err) {
        console.error(`XMR check failed for ${row.address}:`, err);
      }
    }
  }

  // ============================================
  // POLYGON USDT LISTENER
  // ============================================

  private startPolygonUSDTListener(): void {
    console.log('  USDT (Polygon) listener started (20s interval)');

    try {
      this.polygonProvider = new ethers.JsonRpcProvider(POLYGON_RPC);
    } catch {
      console.warn('Could not connect to Polygon RPC, USDT monitoring disabled');
      return;
    }

    this.usdtInterval = setInterval(async () => {
      try { await this.checkPolygonUSDTDeposits(); } catch (err) {
        console.error('Polygon USDT listener error:', err);
      }
    }, 20000);
  }

  private async checkPolygonUSDTDeposits(): Promise<void> {
    if (!this.polygonProvider) return;

    const addresses = await query(
      `SELECT da.address, da.user_id, w.id as wallet_id
       FROM deposit_addresses da
       JOIN wallets w ON da.wallet_id = w.id
       WHERE da.currency = 'USDT_POLYGON' AND da.is_used = FALSE`
    );

    if (addresses.rows.length === 0) return;

    // ERC-20 Transfer event topic
    const transferTopic = ethers.id('Transfer(address,address,uint256)');

    for (const row of addresses.rows) {
      try {
        // Check recent logs for Transfer events to this address
        const paddedAddress = ethers.zeroPadValue(row.address, 32);
        const currentBlock = await this.polygonProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000); // last ~1000 blocks

        const logs = await this.polygonProvider.getLogs({
          address: POLYGON_USDT_ADDRESS,
          topics: [transferTopic, null, paddedAddress],
          fromBlock,
          toBlock: currentBlock,
        });

        for (const log of logs) {
          const amount = Number(ethers.toBigInt(log.data)); // USDT has 6 decimals
          const txHash = log.transactionHash;
          const confirmations = currentBlock - log.blockNumber;
          await this.processDeposit(
            row.user_id, 'USDT_POLYGON', row.address,
            txHash, amount, confirmations
          );
        }
      } catch (err) {
        console.error(`Polygon USDT check failed for ${row.address}:`, err);
      }
    }
  }

  // ============================================
  // DEPOSIT PROCESSING
  // ============================================

  private async processDeposit(
    userId: string, currency: string, address: string,
    txHash: string, amount: number, confirmations: number
  ): Promise<void> {
    // Check if tx already recorded
    const existing = await query(
      'SELECT id, status FROM transactions WHERE tx_hash = $1',
      [txHash]
    );

    const requiredConfirms = currency === 'BTC' ? 2 : currency === 'XMR' ? 10 : 1;

    if (existing.rows.length > 0) {
      const tx = existing.rows[0];
      if (tx.status === 'completed') return;

      // Update confirmations
      await query(
        'UPDATE transactions SET confirmations = $1, updated_at = NOW() WHERE id = $2',
        [confirmations, tx.id]
      );

      if (confirmations >= requiredConfirms && tx.status === 'pending') {
        await this.confirmDeposit(tx.id, userId, amount);
      }
      return;
    }

    // New deposit - record it
    const result = await query(
      `INSERT INTO transactions (
        user_id, type, status, amount, fee, net_amount, currency,
        tx_hash, confirmations, block_number, reference_type, description
      ) VALUES ($1, 'deposit_crypto', 'pending', $2, 0, $2, $3, $4, $5, 0, 'crypto', $6)
      RETURNING id`,
      [userId, amount, currency, txHash, confirmations, `${currency} deposit`]
    );

    console.log(`New ${currency} deposit detected: ${amount} for user ${userId}`);

    if (confirmations >= requiredConfirms) {
      await this.confirmDeposit(result.rows[0].id, userId, amount);
    }
  }

  private async confirmDeposit(txId: string, userId: string, amount: number): Promise<void> {
    await query('BEGIN');
    try {
      // Get current balance
      const userResult = await query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const balanceBefore = userResult.rows[0]?.balance || 0;

      // Credit user's real balance (amount is already in smallest units)
      await query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [amount, userId]
      );

      const balanceAfter = Number(balanceBefore) + amount;

      // Update transaction
      await query(
        `UPDATE transactions SET status = 'completed', balance_before = $1, balance_after = $2, updated_at = NOW()
         WHERE id = $3`,
        [balanceBefore, balanceAfter, txId]
      );

      // Mark deposit address as used
      await query(
        `UPDATE deposit_addresses SET is_used = TRUE
         WHERE user_id = $1 AND is_used = FALSE AND currency = (
           SELECT currency FROM transactions WHERE id = $2
         )`,
        [userId, txId]
      );

      await query('COMMIT');
      console.log(`Crypto deposit confirmed: ${amount} for user ${userId}`);
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  private async cleanupOldDeposits(): Promise<void> {
    const result = await query(
      `UPDATE transactions SET status = 'expired'
       WHERE type = 'deposit_crypto' AND status = 'pending'
       AND created_at < NOW() - INTERVAL '24 hours'
       RETURNING id`
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`Cleaned up ${result.rowCount} stale crypto deposits`);
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  async getDepositAddress(userId: string, currency: string): Promise<string> {
    const existing = await query(
      `SELECT address FROM deposit_addresses
       WHERE user_id = $1 AND currency = $2 AND is_used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [userId, currency]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0].address;
    }
    // Import dynamically to avoid circular deps
    const { walletService } = await import('./WalletService.js');
    return walletService.getNewDepositAddress(userId, currency);
  }

  async getPendingDeposits(userId: string): Promise<any[]> {
    const result = await query(
      `SELECT currency, amount, tx_hash, confirmations, status, created_at
       FROM transactions
       WHERE user_id = $1 AND type = 'deposit_crypto' AND status = 'pending'
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }
}

export const paymentProcessor = new PaymentProcessor();
export default paymentProcessor;
