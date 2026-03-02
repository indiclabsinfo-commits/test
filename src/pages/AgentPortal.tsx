import { useState, useEffect, useCallback } from 'react';
import '../components/wallet/Wallet.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface Order {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  utr_number: string | null;
  created_at: string;
  expires_at: string;
}

interface AgentStats {
  today_completed: number;
  today_volume: number;
  total_completed: number;
  total_volume: number;
  pending_count: number;
}

export const AgentPortal: React.FC = () => {
  const [token, setToken] = useState(() => localStorage.getItem('agentToken') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(!!token);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const agentFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_URL}/agent${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    if (res.status === 401) {
      setIsLoggedIn(false);
      setToken('');
      localStorage.removeItem('agentToken');
      throw new Error('Session expired');
    }
    return res.json();
  }, [token]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [ordersData, statsData] = await Promise.all([
        agentFetch('/orders'),
        agentFetch('/stats'),
      ]);
      setOrders(ordersData.orders || []);
      setStats(statsData.stats || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, agentFetch]);

  useEffect(() => {
    if (isLoggedIn && token) {
      loadData();
      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, token, loadData]);

  const handleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_URL}/agent/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setToken(data.token);
      localStorage.setItem('agentToken', data.token);
      setIsLoggedIn(true);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerify = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await agentFetch(`/orders/${orderId}/verify`, { method: 'POST' });
      loadData();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (orderId: string) => {
    if (!rejectReason.trim()) return;
    setActionLoading(orderId);
    try {
      await agentFetch(`/orders/${orderId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      });
      setRejectingId(null);
      setRejectReason('');
      loadData();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    setToken('');
    setIsLoggedIn(false);
    localStorage.removeItem('agentToken');
  };

  const formatAmount = (amt: number) => (amt / 100000).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const getTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Login screen
  if (!isLoggedIn) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
          width: '100%',
          maxWidth: 380,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>Agent Portal</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sign in to manage deposit orders</p>
          </div>

          <div style={{ marginBottom: 'var(--space-3)' }}>
            <input
              type="text"
              className="wallet-utr-input"
              placeholder="Agent Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <input
              type="password"
              className="wallet-utr-input"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {loginError && <div className="wallet-status error">{loginError}</div>}

          <button
            className="wallet-action-btn"
            onClick={handleLogin}
            disabled={loginLoading || !username || !password}
          >
            {loginLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </div>
    );
  }

  // Agent dashboard
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      padding: 'var(--space-4)',
      maxWidth: 600,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
      }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Agent Portal</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stats ? `${stats.pending_count} pending orders` : 'Loading...'}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-muted)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          Logout
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}>
          {[
            { label: 'Today Completed', value: stats.today_completed },
            { label: 'Today Volume', value: `$${formatAmount(stats.today_volume)}` },
            { label: 'Total Completed', value: stats.total_completed },
            { label: 'Total Volume', value: `$${formatAmount(stats.total_volume)}` },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Orders */}
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>Pending Orders</h3>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="wallet-empty">
            <p>No pending orders</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {orders.map(order => (
              <div key={order.id} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--accent-green)' }}>
                      ${formatAmount(order.amount)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Order #{order.id.slice(0, 8)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: order.status === 'user_paid' ? 'var(--accent-green)' : '#ffc107',
                      textTransform: 'uppercase',
                    }}>
                      {order.status === 'user_paid' ? 'PAID' : order.status}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {getTimeLeft(order.expires_at)} left
                    </div>
                  </div>
                </div>

                {order.utr_number && (
                  <div style={{
                    background: 'var(--bg-tertiary)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 'var(--space-3)',
                    fontSize: '0.85rem',
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>UTR: </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace' }}>{order.utr_number}</span>
                  </div>
                )}

                {order.status === 'user_paid' && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      className="wallet-action-btn"
                      style={{ marginTop: 0, flex: 1 }}
                      disabled={actionLoading === order.id}
                      onClick={() => handleVerify(order.id)}
                    >
                      {actionLoading === order.id ? '...' : 'Verify Payment'}
                    </button>
                    {rejectingId === order.id ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        <input
                          type="text"
                          className="wallet-utr-input"
                          style={{ marginBottom: 0, fontSize: '0.8rem', padding: 'var(--space-2)' }}
                          placeholder="Reason for rejection"
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                          <button
                            onClick={() => handleReject(order.id)}
                            disabled={!rejectReason.trim() || actionLoading === order.id}
                            style={{
                              flex: 1, background: 'var(--accent-red)', color: '#fff', border: 'none',
                              borderRadius: 'var(--radius-sm)', padding: 'var(--space-1)', cursor: 'pointer', fontSize: '0.75rem',
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            style={{
                              flex: 1, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)', padding: 'var(--space-1)', cursor: 'pointer', fontSize: '0.75rem',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRejectingId(order.id)}
                        style={{
                          flex: 0, background: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)',
                          borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', cursor: 'pointer',
                          fontSize: '0.85rem', fontWeight: 600,
                        }}
                      >
                        Reject
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
