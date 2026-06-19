/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  'To Do':         { bg: '#78350f', fg: '#ffffff', border: '1px solid #5c2c06', dotColor: '#78350f', isDone: false },
  'In Progress':   { bg: '#2563eb', fg: '#ffffff', dotColor: '#bfdbfe', isDone: false },
  'In Testing':    { bg: '#7c3aed', fg: '#ffffff', dotColor: '#e9d5ff', isDone: false },
  'Re-opened':     { bg: '#db2777', fg: '#ffffff', dotColor: '#fecdd3', isDone: false },
  'Prod Deployed': { bg: '#ea580c', fg: '#ffffff', dotColor: '#fde68a', isDone: false },
  'Prod Verified': { bg: '#0d9488', fg: '#ffffff', dotColor: '#bbf7d0', isDone: false },
  'Delivered':     { bg: '#16a34a', fg: '#ffffff', dotColor: '#99f6e4', isDone: true  },
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

const formatMobileDueDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const formatted = `${day}-${month}-${year}`;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const due = new Date(dateStr);
  due.setHours(0,0,0,0);
  const isOverdue = due < today;
  
  return { text: formatted, isOverdue };
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

const getDisplayId = (f) => {
  if (!f) return '';
  const no = f.taskNo || '';
  const digits = no.replace(/\D/g, '');
  const prefix = f.parentId ? 'S' : 'T';
  return `${prefix}${digits}`;
};

export function TaskTitleTooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  const handleMouseEnter = () => {
    if (!triggerRef.current || !text) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.top + window.scrollY - 8,
      left: rect.left + window.scrollX + rect.width / 2
    });
    setVisible(true);
  };

  const handleMouseLeave = () => {
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const handleScroll = () => {
      setVisible(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [visible]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="cu-task-title-wrapper"
        style={{ display: 'inline-flex', minWidth: 0, flex: 1 }}
      >
        {children}
      </div>
      {visible && createPortal(
        <div 
          className="cu-clickup-tooltip"
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            pointerEvents: 'none'
          }}
        >
          <div className="cu-clickup-tooltip-content">
            {text}
          </div>
          <div className="cu-clickup-tooltip-arrow" />
        </div>,
        document.body
      )}
    </>
  );
}

