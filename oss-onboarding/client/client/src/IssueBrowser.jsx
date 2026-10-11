import React, { useState, useEffect } from 'react';

export default function IssueBrowser({ projectId = "default-project-id" }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [skillFilter, setSkillFilter] = useState('');

  useEffect(() => {
    // Fetch issues from backend API endpoint: GET /api/projects/:id/issues
    fetch(`/api/projects/${projectId}/issues`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch issues from server");
        return res.json();
      })
      .then((data) => {
        setIssues(data.issues || data); // supports array or wrapped object
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [projectId]);

  // Filter logic based on status and required skills
  const filteredIssues = issues.filter((issue) => {
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    const matchesSkill = !skillFilter || issue.requiredSkills?.some(skill => 
      skill.toLowerCase().includes(skillFilter.toLowerCase())
    );
    return matchesStatus && matchesSkill;
  });

  if (loading) return <div style={{ padding: '20px' }}>Loading issues...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Issue Browser</h2>
      
      {/* Filter controls container */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div>
          <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Filter Status:</label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '5px' }}
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div>
          <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Filter by Skill:</label>
          <input 
            type="text" 
            placeholder="e.g., React, Node" 
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            style={{ padding: '5px' }}
          />
        </div>
      </div>

      {/* Issues List display */}
      {filteredIssues.length === 0 ? (
        <p>No issues found matching your filters.</p>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {filteredIssues.map((issue) => (
            <div key={issue._id || issue.id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px', background: '#f9f9f9' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>{issue.title}</h3>
              <p style={{ margin: '0 0 10px 0', color: '#555' }}>{issue.summary}</p>
              <div style={{ fontSize: '14px' }}>
                <strong>Status: </strong> 
                <span style={{ 
                  color: issue.status === 'open' ? 'green' : issue.status === 'assigned' ? 'orange' : 'gray',
                  fontWeight: 'bold'
                }}>
                  {issue.status}
                </span>
              </div>
              {issue.requiredSkills && (
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <strong>Required Skills: </strong> {issue.requiredSkills.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}