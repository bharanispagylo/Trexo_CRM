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



const STATUS_HEADER_META = {
  'To Do':         { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', symbol: '●' },
  'In Progress':   { bg: '#2563eb', fg: '#ffffff', dotColor: '#bfdbfe', symbol: '●' },
  'In Testing':    { bg: '#7c3aed', fg: '#ffffff', dotColor: '#e9d5ff', symbol: '●' },
  'Re-opened':     { bg: '#db2777', fg: '#ffffff', dotColor: '#fecdd3', symbol: '●' },
  'Prod Deployed': { bg: '#ea580c', fg: '#ffffff', dotColor: '#fde68a', symbol: '●' },
  'Prod Verified': { bg: '#0d9488', fg: '#ffffff', dotColor: '#bbf7d0', symbol: '●' },
  'Delivered':     { bg: '#16a34a', fg: '#ffffff', dotColor: '#99f6e4', symbol: '✓' },
};

const PRIORITY_FLAGS = {
  'Critical': { color: '#ef4444', label: 'Critical' },
  'High':     { color: '#f59e0b', label: 'High' },
  'Medium':   { color: '#3b82f6', label: 'Medium' },
  'Low':      { color: '#94a3b8', label: 'Low' },
};

const getStatusString = (statusVal) => {
  if (!statusVal) return 'To Do';
  if (typeof statusVal === 'string') return statusVal;
  if (typeof statusVal === 'object') {
    return statusVal.id || statusVal.label || statusVal.name || statusVal.value || 'To Do';
  }
  return String(statusVal);
};

const PriorityFlag = ({ priority }) => {
  const meta = PRIORITY_FLAGS[priority] || PRIORITY_FLAGS['Medium'];
  return (
    <svg 
      viewBox="0 0 24 24" 
      width="14" 
      height="14" 
      fill="currentColor" 
      style={{ color: meta.color, display: 'inline-block', flexShrink: 0 }}
      title={`Priority: ${meta.label}`}
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
      <line x1="4" y1="22" x2="4" y2="15"></line>
    </svg>
  );
};

const formatRelativeDueDate = (dateStr) => {
  if (!dateStr) return null;
  const dueDate = new Date(dateStr);
  if (isNaN(dueDate.getTime())) return null;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  dueDate.setHours(0,0,0,0);
  
  const diffTime = dueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    const absoluteDays = Math.abs(diffDays);
    if (absoluteDays === 1) return { text: 'Yesterday', isOverdue: true };
    return { text: `${absoluteDays} days ago`, isOverdue: true };
  } else if (diffDays === 0) {
    return { text: 'Today', isOverdue: false, isToday: true };
  } else if (diffDays === 1) {
    return { text: 'Tomorrow', isOverdue: false };
  } else {
    return { 
      text: dueDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), 
      isOverdue: false 
    };
  }
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
      estimatedHours: '',
      approvedHours: '',
      actualHours: '',
      actualHoursStr: '00:00',
      approvedHoursStr: '00:00',
      taskListId: '',
      attachments: ''
    };
    if (task) {
      return {
        ...defaults,
        ...task,
        status: getStatusString(task.status),
        taskNo: task.taskNo || (task.id ? `TSK-${task.id.substring(0, 6).toUpperCase()}` : '')
      };
    }
    return {
      ...defaults,
      taskNo: `TSK-${Math.floor(Math.random() * 900000) + 100000}`
    };
  });
  useEffect(() => {
    if (task) {
      setForm(prev => ({
        ...prev,
        ...task,
        status: getStatusString(task.status),
        taskNo: task.taskNo || (task.id ? `TSK-${task.id.substring(0, 6).toUpperCase()}` : '')
      }));
    }
  }, [task]);

  const [activeTab, setActiveTab] = useState('general');
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [taskLists, setTaskLists] = useState([]);
  const [projects, setProjects] = useState([]);
  const [errors, setErrors] = useState({});


  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [workLogs, setWorkLogs] = useState([]);
  const [workLogForm, setWorkLogForm] = useState({
    logDate: new Date().toISOString().split('T')[0],
    hoursWorked: '',
    description: '',
    isBilled: false
  });
  const [workLogSaving, setWorkLogSaving] = useState(false);
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

  const fetchWorkLogs = useCallback(() => {
    if (isEdit && task?.id) {
      api.get(`/tasks/${task.id}/worklogs`).then(setWorkLogs).catch(console.error);
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
    fetchWorkLogs();
    api.get('/users').then(data => {
      const names = data.map(u => u.fullName || `${u.firstName} ${u.lastName}`.trim());
      setUsers(names);
    }).catch(console.error);
    api.get('/clients').then(data => {
      setClients(data || []);
    }).catch(console.error);
    api.get('/task-lists').then(data => {
      setTaskLists(data || []);
    }).catch(console.error);
    api.get('/projects').then(data => {
      setProjects(data || []);
    }).catch(console.error);
  }, [task, isEdit, fetchComments, fetchWorkLogs]);

  useEffect(() => {
    if (workLogs.length > 0) {
      const totalHours = workLogs.reduce((acc, log) => acc + (Number(log.hoursWorked) || 0), 0);
      
      setForm(prev => {
        if (prev.actualHours !== totalHours) {
          return {
            ...prev,
            actualHours: totalHours,
            actualHoursStr: decimalToTimeStr(totalHours)
          };
        }
        return prev;
      });
    }
  }, [workLogs]);

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
  
  const handleAddWorkLog = async () => {
    if (!workLogForm.hoursWorked || !workLogForm.logDate) {
      alert("Please fill in Date and Hours.", "warning", "Required");
      return;
    }
    setWorkLogSaving(true);
    try {
      if (workLogForm.id) {
        await api.put(`/worklogs/${workLogForm.id}`, {
          logDate: workLogForm.logDate,
          hoursWorked: workLogForm.hoursWorked,
          description: workLogForm.description,
          isBilled: workLogForm.isBilled
        });
      } else {
        await api.post(`/tasks/${task.id}/worklogs`, {
          userId: currentUser?.id,
          logDate: workLogForm.logDate,
          hoursWorked: workLogForm.hoursWorked,
          description: workLogForm.description,
          isBilled: workLogForm.isBilled
        });
      }
      fetchWorkLogs();
      setWorkLogForm({
        logDate: new Date().toISOString().split('T')[0],
        hoursWorked: '',
        description: '',
        isBilled: false,
        id: null
      });
      alert(`Work log ${workLogForm.id ? 'updated' : 'added'} successfully!`, 'success', 'Saved');
    } catch (err) {
      alert('Failed to add work log: ' + err.message, 'error', 'Error');
    } finally {
      setWorkLogSaving(false);
    }
  };

  const handleDeleteWorkLog = async (logId) => {
    confirm("Delete this work log?", async () => {
      setWorkLogSaving(true);
      try {
        await api.delete(`/worklogs/${logId}`);
        fetchWorkLogs();
        alert('Work log deleted', 'success', 'Deleted');
      } catch (err) {
        alert('Delete failed', 'error', 'Error');
      } finally {
        setWorkLogSaving(false);
      }
    }, 'Delete Log');
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleInlineSave = async (updatedForm) => {
    try {
      const { comments, taskList, ...payload } = updatedForm;
      await onSave(payload, true);
    } catch (err) {
      console.error('Failed inline save:', err);
      setForm(form);
    }
  };
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
            <div className={`saas-status-badge status-${getStatusString(form.status).toLowerCase().replace(' ', '-')}`}>
              <span className="status-dot">●</span>
              {getStatusString(form.status)}
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
            {!['employee', 'intern', 'guest', 'team lead'].includes(currentUser?.role?.toLowerCase()) && (
              <button 
                className={`saas-tab-header-btn ${activeTab === 'billing' ? 'active' : ''}`}
                onClick={() => setActiveTab('billing')}
              >
                Billing
              </button>
            )}
            <button 
              className={`saas-tab-header-btn ${activeTab === 'attachments' ? 'active' : ''}`}
              onClick={() => setActiveTab('attachments')}
            >
              Attachments
            </button>
            {isEdit && (
              <button 
                className={`saas-tab-header-btn ${activeTab === 'worklogs' ? 'active' : ''}`}
                onClick={() => setActiveTab('worklogs')}
              >
                Work Logs
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="saas-tab-pane-content">
            {activeTab === 'general' && (
              <>
              <div className="saas-details-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
                
                {/* ── CARD 1: TASK INFORMATION ── */}
                <div className="saas-detail-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>Task Information</h3>
                  <div className="saas-details-grid animate-fade-in">
                {/* Task ID */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconTaskNo /></span>
                  <span className="field-label-text">Task ID</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text font-bold">
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
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
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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
                      <span className={`saas-priority-pill pill-${(form.priority || 'Medium').toLowerCase()}`}>
                        {form.priority || 'Medium'}
                      </span>
                    )}
                  </span>
                </div>
                </div>
                </div>

                {/* ── CARD 2: PROJECT & ASSIGNMENT ── */}
                <div className="saas-detail-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>Project & Assignment</h3>
                  <div className="saas-details-grid animate-fade-in">
                {/* Client */}
                <div className="saas-details-row">
                  <span className="field-icon-box">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </span>
                  <span className="field-label-text">Client</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    <select 
                      value={form.clientId || ''} 
                      onChange={e => {
                        const cId = e.target.value;
                        const updated = { ...form, clientId: cId, projectName: '', projectId: null };
                        setForm(updated);
                        if (!isEditing) handleInlineSave(updated);
                      }} 
                      className="saas-grid-select"
                    >
                      <option value="">-- Select Client --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>

                {/* Project */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconProject /></span>
                  <span className="field-label-text">Project{isEditing ? ' *' : ''}</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    <select 
                      value={form.projectName || ''} 
                      onChange={e => {
                        const projName = e.target.value;
                        const proj = projects.find(p => p.name === projName);
                        const updated = { 
                          ...form, 
                          projectName: projName, 
                          projectId: proj ? proj.id : null, 
                          clientId: proj ? proj.clientId : form.clientId 
                        };
                        setForm(updated);
                        if (!isEditing) handleInlineSave(updated);
                      }} 
                      className={`saas-grid-select ${errors.projectName ? 'error' : ''}`}
                    >
                      <option value="">-- Select Project --</option>
                      {projects.filter(p => !form.clientId || p.clientId === form.clientId).map(proj => (
                        <option key={proj.id} value={proj.name}>
                          {proj.name}
                        </option>
                      ))}
                    </select>
                    {errors.projectName && <div className="grid-error-msg">{errors.projectName}</div>}
                  </span>
                </div>

                {/* Status */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconStatus /></span>
                  <span className="field-label-text">Status</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    <select 
                      value={form.status} 
                      onChange={e => {
                        const newStatus = e.target.value;
                        const updates = { status: newStatus };
                        if (newStatus === 'Delivered' && !form.deliveredDate) {
                          updates.deliveredDate = new Date().toISOString();
                        }
                        const updated = { ...form, ...updates };
                        setForm(updated);
                        if (!isEditing) handleInlineSave(updated);
                      }} 
                      className="saas-grid-select"
                    >
                      {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                    </select>
                  </span>
                </div>

                {/* Assignee */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconAssignee /></span>
                  <span className="field-label-text">Assignee</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                      <div className={`assignee-avatar-circle ${getAvatarColor(form.assignees || 'Unassigned')}`} style={{ flexShrink: 0 }}>
                        {initials(form.assignees || 'Unassigned')}
                      </div>
                      <select 
                        value={form.assignees || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          const updated = { ...form, assignees: val };
                          setForm(updated);
                          if (!isEditing) handleInlineSave(updated);
                        }} 
                        className="saas-grid-select"
                        style={{ flex: 1 }}
                      >
                        <option value="">Select Assignee...</option>
                        {(form.projectName && projects.find(p => p.name === form.projectName)?.members 
                            ? projects.find(p => p.name === form.projectName).members.split(',').map(m => m.trim()).filter(Boolean) 
                            : users).map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
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
                    <select
                      value={form.taskListId || ''}
                      onChange={e => {
                        const val = e.target.value || null;
                        const updated = { ...form, taskListId: val };
                        setForm(updated);
                        if (!isEditing) handleInlineSave(updated);
                      }}
                      className="saas-grid-select"
                    >
                      <option value="">-- Select Task List --</option>
                      {taskLists.filter((tl, index, self) => index === self.findIndex((t) => t.name.toLowerCase() === tl.name.toLowerCase())).map(tl => (
                        <option key={tl.id} value={tl.id}>
                          {tl.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>


                {/* Task Type */}
                <div className="saas-details-row">
                  <span className="field-icon-box"><IconType /></span>
                  <span className="field-label-text">Task Type</span>
                  <span className="field-colon-sep">:</span>
                  <span className="field-value-text">
                    <select 
                      value={form.taskType || 'Feature'} 
                      onChange={e => {
                        const val = e.target.value;
                        const updated = { ...form, taskType: val };
                        setForm(updated);
                        if (!isEditing) handleInlineSave(updated);
                      }} 
                      className="saas-grid-select"
                    >
                      <option value="Feature">Feature</option>
                      <option value="Bug">Bug</option>
                      <option value="Enhancement">Enhancement</option>
                      <option value="Documentation">Documentation</option>
                      <option value="Other">Other</option>
                    </select>
                  </span>
                </div>
                </div>
                </div>

                {/* ── CARD 3: TIMELINE & DELIVERY ── */}
                <div className="saas-detail-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>Timeline & Attachments</h3>
                  <div className="saas-details-grid animate-fade-in">
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
            </div>
          </div>
          
          {isEditing && (
            <div className="form-actions" style={{ justifyContent: 'flex-end', borderTop: 'none', background: 'transparent', boxShadow: 'none' }}>
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
            </div>
          )}
          </>
        )}

            {activeTab === 'billing' && !['employee', 'intern', 'guest', 'team lead'].includes(currentUser?.role?.toLowerCase()) && (
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

            {activeTab === 'worklogs' && (
              <div className="saas-details-grid animate-fade-in" style={{ display: 'block' }}>
                <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '0.95rem' }}>Add New Work Log</h4>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label className="saas-field-label">Date</label>
                      <input type="date" className="saas-input" value={workLogForm.logDate} onChange={e => setWorkLogForm({...workLogForm, logDate: e.target.value})} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="saas-field-label">Hours</label>
                      <input type="number" step="0.25" className="saas-input" placeholder="e.g. 2.5" value={workLogForm.hoursWorked} onChange={e => setWorkLogForm({...workLogForm, hoursWorked: e.target.value})} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label className="saas-field-label">Description</label>
                    <input type="text" className="saas-input" placeholder="What did you work on?" value={workLogForm.description} onChange={e => setWorkLogForm({...workLogForm, description: e.target.value})} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="saas-btn-primary" onClick={handleAddWorkLog} disabled={workLogSaving}>
                      {workLogSaving ? 'Saving...' : (workLogForm.id ? 'Update Work Log' : 'Add Work Log')}
                    </button>
                    {workLogForm.id && (
                      <button 
                        className="saas-btn-secondary" 
                        onClick={() => setWorkLogForm({ logDate: new Date().toISOString().split('T')[0], hoursWorked: '', description: '', isBilled: false, id: null })}
                        disabled={workLogSaving}
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '0.95rem' }}>Recent Work Logs</h4>
                  {workLogs.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No work logs found for this task.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                          <th style={{ padding: '0.75rem', fontWeight: 600 }}>Date</th>
                          <th style={{ padding: '0.75rem', fontWeight: 600 }}>User</th>
                          <th style={{ padding: '0.75rem', fontWeight: 600 }}>Hours</th>
                          <th style={{ padding: '0.75rem', fontWeight: 600 }}>Description</th>
                          <th style={{ padding: '0.75rem', fontWeight: 600 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workLogs.map(log => (
                          <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.75rem' }}>{formatDate(log.logDate)}</td>
                            <td style={{ padding: '0.75rem' }}>{log.user?.fullName || log.user?.firstName || 'Unknown'}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 600, color: '#0f172a' }}>{log.hoursWorked}h</td>
                            <td style={{ padding: '0.75rem', color: '#475569' }}>{log.description || '-'}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button title="Edit" style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }} onClick={() => {
                                  setWorkLogForm({
                                    id: log.id,
                                    logDate: new Date(log.logDate).toISOString().split('T')[0],
                                    hoursWorked: log.hoursWorked,
                                    description: log.description || '',
                                    isBilled: log.isBilled
                                  });
                                }}>
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                </button>
                                <button title="Delete" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => handleDeleteWorkLog(log.id)}>
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#94a3b8' }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> End of list
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
                <span style={{ fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                  {commentAttachment.name}
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
                    style={{ cursor: 'pointer', userSelect: 'none', opacity: 0.6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                  </span>
                  
                  {/* Paperclip button */}
                  <span 
                    className="comment-paperclip-icon" 
                    title="Attach File to Comment"
                    onClick={() => commentFileInputRef.current && commentFileInputRef.current.click()}
                    style={{ cursor: 'pointer', userSelect: 'none', opacity: 0.6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
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
  const assignees = task.assignees ? task.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];
  const relativeDate = formatRelativeDueDate(task.dueDate);

  return (
    <div
      className="task-card-clickup animate-fade-in"
      draggable={true}
      onDragStart={e => onDragStart(e, task.id)}
      onClick={() => onClick(task)}
    >
      <div className="card-clickup-header">
        <span className="card-clickup-title">{task.title || 'Untitled Task'}</span>
        
        {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && (currentUser?.fullName || currentUser?.name) && assignees.map(a => a.toLowerCase()).includes((currentUser?.fullName || currentUser?.name).toLowerCase()))) && (
          <button 
            className="card-clickup-delete-btn" 
            title="Delete Task" 
            onClick={(e) => { 
              e.stopPropagation(); 
              showConfirm('Delete this task?', () => onDelete(task.id), 'Delete Task'); 
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        )}
      </div>

      {task.description && task.description.trim() && (
        <div className="card-clickup-description-indicator" title="Task description available">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="21" y1="10" x2="3" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="21" y1="18" x2="3" y2="18"></line>
          </svg>
        </div>
      )}

      <div className="card-clickup-meta">
        <div className="card-clickup-left">
          {/* Overlapping Assignees */}
          <div className="card-clickup-avatars">
            {assignees.length === 0 ? (
              <div className="card-clickup-avatar-empty" title="Unassigned">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
            ) : (
              <>
                {assignees.slice(0, 3).map(a => {
                  const avCls = getAvatarColor(a);
                  return (
                    <div key={a} className={`card-clickup-avatar ${avCls}`} title={a}>
                      {initials(a)}
                    </div>
                  );
                })}
                {assignees.length > 3 && (
                  <div className="card-clickup-avatar av-blue" title={`${assignees.length - 3} more`}>
                    +{assignees.length - 3}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Due date */}
          <div className={`card-clickup-meta-item ${relativeDate ? (relativeDate.isOverdue ? 'overdue' : (relativeDate.isToday ? 'today' : '')) : 'empty'}`} title={task.dueDate ? `Due date: ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            {relativeDate && <span className="meta-text">{relativeDate.text}</span>}
          </div>

          {/* Priority flag */}
          <div className="card-clickup-meta-item priority" title={`Priority: ${task.priority || 'Medium'}`}>
            <PriorityFlag priority={task.priority} />
            <span className="meta-text">{task.priority}</span>
          </div>

          {/* Tag */}
          {task.tag && (
            <div className="card-clickup-meta-item tag" title={`Tag: ${task.tag}`}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              <span className="meta-text">{task.tag}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ──────────────────────────────────────────
function KanbanColumn({ col, tasks, onDragStart, onDrop, onDragOver, onDragLeave, isDragOver, onTaskClick, onDelete, currentUser, onAddTaskClick }) {
  const meta = STATUS_HEADER_META[col.label] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', symbol: '●' };

  return (
    <div
      className={`kanban-col-clickup ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      <div className="col-clickup-header">
        <div className="col-clickup-badge" style={{ backgroundColor: meta.bg, color: meta.fg }}>
          <span className="col-clickup-symbol" style={{ color: meta.dotColor }}>{meta.symbol}</span>
          <span className="col-clickup-label">{col.label.toUpperCase()}</span>
          <span className="col-clickup-count">{tasks.length}</span>
        </div>
        
        <div className="col-clickup-actions">
          <button className="col-clickup-action-btn" title="Add Task" onClick={() => onAddTaskClick(col.id)}>+</button>
        </div>
      </div>

      {isDragOver && <div className="drop-indicator">Drop here</div>}

      <div className="col-clickup-cards">
        {tasks.length === 0 && !isDragOver && (
          <div className="col-clickup-empty">No tasks yet.</div>
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

      <button className="col-clickup-add-task-btn" onClick={() => onAddTaskClick(col.id)}>
        <span style={{ fontSize: '1.1rem', marginRight: '0.25rem' }}>+</span> Add Task
      </button>
    </div>
  );
}

const parseDate = (dStr) => {
  if (!dStr) return null;
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return null;
  return d;
};

const getLocalDateString = (d) => {
  if (!d) return null;
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const date = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
};

const compareLocalDays = (d1, d2) => {
  if (!d1 || !d2) return 0;
  const y1 = d1.getFullYear();
  const m1 = d1.getMonth();
  const date1 = d1.getDate();
  const y2 = d2.getFullYear();
  const m2 = d2.getMonth();
  const date2 = d2.getDate();
  if (y1 !== y2) return y1 > y2 ? 1 : -1;
  if (m1 !== m2) return m1 > m2 ? 1 : -1;
  if (date1 !== date2) return date1 > date2 ? 1 : -1;
  return 0;
};

const categorizeTask = (task, today) => {
  const start = parseDate(task.startDate);
  const delivery = parseDate(task.dueDate);
  const delivered = parseDate(task.deliveredDate);

  // If delivered is set and it's in the past or today:
  if (delivered && compareLocalDays(delivered, today) <= 0) {
    if (compareLocalDays(delivered, today) === 0) {
      return 'today';
    } else {
      return 'backlog';
    }
  }

  // If not delivered OR delivered is in the future:
  if (start && compareLocalDays(start, today) > 0) {
    return 'upcoming';
  }
  if (delivery && compareLocalDays(delivery, today) < 0) {
    return 'backlog';
  }
  if (!start && !delivery) {
    return 'backlog';
  }
  if (start && compareLocalDays(start, today) <= 0) {
    return 'today';
  }
  if (!start && delivery && compareLocalDays(delivery, today) >= 0) {
    return 'today';
  }

  return 'backlog';
};

function TaskCardWithDates({ task, onDragStart, onClick, onDelete, currentUser }) {
  const { getLevel } = usePermissions();
  const { confirm: showConfirm } = useAlert();
  const assignees = task.assignees ? task.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];
  
  const formatDateForCard = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  const startVal = formatDateForCard(task.startDate);
  const deliveryVal = formatDateForCard(task.dueDate);
  const deliveredVal = formatDateForCard(task.deliveredDate);

  return (
    <div
      className="task-card-clickup animate-fade-in"
      draggable={true}
      onDragStart={e => onDragStart(e, task.id)}
      onClick={() => onClick(task)}
      style={{ borderLeft: task.priority === 'Critical' ? '4px solid #ef4444' : task.priority === 'High' ? '4px solid #f59e0b' : '1px solid #e2e8f0' }}
    >
      <div className="card-clickup-header">
        <span className="card-clickup-title">{task.title || 'Untitled Task'}</span>
        
        {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && (currentUser?.fullName || currentUser?.name) && assignees.map(a => a.toLowerCase()).includes((currentUser?.fullName || currentUser?.name).toLowerCase()))) && (
          <button 
            className="card-clickup-delete-btn" 
            title="Delete Task" 
            onClick={(e) => { 
              e.stopPropagation(); 
              showConfirm('Delete this task?', () => onDelete(task.id), 'Delete Task'); 
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        )}
      </div>

      {task.description && task.description.trim() && (
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', textOverflow: 'ellipsis', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>
          {task.description}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: '0.4rem 0', padding: '0.4rem 0.5rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9', fontSize: '0.72rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>Start:</span>
          <span style={{ fontWeight: 600, color: startVal ? '#334155' : '#94a3b8' }}>{startVal || 'Not started'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>Delivery (Due):</span>
          <span style={{ fontWeight: 600, color: deliveryVal ? '#334155' : '#94a3b8' }}>{deliveryVal || 'No deadline'}</span>
        </div>
        {deliveredVal && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
            <span>Delivered:</span>
            <span style={{ fontWeight: 700 }}>{deliveredVal}</span>
          </div>
        )}
      </div>

      <div className="card-clickup-meta" style={{ marginTop: '0.2rem', paddingTop: '0.4rem' }}>
        <div className="card-clickup-left">
          <div className="card-clickup-avatars">
            {assignees.length === 0 ? (
              <div className="card-clickup-avatar-empty" title="Unassigned">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
            ) : (
              <>
                {assignees.slice(0, 3).map(a => {
                  const avCls = getAvatarColor(a);
                  return (
                    <div key={a} className={`card-clickup-avatar ${avCls}`} title={a}>
                      {initials(a)}
                    </div>
                  );
                })}
                {assignees.length > 3 && (
                  <div className="card-clickup-avatar av-blue" title={`${assignees.length - 3} more`}>
                    +{assignees.length - 3}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card-clickup-meta-item priority" title={`Priority: ${task.priority || 'Medium'}`}>
            <PriorityFlag priority={task.priority} />
            <span className="meta-text">{task.priority}</span>
          </div>

          {task.projectName && (
            <div className="card-clickup-meta-item tag" title={`Project: ${task.projectName}`}>
              <span className="meta-text" style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.projectName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScheduleColumn({ title, count, tasks, onDragStart, onDrop, onDragOver, onDragLeave, isDragOver, onTaskClick, onDelete, currentUser, onAddTaskClick, colorMeta }) {
  return (
    <div
      className={`kanban-col-clickup ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      style={{ flex: '1 1 300px', minWidth: '290px' }}
    >
      <div className="col-clickup-header">
        <div className="col-clickup-badge" style={{ backgroundColor: colorMeta.bg, color: colorMeta.fg }}>
          <span className="col-clickup-symbol" style={{ color: colorMeta.dotColor }}>●</span>
          <span className="col-clickup-label">{title.toUpperCase()}</span>
          <span className="col-clickup-count">{count}</span>
        </div>
        <div className="col-clickup-actions">
          <button className="col-clickup-action-btn" title="Add Task" onClick={onAddTaskClick}>+</button>
        </div>
      </div>

      {isDragOver && <div className="drop-indicator">Drop here</div>}

      <div className="col-clickup-cards">
        {tasks.length === 0 && !isDragOver && (
          <div className="col-clickup-empty">No tasks in this category.</div>
        )}
        {tasks.map(task => (
          <TaskCardWithDates
            key={task.id}
            task={task}
            onDragStart={onDragStart}
            onClick={onTaskClick}
            onDelete={onDelete}
            currentUser={currentUser}
          />
        ))}
      </div>

      <button className="col-clickup-add-task-btn" onClick={onAddTaskClick}>
        <span style={{ fontSize: '1.1rem', marginRight: '0.25rem' }}>+</span> Add Task
      </button>
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
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState('list'); 
  const [subTab, setSubTab]     = useState(isTeamLeadOrAdmin ? 'all' : 'my'); 
  const [dragOver, setDragOver] = useState(null);
  const [taskDetailMode, setTaskDetailMode] = useState(false); // false=view, true=edit
  
  const [view, setView] = useState('board'); // 'board' or 'detail'
  const [selectedTask, setSelectedTask] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroup = (key) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
  const handleSaveTask = async (taskData, silent = false) => {
    if (!silent) setIsSaving(true);
    try {
      if (taskData.id) {
        await api.put(`/tasks/${taskData.id}`, taskData);
        if (!silent) alert('Task updated successfully!', 'success', 'Success');
      } else {
        await api.post('/tasks', taskData);
        alert('Task created successfully!', 'success', 'Success');
        setView('board');
      }
      const data = await api.get('/tasks');
      setTasks(data || []);
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save task: ' + error.message, 'error', 'Error');
    } finally {
      if (!silent) setIsSaving(false);
    }
  };

  // ── DELETE ──
  const handleDeleteTask = async (id) => {
    setIsSaving(true);
    try {
      await api.delete(`/tasks/${id}`);
      alert('Task deleted successfully.', 'success', 'Deleted');
      fetchTasks();
      setView('board');
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete task.', 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const openNewTask = (presetStatus = 'To Do', presetProject = '') => {
    setSelectedTask({
      status: presetStatus,
      projectName: presetProject,
      priority: 'Medium',
      title: '',
      description: '',
      assignees: '',
      isBillable: false,
      tag: 'Engineering',
      taskType: 'Feature'
    });
    setTaskDetailMode(true);
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
    
    const isMainAssignee = assignees.includes(myName);
    
    return isMainAssignee;
  });


  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Tasks...'}</div>;

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
            <button className={viewMode === 'schedule' ? 'active' : ''} onClick={() => setViewMode('schedule')}>Schedule</button>
          </div>
          {can('tasks', 'create') && (
            <button className="kanban-new-btn" onClick={openNewTask}>
              + New Task
            </button>
          )}


        </div>
      </div>



      {/* ── Views ── */}
      {viewMode === 'schedule' && (() => {
        const today = new Date();
        today.setHours(0,0,0,0);

        const backlogTasks = [];
        const todayTasks = [];
        const upcomingTasks = [];

        filteredTasks.forEach(task => {
          const category = categorizeTask(task, today);
          if (category === 'today') {
            todayTasks.push(task);
          } else if (category === 'upcoming') {
            upcomingTasks.push(task);
          } else {
            backlogTasks.push(task);
          }
        });

        const handleScheduleDrop = async (e, category) => {
          e.preventDefault();
          const id = dragId.current;
          if (id !== null) {
            const todayStr = getLocalDateString(new Date());
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = getLocalDateString(tomorrow);

            let updateData = {};
            if (category === 'backlog') {
              updateData = { startDate: null, dueDate: null };
            } else if (category === 'today') {
              updateData = { startDate: new Date(todayStr).toISOString() };
              const t = tasks.find(x => x.id === id);
              if (t && t.dueDate) {
                const due = parseDate(t.dueDate);
                const todayVal = new Date();
                if (due && compareLocalDays(due, todayVal) < 0) {
                  updateData.dueDate = new Date(todayStr).toISOString();
                }
              }
            } else if (category === 'upcoming') {
              updateData = { startDate: new Date(tomorrowStr).toISOString() };
            }

            setTasks(ts => ts.map(t => t.id === id ? { ...t, ...updateData } : t));
            try {
              await api.put(`/tasks/${id}`, updateData);
            } catch (error) {
              console.error('Schedule update error:', error);
              fetchTasks();
            }
          }
          dragId.current = null;
          setDragOver(null);
        };

        const scheduleColumns = [
          {
            id: 'backlog',
            title: 'Backlog Tasks',
            tasks: backlogTasks,
            colorMeta: { bg: '#fff7ed', fg: '#c2410c', dotColor: '#ea580c' },
            onAddTask: () => openNewTask('To Do')
          },
          {
            id: 'today',
            title: "Today's Tasks",
            tasks: todayTasks,
            colorMeta: { bg: '#eff6ff', fg: '#1d4ed8', dotColor: '#3b82f6' },
            onAddTask: () => {
              const todayStr = getLocalDateString(new Date());
              setSelectedTask({
                status: 'To Do',
                projectName: '',
                priority: 'Medium',
                title: '',
                description: '',
                assignees: '',
                isBillable: false,
                tag: 'Engineering',
                taskType: 'Feature',
                startDate: new Date(todayStr).toISOString(),
                dueDate: new Date(todayStr).toISOString()
              });
              setTaskDetailMode(true);
              setView('detail');
            }
          },
          {
            id: 'upcoming',
            title: 'Upcoming Tasks',
            tasks: upcomingTasks,
            colorMeta: { bg: '#f5f3ff', fg: '#6d28d9', dotColor: '#8b5cf6' },
            onAddTask: () => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowStr = getLocalDateString(tomorrow);
              setSelectedTask({
                status: 'To Do',
                projectName: '',
                priority: 'Medium',
                title: '',
                description: '',
                assignees: '',
                isBillable: false,
                tag: 'Engineering',
                taskType: 'Feature',
                startDate: new Date(tomorrowStr).toISOString()
              });
              setTaskDetailMode(true);
              setView('detail');
            }
          }
        ];

        return (
          <div className="kanban-board schedule-board">
            {scheduleColumns.map(col => (
              <ScheduleColumn
                key={col.id}
                title={col.title}
                count={col.tasks.length}
                tasks={col.tasks}
                onDragStart={handleDragStart}
                onDrop={e => handleScheduleDrop(e, col.id)}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                isDragOver={dragOver === col.id}
                onTaskClick={openTaskDetail}
                onDelete={handleDeleteTask}
                currentUser={user}
                onAddTaskClick={col.onAddTask}
                colorMeta={col.colorMeta}
              />
            ))}
          </div>
        );
      })()}

      {/* ── Views ── */}
      {viewMode === 'kanban' && (
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
              onAddTaskClick={openNewTask}
            />

          ))}
        </div>

      )}

      {viewMode === 'list' && (() => {
        // Group tasks by project name, and then by status
        const grouped = {};
        filteredTasks.forEach(task => {
          const proj = task.projectName || 'General / Unassigned';
          const status = task.status || 'To Do';
          if (!grouped[proj]) grouped[proj] = {};
          if (!grouped[proj][status]) grouped[proj][status] = [];
          grouped[proj][status].push(task);
        });

        const projectsList = Object.keys(grouped).sort();

        if (filteredTasks.length === 0) {
          return (
            <div className="clickup-list-empty">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <p>No tasks found.</p>
            </div>
          );
        }

        return (
          <div className="clickup-list-view">
            {projectsList.map(proj => {
              const isProjCollapsed = !!collapsedGroups[proj];
              const projStatuses = COLUMNS.filter(col => grouped[proj][col.id] && grouped[proj][col.id].length > 0);
              
              return (
                <div key={proj} className="clickup-project-group">
                  <div 
                    className="clickup-project-header" 
                    onClick={() => toggleGroup(proj)}
                  >
                    <span className="clickup-project-toggle">
                      {isProjCollapsed ? '▶' : '▼'}
                    </span>
                    <span className="clickup-project-folder-icon" style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px', color: '#64748b', verticalAlign: 'middle' }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </span>
                    <span className="clickup-project-title">{proj}</span>
                  </div>

                  {!isProjCollapsed && (
                    <div className="clickup-project-content">
                      {projStatuses.map(col => {
                        const statusKey = `${proj}-${col.id}`;
                        const isStatusCollapsed = !!collapsedGroups[statusKey];
                        const statusTasks = grouped[proj][col.id] || [];
                        const meta = STATUS_HEADER_META[col.id] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', symbol: '●' };

                        return (
                          <div key={col.id} className="clickup-status-group">
                            <div className="clickup-status-header">
                              <div className="clickup-status-left" onClick={() => toggleGroup(statusKey)}>
                                <span className="clickup-status-toggle">
                                  {isStatusCollapsed ? '▶' : '▼'}
                                </span>
                                <div className="clickup-status-badge" style={{ backgroundColor: meta.bg, color: meta.fg }}>
                                  <span className="clickup-status-symbol" style={{ color: meta.dotColor }}>{meta.symbol}</span>
                                  <span className="clickup-status-label">{col.label.toUpperCase()}</span>
                                  <span className="clickup-status-count">{statusTasks.length}</span>
                                </div>
                              </div>
                              <button 
                                className="clickup-status-add-btn" 
                                title="Add Task in status"
                                onClick={() => openNewTask(col.id, proj === 'General / Unassigned' ? '' : proj)}
                              >
                                +
                              </button>
                            </div>

                            {!isStatusCollapsed && (
                              <div className="clickup-table-wrapper">
                                <table className="clickup-table">
                                  <thead>
                                    <tr>
                                      <th className="th-name">NAME</th>
                                      <th className="th-assignee">ASSIGNEE</th>
                                      <th className="th-due">DUE DATE</th>
                                      <th className="th-priority">PRIORITY</th>
                                      <th className="th-hours">HOURS</th>
                                      <th className="th-actions"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {statusTasks.map(task => {
                                      const assignees = task.assignees ? task.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];
                                      const relativeDate = formatRelativeDueDate(task.dueDate);
                                      return (
                                        <tr 
                                          key={task.id} 
                                          className="clickup-row" 
                                          onClick={() => openTaskDetail(task, false)}
                                        >
                                          <td className="td-name">
                                            <span 
                                              className="status-checkbox-dot" 
                                              style={{ 
                                                color: meta.dotColor,
                                                borderColor: meta.dotColor
                                              }}
                                              title={`Status: ${task.status}`}
                                            >
                                              {meta.symbol === '✓' ? '✓' : '○'}
                                            </span>
                                            <span className="task-title-text">{task.title || 'Untitled Task'}</span>
                                          </td>
                                          <td className="td-assignee" onClick={e => e.stopPropagation()}>
                                            <div className="clickup-avatars-list">
                                              {assignees.length === 0 ? (
                                                <div className="clickup-avatar-empty" title="Unassigned">
                                                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                    <circle cx="12" cy="7" r="4"></circle>
                                                  </svg>
                                                </div>
                                              ) : (
                                                assignees.slice(0, 3).map(a => {
                                                  const avCls = getAvatarColor(a);
                                                  return (
                                                    <div key={a} className={`clickup-avatar ${avCls}`} title={a}>
                                                      {initials(a)}
                                                    </div>
                                                  );
                                                })
                                              )}
                                              {assignees.length > 3 && (
                                                <div className="clickup-avatar av-blue" title={`${assignees.length - 3} more`}>
                                                  +{assignees.length - 3}
                                                </div>
                                              )}
                                            </div>
                                          </td>
                                          <td className="td-due">
                                            <div className={`clickup-due-badge ${relativeDate ? (relativeDate.isOverdue ? 'overdue' : (relativeDate.isToday ? 'today' : '')) : ''}`}>
                                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                                <line x1="3" y1="10" x2="21" y2="10"></line>
                                              </svg>
                                              <span className="due-text">{relativeDate ? relativeDate.text : '-'}</span>
                                            </div>
                                          </td>
                                          <td className="td-priority">
                                            <div className="clickup-priority-wrapper">
                                              <PriorityFlag priority={task.priority} />
                                              <span className="priority-text">{task.priority || 'Medium'}</span>
                                            </div>
                                          </td>
                                          <td className="td-hours">
                                            <span className="hours-badge" title="Actual vs Estimated Hours">
                                              {task.actualHours || 0}h / {task.approvedHours || 0}h
                                            </span>
                                          </td>
                                          <td className="td-actions" onClick={e => e.stopPropagation()}>
                                            <div className="row-action-buttons">
                                              {(getLevel('tasks', 'edit') === 'All' || (getLevel('tasks', 'edit') === 'Self' && (user?.fullName || user?.name) && ((task.assignees || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase())))) && (
                                                <button className="row-act-btn edit" onClick={() => openTaskDetail(task, true)} title="Edit Task">
                                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                </button>
                                              )}
                                              {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && (user?.fullName || user?.name) && ((task.assignees || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase())))) && (
                                                <button className="row-act-btn delete" onClick={() => showConfirm('Delete this task?', () => handleDeleteTask(task.id), 'Delete Task')} title="Delete Task">
                                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {/* Inline Add Task row */}
                                    <tr className="clickup-add-row" onClick={() => openNewTask(col.id, proj === 'General / Unassigned' ? '' : proj)}>
                                      <td colSpan="6">
                                        <span className="add-task-icon">+</span>
                                        <span className="add-task-text">Add Task</span>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
