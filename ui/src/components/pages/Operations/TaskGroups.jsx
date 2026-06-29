import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../api/client';
import { useAlert } from '../../../context/AlertContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { TaskDetailView, TaskTitleTooltip, getDisplayId, formatDDMonDate } from './Tasks';
import './TaskGroups.css';
import './Tasks.css'; // import to ensure ClickUp styles are available

// Status style mapping
const STATUS_HEADER_META = {
  'To Do':         { bg: '#78350f', fg: '#ffffff', border: '1px solid #5c2c06', dotColor: '#78350f', isDone: false },
  'In Progress':   { bg: '#2563eb', fg: '#ffffff', dotColor: '#bfdbfe', isDone: false },
  'In Testing':    { bg: '#7c3aed', fg: '#ffffff', dotColor: '#e9d5ff', isDone: false },
  'Re-opened':     { bg: '#db2777', fg: '#ffffff', dotColor: '#fecdd3', isDone: false },
  'Prod Deployed': { bg: '#ea580c', fg: '#ffffff', dotColor: '#fde68a', isDone: false },
  'Prod Verified': { bg: '#0d9488', fg: '#ffffff', dotColor: '#bbf7d0', isDone: false },
  'Delivered':     { bg: '#16a34a', fg: '#ffffff', dotColor: '#99f6e4', isDone: true  },
};

const COLUMNS = [
  { id: 'To Do', label: 'To Do' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'In Testing', label: 'In Testing' },
  { id: 'Re-opened', label: 'Re-opened' },
  { id: 'Prod Deployed', label: 'Prod Deployed' },
  { id: 'Prod Verified', label: 'Prod Verified' },
  { id: 'Delivered', label: 'Delivered' }
];

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

