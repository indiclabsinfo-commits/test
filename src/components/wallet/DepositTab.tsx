import { useState } from 'react';
import { AgentDepositFlow } from './AgentDepositFlow';
import { QRDepositFlow } from './QRDepositFlow';
import { CryptoDepositFlow } from './CryptoDepositFlow';

type DepositMethod = 'select' | 'agent' | 'qr' | 'crypto';

export const DepositTab: React.FC = () => {
  const [method, setMethod] = useState<DepositMethod>('select');

  if (method === 'agent') return <AgentDepositFlow onBack={() => setMethod('select')} />;
  if (method === 'qr') return <QRDepositFlow onBack={() => setMethod('select')} />;
  if (method === 'crypto') return <CryptoDepositFlow onBack={() => setMethod('select')} />;

  return (
    <div>
      <div className="wallet-methods">
        <div className="wallet-method" onClick={() => setMethod('agent')}>
          <div className="wallet-method-icon">P2P</div>
          <div className="wallet-method-info">
            <h4>P2P Agent Transfer</h4>
            <p>Pay via UPI to verified agent. Instant crediting.</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>

        <div className="wallet-method" onClick={() => setMethod('qr')}>
          <div className="wallet-method-icon">QR</div>
          <div className="wallet-method-info">
            <h4>Bank QR Payment</h4>
            <p>Scan UPI QR code and pay directly.</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>

        <div className="wallet-method" onClick={() => setMethod('crypto')}>
          <div className="wallet-method-icon">BTC</div>
          <div className="wallet-method-info">
            <h4>Crypto Deposit</h4>
            <p>BTC, XMR, or USDT on Polygon.</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    </div>
  );
};
