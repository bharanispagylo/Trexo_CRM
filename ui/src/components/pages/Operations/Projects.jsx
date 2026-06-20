/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../api/client';
import { TaskDetailView, TaskTitleTooltip } from './Tasks';
import './Projects.css';
import './Tasks.css';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAlert } from '../../../context/AlertContext';

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

export default function Projects({ user, initialSelectedProject, onClearInitialProject, onNavigateToTasks, initialProjectName, onProjectSelect }) {
  const [projects, setProjects] = useState([]);
  const [expandedProj, setExpandedProj] = useState({});
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);

  const [selectedEmployeeToAdd, setSelectedEmployeeToAdd] = useState('');
  const [createMemberForm, setCreateMemberForm] = useState({ name: '', role: '', status: 'Active', type: 'Employee', phoneNo: '', emergencyNo: '' });
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showCreateMemberModal, setShowCreateMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentView, setCurrentView] = useState('list'); // 'list' or 'detail'
  const [selectedProject, setSelectedProject] = useState(null);
  const [newListName, setNewListName] = useState('');
  const [listNameError, setListNameError] = useState(false);
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');
  const [detailTab, setDetailTab] = useState('General');
  const [selectedTaskListId, setSelectedTaskListId] = useState(null);
  const [expandedListId, setExpandedListId] = useState('__first__');
  const toggleListAccordion = (id) => {
    setExpandedListId(prev => prev === id ? null : id);
  };
  const handleOpenCreateTaskModalForList = (listId) => {
    setSelectedTaskListId(listId);
    handleOpenCreateTaskModal();
  };

  const [form, setForm] = useState({ name: '', status: 'Active' });
  const [showTaskFormModal, setShowTaskFormModal] = useState(false);
  const [taskFormType, setTaskFormType] = useState('create'); // 'create' or 'edit'
  const [editingTask, setEditingTask] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [showTaskViewModal, setShowTaskViewModal] = useState(false);
  const [taskFormFields, setTaskFormFields] = useState({
    title: '',
    assignees: '',
    status: 'To Do',
    priority: 'Medium',
    assignedDate: '',
    dueDate: '',
    deliveredDate: '',
    description: '',
    taskType: 'Feature'
  });
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [queryFormType, setQueryFormType] = useState('create'); // 'create' or 'edit'
  const [editingQuery, setEditingQuery] = useState(null);
  const queryFormRef = useRef(null);
  const [viewingQuery, setViewingQuery] = useState(null);
  const [querySearchText, setQuerySearchText] = useState('');
  const [queryStatusFilter, setQueryStatusFilter] = useState('All Status');
  const [querySentToFilter, setQuerySentToFilter] = useState('All Sent To');
  const [queryPriorityFilter, setQueryPriorityFilter] = useState('All Priority');
  const [queryFormFields, setQueryFormFields] = useState({
    title: '',
    description: '',
    sentTo: '',
    status: 'Open',
    solved: false,
    priority: 'Medium'
  });

  // Attachments Tab State
  const [attachSearch, setAttachSearch] = useState('');
  const [attachTypeFilter, setAttachTypeFilter] = useState('All');
  const [attachPage, setAttachPage] = useState(1);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', description: '', file: null });
  const [uploading, setUploading] = useState(false);
  const attachFileRef = React.useRef(null);

  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSubtasks, setExpandedSubtasks] = useState({});
  const [inlineSubtaskParentId, setInlineSubtaskParentId] = useState(null);
  const [inlineSubtaskTitle, setInlineSubtaskTitle] = useState('');
  const [inlineSubtaskSaving, setInlineSubtaskSaving] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskAssignee, setSubtaskAssignee] = useState('');
  const [subtaskDueDate, setSubtaskDueDate] = useState('');
  const [subtaskPriority, setSubtaskPriority] = useState('Medium');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);
  const { can, getLevel } = usePermissions();
  const { alert, confirm, toast } = useAlert();

  const canEditProject = (proj) => {
    if (!proj) return false;
    const level = getLevel('projects', 'edit');
    if (level === 'All') return true;
    if (level === 'Self') {
      const loggedInId = user?.id || '';
      const rawMembers = (proj.members || '').split(',').map(m => m.trim()).filter(Boolean);
      return loggedInId && rawMembers.includes(loggedInId);
    }
    return false;
  };

  const canDeleteProject = (proj) => {
    if (!proj) return false;
    const level = getLevel('projects', 'delete');
    if (level === 'All') return true;
    if (level === 'Self') {
      const loggedInId = user?.id || '';
      const rawMembers = (proj.members || '').split(',').map(m => m.trim()).filter(Boolean);
      return loggedInId && rawMembers.includes(loggedInId);
    }
    return false;
  };

  const getFilteredUsersForProject = () => {
    const activeUsers = users.filter(u => u.status !== 'Inactive');
    if (!selectedProject) return activeUsers;
    const rawMembers = (selectedProject.members || '').split(',').map(m => m.trim()).filter(Boolean);
    if (rawMembers.length === 0) return [];
    return activeUsers.filter(u => rawMembers.includes(u.id));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialSelectedProject) {
      setSelectedProject(initialSelectedProject);
      setCurrentView('detail');
      if (onProjectSelect) onProjectSelect(initialSelectedProject.name);
      if (onClearInitialProject) onClearInitialProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedProject, onClearInitialProject]);

  // Auto-open project from URL deep-link (e.g. /projects/ProjectName)
  const initialProjectNameHandled = useRef(false);
  useEffect(() => {
    if (initialProjectName && !initialProjectNameHandled.current && projects.length > 0) {
      initialProjectNameHandled.current = true;
      // Match by slug (spaces replaced with hyphens) since URL uses hyphens
      const slugify = (s) => (s || '').replace(/ /g, '-');
      const proj = projects.find(p => slugify(p.name) === slugify(initialProjectName));
      if (proj) {
        setSelectedProject(proj);
        setCurrentView('detail');
        // Update parent with real name (for header display)
        if (onProjectSelect) onProjectSelect(proj.name);
      }
    }
  }, [initialProjectName, projects, onProjectSelect]);

  // ── FETCH DATA ──
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [projData, userData, clientData] = await Promise.all([
        api.get('/projects'),
        api.get('/users'),
        api.get('/clients')
      ]);
      setProjects(projData || []);
      setUsers(userData || []);
      setClients(clientData || []);
      
      // Update selected project if we are in detail view
      if (selectedProject) {
        const updated = projData.find(p => p.id === selectedProject.id);
        if (updated) setSelectedProject(updated);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
    if (!silent) setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const toggleProjExpand = (projId) => {
    setExpandedProj(prev => ({
      ...prev,
      [projId]: !prev[projId]
    }));
  };

  const formatAttachmentDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };


  // ── DETAIL VIEW HANDLERS ──
  const toggleMemberDetail = async (userId) => {
    if (!selectedProject) return;
    
    const target = userId.trim();
    const currentMembers = (selectedProject.members || '')
      .split(',')
      .map(m => m.trim())
      .filter(m => m !== "");
    
    const exists = currentMembers.includes(target);
    
    let updatedMembers;
    if (exists) {
      updatedMembers = currentMembers.filter(m => m !== target);
    } else {
      updatedMembers = [...currentMembers, target];
    }

    try {
      await api.put(`/projects/${selectedProject.id}`, {
        members: updatedMembers.join(',')
      });
      fetchData(true);
    } catch (error) {
      console.error('Update members error:', error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedEmployeeToAdd) {
      alert('Please select a user to add', 'warning', 'No Selection');
      return;
    }
    try {
      const currentMembers = (selectedProject.members || '')
        .split(',')
        .map(m => m.trim())
        .filter(m => m !== "");
      
      if (!currentMembers.includes(selectedEmployeeToAdd.trim())) {
        currentMembers.push(selectedEmployeeToAdd.trim());
      }

      await api.put(`/projects/${selectedProject.id}`, {
        members: currentMembers.join(',')
      });

      setSelectedEmployeeToAdd('');
      setShowAddMemberModal(false);
      fetchData(true);
      alert('Member added to project successfully!', 'success', 'Member Added');
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member: ' + error.message, 'error', 'Error');
    }
  };


  const handleAddList = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newListName.trim()) {
      setListNameError(true);
      alert('Task Group name is required.', 'warning', 'Required Field');
      return;
    }
    setListNameError(false);
    if (!selectedProject) return;
    try {
      await api.post('/task-lists', {
        name: newListName.trim(),
        projectId: selectedProject.id
      });
      setNewListName('');
      await fetchData(true);
      toast('Task group created successfully!', 'success');
    } catch (error) {
      console.error('Add list error:', error);
      alert('Failed to create task group', 'error');
    }
  };



  // ── LIST HANDLERS ──
  const handleAdd = async () => {
    if (!form.name?.trim()) {
      alert("Please enter the Project Name.", 'warning', 'Required Fields');
      return;
    }
    if (!form.clientId || !form.client?.trim()) {
      alert("Please select a Client.", 'warning', 'Required Fields');
      return;
    }
    if (form.id) {
      const originalProj = projects.find(p => p.id === form.id) || selectedProject;
      if (!canEditProject(originalProj)) {
        alert("You do not have permission to edit this project.", 'warning', 'Access Denied');
        return;
      }
    } else {
      if (!can('projects', 'create')) {
        alert("You do not have permission to create projects.", 'warning', 'Access Denied');
        return;
      }
    }
    setIsSaving(true);
    try {
      if (form.id) {
        await api.put(`/projects/${form.id}`, form);
        toast('Project updated successfully!', 'success');
      } else {
        await api.post('/projects', form);
        toast('Project created successfully!', 'success');
      }
      setForm({ name: '', status: 'Active', description: '', client: '', clientId: '', estimatedHours: 0, actualHours: 0, billableHours: 0 });
      setShowForm(false);
      fetchData();
      
      if (currentView === 'detail' && selectedProject) {
         const updatedProj = { ...selectedProject, ...form };
         setSelectedProject(updatedProj);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save project', 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (id) => {
    const proj = projects.find(p => p.id === id);
    if (!canDeleteProject(proj)) {
      alert('You do not have permission to delete this project.', 'warning', 'Access Denied');
      return;
    }
    confirm('Remove this project? This action cannot be undone.', async () => {
      setIsSaving(true);
      try {
        await api.delete(`/projects/${id}`);
        toast('Project deleted successfully.', 'success');
        fetchData();
      } catch (error) {
        console.error('Delete error:', error);
        alert(error.message || 'Failed to delete project', 'error', 'Error');
      } finally {
        setIsSaving(false);
      }
    }, 'Delete Project');
  };

  const handleRemoveList = async (listId) => {
    if (!can('projects', 'delete')) {
      alert('You do not have permission to delete task groups.', 'warning', 'Access Denied');
      return;
    }
    try {
      await api.delete(`/task-lists/${listId}`);
      fetchData(true);
    } catch (error) {
      console.error('Delete list error:', error);
      alert(error.message || 'Failed to delete task group', 'error', 'Error');
    }
  };

  const handleRenameList = async (listId) => {
    if (!editingListName.trim()) {
      alert('Category name cannot be empty.', 'warning', 'Required');
      return;
    }
    try {
      await api.put(`/task-lists/${listId}`, { name: editingListName.trim() });
      setEditingListId(null);
      setEditingListName('');
      fetchData(true);
    } catch (error) {
      console.error('Rename list error:', error);
      alert('Failed to rename category.', 'error', 'Error');
    }
  };

  const handleOpenCreateTaskModal = () => {
    setTaskFormType('create');
    setEditingTask(null);
    setTaskFormFields({
      title: '',
      assignees: '',
      status: 'To Do',
      priority: 'Medium',
      assignedDate: '',
      dueDate: '',
      deliveredDate: '',
      description: '',
      taskType: 'Feature'
    });
    setShowTaskFormModal(true);
  };

  const handleOpenEditTaskModal = (task) => {
    setTaskFormType('edit');
    setEditingTask(task);
    setTaskFormFields({
      title: task.title || '',
      assignees: task.assignees || '',
      status: task.status || 'To Do',
      priority: task.priority || 'Medium',
      assignedDate: formatDateForInput(task.assignedDate),
      dueDate: formatDateForInput(task.dueDate),
      deliveredDate: formatDateForInput(task.deliveredDate),
      description: task.description || '',
      taskType: task.taskType || 'Feature'
    });
    setShowTaskFormModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskFormFields.title?.trim() || !taskFormFields.description?.trim()) {
      alert('Task title and description are required.', 'warning', 'Required Fields');
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        ...taskFormFields,
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        clientId: selectedProject.clientId,
        taskListId: selectedTaskListId
      };

      if (taskFormType === 'edit' && editingTask) {
        await api.put(`/tasks/${editingTask.id}`, payload);
        toast('Task updated successfully!', 'success');
      } else {
        payload.createdBy = user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.name || user?.email || 'User';
        await api.post('/tasks', payload);
        toast('Task created successfully!', 'success');
      }

      setShowTaskFormModal(false);
      setTaskFormFields({ title: '', assignees: '', status: 'To Do', priority: 'Medium', assignedDate: '', dueDate: '', deliveredDate: '', description: '', taskType: 'Feature' });
      setEditingTask(null);
      fetchData(true);
    } catch (error) {
      console.error('Save task error:', error);
      alert('Failed to save task', 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    confirm('Are you sure you want to delete this task?', async () => {
      try {
        await api.delete(`/tasks/${taskId}`);
        fetchData(true);
      } catch (error) {
        console.error('Delete task error:', error);
        alert('Failed to delete task', 'error', 'Error');
      }
    }, 'Delete Task');
  };

  const handleInlineSubtaskSave = async (parentTask, listId) => {
    if (inlineSubtaskSaving) return;
    const title = subtaskTitle.trim();
    if (!title) {
      alert('Subtask title is required', 'warning', 'Validation Error');
      return;
    }
    if (!subtaskAssignee) {
      alert('Assignee is required', 'warning', 'Validation Error');
      return;
    }
    setInlineSubtaskSaving(true);
    try {
      const payload = {
        title,
        parentId: parentTask.id,
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        clientId: selectedProject.clientId,
        taskListId: listId,
        status: 'To Do',
        priority: subtaskPriority || 'Medium',
        assignees: subtaskAssignee || '',
        assignedDate: new Date().toISOString(),
        dueDate: subtaskDueDate ? new Date(subtaskDueDate).toISOString() : null,
        description: '',
        createdBy: user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.name || user?.email || 'User'
      };
      await api.post('/tasks', payload);
      toast('Subtask created successfully!', 'success');
      setSubtaskTitle('');
      setSubtaskAssignee('');
      setSubtaskDueDate('');
      setSubtaskPriority('Medium');
      setInlineSubtaskParentId(null);
      setExpandedSubtasks(prev => ({ ...prev, [parentTask.id]: true }));
      fetchData(true);
    } catch (error) {
      console.error('Create inline subtask error:', error);
      alert('Failed to create subtask: ' + error.message, 'error', 'Error');
    } finally {
      setInlineSubtaskSaving(false);
    }
  };

  const handleOpenCreateQueryModal = () => {
    if (!can('projects', 'create')) {
      alert('You do not have permission to create queries.', 'warning', 'Access Denied');
      return;
    }
    setQueryFormType('create');
    setEditingQuery(null);
    setQueryFormFields({
      title: '',
      description: '',
      sentTo: '',
      status: 'Open',
      solved: false,
      priority: 'Medium'
    });
    setShowQueryModal(true);
  };

  const handleOpenEditQueryModal = (query) => {
    if (!can('projects', 'edit')) {
      alert('You do not have permission to edit queries.', 'warning', 'Access Denied');
      return;
    }
    setQueryFormType('edit');
    setEditingQuery(query);
    setQueryFormFields({
      title: query.title || '',
      description: query.description || '',
      sentTo: query.sentTo || '',
      status: query.status || 'Open',
      solved: query.solved || false,
      priority: query.priority || 'Medium'
    });
    setShowQueryModal(true);
    setTimeout(() => {
      if (queryFormRef.current) {
        queryFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const firstInput = queryFormRef.current.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
      }
    }, 50);
  };

  const handleSaveQuery = async () => {
    const isEdit = queryFormType === 'edit' && editingQuery;
    const requiredPermission = isEdit ? 'edit' : 'create';
    if (!can('projects', requiredPermission)) {
      alert(`You do not have permission to ${isEdit ? 'edit' : 'create'} queries.`, 'warning', 'Access Denied');
      return;
    }
    if (!queryFormFields.title?.trim()) {
      alert('Query title is required.', 'warning', 'Required');
      return;
    }
    if (!queryFormFields.sentTo) {
      alert('Please select an employee to send the query to.', 'warning', 'Required');
      return;
    }
    if (!queryFormFields.priority) {
      alert('Priority is required.', 'warning', 'Required');
      return;
    }
    if (!queryFormFields.status) {
      alert('Status is required.', 'warning', 'Required');
      return;
    }
    if (!queryFormFields.description?.trim()) {
      alert('Description is required.', 'warning', 'Required');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...queryFormFields,
        projectId: selectedProject.id
      };

      if (queryFormType === 'edit' && editingQuery) {
        await api.put(`/project-queries/${editingQuery.id}`, payload);
        alert('Query updated successfully!', 'success', 'Success');
      } else {
        await api.post('/project-queries', payload);
        alert('Query created successfully!', 'success', 'Success');
      }

      setShowQueryModal(false);
      setQueryFormFields({ title: '', description: '', sentTo: '', status: 'Open', solved: false, priority: 'Medium' });
      setEditingQuery(null);
      fetchData(true);
    } catch (error) {
      console.error('Save query error:', error);
      alert('Failed to save query', 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuery = async (queryId) => {
    if (!can('projects', 'delete')) {
      alert('You do not have permission to delete queries.', 'warning', 'Access Denied');
      return;
    }
    confirm('Are you sure you want to delete this query?', async () => {
      try {
        await api.delete(`/project-queries/${queryId}`);
        fetchData(true);
      } catch (error) {
        console.error('Delete query error:', error);
        alert('Failed to delete query', 'error', 'Error');
      }
    }, 'Delete Query');
  };

  const renderForm = () => (
    <div className="saas-form-card" style={{ marginBottom: '2rem' }}>
      <div className="form-header">
        <h3 className="form-title">{form.id ? 'Edit Project' : 'Launch New Project'}</h3>
        <button className="action-btn" style={{ color: '#94A3B8' }} onClick={() => setShowForm(false)}>✕</button>
      </div>

      <div className="form-grid project-form-grid">
        <div className="saas-field">
          <label className="saas-label">Project Name *</label>
          <input className="saas-input" placeholder="e.g. Phoenix Redesign" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        </div>
        <div className="saas-field">
          <label className="saas-label">Client *</label>
          <select
            className="saas-select"
            value={form.clientId || ''}
            onChange={e => {
              const clientObj = clients.find(c => c.id === e.target.value);
              setForm({...form, clientId: clientObj?.id || null, client: clientObj?.name || ''});
            }}
          >
            <option value="">Select a Client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="saas-field proj-span-2">
          <label className="saas-label">Description</label>
          <textarea className="saas-textarea" style={{ minHeight: '60px' }} placeholder="Project description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>
        <div className="saas-field">
          <label className="saas-label">Status</label>
          <select className="saas-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <div className="saas-field">
          <label className="saas-label">Estimated Hours</label>
          <input className="saas-input" type="number" placeholder="0" value={form.estimatedHours} onChange={e => setForm({...form, estimatedHours: e.target.value})} />
        </div>
        <div className="saas-field">
          <label className="saas-label">Billed Hours</label>
          <input className="saas-input" type="number" placeholder="0" value={form.actualHours} onChange={e => setForm({...form, actualHours: e.target.value})} />
        </div>
        <div className="saas-field">
          <label className="saas-label">Billable Hours</label>
          <input className="saas-input" type="number" placeholder="0" value={form.billableHours} onChange={e => setForm({...form, billableHours: e.target.value})} />
        </div>
      </div>

      <div className="form-actions project-form-actions">
        <button className="saas-btn-submit proj-btn" onClick={handleAdd}>{form.id ? 'Save Changes' : 'Create Project'}</button>
        <button className="saas-btn-cancel proj-btn" onClick={() => setShowForm(false)}>Discard</button>
      </div>
    </div>
  );

  // Legacy modals renderTaskFormModal and renderTaskViewModal removed in favor of TaskDetailView side drawer

  const renderQueryFormModal = () => {
    if (!selectedProject) return null;
    const rawMembers = (selectedProject.members || '').split(',').map(m => m.trim()).filter(m => m !== "");
    const memberIds = [...new Set(rawMembers)];
    const assigneesList = (memberIds.length > 0 ? memberIds : users.map(u => u.id))
      .map(id => {
        const u = users.find(x => x.id === id);
        return u ? { id: u.id, name: u.name || u.username || u.email || id } : null;
      })
      .filter(Boolean);

    return (
      <div ref={queryFormRef} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2rem', marginBottom: '1.5rem', maxWidth: '780px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
            {queryFormType === 'create' ? 'Create New Query' : 'Edit Query'}
          </h3>
          <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowQueryModal(false)}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="saas-field" style={{ gridColumn: 'span 2' }}>
            <label className="saas-label">Query Title *</label>
            <input
              className="saas-input"
              placeholder="What is the query about?"
              value={queryFormFields.title}
              onChange={e => setQueryFormFields({ ...queryFormFields, title: e.target.value })}
            />
          </div>

          <div className="saas-field">
            <label className="saas-label">Sent To *</label>
            <select
              className="saas-select"
              value={queryFormFields.sentTo}
              onChange={e => setQueryFormFields({ ...queryFormFields, sentTo: e.target.value })}
            >
              <option value="">Choose employee...</option>
              {assigneesList.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="saas-field">
            <label className="saas-label">Priority *</label>
            <select
              className="saas-select"
              value={queryFormFields.priority}
              onChange={e => setQueryFormFields({ ...queryFormFields, priority: e.target.value })}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div className="saas-field">
            <label className="saas-label">Status *</label>
            <select
              className="saas-select"
              value={queryFormFields.status}
              onChange={e => setQueryFormFields({ ...queryFormFields, status: e.target.value })}
            >
              <option value="Open">Open</option>
              <option value="In Discussion">In Discussion</option>
              <option value="Solved">Solved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="saas-field">
            <label className="saas-label">Solved (Yes/No) *</label>
            <select
              className="saas-select"
              value={queryFormFields.solved ? "true" : "false"}
              onChange={e => setQueryFormFields({ ...queryFormFields, solved: e.target.value === "true" })}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>

          <div className="saas-field" style={{ gridColumn: 'span 2' }}>
            <label className="saas-label">Description *</label>
            <textarea
              className="saas-textarea"
              placeholder="Query details..."
              style={{ minHeight: '80px', resize: 'vertical' }}
              value={queryFormFields.description}
              onChange={e => setQueryFormFields({ ...queryFormFields, description: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
          <button style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: '#64748b', cursor: 'pointer' }} onClick={() => setShowQueryModal(false)}>Cancel</button>
          <button style={{ background: '#0066FF', border: 'none', borderRadius: '8px', padding: '0.6rem 1.5rem', fontWeight: '600', color: 'white', cursor: 'pointer' }} onClick={handleSaveQuery}>
            {queryFormType === 'create' ? 'Submit Query' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  };

  const renderQueryDetailInline = () => {
    if (!viewingQuery) return null;
    const sentUser = users.find(u => u.id === viewingQuery.sentTo);
    const sentName = sentUser
      ? (sentUser.fullName || sentUser.name || sentUser.username || sentUser.email)
      : (viewingQuery.sentTo || 'Unassigned');

    const closeDetail = () => setViewingQuery(null);

    const labelStyle = { fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' };
    const valueStyle = { fontSize: '0.92rem', fontWeight: '600', color: '#0f172a' };

    return (
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.75rem', marginBottom: '1.5rem' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={closeDetail}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '700', color: '#475569', cursor: 'pointer' }}
            >
              ← Back
            </button>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>Query Details</h3>
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#a21caf' }}>
            {viewingQuery.queryId || `QRY-${viewingQuery.id.slice(-4).toUpperCase()}`}
          </span>
        </div>

        {/* Fields grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem 2rem' }}>

          {/* Title — full width */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={labelStyle}>Title</div>
            <div style={{ ...valueStyle, fontSize: '1rem', fontWeight: '800' }}>{viewingQuery.title}</div>
          </div>

          {/* Sent To */}
          <div>
            <div style={labelStyle}>Sent To</div>
            {sentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '800', flexShrink: 0 }}>
                  {sentName.charAt(0).toUpperCase()}
                </div>
                <span style={valueStyle}>{sentName}</span>
              </div>
            ) : (
              <div style={{ ...valueStyle, color: '#94a3b8' }}>Unassigned</div>
            )}
          </div>

          {/* Priority */}
          <div>
            <div style={labelStyle}>Priority</div>
            <div style={{ ...valueStyle, color: viewingQuery.priority === 'High' ? '#ef4444' : viewingQuery.priority === 'Medium' ? '#ea580c' : '#16a34a' }}>
              {viewingQuery.priority || 'Medium'}
            </div>
          </div>

          {/* Status */}
          <div>
            <div style={labelStyle}>Status</div>
            <span style={{
              background: viewingQuery.status === 'Solved' || viewingQuery.solved ? '#dcfce7' : viewingQuery.status === 'In Discussion' ? '#f3e8ff' : '#dbeafe',
              color: viewingQuery.status === 'Solved' || viewingQuery.solved ? '#16a34a' : viewingQuery.status === 'In Discussion' ? '#9333ea' : '#2563eb',
              padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', display: 'inline-block'
            }}>{viewingQuery.status || 'Open'}</span>
          </div>

          {/* Solved */}
          <div>
            <div style={labelStyle}>Solved</div>
            <span style={{
              background: viewingQuery.solved ? '#dcfce7' : '#fee2e2',
              color: viewingQuery.solved ? '#15803d' : '#b91c1c',
              padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', display: 'inline-block'
            }}>{viewingQuery.solved ? 'Yes' : 'No'}</span>
          </div>

          {/* Created On */}
          <div>
            <div style={labelStyle}>Created On</div>
            <div style={valueStyle}>
              {viewingQuery.createdAt ? formatAttachmentDate(viewingQuery.createdAt) : '-'}
            </div>
          </div>

          {/* Description — full width */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={labelStyle}>Description</div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.6', background: '#f8fafc', borderRadius: '8px', padding: '0.75rem 1rem', border: '1px solid #f1f5f9' }}>
              {viewingQuery.description || '—'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // ── RENDER DETAIL VIEW ──
  const renderDetailContent = () => {
    const rawMembers = (selectedProject.members || '').split(',').map(m => m.trim()).filter(m => m !== "");
    const projMembers = [...new Set(rawMembers)];
    
    // Dynamic metrics from actual project data
    const allProjectTasks = (selectedProject.taskLists || []).reduce((acc, list) => acc.concat(list.tasks || []), []);
    const totalTasksCount = allProjectTasks.length;
    const completedTasksCount = allProjectTasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
    const inProgressTasksCount = allProjectTasks.filter(t => (t.status || '').toLowerCase() === 'in progress').length;
    const pendingTasksCount = allProjectTasks.filter(t => {
      const s = (t.status || '').toLowerCase();
      return s !== 'completed' && s !== 'in progress';
    }).length;
    const teamCount = projMembers.length;
    const queriesCount = (selectedProject.queries || []).length;
    const projectID = selectedProject.projectNo || `PRJ-2026-${selectedProject.id.substring(0,4).toUpperCase()}`;

    return (
      <div className="projects-page page-container detail-view" style={{ background: '#f8fafc', minHeight: '100vh' }}>
        
        {/* Breadcrumb Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: '600' }}>
          <button style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }} onClick={() => { setCurrentView('list'); setSelectedTaskListId(null); if (onProjectSelect) onProjectSelect(null); }}>
            Projects
          </button>
          <span style={{ color: '#94a3b8' }}>&gt;</span>
          <span style={{ color: '#0f172a' }}>Project Details</span>
        </div>

        {showForm && renderForm()}
        {showTaskFormModal && (
          <div className="task-drawer-overlay" onClick={e => { if (e.target === e.currentTarget) setShowTaskFormModal(false); }}>
            <div className="task-drawer-panel">
              <TaskDetailView
                task={editingTask}
                onSelectTask={(parent) => {
                  setShowTaskFormModal(false);
                  setViewingTask(parent);
                  setShowTaskViewModal(true);
                }}
                onSave={async (taskData, silent) => {
                  try {
                    const payload = {
                      ...taskData,
                      projectId: selectedProject.id,
                      projectName: selectedProject.name,
                      clientId: selectedProject.clientId,
                      taskListId: selectedTaskListId
                    };
                    let savedTask = null;
                    if (editingTask && editingTask.id) {
                      savedTask = await api.put(`/tasks/${editingTask.id}`, payload);
                      if (!silent) alert('Task updated successfully!', 'success', 'Success');
                    } else {
                      savedTask = await api.post('/tasks', payload);
                      if (!silent) alert('Task created successfully!', 'success', 'Success');
                    }
                    fetchData(true);
                    if (!silent) {
                      setShowTaskFormModal(false);
                    } else if (savedTask) {
                      setEditingTask(savedTask);
                    }
                  } catch (err) {
                    console.error('Error saving task:', err);
                    alert('Failed to save task: ' + err.message, 'error', 'Error');
                  }
                }}
                onDelete={async (id) => {
                  await handleDeleteTask(id);
                  setShowTaskFormModal(false);
                }}
                onClose={() => setShowTaskFormModal(false)}
                currentUser={user}
                initialEditMode={taskFormType === 'edit'}
              />
            </div>
          </div>
        )}
        {showTaskViewModal && (
          <div className="task-drawer-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowTaskViewModal(false); setViewingTask(null); } }}>
            <div className="task-drawer-panel">
              <TaskDetailView
                task={viewingTask}
                onSelectTask={(parent) => {
                  setViewingTask(parent);
                }}
                onSave={async (taskData, silent) => {
                  try {
                    const payload = {
                      ...taskData,
                      projectId: selectedProject.id,
                      projectName: selectedProject.name,
                      clientId: selectedProject.clientId,
                      taskListId: viewingTask.taskListId
                    };
                    const savedTask = await api.put(`/tasks/${viewingTask.id}`, payload);
                    if (!silent) alert('Task updated successfully!', 'success', 'Success');
                    fetchData(true);
                    if (!silent) {
                      setShowTaskViewModal(false);
                      setViewingTask(null);
                    } else if (savedTask) {
                      setViewingTask(savedTask);
                    }
                  } catch (err) {
                    console.error('Error saving task:', err);
                    alert('Failed to save task: ' + err.message, 'error', 'Error');
                  }
                }}
                onDelete={async (id) => {
                  await handleDeleteTask(id);
                  setShowTaskViewModal(false);
                  setViewingTask(null);
                }}
                onClose={() => { setShowTaskViewModal(false); setViewingTask(null); }}
                currentUser={user}
                initialEditMode={false}
              />
            </div>
          </div>
        )}
        {/* Top Profile Card */}
        <div className="detail-profile-card">
          <div className="detail-profile-left">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: '#0f172a' }}>{selectedProject.name}</h2>
                <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>{selectedProject.status || 'In Progress'}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Client: <span style={{ color: '#2563eb', fontWeight: '600' }}>{selectedProject.client || '-'}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                Project ID: <span style={{ fontWeight: '500' }}>{projectID}</span>
              </div>
            </div>
          </div>
          {canEditProject(selectedProject) && (
            <div className="detail-profile-actions">
              <button
                className="detail-edit-btn"
                title="Edit Project"
                onClick={() => {
                  setForm({
                    id: selectedProject.id,
                    name: selectedProject.name || '',
                    status: selectedProject.status || 'Active',
                    description: selectedProject.description || '',
                    client: selectedProject.client || '',
                    clientId: selectedProject.clientId || '',
                    estimatedHours: selectedProject.estimatedHours || 0,
                    actualHours: selectedProject.actualHours || 0,
                    billableHours: selectedProject.billableHours || 0
                  });
                  setShowForm(true);
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                <span className="detail-btn-text">Edit Project</span>
              </button>
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        {detailTab === 'General' && (
          <div className="detail-metrics-grid">
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Team Members</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{teamCount}</span>
                <button style={{ background: 'none', border: 'none', padding: 0, color: '#64748b', fontSize: '0.75rem', fontWeight: '500', cursor: 'pointer', textAlign: 'left', marginTop: '0.2rem' }} onClick={() => setDetailTab('Teams')}>View Team</button>
              </div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f0fdf4', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Total Tasks</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{totalTasksCount}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Completed: {completedTasksCount}</span>
              </div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Pending Tasks</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{pendingTasksCount}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>In Progress: {inProgressTasksCount}</span>
              </div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Queries Opened</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{queriesCount}</span>
                <button style={{ background: 'none', border: 'none', padding: 0, color: '#64748b', fontSize: '0.75rem', fontWeight: '500', cursor: 'pointer', textAlign: 'left', marginTop: '0.2rem' }} onClick={() => setDetailTab('Queries')}>View Queries</button>
              </div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ecfeff', color: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Delivery Status</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0ea5e9' }}>-</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>-</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Nav Tabs */}
        <div className="detail-nav-tabs">
          {[
            { id: 'General', label: 'General', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> },
            { id: 'Tasks', label: 'Task Groups', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg> },
            { id: 'Teams', label: 'Team', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg> },
            { id: 'Queries', label: 'Queries', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> },
            { id: 'Attachments', label: 'Attachments', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setDetailTab(tab.id); setSelectedTaskListId(null); setViewingQuery(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none',
                padding: '0.75rem 0', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer',
                color: detailTab === tab.id ? '#0f172a' : '#64748b',
                borderBottom: detailTab === tab.id ? '2px solid #0f172a' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'all 0.2s'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="detail-tab-content">
          
          {detailTab === 'General' && (
            <div>
              <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>Project Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Information Rows */}
                <div className="detail-info-row">
                  <div className="detail-info-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    Project Name
                  </div>
                  <div className="detail-info-sep">:</div>
                  <div className="detail-info-value">{selectedProject.name}</div>
                </div>

                <div className="detail-info-row align-start">
                  <div className="detail-info-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Description
                  </div>
                  <div className="detail-info-sep">:</div>
                  <div className="detail-info-value desc">
                    {selectedProject.description || '-'}
                  </div>
                </div>

                <div className="detail-info-row">
                  <div className="detail-info-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-3-3.87"></path><path d="M4 21v-2a4 4 0 0 1 3-3.87"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Client
                  </div>
                  <div className="detail-info-sep">:</div>
                  <div className="detail-info-value">{selectedProject.client || '-'}</div>
                </div>

                <div className="detail-info-row">
                  <div className="detail-info-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    Status
                  </div>
                  <div className="detail-info-sep">:</div>
                  <div className="detail-info-value">
                    <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>
                      {selectedProject.status || 'In Progress'}
                    </span>
                  </div>
                </div>

                {/* Hours rows */}
                <div className="detail-info-row">
                  <div className="detail-info-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Estimated Hours
                  </div>
                  <div className="detail-info-sep">:</div>
                  <div className="detail-info-value">{selectedProject.estimatedHours ? `${selectedProject.estimatedHours} hrs` : '-'}</div>
                </div>

                <div className="detail-info-row">
                  <div className="detail-info-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Billed Hours
                  </div>
                  <div className="detail-info-sep">:</div>
                  <div className="detail-info-value">{selectedProject.actualHours ? `${selectedProject.actualHours} hrs` : '-'}</div>
                </div>

                <div className="detail-info-row">
                  <div className="detail-info-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    Billable Hours
                  </div>
                  <div className="detail-info-sep">:</div>
                  <div className="detail-info-value">{selectedProject.billableHours ? `${selectedProject.billableHours} hrs` : '-'}</div>
                </div>

                <div className="detail-info-row">
                  <div className="detail-info-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Created On
                  </div>
                  <div className="detail-info-sep">:</div>
                  <div className="detail-info-value">{selectedProject.createdAt ? (() => { const d = new Date(selectedProject.createdAt); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`; })() : '-'}</div>
                </div>

              </div>
            </div>
          )}

          {detailTab === 'Tasks' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#0f172a' }}>Task Groups</h3>
                {can('projects', 'create') && (
                  <form 
                    onSubmit={handleAddList}
                    className="add-list-inline" 
                    style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        className="saas-input" 
                        placeholder="New Task Group..." 
                        style={{ 
                          width: '200px', 
                          height: '36px', 
                          fontSize: '0.85rem', 
                          padding: '0 1.5rem 0 0.75rem', 
                          borderRadius: '8px', 
                          border: listNameError ? '1.5px solid #ef4444' : '1px solid #e2e8f0', 
                          outline: 'none',
                          boxShadow: listNameError ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : 'none',
                          transition: 'all 0.2s'
                        }}
                        value={newListName}
                        onChange={e => {
                          setNewListName(e.target.value);
                          if (e.target.value.trim()) setListNameError(false);
                        }}
                      />
                      <span style={{ 
                        position: 'absolute', 
                        right: '10px', 
                        color: '#ef4444', 
                        fontWeight: 'bold', 
                        fontSize: '1rem',
                        pointerEvents: 'none'
                      }}>*</span>
                    </div>
                    <button
                      type="submit"
                      className="saas-btn-submit add-taskgroup-btn"
                      style={{ padding: '0 1rem', height: '36px', fontSize: '0.8rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      <span className="add-taskgroup-btn-text">Add Task Group</span>
                      <span className="add-taskgroup-btn-icon">+</span>
                    </button>
                  </form>
                )}
              </div>

              {(selectedProject.taskLists || []).length === 0 ? (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', background: 'white' }}>
                  No task categories created for this project yet.
                </div>
              ) : (
                <div className="cu-list-root" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: 'none', background: 'transparent', boxShadow: 'none' }}>
                  {(selectedProject.taskLists || []).map((list, idx) => {
                    const isCollapsed = expandedListId === '__first__'
                      ? idx !== 0
                      : expandedListId !== list.id;

                    const listTasks = (list.tasks || []).sort((a, b) => {
                      if (!a.dueDate) return 1;
                      if (!b.dueDate) return -1;
                      return new Date(a.dueDate) - new Date(b.dueDate);
                    });
                    const hasTasks = listTasks.length > 0;

                    return (
                      <div key={list.id} className="cu-status-section">
                        {/* Section Header */}
                        <div className="cu-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="cu-section-left" style={{ display: 'flex', alignItems: 'center', cursor: hasTasks ? 'pointer' : 'default', flex: 1 }} onClick={() => {
                            if (hasTasks && editingListId !== list.id) {
                              const isFirst = selectedProject.taskLists.indexOf(list) === 0;
                              if (expandedListId === '__first__') {
                                setExpandedListId(isFirst ? null : list.id);
                              } else {
                                toggleListAccordion(list.id);
                              }
                            }
                          }}>
                            {hasTasks ? (
                              <span className="cu-section-chevron" style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                                <svg viewBox="0 0 10 6" width="10" height="6" fill="currentColor" style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s", color: "#94a3b8" }}><path d="M0 0l5 6 5-6z"/></svg>
                              </span>
                            ) : (
                              <span style={{ width: '18px', display: 'inline-block' }} />
                            )}
                            {editingListId === list.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  className="saas-input"
                                  value={editingListName}
                                  onChange={(e) => setEditingListName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRenameList(list.id);
                                    } else if (e.key === 'Escape') {
                                      setEditingListId(null);
                                      setEditingListName('');
                                    }
                                  }}
                                  autoFocus
                                  style={{ height: '32px', fontSize: '0.85rem', padding: '0 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', width: '200px' }}
                                />
                                <button
                                  onClick={() => handleRenameList(list.id)}
                                  style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                  title="Save"
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </button>
                                <button
                                  onClick={() => { setEditingListId(null); setEditingListName(''); }}
                                  style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                  title="Cancel"
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="cu-section-title" style={{ fontWeight: '700', fontSize: '0.8rem', color: '#2563eb', textTransform: 'uppercase' }}>{list.name}</span>
                                <span className="cu-section-count" style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '12px', fontWeight: '700' }}>{listTasks.length}</span>
                              </>
                            )}
                          </div>
                          
                          <div className="cu-section-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {can('tasks', 'create') && (
                              <button
                                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                                title="Add Task to Group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTaskListId(list.id);
                                  setTaskFormType('create');
                                  setEditingTask(null);
                                  setTaskFormFields({
                                    title: '',
                                    assignees: '',
                                    status: 'To Do',
                                    priority: 'Medium',
                                    assignedDate: '',
                                    dueDate: '',
                                    deliveredDate: '',
                                    description: '',
                                    taskType: 'Feature'
                                  });
                                  setShowTaskFormModal(true);
                                }}
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                              </button>
                            )}
                            {can('projects', 'edit') && editingListId !== list.id && (
                              <button
                                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                                title="Rename Category"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingListId(list.id);
                                  setEditingListName(list.name);
                                }}
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                              </button>
                            )}
                            {can('projects', 'delete') && editingListId !== list.id && (
                              <button
                                style={{ background: 'none', border: 'none', color: listTasks.length > 0 ? '#cbd5e1' : '#ef4444', cursor: listTasks.length > 0 ? 'not-allowed' : 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                                title={listTasks.length > 0 ? `Cannot delete — ${listTasks.length} task${listTasks.length > 1 ? 's' : ''} exist in this group` : 'Delete Category'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (listTasks.length > 0) {
                                    alert(`"${list.name}" has ${listTasks.length} task${listTasks.length > 1 ? 's' : ''}. Remove all tasks from this group before deleting it.`, 'warning', 'Cannot Delete');
                                    return;
                                  }
                                  confirm(`Delete "${list.name}" task group?`, () => handleRemoveList(list.id), 'Delete Task Group');
                                }}
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Accordion Table Body */}
                        {!isCollapsed && hasTasks && (
                          <div className="cu-table-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: 'white', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                            <table className="cu-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr className="cu-thead-row" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                  <th className="cu-th cu-th-name" style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '35%' }}>NAME</th>
                                  <th className="cu-th cu-th-assignee" style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '15%', textAlign: 'center' }}>ASSIGNEE</th>
                                  <th className="cu-th cu-th-list" style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '15%' }}>STATUS</th>
                                  <th className="cu-th cu-th-delivery" style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '15%', textAlign: 'center' }}>DELIVERY DATE</th>
                                  <th className="cu-th cu-th-priority" style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '15%', textAlign: 'center' }}>PRIORITY</th>
                                  <th className="cu-th cu-th-actions" style={{ padding: '0.85rem 1.25rem', width: '5%' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {listTasks.length === 0 ? (
                                  <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                                      No tasks in this list.
                                    </td>
                                  </tr>
                                ) : (
                                  (() => {
                                    const allTasks = list.tasks || [];
                                    // Filter main tasks (no parentId or parent not in this list)
                                    const mainTasks = allTasks.filter(t => !t.parentId || !allTasks.some(p => p.id === t.parentId));
                                    
                                    // Sort main tasks by due date
                                    const sortedMainTasks = [...mainTasks].sort((a, b) => {
                                      if (!a.dueDate) return 1;
                                      if (!b.dueDate) return -1;
                                      return new Date(a.dueDate) - new Date(b.dueDate);
                                    });

                                    return sortedMainTasks.flatMap(task => {
                                      const subTasks = allTasks.filter(t => t.parentId === task.id);
                                      const isExpanded = !!expandedSubtasks[task.id];
                                      
                                      const relDate = formatRelativeDueDate(task.dueDate);
                                      const meta = STATUS_HEADER_META[task.status] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', isDone: false };
                                      const assignees = task.assignees ? task.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];

                                      const parentRow = (
                                        <tr key={task.id} className="cu-row" onClick={() => { setViewingTask(task); setShowTaskViewModal(true); }} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}>
                                          <td className="cu-td cu-td-name" style={{ padding: '0.85rem 1.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                              {subTasks.length > 0 && (
                                                <button
                                                  style={{ background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedSubtasks(prev => ({ ...prev, [task.id]: !prev[task.id] }));
                                                  }}
                                                  title={isExpanded ? "Collapse Subtasks" : "Expand Subtasks"}
                                                >
                                                  <svg viewBox="0 0 10 6" width="8" height="8" fill="currentColor" style={{ transform: isExpanded ? "none" : "rotate(-90deg)", transition: "transform 0.15s", color: "#64748b" }}><path d="M0 0l5 6 5-6z"/></svg>
                                                </button>
                                              )}
                                              {subTasks.length === 0 && <span style={{ width: '18px', display: 'inline-block' }} />}
                                              <TaskTitleTooltip text={task.title || 'Untitled Task'}>
                                                <span className="cu-task-title" style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>{task.title || 'Untitled Task'}</span>
                                              </TaskTitleTooltip>
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
                                                    border: '1px solid #bfdbfe'
                                                  }}
                                                  title={`${subTasks.length} Subtasks`}
                                                >
                                                  {subTasks.length}
                                                </span>
                                              )}
                                              {can('tasks', 'create') && (
                                                <button
                                                  className="cu-hover-subtask-btn"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedSubtasks(prev => ({ ...prev, [task.id]: true }));
                                                    setInlineSubtaskParentId(task.id);
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
                                              )}
                                            </div>
                                          </td>
                                          <td className="cu-td cu-td-assignee" style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                                            <div className="cu-avatars" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                                              {assignees.length === 0 ? (
                                                <div className="cu-avatar-empty" title="Unassigned" style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                </div>
                                              ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                  {assignees.map(a => {
                                                    const uObj = users.find(u => u.id === a);
                                                    const dispName = uObj ? (uObj.fullName || `${uObj.firstName || ''} ${uObj.lastName || ''}`.trim() || 'Unknown') : 'Unknown';
                                                    return (
                                                      <div key={a} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                        <div className={`cu-avatar ${getAvatarColor(dispName)}`} title={dispName} style={{ width: '24px', height: '24px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '600' }}>
                                                          {initials(dispName)}
                                                        </div>
                                                        <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: '500' }}>{dispName}</span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          </td>
                                          <td className="cu-td cu-td-list" style={{ padding: '0.85rem 1.25rem' }}>
                                            <span style={{
                                              background: meta.bg,
                                              color: meta.fg,
                                              border: meta.border || 'none',
                                              padding: '0.2rem 0.6rem',
                                              borderRadius: '5px',
                                              fontSize: '0.75rem',
                                              fontWeight: '700',
                                              textTransform: 'uppercase',
                                              display: 'inline-block'
                                            }}>
                                              {task.status || 'To Do'}
                                            </span>
                                          </td>
                                          <td className="cu-td cu-td-delivery" style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                                            {task.dueDate ? (
                                              <span className={`cu-due-badge ${relDate?.isOverdue ? 'overdue' : ''}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: relDate?.isOverdue ? '#fee2e2' : '#f1f5f9', color: relDate?.isOverdue ? '#ef4444' : '#475569' }}>
                                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                              </span>
                                            ) : <span className="cu-empty-cell">-</span>}
                                          </td>
                                          <td className="cu-td cu-td-priority" style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                                            <span className="cu-priority-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: '#475569' }}>
                                              <PriorityFlag priority={task.priority} />
                                              <span>{task.priority || 'Medium'}</span>
                                            </span>
                                          </td>
                                          <td className="cu-td cu-td-actions" onClick={e => e.stopPropagation()} style={{ padding: '0.85rem 1.25rem' }}>
                                            <div className="cu-row-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                              <button className="cu-act-btn" onClick={() => { setViewingTask(task); setShowTaskViewModal(true); }} title="View" style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '0.25rem' }}>
                                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                              </button>
                                              {can('tasks', 'edit') && (
                                                <button className="cu-act-btn" onClick={() => { setSelectedTaskListId(list.id); handleOpenEditTaskModal(task); }} title="Edit" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}>
                                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                </button>
                                              )}
                                              {can('tasks', 'delete') && (
                                                <button className="cu-act-btn danger" onClick={() => handleDeleteTask(task.id)} title="Delete" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}>
                                                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );

                                      const rows = [parentRow];

                                      if (isExpanded) {
                                        // Sort subtasks by due date
                                        const sortedSubtasks = [...subTasks].sort((a, b) => {
                                          if (!a.dueDate) return 1;
                                          if (!b.dueDate) return -1;
                                          return new Date(a.dueDate) - new Date(b.dueDate);
                                        });

                                        sortedSubtasks.forEach(sub => {
                                          const subRelDate = formatRelativeDueDate(sub.dueDate);
                                          const subMeta = STATUS_HEADER_META[sub.status] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', isDone: false };
                                          const subAssignees = sub.assignees ? sub.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];

                                          rows.push(
                                            <tr key={sub.id} className="cu-row cu-subtask-row" onClick={() => { setViewingTask(sub); setShowTaskViewModal(true); }} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s', background: '#f8fafc' }}>
                                              <td className="cu-td cu-td-name" style={{ padding: '0.85rem 1.25rem', paddingLeft: '2.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                                  <span className="cu-subtask-indicator" style={{ color: '#94a3b8', marginRight: '4px', fontSize: '1rem', fontWeight: 'bold' }}>↳</span>
                                                  <TaskTitleTooltip text={sub.title || 'Untitled Subtask'}>
                                                    <span className="cu-task-title" style={{ fontSize: '0.85rem', color: '#475569' }}>{sub.title || 'Untitled Subtask'}</span>
                                                  </TaskTitleTooltip>
                                                </div>
                                              </td>
                                              <td className="cu-td cu-td-assignee" style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                                                <div className="cu-avatars" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                                                  {subAssignees.length === 0 ? (
                                                    <div className="cu-avatar-empty" title="Unassigned" style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                    </div>
                                                  ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                      {subAssignees.map(a => {
                                                        const uObj = users.find(u => u.id === a);
                                                        const dispName = uObj ? (uObj.fullName || `${uObj.firstName || ''} ${uObj.lastName || ''}`.trim() || 'Unknown') : 'Unknown';
                                                        return (
                                                          <div key={a} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                            <div className={`cu-avatar ${getAvatarColor(dispName)}`} title={dispName} style={{ width: '24px', height: '24px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '600' }}>
                                                              {initials(dispName)}
                                                            </div>
                                                            <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: '500' }}>{dispName}</span>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="cu-td cu-td-list" style={{ padding: '0.85rem 1.25rem' }}>
                                                <span style={{
                                                  background: subMeta.bg,
                                                  color: subMeta.fg,
                                                  border: subMeta.border || 'none',
                                                  padding: '0.2rem 0.6rem',
                                                  borderRadius: '5px',
                                                  fontSize: '0.75rem',
                                                  fontWeight: '700',
                                                  textTransform: 'uppercase',
                                                  display: 'inline-block'
                                                }}>
                                                  {sub.status || 'To Do'}
                                                </span>
                                              </td>
                                              <td className="cu-td cu-td-delivery" style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                                                {sub.dueDate ? (
                                                  <span className={`cu-due-badge ${subRelDate?.isOverdue ? 'overdue' : ''}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: subRelDate?.isOverdue ? '#fee2e2' : '#f1f5f9', color: subRelDate?.isOverdue ? '#ef4444' : '#475569' }}>
                                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                    {new Date(sub.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                  </span>
                                                ) : <span className="cu-empty-cell">-</span>}
                                              </td>
                                              <td className="cu-td cu-td-priority" style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                                                <span className="cu-priority-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: '#475569' }}>
                                                  <PriorityFlag priority={sub.priority} />
                                                  <span>{sub.priority || 'Medium'}</span>
                                                </span>
                                              </td>
                                              <td className="cu-td cu-td-actions" onClick={e => e.stopPropagation()} style={{ padding: '0.85rem 1.25rem' }}>
                                                <div className="cu-row-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                  <button className="cu-act-btn" onClick={() => { setViewingTask(sub); setShowTaskViewModal(true); }} title="View" style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '0.25rem' }}>
                                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                  </button>
                                                  {can('tasks', 'edit') && (
                                                    <button className="cu-act-btn" onClick={() => { setSelectedTaskListId(list.id); handleOpenEditTaskModal(sub); }} title="Edit" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}>
                                                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                    </button>
                                                  )}
                                                  {can('tasks', 'delete') && (
                                                    <button className="cu-act-btn danger" onClick={() => handleDeleteTask(sub.id)} title="Delete" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}>
                                                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                    </button>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        });
                                      }

                                      // Inline subtask creation row
                                      if (inlineSubtaskParentId === task.id) {
                                        rows.push(
                                          <tr key={`add-sub-${task.id}`} className="cu-inline-row animate-fade-in" style={{ background: '#f8fafc' }}>
                                            <td colSpan="6" style={{ paddingLeft: '2.5rem' }}>
                                              <div className="new-task-inline-bar" style={{ borderLeft: '2px solid #2563eb', paddingLeft: '8px' }} onClick={e => e.stopPropagation()}>
                                                <div className="ntib-left">
                                                  <span className="ntib-dotted-circle"></span>
                                                  <input
                                                    type="text"
                                                    placeholder="Subtask Name or type '/' for commands"
                                                    value={subtaskTitle}
                                                    onChange={e => setSubtaskTitle(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter' && !inlineSubtaskSaving) handleInlineSubtaskSave(task, list.id); if (e.key === 'Escape') setInlineSubtaskParentId(null); }}
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
                                                      {getFilteredUsersForProject().map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
                                                    </select>
                                                    {subtaskAssignee && <span className="ntib-badge">{initials((users.find(u => u.id === subtaskAssignee) || {}).fullName || subtaskAssignee)}</span>}
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
                                                      <option value="Critical">Critical Priority</option>
                                                      <option value="High">High Priority</option>
                                                      <option value="Medium">Medium Priority</option>
                                                      <option value="Low">Low Priority</option>
                                                    </select>
                                                    {subtaskPriority && <span className="ntib-badge priority-color">{subtaskPriority}</span>}
                                                  </div>
                                                  
                                                  <button type="button" className="ntib-cancel-btn" onClick={() => setInlineSubtaskParentId(null)}>Cancel</button>
                                                  <button type="button" className="ntib-save-btn" disabled={inlineSubtaskSaving} onClick={() => handleInlineSubtaskSave(task, list.id)}>{inlineSubtaskSaving ? 'Saving...' : 'Save ↵'}</button>
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      }

                                      return rows;
                                    });
                                  })()
                                )}
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
          )}

          {detailTab === 'Teams' && (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>Team Members</h3>
                {can('projects', 'assign') && (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      className="saas-btn-submit add-team-member-btn"
                      style={{ background: '#0066FF', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      onClick={() => setShowAddMemberModal(true)}
                    >
                      <span className="add-team-member-btn-text">+ Add Member</span>
                      <span className="add-team-member-btn-icon">+</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Members Table — Desktop */}
              <div className="saas-table-container team-table-desktop" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <table className="saas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '1rem 1.5rem', width: '60px', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>#</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Member Name</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Designation</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Status</th>
                      {can('projects', 'assign') && (
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {projMembers.length === 0 ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No members assigned.</td></tr>
                    ) : (
                      projMembers.map((m, idx) => {
                        const usr = users.find(u => u.id === m) || {};
                        const displayName = usr.fullName || `${usr.firstName || ''} ${usr.lastName || ''}`.trim() || 'Unknown';
                        
                        const isActive = true;
                        const statusVal = 'Active';
                        const designation = 'Member';
                        
                        const loggedInId = user?.id || '';
                        const isYou = loggedInId && m === loggedInId;
                        
                        // Avatar helpers
                        const getInitials = (name) => {
                          return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        };
                        const getAvatarColor = (name) => {
                          let hash = 0;
                          for (let i = 0; i < name.length; i++) {
                            hash = name.charCodeAt(i) + ((hash << 5) - hash);
                          }
                          const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'];
                          return colors[Math.abs(hash) % colors.length];
                        };

                        return (
                          <tr key={`${m}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '1rem 1.5rem', color: '#64748b', fontSize: '0.85rem', fontWeight: '600' }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {usr.profileImage ? (
                                  <img src={usr.profileImage} alt={m} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #e2e8f0' }} />
                                ) : (
                                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: getAvatarColor(displayName), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', border: '1.5px solid #e2e8f0' }}>
                                    {getInitials(displayName)}
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.9rem' }}>{displayName}</span>
                                  {isYou && (
                                    <span style={{ background: '#EFF6FF', color: '#0066FF', borderRadius: '4px', fontSize: '0.65rem', padding: '2px 6px', fontWeight: '700' }}>You</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', color: '#475569', fontSize: '0.85rem', fontWeight: '500' }}>
                              {designation}
                            </td>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <span style={{ 
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                background: isActive ? '#dcfce7' : '#fee2e2', 
                                color: isActive ? '#15803d' : '#b91c1c', 
                                padding: '0.25rem 0.6rem', 
                                borderRadius: '999px', 
                                fontSize: '0.75rem', 
                                fontWeight: '700'
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#15803d' : '#b91c1c' }}></span>
                                {statusVal}
                              </span>
                            </td>
                            {can('projects', 'assign') && (
                              <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1rem', justifyContent: 'flex-end' }}>
                                  {/* Delete Icon */}
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => {
                                    confirm(`Delete member "${displayName}" from this project?`, () => toggleMemberDetail(m), 'Remove Member');
                                  }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Members Cards — Mobile */}
              <div className="team-cards-mobile">
                {projMembers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No members assigned.</div>
                ) : (
                  projMembers.map((m, idx) => {
                    const usr = users.find(u => u.id === m) || {};
                    const displayName = usr.fullName || `${usr.firstName || ''} ${usr.lastName || ''}`.trim() || 'Unknown';
                    const isActive = true;
                    const statusVal = 'Active';
                    const designation = 'Member';
                    const loggedInId = user?.id || '';
                    const isYou = loggedInId && m === loggedInId;
                    const getInitials = (name) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                    const getAvatarColor = (name) => {
                      let hash = 0;
                      for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                      const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'];
                      return colors[Math.abs(hash) % colors.length];
                    };

                    return (
                      <div key={`mobile-${m}-${idx}`} className="team-member-card">
                        <div className="tmc-left">
                          <span className="tmc-index">{idx + 1}</span>
                          {usr.profileImage ? (
                            <img src={usr.profileImage} alt={m} className="tmc-avatar" />
                          ) : (
                            <div className="tmc-avatar" style={{ backgroundColor: getAvatarColor(displayName) }}>
                              {getInitials(displayName)}
                            </div>
                          )}
                          <div className="tmc-info">
                            <div className="tmc-name-row">
                              <span className="tmc-name">{displayName}</span>
                              {isYou && <span className="tmc-you-badge">You</span>}
                            </div>
                            <span className="tmc-designation">{designation}</span>
                          </div>
                        </div>
                        <div className="tmc-right">
                          <span className="tmc-status" style={{
                            background: isActive ? '#dcfce7' : '#fee2e2',
                            color: isActive ? '#15803d' : '#b91c1c'
                          }}>
                            <span className="tmc-status-dot" style={{ backgroundColor: isActive ? '#15803d' : '#b91c1c' }}></span>
                            {statusVal}
                          </span>
                          {can('projects', 'assign') && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="tmc-delete-icon" onClick={() => {
                              confirm(`Delete member "${displayName}" from this project?`, () => toggleMemberDetail(m), 'Remove Member');
                            }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer / Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem 0' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Showing 1 to {projMembers.length} of {projMembers.length} members
                </span>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <button style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                    &lt;
                  </button>
                  <button style={{ border: 'none', background: '#0066FF', color: 'white', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', cursor: 'pointer' }}>
                    1
                  </button>
                  <button style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                    &gt;
                  </button>
                </div>
              </div>

              {/* Modals for Teams Tab */}
              {showAddMemberModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                  <div style={{ background: 'white', borderRadius: '12px', width: '450px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Add Team Member</h3>
                      <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowAddMemberModal(false)}>✕</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                      <div className="saas-field">
                        <label className="saas-label">Select Employee</label>
                        <select
                          className="saas-select"
                          value={selectedEmployeeToAdd}
                          onChange={e => setSelectedEmployeeToAdd(e.target.value)}
                        >
                          <option value="">Choose a user...</option>
                          {users
                            .filter(u => !projMembers.includes(u.id))
                            .map(u => {
                              const displayName = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown';
                              return (
                                <option key={u.id} value={u.id}>{displayName} ({u.role || 'No role'})</option>
                              );
                            })
                          }
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: '#64748b', cursor: 'pointer' }} onClick={() => setShowAddMemberModal(false)}>Cancel</button>
                      <button style={{ background: '#0066FF', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: 'white', cursor: 'pointer' }} onClick={handleAddMember}>Add Member</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {detailTab === 'Queries' && (
            <div>
              {/* Metrics cards row */}
              {(() => {
                const queriesList = selectedProject.queries || [];
                const totalQueries = queriesList.length;
                const openQueries = queriesList.filter(q => q.status === 'Open').length;
                const inDiscussionQueries = queriesList.filter(q => q.status === 'In Discussion').length;
                const solvedQueries = queriesList.filter(q => q.solved).length;
                const closedQueries = queriesList.filter(q => q.status === 'Closed').length;

                return (
                  <div className="queries-stats-grid">
                    {/* Total Queries Card */}
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#EFF6FF', color: '#0066FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Queries</div>
                        <div style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: '800' }}>{totalQueries}</div>
                      </div>
                    </div>

                    {/* Open Queries Card */}
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#FFF7ED', color: '#EA580C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Open</div>
                        <div style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: '800' }}>{openQueries}</div>
                      </div>
                    </div>

                    {/* In Discussion Card */}
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>In Discussion</div>
                        <div style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: '800' }}>{inDiscussionQueries}</div>
                      </div>
                    </div>

                    {/* Solved Card */}
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Solved (Yes)</div>
                        <div style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: '800' }}>{solvedQueries}</div>
                      </div>
                    </div>

                    {/* Closed Card */}
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><polyline points="9 17 9 12 15 12 15 17"></polyline></svg>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Closed</div>
                        <div style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: '800' }}>{closedQueries}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Inline query form */}
              {showQueryModal && renderQueryFormModal()}

              {viewingQuery ? renderQueryDetailInline() : (<>
              {/* Filter controls row */}
              <div className="queries-filter-bar">
                <div className="queries-filter-controls">
                  {/* Search box */}
                  <div className="queries-search-wrap">
                    <input
                      className="saas-input queries-search-input"
                      placeholder="Search queries by title, description..."
                      value={querySearchText}
                      onChange={e => setQuerySearchText(e.target.value)}
                      style={{ paddingLeft: '2.25rem', height: '40px', fontSize: '0.82rem' }}
                    />
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2.5" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
                      <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>

                  {/* Selects + Reset in one row */}
                  <div className="queries-selects-row">
                    {/* Status filter dropdown */}
                    <select
                      className="saas-select queries-filter-select"
                      value={queryStatusFilter}
                      onChange={e => setQueryStatusFilter(e.target.value)}
                    >
                      <option value="All Status">All Status</option>
                      <option value="Open">Open</option>
                      <option value="In Discussion">In Discussion</option>
                      <option value="Solved">Solved</option>
                      <option value="Closed">Closed</option>
                    </select>

                    {/* Sent To filter dropdown */}
                    <select
                      className="saas-select queries-filter-select queries-filter-select-narrow"
                      value={querySentToFilter}
                      onChange={e => setQuerySentToFilter(e.target.value)}
                    >
                      <option value="All Sent To">All Sent To</option>
                      {projMembers.map(memberId => {
                        const memberUser = users.find(u => u.id === memberId);
                        const memberName = memberUser ? (memberUser.name || memberUser.fullName || memberUser.username || memberUser.email) : memberId;
                        return <option key={memberId} value={memberId}>{memberName}</option>;
                      })}
                    </select>

                    {/* Priority filter dropdown */}
                    <select
                      className="saas-select queries-filter-select"
                      value={queryPriorityFilter}
                      onChange={e => setQueryPriorityFilter(e.target.value)}
                    >
                      <option value="All Priority">All Priority</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>

                    {/* Reset Filters button */}
                    <button
                      className="queries-reset-btn"
                      onClick={() => {
                        setQuerySearchText('');
                        setQueryStatusFilter('All Status');
                        setQuerySentToFilter('All Sent To');
                        setQueryPriorityFilter('All Priority');
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                      <span className="queries-btn-text">Reset</span>
                    </button>
                  </div>
                </div>

                <div className="queries-filter-actions">
                  {/* New Query Button */}
                  {can('projects', 'create') && (
                    <button
                      className="saas-btn-submit queries-new-btn"
                      onClick={handleOpenCreateQueryModal}
                    >
                      <span className="queries-btn-text">+ New Query</span>
                      <span className="queries-btn-icon">+</span>
                    </button>
                  )}

                  {/* Filters Button */}
                  <button className="queries-filters-btn">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    <span className="queries-btn-text">Filters</span>
                  </button>
                </div>
              </div>

              {/* Table section */}
              {(() => {
                const queriesList = selectedProject.queries || [];
                const filteredQueries = queriesList.filter(q => {
                  const matchesSearch = querySearchText ? (
                    (q.title || '').toLowerCase().includes(querySearchText.toLowerCase()) ||
                    (q.description || '').toLowerCase().includes(querySearchText.toLowerCase())
                  ) : true;
                  const matchesStatus = queryStatusFilter === 'All Status' ? true : (
                    queryStatusFilter === 'Solved' ? q.solved : q.status === queryStatusFilter
                  );
                  const matchesSentTo = querySentToFilter === 'All Sent To' ? true : q.sentTo === querySentToFilter;
                  const matchesPriority = queryPriorityFilter === 'All Priority' ? true : q.priority === queryPriorityFilter;
                  return matchesSearch && matchesStatus && matchesSentTo && matchesPriority;
                });

                return (
                  <div className="saas-table-container queries-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="saas-table queries-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '100px' }}>Query ID</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '200px' }}>Title</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '250px' }}>Description</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '140px' }}>Sent To</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '120px' }}>Status</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '90px' }}>Solved</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '100px' }}>Priority</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '120px' }}>Created On</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', textAlign: 'center', width: '120px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredQueries.length === 0 ? (
                            <tr>
                              <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                                No queries found matching the filters.
                              </td>
                            </tr>
                          ) : (
                            filteredQueries.map((q) => {
                              // Avatar details
                              const getInitials = (name) => {
                                return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                              };
                              const getAvatarColor = (name) => {
                                let hash = 0;
                                for (let i = 0; i < name.length; i++) {
                                  hash = name.charCodeAt(i) + ((hash << 5) - hash);
                                }
                                const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'];
                                return colors[Math.abs(hash) % colors.length];
                              };

                              return (
                                <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td data-label="Query ID" style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', fontWeight: '700', color: '#a21caf' }}>
                                    {q.queryId || `QRY-${q.id.slice(-4).toUpperCase()}`}
                                  </td>
                                  <td data-label="Title" style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#0f172a', fontWeight: '600' }}>
                                    {q.title}
                                  </td>
                                  <td data-label="Description" style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }} title={q.description}>
                                    {q.description || '-'}
                                  </td>
                                  <td data-label="Sent To" style={{ padding: '1rem 1.5rem' }}>
                                    {q.sentTo ? (() => {
                                      const sentUser = users.find(u => u.id === q.sentTo);
                                      const displayName = sentUser ? (sentUser.name || sentUser.username || sentUser.email) : q.sentTo;
                                      return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: getAvatarColor(displayName), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.65rem' }}>
                                            {getInitials(displayName)}
                                          </div>
                                          <span style={{ fontSize: '0.8rem', fontWeight: '500', color: '#334155' }}>{displayName}</span>
                                        </div>
                                      );
                                    })() : (
                                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Unassigned</span>
                                    )}
                                  </td>
                                  <td data-label="Status" style={{ padding: '1rem 1.5rem' }}>
                                    <span style={{
                                      background: q.status === 'Solved' || q.solved ? '#dcfce7' : q.status === 'In Discussion' ? '#f3e8ff' : '#dbeafe',
                                      color: q.status === 'Solved' || q.solved ? '#16a34a' : q.status === 'In Discussion' ? '#9333ea' : '#2563eb',
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      fontWeight: '700'
                                    }}>
                                      {q.status || 'Open'}
                                    </span>
                                  </td>
                                  <td data-label="Solved" style={{ padding: '1rem 1.5rem' }}>
                                    <span style={{
                                      background: q.solved ? '#dcfce7' : '#fee2e2',
                                      color: q.solved ? '#15803d' : '#b91c1c', 
                                      padding: '0.2rem 0.5rem', 
                                      borderRadius: '4px', 
                                      fontSize: '0.75rem', 
                                      fontWeight: '700' 
                                    }}>
                                      {q.solved ? 'Yes' : 'No'}
                                    </span>
                                  </td>
                                  <td data-label="Priority" style={{ padding: '1rem 1.5rem' }}>
                                    <span style={{
                                      color: q.priority === 'High' ? '#ef4444' : q.priority === 'Medium' ? '#ea580c' : '#16a34a',
                                      fontSize: '0.75rem',
                                      fontWeight: '700'
                                    }}>
                                      {q.priority || 'Medium'}
                                    </span>
                                  </td>
                                  <td data-label="Created On" style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                                    {formatAttachmentDate(q.createdAt)}
                                  </td>
                                  <td data-label="Action" style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                      {/* View button */}
                                      <button 
                                        style={{ background: 'none', border: 'none', color: '#0066FF', cursor: 'pointer', padding: '0.25rem' }} 
                                        title="View Details"
                                        onClick={() => setViewingQuery(q)}
                                      >
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                      </button>

                                      {/* Edit button */}
                                      {can('projects', 'edit') && (
                                        <button 
                                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }} 
                                          title="Edit Query"
                                          onClick={() => handleOpenEditQueryModal(q)}
                                        >
                                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                      )}

                                      {/* Delete button */}
                                      {can('projects', 'delete') && (
                                        <button 
                                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }} 
                                          title="Delete Query"
                                          onClick={() => handleDeleteQuery(q.id)}
                                        >
                                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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

                    {/* Pagination footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Showing 1 to {filteredQueries.length} of {filteredQueries.length} queries
                      </span>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <button style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                          &lt;
                        </button>
                        <button style={{ border: 'none', background: '#0066FF', color: 'white', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', cursor: 'pointer' }}>
                          1
                        </button>
                        <button style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                          &gt;
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}</>)}
            </div>
          )}

          {detailTab === 'Attachments' && (() => {
            const attachments = selectedProject.attachments || [];
            const perPage = 10;

            const getFileExt = (name) => {
              if (!name) return '';
              const parts = name.split('.');
              return parts.length > 1 ? parts.pop().toLowerCase() : '';
            };

            const getFileIcon = (name) => {
              const ext = getFileExt(name);
              const s = { width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '800', color: 'white', flexShrink: 0 };
              if (!ext || ['folder'].includes(ext)) return <div style={{ ...s, background: '#facc15', color: '#854d0e' }}>📁</div>;
              if (['pdf'].includes(ext)) return <div style={{ ...s, background: '#ef4444' }}>PDF</div>;
              if (['xls', 'xlsx', 'csv'].includes(ext)) return <div style={{ ...s, background: '#22c55e' }}>XLS</div>;
              if (['doc', 'docx'].includes(ext)) return <div style={{ ...s, background: '#3b82f6' }}>DOC</div>;
              if (['ppt', 'pptx'].includes(ext)) return <div style={{ ...s, background: '#f97316' }}>PPT</div>;
              if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return <div style={{ ...s, background: '#8b5cf6' }}>IMG</div>;
              if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <div style={{ ...s, background: '#64748b' }}>ZIP</div>;
              return <div style={{ ...s, background: '#94a3b8' }}>FILE</div>;
            };

            const getFileType = (name) => {
              const ext = getFileExt(name);
              if (!ext) return 'Folder';
              if (['pdf'].includes(ext)) return 'PDF';
              if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Spreadsheet';
              if (['doc', 'docx'].includes(ext)) return 'Document';
              if (['ppt', 'pptx'].includes(ext)) return 'Presentation';
              if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'Image';
              if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'Archive';
              return 'Other';
            };

            const filtered = attachments.filter(a => {
              const matchesSearch = !attachSearch.trim() || (a.name || '').toLowerCase().includes(attachSearch.toLowerCase()) || (a.description || '').toLowerCase().includes(attachSearch.toLowerCase());
              const matchesType = attachTypeFilter === 'All' || getFileType(a.name) === attachTypeFilter;
              return matchesSearch && matchesType;
            });

            const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
            const paginated = filtered.slice((attachPage - 1) * perPage, attachPage * perPage);

            const handleUpload = async () => {
              if (!can('projects', 'create')) {
                alert('You do not have permission to upload attachments.', 'warning', 'Access Denied');
                return;
              }
              if (!uploadForm.name.trim()) { alert('Please enter a file name', 'warning', 'Required'); return; }
              if (!uploadForm.description.trim()) { alert('Please enter a description', 'warning', 'Required'); return; }
              if (!uploadForm.file) { alert('Please choose a file to upload', 'warning', 'Required'); return; }
              setUploading(true);
              let fileUrl = '';
              let fileSize = '';

              if (uploadForm.file) {
                fileSize = uploadForm.file.size < 1024 * 1024
                  ? (uploadForm.file.size / 1024).toFixed(1) + ' KB'
                  : (uploadForm.file.size / (1024 * 1024)).toFixed(2) + ' MB';

                if (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME && process.env.REACT_APP_CLOUDINARY_CLOUD_NAME !== 'undefined') {
                  try {
                    const fd = new FormData();
                    fd.append('file', uploadForm.file);
                    fd.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'img_default');
                    const resp = await fetch(`https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/auto/upload`, { method: 'POST', body: fd });
                    const data = await resp.json();
                    fileUrl = data.secure_url || data.url || '';
                  } catch (err) {
                    console.error('Cloudinary upload error:', err);
                  }
                }
              }

              try {
                await api.post(`/projects/${selectedProject.id}/attachments`, {
                  name: uploadForm.name,
                  description: uploadForm.description,
                  uploadedBy: user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Unknown',
                  fileSize: fileSize || '-',
                  fileUrl
                });
                setShowUploadModal(false);
                setUploadForm({ name: '', description: '', file: null });
                fetchData(true);
                alert('File uploaded successfully!', 'success', 'Uploaded');
              } catch (err) {
                console.error('Upload save error:', err);
                alert('Failed to save attachment', 'error', 'Error');
              }
              setUploading(false);
            };

            const handleDeleteAttachment = async (attId) => {
              if (!can('projects', 'delete')) {
                alert('You do not have permission to delete attachments.', 'warning', 'Access Denied');
                return;
              }
              try {
                await api.delete(`/projects/${selectedProject.id}/attachments/${attId}`);
                fetchData(true);
              } catch (err) {
                console.error('Delete attachment error:', err);
              }
            };

            return (
              <div>
                {/* Toolbar */}
                <div className="attach-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div className="attach-toolbar-left" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div className="attach-search-wrap" style={{ position: 'relative' }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                      <input
                        className="attach-search-input"
                        placeholder="Search attachments..."
                        value={attachSearch}
                        onChange={e => setAttachSearch(e.target.value)}
                        style={{ padding: '0.5rem 0.75rem 0.5rem 2rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', width: '220px', outline: 'none', color: '#334155' }}
                      />
                    </div>
                    <select
                      className="attach-type-select"
                      value={attachTypeFilter}
                      onChange={e => { setAttachTypeFilter(e.target.value); setAttachPage(1); }}
                      style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', color: '#334155', background: 'white', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="All">All File Types</option>
                      <option value="PDF">PDF</option>
                      <option value="Document">Documents</option>
                      <option value="Spreadsheet">Spreadsheets</option>
                      <option value="Presentation">Presentations</option>
                      <option value="Image">Images</option>
                      <option value="Archive">Archives</option>
                      <option value="Folder">Folders</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {can('projects', 'create') && (
                      <button
                        className="attach-upload-btn"
                        onClick={() => setShowUploadModal(true)}
                        style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <span className="attach-upload-btn-text">Upload Files</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                {/* Upload Modal - placed above table */}
                {showUploadModal && (
                  <div ref={el => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }} className="upload-attachment-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2rem', marginBottom: '1.5rem', maxWidth: '600px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>Upload Attachment</h3>
                      <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>File Name *</label>
                        <input
                          value={uploadForm.name}
                          onChange={e => setUploadForm({ ...uploadForm, name: e.target.value })}
                          placeholder="e.g. Project_Requirements.pdf"
                          style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Description *</label>
                        <textarea
                          value={uploadForm.description}
                          onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
                          placeholder="Brief description of the file..."
                          rows={3}
                          style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Choose File *</label>
                        <div
                          onClick={() => attachFileRef.current?.click()}
                          style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'border-color 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = '#2563eb'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                        >
                          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ margin: '0 auto 0.5rem', display: 'block' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                            {uploadForm.file ? uploadForm.file.name : 'Click to browse or drag & drop'}
                          </p>
                          {uploadForm.file && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{(uploadForm.file.size / (1024 * 1024)).toFixed(2)} MB</p>}
                        </div>
                        <input ref={attachFileRef} type="file" style={{ display: 'none' }} onChange={e => {
                          const f = e.target.files[0];
                          if (f) setUploadForm(prev => ({ ...prev, file: f, name: prev.name || f.name }));
                        }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                      <button onClick={() => setShowUploadModal(false)} style={{ padding: '0.6rem 1.25rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '600', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                      <button onClick={handleUpload} disabled={uploading} style={{ padding: '0.6rem 1.25rem', background: '#2563eb', border: 'none', borderRadius: '8px', fontWeight: '600', color: 'white', cursor: uploading ? 'wait' : 'pointer', fontSize: '0.85rem', opacity: uploading ? 0.7 : 1 }}>
                        {uploading ? 'Uploading...' : 'Upload'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="attachments-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="attachments-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Name</th>
                          <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Description</th>
                          <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Uploaded By</th>
                          <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>File Size</th>
                          <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Uploaded On</th>
                          <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.length === 0 ? (
                          <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.9rem' }}>No attachments found.</td></tr>
                        ) : paginated.map(a => (
                          <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                            <td data-label="Name" style={{ padding: '0.85rem 1.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {getFileIcon(a.name)}
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>{a.name}</span>
                              </div>
                            </td>
                            <td data-label="Description" style={{ padding: '0.85rem 1.25rem', fontSize: '0.85rem', color: '#475569', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description || '-'}</td>
                            <td data-label="Uploaded By" style={{ padding: '0.85rem 1.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '800' }}>
                                  {(a.uploadedBy || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
                                </div>
                                <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: '500' }}>{a.uploadedBy}</span>
                              </div>
                            </td>
                            <td data-label="File Size" style={{ padding: '0.85rem 1.25rem', fontSize: '0.85rem', color: '#475569', fontWeight: '500' }}>{a.fileSize || '-'}</td>
                            <td data-label="Uploaded On" style={{ padding: '0.85rem 1.25rem', fontSize: '0.85rem', color: '#475569' }}>
                              {formatAttachmentDate(a.createdAt)}
                            </td>
                            <td data-label="Actions" style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                {a.fileUrl && (
                                  <button 
                                    type="button"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const response = await fetch(a.fileUrl);
                                        const blob = await response.blob();
                                        const blobUrl = window.URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = blobUrl;
                                        link.download = a.name || 'download';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        window.URL.revokeObjectURL(blobUrl);
                                      } catch (err) {
                                        window.open(a.fileUrl, '_blank');
                                      }
                                    }}
                                    style={{ color: '#3b82f6', cursor: 'pointer', display: 'flex', background: 'none', border: 'none', padding: 0 }} 
                                    title="Download"
                                  >
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                  </button>
                                )}
                                {can('projects', 'delete') && (
                                  <button onClick={() => confirm('Delete this attachment?', () => handleDeleteAttachment(a.id), 'Delete Attachment')} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }} title="Delete">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {filtered.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0 0.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Showing {Math.min((attachPage - 1) * perPage + 1, filtered.length)} to {Math.min(attachPage * perPage, filtered.length)} of {filtered.length} attachments
                    </span>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <button disabled={attachPage <= 1} onClick={() => setAttachPage(p => p - 1)} style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: attachPage <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: attachPage <= 1 ? 0.4 : 1 }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setAttachPage(p)} style={{ width: '32px', height: '32px', border: 'none', borderRadius: '8px', background: attachPage === p ? '#2563eb' : 'transparent', color: attachPage === p ? 'white' : '#64748b', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>{p}</button>
                      ))}
                      <button disabled={attachPage >= totalPages} onClick={() => setAttachPage(p => p + 1)} style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: attachPage >= totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: attachPage >= totalPages ? 0.4 : 1 }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </button>
                    </div>
                  </div>
                )}


              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  // ── RENDER LIST VIEW ──
  const renderListContent = () => {
    const viewLevel = getLevel('projects', 'view');
    let allowedProjects = projects;

  if (viewLevel === 'Self') {
    const loggedInId = user?.id || '';
    allowedProjects = allowedProjects.filter(p => {
      const rawMembers = (p.members || '').split(',').map(m => m.trim()).filter(m => m !== "");
      if (!rawMembers.includes(loggedInId)) return false;
      return true;
    });
  }

  const filteredProjects = allowedProjects.filter(p => {
    if (statusFilter !== 'All') {
      const status = p.status || 'Active';
      if (status !== statusFilter) return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const clientMatch = (p.client || '').toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      return nameMatch || clientMatch || descMatch;
    }
    return true;
  });

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedProjectIds(filteredProjects.map(p => p.id));
    } else {
      setSelectedProjectIds([]);
    }
  };

  const handleSelectOne = (e, id) => {
    if (e.target.checked) {
      setSelectedProjectIds(prev => [...prev, id]);
    } else {
      setSelectedProjectIds(prev => prev.filter(pid => pid !== id));
    }
  };

  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Projects...'}</div>;

  return (
    <div className="projects-page page-container">
      {/* Header matching the screenshot */}
      <div className="projects-page-header">
        <div></div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select 
            className="projects-filter-select"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '600', color: '#334155', cursor: 'pointer', outline: 'none' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
            <option value="Pending">Pending</option>
          </select>
          {can('projects', 'create') && (
          <button className="project-add-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', background: '#2563eb', border: 'none', borderRadius: '8px', fontWeight: '600', color: 'white', cursor: 'pointer' }} onClick={() => {
            setForm({ name: '', status: 'Active', description: '', client: '', clientId: '', estimatedHours: 0, actualHours: 0, billableHours: 0 });
            setShowForm(true);
          }}>
            <span className="project-add-btn-text">+ Add Project</span>
            <span className="project-add-btn-icon" style={{ display: 'none', fontSize: '1.5rem', lineHeight: 1 }}>+</span>
          </button>
          )}
        </div>
      </div>

      {/* Add Project Form */}
      {showForm && renderForm()}

      {/* Projects Table Container */}
      <div className="saas-table-container" style={{ padding: '0', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Table Top Bar */}
        <div className="projects-table-header-bar">
          <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>Total Projects: {filteredProjects.length || 0}</span>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '250px' }}>
              <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input 
                type="text" 
                placeholder="Search..." 
                style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.2rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
            <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }} onClick={fetchData}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="projects-desktop-table-wrapper">
          <table className="saas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'white' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>

                <th style={{ padding: '0.55rem 1rem 0.55rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>#</th>
                <th style={{ padding: '0.55rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Project Name</th>
                <th style={{ padding: '0.55rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Status</th>
                <th style={{ padding: '0.55rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Estimated Hours</th>
                <th style={{ padding: '0.55rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Billed Hours</th>
                <th style={{ padding: '0.55rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Billable Hours</th>
                <th style={{ padding: '0.55rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Created On</th>
                <th style={{ padding: '0.55rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', textAlign: 'center', background: 'white', textTransform: 'capitalize' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Syncing workspace...</td></tr>
              ) : filteredProjects.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No projects in this view.</td></tr>
              ) : (
                paginatedProjects.map((proj, idx) => {
                  const client = proj.client || '-';
                  const estHours = proj.estimatedHours ? `${proj.estimatedHours} hrs` : '-';
                  const actHours = proj.actualHours ? `${proj.actualHours} hrs` : '-';
                  const bilHours = proj.billableHours ? `${proj.billableHours} hrs` : '-';
                  const createdOn = proj.createdAt ? new Date(proj.createdAt).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '-';
                  const displayStatus = proj.status || 'Active';
                  
                  let statusBg = '#dcfce7'; let statusColor = '#16a34a';
                  if (displayStatus === 'Inactive') { statusBg = '#fee2e2'; statusColor = '#b91c1c'; }
                  else if (displayStatus === 'On Hold') { statusBg = '#fef3c7'; statusColor = '#d97706'; }
                  else if (displayStatus === 'Completed') { statusBg = '#e0e7ff'; statusColor = '#4f46e5'; }
                  else if (displayStatus === 'Pending') { statusBg = '#f1f5f9'; statusColor = '#475569'; }

                  return (
                    <tr key={proj.id} style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>

                      <td style={{ padding: '0.55rem 1rem 0.55rem 1.5rem', fontSize: '0.85rem', color: '#1e293b', fontWeight: '600' }}>
                        {startIndex + idx + 1}
                      </td>
                      <td style={{ padding: '0.55rem 1rem' }}>
                        <button 
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                          onClick={() => {
                            setSelectedProject(proj);
                            setCurrentView('detail');
                            if (onProjectSelect) onProjectSelect(proj.name);
                          }}
                        >
                          {proj.name}
                        </button>
                      </td>
                      <td style={{ padding: '0.55rem 1rem' }}>
                        <span style={{ background: statusBg, color: statusColor, padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>
                          {displayStatus}
                        </span>
                      </td>
                      <td style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', color: '#334155' }}>
                        {estHours}
                      </td>
                      <td style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', color: '#334155' }}>
                        {actHours}
                      </td>
                      <td style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', color: '#334155' }}>
                        {bilHours}
                      </td>
                      <td style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', color: '#334155' }}>
                        {createdOn}
                      </td>
                      <td style={{ padding: '0.55rem 1.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          {/* Edit Button */}
                          {canEditProject(proj) && (
                            <button 
                              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '0.25rem' }} 
                              title="Edit Project"
                              onClick={() => {
                                setForm({ 
                                  id: proj.id,
                                  name: proj.name || '', 
                                  status: proj.status || 'Active',
                                  description: proj.description || '',
                                  client: proj.client || '',
                                  clientId: proj.clientId || '',
                                  estimatedHours: proj.estimatedHours || 0,
                                  actualHours: proj.actualHours || 0,
                                  billableHours: proj.billableHours || 0
                                });
                                setShowForm(true);
                                setTimeout(() => {
                                  const el = document.querySelector('.saas-page-content');
                                  if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }, 50);
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                          )}
                          
                          {/* Delete Button */}
                          {canDeleteProject(proj) && (
                            <button 
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }} 
                              title="Delete Project"
                              onClick={() => handleRemove(proj.id)}
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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

        {/* Mobile Cards View */}
        <div className="projects-mobile-cards-list">
          {filteredProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>No projects in this view.</div>
          ) : (
            paginatedProjects.map((proj, idx) => {
              const displayStatus = proj.status || 'Active';
              
              let statusBg = '#dcfce7'; let statusColor = '#16a34a';
              if (displayStatus === 'Inactive') { statusBg = '#fee2e2'; statusColor = '#b91c1c'; }
              else if (displayStatus === 'On Hold') { statusBg = '#fef3c7'; statusColor = '#d97706'; }
              else if (displayStatus === 'Completed') { statusBg = '#e0e7ff'; statusColor = '#4f46e5'; }
              else if (displayStatus === 'Pending') { statusBg = '#f1f5f9'; statusColor = '#475569'; }

              return (
                <div className="mobile-project-row" key={proj.id}>
                  <div className="mpr-left">

                    <span className="mp-index">#{startIndex + idx + 1}</span>
                    <button 
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                      onClick={() => {
                        setSelectedProject(proj);
                        setCurrentView('detail');
                        if (onProjectSelect) onProjectSelect(proj.name);
                      }}
                      className="mp-name-link"
                    >
                      {proj.name}
                    </button>
                  </div>
                  <div className="mpr-right">
                    <span style={{ background: statusBg, color: statusColor, padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase' }}>
                      {displayStatus}
                    </span>
                    <div className="mpr-actions">
                      {canEditProject(proj) && (
                        <button
                          className="mp-action-btn edit"
                          title="Edit Project"
                          onClick={() => {
                            setForm({
                              id: proj.id,
                              name: proj.name || '',
                              status: proj.status || 'Active',
                              description: proj.description || '',
                              client: proj.client || '',
                              clientId: proj.clientId || '',
                              estimatedHours: proj.estimatedHours || 0,
                              actualHours: proj.actualHours || 0,
                              billableHours: proj.billableHours || 0
                            });
                            setShowForm(true);
                            setTimeout(() => {
                              const el = document.querySelector('.saas-page-content');
                              if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }, 50);
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                      )}
                      {canDeleteProject(proj) && (
                        <button
                          className="mp-action-btn delete"
                          title="Delete Project"
                          onClick={() => handleRemove(proj.id)}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Pagination bar */}
        {(() => {
          const totalPages = Math.ceil(filteredProjects.length / pageSize) || 1;
          const pageNumbers = [];
          for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push(i);
          }
          return (
            <div className="projects-table-footer-bar">
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Showing {filteredProjects.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, filteredProjects.length)} of {allowedProjects.length} entries
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px', 
                    background: 'white', 
                    color: currentPage === 1 ? '#cbd5e1' : '#64748b', 
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer' 
                  }}
                >
                  &lt;
                </button>
                {pageNumbers.map(page => (
                  <button 
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      border: currentPage === page ? 'none' : '1px solid #e2e8f0', 
                      borderRadius: '6px', 
                      background: currentPage === page ? '#2563eb' : 'white', 
                      color: currentPage === page ? 'white' : '#334155', 
                      fontWeight: '600', 
                      cursor: 'pointer' 
                    }}
                  >
                    {page}
                  </button>
                ))}
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px', 
                    background: 'white', 
                    color: currentPage === totalPages ? '#cbd5e1' : '#64748b', 
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' 
                  }}
                >
                  &gt;
                </button>
                <select 
                  className="pagination-page-size-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{ marginLeft: '1rem', padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', color: '#334155', background: 'white', outline: 'none', cursor: 'pointer' }}
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
  };

  // Unified return statement of Projects component:
  if (loading || isSaving) return <div className="loading-screen">{isSaving ? 'Saving...' : 'Loading Projects...'}</div>;

  return currentView === 'detail' && selectedProject ? renderDetailContent() : renderListContent();
}