const initials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function TaskGroups({ user, onBack }) {
  const [taskLists, setTaskLists] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedListIds, setExpandedListIds] = useState([]);
  const [expandedSubtasks, setExpandedSubtasks] = useState({});
  
  // Inline edit state
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');

  // Inline subtask state
  const [inlineSubtaskParentId, setInlineSubtaskParentId] = useState(null);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskAssignee, setSubtaskAssignee] = useState('');
  const [subtaskDueDate, setSubtaskDueDate] = useState('');
  const [subtaskPriority, setSubtaskPriority] = useState('Medium');
  const [inlineSubtaskSaving, setInlineSubtaskSaving] = useState(false);

  // Task group modal (only for add)
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', projectId: '' });

  // Quick Add Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [targetGroup, setTargetGroup] = useState(null);
  const [taskForm, setTaskForm] = useState({ title: '', assignees: '', priority: 'Medium', dueDate: '' });
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Drawer detail view state
  const [viewingTask, setViewingTask] = useState(null);
  const [showTaskViewModal, setShowTaskViewModal] = useState(false);
  const [drawerEditMode, setDrawerEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('favourites');
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState(null);
  const [collapsedStatusSections, setCollapsedStatusSections] = useState({});
  const toggleStatusSection = (key) => {
    setCollapsedStatusSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const { alert, confirm, toast } = useAlert();
  const { can } = usePermissions();

  const handleInlineSubtaskSave = async (task) => {
    if (!subtaskTitle.trim()) {
      toast('Subtask title is required', 'warning');
      return;
    }
    setInlineSubtaskSaving(true);
    try {
      const payload = {
        title: subtaskTitle.trim(),
        parentId: task.id,
        taskListId: task.taskListId,
        status: 'To Do',
        priority: subtaskPriority || 'Medium',
        assignees: subtaskAssignee || '',
        dueDate: subtaskDueDate || null
      };
      await api.post('/tasks', payload);
      toast('Subtask added successfully', 'success');
      setSubtaskTitle('');
      setSubtaskAssignee('');
      setSubtaskDueDate('');
      setSubtaskPriority('Medium');
      setInlineSubtaskParentId(null);
      fetchInitialData();
    } catch (err) {
      console.error('Failed to save subtask:', err);
      toast('Failed to save subtask', 'error');
    } finally {
      setInlineSubtaskSaving(false);
    }
  };

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [listsData, projectsData, usersData] = await Promise.all([
        api.get('/task-lists').catch(() => []),
        api.get('/projects').catch(() => []),
        api.get('/users').catch(() => [])
      ]);
      
      setTaskLists(listsData || []);
      setProjects(projectsData || []);
      setUsers(usersData || []);

      // Auto-expand the first category by default
      if (listsData && listsData.length > 0) {
        setExpandedListIds([listsData[0].id]);
      }
    } catch (error) {
      console.error('Error fetching task groups data:', error);
      toast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const fetchTaskListsOnly = async () => {
    try {
      const listsData = await api.get('/task-lists');
      setTaskLists(listsData || []);
    } catch (error) {
      console.error('Error refreshing task groups:', error);
    }
  };

  // Toggle Favorite status
  const handleToggleFavorite = async (list) => {
    if (togglingFavoriteId === list.id) return;
    setTogglingFavoriteId(list.id);
    try {
      const updatedStatus = !list.isFavorite;
      await api.put(`/task-lists/${list.id}`, { isFavorite: updatedStatus });
      toast(updatedStatus ? 'Added to Favourites' : 'Removed from Favourites', 'success');
      await fetchTaskListsOnly();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast('Failed to update favorite status', 'error');
    } finally {
      setTogglingFavoriteId(null);
    }
  };

  // Expand / collapse accordion
  const toggleListAccordion = (id) => {
    setExpandedListIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Create Task Group
  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (isSavingGroup) return;
    if (!groupForm.name.trim()) {
      alert('Task Group Name is required.', 'warning');
      return;
    }
    if (!groupForm.projectId) {
      alert('Please select a project.', 'warning');
      return;
    }

    setIsSavingGroup(true);
    try {
      await api.post('/task-lists', {
        name: groupForm.name.trim(),
        projectId: groupForm.projectId
      });
      toast('Task Group created successfully!', 'success');
      setShowGroupModal(false);
      setGroupForm({ name: '', projectId: '' });
      fetchTaskListsOnly();
    } catch (error) {
      console.error('Error creating task group:', error);
      alert('Failed to create task group', 'error');
    } finally {
      setIsSavingGroup(false);
    }
  };

  // Inline Rename
  const handleRenameList = async (listId) => {
    if (!editingListName.trim()) {
      alert('Task Group name cannot be empty.', 'warning');
      return;
    }
    try {
      await api.put(`/task-lists/${listId}`, { name: editingListName.trim() });
      setEditingListId(null);
      setEditingListName('');
      fetchTaskListsOnly();
      toast('Task Group renamed successfully!', 'success');
    } catch (error) {
      console.error('Rename list error:', error);
      alert('Failed to rename task group.', 'error');
    }
  };

  // Delete Task Group
  // eslint-disable-next-line no-unused-vars
  const handleDeleteGroup = (list) => {
    const listTasks = list.tasks || [];
    if (listTasks.length > 0) {
      alert(`"${list.name}" has ${listTasks.length} task${listTasks.length > 1 ? 's' : ''}. Remove all tasks from this group before deleting it.`, 'warning', 'Cannot Delete');
      return;
    }
    confirm(
      `Delete "${list.name}" task group?`,
      async () => {
        try {
          await api.delete(`/task-lists/${list.id}`);
          toast('Task Group deleted successfully', 'success');
          fetchTaskListsOnly();
        } catch (error) {
          console.error('Error deleting task group:', error);
          alert('Failed to delete task group', 'error');
        }
      },
      'Delete Task Group'
    );
  };

  // Open Edit inline
  const openEditGroup = (list) => {
    setEditingListId(list.id);
    setEditingListName(list.name);
  };

  // Open Quick Add Task Modal
  const openQuickAddTask = (list) => {
    setTargetGroup(list);
    setTaskForm({
      title: '',
      assignees: '',
      priority: 'Medium',
      dueDate: ''
    });
    setShowTaskModal(true);
  };

  // Save Quick Add Task
  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (isCreatingTask) return;
    if (!taskForm.title.trim()) {
      alert('Task Title is required.', 'warning');
      return;
    }
    if (!taskForm.assignees) {
      alert('Assignee is required.', 'warning');
      return;
    }

    setIsCreatingTask(true);
    try {
      const createdTask = await api.post('/tasks', {
        title: taskForm.title.trim(),
        taskListId: targetGroup.id,
        projectId: targetGroup.projectId || null,
        assignees: taskForm.assignees || null,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
        status: 'To Do'
      });
      toast('Task added successfully!', 'success');
      setShowTaskModal(false);
      setTargetGroup(null);
      await fetchTaskListsOnly();
      if (createdTask && createdTask.id) {
        const fullTaskObj = {
          ...createdTask,
          projectName: targetGroup?.project?.name || createdTask.projectName || ''
        };
        setViewingTask(fullTaskObj);
        setDrawerEditMode(false);
        setShowTaskViewModal(true);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to add task', 'error');
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Delete task inside details drawer / table (move to archive)
  const handleDeleteTask = async (id, skipConfirm = false) => {
    const doDelete = async () => {
      setDeletingTaskId(id);
      try {
        const allTasks = taskLists.flatMap(l => l.tasks || []);
        const targetTask = allTasks.find(t => t.id === id);
        const prevSt = targetTask?.status && targetTask.status !== 'Archived' && targetTask.status !== 'Archive' ? targetTask.status : 'To Do';
        await api.put(`/tasks/${id}`, { status: 'Archived', previousStatus: prevSt });
        toast('Task moved to Archive', 'success');
        await fetchTaskListsOnly();
      } catch (error) {
        console.error('Error archiving task:', error);
        alert('Failed to move task to Archive', 'error');
      } finally {
        setDeletingTaskId(null);
      }
    };

    if (skipConfirm) {
      await doDelete();
    } else {
      confirm(
        'Delete this task? It will be moved to the Archive.',
        doDelete,
        'Delete Task'
      );
    }
  };

  // Sort task groups
  const sortTaskGroups = (lists) => {
    return [...lists].sort((a, b) => {
      const projA = a.project?.name || '';
      const projB = b.project?.name || '';
      const projCompare = projA.localeCompare(projB, undefined, { sensitivity: 'base' });
      if (projCompare !== 0) return projCompare;
      
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
  };

  // Filter groups
  const getFilteredLists = (lists) => {
    if (!searchQuery.trim()) return lists;
    const query = searchQuery.toLowerCase();
    return lists.filter(list => {
      const nameMatch = list.name.toLowerCase().includes(query);
      const projectMatch = list.project?.name?.toLowerCase().includes(query);
      return nameMatch || projectMatch;
    });
  };

  const sortedTaskLists = sortTaskGroups(taskLists);
  const favouriteLists = getFilteredLists(sortedTaskLists.filter(l => l.isFavorite));
  const allLists = getFilteredLists(sortedTaskLists);

  if (loading) {
    return <div className="tg-loading-screen">Loading Task Groups...</div>;
  }

  // Common Accordion rendering function
  const renderAccordion = (list, idx) => {
    const isCollapsed = !expandedListIds.includes(list.id);
    const listTasks = (list.tasks || []).filter(t => t.status !== 'Archived' && t.status !== 'Archive').sort((a, b) => {
      const titleA = a.title || '';
      const titleB = b.title || '';
      return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
    });
    const hasTasks = listTasks.length > 0;

    return (
      <div key={list.id} className="cu-status-section">
        {/* Section Header */}
        <div className="cu-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="cu-section-left" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={() => {
            if (hasTasks && editingListId !== list.id) {
              toggleListAccordion(list.id);
            }
          }}>
            {/* Star toggle button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(list);
              }}
              disabled={togglingFavoriteId === list.id}
              style={{
                background: 'none',
                border: 'none',
                cursor: togglingFavoriteId === list.id ? 'not-allowed' : 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                color: list.isFavorite ? '#eab308' : '#cbd5e1',
                transition: 'transform 0.15s, color 0.15s',
                flexShrink: 0,
                opacity: togglingFavoriteId === list.id ? 0.6 : 1
              }}
              className="tg-accordion-star-btn"
              title={list.isFavorite ? 'Remove from Favourites' : 'Add to Favourites'}
            >
              {togglingFavoriteId === list.id ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill={list.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              )}
            </button>

            <span className="cu-section-chevron" style={{ display: 'flex', alignItems: 'center', visibility: hasTasks ? 'visible' : 'hidden', flexShrink: 0 }}>
              <svg viewBox="0 0 10 6" width="10" height="6" fill="currentColor" style={{ transform: (hasTasks && isCollapsed) ? "rotate(-90deg)" : "none", transition: "transform 0.2s", color: "#94a3b8" }}><path d="M0 0l5 6 5-6z"/></svg>
            </span>

            {editingListId === list.id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
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
                  style={{ height: '32px', fontSize: '0.85rem', padding: '0 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '200px' }}
                />
                <button
                  onClick={() => handleRenameList(list.id)}
                  style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  title="Save"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <button
                  onClick={() => { setEditingListId(null); setEditingListName(''); }}
                  style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  title="Cancel"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            ) : (
              <>
                <span className="cu-section-title" style={{ fontWeight: '700', fontSize: '0.8rem', color: '#2563eb', textTransform: 'uppercase' }}>{list.name}</span>
                {list.project && (
                  <span className="tg-project-badge" style={{ fontSize: '0.7rem' }}>
                    {list.project.name}
                  </span>
                )}
                <span className="cu-section-count" style={{ fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '12px', fontWeight: '700', flexShrink: 0 }}>{listTasks.length}</span>
              </>
            )}
          </div>

          <div className="cu-section-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: '0.5rem' }}>
            {can('tasks', 'create') && (
              <button
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                title="Add Task to Group"
                onClick={(e) => {
                  e.stopPropagation();
                  openQuickAddTask(list);
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
                  openEditGroup(list);
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
            )}
          </div>
        </div>

        {/* Accordion Table Body */}
        {!isCollapsed && hasTasks && (
          <div className="cu-list-root task-group-sections" style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            {COLUMNS.map(col => {
              const meta = STATUS_HEADER_META[col.id] || { bg: '#f1f5f9', fg: '#475569', dotColor: '#94a3b8', isDone: false };
              const allTasks = list.tasks || [];
              const statusTasks = allTasks.filter(t => (t.status || 'To Do') === col.id);
              const sectionKey = `${list.id}_${col.id}`;
              const isStatusCollapsed = !!collapsedStatusSections[sectionKey];

              return (
                <div key={col.id} className="cu-status-section" style={{ marginBottom: '1rem' }}>
                  {/* Section Header */}
                  <div className="cu-section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div className="cu-section-left" onClick={() => toggleStatusSection(sectionKey)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <span className="cu-section-chevron">
                        <svg viewBox="0 0 10 6" width="10" height="6" fill="currentColor" style={{ transform: isStatusCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s", color: "#94a3b8" }}>
                          <path d="M0 0l5 6 5-6z"/>
                        </svg>
                      </span>
                      <span className="cu-status-pill" style={{ background: meta.bg, color: meta.fg, border: meta.border || 'none', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: col.id === 'To Do' ? '700' : '600', textTransform: 'uppercase' }}>
                        {col.label.toUpperCase()}
                      </span>
                      <span className="cu-section-count" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', background: '#e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>{statusTasks.length}</span>
                    </div>
                  </div>

                  {/* Task Table if there are tasks in this status and section is not collapsed */}
                  {!isStatusCollapsed && statusTasks.length > 0 && (
                    <div className="cu-table-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: 'white', marginTop: '0.5rem' }}>
                      <table className="cu-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr className="cu-thead-row" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th className="cu-th cu-th-name" style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '67%', textAlign: 'left' }}>NAME</th>
                            <th className="cu-th cu-th-assignee" style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '15%', textAlign: 'center' }}>ASSIGNEE</th>
                            <th className="cu-th cu-th-delivery" style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '10%', textAlign: 'center' }}>DUE DATE</th>
                            <th className="cu-th cu-th-actions" style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', width: '8%', textAlign: 'right' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const mainTasks = statusTasks.filter(t => !t.parentId || !allTasks.some(p => p.id === t.parentId));
                            const sortedMainTasks = [...mainTasks].sort((a, b) => {
                              const titleA = a.title || '';
                              const titleB = b.title || '';
                              return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
                            });

                            return sortedMainTasks.flatMap(task => {
                              const subTasks = allTasks.filter(t => t.parentId === task.id);
                              const isExpanded = !!expandedSubtasks[task.id];
                              const relDate = formatRelativeDueDate(task.dueDate);
                              const assignees = task.assignees ? task.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];

                              const parentRow = (
                                <tr key={task.id} className="cu-row" onClick={() => { setViewingTask(task); setDrawerEditMode(false); setShowTaskViewModal(true); }} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}>
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
                                      <TaskTitleTooltip text={`${getDisplayId(task)} ${task.title || 'Untitled Task'}`}>
                                        <span className="cu-task-id-prefix">{getDisplayId(task)}</span>
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                      {assignees.length === 0 ? (
                                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>-</span>
                                      ) : (
                                        assignees.map(a => {
                                          const uObj = users.find(u => u.id === a);
                                          const dispName = uObj ? (uObj.firstName || uObj.fullName?.split(' ')[0] || 'Unknown') : 'Unknown';
                                          return (
                                            <span key={a} style={{ fontSize: '0.8rem', color: '#475569', fontWeight: '500' }}>{dispName}</span>
                                          );
                                        })
                                      )}
                                    </div>
                                  </td>
                                  <td className="cu-td cu-td-delivery" style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                                    {task.dueDate ? (
                                      <span className={`cu-due-badge ${relDate?.isOverdue ? 'overdue' : ''}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: relDate?.isOverdue ? '#fee2e2' : '#f1f5f9', color: relDate?.isOverdue ? '#ef4444' : '#475569' }}>
                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                        {formatDDMonDate(task.dueDate)}
                                      </span>
                                    ) : <span className="cu-empty-cell">-</span>}
                                  </td>
                                  <td className="cu-td cu-td-actions" onClick={e => e.stopPropagation()} style={{ padding: '0.85rem 1.25rem' }}>
                                    <div className="cu-row-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                      <PriorityFlag priority={task.priority} />
                                      {can('tasks', 'edit') && (
                                        <button className="cu-act-btn" onClick={() => { setViewingTask(task); setDrawerEditMode(true); setShowTaskViewModal(true); }} title="Edit" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}>
                                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                      )}
                                      {can('tasks', 'delete') && (
                                        <button 
                                          className="cu-act-btn danger" 
                                          disabled={deletingTaskId === task.id}
                                          onClick={() => handleDeleteTask(task.id)} 
                                          title="Delete" 
                                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: deletingTaskId === task.id ? 'not-allowed' : 'pointer', padding: '0.25rem', opacity: deletingTaskId === task.id ? 0.6 : 1 }}
                                        >
                                          {deletingTaskId === task.id ? (
                                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                                          ) : (
                                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );

                              const rows = [parentRow];

                              // Inline subtask creation row
                              if (inlineSubtaskParentId === task.id) {
                                rows.push(
                                  <tr key={`add-sub-${task.id}`} className="cu-inline-row animate-fade-in" style={{ background: '#f8fafc' }}>
                                    <td colSpan="4" style={{ paddingLeft: '2.5rem' }}>
                                      <div className="new-task-inline-bar" style={{ borderLeft: '2px solid #2563eb', paddingLeft: '8px' }} onClick={e => e.stopPropagation()}>
                                        <div className="ntib-left">
                                          <span className="ntib-dotted-circle"></span>
                                          <input
                                            type="text"
                                            placeholder="Subtask Name or type '/' for commands"
                                            value={subtaskTitle}
                                            onChange={e => setSubtaskTitle(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !inlineSubtaskSaving) handleInlineSubtaskSave(task); if (e.key === 'Escape') setInlineSubtaskParentId(null); }}
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
                                              {users.map(u => { const n = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || 'Unknown'; return <option key={u.id} value={u.id}>{n}</option>; })}
                                            </select>
                                            {subtaskAssignee && <span className="ntib-badge">{initials((users.find(u => u.id === subtaskAssignee) || {}).fullName || subtaskAssignee)}</span>}
                                          </div>
                                          
                                          <div className="ntib-dropdown-wrapper ntib-hide-mobile">
                                            <button type="button" className="ntib-btn-icon" title="Due Date">
                                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                            </button>
                                            <input type="date" className="ntib-hidden-date" value={subtaskDueDate} onChange={e => setSubtaskDueDate(e.target.value)} />
                                            {subtaskDueDate && <span className="ntib-badge">{new Date(subtaskDueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>}
                                          </div>
                                          
                                          <div className="ntib-dropdown-wrapper ntib-hide-mobile">
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
                                          <button type="button" className="ntib-save-btn" disabled={inlineSubtaskSaving} onClick={() => handleInlineSubtaskSave(task)}>{inlineSubtaskSaving ? 'Saving...' : 'Save ↵'}</button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              if (isExpanded) {
                                const sortedSubtasks = [...subTasks].sort((a, b) => {
                                  const titleA = a.title || '';
                                  const titleB = b.title || '';
                                  return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
                                });

                                sortedSubtasks.forEach(sub => {
                                  const subRelDate = formatRelativeDueDate(sub.dueDate);
                                  const subAssignees = sub.assignees ? sub.assignees.split(',').map(a => a.trim()).filter(Boolean) : [];

                                  rows.push(
                                    <tr key={sub.id} className="cu-row cu-subtask-row" onClick={() => { setViewingTask(sub); setDrawerEditMode(false); setShowTaskViewModal(true); }} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s', background: '#f8fafc' }}>
                                      <td className="cu-td cu-td-name" style={{ padding: '0.85rem 1.25rem', paddingLeft: '2.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                          <span className="cu-subtask-indicator" style={{ color: '#94a3b8', marginRight: '4px', fontSize: '1rem', fontWeight: 'bold' }}>↳</span>
                                          <TaskTitleTooltip text={`${getDisplayId(sub)} ${sub.title || 'Untitled Subtask'}`}>
                                            <span className="cu-task-id-prefix">{getDisplayId(sub)}</span>
                                            <span className="cu-task-title" style={{ fontSize: '0.85rem', color: '#475569' }}>{sub.title || 'Untitled Subtask'}</span>
                                          </TaskTitleTooltip>
                                        </div>
                                      </td>
                                      <td className="cu-td cu-td-assignee" style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                          {subAssignees.length === 0 ? (
                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>-</span>
                                          ) : (
                                            subAssignees.map(a => {
                                              const uObj = users.find(u => u.id === a);
                                              const dispName = uObj ? (uObj.firstName || uObj.fullName?.split(' ')[0] || 'Unknown') : 'Unknown';
                                              return (
                                                <span key={a} style={{ fontSize: '0.8rem', color: '#475569', fontWeight: '500' }}>{dispName}</span>
                                              );
                                            })
                                          )}
                                        </div>
                                      </td>
                                      <td className="cu-td cu-td-delivery" style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                                        {sub.dueDate ? (
                                          <span className={`cu-due-badge ${subRelDate?.isOverdue ? 'overdue' : ''}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: subRelDate?.isOverdue ? '#fee2e2' : '#f1f5f9', color: subRelDate?.isOverdue ? '#ef4444' : '#475569' }}>
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                            {formatDDMonDate(sub.dueDate)}
                                          </span>
                                        ) : <span className="cu-empty-cell">-</span>}
                                      </td>
                                      <td className="cu-td cu-td-actions" onClick={e => e.stopPropagation()} style={{ padding: '0.85rem 1.25rem' }}>
                                        <div className="cu-row-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                          <PriorityFlag priority={sub.priority} />
                                          {can('tasks', 'edit') && (
                                            <button className="cu-act-btn" onClick={() => { setViewingTask(sub); setDrawerEditMode(true); setShowTaskViewModal(true); }} title="Edit" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}>
                                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                          )}
                                          {can('tasks', 'delete') && (
                                            <button 
                                              className="cu-act-btn danger" 
                                              disabled={deletingTaskId === sub.id}
                                              onClick={() => handleDeleteTask(sub.id)} 
                                              title="Delete" 
                                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: deletingTaskId === sub.id ? 'not-allowed' : 'pointer', padding: '0.25rem', opacity: deletingTaskId === sub.id ? 0.6 : 1 }}
                                            >
                                              {deletingTaskId === sub.id ? (
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                                              ) : (
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                });
                              }

                              return rows;
                            });
                          })()}
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
  };

  return (
    <div className="tg-page-container">
      {/* HEADER SECTION */}
      <div className="tg-header-row" style={{ marginBottom: '1.5rem' }}>
        <div className="tg-actions-area" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="tg-search-wrapper">
            <svg className="tg-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search groups or projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tg-search-input"
              style={{ minWidth: '280px' }}
            />
          </div>
          {can('projects', 'create') && (
            <button className="tg-btn-primary" onClick={() => { setGroupForm({ name: '', projectId: '' }); setShowGroupModal(true); }}>
              <span>+ Add Task Group</span>
            </button>
          )}
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="tg-tabs-nav" style={{ marginBottom: '1.5rem' }}>
        <button
          className={`tg-tab-btn ${activeTab === 'favourites' ? 'active' : ''}`}
          onClick={() => setActiveTab('favourites')}
        >
          Favourites
        </button>
        <button
          className={`tg-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Groups
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'favourites' ? (
        <div className="tg-section">
          {favouriteLists.length === 0 ? (
            <div className="tg-empty-section-message">
              No favourites added yet. Click the star icon next to any group name to add it here.
            </div>
          ) : (
            <div className="cu-list-root" style={{ display: 'flex', flexDirection: 'column', gap: '3px', border: 'none', background: 'transparent', boxShadow: 'none' }}>
              {favouriteLists.map((list, idx) => renderAccordion(list, idx))}
            </div>
          )}
        </div>
      ) : (
        <div className="tg-section">
          {allLists.length === 0 ? (
            <div className="tg-empty-section-message">
              No task groups found. Click "+ Add Task Group" to create one.
            </div>
          ) : (
            <div className="cu-list-root" style={{ display: 'flex', flexDirection: 'column', gap: '3px', border: 'none', background: 'transparent', boxShadow: 'none' }}>
              {allLists.map((list, idx) => renderAccordion(list, idx))}
            </div>
          )}
        </div>
      )}

      {/* TASK GROUP FORM MODAL (ADD ONLY) */}
      {showGroupModal && (
        <div className="tg-modal-overlay">
          <div className="tg-modal">
            <div className="tg-modal-header">
              <h3>Add New Task Group</h3>
              <button className="tg-modal-close" onClick={() => setShowGroupModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveGroup}>
              <div className="tg-modal-body">
                <div className="tg-form-field">
                  <label>Task Group Name *</label>
                  <input
                    type="text"
                    required
                    value={groupForm.name}
                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                    placeholder="e.g. UI issues, Backend bugs, Marketing, etc."
                  />
                </div>
                <div className="tg-form-field">
                  <label>Associate with Project *</label>
                  <select
                    required
                    value={groupForm.projectId}
                    onChange={(e) => setGroupForm({ ...groupForm, projectId: e.target.value })}
                  >
                    <option value="">-- Select Project --</option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="tg-modal-footer">
                <button type="button" className="tg-btn-secondary" onClick={() => setShowGroupModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="tg-btn-primary" disabled={isSavingGroup} style={{ opacity: isSavingGroup ? 0.7 : 1, cursor: isSavingGroup ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isSavingGroup ? (
                    <>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Group'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD TASK MODAL */}
      {showTaskModal && targetGroup && (
        <div className="tg-modal-overlay">
          <div className="tg-modal">
            <div className="tg-modal-header">
              <h3>Add Task to "{targetGroup.name}"</h3>
              <button className="tg-modal-close" onClick={() => setShowTaskModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveTask}>
              <div className="tg-modal-body">
                <div className="tg-form-field">
                  <label>Task Title *</label>
                  <input
                    type="text"
                    required
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="Enter task description..."
                  />
                </div>
                <div className="tg-form-field">
                  <label>Assignee *</label>
                  <select
                    required
                    value={taskForm.assignees}
                    onChange={(e) => setTaskForm({ ...taskForm, assignees: e.target.value })}
                  >
                    <option value="">-- Select Assignee --</option>
                    {users.map((usr) => (
                      <option key={usr.id} value={usr.id}>
                        {usr.fullName || `${usr.firstName || ''} ${usr.lastName || ''}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tg-form-field">
                  <label>Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div className="tg-form-field">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="tg-modal-footer">
                <button type="button" className="tg-btn-secondary" onClick={() => setShowTaskModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="tg-btn-primary" disabled={isCreatingTask} style={{ opacity: isCreatingTask ? 0.7 : 1, cursor: isCreatingTask ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isCreatingTask ? (
                    <>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Task'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAIL SIDE DRAWER OVERLAY */}
      {showTaskViewModal && viewingTask && (
        <div className="task-drawer-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowTaskViewModal(false); setViewingTask(null); } }}>
          <div className="task-drawer-panel">
            <TaskDetailView
              task={viewingTask}
              onSelectTask={(parent) => {
                setViewingTask(parent);
              }}
              onSave={async (taskData, silent) => {
                try {
                  const targetList = taskLists.find(l => l.id === viewingTask.taskListId) || {};
                  const payload = {
                    ...taskData,
                    projectId: targetList.projectId || viewingTask.projectId || null,
                    taskListId: viewingTask.taskListId,
                    updatedBy: user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.name || user?.email || 'User'
                  };
                  const savedTask = await api.put(`/tasks/${viewingTask.id}`, payload);
                  if (!silent) toast('Task updated successfully!', 'success');
                  fetchTaskListsOnly();
                  if (!silent) {
                    setShowTaskViewModal(false);
                    setViewingTask(null);
                  } else if (savedTask) {
                    setViewingTask(savedTask);
                  }
                } catch (err) {
                  console.error('Error saving task:', err);
                  alert('Failed to save task: ' + err.message, 'error');
                }
              }}
              onDelete={async (id) => {
                await handleDeleteTask(id, true);
                setShowTaskViewModal(false);
                setViewingTask(null);
              }}
              onClose={() => { setShowTaskViewModal(false); setViewingTask(null); }}
              currentUser={user}
              initialEditMode={drawerEditMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}
