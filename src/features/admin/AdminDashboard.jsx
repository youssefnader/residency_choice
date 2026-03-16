import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, Save, FileSpreadsheet, Stethoscope, CheckCircle, List, PlusCircle, Link, Edit3, Trash, ArrowLeft, Copy, Check } from 'lucide-react';
import { parseCandidatesExcel } from '../../utils/excel';
import { supabase } from '../../lib/supabase';

const AdminDashboard = ({ onSessionCreated }) => {
  // Navigation & View
  const [activeTab, setActiveTab] = useState('manage'); // 'create' | 'manage'
  
  // Create Session State
  const [specialties, setSpecialties] = useState([]);
  const [newSpecialty, setNewSpecialty] = useState({ name: '', total_seats: 1 });
  const [candidates, setCandidates] = useState([]);
  const [sessionName, setSessionName] = useState('');
  
  // Manage Sessions State
  const [rooms, setRooms] = useState([]);
  const [editingRoom, setEditingRoom] = useState(null); 
  const [editingDepts, setEditingDepts] = useState([]); 
  const [newEditSpecialty, setNewEditSpecialty] = useState({ name: '', total_seats: 1 });

  // UI Status
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [copiedType, setCopiedType] = useState(null); 
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (activeTab === 'manage') fetchRooms();
  }, [activeTab]);

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (!error) setRooms(data || []);
  };

  const loadRoomForEditing = async (room) => {
    setEditingRoom(room);
    setCreatedRoomId(room.id);
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('room_id', room.id)
      .order('name', { ascending: true });
    if (!error) setEditingDepts(data || []);
    setSessionReady(true);
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const data = await parseCandidatesExcel(file);
      setCandidates(data);
      setStatusMsg(`✓ ${data.length} candidates loaded`);
    } catch (err) {
      console.error(err);
      setStatusMsg('✗ Excel Error');
    } finally {
      setIsImporting(false);
    }
  };

  const addSpecialty = () => {
    if (!newSpecialty.name.trim()) return;
    setSpecialties([...specialties, { ...newSpecialty, id: Date.now() }]);
    setNewSpecialty({ name: '', total_seats: 1 });
  };

  const handleInitializeSession = async () => {
    if (candidates.length === 0) { setStatusMsg('✗ Import candidates first'); return; }
    if (specialties.length === 0) { setStatusMsg('✗ Add specialties first'); return; }
    setIsSaving(true);
    setStatusMsg('Saving...');
    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({ name: sessionName.trim() || 'Session ' + new Date().toLocaleDateString() })
        .select().single();
      if (roomError) throw roomError;

      const deptPayload = specialties.map(s => ({ room_id: room.id, name: s.name, total_seats: s.total_seats }));
      await supabase.from('departments').insert(deptPayload);

      const profilePayload = candidates.map((c, i) => ({
        room_id: room.id,
        full_name: c.full_name || c.name || `Candidate ${i + 1}`,
        score: parseFloat(c.score) || 0,
        rank: parseInt(c.rank) || (i + 1),
        choice_id: null,
      }));
      await supabase.from('profiles').insert(profilePayload);

      setSessionReady(true);
      setCreatedRoomId(room.id);
      setStatusMsg(`✓ Session Ready!`);
      if (onSessionCreated) onSessionCreated();
    } catch (err) {
      console.error(err);
      setStatusMsg(`✗ Error: ${err.message}`);
    } finally { setIsSaving(false); }
  };

  const handleDeleteRoom = async (id) => {
    if (!confirm('Delete this session permanently?')) return;
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (!error) {
      setRooms(rooms.filter(r => r.id !== id));
      if (editingRoom?.id === id) setEditingRoom(null);
      setStatusMsg('✓ Deleted');
    }
  };

  const updateEditingRoomName = async () => {
    if (!editingRoom) return;
    const { error } = await supabase.from('rooms').update({ name: editingRoom.name }).eq('id', editingRoom.id);
    if (!error) setStatusMsg('✓ Name updated');
  };

  const updateDeptSeats = async (deptId, newSeats) => {
    const { error } = await supabase.from('departments').update({ total_seats: newSeats }).eq('id', deptId);
    if (!error) {
      setEditingDepts(editingDepts.map(d => d.id === deptId ? { ...d, total_seats: newSeats } : d));
      setStatusMsg('✓ Seats updated');
    }
  };

  const addDeptToExistingRoom = async () => {
    if (!newEditSpecialty.name.trim() || !editingRoom) return;
    const { data, error } = await supabase
      .from('departments')
      .insert({ room_id: editingRoom.id, name: newEditSpecialty.name, total_seats: newEditSpecialty.total_seats })
      .select().single();
    if (!error && data) {
      setEditingDepts([...editingDepts, data]);
      setNewEditSpecialty({ name: '', total_seats: 1 });
      setStatusMsg('✓ Added');
    }
  };

  return (
    <div className="admin-wrapper animate-fade-in">
      <div className="admin-nav-pills">
        <button className={activeTab === 'manage' ? 'active' : ''} onClick={() => { setActiveTab('manage'); setEditingRoom(null); setSessionReady(false); }}>
          <List size={18} /> Manage
        </button>
        <button className={activeTab === 'create' ? 'active' : ''} onClick={() => { setActiveTab('create'); setEditingRoom(null); setSessionReady(false); }}>
          <PlusCircle size={18} /> Create
        </button>
      </div>

      {activeTab === 'manage' && !editingRoom && (
        <div className="manage-sessions-list animate-slide-up">
          {rooms.length === 0 ? (
            <div className="empty-state-glass">No sessions yet.</div>
          ) : (
            <div className="modern-grid">
              {rooms.map(room => (
                <div key={room.id} className="modern-card session-card">
                  <div className="card-top">
                    <h4>{room.name}</h4>
                    <span className="date-stamp">{new Date(room.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="card-actions">
                    <button className="btn-glass-teal" onClick={() => loadRoomForEditing(room)}>
                      <Edit3 size={16} /> Manage
                    </button>
                    <button className="btn-glass-danger" onClick={() => handleDeleteRoom(room.id)}>
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'manage' && editingRoom && (
        <div className="editing-workflow animate-slide-up">
          <button className="btn-back" onClick={() => setEditingRoom(null)}>
            <ArrowLeft size={16} /> Back to Sessions
          </button>
          
          <div className="settings-layout">
            <div className="modern-card glow-card">
              <div className="card-header-minimal">
                <Edit3 className="text-teal" size={18} />
                <h3>Session Name</h3>
              </div>
              <div className="input-with-button">
                <input 
                  type="text" 
                  value={editingRoom.name} 
                  onChange={e => setEditingRoom({...editingRoom, name: e.target.value})}
                />
                <button className="btn-icon-square" onClick={updateEditingRoomName}>
                  <Save size={18} />
                </button>
              </div>
            </div>

            <div className="modern-card glow-card">
              <div className="card-header-minimal">
                <Stethoscope className="text-teal" size={18} />
                <h3>Specialty Capacity</h3>
              </div>
              <div className="seats-manager">
                {editingDepts.map(d => (
                  <div key={d.id} className="seat-row-glass">
                    <span className="name">{d.name}</span>
                    <div className="row-controls">
                      <input 
                        type="number" 
                        value={d.total_seats} 
                        onChange={e => updateDeptSeats(d.id, parseInt(e.target.value))}
                      />
                      <button className="btn-ghost-danger" onClick={() => { if(confirm('Remove?')) supabase.from('departments').delete().eq('id', d.id).then(() => setEditingDepts(prev => prev.filter(x => x.id !== d.id))) }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="add-row-minimal">
                  <input type="text" placeholder="Add specialty" value={newEditSpecialty.name} onChange={e => setNewEditSpecialty({...newEditSpecialty, name: e.target.value})} />
                  <input type="number" value={newEditSpecialty.total_seats} onChange={e => setNewEditSpecialty({...newEditSpecialty, total_seats: parseInt(e.target.value)})} />
                  <button className="btn-teal-add" onClick={addDeptToExistingRoom}><Plus size={18} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="create-workflow animate-slide-up">
          <div className="settings-layout">
            <div className="modern-card">
              <div className="card-header-minimal">
                <FileSpreadsheet className="text-teal" size={18} />
                <h3>Import Data</h3>
              </div>
              <div className="form-stack">
                <div className="field-group">
                  <label>Session Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Damascus University 2026"
                    value={sessionName}
                    onChange={e => setSessionName(e.target.value)}
                  />
                </div>
                <label className="upload-zone-modern">
                  <Upload size={32} />
                  <span>{isImporting ? 'Parsing...' : 'Upload Excel'}</span>
                  <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} hidden />
                </label>
                {candidates.length > 0 && <div className="status-pill success">{candidates.length} Doctors Loaded</div>}
              </div>
            </div>

            <div className="modern-card">
              <div className="card-header-minimal">
                <Stethoscope className="text-teal" size={18} />
                <h3>Set Capacities</h3>
              </div>
              <div className="form-stack">
                <div className="add-row-modern">
                  <input type="text" placeholder="Specialty" value={newSpecialty.name} onChange={e => setNewSpecialty({ ...newSpecialty, name: e.target.value })} />
                  <input type="number" min="1" value={newSpecialty.total_seats} onChange={e => setNewSpecialty({ ...newSpecialty, total_seats: parseInt(e.target.value) })} />
                  <button className="btn-teal-add" onClick={addSpecialty}><Plus size={18} /></button>
                </div>
                <div className="tag-cloud">
                  {specialties.map(s => (
                    <div key={s.id} className="tag-pill">
                      <span>{s.name} ({s.total_seats})</span>
                      <button onClick={() => setSpecialties(specialties.filter(x => x.id !== s.id))}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="final-action-bar">
            {!sessionReady && (
              <button className="btn-launch" onClick={handleInitializeSession} disabled={isSaving}>
                <Save size={20} /> {isSaving ? 'Initializing...' : 'Launch Live Session'}
              </button>
            )}
          </div>
        </div>
      )}

      {statusMsg && (
        <div className={`toast-message ${statusMsg.startsWith('✓') ? 'success' : 'error'}`}>
          {statusMsg}
        </div>
      )}

      {sessionReady && createdRoomId && (
        <div className="share-links-container animate-fade-in">
          <div className="share-box-glass">
            <CheckCircle className="text-teal" size={24} />
            <div className="share-content">
              <h3>Live Links Generated</h3>
              <div className="share-grid">
                <div className="share-item">
                  <span>Candidate Link</span>
                  <div className="copy-field">
                    <code>{window.location.origin}{window.location.pathname}?room={createdRoomId}</code>
                    <button className="btn-copy-teal" onClick={() => copyToClipboard(`${window.location.origin}${window.location.pathname}?room=${createdRoomId}`, 'doctor')}>
                      {copiedType === 'doctor' ? <Check size={16}/> : <Copy size={16}/>}
                    </button>
                  </div>
                </div>
                <div className="share-item">
                  <span>Admin Panel</span>
                  <div className="copy-field">
                    <code>{window.location.origin}{window.location.pathname}?admin</code>
                    <button className="btn-copy-dark" onClick={() => copyToClipboard(`${window.location.origin}${window.location.pathname}?admin`, 'admin')}>
                      {copiedType === 'admin' ? <Check size={16}/> : <Copy size={16}/>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-wrapper { max-width: 1100px; margin: 0 auto; width: 100%; }
        .admin-nav-pills { display: flex; gap: 0.5rem; background: rgba(226, 232, 240, 0.5); padding: 0.4rem; border-radius: 100px; width: fit-content; margin: 0 auto 2.5rem; border: 1px solid var(--sterile-gray); }
        .admin-nav-pills button { background: transparent; border: none; padding: 0.6rem 1.5rem; border-radius: 100px; font-weight: 700; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-size: 0.9rem; }
        .admin-nav-pills button.active { background: white; color: var(--teal-primary); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        
        .modern-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
        .modern-card { background: white; border-radius: 20px; padding: 1.5rem; border: 1px solid var(--sterile-gray); box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.3s ease; }
        .modern-card:hover { transform: translateY(-3px); box-shadow: 0 12px 24px -10px rgba(0,0,0,0.1); }
        
        .session-card { display: flex; flex-direction: column; justify-content: space-between; min-height: 160px; }
        .card-top h4 { font-size: 1.25rem; color: var(--text-main); margin-bottom: 0.25rem; }
        .date-stamp { font-size: 0.75rem; color: var(--text-muted); font-weight: 600; }
        .card-actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
        
        .btn-glass-teal { flex: 1; background: rgba(13, 148, 136, 0.08); color: var(--teal-primary); border: 1px solid rgba(13, 148, 136, 0.15); padding: 0.6rem; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: 0.2s; }
        .btn-glass-teal:hover { background: var(--teal-primary); color: white; }
        .btn-glass-danger { background: rgba(239, 68, 68, 0.08); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.15); padding: 0.6rem; border-radius: 12px; cursor: pointer; transition: 0.2s; }
        .btn-glass-danger:hover { background: var(--accent-red); color: white; }
        
        .settings-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 1.5rem; }
        @media (max-width: 800px) { .settings-layout { grid-template-columns: 1fr; } }
        
        .card-header-minimal { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.5rem; }
        .card-header-minimal h3 { font-size: 1rem; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
        
        .input-with-button { display: flex; gap: 0.5rem; }
        .input-with-button input { flex: 1; padding: 0.8rem 1rem; border: 1px solid var(--sterile-gray); border-radius: 12px; font-size: 1rem; outline: none; transition: border 0.2s; }
        .input-with-button input:focus { border-color: var(--teal-primary); }
        .btn-icon-square { background: var(--teal-primary); color: white; border: none; padding: 0.8rem; border-radius: 12px; cursor: pointer; display: flex; align-items: center; }
        
        .seat-row-glass { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 1rem; background: var(--medical-bg); border-radius: 12px; margin-bottom: 0.6rem; border: 1px solid transparent; }
        .seat-row-glass .name { font-weight: 700; font-size: 0.9rem; }
        .row-controls { display: flex; align-items: center; gap: 0.75rem; }
        .row-controls input { width: 55px; padding: 0.4rem; border-radius: 8px; border: 1px solid var(--sterile-gray); text-align: center; font-weight: 700; color: var(--teal-dark); }
        .btn-ghost-danger { background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: 0.2s; }
        .btn-ghost-danger:hover { color: var(--accent-red); }
        
        .btn-back { display: flex; align-items: center; gap: 0.5rem; background: none; border: none; color: var(--text-muted); font-weight: 700; cursor: pointer; margin-bottom: 1.5rem; transition: color 0.2s; }
        .btn-back:hover { color: var(--teal-primary); }
        
        .upload-zone-modern { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 2.5rem; border: 2px dashed var(--sterile-gray); border-radius: 20px; cursor: pointer; transition: all 0.3s; color: var(--text-muted); background: var(--medical-bg); }
        .upload-zone-modern:hover { border-color: var(--teal-primary); background: rgba(13,148,136,0.03); color: var(--teal-dark); }
        
        .field-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; }
        .field-group label { font-size: 0.8rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; }
        .field-group input { padding: 0.8rem 1rem; border-radius: 12px; border: 1px solid var(--sterile-gray); font-size: 1rem; outline: none; }
        
        .add-row-modern { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
        .add-row-modern input { padding: 0.7rem; border-radius: 10px; border: 1px solid var(--sterile-gray); flex: 1; }
        .btn-teal-add { background: var(--teal-primary); color: white; border: none; padding: 0.7rem; border-radius: 10px; cursor: pointer; }
        
        .tag-cloud { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .tag-pill { display: flex; align-items: center; gap: 0.5rem; background: white; border: 1px solid var(--sterile-gray); padding: 0.4rem 0.8rem; border-radius: 100px; font-size: 0.85rem; font-weight: 700; }
        .tag-pill button { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0; }
        
        .btn-launch { background: var(--teal-primary); color: white; border: none; padding: 1rem 2.5rem; border-radius: 16px; font-weight: 800; cursor: pointer; box-shadow: 0 10px 20px -5px rgba(13,148,136,0.4); display: flex; align-items: center; gap: 0.75rem; margin: 2rem 0 0 auto; transition: 0.3s; }
        .btn-launch:hover { transform: translateY(-2px); box-shadow: 0 15px 30px -5px rgba(13,148,136,0.5); }
        
        .share-links-container { margin-top: 3rem; }
        .share-box-glass { background: white; border-radius: 24px; padding: 2rem; border: 1px solid var(--sterile-gray); box-shadow: 0 20px 40px -15px rgba(0,0,0,0.08); display: flex; gap: 1.5rem; }
        .share-content { flex: 1; }
        .share-content h3 { margin: 0 0 1.5rem; font-size: 1.25rem; }
        .share-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        @media (max-width: 700px) { .share-grid { grid-template-columns: 1fr; } }
        
        .share-item span { display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem; }
        .copy-field { display: flex; gap: 0.4rem; }
        .copy-field code { flex: 1; background: var(--medical-bg); padding: 0.6rem 0.8rem; border-radius: 10px; font-size: 0.8rem; font-family: monospace; overflow: hidden; text-overflow: ellipsis; }
        .btn-copy-teal { background: var(--teal-primary); color: white; border: none; width: 40px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .btn-copy-dark { background: #334155; color: white; border: none; width: 40px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        
        .toast-message { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); padding: 0.8rem 1.5rem; border-radius: 100px; font-weight: 700; color: white; z-index: 1000; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
        .toast-message.success { background: var(--teal-dark); }
        .toast-message.error { background: var(--accent-red); }
        
        .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