// ── ── Task Detail View (Separate Page) ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
export function TaskDetailView({ task, onSave, onDelete, onClose, currentUser, initialEditMode = false, tasks = [], onRefresh, onSelectTask }) {

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
      actualHoursStr: '0',
      approvedHoursStr: '0',
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
        approvedHoursStr: task.approvedHours !== undefined && task.approvedHours !== null ? String(task.approvedHours) : '0'
      };
      setForm(loadedForm);
      setInitialForm(loadedForm);
      if (task.parentId) {
        if (activeTab !== 'general' && activeTab !== 'worklog') {
          setActiveTab('general');
        }
      }
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
      'tag', 'taskType', 'isBillable', 'billableAmount', 'estimatedHours', 'approvedHours', 'actualHours', 'attachments'
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
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('');
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState('');
  const [newSubtaskPriority, setNewSubtaskPriority] = useState('Medium');
  const [subtaskSaving, setSubtaskSaving] = useState(false);

  const currentProjId = form.projectId 
    || (form.projectName ? projects.find(p => p.name === form.projectName)?.id : null)
    || (task && (task.projectId || (task.taskListId && taskLists.find(l => l.id === task.taskListId)?.projectId)));
  const currentProject = currentProjId ? projects.find(p => p.id === currentProjId) : null;
  const projectMemberIds = currentProject ? (currentProject.members || '').split(',').map(m => m.trim()).filter(Boolean) : [];
  
  const filteredUsers = (currentProject
    ? (projectMemberIds.length > 0
      ? users.filter(u => projectMemberIds.includes(u.id))
      : []
    )
    : users
  ).filter(u => u.status !== 'Inactive');

  const finalUsers = (() => {
    let list = [...filteredUsers];
    const currentAssigneeId = form.assignees;
    if (currentAssigneeId) {
      const ids = currentAssigneeId.split(',').map(i => i.trim()).filter(Boolean);
      ids.forEach(id => {
        if (!list.some(u => u.id === id)) {
          const assignedUserObj = users.find(u => u.id === id);
          if (assignedUserObj) {
            list.push(assignedUserObj);
          }
        }
      });
    }
    return list;
  })();


  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [mentionState, setMentionState] = useState({ isOpen: false, filter: '' });
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [editCommentSaving, setEditCommentSaving] = useState(false);
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
  const [commentPosting, setCommentPosting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const fileInputRef = useRef(null);
  const commentFileInputRef = useRef(null);
  const commentTextareaRef = useRef(null);
  const commentPostingRef = useRef(false);
  const taskSavingRef = useRef(false);
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
          const uploaderName = currentUser
            ? (currentUser.fullName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.name || currentUser.username || currentUser.email || 'Admin')
            : 'Admin';
          const uploadTimestamp = new Date().toISOString();
          const newEntry = `${data.secure_url}|${uploaderName}|${uploadTimestamp}`;
          const updatedAttachments = [...current, newEntry].join(',');
          set('attachments', updatedAttachments);
          setUploading(false);
          if (isEdit) {
            try {
              const updatedTask = { ...form, attachments: updatedAttachments };
              const { comments, taskList, ...payload } = updatedTask;
              await onSave(payload, true);
            } catch (err) {
              console.error('Failed to save uploaded file:', err);
            }
          }
          return;
        }
      } catch (err) {
        console.warn('Cloudinary upload failed, falling back to local base64 reader:', err);
      }
    }

    // Local base64 file reader fallback (100% robust offline & without Cloudinary credentials!)
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const current = form.attachments ? form.attachments.split(',') : [];
        const uploaderName = currentUser
          ? (currentUser.fullName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.name || currentUser.username || currentUser.email || 'Admin')
          : 'Admin';
        const uploadTimestamp = new Date().toISOString();
        const newEntry = `${reader.result}|${uploaderName}|${uploadTimestamp}`;
        const updatedAttachments = [...current, newEntry].join(',');
        set('attachments', updatedAttachments);
        setUploading(false);
        if (isEdit) {
          try {
            const updatedTask = { ...form, attachments: updatedAttachments };
            const { comments, taskList, ...payload } = updatedTask;
            await onSave(payload, true);
          } catch (err) {
            console.error('Failed to save uploaded file:', err);
          }
        }
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
    if (task?.createdAt) {
      const taskDate = new Date(task.createdAt).toISOString().split('T')[0];
      setWorkLogForm(prev => ({ ...prev, logDate: taskDate }));
    }
  }, [task]);

  useEffect(() => {
    const billedHours = workLogs.filter(log => log.isBilled).reduce((acc, log) => acc + (Number(log.hoursWorked) || 0), 0);
    const employeeTime = workLogs.filter(log => !log.isBilled).reduce((acc, log) => acc + (Number(log.hoursWorked) || 0), 0);
    
    setForm(prev => {
      if (prev.actualHours !== billedHours || prev.employeeHours !== employeeTime) {
        return {
          ...prev,
          actualHours: billedHours,
          actualHoursStr: String(billedHours),
          employeeHours: employeeTime
        };
      }
      return prev;
    });
  }, [workLogs]);

  const handleCommentFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadCommentFile(file);
  };

  const uploadCommentFile = async (file) => {
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
          setTimeout(() => commentTextareaRef.current?.focus(), 50);
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
        setTimeout(() => commentTextareaRef.current?.focus(), 50);
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

  const handleCommentPaste = async (e) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData || !clipboardData.items) return;
    if (commentUploading) return;

    // 1. Check for direct image blob (screenshots, snipping tool, etc.)
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const fileName = `pasted-image-${Date.now()}.${item.type.split('/')[1] || 'png'}`;
          const renamedFile = new File([file], fileName, { type: file.type });
          uploadCommentFile(renamedFile);
        }
        return;
      }
    }

    // 2. Check for HTML content with <img> tag (browser "Copy Image")
    const htmlData = clipboardData.getData('text/html');
    if (htmlData) {
      const imgMatch = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        const imgUrl = imgMatch[1];
        // Skip data: URLs that are too short (likely broken)
        if (imgUrl.startsWith('data:') && imgUrl.length < 50) return;
        e.preventDefault();
        setCommentUploading(true);
        try {
          const response = await fetch(imgUrl);
          const blob = await response.blob();
          if (blob && blob.size > 0 && blob.type.startsWith('image/')) {
            const ext = blob.type.split('/')[1] || 'png';
            const file = new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: blob.type });
            setCommentUploading(false);
            uploadCommentFile(file);
          } else {
            // If fetch didn't return a valid image, just attach the URL directly
            setCommentAttachment({ url: imgUrl, name: 'pasted-image.png' });
            setCommentUploading(false);
            setTimeout(() => commentTextareaRef.current?.focus(), 50);
          }
        } catch (err) {
          console.warn('Failed to fetch pasted image URL, attaching as link:', err);
          // If fetching fails (CORS), just attach the URL directly
          setCommentAttachment({ url: imgUrl, name: 'pasted-image.png' });
          setCommentUploading(false);
          setTimeout(() => commentTextareaRef.current?.focus(), 50);
        }
        return;
      }
    }

    // 3. Check for plain text URL that looks like an image
    const textData = clipboardData.getData('text/plain');
    if (textData && /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(textData.trim())) {
      e.preventDefault();
      setCommentAttachment({ url: textData.trim(), name: 'pasted-image.png' });
      setTimeout(() => commentTextareaRef.current?.focus(), 50);
      return;
    }

    // 4. If none of the above, allow default text paste behavior
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
    if (commentPostingRef.current || commentPosting) return;
    let commentText = text !== null ? text : newComment;
    if (!commentText.trim() && !commentAttachment) return;
    
    if (!parentId && commentAttachment) {
      commentText = `${commentText} [ATTACHMENT:${commentAttachment.url}|${commentAttachment.name}]`.trim();
    }

    commentPostingRef.current = true;
    setCommentPosting(true);
    try {
      await api.post(`/tasks/${task.id}/comments`, {
        text: commentText,
        author: currentUser?.fullName || currentUser?.name || 'User',
        authorId: currentUser?.id,
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
    } finally {
      commentPostingRef.current = false;
      setCommentPosting(false);
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

  const handleStartEditComment = (commentId, currentText) => {
    const { cleanText } = parseCommentAttachment(currentText);
    setEditingCommentId(commentId);
    setEditingCommentText(cleanText);
  };

  const handleSaveEditComment = async (commentId, originalText) => {
    if (editCommentSaving) return;
    const attachmentMatch = originalText.match(/\[ATTACHMENT:[^\]]+\]/);
    if (!editingCommentText.trim() && !attachmentMatch) return;
    let updatedText = editingCommentText.trim();
    if (attachmentMatch) {
      updatedText = `${updatedText} ${attachmentMatch[0]}`.trim();
    }
    setEditCommentSaving(true);
    try {
      await api.put(`/comments/${commentId}`, { text: updatedText });
      setEditingCommentId(null);
      setEditingCommentText('');
      fetchComments();
    } catch (err) {
      console.error('Edit comment error:', err);
    } finally {
      setEditCommentSaving(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    confirm('Are you sure you want to delete this comment?', async () => {
      try {
        await api.delete(`/comments/${commentId}`);
        fetchComments();
      } catch (err) {
        console.error('Delete comment error:', err);
      }
    }, 'Delete Comment');
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
      const taskDate = task?.createdAt ? new Date(task.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      setWorkLogForm({
        logDate: taskDate,
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

  const handleAddSubtaskDrawer = async () => {
    if (!newSubtaskTitle.trim()) {
      alert("Subtask title is required", "warning", "Required");
      return;
    }
    if (!newSubtaskAssignee?.trim()) {
      alert("Assignee is required", "warning", "Required");
      return;
    }
    setSubtaskSaving(true);
    try {
      await api.post('/tasks', {
        title: newSubtaskTitle.trim(),
        status: 'To Do',
        projectName: form.projectName || '',
        projectId: form.projectId || null,
        taskListId: form.taskListId || null,
        priority: newSubtaskPriority || 'Medium',
        assignees: newSubtaskAssignee || '',
        assignedDate: new Date().toISOString(),
        dueDate: newSubtaskDueDate ? new Date(newSubtaskDueDate).toISOString() : null,
        tag: form.tag || '',
        taskType: 'Task',
        isBillable: false,
        description: '',
        parentId: task.id
      });
      setNewSubtaskTitle('');
      setNewSubtaskAssignee('');
      setNewSubtaskDueDate('');
      setNewSubtaskPriority('Medium');
      if (onRefresh) {
        await onRefresh();
      }
      alert("Subtask created successfully!", "success", "Success");
    } catch (err) {
      console.error(err);
      alert("Failed to create subtask: " + err.message, "error", "Error");
    } finally {
      setSubtaskSaving(false);
    }
  };

  const handleDeleteSubtaskDrawer = async (subtaskId) => {
    confirm("Are you sure you want to delete this subtask?", async () => {
      try {
        await api.delete(`/tasks/${subtaskId}`);
        if (onRefresh) {
          await onRefresh();
        }
        alert("Subtask deleted successfully.", "success", "Deleted");
      } catch (err) {
        console.error(err);
        alert("Failed to delete subtask.", "error", "Error");
      }
    }, "Delete Subtask");
  };

  const handleOpenSubtask = (subtask) => {
    if (onSelectTask) {
      onSelectTask(subtask);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleInlineSave = async (updatedForm) => {
    if (!updatedForm.assignees || !updatedForm.assignees.trim()) {
      alert("Assignee is required", "warning", "Validation Error");
      setForm(form);
      return;
    }
    try {
      const { comments, taskList, ...payload } = updatedForm;
      await onSave(payload, true);
    } catch (err) {
      console.error('Failed inline save:', err);
      setForm(form);
    }
  };
  const submit = async () => {
    if (taskSavingRef.current || taskSaving) return;
    if (isEdit && !isChanged()) {
      onClose();
      return;
    }
    const newErrors = {};
    const titleRegex = /^.{3,100}$/;
    
    if (!form.taskNo || !form.taskNo.trim()) {
      newErrors.taskNo = "Task ID is required";
    }

    if (!form.title || !form.title.trim()) {
      newErrors.title = "Title is required";
    } else if (!titleRegex.test(form.title)) {
      newErrors.title = "Title must be 3-100 characters";
    }

    if (!form.assignees || !form.assignees.trim()) {
      newErrors.assignees = "Assignee is required";
    }

    if (form.parentId && (!form.dueDate || !form.dueDate.trim())) {
      newErrors.dueDate = "Due Date is required for subtasks";
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
    
    taskSavingRef.current = true;
    setTaskSaving(true);
    try {
      await onSave(payload);
    } catch (err) {
      console.error('Task save error:', err);
    } finally {
      taskSavingRef.current = false;
      setTaskSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
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


  const getAttachmentMetadata = (item, index) => {
    if (!item) return null;
    const parts = item.split('|');
    const url = parts[0];
    const encodedUploader = parts[1] || '';
    const encodedTime = parts[2] || '';

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

    // Attempt to find the uploader from comments or encoded metadata
    let uploaderName = encodedUploader;
    let uploadedTime = encodedTime ? new Date(encodedTime).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    
    if (!uploaderName || !uploadedTime) {
      if (comments && comments.length > 0) {
        const matchingComment = comments.find(c => c.text && c.text.includes(url));
        if (matchingComment) {
          if (!uploaderName) uploaderName = matchingComment.author;
          if (!uploadedTime) {
            uploadedTime = new Date(matchingComment.createdAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          }
        }
      }
    }

    // Try to extract timestamp from Cloudinary version prefix if still not set
    if (!uploadedTime && !isBase64) {
      const versionMatch = url.match(/\/v([0-9]{10})\//);
      if (versionMatch) {
        const timestamp = parseInt(versionMatch[1], 10) * 1000;
        if (!isNaN(timestamp)) {
          uploadedTime = new Date(timestamp).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
      }
    }

    if (!uploaderName) {
      uploaderName = currentUser
        ? (currentUser.fullName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.name || currentUser.username || currentUser.email || 'Admin')
        : 'Admin';
    }

    const uploadedBy = uploaderName;
    const uploadedOn = uploadedTime || (task?.createdAt 
      ? new Date(task.createdAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '12 May 2026, 10:30 AM');
    
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
    const isOwnComment = 
      (c.authorId && currentUser?.id && c.authorId.toLowerCase() === currentUser.id.toLowerCase()) ||
      (c.author && (currentUser?.fullName || currentUser?.name) && c.author.trim().toLowerCase() === (currentUser?.fullName || currentUser?.name).trim().toLowerCase());

    return (
      <div key={c.id} className={`saas-comment-card ${isReply ? 'is-reply' : ''}`}>
        <div className="comment-header">
          <div className={`comment-avatar-circle ${getAvatarColor(c.author)}`}>
            {initials(c.author)}
          </div>
          <div className="comment-content-block" style={{ width: '100%' }}>
            <div className="comment-author-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
              {isOwnComment && (
                <div className="comment-meta-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    title="Edit Comment"
                    onClick={() => handleStartEditComment(c.id, c.text)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#2563eb'}
                    onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    type="button"
                    title="Delete Comment"
                    onClick={() => handleDeleteComment(c.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              )}
            </div>
            {editingCommentId === c.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem', marginBottom: '0.4rem' }}>
                <textarea
                  value={editingCommentText}
                  onChange={e => setEditingCommentText(e.target.value)}
                  className="reply-inline-input"
                  disabled={editCommentSaving}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '50px',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    resize: 'vertical',
                    opacity: editCommentSaving ? 0.6 : 1,
                    pointerEvents: editCommentSaving ? 'none' : 'auto'
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEditComment(c.id, c.text);
                    }
                  }}
                />
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditingCommentText('');
                    }}
                    disabled={editCommentSaving}
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.72rem',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: 'white',
                      cursor: editCommentSaving ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      color: '#475569',
                      opacity: editCommentSaving ? 0.5 : 1
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEditComment(c.id, c.text)}
                    disabled={editCommentSaving}
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.72rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: '#2563eb',
                      color: 'white',
                      cursor: editCommentSaving ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      opacity: editCommentSaving ? 0.7 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    {editCommentSaving && (
                      <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                    )}
                    {editCommentSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
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
            )}
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
        <div className="comment-reply-input-wrapper animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
          <input 
            placeholder={commentPosting ? "Posting..." : "Write a reply..."} 
            value={replyText} 
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddComment(c.id, replyText); }}
            autoFocus
            className="reply-inline-input"
            style={{ flex: 1 }}
            disabled={commentPosting}
          />
          <button 
            type="button" 
            className="reply-submit-btn"
            onClick={() => handleAddComment(c.id, replyText)}
            disabled={!replyText.trim() || commentPosting}
          >
            Reply
          </button>
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
          <span className="saas-breadcrumb-active">{getDisplayId(form)}</span>
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
            disabled={taskSaving}
            style={{
              cursor: taskSaving ? 'not-allowed' : 'pointer',
              opacity: taskSaving ? 0.7 : 1
            }}
          >
            {taskSaving ? (
              <span>{isEdit ? 'Saving...' : 'Creating...'}</span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                {isEdit ? 'Save' : 'Create Task'}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="saas-main-container">
        {/* Left Side Content Pane */}
        <div className="saas-content-pane">
          {/* Header area with ID & Status */}
          <div className="saas-detail-title-block" style={{ marginBottom: '1.5rem', marginTop: '0.5rem' }}>
            {task?.parentId && (
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontWeight: 600 }}>Subtask of:</span>
                <button 
                  onClick={() => {
                    const parent = tasks.find(t => t.id === task.parentId);
                    if (parent && onSelectTask) onSelectTask(parent);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                    fontSize: '0.82rem'
                  }}
                >
                  {tasks.find(t => t.id === task.parentId)?.title || 'Parent Task'}
                </button>
              </div>
            )}
            {isEditing ? (
              <textarea 
                value={form.title} 
                onChange={e => set('title', e.target.value.slice(0, 100))} 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                  }
                }}
                className="saas-title-input"
                placeholder="Task Title *"
                maxLength={100}
                rows={2}
                style={{ 
                  border: 'none',
                  borderBottom: '1px solid #e2e8f0', 
                  paddingBottom: '0.5rem', 
                  fontSize: '1.15rem', 
                  fontWeight: '600', 
                  width: '100%', 
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                  lineHeight: '1.4',
                  background: 'transparent',
                  boxSizing: 'border-box'
                }}
              />
            ) : (
              <h1 className="saas-detail-title" style={{ fontSize: '1.15rem', fontWeight: '600', margin: 0, lineHeight: '1.4', wordBreak: 'break-word' }}>{form.title || 'Untitled Task'}</h1>
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
            <button 
              className={`saas-tab-header-btn ${activeTab === 'worklog' ? 'active' : ''}`}
              onClick={() => setActiveTab('worklog')}
            >
              Work Log
            </button>
            {currentUser?.role?.toLowerCase() === 'admin' && !task?.parentId && (
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
              Attachments ({form.attachments ? form.attachments.split(',').filter(Boolean).length : 0})
            </button>
            {isEdit && !task?.parentId && (
              <button 
                className={`saas-tab-header-btn ${activeTab === 'subtasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('subtasks')}
              >
                Subtasks ({tasks.filter(t => t.parentId === task.id).length})
              </button>
            )}
            {currentUser?.role?.toLowerCase() === 'admin' && !task?.parentId && (
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
                  
                  <span className="saas-meta-label" style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><IconAssignee /> Assignee *</span>
                  <span className="saas-meta-value">
                    <select value={form.assignees || ''} onChange={e => { const updated = { ...form, assignees: e.target.value }; setForm(updated); if (!isEditing) handleInlineSave(updated); }} className="saas-grid-select" style={{ width: '100%', padding: '0.4rem', border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}>
                      <option value="">Select Assignee...</option>
                      {finalUsers.map(u => {
                        const displayName = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown';
                        return <option key={u.id} value={u.id}>{displayName}</option>;
                      })}
                    </select>
                  </span>
                </div>

                {/* Row 2: Dates (Due Date -> Delivery Date) */}
                <div className="saas-meta-row saas-meta-row-2col" style={{ gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="saas-meta-label" style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><IconCalendar /> Dates</span>
                  <span className="saas-meta-value">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>Due:</span>
                      <div className="saas-date-input-wrapper">
                        <input 
                          type="date" 
                          className="saas-detail-date-input"
                          value={form.dueDate ? new Date(form.dueDate).toISOString().split('T')[0] : ''} 
                          onChange={e => set('dueDate', e.target.value)} 
                          style={{ border: '1px solid #e2e8f0', borderRadius: '4px', background: '#f8fafc', padding: '0.15rem 0.3rem', fontSize: '0.8rem', color: '#64748b', width: '120px', cursor: 'pointer', fontWeight: 600 }} 
                          title="Due Date"
                        />
                        <span className={`saas-date-display-overlay${!form.dueDate ? ' saas-date-empty' : ''}`}>
                          {form.dueDate ? new Date(form.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'dd-mm-yyyy'}
                        </span>
                      </div>
                      
                      <span className="saas-date-arrow" style={{ color: '#94a3b8', fontSize: '0.8rem' }}>→</span>

                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>Delivery:</span>
                      <div className="saas-date-input-wrapper">
                        <input 
                          type="date" 
                          className="saas-detail-date-input"
                          value={form.deliveredDate ? new Date(form.deliveredDate).toISOString().split('T')[0] : ''} 
                          onChange={e => set('deliveredDate', e.target.value)} 
                          style={{ border: '1px solid #e2e8f0', borderRadius: '4px', background: '#f8fafc', padding: '0.15rem 0.3rem', fontSize: '0.8rem', color: '#64748b', width: '120px', cursor: 'pointer', fontWeight: 600 }} 
                          title="Delivery Date"
                        />
                        <span className={`saas-date-display-overlay${!form.deliveredDate ? ' saas-date-empty' : ''}`}>
                          {form.deliveredDate ? new Date(form.deliveredDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'dd-mm-yyyy'}
                        </span>
                      </div>
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
                    <textarea value={form.description} onChange={e => set('description', e.target.value)} className="saas-grid-textarea" style={{ minHeight: '120px', width: '100%', maxWidth: '100%', border: 'none', background: '#f8fafc', outline: 'none', fontSize: '0.95rem', padding: '1rem', borderRadius: '8px', boxSizing: 'border-box' }} placeholder="Add description, or write with AI..." />
                  ) : (
                    <div style={{ color: form.description ? '#334155' : '#94a3b8', whiteSpace: 'pre-wrap', fontSize: '0.95rem', minHeight: '60px', cursor: 'text', padding: '0.5rem', wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }} onClick={() => setIsEditing(true)}>
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
                disabled={taskSaving}
                style={{ 
                  cursor: taskSaving ? 'not-allowed' : 'pointer',
                  opacity: taskSaving ? 0.7 : 1
                }}
              >
                {taskSaving ? (
                  <span>{isEdit ? 'Saving...' : 'Creating...'}</span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    {isEdit ? 'Save' : 'Create Task'}
                  </>
                )}
              </button>
            </div>
          )}
          </>
        )}

            {activeTab === 'billing' && currentUser?.role?.toLowerCase() === 'admin' && (
              <div className="saas-billing-pane animate-fade-in" style={{ padding: '0.25rem 0' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: '0 0 2rem 0', color: '#0f172a' }}>
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
                                approvedHoursStr: '0',
                                actualHoursStr: '0'
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
                              value={form.approvedHoursStr !== undefined ? form.approvedHoursStr : (form.approvedHours !== undefined && form.approvedHours !== null ? String(form.approvedHours) : '0')}
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
                              placeholder="e.g. 40"
                            />
                          ) : (
                            <span style={{ fontSize: '0.92rem', color: '#0f172a', fontWeight: '500' }}>
                              {String(form.approvedHours || 0)}
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
                            {String(form.actualHours || 0)}
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
                            {String(Math.max(0, (form.approvedHours || 0) - (form.actualHours || 0)))}
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


            {activeTab === 'worklog' && (
              <div className="saas-details-grid animate-fade-in" style={{ display: 'block' }}>
                {!isEdit ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '1rem', opacity: 0.5 }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>Please create and save the task first before adding work logs.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', maxWidth: '420px', boxSizing: 'border-box' }}>
                      <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '0.95rem', fontWeight: '700' }}>Add Work Log</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label className="saas-field-label" style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Date</label>
                          <input type="date" className="saas-input" value={workLogForm.logDate} disabled={true} style={{ width: '100%', boxSizing: 'border-box', height: '36px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#e2e8f0', color: '#64748b', cursor: 'not-allowed' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label className="saas-field-label" style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Worked Hrs</label>
                          <input type="number" step="0.25" className="saas-input" placeholder="e.g. 2.5" value={workLogForm.hoursWorked} onChange={e => setWorkLogForm({...workLogForm, hoursWorked: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', height: '36px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="saas-btn-primary" onClick={() => handleAddWorkLog(false)} disabled={workLogSaving} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                          {workLogSaving ? 'Saving...' : (workLogForm.id ? 'Update Work Log' : 'Add Work Log')}
                        </button>
                        {workLogForm.id && (
                          <button
                            className="saas-btn-secondary"
                            onClick={() => {
                              const taskDate = task?.createdAt ? new Date(task.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                              setWorkLogForm({ logDate: taskDate, hoursWorked: '', description: '', isBilled: false, id: null });
                            }}
                            disabled={workLogSaving}
                            style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            Cancel Edit
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '0.95rem', fontWeight: '700' }}>Recent Work Logs</h4>
                      {workLogs.filter(log => !log.isBilled).length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No work logs found for this task.</p>
                      ) : (
                        <div className="table-responsive">
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Date</th>
                                <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>User</th>
                                <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Worked Hrs</th>
                                <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {workLogs.filter(log => !log.isBilled).map(log => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }} className="attachment-table-row">
                                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#475569' }}>{formatDate(log.logDate)}</td>
                                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#475569' }}>{log.user?.fullName || log.user?.firstName || 'Unknown'}</td>
                                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#0f172a', fontSize: '0.82rem' }}>{log.hoursWorked}h</td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                      <button title="Edit" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', background: 'white', cursor: 'pointer' }} onClick={() => {
                                        setWorkLogForm({
                                          id: log.id,
                                          logDate: new Date(log.logDate).toISOString().split('T')[0],
                                          hoursWorked: String(log.hoursWorked),
                                          description: log.description || '',
                                          isBilled: false
                                        });
                                      }}>
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                      </button>
                                      <button title="Delete" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', background: '#fef2f2', cursor: 'pointer' }} onClick={() => handleDeleteWorkLog(log.id)}>
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
                      <input 
                        type="date" 
                        className="saas-input" 
                        value={workLogForm.logDate} 
                        onChange={e => setWorkLogForm({...workLogForm, logDate: e.target.value})} 
                        style={{ width: '100%', boxSizing: 'border-box', height: '36px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label className="saas-field-label" style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Hours</label>
                      <input type="number" step="0.25" className="saas-input" placeholder="e.g. 2.5" value={workLogForm.hoursWorked} onChange={e => setWorkLogForm({...workLogForm, hoursWorked: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', height: '36px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label className="saas-field-label" style={{ fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>Description</label>
                    <input type="text" className="saas-input" placeholder="What did you work on?" value={workLogForm.description} onChange={e => setWorkLogForm({...workLogForm, description: e.target.value})} style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="saas-btn-primary" onClick={() => handleAddWorkLog(true)} disabled={workLogSaving} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                      {workLogSaving ? 'Saving...' : (workLogForm.id ? 'Update Billing Log' : 'Add Billing Log')}
                    </button>
                    {workLogForm.id && (
                      <button
                        className="saas-btn-secondary"
                        onClick={() => {
                          const taskDate = task?.createdAt ? new Date(task.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                          setWorkLogForm({ logDate: taskDate, hoursWorked: '', description: '', isBilled: false, id: null });
                        }}
                        disabled={workLogSaving}
                        style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
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
                        <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Date</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>User</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Billed Hours</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Description</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workLogs.filter(log => log.isBilled).map(log => (
                          <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }} className="attachment-table-row">
                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#475569' }}>{formatDate(log.logDate)}</td>
                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#475569' }}>{log.user?.fullName || log.user?.firstName || 'Unknown'}</td>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#0f172a', fontSize: '0.82rem' }}>{log.hoursWorked}h</td>
                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#475569' }}>{log.description || '-'}</td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <button title="Edit" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', background: 'white', cursor: 'pointer' }} onClick={() => {
                                  setWorkLogForm({
                                    id: log.id,
                                    logDate: new Date(log.logDate).toISOString().split('T')[0],
                                    hoursWorked: log.hoursWorked,
                                    description: log.description || '',
                                    isBilled: true
                                  });
                                }}>
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button title="Delete" style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', background: '#fef2f2', cursor: 'pointer' }} onClick={() => handleDeleteWorkLog(log.id)}>
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
              <div className="saas-attachments-pane animate-fade-in" style={{ padding: '0.25rem 0' }}>
                
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
                        <th style={{ width: '28%', padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>File Name</th>
                        <th style={{ width: '18%', padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Uploaded By</th>
                        <th style={{ width: '28%', padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Uploaded On</th>
                        <th style={{ width: '11%', padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>File Size</th>
                        <th style={{ width: '15%', padding: '0.85rem 0.5rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
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
                        form.attachments.split(',').filter(Boolean).map((item, index) => {
                          const meta = getAttachmentMetadata(item, index);
                          if (!meta) return null;
                          const url = meta.url;
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
                              <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                  
                                  {/* Download Icon Button */}
                                  <button 
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(meta.url);
                                        const blob = await response.blob();
                                        const blobUrl = window.URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = blobUrl;
                                        link.download = meta.fileName || 'download';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        window.URL.revokeObjectURL(blobUrl);
                                      } catch (err) {
                                        // Fallback: open in new tab if fetch fails
                                        window.open(meta.url, '_blank');
                                      }
                                    }}
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
                                      cursor: 'pointer'
                                    }}
                                    title="Download File"
                                    className="action-icon-btn"
                                  >
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                  </button>

                                  {/* Delete/Action Button */}
                                  {(isEditing || canEdit) && (
                                    <button 
                                      type="button" 
                                      onClick={async () => {
                                        confirm('Are you sure you want to remove this attachment?', async () => {
                                          const current = form.attachments ? form.attachments.split(',') : [];
                                          const filtered = current.filter(u => u !== item).join(',');
                                          
                                          set('attachments', filtered);
                                          if (isEdit) {
                                            try {
                                              const updatedTask = { ...form, attachments: filtered };
                                              const { comments, taskList, ...payload } = updatedTask;
                                              await onSave(payload, true);
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

            {activeTab === 'subtasks' && isEdit && (
              <div className="saas-subtasks-pane animate-fade-in" style={{ padding: '0.25rem 0' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '700', margin: '0 0 1.5rem 0', color: '#0f172a' }}>
                  Subtasks ({tasks.filter(t => t.parentId === task.id).length})
                </h2>
                
                {/* Form to add subtask */}
                <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '0.9rem', fontWeight: '700' }}>Add New Subtask</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Subtask Title</label>
                      <input 
                        type="text" 
                        className="saas-input" 
                        placeholder="Subtask name..." 
                        value={newSubtaskTitle} 
                        onChange={e => setNewSubtaskTitle(e.target.value)} 
                        onKeyDown={e => { if (e.key === 'Enter') handleAddSubtaskDrawer(); }}
                        style={{ width: '100%', boxSizing: 'border-box', height: '36px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Assignee</label>
                      <select 
                        className="saas-input" 
                        value={newSubtaskAssignee} 
                        onChange={e => setNewSubtaskAssignee(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', height: '36px', padding: '0 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="">Unassigned</option>
                        {filteredUsers.map(u => {
                          const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown';
                          return <option key={u.id} value={u.id}>{n}</option>;
                        })}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Priority</label>
                      <select 
                        className="saas-input" 
                        value={newSubtaskPriority} 
                        onChange={e => setNewSubtaskPriority(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', height: '36px', padding: '0 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      >
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Due Date</label>
                      <input 
                        type="date" 
                        className="saas-input" 
                        value={newSubtaskDueDate} 
                        onChange={e => setNewSubtaskDueDate(e.target.value)} 
                        style={{ width: '100%', boxSizing: 'border-box', height: '36px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button 
                        className="saas-btn-primary" 
                        onClick={handleAddSubtaskDrawer} 
                        disabled={subtaskSaving}
                        style={{ width: '100%', height: '36px', padding: '0 1rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      >
                        {subtaskSaving ? 'Adding...' : 'Add Subtask'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subtask List Table */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Subtask Title</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Assignee</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Due Date</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Priority</th>
                          <th style={{ padding: '0.85rem 1rem', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.filter(t => t.parentId === task.id).length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                              No subtasks created for this task yet.
                            </td>
                          </tr>
                        ) : (
                          tasks.filter(t => t.parentId === task.id).map(sub => {
                            const subAssigneeObj = users.find(u => u.id === sub.assignees);
                            const subAssigneeName = subAssigneeObj ? (subAssigneeObj.fullName || `${subAssigneeObj.firstName || ''} ${subAssigneeObj.lastName || ''}`.trim() || 'Unknown') : 'Unassigned';
                            const subRelDate = formatRelativeDueDate(sub.dueDate);
                            const subMeta = STATUS_HEADER_META[sub.status] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', isDone: false };

                            return (
                              <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }} className="attachment-table-row">
                                <td style={{ padding: '0.85rem 1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <button
                                      onClick={() => handleOpenSubtask(sub)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#2563eb',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        padding: 0,
                                        fontSize: '0.82rem',
                                        textDecoration: 'underline'
                                      }}
                                      title="Open subtask details"
                                    >
                                      {sub.title || 'Untitled Subtask'}
                                    </button>
                                    {sub.taskNo && <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>({getDisplayId(sub)})</span>}
                                  </div>
                                </td>
                                <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#475569' }}>
                                  {subAssigneeName}
                                </td>
                                <td style={{ padding: '0.85rem 1rem' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: '700',
                                    background: subMeta.bg,
                                    color: subMeta.fg
                                  }}>
                                    {(sub.status || 'To Do').toUpperCase()}
                                  </span>
                                </td>
                                <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: subRelDate?.isOverdue ? '#ef4444' : '#475569' }}>
                                  {sub.dueDate ? new Date(sub.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'}
                                </td>
                                <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <PriorityFlag priority={sub.priority} />
                                    {sub.priority}
                                  </span>
                                </td>
                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <button
                                      title="Edit Subtask"
                                      style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', background: 'white', cursor: 'pointer' }}
                                      onClick={() => handleOpenSubtask(sub)}
                                    >
                                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                      </svg>
                                    </button>
                                    <button 
                                      title="Delete Subtask" 
                                      style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', background: '#fef2f2', cursor: 'pointer' }} 
                                      onClick={() => handleDeleteSubtaskDrawer(sub.id)}
                                    >
                                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
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
                <textarea 
                  ref={commentTextareaRef}
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
                    if (e.key === 'Enter' && !e.shiftKey) { 
                      e.preventDefault();
                      if (!commentUploading && !commentPosting) {
                        handleAddComment(); 
                      }
                    } 
                  }} 
                  onPaste={handleCommentPaste}
                  placeholder={commentUploading ? "Uploading..." : commentPosting ? "Posting..." : "Write a comment..."}
                  className="comment-main-text-input"
                  style={{
                    paddingRight: '4.5rem',
                    resize: 'none',
                    height: '38px',
                    minHeight: '38px',
                    boxSizing: 'border-box',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    borderRadius: '20px'
                  }}
                  disabled={commentUploading || commentPosting}
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
                <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span 
                    className="comment-emoji-icon" 
                    title="Insert Emoji"
                    onClick={() => !commentPosting && !commentUploading && setShowEmojiPicker(!showEmojiPicker)}
                    style={{ cursor: (commentPosting || commentUploading) ? 'not-allowed' : 'pointer', userSelect: 'none', opacity: (commentPosting || commentUploading) ? 0.3 : 0.6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                  </span>
                  
                  {/* Paperclip button */}
                  <span 
                    className="comment-paperclip-icon" 
                    title="Attach File to Comment"
                    onClick={() => !commentPosting && !commentUploading && commentFileInputRef.current && commentFileInputRef.current.click()}
                    style={{ cursor: (commentPosting || commentUploading) ? 'not-allowed' : 'pointer', userSelect: 'none', opacity: (commentPosting || commentUploading) ? 0.3 : 0.6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                disabled={(!newComment.trim() && !commentAttachment) || commentUploading || commentPosting}
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
        <div className="col-clickup-badge" style={{ backgroundColor: meta.bg, color: meta.fg, border: meta.border || 'none' }}>
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
export default function Tasks({ user, initialSelectedTask, onClearInitialTask, onDetailViewChange, initialAssigneeFilter, onClearAssigneeFilter, initialTaskId, onTaskSelect }) {
  const isTeamLeadOrAdmin = user?.role?.toLowerCase() === 'team lead' || user?.role?.toLowerCase() === 'admin';
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [subTab, setSubTab]     = useState('my');
  const [expandedSubtaskIds, setExpandedSubtaskIds] = useState({});
  const [addingSubtaskParentId, setAddingSubtaskParentId] = useState(null);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskAssignee, setSubtaskAssignee] = useState('');
  const [subtaskDueDate, setSubtaskDueDate] = useState('');
  const [subtaskPriority, setSubtaskPriority] = useState('Medium');

  const toggleSubtaskExpand = (taskId) => {
    setExpandedSubtaskIds(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };
  const mobileSortBy = 'dueDate';
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

  const [expandedGroupId, setExpandedGroupId] = useState('To Do');
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
    setExpandedGroupId(prev => prev === key ? null : key);
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
      if (onTaskSelect) onTaskSelect(getDisplayId(initialSelectedTask));
      if (onClearInitialTask) onClearInitialTask();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedTask]);

  // Auto-open task from URL deep-link (e.g. /tasks/taskId)
  const initialTaskIdHandled = useRef(false);
  useEffect(() => {
    if (initialTaskId && !initialTaskIdHandled.current && tasks.length > 0) {
      initialTaskIdHandled.current = true;
      const task = tasks.find(t => getDisplayId(t) === initialTaskId);
      if (task) {
        setDrawerTask(task);
        setDrawerOpen(true);
        setTaskDetailMode(false);
      }
    }
  }, [initialTaskId, tasks]);

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
  const { alert, confirm: showConfirm, toast } = useAlert();

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
    if (isSaving) return;
    const title = inlineTitle.trim();
    if (!title) {
      toast('Task name is required', 'warning');
      return;
    }
    if (!inlineAssignee?.trim()) {
      toast('Assignee is required', 'warning');
      return;
    }
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
      toast('Task created successfully!', 'success');
      closeInlineAdd();
    } catch (err) {
      console.error('Inline add failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const submitSubtask = async (parentTask) => {
    if (isSaving) return;
    const title = subtaskTitle.trim();
    if (!title) {
      toast('Subtask name is required', 'warning');
      return;
    }
    if (!subtaskAssignee?.trim()) {
      toast('Assignee is required', 'warning');
      return;
    }
    if (!subtaskDueDate) {
      toast('Due Date is required', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      await api.post('/tasks', {
        title,
        status: 'To Do',
        projectName: parentTask.projectName || '',
        projectId: parentTask.projectId || null,
        taskListId: parentTask.taskListId || null,
        priority: subtaskPriority || 'Medium',
        assignees: subtaskAssignee || '',
        assignedDate: new Date().toISOString(),
        dueDate: subtaskDueDate ? new Date(subtaskDueDate).toISOString() : null,
        tag: parentTask.tag || '',
        taskType: 'Task',
        isBillable: false,
        description: '',
        parentId: parentTask.id
      });
      const data = await api.get('/tasks');
      setTasks(data || []);
      setAddingSubtaskParentId(null);
      setSubtaskTitle('');
      setSubtaskAssignee('');
      setSubtaskDueDate('');
      setSubtaskPriority('Medium');
      toast('Subtask created successfully!', 'success');
    } catch (err) {
      console.error('Subtask add failed:', err);
      alert('Failed to create subtask: ' + err.message, 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const openTaskDetail = (task, editMode = false) => {
    setDrawerTask(task);
    setTaskDetailMode(editMode);
    setDrawerOpen(true);
    if (onTaskSelect) onTaskSelect(getDisplayId(task));
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
      let savedTask = null;
      if (taskData.id) {
        savedTask = await api.put(`/tasks/${taskData.id}`, taskData);
        if (!silent) toast('Task updated successfully!', 'success');
      } else {
        savedTask = await api.post('/tasks', taskData);
        toast('Task created successfully!', 'success');
      }
      const data = await api.get('/tasks');
      setTasks(data || []);
      return savedTask;
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
      toast('Task deleted successfully.', 'success');
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

  const closeDrawer = () => { setDrawerOpen(false); setDrawerTask(null); if (onTaskSelect) onTaskSelect(null); };

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

  const getFilteredUsersForProject = (projId, currentAssigneeId = null) => {
    const activeListUsers = listUsers.filter(u => u.status !== 'Inactive');
    if (!projId) return activeListUsers;
    const project = taskProjects.find(p => p.id === projId);
    if (!project) return activeListUsers;
    const memberIds = (project.members || '').split(',').map(m => m.trim()).filter(Boolean);
    if (memberIds.length === 0) return [];
    
    const filtered = listUsers.filter(u => memberIds.includes(u.id) && u.status !== 'Inactive');
    if (currentAssigneeId) {
      const ids = currentAssigneeId.split(',').map(i => i.trim()).filter(Boolean);
      let list = [...filtered];
      ids.forEach(id => {
        if (!list.some(u => u.id === id)) {
          const extraUser = listUsers.find(u => u.id === id);
          if (extraUser) {
            list.push(extraUser);
          }
        }
      });
      return list;
    }
    return filtered;
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

  if (drawerOpen) {
    return (
      <TaskDetailView
        task={drawerTask}
        tasks={tasks}
        onRefresh={fetchTasks}
        onSelectTask={(t) => setDrawerTask(t)}
        onSave={async (taskData, silent) => {
          const saved = await handleSaveTask(taskData, silent);
          if (!silent) {
            closeDrawer();
          } else if (saved) {
            setDrawerTask(saved);
          }
        }}
        onDelete={async (id) => { await handleDeleteTask(id); closeDrawer(); }}
        onClose={closeDrawer}
        currentUser={user}
        initialEditMode={taskDetailMode}
      />
    );
  }

  return (
    <div className="tasks-3col-layout">


      {/* Ã¢â€¢ÂÃ¢â€¢Â MAIN CONTENT Ã¢â€¢ÂÃ¢â€¢Â */}
      <div className={`tasks-main-content ${viewMode === 'kanban' || viewMode === 'schedule' ? 'kanban-mode-active' : ''}`}>
      <div className={`kanban-root ${viewMode === 'kanban' || viewMode === 'schedule' ? 'kanban-scroll-layout' : ''}`} onDragEnd={handleDragEnd}>
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
          <div className="tasks-filter-row">
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
                <>
                  <option value="">All Projects</option>
                  {taskProjects.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </>
              )}
            </select>
            {filterDate ? (
              <input 
                type="date" 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)}
                title="Filter by task date"
                style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', background: '#f8fafc', outline: 'none', cursor: 'pointer' }}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const yyyy = today.getFullYear();
                  const mm = String(today.getMonth() + 1).padStart(2, '0');
                  const dd = String(today.getDate()).padStart(2, '0');
                  setFilterDate(`${yyyy}-${mm}-${dd}`);
                }}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#94a3b8', background: '#f8fafc', outline: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Date
              </button>
            )}
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
            onAddTask: () => {
              const projName = filterProjectName || '';
              const proj = projName ? taskProjects.find(p => p.name === projName) : null;
              openNewTask('To Do', projName, proj?.id || null);
            }
          },
          {
            id: 'today',
            title: "Today's Tasks",
            tasks: todayTasks,
            colorMeta: { bg: '#eff6ff', fg: '#1d4ed8', dotColor: '#3b82f6' },
            onAddTask: () => {
              const todayStr = getLocalDateString(new Date());
              const projName = filterProjectName || '';
              const proj = projName ? taskProjects.find(p => p.name === projName) : null;
              setDrawerTask({
                status: 'To Do',
                projectName: projName,
                projectId: proj?.id || null,
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
              setDrawerOpen(true);
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
              const projName = filterProjectName || '';
              const proj = projName ? taskProjects.find(p => p.name === projName) : null;
              setDrawerTask({
                status: 'To Do',
                projectName: projName,
                projectId: proj?.id || null,
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
              setDrawerOpen(true);
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
                showAdd={false}
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
              onAddTaskClick={(statusId) => {
                const projName = filterProjectName || '';
                const proj = projName ? taskProjects.find(p => p.name === projName) : null;
                openNewTask(statusId, projName, proj?.id || null);
              }}
              showAdd={false}
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
          
          let finalProjectGroups = Object.values(projectGroupsMap)
            .filter(projGroup => projGroup.lists.length > 0);

          if (filterProjectName) {
            finalProjectGroups = finalProjectGroups.filter(projGroup => projGroup.name === filterProjectName);
          }

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
            <>
            {/* ── Mobile ClickUp-style All Tasks (hidden on desktop) ── */}
            <div className="cu-mobile-alltasks-list">
              {finalProjectGroups.map(projGroup => {
                const allProjTasks = projGroup.lists.flatMap(l => l.tasks);
                if (allProjTasks.length === 0) return null;
                return (
                  <div key={projGroup.id} className="cu-mob-proj-section">


                    {COLUMNS.map(col => {
                      const statusTasks = allProjTasks.filter(t => (t.status || 'To Do') === col.id);
                      if (statusTasks.length === 0) return null;
                      const meta = STATUS_HEADER_META[col.id] || { bg: '#f1f5f9', fg: '#ffffff', dotColor: '#94a3b8' };
                      return (
                        <div key={col.id} className="cu-mob-status-group">
                          <div className="cu-mob-status-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <svg viewBox="0 0 10 6" width="9" height="9" fill="#94a3b8"><path d="M0 0l5 6 5-6z"/></svg>
                              <span className="cu-mob-status-pill" style={{ background: meta.bg, color: meta.fg, border: meta.border || 'none', fontWeight: col.id === 'To Do' ? '700' : '600' }}>
                                {col.label.toUpperCase()}
                              </span>
                              <span className="cu-mob-status-count">{statusTasks.length} Task{statusTasks.length !== 1 ? 's' : ''}</span>
                            </div>
                            {can('tasks', 'create') && (
                              <button className="cu-mob-add-btn" onClick={e => {
                                e.stopPropagation();
                                const list = projGroup.lists[0];
                                const p = taskProjects.find(pr => pr.id === projGroup.id);
                                openNewTask(col.id, projGroup.name, projGroup.id, list && !String(list.id).startsWith('gen_') ? list.id : null, p ? p.clientId : null);
                              }}>+ Add</button>
                            )}
                          </div>
                          {(() => {
                             const mainTasks = statusTasks.filter(t => !t.parentId || !allProjTasks.some(p => p.id === t.parentId));
                             
                             return mainTasks.flatMap(task => {
                               const subTasks = tasks.filter(t => t.parentId === task.id);
                               const isExpanded = !!expandedSubtaskIds[task.id];
                               
                               const parentRow = (
                                 <div key={task.id} className="cu-mob-task-row" onClick={() => openTaskDetail(task, false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                                     {subTasks.length > 0 ? (
                                        <button
                                          style={{ background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSubtaskExpand(task.id);
                                          }}
                                        >
                                          <svg viewBox="0 0 10 6" width="7" height="7" fill="currentColor" style={{ transform: isExpanded ? "none" : "rotate(-90deg)", transition: "transform 0.15s", color: "#64748b" }}><path d="M0 0l5 6 5-6z"/></svg>
                                        </button>
                                      ) : (
                                        <button
                                          style={{ background: 'none', border: 'none', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, visibility: 'hidden' }}
                                          disabled
                                        >
                                          <svg viewBox="0 0 10 6" width="7" height="7"><path d="M0 0l5 6 5-6z"/></svg>
                                        </button>
                                      )}
                                     <span className="cu-mob-task-title" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                       {task.title || 'Untitled Task'}
                                     </span>
                                     {subTasks.length > 0 && (
                                       <span 
                                         style={{ 
                                           display: 'inline-flex', 
                                           alignItems: 'center', 
                                           gap: '2px', 
                                           fontSize: '0.65rem', 
                                           fontWeight: '700', 
                                           color: '#2563eb', 
                                           background: '#eff6ff', 
                                           padding: '1px 4px', 
                                           borderRadius: '3px',
                                           border: '1px solid #bfdbfe'
                                         }}
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           toggleSubtaskExpand(task.id);
                                         }}
                                       >
                                         {subTasks.length}
                                       </span>
                                     )}
                                   </div>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                     <button
                                        className="cu-mob-hover-subtask-btn"
                                        onClick={(e) => {
                                         e.stopPropagation();
                                         setExpandedSubtaskIds(prev => ({ ...prev, [task.id]: true }));
                                         setAddingSubtaskParentId(task.id);
                                         setSubtaskTitle('');
                                         setSubtaskAssignee('');
                                         setSubtaskDueDate('');
                                         setSubtaskPriority('Medium');
                                       }}
                                       title="Add Subtask"
                                     >
                                       <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                         <line x1="12" y1="5" x2="12" y2="19"></line>
                                         <line x1="5" y1="12" x2="19" y2="12"></line>
                                       </svg>
                                     </button>
                                   </div>
                                 </div>
                               );
                               
                               const rows = [parentRow];
                               
                               if (isExpanded) {
                                 subTasks.forEach(sub => {
                                   rows.push(
                                     <div key={sub.id} className="cu-mob-task-row subtask-row" onClick={() => openTaskDetail(sub, false)} style={{ paddingLeft: '1.25rem', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                                         <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold', userSelect: 'none' }}>└</span>
                                         <span className="cu-mob-task-title" style={{ color: '#475569', fontSize: '0.85rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                           {sub.title || 'Untitled Subtask'}
                                         </span>
                                       </div>
                                     </div>
                                   );
                                 });
                               }
                               
                               const isAddingSubtask = addingSubtaskParentId === task.id;
                               if (isAddingSubtask) {
                                 rows.push(
                                   <div key={`mob-add-sub-${task.id}`} className="cu-mob-task-row" style={{ paddingLeft: '1.25rem', background: '#f8fafc' }}>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
                                       <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold', userSelect: 'none' }}>└</span>
                                       <input
                                         type="text"
                                         placeholder="Subtask name..."
                                         value={subtaskTitle}
                                         onChange={e => setSubtaskTitle(e.target.value)}
                                         onKeyDown={e => {
                                           if (e.key === 'Enter') submitSubtask(task);
                                           if (e.key === 'Escape') setAddingSubtaskParentId(null);
                                         }}
                                         autoFocus
                                         style={{
                                           flex: 1,
                                           border: '1px solid #cbd5e1',
                                           borderRadius: '4px',
                                           padding: '2px 6px',
                                           fontSize: '0.82rem',
                                           outline: 'none',
                                           background: '#ffffff'
                                         }}
                                       />
                                       <button 
                                         style={{ background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
                                         onClick={() => submitSubtask(task)}
                                       >
                                         Save
                                       </button>
                                       <button 
                                         style={{ background: 'none', color: '#64748b', border: 'none', padding: '2px 4px', fontSize: '0.75rem', cursor: 'pointer' }}
                                         onClick={() => setAddingSubtaskParentId(null)}
                                       >
                                         Cancel
                                       </button>
                                     </div>
                                   </div>
                                 );
                               }
                               
                               return rows;
                             });
                           })()}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* ── Desktop: project → task list view (hidden on mobile) ── */}
            <div className="cu-list-root all-tasks-list">
              {finalProjectGroups.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ marginBottom: '1rem' }}>
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <line x1="8" y1="8" x2="16" y2="8"/>
                    <line x1="8" y1="12" x2="14" y2="12"/>
                  </svg>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>No tasks yet</p>
                  {can('tasks', 'create') && (
                    <button
                      onClick={() => openNewTask('To Do')}
                      style={{ marginTop: '0.5rem', padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      + Add Task
                    </button>
                  )}
                </div>
              )}
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
                                      <th className="cu-th cu-th-actions"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      const mainTasks = list.tasks.filter(t => !t.parentId || !list.tasks.some(p => p.id === t.parentId));
                                      
                                      return mainTasks.flatMap(task => {
                                        const subTasks = tasks.filter(t => t.parentId === task.id);
                                        const isExpanded = !!expandedSubtaskIds[task.id];
                                        const isAddingSubtask = addingSubtaskParentId === task.id;
                                        const relDate = formatRelativeDueDate(task.dueDate);
                                        const meta = STATUS_HEADER_META[task.status] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', isDone: false };

                                        const parentRow = (
                                          <tr key={task.id} className="cu-row" onClick={() => openTaskDetail(task, false)}>
                                            <td className="cu-td cu-td-name">
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                                                {/* Expand/Collapse Chevron */}
                                                <button
                                                  style={{ background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', visibility: subTasks.length > 0 ? 'visible' : 'hidden' }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSubtaskExpand(task.id);
                                                  }}
                                                  title={isExpanded ? "Collapse Subtasks" : "Expand Subtasks"}
                                                >
                                                  <svg viewBox="0 0 10 6" width="8" height="8" fill="currentColor" style={{ transform: isExpanded ? "none" : "rotate(-90deg)", transition: "transform 0.15s", color: "#64748b" }}><path d="M0 0l5 6 5-6z"/></svg>
                                                </button>
                                                
                                                <TaskTitleTooltip text={task.title || 'Untitled Task'}>
                                                  <span className="cu-task-title">{task.title || 'Untitled Task'}</span>
                                                </TaskTitleTooltip>
                                                
                                                
                                                {/* Subtask count badge */}
                                                {subTasks.length > 0 && (
                                                  <span 
                                                    style={{ 
                                                      display: 'inline-flex', 
                                                      alignItems: 'center', 
                                                      gap: '4px', 
                                                      marginLeft: '8px', 
                                                      fontSize: '0.7rem', 
                                                      fontWeight: '700', 
                                                      color: '#2563eb', 
                                                      background: '#eff6ff', 
                                                      padding: '2px 6px', 
                                                      borderRadius: '4px',
                                                      border: '1px solid #bfdbfe',
                                                      cursor: 'pointer'
                                                    }}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleSubtaskExpand(task.id);
                                                    }}
                                                    title={`${subTasks.length} Subtasks`}
                                                  >
                                                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                                                    {subTasks.length}
                                                  </span>
                                                )}
                                                
                                                {/* Add subtask trigger */}
                                                <button
                                                  className="cu-hover-subtask-btn"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedSubtaskIds(prev => ({ ...prev, [task.id]: true }));
                                                    setAddingSubtaskParentId(task.id);
                                                    setSubtaskTitle('');
                                                    setSubtaskAssignee('');
                                                    setSubtaskDueDate('');
                                                    setSubtaskPriority('Medium');
                                                  }}
                                                  title="Add Subtask"
                                                >
                                                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                  </svg>
                                                </button>
                                              </div>
                                            </td>
                                            <td className="cu-td cu-td-assignee" onClick={e => e.stopPropagation()}>
                                              <div className="cu-inline-field-wrapper">
                                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#64748b" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                <select className="cu-inline-dropdown" value={task.assignees || ''} onChange={async (e) => { e.stopPropagation(); const updated = { ...task, assignees: e.target.value }; try { await api.put(`/tasks/${task.id}`, { assignees: e.target.value }); setTasks(ts => ts.map(t => t.id === task.id ? updated : t)); } catch(err) { console.error(err); } }}>
                                                  <option value="">Unassigned</option>
                                                  {getFilteredUsersForProject(getTaskProjectId(task), task.assignees).map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
                                                </select>
                                              </div>
                                            </td>
                                            <td className="cu-td cu-td-list" onClick={e => e.stopPropagation()}>
                                              <div className="cu-inline-field-wrapper">
                                                <select className="cu-inline-dropdown" value={task.status || 'To Do'} onChange={async (e) => { e.stopPropagation(); const newStatus = e.target.value; const updateData = { status: newStatus }; if (newStatus === 'Delivered' && !task.deliveredDate) { updateData.deliveredDate = new Date().toISOString(); } try { await api.put(`/tasks/${task.id}`, updateData); setTasks(ts => ts.map(t => t.id === task.id ? { ...t, ...updateData } : t)); } catch(err) { console.error(err); } }} style={{ color: meta.dotColor, fontWeight: 'bold' }}>
                                                  {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                                                </select>
                                              </div>
                                            </td>
                                            <td className="cu-td cu-td-delivery" onClick={e => e.stopPropagation()}>
                                              <div className="cu-inline-field-wrapper">
                                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={relDate?.isOverdue ? '#ea580c' : relDate?.isToday ? '#2563eb' : '#64748b'} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                <input type="date" className="cu-inline-dropdown cu-inline-date-field" value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''} onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }} onChange={async (e) => { e.stopPropagation(); const val = e.target.value; try { await api.put(`/tasks/${task.id}`, { dueDate: val ? new Date(val).toISOString() : null }); setTasks(ts => ts.map(t => t.id === task.id ? { ...t, dueDate: val ? new Date(val).toISOString() : null } : t)); } catch(err) { console.error(err); } }} />
                                              </div>
                                            </td>
                                            <td className="cu-td cu-td-actions" onClick={e => e.stopPropagation()}>
                                              <div className="cu-row-actions">
                                                <PriorityFlag priority={task.priority} />
                                                {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && ((user?.id && (task.assignees || '').toLowerCase().includes(user.id.toLowerCase())) || ((user?.fullName || user?.name) && (task.assignees || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase()))))) && (
                                                  <button className="cu-act-btn danger" onClick={(e) => { e.stopPropagation(); showConfirm('Delete this task?', () => handleDeleteTask(task.id), 'Delete Task'); }} title="Delete">
                                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );

                                        const rows = [parentRow];

                                        if (isExpanded) {
                                          subTasks.forEach(sub => {
                                            const subRelDate = formatRelativeDueDate(sub.dueDate);
                                            const subMeta = STATUS_HEADER_META[sub.status] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', isDone: false };
                                            
                                            rows.push(
                                              <tr key={sub.id} className="cu-row subtask-row" onClick={() => openTaskDetail(sub, false)} style={{ background: '#f8fafc' }}>
                                                <td className="cu-td cu-td-name" style={{ paddingLeft: '2.5rem' }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 'bold', userSelect: 'none' }}>└</span>
                                                    <TaskTitleTooltip text={sub.title || 'Untitled Subtask'}>
                                                      <span className="cu-task-title" style={{ color: '#475569', fontSize: '0.82rem', fontWeight: '500' }}>{sub.title || 'Untitled Subtask'}</span>
                                                    </TaskTitleTooltip>
                                                  </div>
                                                </td>
                                                <td className="cu-td cu-td-assignee" onClick={e => e.stopPropagation()}>
                                                  <div className="cu-inline-field-wrapper">
                                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#64748b" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                    <select className="cu-inline-dropdown" value={sub.assignees || ''} onChange={async (e) => { e.stopPropagation(); const updated = { ...sub, assignees: e.target.value }; try { await api.put(`/tasks/${sub.id}`, { assignees: e.target.value }); setTasks(ts => ts.map(t => t.id === sub.id ? updated : t)); } catch(err) { console.error(err); } }}>
                                                      <option value="">Unassigned</option>
                                                      {getFilteredUsersForProject(getTaskProjectId(sub) || getTaskProjectId(task), sub.assignees).map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
                                                    </select>
                                                  </div>
                                                </td>
                                                <td className="cu-td cu-td-list" onClick={e => e.stopPropagation()}>
                                                  <div className="cu-inline-field-wrapper">
                                                    <select className="cu-inline-dropdown" value={sub.status || 'To Do'} onChange={async (e) => { e.stopPropagation(); const newStatus = e.target.value; const updateData = { status: newStatus }; if (newStatus === 'Delivered' && !sub.deliveredDate) { updateData.deliveredDate = new Date().toISOString(); } try { await api.put(`/tasks/${sub.id}`, updateData); setTasks(ts => ts.map(t => t.id === sub.id ? { ...t, ...updateData } : t)); } catch(err) { console.error(err); } }} style={{ color: subMeta.dotColor, fontWeight: 'bold' }}>
                                                      {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                                                    </select>
                                                  </div>
                                                </td>
                                                <td className="cu-td cu-td-delivery" onClick={e => e.stopPropagation()}>
                                                  <div className="cu-inline-field-wrapper">
                                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={subRelDate?.isOverdue ? '#ea580c' : subRelDate?.isToday ? '#2563eb' : '#64748b'} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                    <input type="date" className="cu-inline-dropdown cu-inline-date-field" value={sub.dueDate ? new Date(sub.dueDate).toISOString().split('T')[0] : ''} onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }} onChange={async (e) => { e.stopPropagation(); const val = e.target.value; try { await api.put(`/tasks/${sub.id}`, { dueDate: val ? new Date(val).toISOString() : null }); setTasks(ts => ts.map(t => t.id === sub.id ? { ...t, dueDate: val ? new Date(val).toISOString() : null } : t)); } catch(err) { console.error(err); } }} />
                                                  </div>
                                                </td>
                                                <td className="cu-td cu-td-actions" onClick={e => e.stopPropagation()}>
                                                  <div className="cu-row-actions">
                                                    <PriorityFlag priority={sub.priority} />
                                                    {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && ((user?.id && (sub.assignees || '').toLowerCase().includes(user.id.toLowerCase())) || ((user?.fullName || user?.name) && (sub.assignees || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase()))))) && (
                                                      <button className="cu-act-btn danger" onClick={(e) => { e.stopPropagation(); showConfirm('Delete this subtask?', () => handleDeleteTask(sub.id), 'Delete Subtask'); }} title="Delete">
                                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                      </button>
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          });

                                          if (isAddingSubtask) {
                                            rows.push(
                                              <tr key={`add-sub-${task.id}`} className="cu-inline-row animate-fade-in" style={{ background: '#f8fafc' }}>
                                                <td colSpan="5" style={{ paddingLeft: '2.5rem' }}>
                                                  <div className="new-task-inline-bar" style={{ borderLeft: '2px solid #2563eb', paddingLeft: '8px' }}>
                                                    <div className="ntib-left">
                                                      <span className="ntib-dotted-circle"></span>
                                                      <input
                                                        type="text"
                                                        placeholder="Subtask Name or type '/' for commands"
                                                        value={subtaskTitle}
                                                        onChange={e => setSubtaskTitle(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter' && !isSaving) submitSubtask(task); if (e.key === 'Escape') setAddingSubtaskParentId(null); }}
                                                        autoFocus
                                                        className="ntib-input"
                                                      />
                                                    </div>
                                                    <div className="ntib-right">
                                                      <div className="ntib-dropdown-wrapper">
                                                        <button type="button" className="ntib-btn-icon" title="Assignee">
                                                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                        </button>
                                                        <select className="ntib-hidden-select" value={subtaskAssignee} onChange={e => setSubtaskAssignee(e.target.value)}>
                                                          <option value="">Assignee</option>
                                                          {getFilteredUsersForProject(getTaskProjectId(task)).map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
                                                        </select>
                                                        {subtaskAssignee && <span className="ntib-badge">{initials((listUsers.find(u => u.id === subtaskAssignee) || {}).fullName || subtaskAssignee)}</span>}
                                                      </div>
                                                      
                                                      <div className="ntib-dropdown-wrapper">
                                                        <button type="button" className="ntib-btn-icon" title="Due Date">
                                                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                        </button>
                                                        <input type="date" className="ntib-hidden-date" value={subtaskDueDate} onChange={e => setSubtaskDueDate(e.target.value)} />
                                                        {subtaskDueDate && <span className="ntib-badge">{new Date(subtaskDueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>}
                                                      </div>
                                                      
                                                      <div className="ntib-dropdown-wrapper">
                                                        <button type="button" className="ntib-btn-icon" title="Priority">
                                                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                                                        </button>
                                                        <select className="ntib-hidden-select" value={subtaskPriority} onChange={e => setSubtaskPriority(e.target.value)}>
                                                          {PRIORITIES.map(p => <option key={p} value={p}>{p} Priority</option>)}
                                                        </select>
                                                        {subtaskPriority && <span className="ntib-badge priority-color">{subtaskPriority}</span>}
                                                      </div>
                                                      
                                                      <button type="button" className="ntib-cancel-btn" onClick={() => setAddingSubtaskParentId(null)}>Cancel</button>
                                                      <button type="button" className="ntib-save-btn" disabled={isSaving} onClick={() => submitSubtask(task)}>{isSaving ? 'Saving...' : 'Save ↵'}</button>
                                                    </div>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          }
                                        }

                                        return rows;
                                      });
                                    })()}

                                    {/* Inline Add Row */}
                                    {isInline ? (
                                      <tr className="cu-inline-row animate-fade-in">
                                        <td colSpan="5" style={{ padding: '8px' }}>
                                          <div className="new-task-inline-bar">
                                            <div className="ntib-left">
                                              <span className="ntib-dotted-circle"></span>
                                              <input
                                                ref={inlineInputRef}
                                                type="text"
                                                placeholder="Task Name or type '/' for commands"
                                                value={inlineTitle}
                                                onChange={e => setInlineTitle(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && !isSaving) submitInlineAdd(); if (e.key === 'Escape') closeInlineAdd(); }}
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
                                                  {getFilteredUsersForProject(inlineAdd?.projId).map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
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
                                              <button type="button" className="ntib-save-btn" disabled={isSaving} onClick={submitInlineAdd}>{isSaving ? 'Saving...' : 'Save ↵'}</button>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    ) : (
                                      can('tasks', 'create') && (
                                        <tr className="cu-add-row" onClick={() => openInlineAdd('', 'To Do', list.id)}>
                                          <td colSpan="5">
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
            </>
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
              {flatSorted.length === 0 ? (
                <div className="cu-flat-empty">No tasks assigned to you.</div>
              ) : (() => {
                const sortedCols = COLUMNS;
                return sortedCols.map(col => {
                const groupTasks = flatSorted.filter(t => (t.status || 'To Do') === col.id);
                if (groupTasks.length === 0) return null;
                const meta = STATUS_HEADER_META[col.id] || { bg: '#f1f5f9', fg: '#ffffff', dotColor: '#94a3b8' };
                return (
                  <div key={col.id} className="cu-mobile-status-group">
                    {/* Status group header */}
                    <div className="cu-mobile-group-header">
                      <span className="cu-mobile-group-pill" style={{ background: meta.bg, color: meta.fg, border: meta.border || 'none', fontWeight: col.id === 'To Do' ? '700' : '600' }}>
                        {col.label.toUpperCase()}
                      </span>
                      <span className="cu-mobile-group-count">{groupTasks.length}</span>
                    </div>
                    {/* Tasks in this group */}
                    {(() => {
                      const mainTasks = groupTasks.filter(t => !t.parentId || !flatSorted.some(p => p.id === t.parentId));
                      
                      return mainTasks.flatMap(task => {
                        const subTasks = tasks.filter(t => t.parentId === task.id);
                        const isExpanded = !!expandedSubtaskIds[task.id];
                        const dueDateInfo = formatMobileDueDate(task.dueDate);
                        
                        const parentRow = (
                          <div key={task.id} className="cu-flat-task-row" onClick={() => openTaskDetail(task, false)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                              {subTasks.length > 0 ? (
                                        <button
                                          style={{ background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSubtaskExpand(task.id);
                                          }}
                                        >
                                          <svg viewBox="0 0 10 6" width="7" height="7" fill="currentColor" style={{ transform: isExpanded ? "none" : "rotate(-90deg)", transition: "transform 0.15s", color: "#64748b" }}><path d="M0 0l5 6 5-6z"/></svg>
                                        </button>
                                      ) : (
                                        <button
                                          style={{ background: 'none', border: 'none', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, visibility: 'hidden' }}
                                          disabled
                                        >
                                          <svg viewBox="0 0 10 6" width="7" height="7"><path d="M0 0l5 6 5-6z"/></svg>
                                        </button>
                                      )}
                              <span className="cu-flat-task-title" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {task.title || 'Untitled Task'}
                              </span>
                              {subTasks.length > 0 && (
                                <span 
                                  style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '2px', 
                                    fontSize: '0.65rem', 
                                    fontWeight: '700', 
                                    color: '#2563eb', 
                                    background: '#eff6ff', 
                                    padding: '1px 4px', 
                                    borderRadius: '3px',
                                    border: '1px solid #bfdbfe'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSubtaskExpand(task.id);
                                  }}
                                >
                                  {subTasks.length}
                                </span>
                              )}
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                              {dueDateInfo && (
                                <span style={{ 
                                  fontSize: '0.8rem', 
                                  fontWeight: '600', 
                                  color: dueDateInfo.isOverdue ? '#ef4444' : '#2563eb',
                                  marginRight: '4px'
                                }}>
                                  {dueDateInfo.text}
                                </span>
                              )}
                              <button
                                className="cu-mob-hover-subtask-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedSubtaskIds(prev => ({ ...prev, [task.id]: true }));
                                  setAddingSubtaskParentId(task.id);
                                  setSubtaskTitle('');
                                  setSubtaskAssignee('');
                                  setSubtaskDueDate('');
                                  setSubtaskPriority('Medium');
                                }}
                                title="Add Subtask"
                              >
                                <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="5" x2="12" y2="19"></line>
                                  <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                        
                        const rows = [parentRow];
                        
                        if (isExpanded) {
                          subTasks.forEach(sub => {
                            const subDueDateInfo = formatMobileDueDate(sub.dueDate);
                            rows.push(
                              <div key={sub.id} className="cu-flat-task-row subtask-row" onClick={() => openTaskDetail(sub, false)} style={{ paddingLeft: '1.25rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                                  <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold', userSelect: 'none' }}>└</span>
                                  <span className="cu-flat-task-title" style={{ color: '#475569', fontSize: '0.82rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {sub.title || 'Untitled Subtask'}
                                  </span>
                                </div>
                                {subDueDateInfo && (
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: '600', 
                                    color: subDueDateInfo.isOverdue ? '#ef4444' : '#2563eb',
                                    flexShrink: 0
                                  }}>
                                    {subDueDateInfo.text}
                                  </span>
                                )}
                              </div>
                            );
                          });
                        }
                        
                        const isAddingSubtask = addingSubtaskParentId === task.id;
                        if (isAddingSubtask) {
                          rows.push(
                            <div key={`mob-add-sub-${task.id}`} className="cu-flat-task-row" style={{ paddingLeft: '1.25rem', background: '#f8fafc' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
                                <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold', userSelect: 'none' }}>└</span>
                                <input
                                  type="text"
                                  placeholder="Subtask name..."
                                  value={subtaskTitle}
                                  onChange={e => setSubtaskTitle(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !isSaving) submitSubtask(task);
                                    if (e.key === 'Escape') setAddingSubtaskParentId(null);
                                  }}
                                  autoFocus
                                  style={{
                                    flex: 1,
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    padding: '2px 6px',
                                    fontSize: '0.82rem',
                                    outline: 'none',
                                    background: '#ffffff'
                                  }}
                                />
                                <button 
                                  style={{ background: isSaving ? '#93c5fd' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.75rem', cursor: isSaving ? 'not-allowed' : 'pointer' }}
                                  disabled={isSaving}
                                  onClick={() => submitSubtask(task)}
                                >
                                  {isSaving ? 'Saving...' : 'Save'}
                                </button>
                                <button 
                                  style={{ background: 'none', color: '#64748b', border: 'none', padding: '2px 4px', fontSize: '0.75rem', cursor: 'pointer' }}
                                  onClick={() => setAddingSubtaskParentId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          );
                        }
                        
                        return rows;
                      });
                    })()}
                  </div>
                );
              }); })()}
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
              const isCollapsed = expandedGroupId !== col.id;
              const isInline = inlineAdd && inlineAdd.statusId === col.id && !inlineAdd.taskListId;

              return (
                <div key={col.id} className="cu-status-section">
                  {/* Section Header */}
                  <div className="cu-section-header">
                    <div className="cu-section-left" onClick={() => toggleGroup(col.id)}>
                      <span className="cu-section-chevron">
                        <svg viewBox="0 0 10 6" width="10" height="6" fill="currentColor" style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s", color: "#94a3b8" }}><path d="M0 0l5 6 5-6z"/></svg>
                      </span>
                      <span className="cu-status-pill" style={{ background: meta.bg, color: meta.fg, border: meta.border || 'none', fontWeight: col.id === 'To Do' ? '700' : '600' }}>
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
                            <th className="cu-th cu-th-project">PROJECT</th>
                            <th className="cu-th cu-th-delivery">DUE DATE</th>
                            <th className="cu-th cu-th-actions"></th>
                          </tr>
                        </thead>
                        <tbody>
                           {(() => {
                                      const mainTasks = statusTasks.filter(t => !t.parentId || !statusTasks.some(p => p.id === t.parentId));
                                      
                                      return mainTasks.flatMap(task => {
                                        const subTasks = tasks.filter(t => t.parentId === task.id);
                                        const isExpanded = !!expandedSubtaskIds[task.id];
                                        const isAddingSubtask = addingSubtaskParentId === task.id;
                                        const relDate = formatRelativeDueDate(task.dueDate);
                                        const taskGroupName = task.taskListId ? (taskListsData.find(l => l.id === task.taskListId)?.name || '') : '';
                                        const dueDateLabel = task.dueDate ? (() => { const d = new Date(task.dueDate); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`; })() : null;

                                        const parentRow = (
                                          <tr key={task.id} className="cu-row" onClick={() => openTaskDetail(task, false)}>
                                            <td className="cu-td cu-td-name">
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                                                {/* Expand/Collapse Chevron */}
                                                <button
                                                  style={{ background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', visibility: subTasks.length > 0 ? 'visible' : 'hidden' }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSubtaskExpand(task.id);
                                                  }}
                                                  title={isExpanded ? "Collapse Subtasks" : "Expand Subtasks"}
                                                >
                                                  <svg viewBox="0 0 10 6" width="8" height="8" fill="currentColor" style={{ transform: isExpanded ? "none" : "rotate(-90deg)", transition: "transform 0.15s", color: "#64748b" }}><path d="M0 0l5 6 5-6z"/></svg>
                                                </button>
                                                
                                                <div className="cu-name-content">
                                                  <TaskTitleTooltip text={task.title || 'Untitled Task'}>
                                                    <span className="cu-task-title">{task.title || 'Untitled Task'}</span>
                                                  </TaskTitleTooltip>
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
                                                
                                                {/* Subtask count badge */}
                                                {subTasks.length > 0 && (
                                                  <span 
                                                    style={{ 
                                                      display: 'inline-flex', 
                                                      alignItems: 'center', 
                                                      gap: '4px', 
                                                      marginLeft: '8px', 
                                                      fontSize: '0.7rem', 
                                                      fontWeight: '700', 
                                                      color: '#2563eb', 
                                                      background: '#eff6ff', 
                                                      padding: '2px 6px', 
                                                      borderRadius: '4px',
                                                      border: '1px solid #bfdbfe',
                                                      cursor: 'pointer'
                                                    }}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleSubtaskExpand(task.id);
                                                    }}
                                                    title={`${subTasks.length} Subtasks`}
                                                  >
                                                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                                                    {subTasks.length}
                                                  </span>
                                                )}
                                                
                                                {/* Add subtask trigger */}
                                                <button
                                                  className="cu-hover-subtask-btn"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedSubtaskIds(prev => ({ ...prev, [task.id]: true }));
                                                    setAddingSubtaskParentId(task.id);
                                                    setSubtaskTitle('');
                                                    setSubtaskAssignee('');
                                                    setSubtaskDueDate('');
                                                    setSubtaskPriority('Medium');
                                                  }}
                                                  title="Add Subtask"
                                                >
                                                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                  </svg>
                                                </button>
                                              </div>
                                            </td>
                                            <td className="cu-td cu-td-project">
                                              {task.projectName ? (
                                                <span className="cu-project-badge">{task.projectName}</span>
                                              ) : <span className="cu-empty-cell">-</span>}
                                            </td>
                                            <td className="cu-td cu-td-delivery" onClick={e => e.stopPropagation()}>
                                              <div className="cu-inline-field-wrapper">
                                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={relDate?.isOverdue ? '#ea580c' : relDate?.isToday ? '#2563eb' : '#64748b'} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                <input type="date" className="cu-inline-dropdown cu-inline-date-field" value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''} onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }} onChange={async (e) => { e.stopPropagation(); const val = e.target.value; try { await api.put(`/tasks/${task.id}`, { dueDate: val ? new Date(val).toISOString() : null }); setTasks(ts => ts.map(t => t.id === task.id ? { ...t, dueDate: val ? new Date(val).toISOString() : null } : t)); } catch(err) { console.error(err); } }} />
                                              </div>
                                            </td>
                                            <td className="cu-td cu-td-actions" onClick={e => e.stopPropagation()}>
                                              <div className="cu-row-actions">
                                                <PriorityFlag priority={task.priority} />
                                                {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && ((user?.id && (task.assignees || '').toLowerCase().includes(user.id.toLowerCase())) || ((user?.fullName || user?.name) && (task.assignees || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase()))))) && (
                                                  <button className="cu-act-btn danger" onClick={(e) => { e.stopPropagation(); showConfirm('Delete this task?', () => handleDeleteTask(task.id), 'Delete Task'); }} title="Delete">
                                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );

                                        const rows = [parentRow];

                                        if (isExpanded) {
                                          subTasks.forEach(sub => {
                                            const subRelDate = formatRelativeDueDate(sub.dueDate);
                                            const subMeta = STATUS_HEADER_META[sub.status] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', isDone: false };
                                            
                                            rows.push(
                                              <tr key={sub.id} className="cu-row subtask-row" onClick={() => openTaskDetail(sub, false)} style={{ background: '#f8fafc' }}>
                                                <td className="cu-td cu-td-name" style={{ paddingLeft: '2.5rem' }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 'bold', userSelect: 'none' }}>└</span>
                                                    <TaskTitleTooltip text={sub.title || 'Untitled Subtask'}>
                                                      <span className="cu-task-title" style={{ color: '#475569', fontSize: '0.82rem', fontWeight: '500' }}>{sub.title || 'Untitled Subtask'}</span>
                                                    </TaskTitleTooltip>
                                                  </div>
                                                </td>
                                                <td className="cu-td cu-td-project">
                                                  {sub.projectName ? (
                                                    <span className="cu-project-badge">{sub.projectName}</span>
                                                  ) : <span className="cu-empty-cell">-</span>}
                                                </td>
                                                <td className="cu-td cu-td-delivery" onClick={e => e.stopPropagation()}>
                                                  <div className="cu-inline-field-wrapper">
                                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={subRelDate?.isOverdue ? '#ea580c' : subRelDate?.isToday ? '#2563eb' : '#64748b'} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                    <input type="date" className="cu-inline-dropdown cu-inline-date-field" value={sub.dueDate ? new Date(sub.dueDate).toISOString().split('T')[0] : ''} onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }} onChange={async (e) => { e.stopPropagation(); const val = e.target.value; try { await api.put(`/tasks/${sub.id}`, { dueDate: val ? new Date(val).toISOString() : null }); setTasks(ts => ts.map(t => t.id === sub.id ? { ...t, dueDate: val ? new Date(val).toISOString() : null } : t)); } catch(err) { console.error(err); } }} />
                                                  </div>
                                                </td>
                                                <td className="cu-td cu-td-actions" onClick={e => e.stopPropagation()}>
                                                  <div className="cu-row-actions">
                                                    <PriorityFlag priority={sub.priority} />
                                                    {(getLevel('tasks', 'delete') === 'All' || (getLevel('tasks', 'delete') === 'Self' && ((user?.id && (sub.assignees || '').toLowerCase().includes(user.id.toLowerCase())) || ((user?.fullName || user?.name) && (sub.assignees || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase()))))) && (
                                                      <button className="cu-act-btn danger" onClick={(e) => { e.stopPropagation(); showConfirm('Delete this subtask?', () => handleDeleteTask(sub.id), 'Delete Subtask'); }} title="Delete">
                                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                      </button>
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          });

                                          if (isAddingSubtask) {
                                            rows.push(
                                              <tr key={`add-sub-${task.id}`} className="cu-inline-row animate-fade-in" style={{ background: '#f8fafc' }}>
                                                <td colSpan="4" style={{ paddingLeft: '2.5rem' }}>
                                                  <div className="new-task-inline-bar" style={{ borderLeft: '2px solid #2563eb', paddingLeft: '8px' }}>
                                                    <div className="ntib-left">
                                                      <span className="ntib-dotted-circle"></span>
                                                      <input
                                                        type="text"
                                                        placeholder="Subtask Name or type '/' for commands"
                                                        value={subtaskTitle}
                                                        onChange={e => setSubtaskTitle(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter' && !isSaving) submitSubtask(task); if (e.key === 'Escape') setAddingSubtaskParentId(null); }}
                                                        autoFocus
                                                        className="ntib-input"
                                                      />
                                                    </div>
                                                    <div className="ntib-right">
                                                      <div className="ntib-dropdown-wrapper">
                                                        <button type="button" className="ntib-btn-icon" title="Assignee">
                                                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                        </button>
                                                        <select className="ntib-hidden-select" value={subtaskAssignee} onChange={e => setSubtaskAssignee(e.target.value)}>
                                                          <option value="">Assignee</option>
                                                          {getFilteredUsersForProject(getTaskProjectId(task)).map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
                                                        </select>
                                                        {subtaskAssignee && <span className="ntib-badge">{initials((listUsers.find(u => u.id === subtaskAssignee) || {}).fullName || subtaskAssignee)}</span>}
                                                      </div>
                                                      
                                                      <div className="ntib-dropdown-wrapper">
                                                        <button type="button" className="ntib-btn-icon" title="Due Date">
                                                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                        </button>
                                                        <input type="date" className="ntib-hidden-date" value={subtaskDueDate} onChange={e => setSubtaskDueDate(e.target.value)} />
                                                        {subtaskDueDate && <span className="ntib-badge">{new Date(subtaskDueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>}
                                                      </div>
                                                      
                                                      <div className="ntib-dropdown-wrapper">
                                                        <button type="button" className="ntib-btn-icon" title="Priority">
                                                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                                                        </button>
                                                        <select className="ntib-hidden-select" value={subtaskPriority} onChange={e => setSubtaskPriority(e.target.value)}>
                                                          {PRIORITIES.map(p => <option key={p} value={p}>{p} Priority</option>)}
                                                        </select>
                                                        {subtaskPriority && <span className="ntib-badge priority-color">{subtaskPriority}</span>}
                                                      </div>
                                                      
                                                      <button type="button" className="ntib-cancel-btn" onClick={() => setAddingSubtaskParentId(null)}>Cancel</button>
                                                      <button type="button" className="ntib-save-btn" disabled={isSaving} onClick={() => submitSubtask(task)}>{isSaving ? 'Saving...' : 'Save ↵'}</button>
                                                    </div>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          }
                                        }

                                        return rows;
                                      });
                                    })()}

                          {/* Inline Add Row */}
                          {isInline ? (
                            <tr className="cu-inline-row animate-fade-in">
                              <td colSpan="4" style={{ padding: '8px' }}>
                                <div className="new-task-inline-bar">
                                  <div className="ntib-left">
                                    <span className="ntib-dotted-circle"></span>
                                    <input
                                      ref={inlineInputRef}
                                      type="text"
                                      placeholder="Task Name or type '/' for commands"
                                      value={inlineTitle}
                                      onChange={e => setInlineTitle(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter' && !isSaving) submitInlineAdd(); if (e.key === 'Escape') closeInlineAdd(); }}
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
                                        {getFilteredUsersForProject(inlineAdd?.projId).map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
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
                                    <button type="button" className="ntib-save-btn" disabled={isSaving} onClick={submitInlineAdd}>{isSaving ? 'Saving...' : 'Save ↵'}</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            can('tasks', 'create') && subTab !== 'my' && (
                              <tr className="cu-add-row" onClick={() => openInlineAdd('', col.id)}>
                                <td colSpan="4">
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
              tasks={tasks}
              onRefresh={fetchTasks}
              onSelectTask={(t) => setDrawerTask(t)}
              onSave={async (taskData, silent) => {
                const saved = await handleSaveTask(taskData, silent);
                if (!silent) {
                  closeDrawer();
                } else if (saved) {
                  setDrawerTask(saved);
                }
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
