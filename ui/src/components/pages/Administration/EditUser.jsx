import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import './AddUser.css'; // Reusing the same styling
import { useAlert } from '../../../context/AlertContext';

export default function EditUser({ userToEdit, onBack }) {
  const [roles, setRoles] = useState(['Admin', 'Employee']);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const { alert } = useAlert();

  

  const [form, setForm] = useState({ 
    firstName: userToEdit?.firstName || '',
    lastName: userToEdit?.lastName || '',
    fullName: userToEdit?.fullName || `${userToEdit?.firstName || ''} ${userToEdit?.lastName || ''}`.trim(),
    email: userToEdit?.email || '',
    password: userToEdit?.password || '',
    phoneNo: userToEdit?.phoneNo || '',
    empId: userToEdit?.empId || '',
    designation: userToEdit?.designation || '',
    profileImage: userToEdit?.profileImage || '',
    role: userToEdit?.role || 'Employee',
    status: userToEdit?.status || 'Active'
  });

  const handleFirstNameChange = (val) => {
    setForm(prev => ({
      ...prev,
      firstName: val,
      fullName: `${val} ${prev.lastName || ''}`.trim()
    }));
  };

  const handleLastNameChange = (val) => {
    setForm(prev => ({
      ...prev,
      lastName: val,
      fullName: `${prev.firstName || ''} ${val}`.trim()
    }));
  };

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const roleData = await api.get('/roles/permissions');
        if (roleData) {
          const dynamicRoles = ['Admin', 'Employee'];
          roleData.forEach(r => {
            const rName = r.role.charAt(0).toUpperCase() + r.role.slice(1).toLowerCase();
            if (!dynamicRoles.includes(rName)) dynamicRoles.push(rName);
          });
          setRoles(dynamicRoles.sort((a, b) => a.localeCompare(b)));
        }
      } catch (error) {
        console.error('Fetch roles error:', error);
      }
    };
    fetchRoles();
  }, []);

  const handleImageUpload = async (file) => {
    if (!file) return null;
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
      if (data.secure_url) return data.secure_url;
      throw new Error(data.error?.message || 'Upload failed');
    } catch (error) {
      console.error('Cloudinary Upload error:', error);
      alert('Failed to upload image: ' + error.message, 'error', 'Upload Failed');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    const empIdRegex = /^[A-Z0-9-]{3,10}$/i;
    const singleNameRegex = /^[a-z\s]{2,50}$/i;
    const lastNameRegex = /^[a-z\s]{1,50}$/i;

    if (!form.firstName) newErrors.firstName = "First name is required";
    else if (!singleNameRegex.test(form.firstName)) newErrors.firstName = "Letters only, min 2 chars";

    if (!form.lastName) newErrors.lastName = "Last name is required";
    else if (!lastNameRegex.test(form.lastName)) newErrors.lastName = "Letters only, min 1 char";

    if (!form.email) newErrors.email = "Email is required";
    else if (!emailRegex.test(form.email)) newErrors.email = "Invalid email format";

    if (form.password && form.password.length < 6) newErrors.password = "Min 6 characters";

    if (form.phoneNo && !phoneRegex.test(form.phoneNo)) newErrors.phoneNo = "Min 10 digits";
    if (form.empId && !empIdRegex.test(form.empId)) newErrors.empId = "3-10 alphanumeric chars";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    setLoading(true);
    try {
      await api.put(`/users/${userToEdit.id}`, form);
      alert('User updated successfully!', 'success', 'Profile Updated');
      onBack();
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update user: ' + error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  // Guard against missing userToEdit
  if (!userToEdit) {
    return <div className="loading-screen">Loading user data...</div>;
  }

  if (loading || uploading) return <div className="loading-screen">{loading ? 'Saving Updates...' : 'Uploading Image...'}</div>;

  return (
    <div className="add-user-page">
      <div className="page-header">
        <h2 className="page-title">Edit User Details</h2>
        <p className="page-subtitle">Update information for {form.fullName}</p>
      </div>

      <div className="saas-form-container">
        <div className="form-grid">
          <div className="saas-field">
            <label className="saas-label">First Name *</label>
            <input 
              className={`saas-input ${errors.firstName ? 'error' : ''}`} 
              placeholder="First Name" 
              value={form.firstName} 
              autoComplete="off" 
              onChange={e => handleFirstNameChange(e.target.value)} 
            />
            {errors.firstName && <span className="error-text">{errors.firstName}</span>}
          </div>
          <div className="saas-field">
            <label className="saas-label">Last Name *</label>
            <input 
              className={`saas-input ${errors.lastName ? 'error' : ''}`} 
              placeholder="Second Name" 
              value={form.lastName} 
              autoComplete="off" 
              onChange={e => handleLastNameChange(e.target.value)} 
            />
            {errors.lastName && <span className="error-text">{errors.lastName}</span>}
          </div>
          <div className="saas-field">
            <label className="saas-label">Email Address *</label>
            <input 
              className={`saas-input ${errors.email ? 'error' : ''}`} 
              type="email" 
              placeholder="john@example.com" 
              value={form.email} 
              autoComplete="off" 
              onChange={e => setForm({...form, email: e.target.value})} 
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>
          <div className="saas-field">
            <label className="saas-label">Password</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input 
                className={`saas-input ${errors.password ? 'error' : ''}`} 
                type={showPassword ? "text" : "password"} 
                placeholder="Leave blank to keep current" 
                value={form.password} 
                autoComplete="new-password" 
                onChange={e => setForm({...form, password: e.target.value})} 
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  outline: 'none'
                }}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>
          <div className="saas-field">
            <label className="saas-label">Phone Number</label>
            <input 
              className={`saas-input ${errors.phoneNo ? 'error' : ''}`} 
              placeholder="+1 (555) 000-0000" 
              value={form.phoneNo} 
              autoComplete="off" 
              onChange={e => setForm({...form, phoneNo: e.target.value})} 
            />
            {errors.phoneNo && <span className="error-text">{errors.phoneNo}</span>}
          </div>
          <div className="saas-field">
            <label className="saas-label">Employee ID</label>
            <input 
              className={`saas-input ${errors.empId ? 'error' : ''}`} 
              placeholder="EMP001" 
              value={form.empId} 
              autoComplete="off" 
              onChange={e => setForm({...form, empId: e.target.value})} 
            />
            {errors.empId && <span className="error-text">{errors.empId}</span>}
          </div>

          <div className="saas-field">
            <label className="saas-label">Designation</label>
            <input className="saas-input" placeholder="Software Engineer" value={form.designation} autoComplete="off" onChange={e => setForm({...form, designation: e.target.value})} />
          </div>
          <div className="saas-field">
            <label className="saas-label">Role</label>
            <select className="saas-select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="saas-field">
            <label className="saas-label">Status</label>
            <select className="saas-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div className="saas-field full-width">
            <label className="saas-label">Profile Image</label>
            <div className="image-upload-wrapper">
              <input 
                type="file" 
                accept="image/*" 
                onChange={async (e) => {
                  const file = e.target.files[0];
                  const url = await handleImageUpload(file);
                  if (url) setForm({...form, profileImage: url});
                }}
              />
              {uploading && <span className="upload-loader">Uploading...</span>}
              {form.profileImage && (
                <div className="preview-container">
                  <img src={form.profileImage} alt="Preview" className="upload-preview" />
                  <button className="remove-img-btn" onClick={() => setForm({...form, profileImage: ''})}>✕</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button className="saas-btn-secondary" onClick={onBack}>Cancel</button>
          <button className="saas-btn-primary" onClick={handleUpdate} disabled={loading || uploading}>
            {loading ? 'Saving...' : 'Update User'}
          </button>
        </div>
      </div>
    </div>
  );
}
