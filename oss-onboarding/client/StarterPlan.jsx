import React, { useState, useEffect } from 'react';

export default function StarterPlan({ onSelectPlan }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch starter plans from backend endpoint
    fetch('/api/starter-plans')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load starter plans');
        return res.json();
      })
      .then((data) => {
        setPlans(data.plans || data);
        setLoading(false);
      })
      .catch((err) => {
        // Fallback default starter plans
        setPlans([
          {
            id: 'beginner-react',
            title: 'React & Frontend Fundamentals Track',
            level: 'Beginner',
            duration: '2 Days',
            description: 'Guided onboarding track for building React UI components, managing state, and integrating APIs.'
          },
          {
            id: 'intermediate-node',
            title: 'Node.js & Express API Engine Track',
            level: 'Intermediate',
            duration: '3 Days',
            description: 'Learn middleware architecture, database queries, and RESTful service routing.'
          }
        ]);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="container"><p>Loading starter plans...</p></div>;

  return (
    <div className="container">
      <div className="card">
        <h2>🚀 Onboarding Starter-Plan Screen</h2>
        <p>Select an onboarding starter track to kickstart your open-source contributions.</p>
      </div>

      <div className="grid">
        {plans.map((plan) => (
          <div key={plan.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-open">{plan.level}</span>
              <small>⏱️ {plan.duration}</small>
            </div>
            <h3 style={{ marginTop: '0.75rem' }}>{plan.title}</h3>
            <p>{plan.description}</p>

            <button 
              className="btn" 
              onClick={() => onSelectPlan && onSelectPlan(plan.id)}
            >
              Start This Plan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}