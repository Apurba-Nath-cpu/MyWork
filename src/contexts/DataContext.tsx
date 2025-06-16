
"use client";
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { BoardData, ProjectColumn, Task, UserRole, User, ConfirmationModalState } from '../types';
import * as supabaseService from '../services/supabaseService'; 
import { useAuth } from './AuthContext';

interface DataContextType {
  boardData: BoardData | null;
  usersForSuggestions: Array<Pick<User, 'id' | 'name' | 'role'>>;
  fetchBoardData: () => Promise<void>;
  addProject: (title: string, maintainerIds: string[]) => Promise<void>;
  updateProject: (updatedProject: ProjectColumn) => Promise<void>;
  addTask: (projectId: string, title: string, description: string | undefined, assigneeIds: string[], eta: string | undefined) => Promise<void>;
  moveProject: (projectId: string, newIndex: number) => Promise<void>;
  moveTaskWithinProject: (projectId: string, taskId: string, newIndex: number) => Promise<void>;
  moveTaskBetweenProjects: (startProjectId: string, finishProjectId: string, taskId: string, newIndex: number) => Promise<void>;
  updateTask: (updatedTask: Task) => Promise<void>;
  
  showAddProjectModal: boolean;
  setShowAddProjectModal: (show: boolean) => void;
  showAddTaskModalForProject: string | null; // projectId or null
  setShowAddTaskModalForProject: (projectId: string | null) => void;
  showCreateUserModal: boolean;
  setShowCreateUserModal: (show: boolean) => void;

  editingProject: ProjectColumn | null;
  setEditingProject: (project: ProjectColumn | null) => void;
  editingTask: Task | null;
  setEditingTask: (task: Task | null) => void;

  confirmationModalState: ConfirmationModalState;
  showConfirmationModal: (title: string, message: string, onConfirmAction: () => void, confirmText?: string, cancelText?: string) => void;
  hideConfirmationModal: () => void;
  handleConfirmDeletion: () => void; 

