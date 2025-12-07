import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import '../styles/Auth.css'; // We will create this

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { login, register, isLoggingIn, isRegistering, loginError, registerError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login({ email, password });
      } else {
        await register({ email, password, displayName });
      }
    } catch (err) {
      // Error is handled by the hook state
      console.error(err);
    }
  };

  const error = isLogin ? loginError : registerError;
  const isLoading = isLogin ? isLoggingIn : isRegistering;

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2 className="auth-header">{isLogin ? 'Login' : 'Register'}</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label>Display Name:</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          
          {error && <div className="error-message">{(error as any)?.response?.data?.error || 'An error occurred'}</div>}
          
          <button type="submit" disabled={isLoading} className="submit-btn">
            {isLoading ? 'Please wait...' : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>
        
        <div className="auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="link-btn">
            {isLogin ? 'Register' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
};
