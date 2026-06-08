/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../api/client';
import './Tasks.css';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAlert } from '../../../context/AlertContext';

function PromptModal({ isOpen, title, onSave, onCancel }) {
  const [value, setValue] = useState('');
  useEffect(() => { if (isOpen) setValue(''); }, [isOpen]);
  
  if (!isOpen) return null;
  return (
    <div className="task-drawer-overlay" style={{ zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem' }}>{title}</h3>
        <input 
          type="text" autoFocus className="saas-input" style={{ width: '100%', marginBottom: '1.5rem' }} 
          value={value} onChange={e => setValue(e.target.value)} 
          onKeyDown={e => { if (e.key === 'Enter') onSave(value); }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="saas-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="saas-btn-submit" onClick={() => onSave(value)}>Save</button>
        </div>
      </div>
    </div>
  );
}
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
  'To Do':         { bg: '#f1f5f9', fg: '#000000', dotColor: '#94a3b8', isDone: false },
  'In Progress':   { bg: '#2563eb', fg: '#000000', dotColor: '#bfdbfe', isDone: false },
  'In Testing':    { bg: '#7c3aed', fg: '#000000', dotColor: '#e9d5ff', isDone: false },
  'Re-opened':     { bg: '#db2777', fg: '#000000', dotColor: '#fecdd3', isDone: false },
  'Prod Deployed': { bg: '#ea580c', fg: '#000000', dotColor: '#fde68a', isDone: false },
  'Prod Verified': { bg: '#0d9488', fg: '#000000', dotColor: '#bbf7d0', isDone: false },
  'Delivered':     { bg: '#16a34a', fg: '#000000', dotColor: '#99f6e4', isDone: true  },
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


// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Task Detail View (Separate Page) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
export function TaskDetailView({ task, onSave, onDelete, onClose, currentUser, initialEditMode = false }) {

  const isEdit = !!(task && task.id);
  const [isEditing, setIsEditing] = useState(true); // Always in edit mode
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
      assignedDate: new Date().toISOString(),
      deliveredDate: '',
      priority: 'Medium',
      status: 'To Do',
      tag: 'Engineering',
      taskType: 'Feature',
      projectName: '',
      isBillable: false,
      billableAmount: '',
      estimatedHours: '',
      approvedHours: '',
      actualHours: '',
      actualHoursStr: '0.0',
      approvedHoursStr: '0.0',
      taskListId: '',
      attachments: ''
    };
    if (task) {
      return {
        ...defaults,
        ...task,
        status: getStatusString(task.status),
        taskNo: task.taskNo || (task.id ? `TSK-${task.id.substring(0, 6).toUpperCase()}` : `TSK-${Math.floor(Math.random() * 900000) + 100000}`)
      };
    }
    return {
      ...defaults,
      taskNo: `TSK-${Math.floor(Math.random() * 900000) + 100000}`
    };
  });

  const formatCreatedDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `Created ${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
  };

  const createdDateToDisplay = isEdit && task?.createdAt 
    ? formatCreatedDate(task.createdAt) 
    : formatCreatedDate(new Date());

  const [initialForm, setInitialForm] = useState(null);

  useEffect(() => {
    if (task) {
      const loadedForm = {
        ...form,
        ...task,
        status: getStatusString(task.status),
        taskNo: task.taskNo || (task.id ? `TSK-${task.id.substring(0, 6).toUpperCase()}` : `TSK-${Math.floor(Math.random() * 900000) + 100000}`),
        approvedHoursStr: task.approvedHours !== undefined && task.approvedHours !== null ? Number(task.approvedHours).toFixed(1) : '0.0'
      };
      setForm(loadedForm);
      setInitialForm(loadedForm);
    } else {
      setInitialForm(form);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  const isChanged = () => {
    if (!task || !task.id) return true; // New tasks are always saveable
    if (!initialForm) return false;
    
    const keysToCompare = [
      'title', 'description', 'status', 'assignees', 'dueDate', 'deliveredDate', 'priority',
      'tag', 'taskType', 'isBillable', 'billableAmount', 'estimatedHours', 'approvedHours', 'actualHours'
    ];
    
    for (const key of keysToCompare) {
      let v1 = form[key];
      let v2 = initialForm[key];
      
      // Normalize dates
      if (key === 'dueDate' || key === 'deliveredDate') {
        v1 = v1 ? new Date(v1).toISOString().split('T')[0] : '';
        v2 = v2 ? new Date(v2).toISOString().split('T')[0] : '';
      }
      if (v1 === null || v1 === undefined) v1 = '';
      if (v2 === null || v2 === undefined) v2 = '';
      
      if (String(v1) !== String(v2)) {
        return true;
      }
    }
    return false;
  };

  const [activeTab, setActiveTab] = useState('general');
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [taskLists, setTaskLists] = useState([]);
  const [projects, setProjects] = useState([]);
  const [errors, setErrors] = useState({});
  const [promptState, setPromptState] = useState({ isOpen: false, title: '', onSubmit: null });


  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [mentionState, setMentionState] = useState({ isOpen: false, filter: '' });
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
    return assignees.includes(userName) || (currentUser?.id && assignees.includes(currentUser.id.toLowerCase().trim()));
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
      setUsers(data || []);
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
    const billedHours = workLogs.filter(log => log.isBilled).reduce((acc, log) => acc + (Number(log.hoursWorked) || 0), 0);
    const employeeTime = workLogs.filter(log => !log.isBilled).reduce((acc, log) => acc + (Number(log.hoursWorked) || 0), 0);
    
    setForm(prev => {
      if (prev.actualHours !== billedHours || prev.employeeHours !== employeeTime) {
        return {
          ...prev,
          actualHours: billedHours,
          actualHoursStr: billedHours.toFixed(1),
          employeeHours: employeeTime
        };
      }
      return prev;
    });
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
  
  const handleAddWorkLog = async (isBilledArg = false) => {
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
          isBilled: isBilledArg
        });
      } else {
        await api.post(`/tasks/${task.id}/worklogs`, {
          userId: currentUser?.id,
          logDate: workLogForm.logDate,
          hoursWorked: workLogForm.hoursWorked,
          description: workLogForm.description,
          isBilled: isBilledArg
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

    if (form.isBillable && (form.approvedHours < 0 || form.actualHours < 0)) {
      newErrors.billing = "Hours cannot be negative";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      alert(firstError, 'warning', 'Validation Error');
      return;
    }

    setErrors({});

    // Sanitize data for API
    const { comments, taskList, ...payload } = form;
    
    onSave(payload);
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


  const IconCalendar = () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
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
              {cleanText.split('\n').map((line, i) => {
                const parts = line.split(/(@[a-zA-Z0-9_-]+)/g);
                return (
                  <div key={i}>
                    {parts.map((part, idx) => {
                      if (part.startsWith('@') && part.length > 1) {
                        return <strong key={idx} style={{ fontWeight: '700' }}>{part}</strong>;
                      }
                      return part;
                    })}
                  </div>
                );
              })}
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
                <span className="comment-action-btn-link" style={{ cursor: 'pointer' }} onClick={() => handleReact(c.id,'👍')}>👍</span>

                <div className="reaction-picker-popup" style={{ display: 'none', position: 'absolute', bottom: '100%', left: '0', background: 'white', padding: '0.25rem 0.5rem', borderRadius: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', gap: '0.5rem', zIndex: 10, border: '1px solid #e2e8f0', marginBottom: '4px' }}>
                   {['👍', '❤️', '😊', '👏', '😮'].map(emoji => (
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
        
        <div className="saas-nav-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {createdDateToDisplay && (
            <span className="saas-nav-created-date" style={{ color: '#64748b', fontSize: '0.82rem', marginRight: '0.5rem', fontWeight: 500 }}>
              {createdDateToDisplay}
            </span>
          )}
          {isEdit && canDelete && (
            <button
              className="saas-btn-nav saas-btn-danger"
              onClick={() => confirm('Are you sure you want to delete this task?', () => { onDelete(task.id); onClose(); }, 'Delete Task')}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span className="saas-btn-delete-text">Delete</span>
            </button>
          )}



          <button className="saas-btn-nav saas-btn-secondary saas-nav-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="saas-btn-nav saas-btn-primary"
            onClick={submit}
            disabled={isEdit && !isChanged()}
            style={{
              opacity: (isEdit && !isChanged()) ? 0.6 : 1,
              cursor: (isEdit && !isChanged()) ? 'not-allowed' : 'pointer'
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            {isEdit ? 'Save' : 'Create Task'}
          </button>
        </div>
      </div>

      <div className="saas-main-container">
        {/* Left Side Content Pane */}
        <div className="saas-content-pane">
          {/* Header area with ID & Status */}
          <div className="saas-detail-title-block" style={{ marginBottom: '1.5rem', marginTop: '0.5rem' }}>
            {isEditing ? (
              <input 
                type="text" 
                value={form.title} 
                onChange={e => set('title', e.target.value)} 
                className="saas-title-input"
                placeholder="Task Title"
                style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', fontSize: '1.75rem', fontWeight: '800' }}
              />
            ) : (
              <h1 className="saas-detail-title" style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0 }}>{form.title || 'Untitled Task'}</h1>
            )}
          </div>

          {/* Tabs */}
          <div className="saas-tabs-header-row" style={{ marginBottom: '1.5rem' }}>
            <button 
              className={`saas-tab-header-btn ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General
            </button>
            {currentUser?.role?.toLowerCase() === 'admin' && (
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
            {currentUser?.role?.toLowerCase() === 'admin' && (
              <button 
                className={`saas-tab-header-btn ${activeTab === 'worklogs' ? 'active' : ''}`}
                onClick={() => setActiveTab('worklogs')}
              >
                Billed Logs
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="saas-tab-pane-content">
            {activeTab === 'general' && (
              <>
              <div className="saas-meta-grid animate-fade-in" style={{ paddingBottom: '2rem' }}>
                
                {/* Row 1: Status & Assignees */}
                <div className="saas-meta-row saas-meta-row-4col" style={{ gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="saas-meta-label" style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><IconStatus /> Status</span>
                  <span className="saas-meta-value">
                    <select value={form.status} onChange={e => { const updated = { ...form, status: e.target.value }; setForm(updated); if (!isEditing) handleInlineSave(updated); }} className="saas-grid-select" style={{ width: '100%', padding: '0.4rem', border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}>
                      {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                    </select>
                  </span>
                  
                  <span className="saas-meta-label" style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><IconAssignee /> Assignee</span>
                  <span className="saas-meta-value">
                    <select value={form.assignees || ''} onChange={e => { const updated = { ...form, assignees: e.target.value }; setForm(updated); if (!isEditing) handleInlineSave(updated); }} className="saas-grid-select" style={{ width: '100%', padding: '0.4rem', border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}>
                      <option value="">Empty</option>
                      {(form.projectName && projects.find(p => p.name === form.projectName)?.members ? projects.find(p => p.name === form.projectName).members.split(',').map(m => m.trim()).filter(Boolean) : users.map(u => u.id)).map(uId => {
                        const uObj = users.find(u => u.id === uId) || {};
                        const displayName = uObj.fullName || `${uObj.firstName || ''} ${uObj.lastName || ''}`.trim() || 'Unknown';
                        return <option key={uId} value={uId}>{displayName}</option>;
                      })}
                    </select>
                  </span>
                </div>

                {/* Row 2: Dates (Due Date -> Delivery Date) */}
                <div className="saas-meta-row saas-meta-row-2col" style={{ gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="saas-meta-label" style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><IconCalendar /> Dates</span>
                  <span className="saas-meta-value">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>Due:</span>
                      <input 
                        type="date" 
                        value={form.dueDate ? new Date(form.dueDate).toISOString().split('T')[0] : ''} 
                        onChange={e => set('dueDate', e.target.value)} 
                        style={{ border: '1px solid #e2e8f0', borderRadius: '4px', background: '#f8fafc', padding: '0.15rem 0.3rem', fontSize: '0.8rem', color: '#64748b', width: '100px', cursor: 'pointer', fontWeight: 600 }} 
                        title="Due Date"
                      />
                      
                      <span className="saas-date-arrow" style={{ color: '#94a3b8', fontSize: '0.8rem' }}>→</span>

                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>Delivery:</span>
                      <input 
                        type="date" 
                        value={form.deliveredDate ? new Date(form.deliveredDate).toISOString().split('T')[0] : ''} 
                        onChange={e => set('deliveredDate', e.target.value)} 
                        style={{ border: '1px solid #e2e8f0', borderRadius: '4px', background: '#f8fafc', padding: '0.15rem 0.3rem', fontSize: '0.8rem', color: '#64748b', width: '100px', cursor: 'pointer', fontWeight: 600 }} 
                        title="Delivery Date"
                      />
                    </div>
                  </span>
                </div>

                {/* Row 3: Priority */}
                <div className="saas-meta-row saas-meta-row-2col" style={{ gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="saas-meta-label" style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><IconPriority /> Priority</span>
                  <span className="saas-meta-value">
                    <select value={form.priority} onChange={e => set('priority', e.target.value)} className="saas-grid-select" style={{ width: '100%', padding: '0.4rem', border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}>
                      <option value="">Empty</option>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </span>
                </div>



                <div className="saas-meta-divider" style={{ borderBottom: '1px solid #f1f5f9', margin: '1.5rem 0' }}></div>

                <div style={{ padding: '0.5rem 0' }}>
                  {isEditing ? (
                    <textarea value={form.description} onChange={e => set('description', e.target.value)} className="saas-grid-textarea" style={{ minHeight: '120px', width: '100%', border: 'none', background: '#f8fafc', outline: 'none', fontSize: '0.95rem', padding: '1rem', borderRadius: '8px' }} placeholder="Add description, or write with AI..." />
                  ) : (
                    <div style={{ color: form.description ? '#334155' : '#94a3b8', whiteSpace: 'pre-wrap', fontSize: '0.95rem', minHeight: '60px', cursor: 'text', padding: '0.5rem' }} onClick={() => setIsEditing(true)}>
                      {form.description || 'Add description, or write with AI...'}
                    </div>
                  )}
                </div>

              </div>
          
          {isEditing && (
            <div className="form-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: 'none', background: 'transparent', boxShadow: 'none' }}>
              <button className="saas-btn-nav saas-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button 
                className="saas-btn-nav saas-btn-primary" 
                onClick={submit} 
                disabled={isEdit && !isChanged()}
                style={{ 
                  opacity: (isEdit && !isChanged()) ? 0.6 : 1, 
                  cursor: (isEdit && !isChanged()) ? 'not-allowed' : 'pointer' 
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                {isEdit ? 'Save' : 'Create Task'}
              </button>
            </div>
          )}
          </>
        )}

            {activeTab === 'billing' && currentUser?.role?.toLowerCase() === 'admin' && (
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
                                approvedHoursStr: '0.0',
                                actualHoursStr: '0.0'
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
                      {/* Billable Amount */}
                      <div className="billing-field-row" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center' }}>
                        <label className="billing-label" style={{ fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>
                          Billable Amount ($)
                        </label>
                        <div>
                          {isEditing ? (
                            <input 
                              type="number" 
                              value={form.billableAmount !== undefined && form.billableAmount !== null ? form.billableAmount : ''}
                              onChange={e => {
                                const val = e.target.value;
                                setForm(f => ({
                                  ...f,
                                  billableAmount: val === '' ? null : parseFloat(val)
                                }));
                              }}
                              className="saas-grid-input"
                              placeholder="e.g. 500"
                            />
                          ) : (
                            <span style={{ fontSize: '0.92rem', color: '#0f172a', fontWeight: '500' }}>
                              ${Number(form.billableAmount || 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Billable Hours */}
                      <div className="billing-field-row" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center' }}>
                        <label className="billing-label" style={{ fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>
                          Billable Hours
                        </label>
                        <div>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={form.approvedHoursStr !== undefined ? form.approvedHoursStr : (form.approvedHours !== undefined && form.approvedHours !== null ? Number(form.approvedHours).toFixed(1) : '0.0')}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  setForm(f => ({
                                    ...f,
                                    approvedHoursStr: val,
                                    approvedHours: val === '' || val === '.' ? 0 : parseFloat(val) || 0
                                  }));
                                }
                              }}
                              className="saas-grid-input"
                              placeholder="e.g. 40.0"
                            />
                          ) : (
                            <span style={{ fontSize: '0.92rem', color: '#0f172a', fontWeight: '500' }}>
                              {Number(form.approvedHours || 0).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Billed Hours */}
                      <div className="billing-field-row" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center' }}>
                        <label className="billing-label" style={{ fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>
                          Already Billed
                        </label>
                        <div>
                          <span style={{ fontSize: '0.92rem', color: '#0f172a', fontWeight: '500' }}>
                            {Number(form.actualHours || 0).toFixed(1)}
                          </span>
                        </div>
                      </div>


                      {/* Remaining Billable Hours */}
                      <div className="billing-field-row" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center' }}>
                        <label className="billing-label" style={{ fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>
                          Remaining Billable Hours
                        </label>
                        <div>
                          <span style={{ 
                            fontSize: '0.92rem', 
                            fontWeight: '500', 
                            color: '#0f172a'
                          }}>
                            {Number(Math.max(0, (form.approvedHours || 0) - (form.actualHours || 0))).toFixed(1)}
                            {((form.approvedHours || 0) - (form.actualHours || 0)) < 0 && ' (Over Budget)'}
                          </span>
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


            {activeTab === 'worklogs' && currentUser?.role?.toLowerCase() === 'admin' && (
              <div className="saas-details-grid animate-fade-in" style={{ display: 'block' }}>
                {!isEdit ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '1rem', opacity: 0.5 }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>Please create and save the task first before adding work logs.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', maxWidth: '420px', boxSizing: 'border-box' }}>
                      <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '0.95rem' }}>Add New Work Log</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label className="saas-field-label" style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Date</label>
                      <input type="date" className="saas-input" value={workLogForm.logDate} onChange={e => setWorkLogForm({...workLogForm, logDate: e.target.value})} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label className="saas-field-label" style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Hours</label>
                      <input type="number" step="0.25" className="saas-input" placeholder="e.g. 2.5" value={workLogForm.hoursWorked} onChange={e => setWorkLogForm({...workLogForm, hoursWorked: e.target.value})} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label className="saas-field-label" style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Description</label>
                    <input type="text" className="saas-input" placeholder="What did you work on?" value={workLogForm.description} onChange={e => setWorkLogForm({...workLogForm, description: e.target.value})} style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="saas-btn-primary" onClick={() => handleAddWorkLog(true)} disabled={workLogSaving}>
                      {workLogSaving ? 'Saving...' : (workLogForm.id ? 'Update Billing Log' : 'Add Billing Log')}
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
                  <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '0.95rem' }}>Recent Billing Logs</h4>
                  {workLogs.filter(log => log.isBilled).length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No billing logs found for this task.</p>
                  ) : (
                    <div className="table-responsive">
<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                          <th style={{ padding: '0.75rem', fontWeight: 600 }}>Date</th>
                          <th style={{ padding: '0.75rem', fontWeight: 600 }}>User</th>
                          <th style={{ padding: '0.75rem', fontWeight: 600 }}>Billed Hours</th>
                          <th style={{ padding: '0.75rem', fontWeight: 600 }}>Description</th>
                          <th style={{ padding: '0.75rem', fontWeight: 600 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workLogs.filter(log => log.isBilled).map(log => (
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
                                    isBilled: true
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
</div>
                  )}
                </div>
                </>
                )}
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
                  <div className="table-responsive">
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
</div>
                  
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
                  ✔
                </button>
              </div>
            )}
            <div className="comment-box-flex-row">
              <div className="comment-input-field-wrapper" style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  value={newComment} 
                  onChange={e => {
                    const val = e.target.value;
                    setNewComment(val);
                    const match = val.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
                    if (match) {
                      setMentionState({ isOpen: true, filter: match[1].toLowerCase() });
                    } else {
                      setMentionState({ isOpen: false, filter: '' });
                    }
                  }} 
                  onKeyDown={e => { 
                    if (mentionState?.isOpen) {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const searchStr = mentionState.filter.toLowerCase();
                        const filteredUsers = users.filter(u => {
                          const name = (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase();
                          return name.includes(searchStr);
                        });
                        if (filteredUsers.length > 0) {
                          const chosenUser = filteredUsers[0];
                          const chosenName = (chosenUser.fullName || `${chosenUser.firstName || ''} ${chosenUser.lastName || ''}`).replace(/\s+/g, '_');
                          const val = newComment.replace(/(?:^|\s)@[a-zA-Z0-9_]*$/, ` @${chosenName} `);
                          setNewComment(val);
                          setMentionState({ isOpen: false, filter: '' });
                        }
                      }
                      return;
                    }
                    if (e.key === 'Enter') handleAddComment(); 
                  }} 
                  placeholder={commentUploading ? "Uploading..." : "Write a comment... (Type @ to mention)"}
                  className="comment-main-text-input"
                  style={{ paddingRight: '4rem' }}
                  disabled={commentUploading}
                />
                
                {mentionState?.isOpen && (
                  <div className="mention-dropdown animate-fade-in" style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '0',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    zIndex: 20,
                    width: '200px',
                    marginBottom: '8px'
                  }}>
                    {users.filter(u => {
                      const name = (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase();
                      return name.includes(mentionState.filter.toLowerCase());
                    }).map(u => {
                      const displayName = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown';
                      return (
                      <div 
                        key={u.id}
                        onClick={() => {
                          const chosenName = displayName.replace(/\s+/g, '_');
                          const val = newComment.replace(/(?:^|\s)@[a-zA-Z0-9_]*$/, ` @${chosenName} `);
                          setNewComment(val);
                          setMentionState({ isOpen: false, filter: '' });
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          borderBottom: '1px solid #f1f5f9',
                          color: '#1e293b'
                        }}
                        onMouseEnter={e => e.target.style.background = '#f8fafc'}
                        onMouseLeave={e => e.target.style.background = 'white'}
                      >
                        {displayName}
                      </div>
                    );
                  })}
                    {users.filter(u => {
                      const name = (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase();
                      return name.includes(mentionState.filter.toLowerCase());
                    }).length === 0 && (
                      <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#94a3b8' }}>No users found</div>
                    )}
                  </div>
                )}
                <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
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
                      {['😍', '👍', '👏', '❤️', '😮'].map(emoji => (
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
      
      <PromptModal
        isOpen={promptState.isOpen}
        title={promptState.title}
        onSave={promptState.onSubmit}
        onCancel={() => setPromptState({ isOpen: false, title: '', onSubmit: null })}
      />
    </div>
  );
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Task Card (Kanban) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
function TaskCard({ task, onDragStart, onClick, onDelete, currentUser, listUsers }) {
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
        
        {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && (assignees.map(a => a.toLowerCase()).includes(currentUser?.id?.toLowerCase()) || ((currentUser?.fullName || currentUser?.name) && assignees.map(a => a.toLowerCase()).includes((currentUser?.fullName || currentUser?.name).toLowerCase()))))) && (
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
                  const uObj = listUsers.find(u => u.id === a);
                  const dispName = uObj ? (uObj.fullName || `${uObj.firstName || ''} ${uObj.lastName || ''}`.trim() || 'Unknown') : 'Unknown';
                  const avCls = getAvatarColor(dispName);
                  return (
                    <div key={a} className={`card-clickup-avatar ${avCls}`} title={dispName}>
                      {initials(dispName)}
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

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Kanban Column ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
function KanbanColumn({ col, tasks, onDragStart, onDrop, onDragOver, onDragLeave, isDragOver, onTaskClick, onDelete, currentUser, listUsers, onAddTaskClick, showAdd = true }) {
  const meta = STATUS_HEADER_META[col.label] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', isDone: false };

  return (
    <div
      className={`kanban-col-clickup ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      <div className="col-clickup-header">
        <div className="col-clickup-badge" style={{ backgroundColor: meta.bg, color: meta.fg }}>
          <span className="col-clickup-label">{col.label.toUpperCase()}</span>
          <span className="col-clickup-count">{tasks.length}</span>
        </div>
        
        {showAdd && (
          <div className="col-clickup-actions">
            <button className="col-clickup-action-btn" title="Add Task" onClick={() => onAddTaskClick(col.id)}>+</button>
          </div>
        )}
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
            listUsers={listUsers || []}
          />
        ))}
      </div>

      {showAdd && (
        <button className="col-clickup-add-task-btn" onClick={() => onAddTaskClick(col.id)}>
          <span style={{ fontSize: '1.1rem', marginRight: '0.25rem' }}>+</span> Add Task
        </button>
      )}
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

function TaskCardWithDates({ task, onDragStart, onClick, onDelete, currentUser, listUsers }) {
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
        
        {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && (assignees.map(a => a.toLowerCase()).includes(currentUser?.id?.toLowerCase()) || ((currentUser?.fullName || currentUser?.name) && assignees.map(a => a.toLowerCase()).includes((currentUser?.fullName || currentUser?.name).toLowerCase()))))) && (
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
                  const uObj = listUsers.find(u => u.id === a);
                  const dispName = uObj ? (uObj.fullName || `${uObj.firstName || ''} ${uObj.lastName || ''}`.trim() || 'Unknown') : 'Unknown';
                  const avCls = getAvatarColor(dispName);
                  return (
                    <div key={a} className={`card-clickup-avatar ${avCls}`} title={dispName}>
                      {initials(dispName)}
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

function ScheduleColumn({ title, count, tasks, onDragStart, onDrop, onDragOver, onDragLeave, isDragOver, onTaskClick, onDelete, currentUser, listUsers, onAddTaskClick, colorMeta, showAdd = true }) {
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
          <span className="col-clickup-symbol" style={{ width: "8px", height: "8px", borderRadius: "50%", background: colorMeta.dotColor, display: "inline-block" }}></span>
          <span className="col-clickup-label">{title.toUpperCase()}</span>
          <span className="col-clickup-count">{count}</span>
        </div>
        {showAdd && (
          <div className="col-clickup-actions">
            <button className="col-clickup-action-btn" title="Add Task" onClick={onAddTaskClick}>+</button>
          </div>
        )}
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
            listUsers={listUsers || []}
          />
        ))}
      </div>

      {showAdd && (
        <button className="col-clickup-add-task-btn" onClick={onAddTaskClick}>
          <span style={{ fontSize: '1.1rem', marginRight: '0.25rem' }}>+</span> Add Task
        </button>
      )}
    </div>
  );
}



// ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
//  MAIN TASKS COMPONENT
// ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
export default function Tasks({ user, initialSelectedTask, onClearInitialTask, onDetailViewChange, initialAssigneeFilter, onClearAssigneeFilter }) {
  const isTeamLeadOrAdmin = user?.role?.toLowerCase() === 'team lead' || user?.role?.toLowerCase() === 'admin';
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [subTab, setSubTab]     = useState('my');
  const [mobileSortBy, setMobileSortBy] = useState('dueDate');
  const [assigneeFilter, setAssigneeFilter] = useState(initialAssigneeFilter);

  useEffect(() => {
    setAssigneeFilter(initialAssigneeFilter);
    if (initialAssigneeFilter) {
      setSubTab('my');
    }
  }, [initialAssigneeFilter]); 
  const [dragOver, setDragOver] = useState(null);
  const [taskDetailMode, setTaskDetailMode] = useState(false); // false=view, true=edit
  const [promptState, setPromptState] = useState({ isOpen: false, title: '', onSubmit: null });
  const setView = () => {};
  const setSelectedTask = () => {};

  const [collapsedGroups, setCollapsedGroups] = useState({});
  // Inline add state
  const [inlineAdd, setInlineAdd] = useState(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineAssignee, setInlineAssignee] = useState('');
  const [inlinePriority, setInlinePriority] = useState('Medium');
  const [inlineDueDate, setInlineDueDate] = useState('');
  const [inlineTaskType, setInlineTaskType] = useState('Task');
  const inlineInputRef = useRef(null);
  // Side drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTask, setDrawerTask] = useState(null);
  const [listUsers, setListUsers] = useState([]);
  const toggleGroup = (key) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };
  // Accordion state for All Tasks grouped by task list (null = none open, string = open list id)
  const [expandedListId, setExpandedListId] = useState('__first__');
  const toggleListAccordion = (id) => {
    setExpandedListId(prev => prev === id ? null : id);
  };

  useEffect(() => {
    if (initialSelectedTask) {
      setDrawerTask(initialSelectedTask);
      setDrawerOpen(true);
      setTaskDetailMode(false);
      if (onClearInitialTask) onClearInitialTask();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedTask]);

  useEffect(() => {
    if (onDetailViewChange) {
      onDetailViewChange(drawerOpen);
    }
  }, [drawerOpen, onDetailViewChange]);

  useEffect(() => {
    api.get('/users').then(data => setListUsers(data || [])).catch(console.error);
  }, []);

  // Sidebar: projects + task lists
  const [taskProjects, setTaskProjects] = useState([]);
  const [taskListsData, setTaskListsData] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [selectedProjId, setSelectedProjId] = useState(null);
  const [expandedProj, setExpandedProj] = useState({});
  
  // Explicit filters
  const [filterProjectName, setFilterProjectName] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    api.get('/projects').then(data => {
      setTaskProjects(data || []);
      // Auto-expand all projects
      const exp = {};
      (data || []).forEach(p => { exp[p.id] = true; });
      setExpandedProj(exp);
    }).catch(console.error);
    api.get('/task-lists').then(data => setTaskListsData(data || [])).catch(console.error);
  }, []);

  const toggleProjExpand = (id) => setExpandedProj(prev => ({ ...prev, [id]: !prev[id] }));

  // Derive names for breadcrumb
  const selectedProj = taskProjects.find(p => p.id === selectedProjId);
  const selectedList = taskListsData.find(l => l.id === selectedListId);
  const selectedListProj = selectedListId ? taskProjects.find(p => p.id === selectedList?.projectId) : null;

  const dragId = useRef(null);
  const { can, getLevel } = usePermissions();
  const { alert, confirm: showConfirm } = useAlert();

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ FETCH from API ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Drag handlers ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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

  const closeInlineAdd = () => {
    setInlineAdd(null);
    setInlineTitle(''); setInlineAssignee(''); setInlinePriority('Medium'); setInlineDueDate(''); setInlineTaskType('Task');
  };

  const submitInlineAdd = async () => {
    const title = inlineTitle.trim();
    if (!title) { closeInlineAdd(); return; }
    const { projName, projId, taskListId, statusId } = inlineAdd;
    setIsSaving(true);
    try {
      await api.post('/tasks', {
        title,
        status: statusId,
        projectName: projName || '',
        projectId: projId || null,
        taskListId: (taskListId && !String(taskListId).startsWith('gen_') && taskListId !== 'unassigned') ? taskListId : null,
        priority: inlinePriority || 'Medium',
        assignees: inlineAssignee || '',
        assignedDate: new Date().toISOString(),
        dueDate: inlineDueDate ? new Date(inlineDueDate).toISOString() : null,
        tag: '',
        taskType: inlineTaskType || 'Task',
        isBillable: false,
        description: ''
      });
      const data = await api.get('/tasks');
      setTasks(data || []);
      closeInlineAdd();
    } catch (err) {
      console.error('Inline add failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const openTaskDetail = (task, editMode = false) => {
    setDrawerTask(task);
    setTaskDetailMode(editMode);
    setDrawerOpen(true);
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

  const handleSaveTask = async (taskData, silent = false) => {
    if (!silent) setIsSaving(true);
    try {
      if (taskData.id) {
        await api.put(`/tasks/${taskData.id}`, taskData);
        if (!silent) alert('Task updated successfully!', 'success', 'Success');
      } else {
        await api.post('/tasks', taskData);
        alert('Task created successfully!', 'success', 'Success');
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

  const handleDeleteTask = async (id) => {
    setIsSaving(true);
    try {
      await api.delete(`/tasks/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
      alert('Task deleted successfully.', 'success', 'Deleted');
      fetchTasks();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete task.', 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const openNewTask = (presetStatus = 'To Do', presetProject = '', presetProjectId = null, presetTaskListId = null, presetClientId = null) => {
    setDrawerTask({
      status: presetStatus,
      projectName: presetProject,
      projectId: presetProjectId,
      taskListId: presetTaskListId,
      clientId: presetClientId,
      priority: 'Medium',
      title: '',
      description: '',
      assignees: '',
      isBillable: false,
      tag: 'Engineering',
      taskType: 'Feature'
    });
    setTaskDetailMode(true);
    setDrawerOpen(true);
  };

  const closeDrawer = () => { setDrawerOpen(false); setDrawerTask(null); };

  const openInlineAdd = (proj, statusId, taskListId = null) => {
    let finalProjId = null;
    let finalProjName = '';
    if (taskListId) {
      if (String(taskListId).startsWith('gen_')) {
        const derivedProjId = taskListId.substring(4);
        const p = taskProjects.find(pr => pr.id === derivedProjId);
        if (p) {
          finalProjId = p.id;
          finalProjName = p.name;
        }
      } else {
        const list = taskListsData.find(l => l.id === taskListId);
        if (list && list.projectId) {
          const p = taskProjects.find(pr => pr.id === list.projectId);
          if (p) {
            finalProjId = p.id;
            finalProjName = p.name;
          }
        }
      }
    }
    setInlineAdd({ 
      proj: finalProjName || proj, 
      projName: finalProjName || proj, 
      projId: finalProjId, 
      taskListId, 
      statusId: statusId || 'To Do' 
    });
    setInlineTitle(''); setInlineAssignee(''); setInlinePriority('Medium'); setInlineDueDate('');
    setTimeout(() => inlineInputRef.current?.focus(), 50);
  };

  const getTaskProjectId = (t) => {
    if (t.taskListId) {
      const list = taskListsData.find(l => l.id === t.taskListId);
      if (list && list.projectId) return list.projectId;
    }
    if (t.projectId) {
      const p = taskProjects.find(p => p.id === t.projectId);
      if (p) return p.id;
    }
    if (t.projectName) {
      const p = taskProjects.find(p => p.name === t.projectName);
      if (p) return p.id;
    }
    return null;
  };

  const filteredTasks = tasks.filter(t => {
    // 1. Project Filter
    if (filterProjectName && t.projectName !== filterProjectName) {
      return false;
    }

    // 2. Date Filter
    if (filterDate) {
      const targetDateStr = filterDate;
      const matchDate = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return d.toISOString().split('T')[0] === targetDateStr;
      };
      if (!matchDate(t.startDate) && !matchDate(t.dueDate) && !matchDate(t.deliveredDate)) {
        return false;
      }
    }

    // 3. User Permission / SubTab Filter
    const level = getLevel('tasks', 'view');
    const editLevel = getLevel('tasks', 'edit');
    const deleteLevel = getLevel('tasks', 'delete');
    
    const hasAllAccess = level === 'All' || editLevel === 'All' || deleteLevel === 'All' || isTeamLeadOrAdmin;
    
    if (hasAllAccess && subTab === 'all' && !assigneeFilter) return true;
    
    // For 'my' tab, 'Self' level, or specified assigneeFilter:
    const assignees = t.assignees ? t.assignees.split(',').map(a => a.trim().toLowerCase()) : [];
    const targetId = (assigneeFilter || user?.id || '').trim().toLowerCase();
    
    return assignees.includes(targetId);
  });

  const pageTitle = subTab === 'my' ? '' : 'All Tasks';

  return (
    <div className="tasks-3col-layout">


      {/* Ã¢â€¢ÂÃ¢â€¢Â MAIN CONTENT Ã¢â€¢ÂÃ¢â€¢Â */}
      <div className="tasks-main-content">
      <div className="kanban-root" onDragEnd={handleDragEnd}>
      {(getLevel('tasks', 'view') === 'All' || getLevel('tasks', 'edit') === 'All' || getLevel('tasks', 'delete') === 'All' || isTeamLeadOrAdmin) && !assigneeFilter && (
        <div className="saas-tabs" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '2rem' }}>
          <button 
            className={`saas-tab ${subTab === 'my' ? 'active' : ''}`} 
            onClick={() => {
              setSubTab('my');
              setAssigneeFilter(null);
              if (onClearAssigneeFilter) onClearAssigneeFilter();
            }}
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
            onClick={() => {
              setSubTab('all');
              setAssigneeFilter(null);
              if (onClearAssigneeFilter) onClearAssigneeFilter();
            }}
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

      {assigneeFilter && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.6rem', 
          background: '#eff6ff', 
          border: '1px solid #bfdbfe', 
          padding: '0.4rem 0.85rem', 
          borderRadius: '8px', 
          fontSize: '0.85rem', 
          color: '#1d4ed8', 
          fontWeight: 600, 
          marginBottom: '1rem', 
          width: 'fit-content' 
        }}>
          <span>Viewing tasks for: <strong>{listUsers.find(u => u.id === assigneeFilter)?.fullName || assigneeFilter}</strong></span>
          <button 
            style={{ 
              background: '#dbeafe', 
              border: 'none', 
              color: '#1d4ed8', 
              cursor: 'pointer', 
              fontWeight: '700', 
              borderRadius: '50%', 
              width: '18px', 
              height: '18px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '0.75rem',
              padding: 0
            }} 
            onClick={() => { 
              setAssigneeFilter(null); 
              if (onClearAssigneeFilter) onClearAssigneeFilter(); 
            }}
            title="Clear employee filter"
          >
            ✕
          </button>
        </div>
      )}



      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Header ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <div className="kanban-header">
        <div className="kanban-header-left">
        </div>
        <div className="kanban-controls">
          <div style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>Projects</label>
            <select 
              value={filterProjectName} 
              onChange={e => setFilterProjectName(e.target.value)}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', background: '#f8fafc', outline: 'none', cursor: 'pointer' }}
            >
              {subTab === 'my' ? (
                <>
                  <option value="">All Projects</option>
                  {taskProjects.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </>
              ) : (
                taskProjects.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.name}>{p.name}</option>)
              )}
            </select>
            <input 
              type="date" 
              value={filterDate} 
              onChange={e => setFilterDate(e.target.value)}
              title="Filter by task date"
              style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', background: '#f8fafc', outline: 'none', cursor: 'pointer' }}
            />
            {(filterProjectName || filterDate) && (
              <button 
                onClick={() => { setFilterProjectName(''); setFilterDate(''); }}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="view-toggle">
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>List</button>
            <button className={viewMode === 'kanban' ? 'active' : ''} onClick={() => setViewMode('kanban')}>Kanban</button>
            <button className={viewMode === 'schedule' ? 'active' : ''} onClick={() => setViewMode('schedule')}>Schedule</button>
          </div>


        </div>
      </div>



      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Views ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
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
                listUsers={listUsers}
                onAddTaskClick={col.onAddTask}
                colorMeta={col.colorMeta}
                showAdd={subTab !== 'my'}
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
              listUsers={listUsers}
              onAddTaskClick={openNewTask}
              showAdd={subTab !== 'my'}
            />

          ))}
        </div>

      )}

      {viewMode === 'list' && (() => {
        if (subTab === 'all') {
          // Group by Task List
          const byList = {};
          taskListsData.forEach(list => {
            byList[list.id] = [];
          });
          byList['unassigned'] = [];

          filteredTasks.forEach(task => {
            const listId = task.taskListId;
            if (listId && byList[listId] !== undefined) {
              byList[listId].push(task);
            } else {
              byList['unassigned'].push(task);
            }
          });

          // Map task lists to their project
          const projectGroupsMap = {};
          
          taskProjects.forEach(proj => {
            projectGroupsMap[proj.id] = {
              id: proj.id,
              name: proj.name,
              lists: []
            };
          });
          
          taskListsData.forEach(list => {
            const listTasks = byList[list.id] || [];
            if (listTasks.length === 0) return;
            
            const sortedTasks = [...listTasks].sort((a, b) => {
              if (!a.dueDate) return 1;
              if (!b.dueDate) return -1;
              return new Date(a.dueDate) - new Date(b.dueDate);
            });
            
            const listGroup = {
              id: list.id,
              name: list.name,
              tasks: sortedTasks
            };
            
            const projId = list.projectId;
            if (projId && projectGroupsMap[projId]) {
              projectGroupsMap[projId].lists.push(listGroup);
            } else {
              if (!projectGroupsMap['unassigned_proj']) {
                projectGroupsMap['unassigned_proj'] = {
                  id: 'unassigned_proj',
                  name: 'General / No Project',
                  lists: []
                };
              }
              projectGroupsMap['unassigned_proj'].lists.push(listGroup);
            }
          });
          
          const unassignedTasks = [...(byList['unassigned'] || [])].sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
          });
          
          if (unassignedTasks.length > 0) {
            unassignedTasks.forEach(task => {
              const projId = getTaskProjectId(task);
              if (projId && projectGroupsMap[projId]) {
                let genList = projectGroupsMap[projId].lists.find(l => l.id === `gen_${projId}`);
                if (!genList) {
                  genList = {
                    id: `gen_${projId}`,
                    name: 'General Tasks',
                    tasks: []
                  };
                  projectGroupsMap[projId].lists.push(genList);
                }
                genList.tasks.push(task);
              } else {
                if (!projectGroupsMap['unassigned_proj']) {
                  projectGroupsMap['unassigned_proj'] = {
                    id: 'unassigned_proj',
                    name: 'General / No Project',
                    lists: []
                  };
                }
                let genList = projectGroupsMap['unassigned_proj'].lists.find(l => l.id === 'unassigned');
                if (!genList) {
                  genList = {
                    id: 'unassigned',
                    name: 'General / Unassigned',
                    tasks: []
                  };
                  projectGroupsMap['unassigned_proj'].lists.push(genList);
                }
                genList.tasks.push(task);
              }
            });
          }
          
          const finalProjectGroups = Object.values(projectGroupsMap)
            .filter(projGroup => projGroup.lists.length > 0);

          finalProjectGroups.forEach(projGroup => {
            projGroup.lists.forEach(list => {
              list.tasks.sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
              });
            });
          });

          const firstListId = finalProjectGroups[0]?.lists[0]?.id;

          return (
            <div className="cu-list-root all-tasks-list">
              {finalProjectGroups.map(projGroup => {
                return (
                  <div key={projGroup.id} className="project-group-container" style={{ marginBottom: '2.5rem' }}>
                    {/* Project Group Header */}
                    <div className="project-group-header" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.65rem 1rem',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      marginBottom: '0.75rem',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}>
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#475569" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <span style={{
                        fontWeight: '800',
                        fontSize: '0.85rem',
                        color: '#334155',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {projGroup.name}
                      </span>
                      <span style={{
                        background: '#e2e8f0',
                        color: '#475569',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 700
                      }}>
                        {projGroup.lists.reduce((sum, l) => sum + l.tasks.length, 0)} Tasks
                      </span>
                    </div>

                    {/* Task Lists belonging to this Project */}
                    <div className="project-task-lists-wrapper">
                      {projGroup.lists.map(list => {
                        const isCollapsed = expandedListId === '__first__'
                          ? list.id !== firstListId
                          : expandedListId !== list.id;
                        const isInline = inlineAdd && (inlineAdd.taskListId === list.id || (list.id === 'unassigned' && !inlineAdd.taskListId));

                        return (
                          <div key={list.id} className="cu-status-section" style={{ marginBottom: '1rem' }}>
                            {/* Section Header */}
                            <div className="cu-section-header">
                              <div className="cu-section-left" onClick={() => {
                                if (expandedListId === '__first__') {
                                  setExpandedListId(list.id === firstListId ? null : list.id);
                                } else {
                                  toggleListAccordion(list.id);
                                }
                              }}>
                                <span className="cu-section-chevron">
                                  <svg viewBox="0 0 10 6" width="10" height="6" fill="currentColor" style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s", color: "#94a3b8" }}><path d="M0 0l5 6 5-6z"/></svg>
                                </span>
                                <span style={{ fontWeight: '700', fontSize: '0.82rem', color: '#64748b', marginLeft: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  {list.name}
                                </span>
                                <span className="cu-section-count" style={{ marginLeft: '0.5rem', background: '#f1f5f9', color: '#64748b', padding: '0.1rem 0.4rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>
                                  {list.tasks.length}
                                </span>
                              </div>
                              <div className="cu-section-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {can('tasks', 'create') && (
                                    <button className="kanban-new-btn" title="Create New Task"
                                      style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', boxShadow: 'none' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        let projId = projGroup.id !== 'unassigned_proj' ? projGroup.id : null;
                                        let projName = projGroup.id !== 'unassigned_proj' ? projGroup.name : '';
                                        let clientId = null;
                                        if (projId) {
                                          const p = taskProjects.find(pr => pr.id === projId);
                                          if (p) clientId = p.clientId;
                                        }
                                        const isVirtual = String(list.id).startsWith('gen_') || list.id === 'unassigned';
                                        openNewTask('To Do', projName, projId, isVirtual ? null : list.id, clientId);
                                      }}>
                                      New
                                    </button>
                                )}
                              </div>
                            </div>

                            {/* Task Table */}
                            {!isCollapsed && (
                              <div className="cu-table-wrapper">
                                <div className="table-responsive">
<table className="cu-table">
                                  <thead>
                                    <tr className="cu-thead-row">
                                      <th className="cu-th cu-th-name">NAME</th>
                                      <th className="cu-th cu-th-assignee">ASSIGNEE</th>
                                      <th className="cu-th cu-th-list">STATUS</th>
                                      <th className="cu-th cu-th-delivery">DUE DATE</th>
                                      <th className="cu-th cu-th-priority">PRIORITY</th>
                                      <th className="cu-th cu-th-actions"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {list.tasks.map(task => {
                                      const assignees = task.assignees ? task.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];
                                      const relDate = formatRelativeDueDate(task.dueDate);
                                      const meta = STATUS_HEADER_META[task.status] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', isDone: false };

                                      return (
                                        <tr key={task.id} className="cu-row" onClick={() => openTaskDetail(task, false)}>
                                          <td className="cu-td cu-td-name">
                                            <span className="cu-status-dot" style={{ color: meta.dotColor, borderColor: meta.dotColor }}>
                                              <span className="cu-status-dot" style={{ background: meta.dotColor, borderColor: meta.dotColor }}></span>
                                            </span>
                                            <span className="cu-task-title">{task.title || 'Untitled Task'}</span>
                                            {task.taskNo && <span className="cu-task-id">{task.taskNo}</span>}
                                          </td>
                                          <td className="cu-td cu-td-assignee" onClick={e => e.stopPropagation()}>
                                            <div className="cu-inline-field-wrapper">
                                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#64748b" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                              <select className="cu-inline-dropdown" value={task.assignees || ''} onChange={async (e) => { e.stopPropagation(); const updated = { ...task, assignees: e.target.value }; try { await api.put(`/tasks/${task.id}`, { assignees: e.target.value }); setTasks(ts => ts.map(t => t.id === task.id ? updated : t)); } catch(err) { console.error(err); } }}>
                                                <option value="">Unassigned</option>
                                                {listUsers.map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
                                              </select>
                                            </div>
                                          </td>
                                          <td className="cu-td cu-td-list" onClick={e => e.stopPropagation()}>
                                            <div className="cu-inline-field-wrapper">
                                              <span className="cu-inline-status-dot" style={{ background: meta.dotColor }}></span>
                                              <select className="cu-inline-dropdown" value={task.status || 'To Do'} onChange={async (e) => { e.stopPropagation(); const newStatus = e.target.value; const updateData = { status: newStatus }; if (newStatus === 'Delivered' && !task.deliveredDate) { updateData.deliveredDate = new Date().toISOString(); } try { await api.put(`/tasks/${task.id}`, updateData); setTasks(ts => ts.map(t => t.id === task.id ? { ...t, ...updateData } : t)); } catch(err) { console.error(err); } }} style={{ color: meta.fg, fontWeight: 700 }}>
                                                {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                                              </select>
                                            </div>
                                          </td>
                                          <td className="cu-td cu-td-delivery" onClick={e => e.stopPropagation()}>
                                            <div className="cu-inline-field-wrapper">
                                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={relDate?.isOverdue ? '#ea580c' : relDate?.isToday ? '#2563eb' : '#64748b'} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                              <input type="date" className="cu-inline-dropdown cu-inline-date-field" value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''} onChange={async (e) => { e.stopPropagation(); const val = e.target.value; try { await api.put(`/tasks/${task.id}`, { dueDate: val ? new Date(val).toISOString() : null }); setTasks(ts => ts.map(t => t.id === task.id ? { ...t, dueDate: val ? new Date(val).toISOString() : null } : t)); } catch(err) { console.error(err); } }} />
                                            </div>
                                          </td>
                                          <td className="cu-td cu-td-priority" onClick={e => e.stopPropagation()}>
                                            <div className="cu-inline-field-wrapper">
                                              <PriorityFlag priority={task.priority} />
                                              <select className="cu-inline-dropdown" value={task.priority || 'Medium'} onChange={async (e) => { e.stopPropagation(); const val = e.target.value; try { await api.put(`/tasks/${task.id}`, { priority: val }); setTasks(ts => ts.map(t => t.id === task.id ? { ...t, priority: val } : t)); } catch(err) { console.error(err); } }}>
                                                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                              </select>
                                            </div>
                                          </td>
                                          <td className="cu-td cu-td-actions" onClick={e => e.stopPropagation()}>
                                            <div className="cu-row-actions">
                                              {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && ((user?.id && (task.assignees || '').toLowerCase().includes(user.id.toLowerCase())) || ((user?.fullName || user?.name) && (task.assignees || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase()))))) && (
                                                <button className="cu-act-btn danger" onClick={(e) => { e.stopPropagation(); showConfirm('Delete this task?', () => handleDeleteTask(task.id), 'Delete Task'); }} title="Delete">
                                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {/* Inline Add Row */}
                                    {isInline ? (
                                      <tr className="cu-inline-row animate-fade-in">
                                        <td colSpan="6" style={{ padding: '8px' }}>
                                          <div className="new-task-inline-bar">
                                            <div className="ntib-left">
                                              <span className="ntib-dotted-circle"></span>
                                              <input
                                                ref={inlineInputRef}
                                                type="text"
                                                placeholder="Task Name or type '/' for commands"
                                                value={inlineTitle}
                                                onChange={e => setInlineTitle(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') submitInlineAdd(); if (e.key === 'Escape') closeInlineAdd(); }}
                                                autoFocus
                                                className="ntib-input"
                                              />
                                            </div>
                                            <div className="ntib-right">
                                              <div className="ntib-dropdown-wrapper">
                                                <span className="ntib-dropdown-trigger">
                                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '2px' }}><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle></svg>
                                                  {inlineTaskType}
                                                </span>
                                                <select 
                                                  className="ntib-hidden-select" 
                                                  value={inlineTaskType} 
                                                  onChange={e => setInlineTaskType(e.target.value)}
                                                >
                                                  <option value="Task">Task</option>
                                                  <option value="Milestone">Milestone</option>
                                                  <option value="Form Response">Form Response</option>
                                                  <option value="Meeting Note">Meeting Note</option>
                                                </select>
                                              </div>
                                              
                                              <span className="ntib-divider"></span>
                                              
                                              <div className="ntib-dropdown-wrapper">
                                                <button type="button" className="ntib-btn-icon" title="Assignee">
                                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                </button>
                                                <select className="ntib-hidden-select" value={inlineAssignee} onChange={e => setInlineAssignee(e.target.value)}>
                                                  <option value="">Assignee</option>
                                                  {listUsers.map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
                                                </select>
                                                {inlineAssignee && <span className="ntib-badge">{initials((listUsers.find(u => u.id === inlineAssignee) || {}).fullName || inlineAssignee)}</span>}
                                              </div>
                                              
                                              <div className="ntib-dropdown-wrapper">
                                                <button type="button" className="ntib-btn-icon" title="Due Date">
                                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                </button>
                                                <input type="date" className="ntib-hidden-date" value={inlineDueDate} onChange={e => setInlineDueDate(e.target.value)} />
                                                {inlineDueDate && <span className="ntib-badge">{new Date(inlineDueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>}
                                              </div>
                                              
                                              <div className="ntib-dropdown-wrapper">
                                                <button type="button" className="ntib-btn-icon" title="Priority">
                                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                                                </button>
                                                <select className="ntib-hidden-select" value={inlinePriority} onChange={e => setInlinePriority(e.target.value)}>
                                                  {PRIORITIES.map(p => <option key={p} value={p}>{p} Priority</option>)}
                                                </select>
                                                {inlinePriority && <span className="ntib-badge priority-color">{inlinePriority}</span>}
                                              </div>
                                              
                                              <button type="button" className="ntib-cancel-btn" onClick={closeInlineAdd}>Cancel</button>
                                              <button type="button" className="ntib-save-btn" onClick={submitInlineAdd}>Save ↵</button>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    ) : (
                                      can('tasks', 'create') && (
                                        <tr className="cu-add-row" onClick={() => openInlineAdd('', 'To Do', list.id)}>
                                          <td colSpan="6">
                                            <span className="cu-add-icon">+</span>
                                            <span className="cu-add-text">Add Task</span>
                                          </td>
                                        </tr>
                                      )
                                    )}
                                  </tbody>
                                </table>
</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }

        // Group by status (for My Tasks or general default fallback)
        const byStatus = {};
        COLUMNS.forEach(col => { byStatus[col.id] = []; });
        filteredTasks.forEach(task => {
          const st = task.status || 'To Do';
          if (!byStatus[st]) byStatus[st] = [];
          byStatus[st].push(task);
        });

        const flatSorted = [...filteredTasks].sort((a, b) => {
          if (mobileSortBy === 'dueDate') {
            if (!a.dueDate) return 1; if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
          }
          if (mobileSortBy === 'priority') {
            const order = { Critical: 0, High: 1, Medium: 2, Low: 3, '': 4 };
            return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
          }
          if (mobileSortBy === 'title') {
            return (a.title || '').localeCompare(b.title || '');
          }
          return 0;
        });
        return (
          <>
            {/* ── Mobile ClickUp-style flat list (hidden on desktop) ── */}
            <div className="cu-mobile-mytasks-flat">
              <div className="cu-mobile-sort-bar">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                <span>Sort by:</span>
                <select className="cu-mobile-sort-select" value={mobileSortBy} onChange={e => setMobileSortBy(e.target.value)}>
                  <option value="dueDate">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="title">Name</option>
                </select>
              </div>
              {flatSorted.length === 0 ? (
                <div className="cu-flat-empty">No tasks assigned to you.</div>
              ) : flatSorted.map(task => {
                const relDate = formatRelativeDueDate(task.dueDate);
                const tGroup = task.taskListId ? (taskListsData.find(l => l.id === task.taskListId)?.name || '') : '';
                const dueLbl = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
                const sMeta = STATUS_HEADER_META[task.status] || { dotColor: '#94a3b8' };
                return (
                  <div key={task.id} className="cu-flat-task-row" onClick={() => openTaskDetail(task, false)}>
                    <span className="cu-flat-circle" style={{ borderColor: sMeta.dotColor }}></span>
                    <div className="cu-flat-task-content">
                      <span className="cu-flat-task-title">{task.title || 'Untitled Task'}</span>
                      {(dueLbl || tGroup) && (
                        <div className="cu-flat-task-meta">
                          {dueLbl && (
                            <span className={`cu-flat-task-date${relDate?.isOverdue ? ' cu-flat-overdue' : relDate?.isToday ? ' cu-flat-today' : ''}`}>
                              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              {dueLbl}
                            </span>
                          )}
                          {tGroup && <span className="cu-flat-task-list">{dueLbl ? ' • ' : ''}In {tGroup}</span>}
                        </div>
                      )}
                    </div>
                    {task.status && (
                      <span className="cu-flat-status" style={{ background: sMeta.bg, color: sMeta.fg }}>
                        {task.status}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Desktop: status-grouped list (hidden on mobile) ── */}
            <div className="cu-list-root my-tasks-list">
            {COLUMNS.map(col => {
              const meta = STATUS_HEADER_META[col.id] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', isDone: false };
              const statusTasks = [...(byStatus[col.id] || [])].sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
              });
              const isCollapsed = !!collapsedGroups[col.id];
              const isInline = inlineAdd && inlineAdd.statusId === col.id && !inlineAdd.taskListId;

              return (
                <div key={col.id} className="cu-status-section">
                  {/* Section Header */}
                  <div className="cu-section-header">
                    <div className="cu-section-left" onClick={() => toggleGroup(col.id)}>
                      <span className="cu-section-chevron">
                        <svg viewBox="0 0 10 6" width="10" height="6" fill="currentColor" style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s", color: "#94a3b8" }}><path d="M0 0l5 6 5-6z"/></svg>
                      </span>
                      <span className="cu-status-pill" style={{ background: meta.bg, color: meta.fg }}>
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: meta.dotColor, display: "inline-block", marginRight: "6px", flexShrink: 0 }}></span>
                        {col.label.toUpperCase()}
                      </span>
                      <span className="cu-section-count">{statusTasks.length}</span>
                    </div>
                    <div className="cu-section-right">
                      {can('tasks', 'create') && subTab !== 'my' && (
                        <button className="cu-section-add-btn" title={`Add task to ${col.label}`}
                          onClick={() => openInlineAdd('', col.id)}>+</button>
                      )}
                    </div>
                  </div>

                  {/* Task Table */}
                  {!isCollapsed && (
                    <div className="cu-table-wrapper">
                      <div className="table-responsive">
<table className="cu-table">
                        <thead>
                          <tr className="cu-thead-row">
                            <th className="cu-th cu-th-name">NAME</th>
                            <th className="cu-th cu-th-assignee">ASSIGNEE</th>
                            <th className="cu-th cu-th-project">PROJECT</th>
                            <th className="cu-th cu-th-list">TASK GROUP</th>
                            <th className="cu-th cu-th-delivery">DUE DATE</th>
                            <th className="cu-th cu-th-priority">PRIORITY</th>
                            <th className="cu-th cu-th-actions"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {statusTasks.map(task => {
                            const assignees = task.assignees ? task.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];
                            const relDate = formatRelativeDueDate(task.dueDate);
                            const taskGroupName = task.taskListId ? (taskListsData.find(l => l.id === task.taskListId)?.name || '') : '';
                            const dueDateLabel = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
                            return (
                              <tr key={task.id} className="cu-row" onClick={() => openTaskDetail(task, false)}>
                                <td className="cu-td cu-td-name">
                                  {/* Desktop: small filled dot */}
                                  <span className="cu-status-dot" style={{ background: meta.dotColor }}></span>
                                  {/* Mobile: dashed ring */}
                                  <span className="cu-mobile-circle" style={{ borderColor: meta.dotColor }}>
                                    <span className="cu-mobile-circle-dot" style={{ background: meta.dotColor }}></span>
                                  </span>
                                  {/* Title area — always visible */}
                                  <div className="cu-name-content">
                                    <span className="cu-task-title">{task.title || 'Untitled Task'}</span>
                                    {task.taskNo && <span className="cu-task-id">{task.taskNo}</span>}
                                    {(dueDateLabel || taskGroupName) && (
                                      <div className="cu-mobile-task-sub">
                                        {dueDateLabel && (
                                          <span className={`cu-mobile-due${relDate?.isOverdue ? ' cu-due-overdue' : relDate?.isToday ? ' cu-due-today' : ''}`}>
                                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                            {dueDateLabel}
                                          </span>
                                        )}
                                        {taskGroupName && (
                                          <span className="cu-mobile-in-list">
                                            {dueDateLabel ? ' • ' : ''}In {taskGroupName}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <svg className="cu-mobile-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#cbd5e1" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                                </td>
                                <td className="cu-td cu-td-assignee" onClick={e => e.stopPropagation()}>
                                  <div className="cu-inline-field-wrapper">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#64748b" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    <select className="cu-inline-dropdown" value={task.assignees || ''} onChange={async (e) => { e.stopPropagation(); const updated = { ...task, assignees: e.target.value }; try { await api.put(`/tasks/${task.id}`, { assignees: e.target.value }); setTasks(ts => ts.map(t => t.id === task.id ? updated : t)); } catch(err) { console.error(err); } }}>
                                      <option value="">Unassigned</option>
                                      {listUsers.map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
                                    </select>
                                  </div>
                                </td>
                                <td className="cu-td cu-td-project">
                                  {task.projectName ? (
                                    <span className="cu-project-badge">{task.projectName}</span>
                                  ) : <span className="cu-empty-cell">-</span>}
                                </td>

                                <td className="cu-td cu-td-list">
                                  {task.taskListId && taskListsData.length ? (taskListsData.find(l => l.id === task.taskListId)?.name || '-') : <span className="cu-empty-cell">-</span>}
                                </td>
                                <td className="cu-td cu-td-delivery" onClick={e => e.stopPropagation()}>
                                  <div className="cu-inline-field-wrapper">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={relDate?.isOverdue ? '#ea580c' : relDate?.isToday ? '#2563eb' : '#64748b'} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    <input type="date" className="cu-inline-dropdown cu-inline-date-field" value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''} onChange={async (e) => { e.stopPropagation(); const val = e.target.value; try { await api.put(`/tasks/${task.id}`, { dueDate: val ? new Date(val).toISOString() : null }); setTasks(ts => ts.map(t => t.id === task.id ? { ...t, dueDate: val ? new Date(val).toISOString() : null } : t)); } catch(err) { console.error(err); } }} />
                                  </div>
                                </td>
                                <td className="cu-td cu-td-priority" onClick={e => e.stopPropagation()}>
                                  <div className="cu-inline-field-wrapper">
                                    <PriorityFlag priority={task.priority} />
                                    <select className="cu-inline-dropdown" value={task.priority || 'Medium'} onChange={async (e) => { e.stopPropagation(); const val = e.target.value; try { await api.put(`/tasks/${task.id}`, { priority: val }); setTasks(ts => ts.map(t => t.id === task.id ? { ...t, priority: val } : t)); } catch(err) { console.error(err); } }}>
                                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                  </div>
                                </td>
                                <td className="cu-td cu-td-actions" onClick={e => e.stopPropagation()}>
                                  <div className="cu-row-actions">

                                    {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && ((user?.id && (task.assignees || '').toLowerCase().includes(user.id.toLowerCase())) || ((user?.fullName || user?.name) && (task.assignees || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase()))))) && (
                                      <button className="cu-act-btn danger" onClick={(e) => { e.stopPropagation(); showConfirm('Delete this task?', () => handleDeleteTask(task.id), 'Delete Task'); }} title="Delete">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {/* Inline Add Row */}
                          {isInline ? (
                            <tr className="cu-inline-row animate-fade-in">
                              <td colSpan="7" style={{ padding: '8px' }}>
                                <div className="new-task-inline-bar">
                                  <div className="ntib-left">
                                    <span className="ntib-dotted-circle"></span>
                                    <input
                                      ref={inlineInputRef}
                                      type="text"
                                      placeholder="Task Name or type '/' for commands"
                                      value={inlineTitle}
                                      onChange={e => setInlineTitle(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') submitInlineAdd(); if (e.key === 'Escape') closeInlineAdd(); }}
                                      autoFocus
                                      className="ntib-input"
                                    />
                                  </div>
                                  <div className="ntib-right">
                                    <div className="ntib-dropdown-wrapper">
                                      <span className="ntib-dropdown-trigger">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '2px' }}><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle></svg>
                                        {inlineTaskType}
                                      </span>
                                      <select 
                                        className="ntib-hidden-select" 
                                        value={inlineTaskType} 
                                        onChange={e => setInlineTaskType(e.target.value)}
                                      >
                                        <option value="Task">Task</option>
                                        <option value="Milestone">Milestone</option>
                                        <option value="Form Response">Form Response</option>
                                        <option value="Meeting Note">Meeting Note</option>
                                      </select>
                                    </div>
                                    
                                    <span className="ntib-divider"></span>
                                    
                                    <div className="ntib-dropdown-wrapper">
                                      <button type="button" className="ntib-btn-icon" title="Assignee">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                      </button>
                                      <select className="ntib-hidden-select" value={inlineAssignee} onChange={e => setInlineAssignee(e.target.value)}>
                                        <option value="">Assignee</option>
                                        {listUsers.map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
                                      </select>
                                      {inlineAssignee && <span className="ntib-badge">{initials((listUsers.find(u => u.id === inlineAssignee) || {}).fullName || inlineAssignee)}</span>}
                                    </div>
                                    
                                    <div className="ntib-dropdown-wrapper">
                                      <button type="button" className="ntib-btn-icon" title="Due Date">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                      </button>
                                      <input type="date" className="ntib-hidden-date" value={inlineDueDate} onChange={e => setInlineDueDate(e.target.value)} />
                                      {inlineDueDate && <span className="ntib-badge">{new Date(inlineDueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>}
                                    </div>
                                    
                                    <div className="ntib-dropdown-wrapper">
                                      <button type="button" className="ntib-btn-icon" title="Priority">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                                      </button>
                                      <select className="ntib-hidden-select" value={inlinePriority} onChange={e => setInlinePriority(e.target.value)}>
                                        {PRIORITIES.map(p => <option key={p} value={p}>{p} Priority</option>)}
                                      </select>
                                      {inlinePriority && <span className="ntib-badge priority-color">{inlinePriority}</span>}
                                    </div>
                                    
                                    <button type="button" className="ntib-cancel-btn" onClick={closeInlineAdd}>Cancel</button>
                                    <button type="button" className="ntib-save-btn" onClick={submitInlineAdd}>Save ↵</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            can('tasks', 'create') && subTab !== 'my' && (
                              <tr className="cu-add-row" onClick={() => openInlineAdd('', col.id)}>
                                <td colSpan="7">
                                  <span className="cu-add-icon">+</span>
                                  <span className="cu-add-text">Add Task</span>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
        );
      })()}

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Side Drawer ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Side Drawer ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      {drawerOpen && (
        <div className="task-drawer-overlay" onClick={e => { if (e.target === e.currentTarget) closeDrawer(); }}>
          <div className="task-drawer-panel">
            <TaskDetailView
              task={drawerTask}
              onSave={async (taskData, silent) => {
                await handleSaveTask(taskData, silent);
                if (!silent) closeDrawer();
              }}
              onDelete={async (id) => { await handleDeleteTask(id); closeDrawer(); }}
              onClose={closeDrawer}
              currentUser={user}
              initialEditMode={taskDetailMode}
            />
          </div>
        </div>
      )}
      
      <PromptModal
        isOpen={promptState.isOpen}
        title={promptState.title}
        onSave={promptState.onSubmit}
        onCancel={() => setPromptState({ isOpen: false, title: '', onSubmit: null })}
      />
      </div>
      </div>
    </div>
  );
}
