import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { formatIndianNumber } from '../../utils/format';

interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  fee: number;
  net_amount: number;
  currency: string;
  description: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  game_bet: 'Bet',
  game_win: 'Win',
  fee: 'Fee',
  refund: 'Refund',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'var(--accent-green)',
  pending: '#ffc107',
  failed: 'var(--accent-red)',
  rejected: 'var(--accent-red)',
  approved: '#4fc3f7',
  processing: '#ffc107',
};

export const TransactionHistory: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiService.getTransactions(100);
        setTransactions(data || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter(t => t.type === filter);

  const isPositive = (type: string) => ['deposit', 'game_win', 'refund'].includes(type);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="wallet-empty">
        <p>Loading transactions...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'deposit', label: 'Deposits' },
          { key: 'withdrawal', label: 'Withdrawals' },
          { key: 'game_bet', label: 'Bets' },
          { key: 'game_win', label: 'Wins' },
        ].map(f => (
          <button
            key={f.key}
            className="wallet-preset-btn"
            style={filter === f.key ? { borderColor: 'var(--accent-green)', color: 'var(--accent-green)' } : {}}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="wallet-empty">
          <p>No transactions yet</p>
        </div>
      ) : (
        <div className="wallet-tx-list">
          {filtered.map(tx => (
            <div key={tx.id} className="wallet-tx-item">
              <div className={`wallet-tx-type ${isPositive(tx.type) ? 'deposit' : 'withdrawal'}`}>
                {isPositive(tx.type) ? '+' : '-'}
              </div>
              <div className="wallet-tx-info">
                <h4>{TYPE_LABELS[tx.type] || tx.type}{tx.description ? ` - ${tx.description}` : ''}</h4>
                <p>
                  {formatDate(tx.created_at)}
                  <span
                    style={{
                      marginLeft: 'var(--space-2)',
                      color: STATUS_COLORS[tx.status] || 'var(--text-muted)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      fontSize: '0.65rem',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {tx.status}
                  </span>
                </p>
              </div>
              <div className={`wallet-tx-amount ${isPositive(tx.type) ? 'positive' : 'negative'}`}>
                {isPositive(tx.type) ? '+' : '-'}${formatIndianNumber((tx.net_amount || tx.amount) / 100000, true)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
