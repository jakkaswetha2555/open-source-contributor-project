import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, setCsrfToken } from './api.js';
import Login from './Login.jsx';
import ProjectDiscovery from './ProjectDiscovery.jsx';
import IssueBrowser from './IssueBrowser.jsx';
import DocsReader from './DocsReader.jsx';
import StarterPlan from './StarterPlan.jsx';
import ReviewInbox from './ReviewInbox.jsx';
import { Signup, ForgotPassword, ResetPassword, VerifyEmail } from './AuthPages.jsx';

function ProjectPage({ user }) {
  const { id } = useParams();
  const [tab, setTab] = useState('issues');
  return (
    <div className="page">
      <div className="tabs">
        <button className={tab === 'issues' ? 'active' : ''} onClick={() => setTab('issues')}>Issues</button>
        <button className={tab === 'docs' ? 'active' : ''} onClick={() => setTab('docs')} disabled={!user}>
          Documentation Q&amp;A {!user && '(log in)'}
        </button>
      </div>
      {tab === 'issues' ? <IssueBrowser projectId={id} /> : <DocsReader projectId={id} />}
    </div>
  );
}

function Home({ user }) {
  const navigate = useNavigate();
  return <ProjectDiscovery onSelectProject={(id) => navigate(`/projects/${id}`)} user={user} />;
}

function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  return (
    <div>
      <Login onLoginSuccess={(u) => { onLogin(u); navigate('/'); }} />
      <p className="center"><Link to="/forgot-password">Forgot password?</Link> · <Link to="/signup">Create account</Link></p>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api('/me').then((d) => setUser(d.user)).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);

  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* cookie is cleared server-side either way */ }
    setCsrfToken(null);
    setUser(null);
  };

  if (!ready) return <div className="page">Loading...</div>;

  return (
    <BrowserRouter>
      <nav className="nav">
        <strong>OSS Onboarding</strong>
        <Link to="/">Projects</Link>
        {user && <Link to="/starter">Starter plan</Link>}
        {user?.role === 'maintainer' && <Link to="/review">Review inbox</Link>}
        <span className="spacer" />
        {user ? (
          <>
            <span>{user.name} ({user.role})</span>
            <button onClick={logout}>Log out</button>
          </>
        ) : (
          <Link to="/login">Log in</Link>
        )}
      </nav>
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/projects/:id" element={<ProjectPage user={user} />} />
        <Route path="/login" element={<LoginPage onLogin={setUser} />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/starter" element={user ? <StarterPlan /> : <Navigate to="/login" replace />} />
        <Route
          path="/review"
          element={user?.role === 'maintainer' ? <ReviewInbox /> : <Navigate to={user ? '/' : '/login'} replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
