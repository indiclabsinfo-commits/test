import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPhone, FaEnvelope, FaLock } from 'react-icons/fa';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (method: 'phone' | 'email', value: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [activeTab, setActiveTab] = useState<'phone' | 'email'>('phone');
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue) return;

        setIsLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsLoading(false);
        onSuccess(activeTab, inputValue);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(15, 33, 46, 0.8)', backdropFilter: 'blur(5px)'
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        style={{
                            background: '#1a2c38',
                            width: '400px',
                            maxWidth: '90%',
                            borderRadius: '16px',
                            border: '1px solid #2f4553',
                            overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '24px',
                            textAlign: 'center',
                            borderBottom: '1px solid #2f4553',
                            background: '#0f212e'
                        }}>
                            <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem' }}>Create Account</h2>
                            <p style={{ margin: '8px 0 0', color: '#b1bad3' }}>Start playing with real money</p>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', padding: '4px', background: '#0f212e', margin: '16px 24px', borderRadius: '8px' }}>
                            <button
                                onClick={() => setActiveTab('phone')}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: activeTab === 'phone' ? '#2f4553' : 'transparent',
                                    color: activeTab === 'phone' ? 'white' : '#b1bad3',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <FaPhone size={14} /> Phone
                            </button>
                            <button
                                onClick={() => setActiveTab('email')}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: activeTab === 'email' ? '#2f4553' : 'transparent',
                                    color: activeTab === 'email' ? 'white' : '#b1bad3',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <FaEnvelope size={14} /> Email
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#b1bad3', marginBottom: '8px', fontSize: '0.9rem' }}>
                                    {activeTab === 'phone' ? 'Phone Number' : 'Email Address'}
                                </label>
                                <div className="input-group" style={{
                                    background: '#0f212e',
                                    border: '1px solid #2f4553',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 12px'
                                }}>
                                    {activeTab === 'phone' && (
                                        <span style={{ color: '#b1bad3', marginRight: '8px', borderRight: '1px solid #2f4553', paddingRight: '8px' }}>+91</span>
                                    )}
                                    <input
                                        type={activeTab === 'phone' ? 'tel' : 'email'}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder={activeTab === 'phone' ? '98765 43210' : 'name@example.com'}
                                        style={{
                                            width: '100%',
                                            padding: '12px 0',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '1rem',
                                            outline: 'none'
                                        }}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !inputValue}
                                className="btn-primary"
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    fontSize: '1rem',
                                    background: '#00e701',
                                    color: '#011e01',
                                    opacity: (isLoading || !inputValue) ? 0.7 : 1,
                                    cursor: (isLoading || !inputValue) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isLoading ? 'Processing...' : 'Continue'}
                            </button>

                            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.85rem', color: '#b1bad3' }}>
                                <FaLock size={10} style={{ marginRight: '4px' }} />
                                Your info is processed securely
                            </div>
                        </form>

                        <button
                            onClick={onClose}
                            style={{
                                position: 'absolute', top: '16px', right: '16px',
                                background: 'transparent', border: 'none', color: '#b1bad3',
                                cursor: 'pointer', fontSize: '1.2rem'
                            }}
                        >
                            ✕
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
