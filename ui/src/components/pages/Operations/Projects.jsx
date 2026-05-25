import React, { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import './Projects.css';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAlert } from '../../../context/AlertContext';

export default function Projects({ user, initialSelectedProject, onClearInitialProject, onNavigateToTasks }) {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedEmployeeToAdd, setSelectedEmployeeToAdd] = useState('');
  const [createMemberForm, setCreateMemberForm] = useState({ name: '', role: '', status: 'Active' });
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
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');
  const [detailTab, setDetailTab] = useState('General');
  const [selectedTaskListId, setSelectedTaskListId] = useState(null);

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
    startDate: '',
    dueDate: '',
    description: ''
  });
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [queryFormType, setQueryFormType] = useState('create'); // 'create' or 'edit'
  const [editingQuery, setEditingQuery] = useState(null);
  const [viewingQuery, setViewingQuery] = useState(null);
  const [showQueryViewModal, setShowQueryViewModal] = useState(false);
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
  const { can, getLevel } = usePermissions();
  const { alert, confirm } = useAlert();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialSelectedProject) {
      setSelectedProject(initialSelectedProject);
      setCurrentView('detail');
      if (onClearInitialProject) onClearInitialProject();
    }
  }, [initialSelectedProject, onClearInitialProject]);

  // ── FETCH DATA ──
  const fetchData = async () => {
    setLoading(true);
    try {
      const [projData, empData, userData, clientData] = await Promise.all([
        api.get('/projects'),
        api.get('/employees'),
        api.get('/users'),
        api.get('/clients')
      ]);
      setProjects(projData || []);
      setEmployees(empData || []);
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
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

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

  // Auto-seed default task categories if they don't exist in the database for this project
  useEffect(() => {
    if (selectedProject && !loading) {
      const defaultLists = ['UI/UX', 'Frontend', 'Backend', 'Functional', 'Future Work'];
      const existingNames = (selectedProject.taskLists || []).map(l => l.name);
      
      const seedMissing = async () => {
        let createdAny = false;
        for (const name of defaultLists) {
          if (!existingNames.some(existingName => existingName.toLowerCase() === name.toLowerCase())) {
            try {
              await api.post('/task-lists', {
                name,
                projectId: selectedProject.id
              });
              createdAny = true;
            } catch (err) {
              console.error(`Failed to seed task list: ${name}`, err);
            }
          }
        }
        if (createdAny) {
          fetchData();
        }
      };
      
      seedMissing();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, loading]);

  // ── DETAIL VIEW HANDLERS ──
  const toggleMemberDetail = async (empName) => {
    if (!selectedProject) return;
    
    const target = empName.trim();
    const currentMembers = (selectedProject.members || '')
      .split(',')
      .map(m => m.trim())
      .filter(m => m !== "");
    
    const exists = currentMembers.some(m => m.toLowerCase() === target.toLowerCase());
    
    let updatedMembers;
    if (exists) {
      // Remove (case-insensitive)
      updatedMembers = currentMembers.filter(m => m.toLowerCase() !== target.toLowerCase());
    } else {
      // Add
      updatedMembers = [...currentMembers, target];
    }

    try {
      await api.put(`/projects/${selectedProject.id}`, {
        members: updatedMembers.join(', ')
      });
      fetchData();
    } catch (error) {
      console.error('Update members error:', error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedEmployeeToAdd) {
      alert('Please select an employee to add', 'warning', 'No Selection');
      return;
    }
    try {
      const currentMembers = (selectedProject.members || '')
        .split(',')
        .map(m => m.trim())
        .filter(m => m !== "");
      
      if (!currentMembers.some(m => m.toLowerCase() === selectedEmployeeToAdd.trim().toLowerCase())) {
        currentMembers.push(selectedEmployeeToAdd.trim());
      }

      await api.put(`/projects/${selectedProject.id}`, {
        members: currentMembers.join(', ')
      });

      const emp = employees.find(e => e.name.trim().toLowerCase() === selectedEmployeeToAdd.trim().toLowerCase());
      if (emp) {
        await api.put(`/employees/${emp.id}`, {
          projectName: selectedProject.name,
          projectStatus: 'Active'
        });
      }

      setSelectedEmployeeToAdd('');
      setShowAddMemberModal(false);
      fetchData();
      alert('Member added to project successfully!', 'success', 'Member Added');
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member: ' + error.message, 'error', 'Error');
    }
  };

  const handleCreateAndAddMember = async () => {
    if (!createMemberForm.name.trim()) {
      alert('Please enter a member name', 'warning', 'Required');
      return;
    }
    try {
      const newEmpId = `EMP-${Date.now().toString().slice(-3)}`;
      await api.post('/employees', {
        id: newEmpId,
        name: createMemberForm.name,
        role: createMemberForm.role || 'Member',
        status: createMemberForm.status || 'Active',
        projectName: selectedProject.name,
        projectStatus: 'Active',
        type: 'Employee'
      });

      const currentMembers = (selectedProject.members || '')
        .split(',')
        .map(m => m.trim())
        .filter(m => m !== "");
      
      if (!currentMembers.some(m => m.toLowerCase() === createMemberForm.name.trim().toLowerCase())) {
        currentMembers.push(createMemberForm.name.trim());
      }

      await api.put(`/projects/${selectedProject.id}`, {
        members: currentMembers.join(', ')
      });

      setCreateMemberForm({ name: '', role: '', status: 'Active' });
      setShowCreateMemberModal(false);
      fetchData();
      alert('Member created and added to project successfully!', 'success', 'Done');
    } catch (error) {
      console.error('Error creating and adding member:', error);
      alert('Failed to create and add member: ' + error.message, 'error', 'Error');
    }
  };

  const handleToggleStatus = async (emp) => {
    if (!emp.id) return;
    
    let inactiveProjects = (emp.projectStatus || '').split(',').map(s => s.trim()).filter(Boolean);
    const projName = selectedProject.name;
    
    if (inactiveProjects.includes(projName)) {
      inactiveProjects = inactiveProjects.filter(p => p !== projName);
    } else {
      inactiveProjects.push(projName);
    }
    
    const newStatusStr = inactiveProjects.join(', ');
    
    try {
      await api.put(`/employees/${emp.id}`, { projectStatus: newStatusStr });
      fetchData();
    } catch (error) {
      console.error('Toggle status error:', error);
      alert('Failed to update status', 'error', 'Error');
    }
  };

  const handleSaveEditMember = async () => {
    if (!editingEmployee || !editingEmployee.id) return;
    try {
      await api.put(`/employees/${editingEmployee.id}`, {
        name: editingEmployee.name,
        role: editingEmployee.role,
        projectStatus: editingEmployee.status
      });
      // If the name changed, we also need to update the project's member list!
      const originalName = employees.find(e => e.id === editingEmployee.id)?.name || '';
      if (originalName && originalName.trim().toLowerCase() !== editingEmployee.name.trim().toLowerCase()) {
        const currentMembers = (selectedProject.members || '')
          .split(',')
          .map(m => m.trim())
          .filter(m => m !== "");
        const updatedMembers = currentMembers.map(m => m.toLowerCase() === originalName.toLowerCase() ? editingEmployee.name.trim() : m);
        await api.put(`/projects/${selectedProject.id}`, {
          members: updatedMembers.join(', ')
        });
      }
      setShowEditMemberModal(false);
      setEditingEmployee(null);
      fetchData();
      alert('Member updated successfully!', 'success', 'Updated');
    } catch (error) {
      console.error('Save edit member error:', error);
      alert('Failed to save changes', 'error', 'Error');
    }
  };

  const handleAddList = async () => {
    if (!newListName.trim() || !selectedProject) return;
    try {
      await api.post('/task-lists', {
        name: newListName,
        projectId: selectedProject.id
      });
      setNewListName('');
      fetchData();
    } catch (error) {
      console.error('Add list error:', error);
    }
  };



  // ── LIST HANDLERS ──
  const handleAdd = async () => {
    if (!form.name?.trim() || !form.client?.trim() || !form.description?.trim()) {
      alert("Please fill out all mandatory fields: Project Name, Client, and Description.", 'warning', 'Required Fields');
      return;
    }
    setIsSaving(true);
    try {
      if (form.id) {
        await api.put(`/projects/${form.id}`, form);
        alert('Project updated successfully!', 'success', 'Success');
      } else {
        await api.post('/projects', form);
        alert('Project created successfully!', 'success', 'Success');
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
    confirm('Remove this project? This action cannot be undone.', async () => {
      setIsSaving(true);
      try {
        await api.delete(`/projects/${id}`);
        alert('Project deleted successfully.', 'success', 'Deleted');
        fetchData();
      } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete project', 'error', 'Error');
      } finally {
        setIsSaving(false);
      }
    }, 'Delete Project');
  };

  const handleRemoveList = async (listId) => {
    confirm('Delete this task list? All tasks inside will also be removed.', async () => {
      try {
        await api.delete(`/task-lists/${listId}`);
        fetchData();
      } catch (error) {
        console.error('Delete list error:', error);
      }
    }, 'Delete Task List');
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
      fetchData();
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
      startDate: '',
      dueDate: '',
      description: ''
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
      startDate: formatDateForInput(task.startDate),
      dueDate: formatDateForInput(task.dueDate),
      description: task.description || ''
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
        alert('Task updated successfully!', 'success', 'Success');
      } else {
        await api.post('/tasks', payload);
        alert('Task created successfully!', 'success', 'Success');
      }

      setShowTaskFormModal(false);
      setTaskFormFields({ title: '', assignees: '', status: 'To Do', priority: 'Medium', startDate: '', dueDate: '', description: '' });
      setEditingTask(null);
      fetchData();
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
        fetchData();
      } catch (error) {
        console.error('Delete task error:', error);
        alert('Failed to delete task', 'error', 'Error');
      }
    }, 'Delete Task');
  };

  const handleOpenCreateQueryModal = () => {
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
  };

  const handleSaveQuery = async () => {
    if (!queryFormFields.title?.trim()) {
      alert('Query title is required.', 'warning', 'Required');
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
      fetchData();
    } catch (error) {
      console.error('Save query error:', error);
      alert('Failed to save query', 'error', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuery = async (queryId) => {
    confirm('Are you sure you want to delete this query?', async () => {
      try {
        await api.delete(`/project-queries/${queryId}`);
        fetchData();
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
      
      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="saas-field">
          <label className="saas-label">Project Name *</label>
          <input className="saas-input" placeholder="e.g. Phoenix Redesign" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        </div>
        <div className="saas-field">
          <label className="saas-label">Client *</label>
          <input 
            className="saas-input" 
            placeholder="e.g. Acme Corp" 
            value={form.client || ''} 
            onChange={e => setForm({...form, client: e.target.value})} 
          />
        </div>
        <div className="saas-field" style={{ gridColumn: 'span 2' }}>
          <label className="saas-label">Description *</label>
          <textarea className="saas-textarea" style={{ minHeight: '60px' }} placeholder="Project description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>
        <div className="saas-field">
          <label className="saas-label">Status</label>
          <select className="saas-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
            <option value="Active">Active (In Progress)</option>
            <option value="Inactive">Inactive</option>
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
          <label className="saas-label">Actual Hours</label>
          <input className="saas-input" type="number" placeholder="0" value={form.actualHours} onChange={e => setForm({...form, actualHours: e.target.value})} />
        </div>
        <div className="saas-field">
          <label className="saas-label">Billable Hours</label>
          <input className="saas-input" type="number" placeholder="0" value={form.billableHours} onChange={e => setForm({...form, billableHours: e.target.value})} />
        </div>
      </div>

      <div className="form-actions" style={{ display: 'flex', gap: '1rem' }}>
        <button className="saas-btn-submit" onClick={handleAdd}>{form.id ? 'Save Changes' : 'Create Project'}</button>
        <button className="saas-btn-cancel" onClick={() => setShowForm(false)} style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.65rem 1.25rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Discard</button>
      </div>
    </div>
  );

  const renderTaskFormModal = () => {
    if (!selectedProject) return null;
    const rawMembers = (selectedProject.members || '').split(',').map(m => m.trim()).filter(m => m !== "");
    const projMembers = [...new Set(rawMembers)];
    const assigneesList = projMembers.length > 0 ? projMembers : employees.map(e => e.name);

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: '12px', width: '500px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
              {taskFormType === 'create' ? 'Create New Task' : 'Edit Task'}
            </h3>
            <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowTaskFormModal(false)}>✕</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
            <div className="saas-field">
              <label className="saas-label">Task Title *</label>
              <input
                className="saas-input"
                placeholder="What needs to be done?"
                value={taskFormFields.title}
                onChange={e => setTaskFormFields({ ...taskFormFields, title: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="saas-field">
                <label className="saas-label">Assignee</label>
                <select
                  className="saas-select"
                  value={taskFormFields.assignees}
                  onChange={e => setTaskFormFields({ ...taskFormFields, assignees: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {assigneesList.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="saas-field">
                <label className="saas-label">Priority</label>
                <select
                  className="saas-select"
                  value={taskFormFields.priority}
                  onChange={e => setTaskFormFields({ ...taskFormFields, priority: e.target.value })}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="saas-field">
                <label className="saas-label">Start Date</label>
                <input
                  type="date"
                  className="saas-input"
                  value={taskFormFields.startDate}
                  onChange={e => setTaskFormFields({ ...taskFormFields, startDate: e.target.value })}
                />
              </div>

              <div className="saas-field">
                <label className="saas-label">Due Date</label>
                <input
                  type="date"
                  className="saas-input"
                  value={taskFormFields.dueDate}
                  onChange={e => setTaskFormFields({ ...taskFormFields, dueDate: e.target.value })}
                />
              </div>
            </div>

            <div className="saas-field">
              <label className="saas-label">Status</label>
              <select
                className="saas-select"
                value={taskFormFields.status}
                onChange={e => setTaskFormFields({ ...taskFormFields, status: e.target.value })}
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="saas-field">
              <label className="saas-label">Description *</label>
              <textarea
                className="saas-textarea"
                placeholder="Task details..."
                style={{ minHeight: '80px' }}
                value={taskFormFields.description}
                onChange={e => setTaskFormFields({ ...taskFormFields, description: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: '#64748b', cursor: 'pointer' }} onClick={() => setShowTaskFormModal(false)}>Cancel</button>
            <button style={{ background: '#0066FF', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: 'white', cursor: 'pointer' }} onClick={handleSaveTask}>
              {taskFormType === 'create' ? 'Create Task' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTaskViewModal = () => {
    if (!viewingTask) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: '12px', width: '500px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Task Details</h3>
            <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }} onClick={() => { setShowTaskViewModal(false); setViewingTask(null); }}>✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: '#334155' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Task ID</strong>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>#{viewingTask.id.slice(-6).toUpperCase()}</span>
            </div>

            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Task Title</strong>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>{viewingTask.title}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Assignee</strong>
                <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '600' }}>{viewingTask.assignees || 'Unassigned'}</span>
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Priority</strong>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  color: viewingTask.priority === 'High' ? '#ef4444' : viewingTask.priority === 'Medium' ? '#f59e0b' : '#64748b'
                }}>{viewingTask.priority || 'Medium'}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Start Date</strong>
                <span style={{ fontSize: '0.9rem', color: '#0f172a' }}>{viewingTask.startDate ? new Date(viewingTask.startDate).toLocaleDateString() : '-'}</span>
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Due Date</strong>
                <span style={{ fontSize: '0.9rem', color: '#0f172a' }}>{viewingTask.dueDate ? new Date(viewingTask.dueDate).toLocaleDateString() : '-'}</span>
              </div>
            </div>

            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Status</strong>
              <span style={{
                background: viewingTask.status === 'Completed' ? '#dcfce7' : viewingTask.status === 'In Progress' ? '#dbeafe' : '#f1f5f9',
                color: viewingTask.status === 'Completed' ? '#16a34a' : viewingTask.status === 'In Progress' ? '#2563eb' : '#475569',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '700',
                display: 'inline-block'
              }}>{viewingTask.status || 'To Do'}</span>
            </div>

            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Description</strong>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {viewingTask.description || 'No description provided.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button style={{ background: '#0066FF', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: 'white', cursor: 'pointer' }} onClick={() => { setShowTaskViewModal(false); setViewingTask(null); }}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  const renderQueryFormModal = () => {
    if (!selectedProject) return null;
    const rawMembers = (selectedProject.members || '').split(',').map(m => m.trim()).filter(m => m !== "");
    const projMembers = [...new Set(rawMembers)];
    const assigneesList = projMembers.length > 0 ? projMembers : employees.map(e => e.name);

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: '12px', width: '500px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
              {queryFormType === 'create' ? 'Create New Query' : 'Edit Query'}
            </h3>
            <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowQueryModal(false)}>✕</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
            <div className="saas-field">
              <label className="saas-label">Query Title *</label>
              <input
                className="saas-input"
                placeholder="What is the query about?"
                value={queryFormFields.title}
                onChange={e => setQueryFormFields({ ...queryFormFields, title: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="saas-field">
                <label className="saas-label">Sent To</label>
                <select
                  className="saas-select"
                  value={queryFormFields.sentTo}
                  onChange={e => setQueryFormFields({ ...queryFormFields, sentTo: e.target.value })}
                >
                  <option value="">Choose employee...</option>
                  {assigneesList.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="saas-field">
                <label className="saas-label">Priority</label>
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="saas-field">
                <label className="saas-label">Status</label>
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
                <label className="saas-label">Solved (Yes/No)</label>
                <select
                  className="saas-select"
                  value={queryFormFields.solved ? "true" : "false"}
                  onChange={e => setQueryFormFields({ ...queryFormFields, solved: e.target.value === "true" })}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>

            <div className="saas-field">
              <label className="saas-label">Description</label>
              <textarea
                className="saas-textarea"
                placeholder="Query details..."
                style={{ minHeight: '80px' }}
                value={queryFormFields.description}
                onChange={e => setQueryFormFields({ ...queryFormFields, description: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: '#64748b', cursor: 'pointer' }} onClick={() => setShowQueryModal(false)}>Cancel</button>
            <button style={{ background: '#0066FF', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: 'white', cursor: 'pointer' }} onClick={handleSaveQuery}>
              {queryFormType === 'create' ? 'Submit Query' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderQueryViewModal = () => {
    if (!viewingQuery) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: '12px', width: '500px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Query Details</h3>
            <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }} onClick={() => { setShowQueryViewModal(false); setViewingQuery(null); }}>✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: '#334155' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Query ID</strong>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#a21caf' }}>{viewingQuery.queryId || `QRY-${viewingQuery.id.slice(-4).toUpperCase()}`}</span>
            </div>

            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Query Title</strong>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>{viewingQuery.title}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Sent To</strong>
                <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '600' }}>{viewingQuery.sentTo || 'Unassigned'}</span>
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Priority</strong>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  color: viewingQuery.priority === 'High' ? '#ef4444' : viewingQuery.priority === 'Medium' ? '#ea580c' : '#16a34a'
                }}>{viewingQuery.priority || 'Medium'}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Status</strong>
                <span style={{
                  background: viewingQuery.status === 'Solved' || viewingQuery.solved ? '#dcfce7' : viewingQuery.status === 'In Discussion' ? '#f3e8ff' : '#dbeafe',
                  color: viewingQuery.status === 'Solved' || viewingQuery.solved ? '#16a34a' : viewingQuery.status === 'In Discussion' ? '#9333ea' : '#2563eb',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  display: 'inline-block'
                }}>{viewingQuery.status || 'Open'}</span>
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Solved</strong>
                <span style={{ fontSize: '0.9rem', color: viewingQuery.solved ? '#16a34a' : '#ef4444', fontWeight: '700' }}>{viewingQuery.solved ? 'Yes' : 'No'}</span>
              </div>
            </div>

            <div>
              <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Description</strong>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {viewingQuery.description || 'No description provided.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button style={{ background: '#0066FF', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: 'white', cursor: 'pointer' }} onClick={() => { setShowQueryViewModal(false); setViewingQuery(null); }}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  // ── RENDER DETAIL VIEW ──
  if (currentView === 'detail' && selectedProject) {
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
      <div className="projects-page page-container detail-view" style={{ padding: '2rem 3rem', background: '#f8fafc', minHeight: '100vh' }}>
        
        {/* Breadcrumb Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: '600' }}>
          <button style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }} onClick={() => { setCurrentView('list'); setSelectedTaskListId(null); }}>
            Projects
          </button>
          <span style={{ color: '#94a3b8' }}>&gt;</span>
          <span style={{ color: '#0f172a' }}>Project Details</span>
        </div>

        {showForm && renderForm()}
        {showTaskFormModal && renderTaskFormModal()}
        {showTaskViewModal && renderTaskViewModal()}
        {showQueryModal && renderQueryFormModal()}
        {showQueryViewModal && renderQueryViewModal()}

        {/* Top Profile Card */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea' }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: '#0f172a' }}>{selectedProject.name}</h2>
                <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>{selectedProject.status || 'In Progress'}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Client: <span style={{ color: '#2563eb', fontWeight: '600' }}>{selectedProject.client || 'Spagylo Technologies'}</span>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                Project ID: <span style={{ fontWeight: '500' }}>{projectID}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '600', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
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
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Edit Project
            </button>
            <button 
              style={{ padding: '0.5rem 1rem', background: '#2563eb', border: 'none', borderRadius: '8px', fontWeight: '600', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => {
                if (onNavigateToTasks) {
                  onNavigateToTasks({ projectName: selectedProject.name });
                } else {
                  setDetailTab('Tasks');
                  const firstList = selectedProject.taskLists?.[0];
                  if (firstList) {
                    setSelectedTaskListId(firstList.id);
                    setTaskFormType('create');
                    setEditingTask(null);
                    setTaskFormFields({
                      title: '',
                      assignees: '',
                      status: 'To Do',
                      priority: 'Medium',
                      startDate: '',
                      dueDate: '',
                      description: ''
                    });
                    setShowTaskFormModal(true);
                  }
                }
              }}
            >
              + Add Task
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        {detailTab === 'General' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
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
        <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #e2e8f0', marginBottom: '2rem', padding: '0 0.5rem' }}>
          {[
            { id: 'General', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> },
            { id: 'Tasks', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg> },
            { id: 'Teams', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg> },
            { id: 'Queries', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> },
            { id: 'Attachments', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setDetailTab(tab.id); setSelectedTaskListId(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none',
                padding: '0.75rem 0', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer',
                color: detailTab === tab.id ? '#0f172a' : '#64748b',
                borderBottom: detailTab === tab.id ? '2px solid #0f172a' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'all 0.2s'
              }}
            >
              {tab.icon}
              {tab.id}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '2rem' }}>
          
          {detailTab === 'General' && (
            <div>
              <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>Project Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Information Rows */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '200px', display: 'flex', alignItems: 'center', gap: '1rem', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    Project Name
                  </div>
                  <div style={{ width: '30px', color: '#cbd5e1' }}>:</div>
                  <div style={{ color: '#0f172a', fontWeight: '700', fontSize: '0.9rem' }}>{selectedProject.name}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ width: '200px', display: 'flex', alignItems: 'center', gap: '1rem', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Description
                  </div>
                  <div style={{ width: '30px', color: '#cbd5e1' }}>:</div>
                  <div style={{ color: '#0f172a', fontWeight: '500', fontSize: '0.85rem', maxWidth: '600px', lineHeight: '1.6' }}>
                    {selectedProject.description || '-'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '200px', display: 'flex', alignItems: 'center', gap: '1rem', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-3-3.87"></path><path d="M4 21v-2a4 4 0 0 1 3-3.87"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Client
                  </div>
                  <div style={{ width: '30px', color: '#cbd5e1' }}>:</div>
                  <div style={{ color: '#0f172a', fontWeight: '700', fontSize: '0.9rem' }}>{selectedProject.client || '-'}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '200px', display: 'flex', alignItems: 'center', gap: '1rem', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    Status
                  </div>
                  <div style={{ width: '30px', color: '#cbd5e1' }}>:</div>
                  <div>
                    <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>
                      {selectedProject.status || 'In Progress'}
                    </span>
                  </div>
                </div>

                {/* Hours row */}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '1rem' }}>
                  <div style={{ width: '200px', display: 'flex', alignItems: 'center', gap: '1rem', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Estimated Hours
                  </div>
                  <div style={{ width: '30px', color: '#cbd5e1' }}>:</div>
                  <div style={{ color: '#0f172a', fontWeight: '700', fontSize: '0.9rem', width: '150px' }}>{selectedProject.estimatedHours ? `${selectedProject.estimatedHours} hrs` : '-'}</div>

                  <div style={{ width: '150px', display: 'flex', alignItems: 'center', gap: '1rem', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Actual Hours
                  </div>
                  <div style={{ width: '30px', color: '#cbd5e1' }}>:</div>
                  <div style={{ color: '#0f172a', fontWeight: '700', fontSize: '0.9rem', width: '150px' }}>{selectedProject.actualHours ? `${selectedProject.actualHours} hrs` : '-'}</div>

                  <div style={{ width: '150px', display: 'flex', alignItems: 'center', gap: '1rem', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    Billable Hours
                  </div>
                  <div style={{ width: '30px', color: '#cbd5e1' }}>:</div>
                  <div style={{ color: '#0f172a', fontWeight: '700', fontSize: '0.9rem' }}>{selectedProject.billableHours ? `${selectedProject.billableHours} hrs` : '-'}</div>
                </div>

              </div>
            </div>
          )}

          {detailTab === 'Tasks' && (
            <div>
              {!selectedTaskListId ? (
                // View A: List of Task Categories
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>Task List</h3>
                    {can('projects', 'create') && (
                      <div className="add-list-inline" style={{ marginTop: 0, display: 'flex', gap: '0.5rem' }}>
                        <input 
                          className="saas-input" 
                          placeholder="New Task List..." 
                          style={{ width: '200px', height: '36px', fontSize: '0.85rem', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
                          value={newListName}
                          onChange={e => setNewListName(e.target.value)}
                        />
                        <button 
                          className="saas-btn-submit" 
                          style={{ padding: '0 1rem', height: '36px', fontSize: '0.8rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                          onClick={handleAddList}
                        >
                          + Add Task List
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="task-lists-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: '420px' }}>
                    {(selectedProject.taskLists || []).map(list => {
                      const isEditing = editingListId === list.id;

                      return (
                        <div 
                          key={list.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            background: 'white', 
                            padding: '0.6rem 1rem', 
                            borderRadius: '8px', 
                            border: '1px solid #e2e8f0', 
                            cursor: isEditing ? 'default' : 'pointer', 
                            transition: 'all 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                          }}
                          onClick={() => {
                            if (!isEditing) {
                              setSelectedTaskListId(list.id);
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (!isEditing) {
                              e.currentTarget.style.borderColor = '#2563eb';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.06)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isEditing) {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                            }
                          }}
                        >
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }} onClick={(e) => e.stopPropagation()}>
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
                                style={{ height: '30px', fontSize: '0.85rem', flex: 1, padding: '0 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                              />
                              <button
                                onClick={() => handleRenameList(list.id)}
                                style={{ background: '#0066FF', color: 'white', border: 'none', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                title="Save"
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              </button>
                              <button
                                onClick={() => { setEditingListId(null); setEditingListName(''); }}
                                style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                title="Cancel"
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                              </button>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.92rem', fontWeight: '700', color: '#0f172a' }}>{list.name}</span>
                                <span style={{ fontSize: '0.75rem', color: '#2563eb', background: '#eff6ff', padding: '0.1rem 0.4rem', borderRadius: '20px', fontWeight: '700' }}>
                                  ({(list.tasks || []).length})
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                {/* Rename icon button */}
                                {can('projects', 'edit') && (
                                  <button
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem', transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
                                    title="Rename Category"
                                    onClick={() => {
                                      setEditingListId(list.id);
                                      setEditingListName(list.name);
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#0066FF'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                  >
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                  </button>
                                )}

                                {/* Delete list button */}
                                {can('projects', 'delete') && (
                                  <button 
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem', transition: 'color 0.2s', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                                    title="Delete Category"
                                    onClick={() => {
                                      confirm(`Delete "${list.name}" list and all its tasks?`, () => handleRemoveList(list.id), 'Delete Category');
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                  >
                                    ✕
                                  </button>
                                )}
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {(selectedProject.taskLists || []).length === 0 && (
                      <div style={{ color: '#94a3b8', fontSize: '0.95rem', padding: '3rem 2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        No task categories created for this project yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // View B: Task Category Details Page (Drill-down)
                (() => {
                  const activeList = (selectedProject.taskLists || []).find(l => l.id === selectedTaskListId);
                  if (!activeList) {
                    setSelectedTaskListId(null);
                    return null;
                  }
                  return (
                    <div>
                      {/* Back button styled matching the sketch */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <button 
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#0066FF', 
                            cursor: 'pointer', 
                            fontSize: '0.9rem', 
                            fontWeight: '700', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.4rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            transition: 'background 0.2s'
                          }}
                          onClick={() => setSelectedTaskListId(null)}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                          Task List
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: '#0f172a' }}>{activeList.name}</h3>
                          <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>({(activeList.tasks || []).length} tasks)</span>
                        </div>

                        {can('tasks', 'create') && (
                          <button 
                            className="saas-btn-submit" 
                            style={{ background: '#0066FF', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }} 
                            onClick={handleOpenCreateTaskModal}
                          >
                            + Create Task
                          </button>
                        )}
                      </div>

                      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Task ID</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Task Title</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Assignee</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Status</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Priority</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Start Date</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Due Date</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(activeList.tasks || []).map(task => (
                                <tr key={task.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', fontWeight: '700', color: '#64748b' }}>
                                    #{task.id.slice(-6).toUpperCase()}
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>
                                    {task.title}
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem' }}>
                                    <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '6px', fontWeight: '700' }}>
                                      {task.assignees || 'Unassigned'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem' }}>
                                    <span style={{ 
                                      background: task.status === 'Completed' ? '#dcfce7' : task.status === 'In Progress' ? '#dbeafe' : '#f1f5f9', 
                                      color: task.status === 'Completed' ? '#16a34a' : task.status === 'In Progress' ? '#2563eb' : '#475569', 
                                      fontSize: '0.75rem', 
                                      padding: '0.25rem 0.5rem', 
                                      borderRadius: '6px', 
                                      fontWeight: '700' 
                                    }}>
                                      {task.status || 'To Do'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem' }}>
                                    <span style={{ 
                                      color: task.priority === 'High' ? '#ef4444' : task.priority === 'Medium' ? '#ea580c' : '#64748b', 
                                      fontSize: '0.75rem', 
                                      fontWeight: '700' 
                                    }}>
                                      {task.priority || 'Medium'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                                    {task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '-'}
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                                    {task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '-'}
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                      {/* View Details Button */}
                                      <button 
                                        style={{ background: 'none', border: 'none', color: '#0066FF', cursor: 'pointer', padding: '0.25rem' }} 
                                        title="View Details"
                                        onClick={() => { setViewingTask(task); setShowTaskViewModal(true); }}
                                      >
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                      </button>
  
                                      {/* Edit Button */}
                                      {can('tasks', 'edit') && (
                                        <button 
                                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }} 
                                          title="Edit Task"
                                          onClick={() => handleOpenEditTaskModal(task)}
                                        >
                                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                      )}
  
                                      {/* Delete Button */}
                                      {can('tasks', 'delete') && (
                                        <button 
                                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }} 
                                          title="Delete Task"
                                          onClick={() => handleDeleteTask(task.id)}
                                        >
                                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {(activeList.tasks || []).length === 0 && (
                                <tr>
                                  <td colSpan="8" style={{ padding: '2.5rem', textAlign: 'center', fontSize: '0.9rem', color: '#94a3b8' }}>
                                    No tasks in this category yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()
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
                      className="saas-btn-submit" 
                      style={{ background: '#0066FF', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }} 
                      onClick={() => setShowAddMemberModal(true)}
                    >
                      + Add Member
                    </button>
                    <button 
                      style={{ background: 'white', color: '#0066FF', border: '1px solid #0066FF', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }} 
                      onClick={() => setShowCreateMemberModal(true)}
                    >
                      Create Member
                    </button>
                  </div>
                )}
              </div>

              {/* Members Table */}
              <div className="saas-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
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
                        const emp = employees.find(e => e.name.trim().toLowerCase() === m.toLowerCase()) || {};
                        const usr = users.find(u => (u.fullName || '').trim().toLowerCase() === m.toLowerCase()) || {};
                        
                        const inactiveProjects = (emp.projectStatus || '').split(',').map(s => s.trim()).filter(Boolean);
                        const isActive = !inactiveProjects.includes(selectedProject.name);
                        const statusVal = isActive ? 'Active' : 'Inactive';
                        const designation = emp.role || 'Member';
                        
                        const loggedInName = (user?.fullName || user?.name || '').trim().toLowerCase();
                        const isYou = loggedInName && m.toLowerCase() === loggedInName;
                        
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
                                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: getAvatarColor(m), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', border: '1.5px solid #e2e8f0' }}>
                                    {getInitials(m)}
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.9rem' }}>{m}</span>
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
                                  {/* Edit Icon */}
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ cursor: 'pointer', color: '#64748b' }} onClick={() => { setEditingEmployee(emp.id ? emp : { id: `EMP-${Date.now()}`, name: m, role: designation, status: statusVal }); setShowEditMemberModal(true); }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>

                                  {/* Delete Icon */}
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => {
                                    confirm(`Delete member "${m}" from this project?`, () => toggleMemberDetail(m), 'Remove Member');
                                  }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>

                                  {/* Toggle Switch */}
                                  {emp.id && (
                                    <label style={{ display: 'inline-block', position: 'relative', width: '38px', height: '20px', cursor: 'pointer' }}>
                                      <input 
                                        type="checkbox" 
                                        checked={isActive} 
                                        onChange={() => handleToggleStatus(emp)} 
                                        style={{ opacity: 0, width: 0, height: 0 }} 
                                      />
                                      <span style={{ 
                                        position: 'absolute', 
                                        top: 0, left: 0, right: 0, bottom: 0, 
                                        backgroundColor: isActive ? '#0066FF' : '#cbd5e1', 
                                        transition: '0.3s', 
                                        borderRadius: '20px' 
                                      }}>
                                        <span style={{ 
                                          position: 'absolute', 
                                          height: '14px', width: '14px', 
                                          left: isActive ? '20px' : '3px', 
                                          bottom: '3px', 
                                          backgroundColor: 'white', 
                                          transition: '0.3s', 
                                          borderRadius: '50%' 
                                        }} />
                                      </span>
                                    </label>
                                  )}
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
                          <option value="">Choose an employee...</option>
                          {employees
                            .filter(emp => !projMembers.some(pm => pm.toLowerCase() === emp.name.trim().toLowerCase()))
                            .map(emp => (
                              <option key={emp.id} value={emp.name}>{emp.name} ({emp.role || 'No role'})</option>
                            ))
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

              {showCreateMemberModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                  <div style={{ background: 'white', borderRadius: '12px', width: '450px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Create Team Member</h3>
                      <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowCreateMemberModal(false)}>✕</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                      <div className="saas-field">
                        <label className="saas-label">Member Name</label>
                        <input
                          className="saas-input"
                          placeholder="Enter name"
                          value={createMemberForm.name}
                          onChange={e => setCreateMemberForm({ ...createMemberForm, name: e.target.value })}
                        />
                      </div>
                      <div className="saas-field">
                        <label className="saas-label">Designation</label>
                        <input
                          className="saas-input"
                          placeholder="e.g. Developer"
                          value={createMemberForm.role}
                          onChange={e => setCreateMemberForm({ ...createMemberForm, role: e.target.value })}
                        />
                      </div>
                      <div className="saas-field">
                        <label className="saas-label">Status</label>
                        <select
                          className="saas-select"
                          value={createMemberForm.status}
                          onChange={e => setCreateMemberForm({ ...createMemberForm, status: e.target.value })}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: '#64748b', cursor: 'pointer' }} onClick={() => setShowCreateMemberModal(false)}>Cancel</button>
                      <button style={{ background: '#0066FF', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: 'white', cursor: 'pointer' }} onClick={handleCreateAndAddMember}>Create & Add</button>
                    </div>
                  </div>
                </div>
              )}

              {showEditMemberModal && editingEmployee && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                  <div style={{ background: 'white', borderRadius: '12px', width: '450px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Edit Team Member</h3>
                      <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }} onClick={() => { setShowEditMemberModal(false); setEditingEmployee(null); }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                      <div className="saas-field">
                        <label className="saas-label">Member Name</label>
                        <input
                          className="saas-input"
                          value={editingEmployee.name}
                          onChange={e => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                        />
                      </div>
                      <div className="saas-field">
                        <label className="saas-label">Designation</label>
                        <input
                          className="saas-input"
                          value={editingEmployee.role}
                          onChange={e => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                        />
                      </div>
                      <div className="saas-field">
                        <label className="saas-label">Status</label>
                        <select
                          className="saas-select"
                          value={editingEmployee.status}
                          onChange={e => setEditingEmployee({ ...editingEmployee, status: e.target.value })}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: '#64748b', cursor: 'pointer' }} onClick={() => { setShowEditMemberModal(false); setEditingEmployee(null); }}>Cancel</button>
                      <button style={{ background: '#0066FF', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: '600', color: 'white', cursor: 'pointer' }} onClick={handleSaveEditMember}>Save Changes</button>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
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

              {/* Filter controls row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Search box */}
                  <div style={{ position: 'relative', width: '280px' }}>
                    <input 
                      className="saas-input"
                      placeholder="Search queries by title, description..."
                      value={querySearchText}
                      onChange={e => setQuerySearchText(e.target.value)}
                      style={{ paddingLeft: '2.25rem', height: '38px', fontSize: '0.85rem' }}
                    />
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" strokeWidth="2.5" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
                      <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>

                  {/* Status filter dropdown */}
                  <select 
                    className="saas-select" 
                    value={queryStatusFilter} 
                    onChange={e => setQueryStatusFilter(e.target.value)} 
                    style={{ width: '130px', height: '38px', fontSize: '0.85rem' }}
                  >
                    <option value="All Status">All Status</option>
                    <option value="Open">Open</option>
                    <option value="In Discussion">In Discussion</option>
                    <option value="Solved">Solved</option>
                    <option value="Closed">Closed</option>
                  </select>

                  {/* Sent To filter dropdown */}
                  <select 
                    className="saas-select" 
                    value={querySentToFilter} 
                    onChange={e => setQuerySentToFilter(e.target.value)} 
                    style={{ width: '140px', height: '38px', fontSize: '0.85rem' }}
                  >
                    <option value="All Sent To">All Sent To</option>
                    {projMembers.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>

                  {/* Priority filter dropdown */}
                  <select 
                    className="saas-select" 
                    value={queryPriorityFilter} 
                    onChange={e => setQueryPriorityFilter(e.target.value)} 
                    style={{ width: '130px', height: '38px', fontSize: '0.85rem' }}
                  >
                    <option value="All Priority">All Priority</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>

                  {/* Reset Filters button */}
                  <button 
                    onClick={() => {
                      setQuerySearchText('');
                      setQueryStatusFilter('All Status');
                      setQuerySentToFilter('All Sent To');
                      setQueryPriorityFilter('All Priority');
                    }}
                    style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.85rem', color: '#475569', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', height: '38px' }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    Reset
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {/* New Query Button */}
                  {can('tasks', 'create') && (
                    <button 
                      className="saas-btn-submit" 
                      onClick={handleOpenCreateQueryModal}
                      style={{ background: '#0066FF', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', height: '38px' }}
                    >
                      + New Query
                    </button>
                  )}

                  {/* Filters Button */}
                  <button style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 1rem', color: '#475569', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', height: '38px' }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    Filters
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
                  <div className="saas-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="saas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
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
                                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', fontWeight: '700', color: '#a21caf' }}>
                                    {q.queryId || `QRY-${q.id.slice(-4).toUpperCase()}`}
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#0f172a', fontWeight: '600' }}>
                                    {q.title}
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }} title={q.description}>
                                    {q.description || '-'}
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem' }}>
                                    {q.sentTo ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: getAvatarColor(q.sentTo), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.65rem' }}>
                                          {getInitials(q.sentTo)}
                                        </div>
                                        <span style={{ fontSize: '0.8rem', fontWeight: '500', color: '#334155' }}>{q.sentTo}</span>
                                      </div>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Unassigned</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem' }}>
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
                                  <td style={{ padding: '1rem 1.5rem' }}>
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
                                  <td style={{ padding: '1rem 1.5rem' }}>
                                    <span style={{ 
                                      color: q.priority === 'High' ? '#ef4444' : q.priority === 'Medium' ? '#ea580c' : '#16a34a', 
                                      fontSize: '0.75rem', 
                                      fontWeight: '700' 
                                    }}>
                                      {q.priority || 'Medium'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                                    {new Date(q.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </td>
                                  <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                      {/* View button */}
                                      <button 
                                        style={{ background: 'none', border: 'none', color: '#0066FF', cursor: 'pointer', padding: '0.25rem' }} 
                                        title="View Details"
                                        onClick={() => { setViewingQuery(q); setShowQueryViewModal(true); }}
                                      >
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                      </button>

                                      {/* Edit button */}
                                      {can('tasks', 'edit') && (
                                        <button 
                                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }} 
                                          title="Edit Query"
                                          onClick={() => handleOpenEditQueryModal(q)}
                                        >
                                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                      )}

                                      {/* Delete button */}
                                      {can('tasks', 'delete') && (
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
              })()}
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
              if (!uploadForm.name.trim()) { alert('Please enter a file name', 'warning', 'Required'); return; }
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
                  uploadedBy: user?.fullName || user?.name || 'Unknown',
                  fileSize: fileSize || '-',
                  fileUrl
                });
                setShowUploadModal(false);
                setUploadForm({ name: '', description: '', file: null });
                fetchData();
                alert('File uploaded successfully!', 'success', 'Uploaded');
              } catch (err) {
                console.error('Upload save error:', err);
                alert('Failed to save attachment', 'error', 'Error');
              }
              setUploading(false);
            };

            const handleDeleteAttachment = async (attId) => {
              try {
                await api.delete(`/projects/${selectedProject.id}/attachments/${attId}`);
                fetchData();
              } catch (err) {
                console.error('Delete attachment error:', err);
              }
            };

            return (
              <div>
                {/* Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                      <input
                        placeholder="Search attachments..."
                        value={attachSearch}
                        onChange={e => setAttachSearch(e.target.value)}
                        style={{ padding: '0.5rem 0.75rem 0.5rem 2rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', width: '220px', outline: 'none', color: '#334155' }}
                      />
                    </div>
                    <select
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
                        onClick={() => setShowUploadModal(true)}
                        style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Upload Files
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
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
                            <td style={{ padding: '0.85rem 1.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {getFileIcon(a.name)}
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>{a.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.85rem', color: '#475569', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description || '-'}</td>
                            <td style={{ padding: '0.85rem 1.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '800' }}>
                                  {(a.uploadedBy || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
                                </div>
                                <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: '500' }}>{a.uploadedBy}</span>
                              </div>
                            </td>
                            <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.85rem', color: '#475569', fontWeight: '500' }}>{a.fileSize || '-'}</td>
                            <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.85rem', color: '#475569' }}>
                              {new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(a.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </td>
                            <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                {a.fileUrl && (
                                  <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', cursor: 'pointer', display: 'flex' }} title="Download">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                  </a>
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

                {/* Upload Modal */}
                {showUploadModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', borderRadius: '16px', width: '500px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>Upload Attachment</h3>
                        <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>File Name *</label>
                          <input
                            value={uploadForm.name}
                            onChange={e => setUploadForm({ ...uploadForm, name: e.target.value })}
                            placeholder="e.g. Project_Requirements.pdf"
                            style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>Description</label>
                          <textarea
                            value={uploadForm.description}
                            onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
                            placeholder="Brief description of the file..."
                            rows={3}
                            style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#334155', marginBottom: '0.35rem' }}>Choose File</label>
                          <div
                            onClick={() => attachFileRef.current?.click()}
                            style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'border-color 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = '#2563eb'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                          >
                            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ margin: '0 auto 0.5rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                              {uploadForm.file ? uploadForm.file.name : 'Click to browse or drag & drop'}
                            </p>
                            {uploadForm.file && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{(uploadForm.file.size / (1024 * 1024)).toFixed(2)} MB</p>}
                          </div>
                          <input ref={attachFileRef} type="file" style={{ display: 'none' }} onChange={e => {
                            const f = e.target.files[0];
                            if (f) {
                              setUploadForm(prev => ({ ...prev, file: f, name: prev.name || f.name }));
                            }
                          }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button onClick={() => setShowUploadModal(false)} style={{ padding: '0.6rem 1.25rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '600', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                        <button onClick={handleUpload} disabled={uploading} style={{ padding: '0.6rem 1.25rem', background: '#2563eb', border: 'none', borderRadius: '8px', fontWeight: '600', color: 'white', cursor: uploading ? 'wait' : 'pointer', fontSize: '0.85rem', opacity: uploading ? 0.7 : 1 }}>
                          {uploading ? 'Uploading...' : 'Upload'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── RENDER LIST VIEW ──


  const viewLevel = getLevel('projects', 'view');
  let allowedProjects = projects;

  if (viewLevel === 'Self') {
    const loggedInName = (user?.fullName || user?.name || '').trim().toLowerCase();
    allowedProjects = allowedProjects.filter(p => {
      const rawMembers = (p.members || '').split(',').map(m => m.trim()).filter(m => m !== "");
      if (!rawMembers.some(m => m.toLowerCase() === loggedInName)) return false;
      const emp = employees.find(e => e.name.trim().toLowerCase() === loggedInName);
      if (emp) {
        if ((emp.status || 'Active').toLowerCase() === 'inactive') return false;
        const inactiveProjects = (emp.projectStatus || '').split(',').map(s => s.trim()).filter(Boolean);
        if (inactiveProjects.includes(p.name)) return false;
      }
      return true;
    });
  }

  const filteredProjects = statusFilter === 'All' 
    ? allowedProjects 
    : allowedProjects.filter(p => (p.status || 'In Progress') === statusFilter);

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
    <div className="projects-page page-container" style={{ padding: '2rem 3rem' }}>
      {/* Header matching the screenshot */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Projects</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>Manage and track all your projects.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '600', color: '#334155', cursor: 'pointer', outline: 'none' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
            <option value="Pending">Pending</option>
          </select>
          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', background: '#2563eb', border: 'none', borderRadius: '8px', fontWeight: '600', color: 'white', cursor: 'pointer' }} onClick={() => {
            setForm({ name: '', status: 'Active', description: '', client: '', clientId: '', estimatedHours: 0, actualHours: 0, billableHours: 0 });
            setShowForm(true);
          }}>
            + Add Project
          </button>
        </div>
      </div>

      {/* Add Project Form */}
      {showForm && renderForm()}

      {/* Projects Table Container */}
      <div className="saas-table-container" style={{ padding: '0', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Table Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
          <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>Total Projects: {filteredProjects.length || 0}</span>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '250px' }}>
              <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Search..." style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.2rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
            </div>
            <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
            <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }} onClick={fetchData}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
          </div>
        </div>

        <table className="saas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'white' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ width: '40px', padding: '1rem 1.5rem', background: 'white' }}>
                <input 
                  type="checkbox" 
                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#2563eb' }} 
                  checked={filteredProjects.length > 0 && selectedProjectIds.length === filteredProjects.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th style={{ padding: '1rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>#</th>
              <th style={{ padding: '1rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Project Name</th>
              <th style={{ padding: '1rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Client</th>
              <th style={{ padding: '1rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Status</th>
              <th style={{ padding: '1rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Estimated Hours</th>
              <th style={{ padding: '1rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Actual Hours</th>
              <th style={{ padding: '1rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Billable Hours</th>
              <th style={{ padding: '1rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', background: 'white', textTransform: 'capitalize' }}>Created On</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: '#1e293b', textAlign: 'center', background: 'white', textTransform: 'capitalize' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Syncing workspace...</td></tr>
            ) : filteredProjects.length === 0 ? (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No projects in this view.</td></tr>
            ) : (
              filteredProjects.map((proj, idx) => {
                const client = proj.client || '-';
                const estHours = proj.estimatedHours ? `${proj.estimatedHours} hrs` : '-';
                const actHours = proj.actualHours ? `${proj.actualHours} hrs` : '-';
                const bilHours = proj.billableHours ? `${proj.billableHours} hrs` : '-';
                const createdOn = proj.createdAt ? new Date(proj.createdAt).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'}) : '-';
                const displayStatus = proj.status || 'In Progress';
                
                let statusBg = '#dcfce7'; let statusColor = '#16a34a';
                if (displayStatus === 'On Hold') { statusBg = '#fef3c7'; statusColor = '#d97706'; }
                else if (displayStatus === 'Completed') { statusBg = '#e0e7ff'; statusColor = '#4f46e5'; }
                else if (displayStatus === 'Pending') { statusBg = '#f1f5f9'; statusColor = '#475569'; }

                return (
                  <tr key={proj.id} style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <input 
                        type="checkbox" 
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#2563eb' }} 
                        checked={selectedProjectIds.includes(proj.id)}
                        onChange={(e) => handleSelectOne(e, proj.id)}
                      />
                    </td>
                    <td style={{ padding: '1rem 1rem', fontSize: '0.85rem', color: '#1e293b', fontWeight: '600' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '1rem 1rem' }}>
                      <button 
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                        onClick={() => {
                          setSelectedProject(proj);
                          setCurrentView('detail');
                        }}
                      >
                        {proj.name}
                      </button>
                    </td>
                    <td style={{ padding: '1rem 1rem', fontSize: '0.85rem', color: '#334155' }}>
                      {client}
                    </td>
                    <td style={{ padding: '1rem 1rem' }}>
                      <span style={{ background: statusBg, color: statusColor, padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>
                        {displayStatus}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1rem', fontSize: '0.85rem', color: '#334155' }}>
                      {estHours}
                    </td>
                    <td style={{ padding: '1rem 1rem', fontSize: '0.85rem', color: '#334155' }}>
                      {actHours}
                    </td>
                    <td style={{ padding: '1rem 1rem', fontSize: '0.85rem', color: '#334155' }}>
                      {bilHours}
                    </td>
                    <td style={{ padding: '1rem 1rem', fontSize: '0.85rem', color: '#334155' }}>
                      {createdOn}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {/* Edit Button */}
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
                              estimatedHours: proj.estimatedHours || 0,
                              actualHours: proj.actualHours || 0,
                              billableHours: proj.billableHours || 0
                            });
                            setShowForm(true);
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        
                        {/* Delete Button */}
                        {(getLevel('projects', 'delete') === 'All' || (getLevel('projects', 'delete') === 'Self' && (user?.fullName || user?.name) && (proj.members || '').toLowerCase().includes((user?.fullName || user?.name).toLowerCase()))) && (
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
        
        {/* Pagination placeholder matching the image */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: 'white' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Showing 1 to {Math.min(10, projects.length || 10)} of {projects.length || 15} entries</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', color: '#64748b', cursor: 'pointer' }}>&lt;</button>
            <button style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '6px', background: '#2563eb', color: 'white', fontWeight: '600', cursor: 'pointer' }}>1</button>
            <button style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', color: '#334155', fontWeight: '600', cursor: 'pointer' }}>2</button>
            <button style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', color: '#64748b', cursor: 'pointer' }}>&gt;</button>
            <select style={{ marginLeft: '1rem', padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', color: '#334155', background: 'white', outline: 'none' }}>
              <option>10 / page</option>
              <option>20 / page</option>
              <option>50 / page</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
