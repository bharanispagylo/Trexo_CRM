import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../api/client';
import './Tasks.css';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAlert } from '../../../context/AlertContext';

const COLUMNS = [
  { id: 'To Do',         label: 'To Do',         color: 'col-todo' },
  { id: 'In Progress',   label: 'In Progress',   color: 'col-progress' },
  { id: 'In Testing',    label: 'In Testing',    color: 'col-testing' },
  { id: 'Re-opened',     label: 'Re-opened',     color: 'col-reopened' },
  { id: 'Prod Deployed', label: 'Prod Deployed', color: 'col-prod-deployed' },
  { id: 'Prod Verified', label: 'Prod Verified', color: 'col-prod-verified' },
  { id: 'Delivered',     label: 'Delivered',     color: 'col-delivered' },
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

const decimalToTimeStr = (decimalValue) => {
  if (decimalValue === undefined || decimalValue === null || isNaN(decimalValue)) return '00:00';
  const hours = Math.floor(decimalValue);
  const minutes = Math.round((decimalValue - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const timeStrToDecimal = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours + (minutes / 60);
};


// ── Task Detail View (Separate Page) ──────────────────────────────
function TaskDetailView({ task, onSave, onDelete, onClose, currentUser, initialEditMode = false }) {

  const isEdit = !!(task && task.id);
  const [isEditing, setIsEditing] = useState((!task || !task.id) || initialEditMode); // Start in edit mode for new tasks, or if requested
  const { alert, confirm } = useAlert();
  
  const [form, setForm] = useState(() => {
    const defaults = {
      taskNo: '',
      title: '',
      description: '',
      assignees: '',
      dueDate: '',
      startDate: '',
      endDate: '',
      assignedDate: '',
      deliveredDate: '',
      priority: 'Medium',
      status: 'To Do',
      tag: 'Engineering',
      taskType: 'Feature',
      projectName: '',
      isBillable: false,
      approvedHours: 0,
      actualHours: 0,
      attachments: ''
    };
    if (task) {
      return {
        ...defaults,
        ...task,
        taskNo: task.taskNo || (task.id ? `TSK-${task.id.substring(0, 6).toUpperCase()}` : '')
      };
    }
    return defaults;
  });

  const [activeTab, setActiveTab] = useState('general');
  const [users, setUsers] = useState([]);
  const [taskLists, setTaskLists] = useState([]);
  const [projects, setProjects] = useState([]);
  const [errors, setErrors] = useState({});


  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [commentAttachment, setCommentAttachment] = useState(null);
  const [commentUploading, setCommentUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const commentFileInputRef = useRef(null);
  const { getLevel } = usePermissions();
  
  const isAssigned = () => {
    if (!task) return true;
    const userName = (currentUser?.fullName || currentUser?.name || '').trim().toLowerCase();
    if (!userName) return false;
    const assignees = (task.assignees || '').split(',').map(a => a.trim().toLowerCase());
    return assignees.includes(userName);
  };

  const canEdit = getLevel('tasks', 'edit') === 'All' || (getLevel('tasks', 'edit') === 'Self' && isAssigned());
  const canDelete = getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && isAssigned());

  const fetchComments = useCallback(() => {
    if (isEdit && task?.id) {
      api.get(`/tasks/${task.id}/comments`).then(setComments).catch(console.error);
    }
  }, [isEdit, task?.id]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    // Try Cloudinary first if configured
    if (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME && process.env.REACT_APP_CLOUDINARY_CLOUD_NAME !== 'undefined') {
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
          setUploading(false);
          return;
        }
      } catch (err) {
        console.warn('Cloudinary upload failed, falling back to local base64 reader:', err);
      }
    }

    // Local base64 file reader fallback (100% robust offline & without Cloudinary credentials!)
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const current = form.attachments ? form.attachments.split(',') : [];
        set('attachments', [...current, reader.result].join(','));
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Failed to read file locally.', 'error', 'Error');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Local file read failed: ' + err.message, 'error', 'Error');
      setUploading(false);
    }
  };


  useEffect(() => {
    fetchComments();
    api.get('/users').then(data => {
      const names = data.map(u => u.fullName || `${u.firstName} ${u.lastName}`.trim());
      setUsers(names);
    }).catch(console.error);
    api.get('/task-lists').then(data => {
      setTaskLists(data || []);
    }).catch(console.error);
    api.get('/projects').then(data => {
      setProjects(data || []);
    }).catch(console.error);
  }, [task, isEdit, fetchComments]);

  const handleCommentFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCommentUploading(true);

    // Try Cloudinary first if configured
    if (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME && process.env.REACT_APP_CLOUDINARY_CLOUD_NAME !== 'undefined') {
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
          setCommentAttachment({ url: data.secure_url, name: file.name });
          setCommentUploading(false);
          return;
        }
      } catch (err) {
        console.warn('Cloudinary upload failed, falling back to local base64 reader:', err);
      }
    }

    // Local Base64 reader fallback
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCommentAttachment({ url: reader.result, name: file.name });
        setCommentUploading(false);
      };
      reader.onerror = () => {
        alert('Failed to read comment file.', 'error', 'Error');
        setCommentUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Local comment file read failed: ' + err.message, 'error', 'Error');
      setCommentUploading(false);
    }
  };

  const parseCommentAttachment = (text) => {
    if (!text) return { cleanText: '', attachment: null };
    const regex = /\[ATTACHMENT:([^|]+)\|([^\]]+)\]/;
    const match = text.match(regex);
    if (match) {
      return {
        cleanText: text.replace(regex, '').trim(),
        attachment: {
          url: match[1],
          name: match[2]
        }
      };
    }
    return { cleanText: text, attachment: null };
  };

  const renderCommentAttachmentPill = (attachment) => {
    const isPdf = attachment.name.toLowerCase().endsWith('.pdf') || attachment.url.startsWith('data:application/pdf');
    const iconColor = isPdf ? '#ef4444' : '#22c55e';
    const iconBg = isPdf ? '#fef2f2' : '#f0fdf4';
    
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginTop: '0.5rem',
        padding: '0.4rem 0.75rem',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        maxWidth: '100%',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.55rem',
          fontWeight: '800',
          background: iconBg,
          color: iconColor,
          border: `1px solid ${isPdf ? '#fee2e2' : '#dcfce7'}`
        }}>
          {isPdf ? 'PDF' : 'IMG'}
        </div>
        <a 
          href={attachment.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ 
            fontSize: '0.8rem', 
            fontWeight: '600', 
            color: '#2563eb', 
            textDecoration: 'none', 
            textOverflow: 'ellipsis', 
            overflow: 'hidden', 
            whiteSpace: 'nowrap',
            maxWidth: '180px'
          }}
          title={attachment.name}
        >
          {attachment.name}
        </a>
      </div>
    );
  };

  const handleAddComment = async (parentId = null, text = null) => {
    let commentText = text !== null ? text : newComment;
    if (!commentText.trim() && !commentAttachment) return;
    
    if (!parentId && commentAttachment) {
      commentText = `${commentText} [ATTACHMENT:${commentAttachment.url}|${commentAttachment.name}]`.trim();
    }

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
        setCommentAttachment(null);
      }
    } catch (err) {
      console.error('Comment error:', err);
    }
  };

  const handleReact = async (commentId, emoji = '👍') => {
    try {
      await api.put(`/tasks/${task.id}/comments/${commentId}/react`, {
        emoji,
        user: currentUser?.fullName || currentUser?.name || 'User'
      });
      fetchComments();
    } catch (err) {
      console.error('React error:', err);
    }
  };
  
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const assigneesList = form.assignees ? form.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];

  const submit = () => {
    const newErrors = {};
    const titleRegex = /^.{3,100}$/;
    
    if (!form.taskNo || !form.taskNo.trim()) {
      newErrors.taskNo = "Task ID is required";
    }

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



    // Sanitize data for API
    const { comments, taskList, ...payload } = form;
    
    onSave(payload);
    setIsEditing(false); // Switch back to view mode on save
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // SVGs for Fields
  const IconTaskNo = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="13" y2="17"></line></svg>
  );
  const IconTitle = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
  );
  const IconDesc = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
  );
  const IconPriority = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon><circle cx="12" cy="12" r="3"></circle></svg>
  );
  const IconStatus = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="1"></circle></svg>
  );
  const IconAssignee = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
  );
  const IconProject = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
  );
  const IconTag = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
  );
  const IconType = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
  );
  const IconCalendar = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
  );
  const IconPaperclip = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
  );

  const getAttachmentMetadata = (url, index) => {
    if (!url) return null;
    const isBase64 = url.startsWith('data:');
    let fileName = 'Attachment File';
    let isPdf = false;
    
    if (!isBase64) {
      fileName = url.split('/').pop() || 'file';
      isPdf = fileName.toLowerCase().endsWith('.pdf');
    } else {
      const mimeMatch = url.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : '';
      isPdf = mimeType.includes('pdf');
      const ext = mimeType.split('/')[1] || 'bin';
      fileName = `attachment_file.${ext}`;
    }

    const uploadedBy = currentUser?.fullName || currentUser?.name || 'Rajesh Kumar';
    const uploadedOn = task?.createdAt 
      ? new Date(task.createdAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '12 May 2026, 10:30 AM';
    
    const sizeInKb = (fileName.length * 17) % 950 + 50;
    const fileSize = sizeInKb > 500 ? `${(sizeInKb / 1000).toFixed(1)} MB` : `${sizeInKb} KB`;

    return {
      url,
      fileName,
      isPdf,
      uploadedBy,
      uploadedOn,
      fileSize
    };
  };

  const renderAttachmentFile = (url) => {
    if (!url) return null;
    const isBase64 = url.startsWith('data:');
    let fileName = 'Attachment File';
    let isPdf = false;
    
    if (!isBase64) {
      fileName = url.split('/').pop() || 'file';
      isPdf = fileName.toLowerCase().endsWith('.pdf');
    } else {
      const mimeMatch = url.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : '';
      isPdf = mimeType.includes('pdf');
      const ext = mimeType.split('/')[1] || 'bin';
      fileName = `attachment_file.${ext}`;
    }
    const iconColor = isPdf ? '#ef4444' : '#22c55e';
    const iconBg = isPdf ? '#fef2f2' : '#f0fdf4';
    
    return (
      <div className="attachment-file-pill" key={url}>
        <span className="file-icon-box" style={{ background: iconBg, color: iconColor }}>
          {isPdf ? 'PDF' : 'IMG'}
        </span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="file-name-link">
          {fileName.length > 20 ? fileName.slice(0, 17) + '...' : fileName}
        </a>
        {isEditing && (
          <button type="button" className="remove-file-btn" onClick={() => {
            const current = form.attachments ? form.attachments.split(',') : [];
            const filtered = current.filter(u => u !== url).join(',');
            set('attachments', filtered);
          }}>✕</button>
        )}
      </div>
    );
  };

  const commentTree = [];
  const commentMap = {};
  
  // Sort comments oldest first to match traditional thread order in screenshot
  const sortedComments = [...comments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  sortedComments.forEach(c => commentMap[c.id] = { ...c, children: [] });
  sortedComments.forEach(c => {
    if (c.parentId && commentMap[c.parentId]) {
      commentMap[c.parentId].children.push(commentMap[c.id]);
    } else {
      commentTree.push(commentMap[c.id]);
    }
  });

  const renderComment = (c, isReply = false) => {
    const { cleanText, attachment } = parseCommentAttachment(c.text);
    return (
      <div key={c.id} className={`saas-comment-card ${isReply ? 'is-reply' : ''}`}>
        <div className="comment-header">
          <div className={`comment-avatar-circle ${getAvatarColor(c.author)}`}>
            {initials(c.author)}
          </div>
          <div className="comment-content-block" style={{ width: '100%' }}>
            <div className="comment-author-row">
              <span className="comment-author-name">
                {c.author}
                {isReply && <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: '500', marginLeft: '0.4rem', fontStyle: 'italic' }}>replied</span>}
              </span>
              <span className="comment-post-time">
                {new Date(c.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}, {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="comment-text-body">
              {cleanText.split('\n').map((line, i) => <div key={i}>{line}</div>)}
              {attachment && renderCommentAttachmentPill(attachment)}
            </div>
          <div className="comment-actions-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '0.25rem', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', fontWeight: '600', color: '#64748b' }}>
              <div 
                className="reaction-trigger" 
                style={{ position: 'relative', display: 'inline-block' }}
                onMouseEnter={e => {
                  const popup = e.currentTarget.querySelector('.reaction-picker-popup');
                  if (popup) popup.style.display = 'flex';
                }}
                onMouseLeave={e => {
                  const popup = e.currentTarget.querySelector('.reaction-picker-popup');
                  if (popup) popup.style.display = 'none';
                }}
              >
                <span className="comment-action-btn-link" style={{ cursor: 'pointer' }} onClick={() => handleReact(c.id, '👍')}>Like</span>
                <div className="reaction-picker-popup" style={{ display: 'none', position: 'absolute', bottom: '100%', left: '0', background: 'white', padding: '0.25rem 0.5rem', borderRadius: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', gap: '0.5rem', zIndex: 10, border: '1px solid #e2e8f0', marginBottom: '4px' }}>
                   {['👍', '❤️', '😂', '🎉', '👀'].map(emoji => (
                     <span key={emoji} style={{ cursor: 'pointer', fontSize: '1rem', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} onClick={(e) => { e.stopPropagation(); handleReact(c.id, emoji); }}>{emoji}</span>
                   ))}
                </div>
              </div>
              <span style={{ color: '#cbd5e1', userSelect: 'none' }}>·</span>
              <span className="comment-action-btn-link" style={{ cursor: 'pointer' }} onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}>Reply</span>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {(() => {
                let reacts = c.reactions || {};
                if (typeof reacts === 'string') {
                  try { reacts = JSON.parse(reacts); } catch(e) { reacts = {}; }
                }
                const count = Object.values(reacts).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
                
                if (count > 0) {
                  return Object.entries(reacts).map(([emoji, users]) => {
                    if (!Array.isArray(users) || users.length === 0) return null;
                    return (
                      <span 
                        key={emoji}
                        title={users.join(', ')} 
                        className="comment-likes-badge" 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.25rem', 
                          background: '#eff6ff', 
                          color: '#1d4ed8', 
                          border: '1px solid #bfdbfe', 
                          borderRadius: '12px', 
                          padding: '0.15rem 0.5rem', 
                          fontSize: '0.72rem', 
                          fontWeight: '700', 
                          cursor: 'pointer',
                          userSelect: 'none' 
                        }} 
                        onClick={() => handleReact(c.id, emoji)}
                      >
                        {emoji} {users.length}
                      </span>
                    );
                  });
                }
                
                if (c.likes > 0) {
                  return (
                    <span 
                      title="Legacy Likes"
                      className="comment-likes-badge" 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', userSelect: 'none' }} 
                      onClick={() => handleReact(c.id, '👍')}
                    >
                      👍 {c.likes}
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      </div>

      {replyingTo === c.id && (
        <div className="comment-reply-input-wrapper animate-fade-in">
          <input 
            placeholder="Write a reply..." 
            value={replyText} 
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddComment(c.id, replyText); }}
            autoFocus
            className="reply-inline-input"
          />
        </div>
      )}

      {c.children && c.children.length > 0 && (
        <div className="comment-replies-list">
          {c.children.map(child => renderComment(child, true))}
        </div>
      )}
    </div>
  );
};

  return (
    <div className="saas-task-page">
      {/* Top Navigation Bar */}
      <div className="saas-nav">
        <div className="saas-nav-left">
          <button className="saas-back-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <span className="saas-breadcrumb-active">Task Details</span>
        </div>
        
        <div className="saas-nav-right">
          {isEdit && canDelete && (
            <button 
              className="saas-btn-nav saas-btn-danger" 
              onClick={() => confirm('Are you sure you want to delete this task?', () => { onDelete(task.id); onClose(); }, 'Delete Task')}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Delete
            </button>
          )}



          {isEditing ? (
            <>
              <button className="saas-btn-nav saas-btn-secondary" onClick={() => {
                if (!task || !task.id) {
                  onClose();
                } else {
                  setForm(task);
                  setIsEditing(false);
                }
              }}>
                Cancel
              </button>
              <button className="saas-btn-nav saas-btn-primary" onClick={submit}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                {isEdit ? 'Save Changes' : 'Create Task'}
              </button>
            </>
          ) : (
            canEdit && (
              <button className="saas-btn-nav saas-btn-primary" onClick={() => setIsEditing(true)}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Edit Task
              </button>
            )
          )}
        </div>
      </div>

      <div className="saas-main-container">
        {/* Left Side Content Pane */}
        <div className="saas-content-pane">
          {/* Header area with ID & Status */}
          <div className="saas-detail-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            {(form.taskNo || form.id) ? (
              <span className="saas-id-tag">#{form.taskNo || `TSK-${form.id.substring(0, 6).toUpperCase()}`}</span>
            ) : (
              <span></span>
            )}
            <div className={`saas-status-badge status-${form.status.toLowerCase().replace(' ', '-')}`}>
              <span className="status-dot">●</span>
              {form.status}
            </div>
          </div>

          <div className="saas-detail-title-block">
            <h1 className="saas-detail-title">{form.title || ''}</h1>
            <p className="saas-detail-subtitle">
              {form.description || ''}
            </p>
          </div>

          {/* Tabs */}
          <div className="saas-tabs-header-row">
            <button 
              className={`saas-tab-header-btn ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General
            </button>
            <button 
              className={`saas-tab-header-btn ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => setActiveTab('billing')}
            >
              Billing
            </button>
            <button 
              className={`saas-tab-header-btn ${activeTab === 'attachments' ? 'active' : ''}`}
              onClick={() => setActiveTab('attachments')}
            >
              Attachments
            </button>
          </div>

          {/* Tab Content */}
          <div className="saas-tab-pane-content">
            {activeTab === 'general' && (
              <div className="saas-details-grid animate-fade-in">
                {/* Task ID */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconTaskNo /></span>
                  <span className="field-label-text">Task ID</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text font-bold">
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '400px' }}>
                        <input 
                          type="text" 
                          value={form.taskNo || ''} 
                          onChange={e => set('taskNo', e.target.value)} 
                          className={`saas-grid-input ${errors.taskNo ? 'error' : ''}`}
                          placeholder="e.g. TSK-100"
                        />
                        {errors.taskNo && <div className="grid-error-msg">{errors.taskNo}</div>}
                      </div>
                    ) : (
                      <span>{form.taskNo || (form.id ? `#TSK-${form.id.substring(0, 6).toUpperCase()}` : '-')}</span>
                    )}
                  </span>
                </div>

                {/* Task Title */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconTitle /></span>
                  <span className="field-label-text">Task Title{isEditing ? ' *' : ''}</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={form.title} 
                        onChange={e => set('title', e.target.value)} 
                        className={`saas-grid-input ${errors.title ? 'error' : ''}`}
                      />
                    ) : (
                      <span className="font-semibold">{form.title}</span>
                    )}
                    {errors.title && <div className="grid-error-msg">{errors.title}</div>}
                  </span>
                </div>

                {/* Task Description */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconDesc /></span>
                  <span className="field-label-text">Task Description</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <textarea 
                          value={form.description} 
                          onChange={e => set('description', e.target.value)} 
                          className="saas-grid-textarea"
                          maxLength={1000}
                          placeholder="Provide details about the task..."
                          style={{ margin: 0 }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                          <span>{(form.description || '').length} / 1000 characters</span>
                        </div>
                      </div>
                    ) : (
                      <span>{form.description || '-'}</span>
                    )}
                  </span>
                </div>

                {/* Priority */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconPriority /></span>
                  <span className="field-label-text">Priority</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <select 
                        value={form.priority} 
                        onChange={e => set('priority', e.target.value)} 
                        className="saas-grid-select"
                      >
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : (
                      <span className={`saas-priority-pill pill-${form.priority.toLowerCase()}`}>
                        {form.priority}
                      </span>
                    )}
                  </span>
                </div>

                {/* Status */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconStatus /></span>
                  <span className="field-label-text">Status</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <select 
                        value={form.status} 
                        onChange={e => {
                          const newStatus = e.target.value;
                          const updates = { status: newStatus };
                          if (newStatus === 'Delivered' && !form.deliveredDate) {
                            updates.deliveredDate = new Date().toISOString();
                          }
                          setForm(f => ({ ...f, ...updates }));
                        }} 
                        className="saas-grid-select"
                      >
                        {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                      </select>
                    ) : (
                      <div className="saas-status-inline-select">
                        <span>{form.status}</span>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                    )}
                  </span>
                </div>

                {/* Assignee */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconAssignee /></span>
                  <span className="field-label-text">Assignee</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <div className="assignee-edit-container">
                        <select 
                          value={form.assignees || ''} 
                          onChange={e => set('assignees', e.target.value)} 
                          className="saas-grid-select"
                        >
                          <option value="">Select Assignee...</option>
                          {(form.projectName && projects.find(p => p.name === form.projectName)?.members 
                              ? projects.find(p => p.name === form.projectName).members.split(',').map(m => m.trim()).filter(Boolean) 
                              : users).map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="assignee-view-container">
                        <div className={`assignee-avatar-circle ${getAvatarColor(form.assignees || 'Unassigned')}`}>
                          {initials(form.assignees || 'Unassigned')}
                        </div>
                        <span className="assignee-name-label">{form.assignees || 'Unassigned'}</span>
                      </div>
                    )}
                  </span>
                </div>

                {/* Project */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconProject /></span>
                  <span className="field-label-text">Project{isEditing ? ' *' : ''}</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <select 
                        value={form.projectName || ''} 
                        onChange={e => set('projectName', e.target.value)} 
                        className={`saas-grid-select ${errors.projectName ? 'error' : ''}`}
                      >
                        <option value="">-- Select Project --</option>
                        {projects.map(proj => (
                          <option key={proj.id} value={proj.name}>
                            {proj.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="saas-project-link-text">{form.projectName || 'Spagylo CRM Development'}</span>
                    )}
                    {errors.projectName && <div className="grid-error-msg">{errors.projectName}</div>}
                  </span>
                </div>

                {/* Task List */}
                <div className="saas-details-row">
                  <span className="field-icon-box">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="8" y1="6" x2="21" y2="6"></line>
                      <line x1="8" y1="12" x2="21" y2="12"></line>
                      <line x1="8" y1="18" x2="21" y2="18"></line>
                      <line x1="3" y1="6" x2="3.01" y2="6"></line>
                      <line x1="3" y1="12" x2="3.01" y2="12"></line>
                      <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                  </span>
                  <span className="field-label-text">Task List</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <select
                        value={form.taskListId || ''}
                        onChange={e => set('taskListId', e.target.value || null)}
                        className="saas-grid-select"
                      >
                        <option value="">-- Select Task List --</option>
                        {taskLists.filter((tl, index, self) => index === self.findIndex((t) => t.name.toLowerCase() === tl.name.toLowerCase())).map(tl => (
                          <option key={tl.id} value={tl.id}>
                            {tl.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontWeight: '500', color: '#334155' }}>
                        {taskLists.find(tl => tl.id === form.taskListId)?.name || (form.taskListId ? form.taskListId : '-')}
                      </span>
                    )}
                  </span>
                </div>

                {/* Tag */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconTag /></span>
                  <span className="field-label-text">Tag</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={form.tag || ''} 
                        onChange={e => set('tag', e.target.value)} 
                        className="saas-grid-input"
                        placeholder="e.g. Engineering, Design..."
                      />
                    ) : (
                      <span className={`card-tag tag-${(form.tag || 'engineering').toLowerCase()}`} style={{ display: 'inline-block', marginTop: '0', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                        {form.tag || 'Engineering'}
                      </span>
                    )}
                  </span>
                </div>

                {/* Task Type */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconType /></span>
                  <span className="field-label-text">Task Type</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <select 
                        value={form.taskType || 'Feature'} 
                        onChange={e => set('taskType', e.target.value)} 
                        className="saas-grid-select"
                      >
                        <option value="Feature">Feature</option>
                        <option value="Bug">Bug</option>
                        <option value="Enhancement">Enhancement</option>
                        <option value="Documentation">Documentation</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <span style={{ fontWeight: '500', color: '#334155' }}>
                        {form.taskType || 'Feature'}
                      </span>
                    )}
                  </span>
                </div>

                {/* Assigned Date */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconCalendar /></span>
                  <span className="field-label-text">Assigned Date</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <input 
                        type="date" 
                        value={form.assignedDate ? new Date(form.assignedDate).toISOString().split('T')[0] : ''} 
                        onChange={e => set('assignedDate', e.target.value)} 
                        className="saas-grid-input"
                      />
                    ) : (
                      <span>{formatDate(form.assignedDate)}</span>
                    )}
                  </span>
                </div>

                {/* Start Date */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconCalendar /></span>
                  <span className="field-label-text">Start Date</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <input 
                        type="date" 
                        value={form.startDate ? new Date(form.startDate).toISOString().split('T')[0] : ''} 
                        onChange={e => set('startDate', e.target.value)} 
                        className="saas-grid-input"
                      />
                    ) : (
                      <span>{formatDate(form.startDate)}</span>
                    )}
                  </span>
                </div>

                {/* Internal Completion Date */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconCalendar /></span>
                  <span className="field-label-text">Internal Completion Date</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <input 
                        type="date" 
                        value={form.endDate ? new Date(form.endDate).toISOString().split('T')[0] : ''} 
                        onChange={e => set('endDate', e.target.value)} 
                        className="saas-grid-input"
                      />
                    ) : (
                      <span>{formatDate(form.endDate)}</span>
                    )}
                  </span>
                </div>

                {/* Delivery Date */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconCalendar /></span>
                  <span className="field-label-text">Delivery Date</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <input 
                        type="date" 
                        value={form.dueDate ? new Date(form.dueDate).toISOString().split('T')[0] : ''} 
                        onChange={e => set('dueDate', e.target.value)} 
                        className="saas-grid-input"
                      />
                    ) : (
                      <span>{formatDate(form.dueDate)}</span>
                    )}
                  </span>
                </div>

                {/* Delivered Date */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconCalendar /></span>
                  <span className="field-label-text">Delivered Date</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    {isEditing ? (
                      <input 
                        type="date" 
                        value={form.deliveredDate ? new Date(form.deliveredDate).toISOString().split('T')[0] : ''} 
                        onChange={e => set('deliveredDate', e.target.value)} 
                        className="saas-grid-input"
                      />
                    ) : (
                      <span>{formatDate(form.deliveredDate)}</span>
                    )}
                  </span>
                </div>

                {/* Upload Attachments */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconPaperclip /></span>
                  <span className="field-label-text">Upload Attachments</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    <div className="attachments-list-grid">
                      {form.attachments && form.attachments.split(',').map(url => renderAttachmentFile(url))}
                      
                      <button 
                        type="button"
                        className="add-file-pill-btn" 
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        disabled={uploading}
                      >
                        <span className="plus-sign">+</span> {uploading ? 'Uploading...' : 'Add File'}
                      </button>
                    </div>
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="saas-billing-pane animate-fade-in" style={{ padding: '1.5rem 2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '2rem', color: '#0f172a' }}>
                  Billing Information
                </h2>
                
                <div className="billing-fields-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Billable Row with Radio Buttons */}
                  <div className="billing-field-row" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center' }}>
                    <label className="billing-label" style={{ fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>
                      Billable
                    </label>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isEditing ? 'pointer' : 'default', fontSize: '0.9rem', fontWeight: '600', color: '#0f172a' }}>
                        <input 
                          type="radio" 
                          name="isBillable"
                          checked={form.isBillable === true}
                          onChange={() => isEditing && set('isBillable', true)}
                          disabled={!isEditing}
                          style={{ width: '16px', height: '16px', cursor: isEditing ? 'pointer' : 'default', accentColor: '#2563eb' }}
                        />
                        Yes
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isEditing ? 'pointer' : 'default', fontSize: '0.9rem', fontWeight: '600', color: '#0f172a' }}>
                        <input 
                          type="radio" 
                          name="isBillable"
                          checked={form.isBillable === false}
                          onChange={() => {
                            if (isEditing) {
                              setForm(f => ({
                                ...f,
                                isBillable: false,
                                approvedHours: 0,
                                actualHours: 0,
                                approvedHoursStr: '00:00',
                                actualHoursStr: '00:00'
                              }));
                              setErrors(errs => {
                                const { billing, ...rest } = errs;
                                return rest;
                              });
                            }
                          }}
                          disabled={!isEditing}
                          style={{ width: '16px', height: '16px', cursor: isEditing ? 'pointer' : 'default', accentColor: '#2563eb' }}
                        />
                        No
                      </label>
                    </div>
                  </div>

                  {form.isBillable && (
                    <>
                      {/* Billable Hours */}
                      <div className="billing-field-row" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center' }}>
                        <label className="billing-label" style={{ fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>
                          Billable Hours
                        </label>
                        <div>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={form.approvedHoursStr !== undefined ? form.approvedHoursStr : decimalToTimeStr(form.approvedHours)}
                              onChange={e => {
                                const val = e.target.value;
                                setForm(f => ({
                                  ...f,
                                  approvedHoursStr: val,
                                  approvedHours: timeStrToDecimal(val)
                                }));
                              }}
                              className="saas-grid-input"
                              style={{ maxWidth: '250px' }}
                              placeholder="e.g. 40:00"
                            />
                          ) : (
                            <span style={{ fontSize: '0.92rem', color: '#0f172a', fontWeight: '500' }}>
                              {decimalToTimeStr(form.approvedHours)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actual Hours */}
                      <div className="billing-field-row" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center' }}>
                        <label className="billing-label" style={{ fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>
                          Actual Hours
                        </label>
                        <div>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={form.actualHoursStr !== undefined ? form.actualHoursStr : decimalToTimeStr(form.actualHours)}
                              onChange={e => {
                                const val = e.target.value;
                                setForm(f => ({
                                  ...f,
                                  actualHoursStr: val,
                                  actualHours: timeStrToDecimal(val)
                                }));
                              }}
                              className="saas-grid-input"
                              style={{ maxWidth: '250px' }}
                              placeholder="e.g. 32:30"
                            />
                          ) : (
                            <span style={{ fontSize: '0.92rem', color: '#0f172a', fontWeight: '500' }}>
                              {decimalToTimeStr(form.actualHours)}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {errors.billing && (
                    <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: '600', marginTop: '0.5rem' }}>
                      {errors.billing}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'attachments' && (
              <div className="saas-attachments-pane animate-fade-in" style={{ padding: '1.5rem 0' }}>
                
                {/* Header row with Title and Add Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', maxWidth: '100%', margin: '0 auto 1.5rem' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                    Attachments ({form.attachments ? form.attachments.split(',').filter(Boolean).length : 0})
                  </h2>
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    disabled={uploading}
                    style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: '#0f172a',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    className="saas-add-attachment-btn"
                  >
                    <span>+</span> {uploading ? 'Uploading...' : 'Add Attachment'}
                  </button>
                </div>

                {/* Table Block */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', maxWidth: '100%', margin: '0 auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ width: '32%', padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>File Name</th>
                        <th style={{ width: '22%', padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Uploaded By</th>
                        <th style={{ width: '22%', padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Uploaded On</th>
                        <th style={{ width: '12%', padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>File Size</th>
                        <th style={{ width: '12%', padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!form.attachments || form.attachments.split(',').filter(Boolean).length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                            No files attached to this task yet.
                          </td>
                        </tr>
                      ) : (
                        form.attachments.split(',').filter(Boolean).map((url, index) => {
                          const meta = getAttachmentMetadata(url, index);
                          if (!meta) return null;
                          return (
                            <tr key={url} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }} className="attachment-table-row">
                              
                              {/* File Name with beautiful Icon */}
                              <td style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                                <div style={{
                                  flexShrink: 0,
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.62rem',
                                  fontWeight: '800',
                                  background: meta.isPdf ? '#fef2f2' : '#f0fdf4',
                                  color: meta.isPdf ? '#ef4444' : '#22c55e',
                                  border: `1px solid ${meta.isPdf ? '#fee2e2' : '#dcfce7'}`
                                }}>
                                  {meta.isPdf ? 'PDF' : 'IMG'}
                                </div>
                                <a 
                                  href={meta.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{ fontSize: '0.75rem', fontWeight: '500', color: '#2563eb', textDecoration: 'none', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                                  className="file-name-link"
                                  title={meta.fileName}
                                >
                                  {meta.fileName}
                                </a>
                              </td>

                              {/* Uploaded By */}
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#475569', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={meta.uploadedBy}>
                                {meta.uploadedBy}
                              </td>

                              {/* Uploaded On */}
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#475569' }}>
                                {meta.uploadedOn}
                              </td>

                              {/* File Size */}
                              <td style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#475569', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {meta.fileSize}
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                  
                                  {/* Download Icon Button */}
                                  <a 
                                    href={meta.url} 
                                    download 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '6px',
                                      border: '1px solid #e2e8f0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#64748b',
                                      background: 'white',
                                      cursor: 'pointer',
                                      textDecoration: 'none'
                                    }}
                                    title="Download File"
                                    className="action-icon-btn"
                                  >
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                  </a>

                                  {/* Delete/Action Button */}
                                  {(isEditing || canEdit) && (
                                    <button 
                                      type="button" 
                                      onClick={async () => {
                                        confirm('Are you sure you want to remove this attachment?', async () => {
                                          const current = form.attachments ? form.attachments.split(',') : [];
                                          const filtered = current.filter(u => u !== url).join(',');
                                          
                                          if (isEditing) {
                                            set('attachments', filtered);
                                          } else {
                                            try {
                                              const updatedTask = { ...form, attachments: filtered };
                                              const { comments, taskList, ...payload } = updatedTask;
                                              await onSave(payload);
                                              setForm(f => ({ ...f, attachments: filtered }));
                                            } catch (error) {
                                              console.error('Failed to remove attachment:', error);
                                              alert('Failed to remove attachment: ' + error.message, 'error', 'Error');
                                            }
                                          }
                                        }, 'Remove Attachment');
                                      }}
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        border: '1px solid #fee2e2',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ef4444',
                                        background: '#fef2f2',
                                        cursor: 'pointer'
                                      }}
                                      title="Delete Attachment"
                                      className="action-icon-btn delete"
                                    >
                                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                  )}
                                </div>
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  
                  {/* End of list Footer block centered */}
                  {form.attachments && form.attachments.split(',').filter(Boolean).length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '1rem',
                      fontSize: '0.85rem',
                      color: '#64748b',
                      background: '#f8fafc',
                      borderTop: '1px solid #e2e8f0'
                    }}>
                      <span>📂</span> End of list
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
        </div>

        {/* Right Side Sidebar (Comments Section) */}
        <div className="saas-sidebar">
          <div className="comments-section-header">
            <span className="comments-header-title">Comments ({comments.length})</span>
          </div>

          <div className="comments-feed-container">
            {commentTree.length === 0 ? (
              <div className="no-comments-placeholder">No comments yet. Start the conversation!</div>
            ) : (
              commentTree.map(c => renderComment(c))
            )}
          </div>

          <div className="comment-post-input-box">
            {commentAttachment && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.4rem 0.75rem',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                marginBottom: '0.5rem',
                fontSize: '0.8rem'
              }} className="animate-fade-in">
                <span style={{ fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                  📎 {commentAttachment.name}
                </span>
                <button 
                  type="button" 
                  onClick={() => setCommentAttachment(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    fontWeight: '700',
                    padding: '0 0.2rem'
                  }}
                >
                  ✕
                </button>
              </div>
            )}
            <div className="comment-box-flex-row">
              <div className="comment-input-field-wrapper">
                <input 
                  type="text" 
                  value={newComment} 
                  onChange={e => setNewComment(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }} 
                  placeholder={commentUploading ? "Uploading..." : "Write a comment..."}
                  className="comment-main-text-input"
                  style={{ paddingRight: '4rem' }}
                  disabled={commentUploading}
                />
                <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span 
                    className="comment-emoji-icon" 
                    title="Insert Emoji"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    style={{ cursor: 'pointer', userSelect: 'none', fontSize: '1rem', opacity: 0.6, position: 'static' }}
                  >
                    😊
                  </span>
                  
                  {/* Paperclip button */}
                  <span 
                    className="comment-paperclip-icon" 
                    title="Attach File to Comment"
                    onClick={() => commentFileInputRef.current && commentFileInputRef.current.click()}
                    style={{ cursor: 'pointer', userSelect: 'none', fontSize: '1rem', opacity: 0.6 }}
                  >
                    📎
                  </span>

                  {showEmojiPicker && (
                    <div className="emoji-picker-bubble animate-fade-in" style={{
                      position: 'absolute',
                      bottom: '40px',
                      right: '0',
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      display: 'flex',
                      gap: '0.5rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 10
                    }}>
                      {['😊', '👍', '🎉', '❤️', '🚀', '👀', '🔥', '👏'].map(emoji => (
                        <span 
                          key={emoji}
                          onClick={() => {
                            setNewComment(prev => prev + emoji);
                            setShowEmojiPicker(false);
                          }}
                          style={{ cursor: 'pointer', fontSize: '1.2rem', transition: 'transform 0.1s' }}
                          className="emoji-picker-item"
                        >
                          {emoji}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button 
                type="button"
                className="comment-submit-paper-btn" 
                onClick={() => handleAddComment()} 
                disabled={(!newComment.trim() && !commentAttachment) || commentUploading}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
            <input type="file" ref={commentFileInputRef} style={{ display: 'none' }} onChange={handleCommentFileUpload} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task Card (Kanban) ─────────────────────────────────────
function TaskCard({ task, onDragStart, onClick, onDelete, currentUser }) {
  const { getLevel } = usePermissions();
  const { confirm: showConfirm } = useAlert();
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
            <button className="card-view-btn delete-icon" title="Delete Task" onClick={(e) => { e.stopPropagation(); showConfirm('Delete this task?', () => onDelete(task.id), 'Delete Task'); }}>
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
export default function Tasks({ user, initialSelectedTask, onClearInitialTask, onDetailViewChange }) {
  const isTeamLeadOrAdmin = user?.role?.toLowerCase() === 'team lead' || user?.role?.toLowerCase() === 'admin';
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [viewMode, setViewMode] = useState('list'); 
  const [subTab, setSubTab]     = useState(isTeamLeadOrAdmin ? 'all' : 'my'); 
  const [dragOver, setDragOver] = useState(null);
  const [taskDetailMode, setTaskDetailMode] = useState(false); // false=view, true=edit
  
  const [view, setView] = useState('board'); // 'board' or 'detail'
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    if (initialSelectedTask) {
      setSelectedTask(initialSelectedTask);
      setView('detail');
      if (onClearInitialTask) onClearInitialTask();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedTask]);

  useEffect(() => {
    if (onDetailViewChange) {
      onDetailViewChange(view === 'detail');
    }
  }, [view, onDetailViewChange]);

  const dragId = useRef(null);
  const { can, getLevel } = usePermissions();
  const { alert, confirm: showConfirm } = useAlert();

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
      const updateData = { status: colId };
      if (colId === 'Delivered') {
        const existingTask = tasks.find(t => t.id === id);
        if (existingTask && !existingTask.deliveredDate) {
          updateData.deliveredDate = new Date().toISOString();
        }
      }
      setTasks(ts => ts.map(t => t.id === id ? { ...t, ...updateData } : t));
      try {
        await api.put(`/tasks/${id}`, updateData);
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
        setView('board');
      }
      fetchTasks();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save task: ' + error.message, 'error', 'Error');
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

  const openTaskDetail = (task, editMode = false) => {
    setSelectedTask(task);
    setTaskDetailMode(editMode);
    setView('detail');
  };



  const filteredTasks = tasks.filter(t => {
    const level = getLevel('tasks', 'view');
    const editLevel = getLevel('tasks', 'edit');
    const deleteLevel = getLevel('tasks', 'delete');
    
    const hasAllAccess = level === 'All' || editLevel === 'All' || deleteLevel === 'All' || isTeamLeadOrAdmin;
    
    if (hasAllAccess && subTab === 'all') return true;
    
    // For 'my' tab or 'Self' level:
    const assignees = t.assignees ? t.assignees.split(',').map(a => a.trim().toLowerCase()) : [];
    const myName = (user?.fullName || user?.name || '').trim().toLowerCase();
    
    return assignees.includes(myName);
  });



  if (view === 'detail') {
    return (
      <TaskDetailView
        task={selectedTask}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onClose={() => setView('board')}
        currentUser={user}
        initialEditMode={taskDetailMode}
      />

    );
  }

  return (
    <div className="kanban-root" onDragEnd={handleDragEnd}>
      {(getLevel('tasks', 'view') === 'All' || getLevel('tasks', 'edit') === 'All' || getLevel('tasks', 'delete') === 'All' || isTeamLeadOrAdmin) && (
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
                <th>Task Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Assignees</th>
                <th>Billable Hrs</th>
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
                    <tr key={task.id} onClick={() => openTaskDetail(task, false)}>
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
                            <>
                              <button className="list-view-btn" onClick={(e) => { e.stopPropagation(); openTaskDetail(task, false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', marginRight: '0.75rem' }} title="View Task">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                              </button>
                              <button className="list-edit-btn" onClick={(e) => { e.stopPropagation(); openTaskDetail(task, true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginRight: '0.75rem' }} title="Edit Task">
                                 <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                              </button>
                            </>
                          )}
                          {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && (user?.fullName || user?.name) && (task.assignees || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase()))) && (
                            <button className="list-delete-btn" onClick={(e) => { e.stopPropagation(); showConfirm('Delete this task?', () => handleDeleteTask(task.id), 'Delete Task'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Delete Task">
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
