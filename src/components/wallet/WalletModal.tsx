import { useState } from 'react';
import { DepositTab } from './DepositTab';
import { WithdrawTab } from './WithdrawTab';
import { TransactionHistory } from './TransactionHistory';
import './Wallet.css';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'deposit' | 'withdraw' | 'history';

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('deposit');

  if (!isOpen) return null;

  return (
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wallet-modal-header">
          <h2>Wallet</h2>
          <button className="wallet-close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="wallet-tabs">
          {(['deposit', 'withdraw', 'history'] as TabType[]).map(tab => (
            <button
              key={tab}
              className={`wallet-tab${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="wallet-content">
          {activeTab === 'deposit' && <DepositTab />}
          {activeTab === 'withdraw' && <WithdrawTab />}
          {activeTab === 'history' && <TransactionHistory />}
        </div>
      </div>
    </div>
  );
};
