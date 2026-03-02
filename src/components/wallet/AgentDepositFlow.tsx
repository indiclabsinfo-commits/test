import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { formatIndianNumber } from '../../utils/format';

interface Props {
  onBack: () => void;
}

type Step = 'amount' | 'pay' | 'utr' | 'waiting' | 'done' | 'error';

export const AgentDepositFlow: React.FC<Props> = ({ onBack }) => {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);

  const PRESETS = [500, 1000, 2000, 5000];

  // Countdown timer
  useEffect(() => {
    if (!order?.expiresAt) return;
    const timer = setInterval(() => {
      const left = Math.max(0, new Date(order.expiresAt).getTime() - Date.now());
      setTimeLeft(Math.floor(left / 1000));
      if (left <= 0) {
        clearInterval(timer);
        setStep('error');
        setError('Order expired');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [order?.expiresAt]);

  // Poll order status
  useEffect(() => {
    if (step !== 'waiting' || !order) return;
    const poll = setInterval(async () => {
      try {
        const status = await apiService.getDepositStatus(order.id);
        if (status.status === 'completed') {
          clearInterval(poll);
          setStep('done');
        } else if (status.status === 'rejected') {
          clearInterval(poll);
          setStep('error');
          setError(status.rejection_reason || 'Payment rejected by agent');
        }
      } catch {}
    }, 3000);
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
      const result = await apiService.createAgentDeposit(internalAmount);
      if (result.order) {
        setOrder(result.order);
        setStep('pay');
      } else {
        setError(result.error || 'Failed to create deposit');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create deposit');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!utrNumber.trim() || utrNumber.length < 6) {
      setError('Enter valid UTR/Reference number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiService.markDepositPaid(order.id, utrNumber.trim());
      setStep('waiting');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit');
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
          <h3>P2P Agent Deposit</h3>
          <p>Enter the amount you want to deposit (INR)</p>

          <div className="wallet-amount-section">
            <label>Amount (INR)</label>
            <input
              type="number"
              className="wallet-amount-input"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="100"
              max="50000"
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
            {loading ? 'Creating...' : 'Continue'}
          </button>
        </div>
      )}

      {step === 'pay' && order && (
        <div className="wallet-flow-step">
          <h3>Pay to Agent</h3>
          <p>Send exactly {formatIndianNumber(order.amount / 100000)} INR to:</p>

          <div className="wallet-upi-display">
            <code>{order.agentUpiId}</code>
            <button className="wallet-copy-btn" onClick={() => copyToClipboard(order.agentUpiId)}>
              Copy
            </button>
          </div>

          <div className="wallet-timer">
            Expires in <span>{formatTime(timeLeft)}</span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Agent: {order.agentName}
          </p>

          <button className="wallet-action-btn" onClick={() => setStep('utr')}>
            I've Sent the Payment
          </button>
        </div>
      )}

      {step === 'utr' && (
        <div className="wallet-flow-step">
          <h3>Enter UTR / Reference Number</h3>
          <p>Enter the UTR or transaction reference from your UPI app</p>

          <input
            type="text"
            className="wallet-utr-input"
            placeholder="Enter UTR number"
            value={utrNumber}
            onChange={(e) => setUtrNumber(e.target.value)}
            maxLength={30}
          />

          {error && <div className="wallet-status error">{error}</div>}

          <button className="wallet-action-btn" onClick={handleMarkPaid} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit for Verification'}
          </button>
        </div>
      )}

      {step === 'waiting' && (
        <div className="wallet-flow-step">
          <h3>Waiting for Verification</h3>
          <div className="wallet-status pending">
            Agent is verifying your payment...
          </div>
          <p>This usually takes 1-5 minutes. Your balance will be credited automatically.</p>
        </div>
      )}

      {step === 'done' && (
        <div className="wallet-flow-step">
          <div className="wallet-status success">
            Deposit successful! Balance credited.
          </div>
          <button className="wallet-action-btn" onClick={onBack}>Done</button>
        </div>
      )}

      {step === 'error' && (
        <div className="wallet-flow-step">
          <div className="wallet-status error">{error || 'Something went wrong'}</div>
          <button className="wallet-action-btn" onClick={() => { setStep('amount'); setError(''); }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};
