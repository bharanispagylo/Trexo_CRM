import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import './AddUser.css';
import { useAlert } from '../../../context/AlertContext';

export default function AddUser({ onBack }) {
  const [roles, setRoles] = useState(['Admin', 'Employee']);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [existingUsers, setExistingUsers] = useState([]);
  const { alert } = useAlert();


  
  const [form, setForm] = useState({ 
    firstName: '',
    lastName: '',
    fullName: '',
    email: '',
    password: '',
    phoneNo: '',
    empId: '',
    designation: '',
    profileImage: '',
    role: 'Employee'
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

  // Fetch existing users for duplicate validation
  useEffect(() => {
    const fetchExistingUsers = async () => {
      try {
        const data = await api.get('/users');
        if (Array.isArray(data)) setExistingUsers(data);
      } catch (err) {
        console.error('Fetch users for validation error:', err);
      }
    };
    fetchExistingUsers();
  }, []);

  // Real-time duplicate check on blur
  const validateEmailDuplicate = (email) => {
    if (!email || !email.trim()) return;
    const emailLower = email.trim().toLowerCase();
    const duplicate = existingUsers.find(u => (u.email || '').toLowerCase() === emailLower);
    if (duplicate) {
      setErrors(prev => ({ ...prev, email: 'This email address already exists' }));
    } else {
      setErrors(prev => { const { email: _, ...rest } = prev; return rest; });
    }
  };

  const validatePhoneDuplicate = (phone) => {
    if (!phone || !phone.trim()) return;
    const phoneClean = phone.replace(/[\s-+()]/g, '');
    if (phoneClean.length < 10) return;
    const duplicate = existingUsers.find(u => {
      const existingClean = (u.phoneNo || '').replace(/[\s-+()]/g, '');
      return existingClean && existingClean === phoneClean;
    });
    if (duplicate) {
      setErrors(prev => ({ ...prev, phoneNo: 'This phone number already exists' }));
    } else {
      setErrors(prev => { const { phoneNo: _, ...rest } = prev; return rest; });
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'img_default');
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();
      if (data.secure_url) {
        return data.secure_url;
      } else {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Cloudinary Upload error:', error);
      alert('Failed to upload image: ' + error.message, 'error', 'Upload Failed');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    const empIdRegex = /^[A-Z0-9-]{3,10}$/i;
    const singleNameRegex = /^[a-z\s]{2,50}$/i;

    if (!form.firstName) newErrors.firstName = "First name is required";
    else if (!singleNameRegex.test(form.firstName)) newErrors.firstName = "Letters only, min 2 chars";

    if (!form.lastName) newErrors.lastName = "Last name is required";
    else if (!singleNameRegex.test(form.lastName)) newErrors.lastName = "Letters only, min 2 chars";

    if (!form.email) newErrors.email = "Email is required";
    else if (!emailRegex.test(form.email)) newErrors.email = "Invalid email format";

    if (!form.password) newErrors.password = "Password is required";
    else if (form.password.length < 6) newErrors.password = "Min 6 characters";

    if (form.phoneNo && !phoneRegex.test(form.phoneNo)) newErrors.phoneNo = "Min 10 digits";
    if (form.empId && !empIdRegex.test(form.empId)) newErrors.empId = "3-10 alphanumeric chars";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Check for duplicate email/phone before API call
    const emailLower = form.email.trim().toLowerCase();
    const emailDup = existingUsers.find(u => (u.email || '').toLowerCase() === emailLower);
    if (emailDup) {
      setErrors({ email: 'This email address already exists' });
      return;
    }
    if (form.phoneNo) {
      const phoneClean = form.phoneNo.replace(/[\s-+()]/g, '');
      const phoneDup = existingUsers.find(u => {
        const existingClean = (u.phoneNo || '').replace(/[\s-+()]/g, '');
        return existingClean && existingClean === phoneClean;
      });
      if (phoneDup) {
        setErrors({ phoneNo: 'This phone number already exists' });
        return;
      }
    }
    
    setErrors({});
    setLoading(true);
    try {
      await api.post('/users', form);
      alert('User added successfully!', 'success', 'User Created');
      onBack();
    } catch (error) {
      console.error('Insert error:', error);
      alert('Failed to add user: ' + error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };



  if (loading || uploading) return <div className="loading-screen">{loading ? 'Saving User...' : 'Uploading Image...'}</div>;

  return (
    <div className="add-user-page">
      <div className="page-header">
        <h2 className="page-title">Create New User</h2>
        <p className="page-subtitle">Add a new team member to your organization.</p>
      </div>

      <div className="saas-form-container">
        <div className="form-grid">
          <div className="saas-field">
            <label className="saas-label">First Name *</label>
            <input 
              className={`saas-input ${errors.firstName ? 'error' : ''}`} 
              placeholder="John" 
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
              placeholder="Doe" 
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
              onChange={e => {
                setForm({...form, email: e.target.value});
                if (errors.email) setErrors(prev => { const { email: _, ...rest } = prev; return rest; });
              }}
              onBlur={e => validateEmailDuplicate(e.target.value)} 
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>
          <div className="saas-field">
            <label className="saas-label">Password *</label>
            <input 
              className={`saas-input ${errors.password ? 'error' : ''}`} 
              type="password" 
              placeholder="••••••••" 
              value={form.password} 
              autoComplete="new-password" 
              onChange={e => setForm({...form, password: e.target.value})} 
            />
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>
          <div className="saas-field">
            <label className="saas-label">Phone Number</label>
            <input 
              className={`saas-input ${errors.phoneNo ? 'error' : ''}`} 
              placeholder="+1 (555) 000-0000" 
              value={form.phoneNo} 
              autoComplete="off" 
              onChange={e => {
                setForm({...form, phoneNo: e.target.value});
                if (errors.phoneNo) setErrors(prev => { const { phoneNo: _, ...rest } = prev; return rest; });
              }}
              onBlur={e => validatePhoneDuplicate(e.target.value)} 
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
          <button className="saas-btn-primary" onClick={handleSave} disabled={loading || uploading}>
            {loading ? 'Saving...' : 'Save User'}
          </button>
        </div>
      </div>
    </div>
  );
}

