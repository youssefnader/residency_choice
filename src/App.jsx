import React, { useState, useEffect, useCallback } from 'react'
import { Stethoscope, LayoutDashboard, Settings, LogOut, Loader, DoorOpen, Lock } from 'lucide-react'
import AdminDashboard from './features/admin/AdminDashboard'
import SelectionGrid from './features/selection/SelectionGrid'
import DoctorLogin from './features/auth/DoctorLogin'
import { supabase } from './lib/supabase'

// --- URL Param Helpers ---
const getUrlParam = (key) => new URLSearchParams(window.location.search).get(key)
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234'

function App() {
  const [view, setView] = useState('welcome')
  const [currentUser, setCurrentUser] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [selections, setSelections] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [adminPinInput, setAdminPinInput] = useState('')
  const [pinError, setPinError] = useState(false)

  // Is this an admin link? (?admin in URL)
  const isAdminUrl = window.location.search.includes('admin')
  // Is there a room pre-selected via URL? (?room=ID)
  const roomIdFromUrl = getUrlParam('room')

  // --- Fetch rooms and data ---
  const fetchSession = useCallback(async (roomId = null) => {
    setLoading(true)
    setError(null)
    try {
      // Priority: explicit roomId arg > URL param
      const targetId = roomId || roomIdFromUrl
      
      if (!targetId) {
        setActiveRoom(null); setCandidates([]); setSpecialties([]); setSelections([])
        setLoading(false); return
      }

      const { data: room, error: roomErr } = await supabase
        .from('rooms').select('*').eq('id', targetId).eq('is_active', true).single()
      
      if (roomErr) throw roomErr
      setActiveRoom(room)

      const [{ data: profiles, error: profErr }, { data: depts, error: deptErr }] = await Promise.all([
        supabase.from('profiles').select('*').eq('room_id', room.id).order('rank', { ascending: true }),
        supabase.from('departments').select('*').eq('room_id', room.id).order('name', { ascending: true }),
      ])
      if (profErr) throw profErr
      if (deptErr) throw deptErr

      setCandidates(profiles || [])
      setSpecialties(depts || [])
      setSelections((profiles || []).filter(p => p.choice_id))

      if (currentUser) {
        const updated = (profiles || []).find(p => p.id === currentUser.id)
        if (updated) setCurrentUser(updated)
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setError('Could not connect to database. Check your Supabase credentials.')
    } finally {
      setLoading(false)
    }
  }, [currentUser, roomIdFromUrl])

  useEffect(() => {
    fetchSession()
    // If URL has ?room=ID, go straight to dashboard
    if (roomIdFromUrl) setView('dashboard')
    // If URL has ?admin, go to admin view (still asks for PIN)
    if (isAdminUrl) setView('admin')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Real-time subscription ---
  useEffect(() => {
    if (!activeRoom) return
    const channel = supabase
      .channel(`room-${activeRoom.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `room_id=eq.${activeRoom.id}` }, (payload) => {
        const updated = payload.new
        setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c))
        setSelections(prev => {
          const filtered = prev.filter(s => s.id !== updated.id)
          return updated.choice_id ? [...filtered, updated] : filtered
        })
        if (currentUser && updated.id === currentUser.id) setCurrentUser(updated)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeRoom?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Seat Selection with Cascading Eviction ---
  const handleSelectSeat = async (deptId) => {
    if (!currentUser || !activeRoom) return
    if (!deptId) {
      await supabase.from('profiles').update({ choice_id: null }).eq('id', currentUser.id)
      return
    }
    const dept = specialties.find(d => d.id === deptId)
    if (!dept) return

    const currentOccupants = selections
      .filter(s => s.choice_id === deptId && s.id !== currentUser.id)
      .sort((a, b) => b.score - a.score || a.rank - b.rank)

    const allAfterMe = [...currentOccupants, { ...currentUser, choice_id: deptId }]
      .sort((a, b) => b.score - a.score || a.rank - b.rank)

    if (allAfterMe.length > dept.total_seats) {
      const evicted = allAfterMe.slice(dept.total_seats)
      if (evicted.some(e => e.id === currentUser.id)) return // Safety net
      for (const ev of evicted) {
        await supabase.from('profiles').update({ choice_id: null }).eq('id', ev.id)
      }
    }
    await supabase.from('profiles').update({ choice_id: deptId }).eq('id', currentUser.id)
  }

  const handleLogin = (candidate) => { setCurrentUser(candidate); setView('dashboard') }
  const handleLogout = () => { setCurrentUser(null); setView('welcome') }
  const handleRoomSwitch = (roomId) => { setCurrentUser(null); fetchSession(roomId); setView('dashboard') }

  const handleAdminPinSubmit = (e) => {
    e.preventDefault()
    if (adminPinInput === ADMIN_PIN) { setAdminUnlocked(true); setPinError(false) }
    else { setPinError(true); setAdminPinInput('') }
  }

  // --- Admin PIN Gate ---
  const AdminPinGate = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '2.5rem', maxWidth: 360, width: '100%', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.12)', textAlign: 'center' }}>
        <Lock size={40} style={{ color: 'var(--teal-primary)', marginBottom: '1rem' }} />
        <h2 style={{ margin: '0 0 0.5rem' }}>Admin Access</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Enter the admin PIN to continue</p>
        <form onSubmit={handleAdminPinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="password"
            placeholder="PIN"
            value={adminPinInput}
            onChange={e => setAdminPinInput(e.target.value)}
            style={{ padding: '0.75rem 1rem', borderRadius: 10, border: `2px solid ${pinError ? '#ef4444' : 'var(--sterile-gray)'}`, fontSize: '1.2rem', textAlign: 'center', outline: 'none', letterSpacing: '0.3em', fontFamily: 'var(--font-body)' }}
            autoFocus
          />
          {pinError && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>Incorrect PIN. Try again.</p>}
          <button className="btn-primary" type="submit">Unlock Admin</button>
        </form>
      </div>
    </div>
  )

  // --- Loading ---
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: 'var(--medical-bg)' }}>
      <Loader size={40} style={{ color: 'var(--teal-primary)', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Connecting to live session...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const baseUrl = window.location.origin + window.location.pathname

  return (
    <div className="app-container">
      <header className="main-header">
        <div className="logo" onClick={() => { if (!roomIdFromUrl) setView('welcome') }} style={{ cursor: roomIdFromUrl ? 'default' : 'pointer' }}>
          <Stethoscope className="icon-pulse" />
          <h1>Aura<span>Medical</span></h1>
          {activeRoom && <span style={{ fontSize: '0.75rem', background: 'var(--medical-bg)', padding: '0.2rem 0.6rem', borderRadius: 8, color: 'var(--teal-dark)', fontWeight: 600 }}>{activeRoom.name}</span>}
        </div>

        {currentUser && (
          <div className="user-switcher">
            <span style={{ fontWeight: 700, color: 'var(--teal-dark)', fontSize: '0.9rem' }}>#{currentUser.rank} — {currentUser.full_name}</span>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}><LogOut size={16} /></button>
          </div>
        )}

        <nav>
          {/* Only show Dashboard tab if not on a room-specific URL */}
          {!roomIdFromUrl && (
            <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
              <LayoutDashboard size={20} /> Dashboard
            </button>
          )}
          {/* Admin tab: only show if on admin URL, or if no room URL */}
          {(isAdminUrl || !roomIdFromUrl) && (
            <button className={`nav-item ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>
              <Settings size={20} /> Admin
            </button>
          )}
        </nav>
      </header>

      <main className="main-content">
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '1rem 1.5rem', color: '#dc2626', marginBottom: '1.5rem', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        {/* WELCOME */}
        {view === 'welcome' && !roomIdFromUrl && (
          <section className="welcome-hero animate-fade-in">
            <div className="hero-badge">Medical Residency Matching</div>
            <h2>Surgical Precision in Selection.</h2>
            <p>A transparent, real-time platform for residency matching.</p>
            
            <div className="action-group">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Please enter via your university's direct session link.
              </p>
              <button className="btn-secondary" onClick={() => setView('admin')}>
                Admin Panel
              </button>
            </div>
          </section>
        )}

        {/* ADMIN */}
        {view === 'admin' && (
          adminUnlocked
            ? <AdminDashboard onSessionCreated={() => fetchSession()} />
            : <AdminPinGate />
        )}

        {/* DASHBOARD */}
        {view === 'dashboard' && (
          !activeRoom ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <h3>No active session yet. Ask the admin to initialize a session.</h3>
            </div>
          ) : !currentUser ? (
            <DoctorLogin candidates={candidates} onLogin={handleLogin} />
          ) : (
            <div className="dashboard-view animate-fade-in">
              <div className="dashboard-header mb-8">
                <h2>Live Specialty Selection — {activeRoom.name}</h2>
                <p>Selections update in real-time for all doctors.</p>
              </div>
              <SelectionGrid user={currentUser} specialties={specialties} selections={selections} onSelect={handleSelectSeat} />
            </div>
          )
        )}
      </main>

      <footer className="main-footer">
        <p>© 2026 AuraMedical · Real-time Priority-Based Matching{activeRoom && <span> · {activeRoom.name}</span>}</p>
      </footer>

      <style>{`
        .user-switcher { display: flex; align-items: center; gap: 0.5rem; background: white; padding: 0.5rem 1rem; border-radius: 100px; border: 1px solid var(--sterile-gray); }
        .mb-8 { margin-bottom: 2rem; }
        .room-chooser { display: flex; flex-direction: column; gap: 0.75rem; width: 100%; max-width: 400px; margin: 1.5rem auto 0; }
        .room-chooser h3 { text-align: center; color: var(--text-muted); font-size: 1rem; margin-bottom: 0.5rem; }
        .room-card { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; background: white; border: 2px solid var(--sterile-gray); border-radius: 12px; cursor: pointer; font-size: 1rem; font-weight: 700; transition: all 0.2s; }
        .room-card:hover { border-color: var(--teal-primary); background: rgba(13,148,136,0.04); }
        .room-card .room-date { margin-left: auto; font-size: 0.75rem; color: var(--text-muted); font-weight: 400; }
      `}</style>
    </div>
  )
}

export default App
