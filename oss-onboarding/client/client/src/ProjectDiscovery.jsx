import React, { useState, useEffect } from 'react';

export default function ProjectDiscovery({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetches approved public projects from backend API: GET /api/projects[cite: 2]
    fetch('/api/projects')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load public projects');
        return res.json();
      })
      .then((data) => {
        setProjects(data.projects || data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: '20px' }}>Loading projects...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Project Discovery</h2>
      <p style={{ color: '#666' }}>Browse verified public open-source projects ready for contribution.</p>

      {projects.length === 0 ? (
        <p>No verified public projects available.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
          {projects.map((project) => (
            <div 
              key={project._id || project.id} 
              style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '6px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            >
              <h3 style={{ margin: '0 0 10px 0', color: '#007bff' }}>{project.name}</h3>
              <p style={{ margin: '0 0 15px 0', color: '#444', fontSize: '14px' }}>{project.description}</p>
              
              <button 
                onClick={() => onSelectProject && onSelectProject(project._id || project.id)}
                style={{ padding: '8px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                View Issues & Docs
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}