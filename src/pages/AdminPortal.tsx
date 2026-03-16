import { useEffect, useState, type CSSProperties } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface BankAccount {
  id: string;
  label: string;
  upi_id: string;
  bank_name: string | null;
  account_holder: string | null;
  is_active: boolean;
  daily_limit: number;
  daily_received: number;
  priority: number;
  created_at: string;
}

interface GamePnlRow {
  game_type: string;
  rounds: string;
  wagered: string;
  payout: string;
  player_net: string;
  house_net: string;
}

interface GameTrendRow {
  day: string;
  game_type: string;
  rounds: string;
  wagered: string;
  house_net: string;
}

interface GameStatsPayload {
  days: number;
  today: {
    rounds: string;
    wagered: string;
    payout: string;
    player_net: string;
    house_net: string;
  };
  byGameToday: GamePnlRow[];
  trend: GameTrendRow[];
}

interface PlatformStatsPayload {
  users?: { total?: string; real_users?: string; total_balance?: string };
  deposits?: { total?: string; total_volume?: string; completed?: string; pending?: string };
  withdrawals?: { total?: string; total_volume?: string; pending?: string; approved?: string };
  agents?: { total?: string; online?: string };
  houseWallets?: Array<{ currency: string; balance: string }>;
}

interface AdminUserRow {
  id: string;
  username: string;
  balance: string;
  demo_balance: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface WithdrawalRow {
  id: string;
  user_id: string;
  username?: string;
  amount: string;
  net_amount?: string;
  status: string;
  created_at: string;
}

interface QRDepositRow {
  id: string;
  user_id: string;
  username?: string;
  amount: string;
  status: string;
  utr_number?: string;
  created_at: string;
  user_paid_at?: string;
}

interface TxRow {
  id: string;
  username: string;
  type: string;
  amount: string;
  status: string;
  created_at: string;
}

interface EconomyConfigRow {
  game_type: string;
  rtp_factor: string;
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  note: string | null;
  updated_at: string;
}

interface NoticeRow {
  id: string;
  title: string;
  message: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface LudoPayoutConfigRow {
  player_count: number;
  rank_splits: number[];
  updated_at: string;
}

interface LudoPreviewPayload {
  playerCount: number;
  entryFee: number;
  matchesPerDay: number;
  rtp: number;
  houseEdge: number;
  totalPool: number;
  houseFee: number;
  prizePool: number;
  rankSplits: number[];
  rankPayouts: number[];
  housePerMatch: number;
  housePerDay: number;
  positionSummary: Array<{ position: number; amount: number }>;
}

export const AdminPortal: React.FC = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gameStats, setGameStats] = useState<GameStatsPayload | null>(null);
  const [gameStatsLoading, setGameStatsLoading] = useState(false);
  const [platformStats, setPlatformStats] = useState<PlatformStatsPayload | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [qrDeposits, setQrDeposits] = useState<QRDepositRow[]>([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [authHint, setAuthHint] = useState('');
  const [economyConfigs, setEconomyConfigs] = useState<EconomyConfigRow[]>([]);
  const [economyLoading, setEconomyLoading] = useState(false);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [ludoPayouts, setLudoPayouts] = useState<LudoPayoutConfigRow[]>([]);
  const [ludoPlayerCount, setLudoPlayerCount] = useState<2 | 3 | 4>(4);
  const [ludoEntryFee, setLudoEntryFee] = useState(100);
  const [ludoMatchesPerDay, setLudoMatchesPerDay] = useState(20);
  const [ludoPreview, setLudoPreview] = useState<LudoPreviewPayload | null>(null);

  const [newLabel, setNewLabel] = useState('Primary UPI');
  const [newUpiId, setNewUpiId] = useState('');
  const [newHolder, setNewHolder] = useState('');
  const [newBank, setNewBank] = useState('');
  const [newPriority, setNewPriority] = useState(10);

  const adminFetch = async (path: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('accessToken') || '';
    try {
      const res = await fetch(`${API_URL}/admin${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
          ...(options.headers || {}),
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setAuthHint('Login as admin/superadmin to access all admin modules.');
        }
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data;
    } catch (err: any) {
      if (err?.message?.includes('Failed to fetch')) {
        throw new Error('Backend API unreachable. Start server on port 3001.');
      }
      throw err;
    }
  };

  const loadAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch('/bank-accounts');
      setAccounts(data.accounts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const loadGameStats = async () => {
    setGameStatsLoading(true);
    try {
      const data = await adminFetch('/stats/games?days=7');
      setGameStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load game stats');
    } finally {
      setGameStatsLoading(false);
    }
  };

  const loadOpsData = async () => {
    setOpsLoading(true);
    try {
      const [stats, usersRes, withdrawalsRes, txRes] = await Promise.all([
        adminFetch('/stats'),
        adminFetch('/users?limit=25&offset=0'),
        adminFetch('/withdrawals/pending'),
        adminFetch('/transactions?limit=30'),
      ]);
      const qrRes = await adminFetch('/deposits/qr/pending');
      setPlatformStats(stats);
      setUsers(usersRes.users || []);
      setWithdrawals(withdrawalsRes.requests || []);
      setTransactions(txRes.transactions || []);
      setQrDeposits(qrRes.orders || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin operational data');
    } finally {
      setOpsLoading(false);
    }
  };

  const loadEconomyData = async () => {
    setEconomyLoading(true);
    try {
      const [configsRes, noticesRes] = await Promise.all([
        adminFetch('/economy/configs'),
        adminFetch('/notices'),
      ]);
      setEconomyConfigs(configsRes.configs || []);
      setNotices(noticesRes.notices || []);
      const ludoPayoutRes = await adminFetch('/economy/ludo-payouts');
      setLudoPayouts(ludoPayoutRes.configs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load economy/notices');
    } finally {
      setEconomyLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    loadGameStats();
    loadOpsData();
    loadEconomyData();
  }, []);

  const toMoney = (value: string | number) => {
    const n = Number(value || 0) / 100000;
    return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const knownGames = ['ludo', 'crash', 'dice', 'plinko', 'mines', 'limbo', 'keno', 'diamonds', 'dragon_tower', 'hilo', 'wheel', 'roulette', 'blackjack'];
  const economyRows: EconomyConfigRow[] = knownGames.map((game) => {
    const existing = economyConfigs.find(c => c.game_type === game);
    return existing || {
      game_type: game,
      rtp_factor: '0.95',
      enabled: false,
      starts_at: null,
      ends_at: null,
      note: null,
      updated_at: '',
    };
  });

  const createAccount = async () => {
    if (!newLabel.trim() || !newUpiId.trim()) return;
    setError('');
    try {
      await adminFetch('/bank-accounts', {
        method: 'POST',
        body: JSON.stringify({
          label: newLabel,
          upiId: newUpiId,
          accountHolder: newHolder || undefined,
          bankName: newBank || undefined,
          priority: Number(newPriority) || 0,
        }),
      });
      setNewUpiId('');
      await loadAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    }
  };

  const patchAccount = async (id: string, patch: any) => {
    setError('');
    try {
      await adminFetch(`/bank-accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      await loadAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to update account');
    }
  };

  const setPrimary = async (id: string) => {
    setError('');
    try {
      await adminFetch(`/bank-accounts/${id}/primary`, { method: 'POST' });
      await loadAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to set primary account');
    }
  };

  const approveWithdrawal = async (id: string) => {
    setError('');
    setWithdrawingId(id);
    try {
      await adminFetch(`/withdrawals/${id}/approve`, { method: 'POST' });
      await loadOpsData();
    } catch (err: any) {
      setError(err.message || 'Failed to approve withdrawal');
    } finally {
      setWithdrawingId(null);
    }
  };

  const rejectWithdrawal = async (id: string) => {
    const reason = window.prompt('Reject reason');
    if (!reason || !reason.trim()) return;
    setError('');
    setWithdrawingId(id);
    try {
      await adminFetch(`/withdrawals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      await loadOpsData();
    } catch (err: any) {
      setError(err.message || 'Failed to reject withdrawal');
    } finally {
      setWithdrawingId(null);
    }
  };

  const approveQRDeposit = async (id: string) => {
    setError('');
    setWithdrawingId(id);
    try {
      await adminFetch(`/deposits/qr/${id}/approve`, { method: 'POST' });
      await loadOpsData();
    } catch (err: any) {
      setError(err.message || 'Failed to approve QR deposit');
    } finally {
      setWithdrawingId(null);
    }
  };

  const rejectQRDeposit = async (id: string) => {
    const reason = window.prompt('Reject reason');
    setError('');
    setWithdrawingId(id);
    try {
      await adminFetch(`/deposits/qr/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Payment not received' }),
      });
      await loadOpsData();
    } catch (err: any) {
      setError(err.message || 'Failed to reject QR deposit');
    } finally {
      setWithdrawingId(null);
    }
  };

  const upsertEconomyConfig = async (gameType: string, patch: Partial<EconomyConfigRow>) => {
    const current = economyConfigs.find(c => c.game_type === gameType);
    const fallback: EconomyConfigRow = {
      game_type: gameType,
      rtp_factor: '0.95',
      enabled: false,
      starts_at: null,
      ends_at: null,
      note: null,
      updated_at: '',
    };
    const base = current || fallback;
    setError('');
    try {
      await adminFetch(`/economy/configs/${gameType}`, {
        method: 'PUT',
        body: JSON.stringify({
          rtpFactor: Number(patch.rtp_factor ?? base.rtp_factor),
          enabled: patch.enabled ?? base.enabled,
          startsAt: patch.starts_at ?? base.starts_at,
          endsAt: patch.ends_at ?? base.ends_at,
          note: patch.note ?? base.note,
        }),
      });
      await loadEconomyData();
    } catch (err: any) {
      setError(err.message || 'Failed to update economy config');
    }
  };

  const createNotice = async () => {
    if (!noticeTitle.trim() || !noticeMessage.trim()) return;
    setError('');
    try {
      await adminFetch('/notices', {
        method: 'POST',
        body: JSON.stringify({ title: noticeTitle.trim(), message: noticeMessage.trim(), isActive: true }),
      });
      setNoticeTitle('');
      setNoticeMessage('');
      await loadEconomyData();
    } catch (err: any) {
      setError(err.message || 'Failed to create notice');
    }
  };

  const toggleNotice = async (id: string, isActive: boolean) => {
    setError('');
    try {
      await adminFetch(`/notices/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !isActive }),
      });
      await loadEconomyData();
    } catch (err: any) {
      setError(err.message || 'Failed to update notice');
    }
  };

  const getLudoSplitRow = (playerCount: number): LudoPayoutConfigRow => {
    const existing = ludoPayouts.find((row) => row.player_count === playerCount);
    if (existing) return existing;
    if (playerCount === 2) return { player_count: 2, rank_splits: [1, 0], updated_at: '' };
    if (playerCount === 3) return { player_count: 3, rank_splits: [0.65, 0.35, 0], updated_at: '' };
    return { player_count: 4, rank_splits: [0.5, 0.3, 0.2, 0], updated_at: '' };
  };

  const updateLudoSplitLocal = (playerCount: 2 | 3 | 4, index: number, value: number) => {
    setLudoPayouts((prev) => {
      const row = getLudoSplitRow(playerCount);
      const nextRow: LudoPayoutConfigRow = {
        ...row,
        rank_splits: row.rank_splits.map((x, i) => (i === index ? Math.max(0, Number(value || 0)) : x)),
      };
      const without = prev.filter((r) => r.player_count !== playerCount);
      return [...without, nextRow].sort((a, b) => a.player_count - b.player_count);
    });
  };

  const saveLudoSplits = async (playerCount: 2 | 3 | 4) => {
    const row = getLudoSplitRow(playerCount);
    setError('');
    try {
      await adminFetch(`/economy/ludo-payouts/${playerCount}`, {
        method: 'PUT',
        body: JSON.stringify({ rankSplits: row.rank_splits }),
      });
      await loadEconomyData();
      await loadLudoPreview(playerCount, ludoEntryFee, ludoMatchesPerDay);
    } catch (err: any) {
      setError(err.message || 'Failed to save ludo splits');
    }
  };

  const loadLudoPreview = async (playerCount = ludoPlayerCount, entryFee = ludoEntryFee, matchesPerDay = ludoMatchesPerDay) => {
    setError('');
    try {
      const data = await adminFetch(`/economy/ludo-preview?playerCount=${playerCount}&entryFee=${entryFee}&matchesPerDay=${matchesPerDay}`);
      setLudoPreview(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load ludo preview');
    }
  };

  useEffect(() => {
    loadLudoPreview();
  }, [ludoPlayerCount]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginBottom: 8 }}>Master Admin - Payment Routing</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
            Manage UPI IDs / QR source accounts, switch primary instantly, and keep backup accounts active.
          </p>
          {authHint && <p style={{ color: '#ffae57', marginTop: 8, marginBottom: 0 }}>{authHint}</p>}
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Add Backup UPI Account</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label" style={inputStyle} />
            <input value={newUpiId} onChange={e => setNewUpiId(e.target.value)} placeholder="UPI ID" style={inputStyle} />
            <input value={newHolder} onChange={e => setNewHolder(e.target.value)} placeholder="Account Holder" style={inputStyle} />
            <input value={newBank} onChange={e => setNewBank(e.target.value)} placeholder="Bank Name" style={inputStyle} />
            <input type="number" value={newPriority} onChange={e => setNewPriority(Number(e.target.value) || 0)} placeholder="Priority" style={inputStyle} />
          </div>
          <button onClick={createAccount} style={btnPrimary}>Add Account</button>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Game Revenue Dashboard (House P&L)</h3>
            <button onClick={loadGameStats} style={btnSecondary}>{gameStatsLoading ? 'Refreshing...' : 'Refresh'}</button>
          </div>

          {gameStats && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
                <div style={metricCard}>
                  <div style={metricLabel}>Today Rounds</div>
                  <div style={metricValue}>{Number(gameStats.today.rounds || 0).toLocaleString('en-IN')}</div>
                </div>
                <div style={metricCard}>
                  <div style={metricLabel}>Today Wagered</div>
                  <div style={metricValue}>₹{toMoney(gameStats.today.wagered)}</div>
                </div>
                <div style={metricCard}>
                  <div style={metricLabel}>Today Payout</div>
                  <div style={metricValue}>₹{toMoney(gameStats.today.payout)}</div>
                </div>
                <div style={metricCard}>
                  <div style={metricLabel}>Today House Net</div>
                  <div style={{ ...metricValue, color: '#00e701' }}>₹{toMoney(gameStats.today.house_net)}</div>
                </div>
              </div>

              <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th style={thStyle}>Game</th>
                      <th style={thStyle}>Rounds</th>
                      <th style={thStyle}>Wagered</th>
                      <th style={thStyle}>Payout</th>
                      <th style={thStyle}>House Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameStats.byGameToday.map((row) => (
                      <tr key={row.game_type}>
                        <td style={tdStyle}>{row.game_type}</td>
                        <td style={tdStyle}>{Number(row.rounds || 0).toLocaleString('en-IN')}</td>
                        <td style={tdStyle}>₹{toMoney(row.wagered)}</td>
                        <td style={tdStyle}>₹{toMoney(row.payout)}</td>
                        <td style={{ ...tdStyle, color: Number(row.house_net) >= 0 ? '#00e701' : '#ff7a7a' }}>
                          ₹{toMoney(row.house_net)}
                        </td>
                      </tr>
                    ))}
                    {gameStats.byGameToday.length === 0 && (
                      <tr><td style={tdStyle} colSpan={5}>No game sessions today.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px 0' }}>Last {gameStats.days} Days Trend</h4>
                <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                        <th style={thStyle}>Day</th>
                        <th style={thStyle}>Game</th>
                        <th style={thStyle}>Rounds</th>
                        <th style={thStyle}>Wagered</th>
                        <th style={thStyle}>House Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gameStats.trend.map((row, i) => (
                        <tr key={`${row.day}-${row.game_type}-${i}`}>
                          <td style={tdStyle}>{row.day}</td>
                          <td style={tdStyle}>{row.game_type}</td>
                          <td style={tdStyle}>{Number(row.rounds || 0).toLocaleString('en-IN')}</td>
                          <td style={tdStyle}>₹{toMoney(row.wagered)}</td>
                          <td style={{ ...tdStyle, color: Number(row.house_net) >= 0 ? '#00e701' : '#ff7a7a' }}>
                            ₹{toMoney(row.house_net)}
                          </td>
                        </tr>
                      ))}
                      {gameStats.trend.length === 0 && (
                        <tr><td style={tdStyle} colSpan={5}>No sessions in selected period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Seasonal Win Ratio Controls (Transparent RTP)</h3>
            <button onClick={loadEconomyData} style={btnSecondary}>{economyLoading ? 'Refreshing...' : 'Refresh'}</button>
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
            Set temporary RTP per game (0.70 to 0.99). Keep this disclosed to players via notices.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {economyRows.map((row) => (
              <div key={row.game_type} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8, background: 'var(--bg-card)', display: 'grid', gridTemplateColumns: '1.2fr 0.9fr auto auto', gap: 8, alignItems: 'center' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{row.game_type}</div>
                <input
                  type="number"
                  step="0.01"
                  min="0.70"
                  max="0.99"
                  value={row.rtp_factor}
                  onChange={e => setEconomyConfigs(prev => {
                    const next = [...prev];
                    const idx = next.findIndex(x => x.game_type === row.game_type);
                    const v = e.target.value;
                    if (idx >= 0) next[idx] = { ...next[idx], rtp_factor: v };
                    else next.push({ ...row, rtp_factor: v });
                    return next;
                  })}
                  style={inputStyle}
                />
                <button onClick={() => upsertEconomyConfig(row.game_type, { enabled: !row.enabled })} style={btnSecondary}>
                  {row.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button onClick={() => upsertEconomyConfig(row.game_type, {})} style={btnPrimarySmall}>Save</button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
            <h4 style={{ margin: '0 0 8px 0' }}>Ludo Rank Payout + Margin Calculator</h4>
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
              Set rank-wise payout split. House fee is taken first from total pool using current Ludo RTP.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 10 }}>
              <select value={ludoPlayerCount} onChange={(e) => setLudoPlayerCount(Number(e.target.value) as 2 | 3 | 4)} style={inputStyle}>
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
              </select>
              <input type="number" min="1" value={ludoEntryFee} onChange={e => setLudoEntryFee(Number(e.target.value) || 1)} placeholder="Entry Fee" style={inputStyle} />
              <input type="number" min="1" value={ludoMatchesPerDay} onChange={e => setLudoMatchesPerDay(Number(e.target.value) || 1)} placeholder="Matches / Day" style={inputStyle} />
              <button onClick={() => loadLudoPreview()} style={btnSecondary}>Recalculate</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {[2, 3, 4].map((count) => {
                const row = getLudoSplitRow(count);
                return (
                  <div key={count} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8, background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <strong>{count}P Split</strong>
                      <button onClick={() => saveLudoSplits(count as 2 | 3 | 4)} style={btnPrimarySmall}>Save {count}P</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, minmax(80px, 1fr))`, gap: 6 }}>
                      {row.rank_splits.slice(0, count).map((split, idx) => (
                        <input
                          key={`${count}-${idx}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={split}
                          onChange={e => updateLudoSplitLocal(count as 2 | 3 | 4, idx, Number(e.target.value))}
                          placeholder={`P${idx + 1}`}
                          style={inputStyle}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {ludoPreview && (
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, background: 'var(--bg-card)', marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
                  <div style={metricCard}><div style={metricLabel}>Ludo RTP</div><div style={metricValue}>{(ludoPreview.rtp * 100).toFixed(1)}%</div></div>
                  <div style={metricCard}><div style={metricLabel}>House Edge</div><div style={metricValue}>{(ludoPreview.houseEdge * 100).toFixed(1)}%</div></div>
                  <div style={metricCard}><div style={metricLabel}>House / Match</div><div style={metricValue}>₹{(ludoPreview.housePerMatch / 100000).toFixed(2)}</div></div>
                  <div style={metricCard}><div style={metricLabel}>House / Day</div><div style={{ ...metricValue, color: '#00e701' }}>₹{(ludoPreview.housePerDay / 100000).toFixed(2)}</div></div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Pool ₹{(ludoPreview.totalPool / 100000).toFixed(2)} {'->'} House ₹{(ludoPreview.houseFee / 100000).toFixed(2)} {'->'} Prize ₹{(ludoPreview.prizePool / 100000).toFixed(2)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                  {ludoPreview.positionSummary.map((pos) => (
                    <div key={pos.position} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8 }}>
                      <div style={metricLabel}>Position {pos.position}</div>
                      <div style={metricValue}>₹{(pos.amount / 100000).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h4 style={{ margin: '0 0 8px 0' }}>User Notices / Ads</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, marginBottom: 10 }}>
              <input value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} placeholder="Notice title" style={inputStyle} />
              <input value={noticeMessage} onChange={e => setNoticeMessage(e.target.value)} placeholder="Notice message" style={inputStyle} />
              <button onClick={createNotice} style={btnPrimarySmall}>Publish</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notices.map((n) => (
                <div key={n.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8, background: 'var(--bg-card)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.message}</div>
                  </div>
                  <button onClick={() => toggleNotice(n.id, n.is_active)} style={btnSecondary}>
                    {n.is_active ? 'Hide' : 'Show'}
                  </button>
                </div>
              ))}
              {notices.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No notices published.</div>}
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Platform Operations</h3>
            <button onClick={loadOpsData} style={btnSecondary}>{opsLoading ? 'Refreshing...' : 'Refresh'}</button>
          </div>

          {platformStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
              <div style={metricCard}>
                <div style={metricLabel}>Users</div>
                <div style={metricValue}>{Number(platformStats.users?.total || 0).toLocaleString('en-IN')}</div>
              </div>
              <div style={metricCard}>
                <div style={metricLabel}>Real Users</div>
                <div style={metricValue}>{Number(platformStats.users?.real_users || 0).toLocaleString('en-IN')}</div>
              </div>
              <div style={metricCard}>
                <div style={metricLabel}>Deposit Volume</div>
                <div style={metricValue}>₹{toMoney(platformStats.deposits?.total_volume || 0)}</div>
              </div>
              <div style={metricCard}>
                <div style={metricLabel}>Withdrawal Volume</div>
                <div style={metricValue}>₹{toMoney(platformStats.withdrawals?.total_volume || 0)}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 10 }}>
              <h4 style={{ margin: '0 0 8px 0' }}>Pending Withdrawals</h4>
              <div style={{ maxHeight: 180, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th style={thStyle}>User</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Time</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id}>
                        <td style={tdStyle}>{w.username || w.user_id.slice(0, 8)}</td>
                        <td style={tdStyle}>₹{toMoney(w.amount)}</td>
                        <td style={tdStyle}>{w.status}</td>
                        <td style={tdStyle}>{new Date(w.created_at).toLocaleString()}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => approveWithdrawal(w.id)}
                              style={btnPrimarySmall}
                              disabled={withdrawingId === w.id}
                            >
                              {withdrawingId === w.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => rejectWithdrawal(w.id)}
                              style={btnDangerSmall}
                              disabled={withdrawingId === w.id}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {withdrawals.length === 0 && <tr><td style={tdStyle} colSpan={5}>No pending withdrawals.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 10 }}>
              <h4 style={{ margin: '0 0 8px 0' }}>Pending QR Deposits</h4>
              <div style={{ maxHeight: 180, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th style={thStyle}>User</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>UTR</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qrDeposits.map((d) => (
                      <tr key={d.id}>
                        <td style={tdStyle}>{d.username || d.user_id.slice(0, 8)}</td>
                        <td style={tdStyle}>₹{toMoney(d.amount)}</td>
                        <td style={tdStyle}>{d.status}</td>
                        <td style={tdStyle}>{d.utr_number || '-'}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => approveQRDeposit(d.id)} style={btnPrimarySmall} disabled={withdrawingId === d.id}>
                              {withdrawingId === d.id ? '...' : 'Approve'}
                            </button>
                            <button onClick={() => rejectQRDeposit(d.id)} style={btnDangerSmall} disabled={withdrawingId === d.id}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {qrDeposits.length === 0 && <tr><td style={tdStyle} colSpan={5}>No pending QR deposits.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 10 }}>
              <h4 style={{ margin: '0 0 8px 0' }}>Latest Users</h4>
              <div style={{ maxHeight: 180, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th style={thStyle}>Username</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>Real Bal</th>
                      <th style={thStyle}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td style={tdStyle}>{u.username}</td>
                        <td style={tdStyle}>{u.role}</td>
                        <td style={tdStyle}>₹{toMoney(u.balance)}</td>
                        <td style={tdStyle}>{new Date(u.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {users.length === 0 && <tr><td style={tdStyle} colSpan={4}>No users found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 10 }}>
              <h4 style={{ margin: '0 0 8px 0' }}>Latest Transactions</h4>
              <div style={{ maxHeight: 220, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th style={thStyle}>User</th>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td style={tdStyle}>{t.username}</td>
                        <td style={tdStyle}>{t.type}</td>
                        <td style={tdStyle}>₹{toMoney(t.amount)}</td>
                        <td style={tdStyle}>{t.status}</td>
                      </tr>
                    ))}
                    {transactions.length === 0 && <tr><td style={tdStyle} colSpan={4}>No transactions found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>UPI / QR Accounts</h3>
            <button onClick={loadAccounts} style={btnSecondary}>{loading ? 'Refreshing...' : 'Refresh'}</button>
          </div>

          {error && <div style={{ color: '#ff8080', marginBottom: 10 }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {accounts.map((a) => (
              <div key={a.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 12, background: 'var(--bg-card)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1fr auto', gap: 10, alignItems: 'center' }}>
                  <input value={a.label || ''} onChange={e => setAccounts(prev => prev.map(x => x.id === a.id ? { ...x, label: e.target.value } : x))} style={inputStyle} />
                  <input value={a.upi_id || ''} onChange={e => setAccounts(prev => prev.map(x => x.id === a.id ? { ...x, upi_id: e.target.value } : x))} style={inputStyle} />
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Daily: {(a.daily_received / 100000).toFixed(2)} / {(a.daily_limit / 100000).toFixed(2)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setPrimary(a.id)} style={btnSecondary}>Set Primary</button>
                    <button onClick={() => patchAccount(a.id, { isActive: !a.is_active })} style={btnSecondary}>{a.is_active ? 'Disable' : 'Enable'}</button>
                    <button
                      onClick={() => patchAccount(a.id, { label: a.label, upiId: a.upi_id, priority: a.priority })}
                      style={btnPrimarySmall}
                    >
                      Save
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 10, color: 'var(--text-muted)', fontSize: 12 }}>
                  <span>Priority: {a.priority}</span>
                  <span>Status: {a.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
                  <span>ID: {a.id.slice(0, 8)}</span>
                </div>
              </div>
            ))}
            {accounts.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No payment accounts configured.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const inputStyle: CSSProperties = {
  background: 'var(--bg-input)',
  color: 'white',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  padding: '10px 12px',
  outline: 'none',
};

const btnPrimary: CSSProperties = {
  marginTop: 12,
  background: '#00e701',
  color: '#022102',
  border: 'none',
  borderRadius: 8,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
};

const btnPrimarySmall: CSSProperties = {
  background: '#00e701',
  color: '#022102',
  border: 'none',
  borderRadius: 8,
  padding: '8px 10px',
  fontWeight: 700,
  cursor: 'pointer',
};

const btnSecondary: CSSProperties = {
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  padding: '8px 10px',
  fontWeight: 600,
  cursor: 'pointer',
};

const btnDangerSmall: CSSProperties = {
  background: 'rgba(237, 66, 69, 0.15)',
  color: '#ff9c9f',
  border: '1px solid rgba(237, 66, 69, 0.45)',
  borderRadius: 8,
  padding: '8px 10px',
  fontWeight: 700,
  cursor: 'pointer',
};

const metricCard: CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 10,
  padding: '10px 12px',
};

const metricLabel: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 12,
  marginBottom: 4,
};

const metricValue: CSSProperties = {
  color: 'var(--text-primary)',
  fontSize: 20,
  fontWeight: 800,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid var(--border-subtle)',
  fontWeight: 700,
};

const tdStyle: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  color: 'var(--text-primary)',
};

export default AdminPortal;
