import React, { useEffect, useState } from 'react';
import { api } from './api.js';

export default function ReviewInbox() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState({});

  const load = () => api('/review-inbox?status=submitted').then((d) => setPlans(d.plans || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { decision: 'approved', feedback: '', ...d[id], ...patch } }));

  const submit = async (id) => {
    const { decision, feedback } = { decision: 'approved', feedback: '', ...drafts[id] };
    setError(null);
    try {
      await api(`/contribution-plans/${id}/review`, { method: 'POST', body: { decision, feedback } });
      setPlans((list) => list.filter((p) => p._id !== id));
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <div className="page">Loading review inbox...</div>;
  return (
    <div className="page">
      <h2>Maintainer review inbox</h2>
      {error && <div className="error-banner">{error}</div>}
      {plans.length === 0 && <p>No plans waiting for review.</p>}
      {plans.map((p) => {
        const d = { decision: 'approved', feedback: '', ...drafts[p._id] };
        return (
          <section key={p._id} className="card">
            <h3>{p.issueId?.title} <small>({p.projectId?.name})</small></h3>
            <p className="muted">From {p.authorId?.name}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{p.approach}</p>
            {p.steps?.length > 0 && <ol>{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
            <h4>Evidence</h4>
            <ul>{(p.evidence || []).map((e, i) => <li key={i}><code>{e.filePath}</code> (snapshot {e.snapshotVersion})</li>)}</ul>
            <div className="row">
              <select value={d.decision} onChange={(e) => setDraft(p._id, { decision: e.target.value })}>
                <option value="approved">Approve</option>
                <option value="changes_requested">Request changes</option>
              </select>
              <input placeholder="Feedback (required when requesting changes)" value={d.feedback} onChange={(e) => setDraft(p._id, { feedback: e.target.value })} />
              <button onClick={() => submit(p._id)}>Submit review</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
