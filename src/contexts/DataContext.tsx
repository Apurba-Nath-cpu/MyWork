
"use client";
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { BoardData, ProjectColumn, Task, UserRole, User, ConfirmationModalState, TaskStatus, TaskPriority } from '../types';
import * as supabaseService from '../services/supabaseService'; 
import { useAuth } from './AuthContext';
import { useToast } from "@/hooks/use-toast";

interface DataContextType {
  boardData: BoardData | null;
  usersForSuggestions: Array<Pick<User, 'id' | 'name' | 'role'>>;
  fetchBoardData: () => Promise<void>;
  addProject: (title: string, maintainerIds: string[]) => Promise<void>;
  updateProject: (updatedProject: ProjectColumn) => Promise<void>;
  addTask: (
    projectId: string, 
    title: string, 
    description: string | undefined, 
    assigneeIds: string[], 
    eta: string | undefined,
    status: TaskStatus,
    priority: TaskPriority,
    tags: string[]
  ) => Promise<void>;
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
  const { toast } = useToast();
  
  const [showAddProjectModal, setShowAddProjectModalState] = useState(false);
  const [showAddTaskModalForProject, setShowAddTaskModalForProjectState] = useState<string | null>(null);
  const [showCreateUserModal, setShowCreateUserModalState] = useState(false);
  const [editingProject, setEditingProjectState] = useState<ProjectColumn | null>(null);
  const [editingTask, setEditingTaskState] = useState<Task | null>(null);
  
  const initialConfirmationState: ConfirmationModalState = {
    isOpen: false,
    title: '',
    message: '',
    onConfirmAction: null,
  };
  const [confirmationModalState, setConfirmationModalState] = useState<ConfirmationModalState>(initialConfirmationState);

