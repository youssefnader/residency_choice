import React, { useState } from 'react';
import { Stethoscope, Search, LogIn } from 'lucide-react';

const DoctorLogin = ({ candidates, onLogin }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = candidates.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    String(c.rank).includes(search)
  );

  return (
    <div className="login-overlay">
      <div className="login-card animate-fade-in">
        <div className="login-header">
          <Stethoscope className="icon-pulse" size={40} />
          <h2>AuraMedical</h2>
          <p>Select your name to enter the live session</p>
        </div>

        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name or rank..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null); }}
            autoFocus
          />
        </div>

        <div className="candidate-list">
          {filtered.length === 0 && (
            <p className="empty-hint">No candidates found. Ask the admin to initialize the session first.</p>
          )}
          {filtered.map(c => (
            <div
              key={c.id}
              className={`candidate-row ${selected?.id === c.id ? 'selected' : ''}`}
              onClick={() => setSelected(c)}
            >
              <span className="rank-badge">#{c.rank}</span>
              <span className="cand-name">{c.full_name}</span>
              <span className="score-chip">{c.score}</span>
            </div>
          ))}
        </div>

        <button
          className="btn-primary login-btn"
          disabled={!selected}
          onClick={() => selected && onLogin(selected)}
        >
          <LogIn size={18} />
          {selected ? `Enter as ${selected.full_name}` : 'Select your name above'}
        </button>
      </div>

      <style>{`
        .login-overlay {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--medical-bg);
          padding: 1rem;
        }
        .login-card {
          background: white;
          border-radius: 24px;
          padding: 2.5rem;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 24px 48px -12px rgba(0,0,0,0.12);
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .login-header {
          text-align: center;
        }
        .login-header svg {
          color: var(--teal-primary);
          margin-bottom: 0.5rem;
        }
        .login-header h2 {
          font-size: 2rem;
          margin: 0;
        }
        .login-header p {
          color: var(--text-muted);
          margin: 0.25rem 0 0;
          font-size: 0.95rem;
        }
        .search-bar {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          border: 1.5px solid var(--sterile-gray);
          border-radius: 12px;
          padding: 0.6rem 1rem;
          transition: border-color 0.2s;
        }
        .search-bar:focus-within {
          border-color: var(--teal-primary);
        }
        .search-icon { color: var(--text-muted); flex-shrink: 0; }
        .search-bar input {
          border: none;
          outline: none;
          font-size: 1rem;
          width: 100%;
          font-family: var(--font-body);
        }
        .candidate-list {
          max-height: 300px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          border: 1px solid var(--sterile-gray);
          border-radius: 12px;
          padding: 0.5rem;
        }
        .candidate-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.7rem 0.8rem;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .candidate-row:hover { background: var(--medical-bg); }
        .candidate-row.selected {
          background: rgba(13, 148, 136, 0.1);
          outline: 2px solid var(--teal-primary);
        }
        .rank-badge {
          font-weight: 800;
          color: var(--teal-dark);
          font-size: 0.9rem;
          min-width: 2.5rem;
        }
        .cand-name { flex: 1; font-weight: 600; }
        .score-chip {
          background: var(--medical-bg);
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-muted);
        }
        .empty-hint {
          text-align: center;
          color: var(--text-muted);
          padding: 1.5rem;
          font-style: italic;
          font-size: 0.9rem;
        }
        .login-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .login-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default DoctorLogin;
