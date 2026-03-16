import React from 'react';
import { CheckCircle2, Lock } from 'lucide-react';

/**
 * SelectionGrid - uses Supabase profile objects directly.
 * 
 * selections = array of profile objects with choice_id set (from Supabase)
 * user = current logged-in profile {id, full_name, score, rank, choice_id}
 * specialties = array of {id, name, total_seats}
 * onSelect(deptId | null) = called when user picks or releases a seat
 */
const SelectionGrid = ({ user, specialties, selections, onSelect }) => {

  const getDeptStatus = (dept) => {
    // All profiles that chose this department
    const deptSelections = selections.filter(s => s.choice_id === dept.id);

    // Higher-score candidates already in this dept (they block seats for me)
    const takenByHigher = deptSelections.filter(s => s.score > user.score).length;

    // Seats available relative to my score
    const availableForMe = dept.total_seats - takenByHigher;
    const isLockedForMe = availableForMe <= 0;

    // Did I take a seat here?
    const amIOccupant = deptSelections.some(s => s.id === user.id);

    return {
      availableForMe,
      isLockedForMe,
      amIOccupant,
      occupants: deptSelections.sort((a, b) => b.score - a.score),
    };
  };

  return (
    <div className="selection-grid-container">
      <div className="grid-header">
        <div className="user-context card">
          <span className="label">Your Profile</span>
          <span className="value">{user.full_name}</span>
          <span className="badge">Rank #{user.rank}</span>
          <span className="badge teal">Score: {user.score}</span>
          {user.choice_id && (
            <span className="badge green">✓ Seat chosen</span>
          )}
        </div>
      </div>

      <div className="departments-grid">
        {specialties.map(dept => {
          const status = getDeptStatus(dept);

          return (
            <div
              key={dept.id}
              className={`dept-card ${status.amIOccupant ? 'selected' : ''} ${status.isLockedForMe ? 'locked' : ''}`}
            >
              <div className="dept-info">
                <h4>{dept.name}</h4>
                <div className="seat-count">
                  <span className="total">{dept.total_seats} Total Seats</span>
                  <span className={`available ${status.availableForMe > 0 ? 'text-teal' : 'text-red'}`}>
                    {status.availableForMe > 0 ? `${status.availableForMe} Available` : 'Full for you'}
                  </span>
                </div>
              </div>

              <div className="occupants-list">
                {status.occupants.length === 0
                  ? <p className="empty">No candidates yet</p>
                  : status.occupants.map(occ => (
                    <div
                      key={occ.id}
                      className={`occupant-tag ${occ.score > user.score ? 'superior' : 'inferior'} ${occ.id === user.id ? 'self' : ''}`}
                    >
                      <span className="rank">#{occ.rank}</span>
                      <span className="name">{occ.full_name}</span>
                      {occ.id === user.id && <CheckCircle2 size={12} />}
                    </div>
                  ))
                }
              </div>

              <div className="dept-actions">
                {status.amIOccupant ? (
                  <button className="btn-release" onClick={() => onSelect(null)}>
                    Release Seat
                  </button>
                ) : status.isLockedForMe ? (
                  <button className="btn-locked" disabled>
                    <Lock size={14} /> Reserved by Higher Rank
                  </button>
                ) : (
                  <button className="btn-select" onClick={() => onSelect(dept.id)}>
                    {status.occupants.length >= dept.total_seats
                      ? '⚡ Take (Evict Lower Rank)'
                      : 'Choose Specialty'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .selection-grid-container { display: flex; flex-direction: column; gap: 2rem; }
        .user-context {
          background: white;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          border-left: 4px solid var(--teal-primary);
          box-shadow: var(--shadow-sm);
          flex-wrap: wrap;
        }
        .user-context .label { color: var(--text-muted); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; }
        .user-context .value { font-weight: 800; font-size: 1.1rem; }
        .badge { background: var(--medical-bg); padding: 0.2rem 0.6rem; border-radius: 100px; font-size: 0.8rem; font-weight: 700; }
        .badge.teal { background: rgba(13,148,136,0.1); color: var(--teal-dark); }
        .badge.green { background: rgba(22,163,74,0.1); color: #16a34a; }
        .departments-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .dept-card {
          background: white;
          border-radius: 20px;
          padding: 1.5rem;
          border: 1px solid var(--sterile-gray);
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
        }
        .dept-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -10px rgba(0,0,0,0.1); }
        .dept-card.selected { border-color: var(--teal-primary); background: rgba(13,148,136,0.02); }
        .dept-card.locked { opacity: 0.75; background: #f8fafc; }
        .dept-info h4 { font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--text-main); }
        .seat-count { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; }
        .occupants-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          min-height: 40px;
          padding: 0.8rem;
          background: var(--medical-bg);
          border-radius: 12px;
        }
        .occupant-tag {
          padding: 0.2rem 0.6rem;
          border-radius: 6px;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-weight: 600;
        }
        .occupant-tag.superior { background: #cbd5e1; color: #475569; }
        .occupant-tag.inferior { background: white; color: var(--teal-dark); border: 1px solid var(--teal-light); }
        .occupant-tag.self { background: var(--teal-primary); color: white; border: none; }
        .occupants-list .empty { font-size: 0.8rem; color: var(--text-muted); font-style: italic; }
        .dept-actions button {
          width: 100%;
          padding: 0.8rem;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          font-size: 0.9rem;
        }
        .btn-select { background: var(--teal-primary); color: white; }
        .btn-select:hover { background: var(--teal-dark); }
        .btn-locked { background: var(--sterile-gray); color: var(--text-muted); cursor: not-allowed; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .btn-release { background: var(--accent-red); color: white; }
        .text-teal { color: var(--teal-primary); }
        .text-red { color: var(--accent-red); }
      `}</style>
    </div>
  );
};

export default SelectionGrid;
