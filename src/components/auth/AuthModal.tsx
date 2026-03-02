import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaLock, FaUser } from 'react-icons/fa';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (payload: { mode: 'login' | 'register'; username: string; password: string }) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [activeTab, setActiveTab] = useState<'login' | 'register'>('register');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) return;
        if (activeTab === 'register' && password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setError('');
        setIsLoading(true);
        try {
            await onSuccess({ mode: activeTab, username, password });
            setUsername('');
            setPassword('');
            setConfirmPassword('');
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.error || err?.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
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
                            <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem' }}>
                                {activeTab === 'register' ? 'Create Account' : 'Welcome Back'}
                            </h2>
                            <p style={{ margin: '8px 0 0', color: '#b1bad3' }}>Sign in to play with real balance</p>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', padding: '4px', background: '#0f212e', margin: '16px 24px', borderRadius: '8px' }}>
                            <button
                                onClick={() => setActiveTab('register')}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: activeTab === 'register' ? '#2f4553' : 'transparent',
                                    color: activeTab === 'register' ? 'white' : '#b1bad3',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Register
                            </button>
                            <button
                                onClick={() => setActiveTab('login')}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: activeTab === 'login' ? '#2f4553' : 'transparent',
                                    color: activeTab === 'login' ? 'white' : '#b1bad3',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Login
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#b1bad3', marginBottom: '8px', fontSize: '0.9rem' }}>Username</label>
                                <div className="input-group" style={{
                                    background: '#0f212e',
                                    border: '1px solid #2f4553',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 12px',
                                    gap: '10px',
                                }}>
                                    <FaUser size={13} color="#8ea1b2" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter username"
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

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', color: '#b1bad3', marginBottom: '8px', fontSize: '0.9rem' }}>Password</label>
                                <div className="input-group" style={{
                                    background: '#0f212e',
                                    border: '1px solid #2f4553',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 12px',
                                    gap: '10px',
                                }}>
                                    <FaLock size={13} color="#8ea1b2" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                        style={{
                                            width: '100%',
                                            padding: '12px 0',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'white',
                                            fontSize: '1rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {activeTab === 'register' && (
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', color: '#b1bad3', marginBottom: '8px', fontSize: '0.9rem' }}>Confirm Password</label>
                                    <div className="input-group" style={{
                                        background: '#0f212e',
                                        border: '1px solid #2f4553',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0 12px',
                                        gap: '10px',
                                    }}>
                                        <FaLock size={13} color="#8ea1b2" />
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Confirm password"
                                            style={{
                                                width: '100%',
                                                padding: '12px 0',
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'white',
                                                fontSize: '1rem',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div style={{
                                    marginBottom: '16px',
                                    background: 'rgba(234,62,62,0.12)',
                                    border: '1px solid rgba(234,62,62,0.4)',
                                    borderRadius: '8px',
                                    color: '#ff8686',
                                    padding: '10px 12px',
                                    fontSize: '0.85rem'
                                }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || !username || !password}
                                className="btn-primary"
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    fontSize: '1rem',
                                    background: '#00e701',
                                    color: '#011e01',
                                    opacity: (isLoading || !username || !password) ? 0.7 : 1,
                                    cursor: (isLoading || !username || !password) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isLoading ? 'Processing...' : (activeTab === 'register' ? 'Create Account' : 'Sign In')}
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
