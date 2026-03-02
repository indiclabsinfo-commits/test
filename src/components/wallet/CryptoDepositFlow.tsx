import { useState } from 'react';
import { apiService } from '../../services/api';

interface Props {
  onBack: () => void;
}

const CURRENCIES = [
  { id: 'BTC', name: 'Bitcoin', icon: 'BTC', confirmations: '2 confirmations' },
  { id: 'XMR', name: 'Monero', icon: 'XMR', confirmations: '10 confirmations' },
  { id: 'USDT_POLYGON', name: 'USDT (Polygon)', icon: 'USDT', confirmations: '1 confirmation' },
];

export const CryptoDepositFlow: React.FC<Props> = ({ onBack }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSelectCurrency = async (currencyId: string) => {
    setSelectedCurrency(currencyId);
    setLoading(true);
    setError('');
    try {
      const result = await apiService.getCryptoAddress(currencyId);
      setAddress(result.address);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get deposit address');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currency = CURRENCIES.find(c => c.id === selectedCurrency);

  return (
    <div>
      <button
        onClick={selectedCurrency ? () => { setSelectedCurrency(null); setAddress(''); } : onBack}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}
      >
        ← {selectedCurrency ? 'Back to currencies' : 'Back to methods'}
      </button>

      {!selectedCurrency && (
        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-3)' }}>Select Cryptocurrency</h3>
          <div className="wallet-methods">
            {CURRENCIES.map(c => (
              <div key={c.id} className="wallet-method" onClick={() => handleSelectCurrency(c.id)}>
                <div className="wallet-method-icon">{c.icon}</div>
                <div className="wallet-method-info">
                  <h4>{c.name}</h4>
                  <p>{c.confirmations}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedCurrency && (
        <div className="wallet-flow-step">
          <h3>Deposit {currency?.name}</h3>
          <p>Send {currency?.name} to the address below</p>

          {loading && <div className="wallet-status pending">Generating address...</div>}

          {error && <div className="wallet-status error">{error}</div>}

          {address && !loading && (
            <>
              <div className="wallet-upi-display" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-2)' }}>
                <code style={{ fontSize: '0.8rem', wordBreak: 'break-all', lineHeight: 1.4 }}>
                  {address}
                </code>
                <button className="wallet-copy-btn" onClick={copyToClipboard} style={{ alignSelf: 'flex-end' }}>
                  {copied ? 'Copied!' : 'Copy Address'}
                </button>
              </div>

              <div className="wallet-status pending" style={{ marginTop: 'var(--space-3)' }}>
                Waiting for {currency?.confirmations}
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
                Your balance will be credited automatically once the transaction is confirmed on the blockchain.
                {selectedCurrency === 'USDT_POLYGON' && ' Make sure you send USDT on the Polygon network, not other chains.'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