  const hideConfirmationModal = useCallback(() => {
    setConfirmationModalState(prev => ({ ...prev, isOpen: false, onConfirmAction: null }));
  }, []);

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
      toast({ title: "Error", description: "Failed to load board data.", variant: "destructive" });
      setBoardData({ tasks: {}, projects: {}, projectOrder: [] }); 
    }
  }, [currentUser, toast]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  useEffect(() => {
    setUsersForSuggestions(authContextUsers.map(u => ({ id: u.id, name: u.name, role: u.role })));
  }, [authContextUsers]);
  
  const addProject = useCallback(async (title: string, maintainerIds: string[]) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
        toast({ title: "Permission Denied", description: "Only Admins can create projects.", variant: "destructive" });
        return;
    }
    if (!boardData) return;
    const orderIndex = boardData.projectOrder.length;
    const newProject = await supabaseService.createProject(title, maintainerIds, orderIndex);
    if (newProject) {
      await fetchBoardData(); 
      setShowAddProjectModalState(false);
      toast({ title: "Project Created", description: `Project "${title}" was successfully created.` });
    } else {
      toast({ title: "Error", description: "Failed to create project.", variant: "destructive" });
    }
  }, [boardData, currentUser, fetchBoardData, toast]);

  const updateProject = useCallback(async (updatedProject: ProjectColumn) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) { 
        toast({ title: "Permission Denied", description: "Only Admins can update projects.", variant: "destructive" });
        return;
    }
    const success = await supabaseService.updateProject(updatedProject);
    if (success) {
      await fetchBoardData(); 
      setEditingProjectState(null); 
      toast({ title: "Project Updated", description: `Project "${updatedProject.title}" was successfully updated.` });
    } else {
        toast({ title: "Error", description: `Failed to update project "${updatedProject.title}".`, variant: "destructive" });
    }
  }, [currentUser, fetchBoardData, toast]);

  const addTask = useCallback(async (
    projectId: string, 
    title: string, 
    description: string | undefined, 
    assigneeIds: string[], 
    eta: string | undefined,
    status: TaskStatus,
    priority: TaskPriority,
    tags: string[]
  ) => {
    if (!boardData) return;
    const project = boardData.projects[projectId];
    if (!project) {
        toast({ title: "Error", description: "Project not found. Cannot add task.", variant: "destructive" });
        return;
    }

    const canAddTaskPermission = currentUser?.role === UserRole.ADMIN || project.maintainerIds.includes(currentUser?.id || '');
    if (!canAddTaskPermission) {
        toast({ title: "Permission Denied", description: "Only Admins or Project Maintainers can add tasks.", variant: "destructive" });
        return;
    }
    const orderIndex = project.taskIds.length; 
    const newTask = await supabaseService.createTask(projectId, title, description, assigneeIds, eta, orderIndex, status, priority, tags);
    if (newTask) {
      await fetchBoardData(); 
      setShowAddTaskModalForProjectState(null);
      toast({ title: "Task Created", description: `Task "${title}" was successfully added to project "${project.title}".` });
    } else {
      toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
    }
  }, [boardData, currentUser, fetchBoardData, toast]);

  const updateTask = useCallback(async (updatedTask: Task) => {
    if (!boardData || !currentUser) return;
    const project = boardData.projects[updatedTask.projectId];
    if (!project) {
        toast({ title: "Error", description: "Project not found for task update.", variant: "destructive" });
        return;
    }
    const canUpdate = currentUser.role === UserRole.ADMIN || project.maintainerIds.includes(currentUser.id);
    if (!canUpdate) {
        toast({ title: "Permission Denied", description: "You do not have permission to update tasks in this project.", variant: "destructive" });
        setEditingTaskState(null); 
        return;
    }

    const success = await supabaseService.updateTask(updatedTask);
    if (success) {
      await fetchBoardData(); 
      setEditingTaskState(null); 
      toast({ title: "Task Updated", description: `Task "${updatedTask.title}" was successfully updated.` });
    } else {
      toast({ title: "Error", description: `Failed to update task "${updatedTask.title}".`, variant: "destructive" });
    }
  }, [boardData, currentUser, fetchBoardData, toast]);
  
  const _deleteTaskInternal = useCallback(async (taskId: string, projectId: string) => {
    if (!boardData || !currentUser) {
      hideConfirmationModal();
      return;
    }
    const project = boardData.projects[projectId];
    if (!project) {
      toast({ title: "Error", description: "Project not found for task deletion.", variant: "destructive" });
      hideConfirmationModal();
      return;
    }
    
    const canDelete = currentUser.role === UserRole.ADMIN || project.maintainerIds.includes(currentUser.id);
    if (!canDelete) {
        toast({ title: "Permission Denied", description: "You do not have permission to delete tasks in this project.", variant: "destructive" });
        hideConfirmationModal();
        return;
    }
    const success = await supabaseService.deleteTask(taskId);
     if (success) {
      await fetchBoardData();
      toast({ title: "Task Deleted", description: `Task was successfully deleted.` });
    } else {
        toast({ title: "Error", description: `Failed to delete task.`, variant: "destructive" });
    }
    hideConfirmationModal();
  }, [boardData, currentUser, fetchBoardData, hideConfirmationModal, toast]);
  
  const _deleteProjectInternal = useCallback(async (projectId: string) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
        toast({ title: "Permission Denied", description: "Only Admins can delete projects.", variant: "destructive" });
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
        toast({ title: "Project Deleted", description: `Project "${projectTitle}" and its tasks were successfully deleted.` });
    } else {
        toast({ title: "Error", description: `Failed to delete project "${projectTitle}".`, variant: "destructive" });
    }
    hideConfirmationModal();
  }, [currentUser, boardData, fetchBoardData, hideConfirmationModal, toast]);

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
      toast({ title: "Error", description: "Failed to save project order.", variant: "destructive" });
      await fetchBoardData(); 
    }
  }, [boardData, fetchBoardData, toast]);

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
      toast({ title: "Error", description: "Failed to save task order.", variant: "destructive" });
      await fetchBoardData(); 
    }
  }, [boardData, fetchBoardData, toast]);

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
      toast({ title: "Error", description: "Failed to save task move and reorder.", variant: "destructive" });
      await fetchBoardData(); 
    }
  }, [boardData, fetchBoardData, toast]);
  
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
