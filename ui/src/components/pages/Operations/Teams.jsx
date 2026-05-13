import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { usePermissions } from '../../../hooks/usePermissions';

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', lead: '', members: '' });
  const { can } = usePermissions();

  // ── FETCH from API ──
  const fetchTeams = async () => {
    setLoading(true);
    try {
      const data = await api.get('/teams');
      setTeams(data || []);
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTeams(); }, []);

  // ── INSERT into API ──
  const handleAdd = async () => {
    if (!form.name.trim()) return;
    try {
      await api.post('/teams', {
        name: form.name,
        lead: form.lead,
        members: parseInt(form.members) || 0,
      });
      setForm({ name: '', lead: '', members: '' });
      setShowForm(false);
      fetchTeams();
    } catch (error) {
      console.error('Insert error:', error);
      alert('Failed to create team: ' + error.message);
    }
  };

  return (
    <div className="page-container app-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Team Structures</h1>
          <p className="page-desc">Manage departments, squads, and team assignments.</p>
        </div>
         {can('teams', 'create') && (
           <button className="btn btn-primary" style={{ padding: '0.6rem 0.75rem', fontSize: '0.875rem', width: '130px', position: 'absolute', top: '2rem', right: '2rem' }} onClick={() => setShowForm(true)}>+ Create Team</button>
         )}
       </div>

      {/* Add Team Form */}
      {showForm && (
        <div className="data-card" style={{ marginBottom: '1.5rem', backgroundColor: '#f8fafc' }}>
          <h3 style={{ marginTop: 0 }}>New Team</h3>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Team Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="btn btn-outline" style={{ flex: 2, backgroundColor: 'white' }} />
            <input type="text" placeholder="Team Lead" value={form.lead} onChange={e => setForm({...form, lead: e.target.value})} className="btn btn-outline" style={{ flex: 2, backgroundColor: 'white' }} />
            <input type="number" placeholder="Members" value={form.members} onChange={e => setForm({...form, members: e.target.value})} className="btn btn-outline" style={{ width: '100px', backgroundColor: 'white' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary btn-save" onClick={handleAdd}>Save</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="data-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Team Name</th>
              <th>Team Lead</th>
              <th>Members</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</td></tr>
            ) : teams.length === 0 ? (
              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No teams found.</td></tr>
            ) : (
              teams.map(team => (
                <tr key={team.id}>
                  <td><strong>{team.name}</strong></td>
                  <td>{team.lead}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem' }}>
                        {team.members}
                      </div>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Members</span>
                    </div>
                  </td>
                  <td>
                     {can('teams', 'edit') && (
                       <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Manage Team</button>
                     )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
