import React, { useState } from 'react';

export default function DocsReader({ projectId = "default-project-id" }) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Calls the backend RAG endpoint: POST /api/contributor-chat[cite: 2]
      const res = await fetch('/api/contributor-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include CSRF header if required by your team's security layout
        },
        body: JSON.stringify({ projectId, question }),
      });

      if (!res.ok) throw new Error("Failed to get an answer from documentation.");

      const data = await res.json();
      setResponse(data); // Expected format: { answer, citations: [{filePath}], snapshotVersion }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px' }}>
      <h2>Documentation Reader & Assistant</h2>
      <p style={{ color: '#666' }}>Ask setup or architecture questions and view cited file references from the snapshot.</p>

      <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Ask a question about project documentation..." 
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{ flex: 1, padding: '10px', fontSize: '16px' }}
        />
        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          {loading ? 'Searching...' : 'Ask Docs'}
        </button>
      </form>

      {error && <div style={{ color: 'red', marginBottom: '15px' }}>Error: {error}</div>}

      {/* Answer and Citations Display Box */}
      {response && (
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '5px', background: '#fff' }}>
          <h3>Answer:</h3>
          <p style={{ lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{response.answer || response.text}</p>
          
          {response.snapshotVersion && (
            <div style={{ fontSize: '12px', color: '#886', marginBottom: '10px' }}>
              <strong>Source:</strong> Based on snapshot v{response.snapshotVersion}[cite: 2]
            </div>
          )}

          {response.citations && response.citations.length > 0 && (
            <div style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
              <strong>File Citations:</strong>
              <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                {response.citations.map((cite, index) => (
                  <li key={index} style={{ fontSize: '14px', color: '#0056b3', fontFamily: 'monospace' }}>
                    {cite.filePath || cite}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}