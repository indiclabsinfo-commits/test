import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import { apiService } from '../../services/api';
import { formatIndianNumber } from '../../utils/format';

const METHODS = [
  { id: 'upi', label: 'UPI', currency: 'INR', icon: 'UPI', minAmount: 100, description: 'Instant bank transfer' },
  { id: 'bank', label: 'Bank Transfer', currency: 'INR', icon: 'BANK', minAmount: 500, description: 'NEFT/IMPS/RTGS' },
  { id: 'btc', label: 'Bitcoin', currency: 'BTC', icon: 'BTC', minAmount: 0.0001, description: '~30 min processing' },
  { id: 'usdt_polygon', label: 'USDT (Polygon)', currency: 'USDT_POLYGON', icon: 'USDT', minAmount: 5, description: '~5 min processing' },
];

interface FeeInfo {
  fees: Record<string, number>;
  minimums: Record<string, number>;
}

export const WithdrawTab: React.FC = () => {
  const { activeBalance, isDemoMode } = useGame();
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fees, setFees] = useState<FeeInfo | null>(null);

  useEffect(() => {
    apiService.getWithdrawalFees().then(setFees).catch(() => {});
  }, []);

  const selectedMethod = METHODS.find(m => m.id === method);
  const amountNum = parseFloat(amount) || 0;
  const feeAmount = fees && selectedMethod ? (fees.fees[selectedMethod.currency] || 0) / 100000 : 0;
  const netAmount = Math.max(0, amountNum - feeAmount);

  const getDestinationLabel = () => {
    if (!selectedMethod) return 'Destination';
    switch (method) {
      case 'upi': return 'UPI ID (e.g. name@bank)';
      case 'bank': return 'Account Number';
      case 'btc': return 'Bitcoin Address';
      case 'usdt_polygon': return 'Polygon Wallet Address';
      default: return 'Destination';
    }
  };

  const handleSubmit = async () => {
    if (!selectedMethod || amountNum <= 0 || !destination.trim()) return;
    if (amountNum > activeBalance) {
      setError('Insufficient balance');
      return;
    }
    if (amountNum < selectedMethod.minAmount) {
      setError(`Minimum withdrawal: ${selectedMethod.minAmount}`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await apiService.requestWithdrawal({
        amount: Math.floor(amountNum * 100000),
        currency: selectedMethod.currency,
        method: method,
        destination: destination.trim(),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Withdrawal request failed');
    } finally {
      setLoading(false);
    }
  };

  if (isDemoMode) {
    return (
      <div className="wallet-empty">
        <p>Withdrawals are only available in Real Money mode.</p>
        <p style={{ fontSize: '0.8rem', marginTop: 'var(--space-2)' }}>
          Switch to Real Mode using the toggle in the header.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="wallet-flow-step">
        <h3>Withdrawal Requested</h3>
        <div className="wallet-status success">Your withdrawal is being processed</div>
        <p>
          Amount: {formatIndianNumber(netAmount, true)} via {selectedMethod?.label}
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Withdrawals require admin approval. You'll be notified once processed.
        </p>
        <button
          className="wallet-action-btn"
          onClick={() => { setSuccess(false); setAmount(''); setDestination(''); setMethod(''); }}
        >
          New Withdrawal
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="wallet-amount-section">
        <label>Available Balance</label>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-green)', marginBottom: 'var(--space-3)' }}>
          ${formatIndianNumber(activeBalance, true)}
        </div>
      </div>

      {/* Method selection */}
      <div className="wallet-amount-section">
        <label>Withdrawal Method</label>
        <div className="wallet-methods">
          {METHODS.map(m => (
            <div
              key={m.id}
              className={`wallet-method${method === m.id ? ' selected' : ''}`}
              onClick={() => setMethod(m.id)}
            >
              <div className="wallet-method-icon">{m.icon}</div>
              <div className="wallet-method-info">
                <h4>{m.label}</h4>
                <p>{m.description}</p>
              </div>
              {method === m.id && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {method && (
        <>
          {/* Amount */}
          <div className="wallet-amount-section">
            <label>Amount</label>
            <input
              type="number"
              className="wallet-amount-input"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={selectedMethod?.minAmount}
              max={activeBalance}
            />
            <div className="wallet-amount-presets">
              {[100, 500, 1000, 5000].map(preset => (
                <button
                  key={preset}
                  className="wallet-preset-btn"
                  onClick={() => setAmount(String(preset))}
                >
                  {preset}
                </button>
              ))}
              <button className="wallet-preset-btn" onClick={() => setAmount(String(Math.floor(activeBalance)))}>
                MAX
              </button>
            </div>
          </div>

          {/* Destination */}
          <div className="wallet-amount-section">
            <label>{getDestinationLabel()}</label>
            <input
              type="text"
              className="wallet-utr-input"
              placeholder={getDestinationLabel()}
              value={destination}
              onChange={e => setDestination(e.target.value)}
            />
          </div>

          {/* Fee info */}
          {amountNum > 0 && (
            <div>
              <div className="wallet-fee-info">
                <span>Amount</span>
                <span>${formatIndianNumber(amountNum, true)}</span>
              </div>
              <div className="wallet-fee-info">
                <span>Fee</span>
                <span>${formatIndianNumber(feeAmount, true)}</span>
              </div>
              <div className="wallet-fee-info" style={{ fontWeight: 700 }}>
                <span>You Receive</span>
                <span style={{ color: 'var(--accent-green)' }}>${formatIndianNumber(netAmount, true)}</span>
              </div>
            </div>
          )}

          {error && <div className="wallet-status error">{error}</div>}

          <button
            className="wallet-action-btn"
            disabled={loading || amountNum <= 0 || !destination.trim()}
            onClick={handleSubmit}
          >
            {loading ? 'Processing...' : 'Request Withdrawal'}
          </button>
        </>
      )}
    </div>
  );
};
