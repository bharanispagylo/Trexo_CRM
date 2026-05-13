import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../api/client';
import './Tasks.css';
import { usePermissions } from '../../../hooks/usePermissions';

const COLUMNS = [
  { id: 'To Do',         label: 'To Do',         color: 'col-todo' },
  { id: 'In Progress',   label: 'In Progress',   color: 'col-progress' },
  { id: 'In Testing',    label: 'In Testing',    color: 'col-testing' },
  { id: 'Re-opened',     label: 'Re-opened',     color: 'col-reopened' },
  { id: 'Prod Deployed', label: 'Prod Deployed', color: 'col-prod-deployed' },
  { id: 'Prod Verified', label: 'Prod Verified', color: 'col-prod-verified' },
];

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const PRIORITY_META = {
  'Critical': { cls: 'pri-critical' },
  'High':     { cls: 'pri-high' },
  'Medium':   { cls: 'pri-medium' },
  'Low':      { cls: 'pri-low' },
};

const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase() : '?';

const AVATAR_COLORS_LIST = ['av-blue', 'av-pink', 'av-green', 'av-amber', 'av-purple'];
const getAvatarColor = (name) => {
  const charCode = name?.charCodeAt(0) || 0;
  return AVATAR_COLORS_LIST[charCode % AVATAR_COLORS_LIST.length];
};


