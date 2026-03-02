import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { query } from '../config/database.js';

const bip32 = BIP32Factory(ecc);

/**
 * Wallet Service
 * Handles HD wallet generation for BTC, XMR, USDT (Polygon)
 * Keys encrypted server-side with AES-256-CBC
 */

export class WalletService {
  private encryptionKey: Buffer;

  constructor() {
    const key = process.env.WALLET_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    if (!process.env.WALLET_ENCRYPTION_KEY) {
      console.warn('WALLET_ENCRYPTION_KEY not set, using random key (wallets will be unrecoverable on restart)');
    }
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  // ============================================
  // ENCRYPTION UTILS
  // ============================================

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // ============================================
  // BITCOIN (BIP84 Native SegWit)
  // ============================================

  generateBitcoinWallet(): { xprv: string; firstAddress: string } {
    const mnemonic = bip39.generateMnemonic(256);
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed);
    const btcAccount = root.derivePath("m/84'/0'/0'");
    const xprv = btcAccount.toBase58();
    const firstAddress = this.deriveBitcoinAddress(xprv, 0);
    return { xprv, firstAddress };
  }

  deriveBitcoinAddress(xprv: string, index: number): string {
    const account = bip32.fromBase58(xprv);
    const child = account.derive(0).derive(index);
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(child.publicKey),
      network: bitcoin.networks.bitcoin,
    });
    if (!address) throw new Error('Failed to derive Bitcoin address');
    return address;
  }

  // ============================================
  // MONERO (Simplified - placeholder keys)
  // ============================================

  generateMoneroWallet(): { seed: string; address: string } {
    // Note: Real Monero needs monero-javascript or RPC to monero-wallet-cli
    const seedBytes = crypto.randomBytes(32);
    const seed = seedBytes.toString('hex');
    const address = `4${seed.substring(0, 94)}`;
    return { seed, address };
  }

  deriveMoneroSubaddress(seed: string, index: number): string {
    const hash = crypto.createHash('sha256')
      .update(seed + index.toString())
      .digest('hex');
    return `8${hash.substring(0, 94)}`;
  }

  // ============================================
  // USDT on Polygon (ERC-20 on Polygon PoS)
  // ============================================

  generatePolygonWallet(): { privateKey: string; address: string } {
    const wallet = ethers.Wallet.createRandom();
    return {
      privateKey: wallet.privateKey,
      address: wallet.address,
    };
  }

  // ============================================
  // DATABASE OPERATIONS
  // ============================================

  async createUserWallets(userId: string): Promise<void> {
    const btc = this.generateBitcoinWallet();
    const xmr = this.generateMoneroWallet();
    const usdt = this.generatePolygonWallet();

    const encBtcXprv = this.encrypt(btc.xprv);
    const encXmrSeed = this.encrypt(xmr.seed);
    const encUsdtKey = this.encrypt(usdt.privateKey);

    // Insert one wallet row per currency
    await query(
      `INSERT INTO wallets (user_id, currency, address, encrypted_key, derivation_path, hd_index)
       VALUES ($1, 'BTC', $2, $3, 'm/84''/0''/0''', 0)
       ON CONFLICT (user_id, currency) DO NOTHING`,
      [userId, btc.firstAddress, encBtcXprv]
    );

    await query(
      `INSERT INTO wallets (user_id, currency, address, encrypted_key, hd_index)
       VALUES ($1, 'XMR', $2, $3, 0)
       ON CONFLICT (user_id, currency) DO NOTHING`,
      [userId, xmr.address, encXmrSeed]
    );

    await query(
      `INSERT INTO wallets (user_id, currency, address, encrypted_key, hd_index)
       VALUES ($1, 'USDT_POLYGON', $2, $3, 0)
       ON CONFLICT (user_id, currency) DO NOTHING`,
      [userId, usdt.address, encUsdtKey]
    );

    // Store initial deposit addresses
    for (const [currency, address] of [['BTC', btc.firstAddress], ['XMR', xmr.address], ['USDT_POLYGON', usdt.address]]) {
      await query(
        `INSERT INTO deposit_addresses (user_id, wallet_id, currency, address)
         SELECT $1, id, $2, $3 FROM wallets WHERE user_id = $1 AND currency = $2
         ON CONFLICT (address, currency) DO NOTHING`,
        [userId, currency, address]
      );
    }
  }

  async getNewDepositAddress(userId: string, currency: string): Promise<string> {
    const walletResult = await query(
      'SELECT id, encrypted_key, hd_index FROM wallets WHERE user_id = $1 AND currency = $2',
      [userId, currency]
    );

    if (walletResult.rows.length === 0) {
      throw new Error(`No ${currency} wallet found for user`);
    }

    const wallet = walletResult.rows[0];
    let newAddress: string;
    const newIndex = (wallet.hd_index || 0) + 1;

    switch (currency) {
      case 'BTC': {
        const xprv = this.decrypt(wallet.encrypted_key);
        newAddress = this.deriveBitcoinAddress(xprv, newIndex);
        break;
      }
      case 'XMR': {
        const seed = this.decrypt(wallet.encrypted_key);
        newAddress = this.deriveMoneroSubaddress(seed, newIndex);
        break;
      }
      case 'USDT_POLYGON': {
        // Polygon uses single address per wallet
        newAddress = (await query(
          'SELECT address FROM wallets WHERE user_id = $1 AND currency = $2',
          [userId, currency]
        )).rows[0].address;
        return newAddress;
      }
      default:
        throw new Error('Unsupported currency');
    }

    // Update HD index
    await query(
      'UPDATE wallets SET hd_index = $1, updated_at = NOW() WHERE id = $2',
      [newIndex, wallet.id]
    );

    // Store deposit address
    await query(
      `INSERT INTO deposit_addresses (user_id, wallet_id, currency, address)
       VALUES ($1, $2, $3, $4) ON CONFLICT (address, currency) DO NOTHING`,
      [userId, wallet.id, currency, newAddress]
    );

    return newAddress;
  }

  async getUserAddresses(userId: string): Promise<Record<string, string>> {
    const result = await query(
      'SELECT currency, address FROM wallets WHERE user_id = $1',
      [userId]
    );
    const addresses: Record<string, string> = {};
    for (const row of result.rows) {
      addresses[row.currency] = row.address;
    }
    return addresses;
  }
}

export const walletService = new WalletService();
export default walletService;
