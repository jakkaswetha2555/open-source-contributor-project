import React, { useState, useEffect } from 'react';

export default function ProjectDiscovery({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch projects');
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

  if (loading) return <div className="loading">Loading public projects...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="project-discovery">
      <h2>Project Discovery</h2>
      <p>Select an open-source project to browse issues and documentation.</p>
      <div className="project-grid">
        {projects.map((project) => (
          <div key={project._id || project.id} className="project-card">
            <h3>{project.name}</h3>
            <p>{project.description}</p>
            <button onClick={() => onSelectProject && onSelectProject(project._id || project.id)}>
              View Issues & Docs
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}