  requestProjectDeletion: (projectId: string) => void;
  requestTaskDeletion: (taskId: string, projectId: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [usersForSuggestions, setUsersForSuggestions] = useState<Array<Pick<User, 'id' | 'name' | 'role'>>>([]);
  const { users: authContextUsers, currentUser } = useAuth(); 
  
  const [showAddProjectModal, setShowAddProjectModalState] = useState(false);
  const [showAddTaskModalForProject, setShowAddTaskModalForProjectState] = useState<string | null>(null);
  const [showCreateUserModal, setShowCreateUserModalState] = useState(false);
  const [editingProject, setEditingProjectState] = useState<ProjectColumn | null>(null);
  const [editingTask, setEditingTaskState] = useState<Task | null>(null);
  const [confirmationModalState, setConfirmationModalState] = useState<ConfirmationModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirmAction: null,
  });


  const fetchBoardData = useCallback(async () => {
    if (!currentUser) { 
      setBoardData(null); 
      return;
    }
    try {
      const data = await supabaseService.getBoardData();
      setBoardData(data);
    } catch (error) {
      console.error("Failed to fetch board data from Supabase:", error);
      setBoardData({ tasks: {}, projects: {}, projectOrder: [] }); 
    }
  }, [currentUser]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  useEffect(() => {
    setUsersForSuggestions(authContextUsers.map(u => ({ id: u.id, name: u.name, role: u.role })));
  }, [authContextUsers]);
  
  const addProject = useCallback(async (title: string, maintainerIds: string[]) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
        alert("Only Admins can create projects.");
        return;
    }
    if (!boardData) return;
    const orderIndex = boardData.projectOrder.length;
    const newProject = await supabaseService.createProject(title, maintainerIds, orderIndex);
    if (newProject) {
      await fetchBoardData(); 
      setShowAddProjectModalState(false);
    } else {
      alert("Failed to create project on Supabase.");
    }
  }, [boardData, currentUser, fetchBoardData]);

  const updateProject = useCallback(async (updatedProject: ProjectColumn) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) { 
        alert("Only Admins can update projects.");
        return;
    }
    const success = await supabaseService.updateProject(updatedProject);
    if (success) {
      await fetchBoardData(); 
      setEditingProjectState(null); 
    } else {
        alert(`Failed to update project "${updatedProject.title}" on Supabase.`);
    }
  }, [currentUser, fetchBoardData]);

  const addTask = useCallback(async (projectId: string, title: string, description: string | undefined, assigneeIds: string[], eta: string | undefined) => {
    if (!boardData) return;
    const project = boardData.projects[projectId];
    if (!project) {
        alert("Project not found. Cannot add task.");
        return;
    }

    const canAddTaskPermission = currentUser?.role === UserRole.ADMIN || project.maintainerIds.includes(currentUser?.id || '');
    if (!canAddTaskPermission) {
        alert("Only Admins or Project Maintainers can add tasks to this project.");
        return;
    }
    const orderIndex = project.taskIds.length; 
    const newTask = await supabaseService.createTask(projectId, title, description, assigneeIds, eta, orderIndex);
    if (newTask) {
      await fetchBoardData(); 
      setShowAddTaskModalForProjectState(null);
    } else {
      alert("Failed to create task on Supabase.");
    }
  }, [boardData, currentUser, fetchBoardData]);

  const updateTask = useCallback(async (updatedTask: Task) => {
    if (!boardData || !currentUser) return;
    const project = boardData.projects[updatedTask.projectId];
    if (!project) {
        alert("Project not found for task update.");
        return;
    }
    const canUpdate = currentUser.role === UserRole.ADMIN || project.maintainerIds.includes(currentUser.id);
    if (!canUpdate) {
        alert("You do not have permission to update tasks in this project.");
        setEditingTaskState(null); 
        return;
    }

    const success = await supabaseService.updateTask(updatedTask);
    if (success) {
      await fetchBoardData(); 
      setEditingTaskState(null); 
    } else {
      alert(`Failed to update task "${updatedTask.title}" on Supabase.`);
    }
  }, [boardData, currentUser, fetchBoardData]);

  const hideConfirmationModal = useCallback(() => {
    setConfirmationModalState(prev => ({ ...prev, isOpen: false, onConfirmAction: null }));
  }, []);

  const _deleteTaskInternal = useCallback(async (taskId: string, projectId: string) => {
    if (!boardData || !currentUser) {
      hideConfirmationModal();
      return;
    }
    const project = boardData.projects[projectId];
    if (!project) {
      hideConfirmationModal();
      return;
    }
    
    const canDelete = currentUser.role === UserRole.ADMIN || project.maintainerIds.includes(currentUser.id);
    if (!canDelete) {
        alert("You do not have permission to delete tasks in this project.");
        hideConfirmationModal();
        return;
    }
    const success = await supabaseService.deleteTask(taskId);
     if (success) {
      await fetchBoardData();
    } else {
        alert(`Failed to delete task from Supabase.`);
    }
    hideConfirmationModal();
  }, [boardData, currentUser, fetchBoardData, hideConfirmationModal]);
  
  const _deleteProjectInternal = useCallback(async (projectId: string) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
        alert("Only Admins can delete projects.");
        hideConfirmationModal();
        return;
    }
    if (!boardData) {
      hideConfirmationModal();
      return;
    }
    const projectTitle = boardData.projects[projectId]?.title || projectId;

    const success = await supabaseService.deleteProject(projectId);
    if (success) {
        await fetchBoardData(); 
    } else {
        alert(`Failed to delete project "${projectTitle}" from Supabase.`);
    }
    hideConfirmationModal();
  }, [currentUser, boardData, fetchBoardData, hideConfirmationModal]);

  const showConfirmationModal = useCallback((title: string, message: string, onConfirmAction: () => void, confirmText = 'Confirm', cancelText = 'Cancel') => {
    setConfirmationModalState({ isOpen: true, title, message, onConfirmAction, confirmText, cancelText });
  }, []);

  const handleConfirmDeletion = useCallback(() => {
    if (confirmationModalState.onConfirmAction) {
      confirmationModalState.onConfirmAction();
    }
  }, [confirmationModalState]);

  const requestProjectDeletion = useCallback((projectId: string) => {
    const projectTitle = boardData?.projects[projectId]?.title || 'this project';
    showConfirmationModal(
      'Delete Project',
      `Are you sure you want to delete project "${projectTitle}" and all its tasks? This action cannot be undone.`,
      () => _deleteProjectInternal(projectId), 'Delete Project', 'Cancel'
    );
  }, [boardData, showConfirmationModal, _deleteProjectInternal]);

  const requestTaskDeletion = useCallback((taskId: string, projectId: string) => {
    const taskTitle = boardData?.tasks[taskId]?.title || 'this task';
    showConfirmationModal(
      'Delete Task',
      `Are you sure you want to delete task "${taskTitle}"?`,
      () => _deleteTaskInternal(taskId, projectId), 'Delete Task', 'Cancel'
    );
  }, [boardData, showConfirmationModal, _deleteTaskInternal]);

  const moveProject = useCallback(async (projectId: string, newIndex: number) => {
    if (!boardData) return;
    const newProjectOrder = Array.from(boardData.projectOrder);
    const oldIndex = newProjectOrder.indexOf(projectId);
    newProjectOrder.splice(oldIndex, 1);
    newProjectOrder.splice(newIndex, 0, projectId);
    
    setBoardData(prev => prev ? { ...prev, projectOrder: newProjectOrder } : null);

    const success = await supabaseService.updateProjectOrder(newProjectOrder);
    if (!success) {
      alert("Failed to save project order to Supabase.");
      await fetchBoardData(); 
    }
  }, [boardData, fetchBoardData]);

  const moveTaskWithinProject = useCallback(async (projectId: string, taskId: string, newIndex: number) => {
    if (!boardData || !boardData.projects[projectId]) return;
    
    const project = boardData.projects[projectId];
    const newTaskIds = Array.from(project.taskIds);
    const oldIndex = newTaskIds.indexOf(taskId);
    newTaskIds.splice(oldIndex, 1);
    newTaskIds.splice(newIndex, 0, taskId);

    setBoardData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        projects: {
          ...prev.projects,
          [projectId]: { ...prev.projects[projectId], taskIds: newTaskIds },
        },
      };
    });

    const success = await supabaseService.updateTaskOrderInProject(projectId, newTaskIds);
    if (!success) {
      alert("Failed to save task order to Supabase.");
      await fetchBoardData(); 
    }
  }, [boardData, fetchBoardData]);

  const moveTaskBetweenProjects = useCallback(async (startProjectId: string, finishProjectId: string, taskId: string, newIndexInFinish: number) => {
    if (!boardData || !boardData.tasks[taskId] || !boardData.projects[startProjectId] || !boardData.projects[finishProjectId]) return;
    
    const newBoardDataOptimistic = JSON.parse(JSON.stringify(boardData)) as BoardData;
    
    newBoardDataOptimistic.projects[startProjectId].taskIds = newBoardDataOptimistic.projects[startProjectId].taskIds.filter(id => id !== taskId);
    
    newBoardDataOptimistic.projects[finishProjectId].taskIds.splice(newIndexInFinish, 0, taskId);
    newBoardDataOptimistic.tasks[taskId] = { ...newBoardDataOptimistic.tasks[taskId], projectId: finishProjectId };

    setBoardData(newBoardDataOptimistic);

    const finalTaskIdsInFinishProject = newBoardDataOptimistic.projects[finishProjectId].taskIds;
    const successMove = await supabaseService.updateTaskProjectAndOrder(taskId, finishProjectId, finalTaskIdsInFinishProject);
    
    const finalTaskIdsInStartProject = newBoardDataOptimistic.projects[startProjectId].taskIds;
    const successOldOrder = await supabaseService.updateTaskOrderInProject(startProjectId, finalTaskIdsInStartProject);

    if (!successMove || !successOldOrder) {
      alert("Failed to save task move and reorder to Supabase.");
      await fetchBoardData(); 
    }
  }, [boardData, fetchBoardData]);
  
  const setShowAddProjectModal = useCallback((show: boolean) => setShowAddProjectModalState(show), []);
  const setShowAddTaskModalForProject = useCallback((projectId: string | null) => {
    setShowAddTaskModalForProjectState(projectId);
  }, []);
  const setShowCreateUserModal = useCallback((show: boolean) => setShowCreateUserModalState(show), []);
  const setEditingProject = useCallback((project: ProjectColumn | null) => setEditingProjectState(project), []);
  const setEditingTask = useCallback((task: Task | null) => setEditingTaskState(task), []);

  return (
    <DataContext.Provider value={{
      boardData, usersForSuggestions, fetchBoardData, addProject, updateProject, addTask,
      moveProject, moveTaskWithinProject, moveTaskBetweenProjects, updateTask,
      showAddProjectModal, setShowAddProjectModal, showAddTaskModalForProject, setShowAddTaskModalForProject,
      showCreateUserModal, setShowCreateUserModal, editingProject, setEditingProject, editingTask, setEditingTask,
      confirmationModalState, showConfirmationModal, hideConfirmationModal, handleConfirmDeletion,
      requestProjectDeletion, requestTaskDeletion
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) throw new Error('useData must be used within a DataProvider');
  return context;
};

