import { query } from '../config/database.js';
import { DEFAULT_HOUSE_EDGE, DEFAULT_RTP_FACTOR, PLINKO_TABLE_BASELINE_RTP } from '../config/gameEconomy.js';

const MIN_RTP = 0.7;
const MAX_RTP = 0.99;

type RuntimeConfigRow = {
  game_type: string;
  rtp_factor: string | number;
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  note: string | null;
  updated_at: string;
};

type LudoPayoutConfigRow = {
  player_count: number;
  rank_splits: number[];
  updated_at: string;
};

const DEFAULT_LUDO_PAYOUT_SPLITS: Record<number, number[]> = {
  2: [1, 0],
  3: [0.65, 0.35, 0],
  4: [0.5, 0.3, 0.2, 0],
};

export class EconomyRuntimeService {
  private cache = new Map<string, { rtpFactor: number; expiresAt: number }>();
  private cacheTtlMs = 30_000;
  private initPromise: Promise<void> | null = null;

  private async ensureSchema(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await query(`
          CREATE TABLE IF NOT EXISTS game_runtime_config (
            game_type VARCHAR(40) PRIMARY KEY,
            rtp_factor NUMERIC(6,4) NOT NULL DEFAULT ${DEFAULT_RTP_FACTOR},
            enabled BOOLEAN NOT NULL DEFAULT FALSE,
            starts_at TIMESTAMP NULL,
            ends_at TIMESTAMP NULL,
            note TEXT NULL,
            updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);

        await query(`
          CREATE TABLE IF NOT EXISTS platform_notices (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title VARCHAR(160) NOT NULL,
            message TEXT NOT NULL,
            starts_at TIMESTAMP NULL,
            ends_at TIMESTAMP NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);

        await query(`
          CREATE TABLE IF NOT EXISTS ludo_rank_payout_config (
            player_count SMALLINT PRIMARY KEY CHECK (player_count IN (2, 3, 4)),
            rank_splits JSONB NOT NULL,
            updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
      })().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    await this.initPromise;
  }

  private clampRtp(value: number): number {
    return Math.max(MIN_RTP, Math.min(MAX_RTP, value));
  }

  public async getRtpFactor(gameType: string): Promise<number> {
    await this.ensureSchema();
    const key = gameType.toLowerCase();
    const cached = this.cache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.rtpFactor;

    const res = await query(
      `SELECT rtp_factor
       FROM game_runtime_config
       WHERE game_type = $1
         AND enabled = TRUE
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())
       LIMIT 1`,
      [key]
    );

    const rtp = res.rows.length > 0
      ? this.clampRtp(Number(res.rows[0].rtp_factor))
      : DEFAULT_RTP_FACTOR;

    this.cache.set(key, { rtpFactor: rtp, expiresAt: now + this.cacheTtlMs });
    return rtp;
  }

  public async getHouseEdge(gameType: string): Promise<number> {
    const rtp = await this.getRtpFactor(gameType);
    return Math.max(0, 1 - rtp);
  }

  public async getPlinkoAdjustment(gameType = 'plinko'): Promise<number> {
    const rtp = await this.getRtpFactor(gameType);
    return rtp / PLINKO_TABLE_BASELINE_RTP;
  }

  public async listConfigs(): Promise<RuntimeConfigRow[]> {
    await this.ensureSchema();
    const res = await query(
      `SELECT game_type, rtp_factor, enabled, starts_at, ends_at, note, updated_at
       FROM game_runtime_config
       ORDER BY game_type ASC`
    );
    return res.rows;
  }

  public async upsertConfig(
    gameType: string,
    data: {
      rtpFactor: number;
      enabled?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
      note?: string | null;
      updatedBy?: string | null;
    }
  ): Promise<void> {
    await this.ensureSchema();
    const key = gameType.toLowerCase();
    const rtp = this.clampRtp(Number(data.rtpFactor || DEFAULT_RTP_FACTOR));
    await query(
      `INSERT INTO game_runtime_config
       (game_type, rtp_factor, enabled, starts_at, ends_at, note, updated_by, updated_at)
       VALUES ($1, $2, COALESCE($3, FALSE), $4, $5, $6, $7, NOW())
       ON CONFLICT (game_type)
       DO UPDATE SET
         rtp_factor = EXCLUDED.rtp_factor,
         enabled = EXCLUDED.enabled,
         starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at,
         note = EXCLUDED.note,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [key, rtp, data.enabled ?? false, data.startsAt ?? null, data.endsAt ?? null, data.note ?? null, data.updatedBy ?? null]
    );
    this.cache.delete(key);
  }

