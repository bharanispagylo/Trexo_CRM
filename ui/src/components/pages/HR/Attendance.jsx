import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../api/client';
import './Attendance.css';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAlert } from '../../../context/AlertContext';

export default function Attendance({ user }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [view, setView] = useState('main'); // 'main' or 'manual'
  const { can, getLevel } = usePermissions();
  const { alert } = useAlert();

  // ── PUNCH & ATTACHMENT STATES ──
  const [photoUrl, setPhotoUrl] = useState('');
  const [locationStr, setLocationStr] = useState('');
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  const [manualPhotoUrl, setManualPhotoUrl] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [fetchingManualLocation, setFetchingManualLocation] = useState(false);
  const [uploadingManualPhoto, setUploadingManualPhoto] = useState(false);
  const manualPhotoInputRef = useRef(null);

  // ── TICKING CLOCK ──
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── GEOLOCATION AUTO-FETCH ON MOUNT ──
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocationStr(`Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);
        },
        (err) => console.log('Auto location fetch skipped:', err.message),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const data = await api.get('/attendance');
      const level = getLevel('attendance', 'view');
      const userName = (user?.fullName || user?.firstName || user?.name || '').trim().toLowerCase();
      
      let filteredData = data || [];
      if (level === 'Self') {
        filteredData = (data || []).filter(a => a.name?.trim().toLowerCase() === userName);
      }
      
      // Sort by date (desc)
      filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAttendance(filteredData);
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAttendance(); }, [user]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return '#10b981';
      case 'Out': return '#f59e0b';
      case 'Absent': return '#ef4444';
      case 'Late': return '#f59e0b';
      default: return '#64748b';
    }
  };

  // ── HELPER: UPLOAD PHOTO TO CLOUDINARY OR BASE64 FALLBACK ──
  const uploadImage = async (file, setUrl, setUploading) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'img_default');
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );
      const data = await response.json();
      if (data.secure_url) {
        setUrl(data.secure_url);
      } else {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (err) {
      console.warn('Cloudinary upload failed, falling back to base64:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        setUrl(event.target.result);
      };
      reader.readAsDataURL(file);
    }
    setUploading(false);
  };

  // ── HELPER: RETRIEVE LOCATION COORDINATES ──
  const getGeolocation = (setLoc, setFetching) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.", "error");
      return;
    }
    setFetching(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLoc(`Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);
        setFetching(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert("Failed to retrieve location: " + err.message, "error");
        setFetching(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // ── PUNCH IN HANDLER ──
  const handleCheckIn = async () => {
    setIsSaving(true);
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const payload = {
        name: user.fullName || user.firstName || user.name || 'Employee',
        empId: user.empId || user.id || '',
        role: user.role || 'Employee',
        date: now.toISOString().split('T')[0],
        checkIn: timeStr,
        status: 'Present',
        photoUrl: photoUrl || null,
        location: locationStr || null
      };

      await api.post('/attendance', payload);
      alert('Checked in successfully!', 'success', 'Success');
      setPhotoUrl('');
      fetchAttendance();
    } catch (err) {
      alert('Check-in failed: ' + err.message, 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── PUNCH OUT HANDLER ──
  const handleCheckOut = async (record) => {
    setIsSaving(true);
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Calculate total working hours
      let workingHrs = '--';
      if (record.checkIn) {
        try {
          const parseTimeStr = (str) => {
            const parts = str.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (parts) {
              let h = parseInt(parts[1]);
              const m = parseInt(parts[2]);
              const ampm = parts[3];
              if (ampm && ampm.toLowerCase() === 'pm' && h < 12) h += 12;
              if (ampm && ampm.toLowerCase() === 'am' && h === 12) h = 0;
              return h * 60 + m;
            }
            return null;
          };
          const inMin = parseTimeStr(record.checkIn);
          const outMin = now.getHours() * 60 + now.getMinutes();
          if (inMin !== null && outMin > inMin) {
            const diffMin = outMin - inMin;
            const hours = (diffMin / 60).toFixed(1);
            workingHrs = `${hours} Hrs`;
          }
        } catch (e) {
          console.error("Error calculating working hours:", e);
        }
      }

      await api.put(`/attendance/${record.id}`, {
        checkOut: timeStr,
        totalWorkingHrs: workingHrs,
        status: 'Out'
      });
      alert('Checked out successfully!', 'success', 'Success');
      fetchAttendance();
    } catch (err) {
      alert('Check-out failed: ' + err.message, 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── MANUAL ATTENDANCE FORM ──
  const [usersList, setUsersList] = useState([]);
  const [manualFormName, setManualFormName] = useState(user.fullName || user.firstName || user.name || '');

  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().split('T')[0],
    checkIn: '09:00',
    checkOut: '18:00',
    empId: user.empId || user.id || '',
    role: user.role || '',
    destination: '',
    breakTime: '',
    totalWorkingHrs: '',
    outTimeHrs: ''
  });

  useEffect(() => {
    if (view === 'manual') {
      setManualForm({
        date: new Date().toISOString().split('T')[0],
        checkIn: '09:00',
        checkOut: '18:00',
        empId: user.empId || user.id || '',
        role: user.role || '',
        destination: '',
        breakTime: '',
        totalWorkingHrs: '',
        outTimeHrs: ''
      });
      setManualFormName(user.fullName || user.firstName || user.name || '');
      setManualPhotoUrl('');
      setManualLocation('');
      
      if (user.role === 'Admin') {
        api.get('/users')
          .then(res => setUsersList(res || []))
          .catch(err => console.error('Failed to fetch users:', err));
      }
    }
  }, [view, user]);

  const handleManualAdd = async () => {
    if (!manualForm.date || !manualForm.empId?.trim() || !manualForm.checkIn || !manualForm.checkOut) {
      alert("Please fill out all mandatory fields: Date, Employee ID, Check In, and Check Out.");
      return;
    }
    setIsSaving(true);
    try {
      const formatTime = (time) => {
        const [h, m] = time.split(':');
        const hh = parseInt(h);
        const suffix = hh >= 12 ? 'PM' : 'AM';
        const hour = hh % 12 || 12;
        return `${String(hour).padStart(2, '0')}:${m} ${suffix}`;
      };

      await api.post('/attendance', {
        name: manualFormName,
        empId: manualForm.empId,
        role: manualForm.role,
        destination: manualForm.destination,
        date: manualForm.date,
        checkIn: formatTime(manualForm.checkIn),
        checkOut: formatTime(manualForm.checkOut),
        breakTime: manualForm.breakTime,
        totalWorkingHrs: manualForm.totalWorkingHrs,
        outTimeHrs: manualForm.outTimeHrs,
        status: manualForm.checkOut ? 'Out' : 'Present',
        photoUrl: manualPhotoUrl || null,
        location: manualLocation || null
      });
      alert('Attendance entry saved successfully!', 'success', 'Success');
      setView('main');
      fetchAttendance();
    } catch (error) {
      alert('Failed to add entry: ' + error.message, 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  // Find user's today attendance log
  const todayStr = new Date().toISOString().split('T')[0];
  const loggedInEmpId = user.empId || user.id;
  const todayRecord = attendance.find(a => {
    if (!a.date) return false;
    const isSameUser = a.empId === loggedInEmpId || a.name?.trim().toLowerCase() === (user.fullName || user.firstName || user.name || '').trim().toLowerCase();
    const recordDateStr = new Date(a.date).toISOString().split('T')[0];
    return isSameUser && recordDateStr === todayStr;
  });

  if (view === 'manual') {
    return (
      <div className="attendance-page">
        <div className="manual-entry-container animate-slide-up" style={{ maxWidth: '800px', margin: '2rem auto', background: 'white', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div className="manual-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>New Manual Attendance Entry</h2>
            <button className="btn-cancel" onClick={() => setView('main')} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>← Back to History</button>
          </div>
          
          <div className="manual-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Select Date *</label>
              <input type="date" value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Employee ID *</label>
                {user.role === 'Admin' ? (
                  <select
                    value={usersList.find(u => u.empId === manualForm.empId || u.id === manualForm.empId)?.id || ''}
                    onChange={e => {
                      const selected = usersList.find(u => u.id === e.target.value);
                      if (selected) {
                        setManualForm({
                          ...manualForm,
                          empId: selected.empId || selected.id,
                          role: selected.role || selected.designation || 'Employee'
                        });
                        setManualFormName(selected.fullName || `${selected.firstName} ${selected.lastName}`.trim());
                      } else {
                        setManualForm({
                          ...manualForm,
                          empId: '',
                          role: ''
                        });
                        setManualFormName('');
                      }
                    }}
                    style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: 'white' }}
                  >
                    <option value="">-- Select Employee --</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName || `${u.firstName} ${u.lastName}`.trim()} ({u.empId || 'No ID'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={manualForm.empId} 
                    readOnly 
                    style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', color: '#64748b' }} 
                  />
                )}
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Role</label>
                <input type="text" value={manualForm.role} onChange={e => setManualForm({...manualForm, role: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Check In Time *</label>
                <input type="time" value={manualForm.checkIn} onChange={e => setManualForm({...manualForm, checkIn: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Check Out Time *</label>
                <input type="time" value={manualForm.checkOut} onChange={e => setManualForm({...manualForm, checkOut: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Destination</label>
                <input type="text" placeholder="Office / Client Site" value={manualForm.destination} onChange={e => setManualForm({...manualForm, destination: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Break Time</label>
                <input type="text" placeholder="1 Hr" value={manualForm.breakTime} onChange={e => setManualForm({...manualForm, breakTime: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Total Working Hrs</label>
                <input type="text" placeholder="8.5 Hrs" value={manualForm.totalWorkingHrs} onChange={e => setManualForm({...manualForm, totalWorkingHrs: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Out Time Hrs</label>
                <input type="text" placeholder="18:30" value={manualForm.outTimeHrs} onChange={e => setManualForm({...manualForm, outTimeHrs: e.target.value})} style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
              </div>
            </div>

            {/* MANUAL ATTACH PHOTO */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Photo Attachment</label>
              <input 
                type="file" 
                accept="image/*" 
                ref={manualPhotoInputRef} 
                style={{ display: 'none' }} 
                onChange={e => uploadImage(e.target.files[0], setManualPhotoUrl, setUploadingManualPhoto)} 
              />
              {manualPhotoUrl ? (
                <div className="photo-preview-wrapper" style={{ height: '120px' }}>
                  <img src={manualPhotoUrl} className="photo-preview-image" alt="Preview" />
                  <button type="button" className="btn-remove-photo" onClick={() => setManualPhotoUrl('')}>✕</button>
                </div>
              ) : (
                <button type="button" className="btn-upload-photo" style={{ padding: '1rem' }} onClick={() => manualPhotoInputRef.current.click()}>
                  {uploadingManualPhoto ? 'Uploading...' : 'Click to Upload / Capture Photo'}
                </button>
              )}
            </div>

            {/* MANUAL GEOLOCATION */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Current Location</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="e.g. Lat: 13.0827, Lng: 80.2707" 
                  value={manualLocation} 
                  onChange={e => setManualLocation(e.target.value)} 
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} 
                />
                <button 
                  type="button" 
                  className="btn-get-location" 
                  onClick={() => getGeolocation(setManualLocation, setFetchingManualLocation)}
                  style={{ padding: '0.75rem 1rem' }}
                >
                  {fetchingManualLocation ? 'Fetching...' : 'Get GPS'}
                </button>
              </div>
            </div>

          </div>

          <div className="manual-footer" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
            <button className="btn-cancel" onClick={() => setView('main')} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
            <button className="btn-submit" onClick={handleManualAdd} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Save Entry</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Attendance...'}</div>;

  return (
    <div className="attendance-page">
      <div className="attendance-container">
        
        {/* LEFT: CLOCK CARD & PUNCH DESK */}
        <div className="punch-card-section">
          <div className="clock-card">
            <div className="current-date">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div className="current-time">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            <div className="clock-footer">
              <span className="live-badge">LIVE CLOCK</span>
            </div>
          </div>

          {/* LIVE PUNCH ACTIONS */}
          <div className="punch-actions-container">
            <h4 className="punch-title">Today's Punch Desk</h4>
            
            {!todayRecord ? (
              <>
                {/* PHOTO UPLOAD */}
                <div className="photo-upload-container">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="user" 
                    ref={photoInputRef} 
                    style={{ display: 'none' }} 
                    onChange={(e) => uploadImage(e.target.files[0], setPhotoUrl, setUploadingPhoto)}
                  />
                  {photoUrl ? (
                    <div className="photo-preview-wrapper">
                      <img src={photoUrl} className="photo-preview-image" alt="Check In Preview" />
                      <button className="btn-remove-photo" onClick={() => setPhotoUrl('')}>✕</button>
                    </div>
                  ) : (
                    <button className="btn-upload-photo" onClick={() => photoInputRef.current.click()}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                      <span>{uploadingPhoto ? 'Uploading...' : 'Take/Upload Photo *'}</span>
                    </button>
                  )}
                </div>

                {/* GEOLOCATION */}
                <div className="location-box">
                  <svg className="location-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <span className="location-text" title={locationStr}>
                    {locationStr || 'Fetching location...'}
                  </span>
                  <button className="btn-get-location" onClick={() => getGeolocation(setLocationStr, setFetchingLocation)}>
                    {fetchingLocation ? '...' : 'Retry'}
                  </button>
                </div>

                <button 
                  className="btn-punch-in" 
                  onClick={handleCheckIn}
                  disabled={!photoUrl || !locationStr || uploadingPhoto}
                  title={(!photoUrl || !locationStr) ? "Please upload a photo and fetch GPS location before punching in." : ""}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6"></path><path d="M10 14L21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>
                  Punch In
                </button>
              </>
            ) : !todayRecord.checkOut ? (
              <>
                <div className="punch-status-info">
                  <div>✓ Checked In at {todayRecord.checkIn}</div>
                  {todayRecord.location && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>
                      📍 {todayRecord.location}
                    </div>
                  )}
                </div>
                {todayRecord.photoUrl && (
                  <div className="photo-preview-wrapper" style={{ height: '100px' }}>
                    <img src={todayRecord.photoUrl} className="photo-preview-image" alt="Punch In Thumb" />
                  </div>
                )}
                <button className="btn-punch-out" onClick={() => handleCheckOut(todayRecord)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  Punch Out
                </button>
              </>
            ) : (
              <div className="punch-status-info" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
                <div>✓ Shift Completed</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>In: {todayRecord.checkIn} | Out: {todayRecord.checkOut}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 700 }}>Total Time: {todayRecord.totalWorkingHrs}</div>
                {todayRecord.photoUrl && (
                  <div className="photo-preview-wrapper" style={{ height: '80px', marginTop: '4px' }}>
                    <img src={todayRecord.photoUrl} className="photo-preview-image" alt="Punch Out Preview" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="attendance-stats">
            <div className="stat-box">
              <div className="stat-label">Days Present</div>
              <div className="stat-value">{attendance.filter(a => a.status === 'Present' || a.status === 'Out').length}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Total Hours</div>
              <div className="stat-value">{todayRecord?.totalWorkingHrs || '--'}</div>
            </div>
          </div>
        </div>

        {/* RIGHT: HISTORY LIST */}
        <div className="history-section">
          <div className="history-header">
            <h3>Attendance History</h3>
            <div className="history-actions">
              {can('attendance', 'create') && (
                <button className="history-btn active" onClick={() => setView('manual')}>+ Add Manual Entry</button>
              )}
            </div>
          </div>

          <div className="history-list">
            {loading ? (
              <div className="loading-history">Loading history...</div>
            ) : attendance.length === 0 ? (
              <div className="empty-history">No records found for this period.</div>
            ) : (
              attendance.map(att => (
                <div key={att.id} className="history-item">
                  <div className="item-date">
                    <span className="date-day">{new Date(att.date).getDate()}</span>
                    <span className="date-month">{new Date(att.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                  </div>
                  <div className="item-details">
                    <div className="item-row" style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                      <span>{att.name || 'Employee'}</span>
                      <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>({att.empId || 'No ID'})</span>
                    </div>
                    <div className="item-row">
                      <span className="time-label">Check In:</span>
                      <span className="time-value">{att.checkIn}</span>
                      {att.checkOut && (
                        <>
                          <span className="time-label" style={{ marginLeft: '12px' }}>Check Out:</span>
                          <span className="time-value">{att.checkOut}</span>
                        </>
                      )}
                    </div>
                    <div className="item-row" style={{ marginTop: '4px', gridColumn: 'span 2' }}>
                      <span className="time-label" style={{ color: '#2563eb' }}>Details:</span>
                      <span className="time-value" style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {att.destination && <span>{att.destination} • </span>} 
                        {att.breakTime && <span>Break: {att.breakTime} • </span>}
                        {att.totalWorkingHrs && <span>Total: {att.totalWorkingHrs}</span>}
                        {att.location && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#ef4444', fontWeight: 600 }}>
                            📍 {att.location}
                          </span>
                        )}
                        {att.photoUrl && (
                          <a href={att.photoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#2563eb', fontWeight: 700 }}>
                            📸 View Photo
                          </a>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="item-status">
                    <span className="status-dot" style={{ backgroundColor: getStatusColor(att.status) }}></span>
                    {att.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
