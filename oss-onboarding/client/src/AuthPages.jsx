import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from './api.js';
import { GoogleButton } from './Login.jsx';

function useAction() {
  const [state, setState] = useState({ loading: false, error: null, message: null });
  const run = async (fn) => {
    setState({ loading: true, error: null, message: null });
    try {
      const message = await fn();
      setState({ loading: false, error: null, message });
    } catch (err) {
      setState({ loading: false, error: err.message, message: null });
    }
  };
  return [state, run];
}

const Feedback = ({ state }) => (
  <>
    {state.error && <div className="error-banner">{state.error}</div>}
    {state.message && <div className="success-banner">{state.message}</div>}
  </>
);

export function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [state, run] = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="login-container">
      <h2>Create account</h2>
      <Feedback state={state} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => (await api('/auth/signup', { method: 'POST', body: form })).message);
        }}
      >
        <div className="form-group"><label>Name</label><input value={form.name} onChange={set('name')} required /></div>
        <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={set('email')} required /></div>
        <div className="form-group">
          <label>Password (10+ characters)</label>
          <input type="password" minLength={10} value={form.password} onChange={set('password')} required />
        </div>
        <button type="submit" disabled={state.loading}>{state.loading ? 'Creating...' : 'Sign up'}</button>
      </form>
      <GoogleButton />
      <p>Already registered? <Link to="/login">Log in</Link></p>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [state, run] = useAction();
  return (
    <div className="login-container">
      <h2>Forgot password</h2>
      <Feedback state={state} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => (await api('/auth/forgot-password', { method: 'POST', body: { email } })).message);
        }}
      >
        <div className="form-group"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <button type="submit" disabled={state.loading}>Send reset link</button>
      </form>
      <p><Link to="/login">Back to login</Link></p>
    </div>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [state, run] = useAction();
  return (
    <div className="login-container">
      <h2>Choose a new password</h2>
      <Feedback state={state} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => (await api('/auth/reset-password', { method: 'POST', body: { token: params.get('token') || '', password } })).message);
        }}
      >
        <div className="form-group"><label>New password (10+ characters)</label><input type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <button type="submit" disabled={state.loading}>Update password</button>
      </form>
      <p><Link to="/login">Back to login</Link></p>
    </div>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, run] = useAction();
  useEffect(() => {
    run(async () => (await api(`/auth/verify-email?token=${encodeURIComponent(params.get('token') || '')}`)).message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="login-container">
      <h2>Email verification</h2>
      {state.loading && <p>Verifying...</p>}
      <Feedback state={state} />
      <p><Link to="/login">Go to login</Link></p>
    </div>
  );
}
