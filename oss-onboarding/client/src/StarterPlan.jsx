import React, { useEffect, useState } from 'react';
import { api } from './api.js';

const splitList = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

export default function StarterPlan() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [matches, setMatches] = useState(null);
  const [agent, setAgent] = useState(null);
  const [approach, setApproach] = useState('');
  const [myPlans, setMyPlans] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const loadPlans = () => api('/my-plans').then((d) => setMyPlans(d.plans || [])).catch(() => {});

  useEffect(() => {
    api('/projects').then((d) => {
      const list = d.projects || [];
      setProjects(list);
      if (list[0]) setProjectId(list[0]._id || list[0].id);
    }).catch((e) => setError(e.message));
    api('/me').then((d) => setSkillsText((d.user?.skills || []).join(', '))).catch(() => {});
    loadPlans();
  }, []);

  const guard = (name, fn) => async () => {
    setBusy(name); setError(null); setNotice(null);
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const findMatches = guard('match', async () => {
    const skills = splitList(skillsText);
    if (skills.length) await api('/me/profile', { method: 'PATCH', body: { skills } });
    const d = await api('/issue-matches', { method: 'POST', body: { projectId: projectId || undefined, skills: skills.length ? skills : undefined } });
    setMatches(d);
  });

  const runAgent = guard('agent', async () => {
    const skills = splitList(skillsText);
    setAgent(await api('/onboarding-agent', { method: 'POST', body: { projectId, goal: 'Find a task I can start this weekend', skills: skills.length ? skills : undefined } }));
  });

  const rec = agent?.recommendation;
  const canPlan = rec && rec.issueId && rec.found !== false;

  const submitPlan = guard('plan', async () => {
    const evidence = (rec.evidence || []).map((e) => ({ filePath: e.filePath, snapshotVersion: e.snapshotVersion }));
    await api('/contribution-plans', { method: 'POST', body: { issueId: rec.issueId, approach, steps: rec.setupSteps || [], evidence } });
    setApproach('');
    setNotice('Plan submitted for maintainer review.');
    await loadPlans();
  });

  return (
    <div className="page">
      <h2>Starter plan</h2>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      <section className="card">
        <h3>1. Tell us what you know</h3>
        <label>Project</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
        </select>
        <label>Your skills (comma separated)</label>
        <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="javascript, express, mongodb" />
        <div className="row">
          <button onClick={findMatches} disabled={!!busy}>{busy === 'match' ? 'Matching...' : 'Match me with issues'}</button>
          <button onClick={runAgent} disabled={!!busy || !projectId}>{busy === 'agent' ? 'Running agent...' : 'Find a task I can start this weekend'}</button>
        </div>
      </section>

      {matches && (
        <section className="card">
          <h3>Suggested issues <small>({matches.method} matching)</small></h3>
          {matches.matches.length === 0 && <p>{matches.message || 'No open issues matched.'}</p>}
          {matches.matches.map((m) => (
            <div key={m.issueId} className="sub-card">
              <strong>{m.title}</strong>
              <ul>{m.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          ))}
        </section>
      )}

      {agent && (
        <section className="card">
          <h3>Agent recommendation</h3>
          {rec?.found === false ? <p>{rec.message}</p> : (
            <>
              <p><strong>{rec?.title}</strong> {rec?.project?.name && <>in {rec.project.name}</>}</p>
              {rec?.revisedFrom && <p className="muted">An earlier candidate was already taken, so the agent moved on to this one.</p>}
              <ul>{(rec?.reasons || []).map((r, i) => <li key={i}>{r}</li>)}</ul>
              <h4>Finish these setup steps first</h4>
              <ol>{(rec?.setupSteps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
              {(rec?.warnings || []).length > 0 && <div className="warn">{rec.warnings.join(' ')}</div>}
            </>
          )}
          <h4>Evidence</h4>
          <ul>{(rec?.evidence || []).map((e, i) => <li key={i}><code>{e.filePath}</code> (snapshot {e.snapshotVersion})</li>)}</ul>
          <h4>Tool calls</h4>
          <ul>{(agent.toolCalls || []).map((t, i) => <li key={i}><code>{t.name}</code>: {t.status}</li>)}</ul>
          <p className="muted">The agent only reads data. A maintainer confirms the assignment.</p>

          {canPlan && (
            <>
              <h4>Your approach</h4>
              <textarea rows={5} value={approach} onChange={(e) => setApproach(e.target.value)} placeholder="Describe how you will tackle this issue (at least 20 characters)" />
              <button onClick={submitPlan} disabled={!!busy || approach.trim().length < 20}>{busy === 'plan' ? 'Submitting...' : 'Submit plan for review'}</button>
            </>
          )}
        </section>
      )}

      <section className="card">
        <h3>My plans</h3>
        {myPlans.length === 0 ? <p>No plans yet.</p> : (
          <ul>{myPlans.map((p) => <li key={p._id}><strong>{p.issueId?.title || 'Issue'}</strong>: {p.status}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