  public async listNotices(includeInactive = true): Promise<any[]> {
    await this.ensureSchema();
    const sql = includeInactive
      ? `SELECT * FROM platform_notices ORDER BY created_at DESC LIMIT 100`
      : `SELECT * FROM platform_notices
         WHERE is_active = TRUE
           AND (starts_at IS NULL OR starts_at <= NOW())
           AND (ends_at IS NULL OR ends_at >= NOW())
         ORDER BY created_at DESC LIMIT 20`;
    const res = await query(sql);
    return res.rows;
  }

  public async createNotice(data: {
    title: string;
    message: string;
    startsAt?: string | null;
    endsAt?: string | null;
    isActive?: boolean;
    createdBy?: string | null;
  }): Promise<{ id: string }> {
    await this.ensureSchema();
    const res = await query(
      `INSERT INTO platform_notices
       (title, message, starts_at, ends_at, is_active, created_by, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), $6, NOW())
       RETURNING id`,
      [data.title.trim(), data.message.trim(), data.startsAt ?? null, data.endsAt ?? null, data.isActive ?? true, data.createdBy ?? null]
    );
    return { id: res.rows[0].id };
  }

  public async updateNotice(id: string, patch: { isActive?: boolean }): Promise<boolean> {
    await this.ensureSchema();
    if (patch.isActive === undefined) return false;
    const res = await query(
      `UPDATE platform_notices SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
      [patch.isActive, id]
    );
    return res.rows.length > 0;
  }

  private sanitizeLudoSplits(playerCount: number, splits: number[]): number[] {
    const fallback = DEFAULT_LUDO_PAYOUT_SPLITS[playerCount] || [1, 0];
    if (!Array.isArray(splits) || splits.length !== playerCount) return fallback;
    const clean = splits.map((v) => Math.max(0, Number(v || 0)));
    const total = clean.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return fallback;
    const normalized = clean.map((value) => value / total);
    return normalized.map((value, index) => {
      if (index !== normalized.length - 1) return Number(value.toFixed(4));
      const consumed = normalized
        .slice(0, normalized.length - 1)
        .reduce((sum, x) => sum + Number(x.toFixed(4)), 0);
      return Number(Math.max(0, 1 - consumed).toFixed(4));
    });
  }

  public async getLudoPayoutSplits(playerCount: number): Promise<number[]> {
    await this.ensureSchema();
    const safeCount = [2, 3, 4].includes(playerCount) ? playerCount : 4;
    const res = await query(
      `SELECT rank_splits
       FROM ludo_rank_payout_config
       WHERE player_count = $1
       LIMIT 1`,
      [safeCount]
    );
    if (res.rows.length === 0) return DEFAULT_LUDO_PAYOUT_SPLITS[safeCount];
    const raw = Array.isArray(res.rows[0].rank_splits) ? res.rows[0].rank_splits : [];
    return this.sanitizeLudoSplits(safeCount, raw as number[]);
  }

  public async listLudoPayoutConfigs(): Promise<LudoPayoutConfigRow[]> {
    await this.ensureSchema();
    const res = await query(
      `SELECT player_count, rank_splits, updated_at
       FROM ludo_rank_payout_config
       ORDER BY player_count ASC`
    );
    const rows = res.rows.map((row) => ({
      player_count: Number(row.player_count),
      rank_splits: this.sanitizeLudoSplits(Number(row.player_count), Array.isArray(row.rank_splits) ? row.rank_splits : []),
      updated_at: row.updated_at,
    }));

    const present = new Set(rows.map((row) => row.player_count));
    for (const playerCount of [2, 3, 4]) {
      if (!present.has(playerCount)) {
        rows.push({
          player_count: playerCount,
          rank_splits: DEFAULT_LUDO_PAYOUT_SPLITS[playerCount],
          updated_at: '',
        });
      }
    }
    return rows.sort((a, b) => a.player_count - b.player_count);
  }

  public async upsertLudoPayoutConfig(
    playerCount: number,
    rankSplits: number[],
    updatedBy?: string | null
  ): Promise<number[]> {
    await this.ensureSchema();
    if (![2, 3, 4].includes(playerCount)) {
      throw new Error('Invalid player count');
    }
    const normalized = this.sanitizeLudoSplits(playerCount, rankSplits);
    await query(
      `INSERT INTO ludo_rank_payout_config (player_count, rank_splits, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (player_count)
       DO UPDATE SET
         rank_splits = EXCLUDED.rank_splits,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [playerCount, JSON.stringify(normalized), updatedBy ?? null]
    );
    return normalized;
  }
}

export const economyRuntimeService = new EconomyRuntimeService();
export default economyRuntimeService;
