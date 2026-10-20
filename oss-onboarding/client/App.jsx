import React, { useState } from 'react';
import StarterPlan from './StarterPlan';
import './App.css';

export default function App() {
  const [activeTrack, setActiveTrack] = useState(null);

  return (
    <div className="app-shell">
      <header style={{ background: '#1e293b', color: '#fff', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>OSS Contributor Onboarding Platform</h1>
        {activeTrack && (
          <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>
            Active Track: {activeTrack}
          </span>
        )}
      </header>

      <main>
        <StarterPlan onSelectPlan={(planId) => setActiveTrack(planId)} />
      </main>
    </div>
  );
}