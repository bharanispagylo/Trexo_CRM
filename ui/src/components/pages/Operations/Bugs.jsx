import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import './Bugs.css';
import { useAlert } from '../../../context/AlertContext';

export default function Bugs() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New bug state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Open');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { alert } = useAlert();

  useEffect(() => {
    fetchBugs();
  }, []);

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const data = await api.get('/bugs');
      setBugs(data || []);
    } catch (error) {
      console.error('Error fetching bugs:', error);
    }
    setLoading(false);
  };

  const uploadImageToCloudinary = async (file) => {
    const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      alert("Cloudinary Cloud Name or Upload Preset is missing from .env", 'error', 'Configuration Error');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    
    // Add date to the upload image name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    formData.append('public_id', `bug_${timestamp}`);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.secure_url) {
        return data.secure_url;
      } else {
        console.error("Cloudinary error:", data);
        alert(`Cloudinary Upload Error: ${data.error?.message || 'Unknown error. Please check your upload preset.'}`, 'error', 'Upload Failed');
        return null;
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Network error while uploading image to Cloudinary.', 'error', 'Network Error');
      return null;
    }
  };

  const handleAddBug = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setUploading(true);
    let imageUrl = null;

    if (imageFile) {
      imageUrl = await uploadImageToCloudinary(imageFile);
    }

    try {
      await api.post('/bugs', {
        title,
        description,
        status,
        imageUrl: imageUrl,
      });
      alert('Bug reported successfully!', 'success', 'Success');
      setShowModal(false);
      setTitle('');
      setDescription('');
      setStatus('Open');
      setImageFile(null);
      fetchBugs();
    } catch (error) {
      console.error('Error adding bug:', error);
      alert('Failed to add bug via API.', 'error', 'Error');
    } finally {
      setUploading(false);
      setIsSaving(false);
    }
  };

  const updateBugStatus = async (id, newStatus) => {
    setIsSaving(true);
    try {
      await api.put(`/bugs/${id}`, { status: newStatus });
      alert(`Bug status updated to ${newStatus}`, 'success', 'Success');
      fetchBugs();
    } catch (error) {
      console.error('Error updating bug:', error);
      alert('Failed to update bug status.', 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isSaving || uploading) return <div className="loading-screen">{(isSaving || uploading) ? 'Saving...' : 'Loading Bugs...'}</div>;

  return (
    <div className="bugs-root">
      <div className="bugs-header">
        <div>
          <h1 className="bugs-title">Bugs & Issues</h1>
          <p className="bugs-sub">Track and resolve system issues.</p>
        </div>
        <button className="bugs-new-btn" onClick={() => setShowModal(true)}>
          + Report Bug
        </button>
      </div>

      <div className="bugs-board">
        {loading ? (
          <p>Loading bugs...</p>
        ) : bugs.length === 0 ? (
          <div className="bugs-empty">No bugs reported.</div>
        ) : (
          bugs.map(bug => (
            <div className="bug-card" key={bug.id}>
              <div className="bug-card-top">
                <span className={`bug-status status-${bug.status.toLowerCase()}`}>{bug.status}</span>
                <span className="bug-date">{new Date(bug.created_at).toLocaleDateString()}</span>
              </div>
              <h3 className="bug-card-title">{bug.title}</h3>
              <p className="bug-card-desc">{bug.description}</p>
              {bug.image_url && (
                <a href={bug.image_url} target="_blank" rel="noopener noreferrer">
                  <img src={bug.image_url} alt="Bug screenshot" className="bug-img" />
                </a>
              )}
              <div className="bug-actions">
                {bug.status !== 'Resolved' && (
                  <button className="btn-resolve" onClick={() => updateBugStatus(bug.id, 'Resolved')}>
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Report a Bug</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddBug} className="modal-body">
              <div className="mfield">
                <label className="mlabel">Bug Title *</label>
                <input className="minput" required value={title} onChange={e => setTitle(e.target.value)} placeholder="E.g., Login button not working" />
              </div>
              <div className="mfield">
                <label className="mlabel">Description</label>
                <textarea className="minput" rows="3" value={description} onChange={e => setDescription(e.target.value)} placeholder="Details about the issue..."></textarea>
              </div>
              <div className="mfield">
                <label className="mlabel">Screenshot (Optional)</label>
                <input type="file" className="minput" accept="image/*" onChange={e => setImageFile(e.target.files[0])} />
              </div>
              <div className="modal-footer">
                <button type="button" className="mbtn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="mbtn-add" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Submit Bug'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
