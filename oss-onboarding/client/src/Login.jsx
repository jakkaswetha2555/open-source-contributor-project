import React, { useState } from 'react';
import { api, setCsrfToken } from './api.js';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api('/auth/login', { method: 'POST', body: { email, password } });
      setCsrfToken(data.csrfToken);

      if (onLoginSuccess) onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Contributor Login</h2>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>
      <GoogleButton />
    </div>
  );
}

// Full-page navigation to the server (not a fetch call) — Google needs a real browser
// redirect to show its consent screen. Same button is used on the Signup page.
export function GoogleButton() {
  return (
    <a className="google-btn" href="/api/auth/google">
      Continue with Google
    </a>
  );
}
