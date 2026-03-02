import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { formatIndianNumber } from '../../utils/format';

interface Props {
  onBack: () => void;
  autoCreateAmountInr?: number;
}

type Step = 'amount' | 'qr' | 'done' | 'error';

export const QRDepositFlow: React.FC<Props> = ({ onBack, autoCreateAmountInr }) => {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);

  const PRESETS = [500, 1000, 2000, 5000];

  // Countdown
  useEffect(() => {
    if (!order?.expiresAt) return;
    const timer = setInterval(() => {
      const left = Math.max(0, new Date(order.expiresAt).getTime() - Date.now());
      setTimeLeft(Math.floor(left / 1000));
      if (left <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [order?.expiresAt]);

  useEffect(() => {
    if (!autoCreateAmountInr || step !== 'amount') return;
    const auto = async () => {
      setAmount(String(autoCreateAmountInr));
      setLoading(true);
      setError('');
      try {
        const internalAmount = Math.floor(autoCreateAmountInr * 100000);
        const result = await apiService.createQRDeposit(internalAmount);
        if (result.order) {
          setOrder(result.order);
          setStep('qr');
        } else {
          setError(result.error || 'No bank accounts available');
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to create QR deposit');
      } finally {
        setLoading(false);
      }
    };
    auto();
  }, [autoCreateAmountInr, step]);

  // Poll status
  useEffect(() => {
    if (step !== 'qr' || !order) return;
    const poll = setInterval(async () => {
      try {
        const status = await apiService.getDepositStatus(order.id);
        if (status.status === 'completed') {
          clearInterval(poll);
          setStep('done');
        }
      } catch {}
    }, 5000);
    return () => clearInterval(poll);
  }, [step, order]);

  const handleCreate = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < 100) {
      setError('Minimum deposit: 100 INR');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const internalAmount = Math.floor(amountNum * 100000);
      const result = await apiService.createQRDeposit(internalAmount);
      if (result.order) {
        setOrder(result.order);
        setStep('qr');
      } else {
        setError(result.error || 'No bank accounts available');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create QR deposit');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}
      >
        ← Back to methods
      </button>

      {step === 'amount' && (
        <div className="wallet-flow-step">
          <h3>Bank QR Deposit</h3>
          <p>Enter amount to generate a UPI QR code</p>

          <div className="wallet-amount-section">
            <label>Amount (INR)</label>
            <input
              type="number"
              className="wallet-amount-input"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="100"
            />
            <div className="wallet-amount-presets">
              {PRESETS.map(p => (
                <button key={p} className="wallet-preset-btn" onClick={() => setAmount(p.toString())}>
                  {formatIndianNumber(p)}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="wallet-status error">{error}</div>}

          <button className="wallet-action-btn" onClick={handleCreate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate QR Code'}
          </button>
        </div>
      )}

      {step === 'qr' && order && (
        <div className="wallet-flow-step">
          <h3>Scan QR to Pay</h3>
          <p>Pay {formatIndianNumber(order.amount / 100000)} INR</p>

          <div className="wallet-timer">
            Expires in <span>{formatTime(timeLeft)}</span>
          </div>

          {/* UPI ID as fallback */}
          <div className="wallet-upi-display">
            <code>{order.upiId}</code>
            <button className="wallet-copy-btn" onClick={() => copyToClipboard(order.upiId)}>
              Copy UPI
            </button>
          </div>

          {order.accountHolder && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Account: {order.accountHolder} ({order.bankName})
            </p>
          )}

          {order.qrData && (
            <div style={{ marginTop: '10px', textAlign: 'center' }}>
              <img
                src={`https://quickchart.io/qr?size=220&text=${encodeURIComponent(order.qrData)}`}
                alt="UPI QR"
                style={{
                  width: 'min(220px, 100%)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: '#fff',
                  padding: '8px'
                }}
              />
            </div>
          )}

          <div className="wallet-status pending">
            Waiting for payment confirmation...
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Payment will be auto-detected. If not credited within 10 minutes, contact support.
          </p>
        </div>
      )}

      {step === 'done' && (
        <div className="wallet-flow-step">
          <div className="wallet-status success">
            Payment received! Balance credited.
          </div>
          <button className="wallet-action-btn" onClick={onBack}>Done</button>
        </div>
      )}

      {step === 'error' && (
        <div className="wallet-flow-step">
          <div className="wallet-status error">{error}</div>
          <button className="wallet-action-btn" onClick={() => { setStep('amount'); setError(''); }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};