// ── Task Detail View (Separate Page) ──────────────────────────────
function TaskDetailView({ task, onSave, onDelete, onClose, currentUser }) {

  const isEdit = !!task;
  const [form, setForm] = useState(task || {
    title: '',
    description: '',
    assignees: '',
    dueDate: '',
    startDate: '',
    endDate: '',
    assignedDate: '',
    priority: 'Medium',
    status: 'To Do',
    tag: 'Engineering',
    taskType: 'Feature',
    projectName: '',
    isBillable: false,
    approvedHours: 0,
    actualHours: 0,
    attachments: ''
  });


  const [activeTab, setActiveTab] = useState('general');
  const [users, setUsers] = useState([]);
  const [errors, setErrors] = useState({});

  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const { can, getLevel } = usePermissions();
  
  const isAssigned = () => {
    if (!task) return true;
    const userName = (currentUser?.fullName || currentUser?.name || '').trim().toLowerCase();
    if (!userName) return false;
    const assignees = (task.assignees || '').split(',').map(a => a.trim().toLowerCase());
    return assignees.includes(userName);
  };

  const canEdit = getLevel('tasks', 'edit') === 'All' || (getLevel('tasks', 'edit') === 'Self' && isAssigned());
  const canDelete = getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && isAssigned());






  const fetchComments = () => {
    if (isEdit && task.id) {
      api.get(`/tasks/${task.id}/comments`).then(setComments).catch(console.error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
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
        const current = form.attachments ? form.attachments.split(',') : [];
        set('attachments', [...current, data.secure_url].join(','));
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };


  useEffect(() => {
    fetchComments();
    api.get('/users').then(data => {
      const names = data.map(u => u.fullName || `${u.firstName} ${u.lastName}`.trim());
      setUsers(names);
    }).catch(console.error);
  }, [task, isEdit]);


  const handleAddComment = async (parentId = null, text = null) => {
    const commentText = text !== null ? text : newComment;
    if (!commentText.trim()) return;
    try {
      await api.post(`/tasks/${task.id}/comments`, {
        text: commentText,
        author: currentUser?.fullName || currentUser?.name || 'User',
        parentId
      });

      fetchComments();
      if (parentId) {
        setReplyingTo(null);
        setReplyText('');
      } else {
        setNewComment('');
      }
    } catch (err) {
      console.error('Comment error:', err);
    }
  };

  const handleLike = async (commentId) => {
    try {
      await api.put(`/tasks/${task.id}/comments/${commentId}/like`);
      fetchComments(); 
    } catch (err) {
      console.error('Like error:', err);
    }
  };
  
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const assigneesList = form.assignees ? form.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];

  const handleAddAssignee = (name) => {
    const targetName = typeof name === 'string' ? name : selectedAssignee;
    if (targetName && !assigneesList.includes(targetName)) {
      set('assignees', [...assigneesList, targetName].join(', '));
    }
  };

  const handleRemoveAssignee = (name) => {
    set('assignees', assigneesList.filter(a => a !== name).join(', '));
  };

  const submit = () => {
    const newErrors = {};
    const titleRegex = /^.{3,100}$/; // 3-100 chars
    
    if (!form.title.trim()) {
      newErrors.title = "Title is required";
    } else if (!titleRegex.test(form.title)) {
      newErrors.title = "Title must be 3-100 characters";
    }

    if (!form.projectName?.trim()) {
      newErrors.projectName = "Project name is required";
    }

    if (form.isBillable && (form.approvedHours < 0 || form.actualHours < 0)) {

      newErrors.billing = "Hours cannot be negative";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    // Detect changes for activity logging
    if (isEdit) {
      const changes = [];
      if (form.title !== task.title) changes.push(`Title: "${task.title}" → "${form.title}"`);
      if (form.status !== task.status) changes.push(`Status changed to "${form.status}"`);
      if (form.priority !== task.priority) changes.push(`Priority: ${task.priority} → ${form.priority}`);
      if (form.assignees !== task.assignees) changes.push(`Assignees updated`);
      if (form.projectName !== task.projectName) changes.push(`Project: ${task.projectName} → ${form.projectName}`);
      if (form.actualHours !== task.actualHours) changes.push(`Actual Hours: ${task.actualHours} → ${form.actualHours}`);
      if (form.status === 'Completed' && task.status !== 'Completed') changes.push(`Task marked as Completed! ✅`);

      if (changes.length > 0) {
        const timestamp = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        const activityMsg = `📢 Activity Log (${timestamp}):\n${changes.map(c => `• ${c}`).join('\n')}`;
        
        api.post(`/tasks/${task.id}/comments`, {
          text: activityMsg,
          author: "System Activity"
        }).catch(err => console.error("Failed to log activity:", err));
      }
    }

    // Sanitize data for API
    const { comments, taskList, ...payload } = form;
    
    onSave(payload);
    onClose();

  };

  const commentTree = [];
  const commentMap = {};
  
  // Sort comments by date descending so newest are prominent
  const sortedComments = [...comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  sortedComments.forEach(c => commentMap[c.id] = { ...c, children: [] });
  sortedComments.forEach(c => {
    if (c.parentId && commentMap[c.parentId]) {
      commentMap[c.parentId].children.push(commentMap[c.id]);
    } else {
      commentTree.push(commentMap[c.id]);
    }
  });

  const renderComment = (c, isReply = false) => (
    <div key={c.id} className={`saas-comment ${isReply ? 'is-reply' : ''}`}>
      <div className="saas-comment-header">
        <div className={`social-avatar ${getAvatarColor(c.author)}`} style={{ width: 28, height: 28, fontSize: '0.65rem' }}>
          {initials(c.author)}
        </div>

        <div className="saas-comment-meta">
          <span className="saas-comment-author">{c.author}</span>
          <span className="saas-comment-time">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div className={`saas-comment-body ${c.author === 'System Activity' ? 'system-log' : ''}`}>
        {c.text.split('\n').map((line, i) => <div key={i}>{line}</div>)}
      </div>

      <div className="saas-comment-actions">
        <button className={`saas-action-btn ${c.likes > 0 ? 'liked' : ''}`} onClick={() => handleLike(c.id)}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill={c.likes > 0 ? "#2563eb" : "none"} stroke={c.likes > 0 ? "#2563eb" : "currentColor"} strokeWidth="2.5"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
          {c.likes > 0 ? c.likes : 'Like'}
        </button>
        <button className="saas-action-btn" onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}>
          {replyingTo === c.id ? 'Cancel' : 'Reply'}
        </button>
      </div>

      {replyingTo === c.id && (
        <div className="saas-reply-input animate-fade-in">
          <input 
            placeholder="Write a reply..." 
            value={replyText} 
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddComment(c.id, replyText); }}
            autoFocus
          />
        </div>
      )}

      {c.children && c.children.length > 0 && (
        <div className="saas-nested-comments">
          {c.children.map(child => renderComment(child, true))}
        </div>
      )}
    </div>
  );


  return (
    <div className="saas-task-page">
      {/* Top Navigation Bar */}
      <div className="saas-nav">
        <div className="saas-nav-left">
          <button className="saas-back-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <div className="saas-breadcrumb">
            <span className="saas-tag-pill">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Task
            </span>
          </div>
        </div>
        <div className="saas-nav-right">
          {isEdit && canDelete && (
            <button 
              className="saas-icon-btn delete-btn" 
              onClick={() => { if(window.confirm('Delete this task?')) { onDelete(task.id); onClose(); } }}
              title="Delete Task"
              style={{ color: '#ef4444' }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          )}
          <button className="saas-icon-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>
          {canEdit && (
            <button className="saas-save-btn" onClick={submit}>Save Changes</button>
          )}
          <button className="saas-close-btn" onClick={onClose}>✕</button>
        </div>


      </div>

      <div className="saas-title-area" style={{ padding: '0 1.5rem', marginBottom: '0.5rem' }}>
        <textarea 
          className={`saas-title-input ${errors.title ? 'error' : ''}`}
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="Task Title"
          rows="1"
          readOnly={!canEdit}

          onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
        />

        {errors.title && <div className="error-text" style={{ padding: '0 0.5rem' }}>{errors.title}</div>}
      </div>


      <div className="saas-tabs-header">
        <button 
          className={`saas-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button 
          className={`saas-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => {
            const newErrors = {};
            if (!form.title.trim()) newErrors.title = "Title is required";
            if (!form.projectName?.trim()) newErrors.projectName = "Project name is required";
            
            if (Object.keys(newErrors).length > 0) {
              setErrors(newErrors);
              // alert("Please fill in the required fields (Title, Project) first.");
            } else {
              setErrors({});
              setActiveTab('billing');
            }
          }}
        >

          Billing
        </button>
      </div>

      <div className="saas-main-container">
        <div className="saas-tab-content-wrapper">
          {activeTab === 'general' ? (
            <div className="saas-content-pane">
              <>



                <div className="saas-description-area">
                  <textarea 
                    className="saas-desc-input"
                    placeholder="Task description..."
                    value={form.description || ''}
                    onChange={e => set('description', e.target.value)}
                    readOnly={!canEdit}

                  />
                </div>


                <div className="saas-meta-grid">
                  <div className="saas-meta-row">
                    <div className="saas-meta-label">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle></svg>
                      Status
                    </div>
                    <div className="saas-meta-value">
                      <select 
                        className="saas-status-select"
                        value={form.status}
                        onChange={e => set('status', e.target.value)}
                        disabled={!canEdit}
                      >
                        {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                      </select>
                    </div>



                    <div className="saas-meta-label">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                      Priority
                    </div>
                    <div className="saas-meta-value">
                      <div className="saas-priority-select-wrapper">
                        <div className={`priority-dot dot-${form.priority.toLowerCase()}`}></div>
                        <select 
                          className="saas-inline-select"
                          value={form.priority}
                          onChange={e => set('priority', e.target.value)}
                          style={{ paddingLeft: '0.5rem' }}
                          disabled={!can('tasks', 'edit')}
                        >
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>

                      </div>
                    </div>
                  </div>

                  <div className="saas-meta-row">
                    <div className="saas-meta-label">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      Assignees
                    </div>
                    <div className="saas-meta-value">
                      {canEdit && (
                        <select 
                          className="saas-inline-select"
                          value=""
                          onChange={e => { if(e.target.value) handleAddAssignee(e.target.value); }}
                        >
                          <option value="">Select Assignee...</option>
                          {users.map(m => (
                            <option key={m} value={m} disabled={assigneesList.includes(m)}>{m}</option>
                          ))}
                        </select>
                      )}



                      <div className="saas-assignee-list" style={{ marginTop: '0.5rem' }}>
                        {assigneesList.map(a => (
                          <div key={a} className={`saas-avatar-sm ${getAvatarColor(a)}`} title={`${a}${canEdit ? ' (Click to remove)' : ''}`} onClick={() => canEdit && handleRemoveAssignee(a)}>

                            {initials(a)}
                          </div>
                        ))}
                      </div>


                    </div>
                  </div>

                  <div className="saas-meta-row">
                    <div className="saas-meta-label">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      Start Date
                    </div>
                    <div className="saas-meta-value">
                      <input 
                        type="date"
                        className="saas-inline-date-input"
                        value={form.startDate ? new Date(form.startDate).toISOString().split('T')[0] : ''}
                        onChange={e => set('startDate', e.target.value)}
                        readOnly={!canEdit}

                      />

                    </div>

                    <div className="saas-meta-label">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      End Date
                    </div>
                    <div className="saas-meta-value">
                      <input 
                        type="date"
                        className="saas-inline-date-input"
                        value={form.endDate ? new Date(form.endDate).toISOString().split('T')[0] : ''}
                        onChange={e => set('endDate', e.target.value)}
                        readOnly={!canEdit}

                      />

                    </div>
                  </div>

                  <div className="saas-meta-row">
                    <div className="saas-meta-label">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      Assigned Date
                    </div>
                    <div className="saas-meta-value">
                      <input 
                        type="date"
                        className="saas-inline-date-input"
                        value={form.assignedDate ? new Date(form.assignedDate).toISOString().split('T')[0] : ''}
                        onChange={e => set('assignedDate', e.target.value)}
                        readOnly={!canEdit}

                      />

                    </div>

                    <div className="saas-meta-label">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      Due Date
                    </div>
                    <div className="saas-meta-value">
                      <input 
                        type="date"
                        className="saas-inline-date-input"
                        value={form.dueDate ? new Date(form.dueDate).toISOString().split('T')[0] : ''}
                        onChange={e => set('dueDate', e.target.value)}
                        readOnly={!canEdit}

                      />

                    </div>
                  </div>
                  <div className="saas-meta-row">
                    <div className="saas-meta-label">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                      Task Type
                    </div>
                    <div className="saas-meta-value">
                      <select 
                        className="saas-inline-select"
                        value={form.taskType}
                        onChange={e => set('taskType', e.target.value)}
                        disabled={!canEdit}

                      >
                        <option value="Feature">Feature</option>
                        <option value="Bug">Bug</option>
                        <option value="Improvement">Improvement</option>
                        <option value="Research">Research</option>
                      </select>

                    </div>

                    <div className="saas-meta-label">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                      Project
                    </div>
                    <div className="saas-meta-value">
                      <input 
                        type="text" 
                        className={`saas-inline-text-input ${errors.projectName ? 'error' : ''}`}
                        placeholder="Project Name"
                        value={form.projectName}
                        onChange={e => set('projectName', e.target.value)}
                        readOnly={!canEdit}

                      />

                      {errors.projectName && <div className="error-text">{errors.projectName}</div>}
                    </div>
                  </div>


                  <div className="saas-meta-row full-width">
                    <div className="saas-meta-label">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                      Tags
                    </div>
                    <div className="saas-meta-value">
                      <input 
                        type="text" 
                        className="saas-inline-text-input"
                        placeholder="Engineering"
                        value={form.tag || ''}
                        onChange={e => set('tag', e.target.value)}
                        style={{ width: '100%' }}
                        readOnly={!canEdit}

                      />

                    </div>
                  </div>
                </div>

                <div className="saas-footer-actions" style={{ marginTop: '0.25rem', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                  {canEdit && (
                    <button className="saas-attach-btn-modern" onClick={() => fileInputRef.current.click()} disabled={uploading}>
                       <div className="attach-icon-wrapper">
                         <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                       </div>
                       <span>{uploading ? 'Uploading...' : 'Attach relevant files'}</span>
                    </button>
                  )}




                  {form.attachments && (
                    <div className="saas-attachment-list" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {form.attachments.split(',').map((url, idx) => (
                        <div key={idx} className="saas-attachment-tag" style={{ background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>
                             File {idx + 1}
                          </a>
                          {canEdit && (

                            <button onClick={() => {
                              const filtered = form.attachments.split(',').filter((_, i) => i !== idx).join(',');
                              set('attachments', filtered);
                            }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}>✕</button>
                          )}

                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </>
            </div>
          ) : (
            <div className="saas-content-pane">
              <div className="saas-billing-header">
                <h2>Billing Information</h2>
                <p>Configure task billability and tracking</p>
              </div>

              <div className="saas-billing-form">
                <div className="saas-field-group">
                  <label>Billable</label>
                  <div className="saas-toggle-group">
                    <button 
                      className={`saas-toggle-btn ${form.isBillable ? 'active' : ''}`}
                      onClick={() => canEdit && set('isBillable', true)}
                      disabled={!canEdit}

                    >
                      Yes
                    </button>
                    <button 
                      className={`saas-toggle-btn ${!form.isBillable ? 'active' : ''}`}
                      onClick={() => canEdit && set('isBillable', false)}
                      disabled={!canEdit}

                    >
                      No
                    </button>

                  </div>
                </div>

                {form.isBillable && (
                  <div className="saas-billing-fields-row animate-slide-down">
                    <div className="saas-field-group">
                      <label>Approved Hours</label>
                      <input 
                        type="number" 
                        className={`saas-billing-input ${errors.billing ? 'error' : ''}`}
                        placeholder="0.0"
                        value={form.approvedHours || ''}
                        onChange={e => set('approvedHours', parseFloat(e.target.value) || 0)}
                        readOnly={!canEdit}

                      />

                    </div>
                    <div className="saas-field-group">
                      <label>Actual Hours</label>
                      <input 
                        type="number" 
                        className={`saas-billing-input ${errors.billing ? 'error' : ''}`}
                        placeholder="0.0"
                        value={form.actualHours || ''}
                        onChange={e => set('actualHours', parseFloat(e.target.value) || 0)}
                        readOnly={!canEdit}

                      />

                    </div>
                    {errors.billing && <div className="error-text">{errors.billing}</div>}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

        {activeTab === 'general' && (
          <div className="saas-sidebar">
            <div className="saas-sidebar-header">
              <span className="saas-sidebar-title">Activity</span>
              <div className="saas-sidebar-tools">
                <button className="saas-tool-btn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></button>
                <button className="saas-tool-btn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg><span className="notif-badge">1</span></button>
                <button className="saas-tool-btn">⋮</button>
              </div>
            </div>

            <div className="saas-activity-feed">
               {commentTree.map(c => renderComment(c))}

            </div>

            <div className="saas-comment-input-box">
               <div className="saas-input-container">
                  <input 
                    className="saas-main-input"
                    placeholder="Comment, press 'space' for AI, '/' for commands"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                  />
                  <div className="saas-input-footer">
                     <div className="saas-input-tools">
                        <button className="saas-input-btn">+</button>
                        <button className="saas-input-btn">Comment ▾</button>
                        <button className="saas-input-btn">@</button>
                        <button className="saas-input-btn">📎</button>
                     </div>
                     <button className="saas-send-btn" onClick={() => handleAddComment()} disabled={!newComment.trim()}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                     </button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Task Card (Kanban) ─────────────────────────────────────
function TaskCard({ task, onDragStart, onClick, onDelete, currentUser }) {
  const { can, getLevel } = usePermissions();
  const pm = PRIORITY_META[task.priority] || PRIORITY_META['Medium'];
  const assignees = task.assignees ? task.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];

  return (
    <div
      className="task-card"
      draggable={true}
      onDragStart={e => onDragStart(e, task.id)}
      onClick={() => onClick(task)}
    >

      <div className="card-top">
        <span className={`card-tag tag-${task.tag?.toLowerCase() || 'engineering'}`}>{task.tag || 'Engineering'}</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && (currentUser?.fullName || currentUser?.name) && assignees.map(a => a.toLowerCase()).includes((currentUser?.fullName || currentUser?.name).toLowerCase()))) && (
            <button className="card-view-btn delete-icon" title="Delete Task" onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this task?')) onDelete(task.id); }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          )}

          <button className="card-view-btn" title="View Full Details">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          </button>
        </div>
      </div>


      <p className="card-title">{task.title}</p>
      
      <div className="card-bottom">
        <div className="card-avatars">
          {assignees.slice(0,3).map(a => {
            const avCls = getAvatarColor(a);
            return <div key={a} className={`card-avatar ${avCls}`} title={a}>{initials(a)}</div>;
          })}
          {assignees.length > 3 && <div className="card-avatar av-blue">+{assignees.length - 3}</div>}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="card-comment-indicator">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <span className={`card-priority ${pm.cls}`}>{task.priority}</span>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ──────────────────────────────────────────
function KanbanColumn({ col, tasks, onDragStart, onDrop, onDragOver, onDragLeave, isDragOver, onTaskClick, onDelete, currentUser }) {

  return (
    <div
      className={`kanban-col ${col.color} ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      <div className="col-header">
        <span className="col-label">{col.label}</span>
        <span className="col-count">{tasks.length}</span>
      </div>

      {isDragOver && <div className="drop-indicator">Drop here</div>}

      <div className="col-cards">
        {tasks.length === 0 && !isDragOver && (
          <div className="col-empty">No tasks yet.</div>
        )}
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onDragStart={onDragStart}
            onClick={onTaskClick}
            onDelete={onDelete}
            currentUser={currentUser}
          />
        ))}

      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════
//  MAIN TASKS COMPONENT
// ══════════════════════════════════════════════════════════
export default function Tasks({ user }) {
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [viewMode, setViewMode] = useState('list'); 
  const [subTab, setSubTab]     = useState('my'); 
  const [dragOver, setDragOver] = useState(null);
  
  const [view, setView] = useState('board'); // 'board' or 'detail'
  const [selectedTask, setSelectedTask] = useState(null);

  const dragId = useRef(null);
  const { can, getLevel } = usePermissions();

  // ── FETCH from API ──
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await api.get('/tasks');
      setTasks(data || []);
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  // ── Drag handlers ──────────────────────────────────────
  const handleDragStart = (e, id) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      document.getElementById(`task-${id}`)?.classList.add('dragging');
    }, 0);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(colId);
  };

  const handleDrop = async (e, colId) => {
    e.preventDefault();
    const id = dragId.current;
    if (id !== null) {
      setTasks(ts => ts.map(t => t.id === id ? { ...t, status: colId } : t));
      try {
        await api.put(`/tasks/${id}`, { status: colId });
      } catch (error) {
        console.error('Update error:', error);
        fetchTasks();
      }
    }
    dragId.current = null;
    setDragOver(null);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(null);
    }
  };

  const handleDragEnd = () => {
    dragId.current = null;
    setDragOver(null);
    document.querySelectorAll('.task-card').forEach(el => el.classList.remove('dragging'));
  };

  // ── INSERT/UPDATE ──
  const handleSaveTask = async (taskData) => {
    try {
      if (taskData.id) {
        await api.put(`/tasks/${taskData.id}`, taskData);
      } else {
        await api.post('/tasks', taskData);
      }
      fetchTasks();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save task: ' + error.message);
    }
  };

  // ── DELETE ──
  const handleDeleteTask = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      fetchTasks();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const openNewTask = () => {
    setSelectedTask(null);
    setView('detail');
  };

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setView('detail');
  };



  const filteredTasks = tasks.filter(t => {
    const level = getLevel('tasks', 'view');
    if (level === 'All' && subTab === 'all') return true;
    
    // Default to 'Self' or 'None'
    const assignees = t.assignees ? t.assignees.split(',').map(a => a.trim()) : [];
    return assignees.includes(user?.fullName || user?.name);
  });



  if (view === 'detail') {
    return (
      <TaskDetailView
        task={selectedTask}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onClose={() => setView('board')}
        currentUser={user}
      />

    );
  }

  return (
    <div className="kanban-root" onDragEnd={handleDragEnd}>
      {getLevel('tasks', 'view') === 'All' && (
        <div className="saas-tabs" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '2rem' }}>
          <button 
            className={`saas-tab ${subTab === 'my' ? 'active' : ''}`} 
            onClick={() => setSubTab('my')}
            style={{ 
              background: 'none', border: 'none', padding: '0.75rem 0', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem',
              color: subTab === 'my' ? '#2563eb' : '#64748b',
              borderBottom: subTab === 'my' ? '2px solid #2563eb' : '2px solid transparent'
            }}
          >
            My Tasks
          </button>
          <button 
            className={`saas-tab ${subTab === 'all' ? 'active' : ''}`} 
            onClick={() => setSubTab('all')}
            style={{ 
              background: 'none', border: 'none', padding: '0.75rem 0', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem',
              color: subTab === 'all' ? '#2563eb' : '#64748b',
              borderBottom: subTab === 'all' ? '2px solid #2563eb' : '2px solid transparent'
            }}
          >
            All Tasks
          </button>
        </div>
      )}



      {/* ── Header ── */}
      <div className="kanban-header">
        <div className="kanban-header-left">
          <h1 className="kanban-title">{subTab === 'my' ? 'My Assignments' : 'All Tasks'}</h1>
        </div>
        <div className="kanban-controls">
          <div className="view-toggle">
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>List</button>
            <button className={viewMode === 'kanban' ? 'active' : ''} onClick={() => setViewMode('kanban')}>Kanban</button>
          </div>
          {can('tasks', 'create') && (
            <button className="kanban-new-btn" onClick={openNewTask}>
              + New Task
            </button>
          )}


        </div>
      </div>



      {loading && <p>Loading tasks...</p>}

      {/* ── Views ── */}
      {!loading && viewMode === 'kanban' && (
        <div className="kanban-board">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              tasks={filteredTasks.filter(t => t.status === col.id)}
              onDragStart={handleDragStart}
              onDrop={e => handleDrop(e, col.id)}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              isDragOver={dragOver === col.id}
              onTaskClick={openTaskDetail}
              onDelete={handleDeleteTask}
              currentUser={user}
            />

          ))}
        </div>

      )}

      {!loading && viewMode === 'list' && (
        <div className="list-view">
          <table className="list-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Assignees</th>
                <th>Approved Hrs</th>
                <th>Actual Hrs</th>


                {(can('tasks', 'edit') || can('tasks', 'delete')) && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>



            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr><td colSpan="6" style={{textAlign:'center'}}>No tasks found.</td></tr>
              ) : (
                filteredTasks.map(task => {
                  const pm = PRIORITY_META[task.priority] || PRIORITY_META['Medium'];
                  return (
                    <tr key={task.id} onClick={() => openTaskDetail(task)}>
                      <td style={{ fontWeight: 600 }}>{task.title}</td>
                      <td>{task.status}</td>
                      <td><span className={`card-priority ${pm.cls}`} style={{display:'inline-block'}}>{task.priority}</span></td>
                      <td>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}</td>
                      <td>{task.assignees || '-'}</td>
                      <td>{task.approvedHours || 0}</td>
                      <td>{task.actualHours || 0}</td>

                      {(can('tasks', 'edit') || can('tasks', 'delete')) && (
                        <td style={{ textAlign: 'right' }}>
                          {(getLevel('tasks', 'edit') === 'All' || (getLevel('tasks', 'edit') === 'Self' && (user?.fullName || user?.name) && (task.assignees || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase()))) && (
                            <button className="list-edit-btn" onClick={(e) => { e.stopPropagation(); openTaskDetail(task); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginRight: '0.5rem' }} title="Edit Task">
                               <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                          )}
                          {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && (user?.fullName || user?.name) && (task.assignees || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase()))) && (
                            <button className="list-delete-btn" onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this task?')) handleDeleteTask(task.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Delete Task">
                               <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          )}
                        </td>
                      )}


                    </tr>


                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
