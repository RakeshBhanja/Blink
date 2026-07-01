import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/logo.png';
import { MessageSquare, Lock, Mail, User, Clock, ShieldAlert, LogOut, RefreshCw, Eye, EyeOff } from 'lucide-react';

export const AuthForm = () => {
  const { user, login, register, logout, refreshUser } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Log in with username or email
        await login(username || email, password);
      } else {
        // Register new user
        await register(username, email, password);
        // Switch to login and pre-fill email
        setIsLogin(true);
        setError('Registration successful! Please login.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    setCheckingStatus(true);
    try {
      const refreshed = await refreshUser();
      if (refreshed && refreshed.status === 'APPROVED') {
        setError('');
      } else if (refreshed && refreshed.status === 'PENDING') {
        setError('Your account is still pending approval.');
      }
    } catch (err) {
      console.error('Error refreshing status:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // If user is authenticated but pending approval, show pending screen
  if (user && user.role !== 'ADMIN' && user.status === 'PENDING') {
    return (
      <div className="auth-container">
        <div className="auth-bg-blob"></div>
        <div className="glass-panel pending-container">
          <Clock className="pending-icon" size={64} />
          <h2 className="pending-title">Awaiting Approval</h2>
          <p className="pending-desc">
            Hi <strong>{user.username}</strong>, welcome to <strong>Blink</strong>! <br />
            To maintain a secure space, your account requires administrator authorization.
            Please check back soon.
          </p>
          {error && <p style={{ color: '#f59e0b', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', width: '100%' }}>
            <button 
              className="btn-primary" 
              onClick={handleRefreshStatus}
              disabled={checkingStatus}
              style={{ padding: '10px 20px', fontSize: '14px' }}
            >
              <RefreshCw className={checkingStatus ? 'animate-spin' : ''} size={16} />
              {checkingStatus ? 'Checking...' : 'Check Status'}
            </button>
            <button 
              className="btn-secondary" 
              onClick={logout}
              style={{ padding: '10px 20px', fontSize: '14px' }}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user is rejected
  if (user && user.status === 'REJECTED') {
    return (
      <div className="auth-container">
        <div className="auth-bg-blob"></div>
        <div className="glass-panel pending-container">
          <ShieldAlert className="pending-icon" style={{ color: '#ef4444' }} size={64} />
          <h2 className="pending-title" style={{ color: '#ef4444' }}>Access Denied</h2>
          <p className="pending-desc">
            Your request to join <strong>Blink</strong> has been rejected by an administrator.
            If you believe this is a mistake, please contact your network administrator.
          </p>
          <button className="btn-primary" onClick={logout}>
            <LogOut size={16} />
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-bg-blob"></div>
      <div className="glass-panel auth-card">
        <div className="auth-header">
          <img src={logoImg} className="auth-logo" alt="Blink Logo" />
          <h1 className="auth-title">Blink</h1>
          <p className="auth-subtitle">
            {isLogin ? 'Instant real-time messaging' : 'Create an account to join Blink'}
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="auth-form-group">
              <label className="auth-label">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '48px' }}
                  placeholder="Choose username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="auth-form-group">
            <label className="auth-label">{isLogin ? 'Username or Email' : 'Email Address'}</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
              <input
                type={isLogin ? "text" : "email"}
                className="input-field"
                style={{ paddingLeft: '48px' }}
                placeholder={isLogin ? "Enter username or email" : "Enter email address"}
                value={isLogin ? username : email}
                onChange={(e) => isLogin ? setUsername(e.target.value) : setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="auth-form-group">
            <label className="auth-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
              <input
                type={showPassword ? "text" : "password"}
                className="input-field"
                style={{ paddingLeft: '48px', paddingRight: '48px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '16px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="auth-toggle">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <span className="auth-toggle-link" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
            {isLogin ? 'Sign up' : 'Sign in'}
          </span>
        </div>
      </div>
    </div>
  );
};
