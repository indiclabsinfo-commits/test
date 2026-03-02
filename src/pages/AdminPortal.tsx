import { useEffect, useMemo, useState, type CSSProperties } from 'react';

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

export const AdminPortal: React.FC = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [newLabel, setNewLabel] = useState('Primary UPI');
  const [newUpiId, setNewUpiId] = useState('');
  const [newHolder, setNewHolder] = useState('');
  const [newBank, setNewBank] = useState('');
  const [newPriority, setNewPriority] = useState(10);

  const token = useMemo(() => localStorage.getItem('accessToken') || '', []);

  const adminFetch = async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_URL}/admin${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
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

  useEffect(() => {
    loadAccounts();
  }, []);

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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginBottom: 8 }}>Master Admin - Payment Routing</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
            Manage UPI IDs / QR source accounts, switch primary instantly, and keep backup accounts active.
          </p>
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

export default AdminPortal;
