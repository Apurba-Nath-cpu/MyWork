"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import type { DroppableProvided, DroppableStateSnapshot } from '@hello-pangea/dnd';
import type { DropResult, ProjectColumn, Task } from '../types'; 
import { UserRole } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext'; 
import { useData } from '../contexts/DataContext';
import Navbar from '../components/Navbar';
import ProjectColumnComponent from '../components/ProjectColumn';
import { DROPPABLE_TYPE_PROJECT } from '../lib/constants';
import AddProjectModal from '../components/AddProjectModal';
import AddTaskModal from '../components/AddTaskModal';
import CreateUserModal from '../components/CreateUserModal';
import EditProjectModal from '../components/EditProjectModal';
import EditTaskModal from '../components/EditTaskModal';
import ConfirmationModal from '../components/ConfirmationModal';
import AuthScreen from '../components/AuthScreen';
import ManageUserAccessModal from '../components/ManageUserAccessModal';
import CommentsModal from '../components/CommentsModal';

const HomePage: React.FC = () => {
  const { theme } = useTheme();
  const { currentUser, loadingAuth } = useAuth(); 
  const { 
    boardData, 
    fetchBoardData, 
    moveProject, 
    moveTaskWithinProject, 
    moveTaskBetweenProjects, 
    showAddProjectModal, 
    showAddTaskModalForProject, 
    showCreateUserModal,
    showManageAccessModal,
    editingProject,
    editingTask,
    viewingTaskComments,
    setViewingTaskComments,
    confirmationModalState,
    hideConfirmationModal,
    handleConfirmDeletion,
    searchTerm,
    isFocusMode,
  } = useData();

  // Add a state to track how long we've been loading
  const [loadingDuration, setLoadingDuration] = useState(0);
  const [forceShowApp, setForceShowApp] = useState(false);

  useEffect(() => {
    if (loadingAuth) {
      const interval = setInterval(() => {
        setLoadingDuration(prev => {
          const newDuration = prev + 1;
          // After 10 seconds, offer to force show the app
          if (newDuration >= 10) {
            setForceShowApp(true);
          }
          return newDuration;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setLoadingDuration(0);
      setForceShowApp(false);
    }
  }, [loadingAuth]);

  useEffect(() => {
    if (currentUser && !loadingAuth && currentUser.organization_id) {
      fetchBoardData();
    }
  }, [currentUser, loadingAuth, fetchBoardData]);
  
  const filteredBoardData = useMemo(() => {
    if (!boardData || !currentUser) return null;

    // 1. Apply Focus Mode filter if active
    let baseData = boardData;
    if (isFocusMode) {
      const focusedProjects: Record<string, ProjectColumn> = {};
      const focusedProjectOrder: string[] = [];

      boardData.projectOrder.forEach(projectId => {
        const project = boardData.projects[projectId];
        if (!project) return;

        const relevantTaskIds = project.taskIds.filter(taskId => {
          const task = boardData.tasks[taskId];
          if (!task) return false;

          const isAssigned = task.assigneeIds.includes(currentUser.id);
          const isMentioned = boardData.mentionedTaskIds?.has(taskId) ?? false;
          return isAssigned || isMentioned;
        });

        if (relevantTaskIds.length > 0) {
          focusedProjects[projectId] = {
            ...project,
            taskIds: relevantTaskIds,
          };
          focusedProjectOrder.push(projectId);
        }
      });
      
      baseData = {
        ...boardData,
        projects: focusedProjects,
        projectOrder: focusedProjectOrder,
      };
    }

    // 2. Apply Search Term filter on top of the (potentially focused) data
    if (!searchTerm) return baseData;
    
    const lowercasedTerm = searchTerm.toLowerCase();
    const searchedProjects: Record<string, ProjectColumn> = {};
    const searchedProjectOrder: string[] = [];

    baseData.projectOrder.forEach(projectId => {
      const project = baseData.projects[projectId];
      if (!project) return;
      
      const projectTitleMatches = project.title.toLowerCase().includes(lowercasedTerm);
      
      const matchingTasksInProject = project.taskIds.filter(taskId => {
        const task = baseData.tasks[taskId];
        return task && task.title.toLowerCase().includes(lowercasedTerm);
      });

      if (projectTitleMatches) {
        searchedProjects[project.id] = { ...project }; 
        searchedProjectOrder.push(project.id);
      } else if (matchingTasksInProject.length > 0) {
        searchedProjects[project.id] = {
          ...project,
          taskIds: matchingTasksInProject,
        };
        searchedProjectOrder.push(project.id);
      }
    });
    
    return {
      ...baseData,
      projects: searchedProjects,
      projectOrder: searchedProjectOrder,
    };

  }, [boardData, currentUser, isFocusMode, searchTerm]);

  const onDragEnd = useCallback((result: DropResult) => {
    if (!currentUser) {
      return;
    }

    const { destination, source, draggableId, type } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (!boardData || !boardData.projects || !boardData.tasks || !Array.isArray(boardData.projectOrder)) {
        fetchBoardData(); 
        return;
    }

    if (type === DROPPABLE_TYPE_PROJECT) {
      if (!currentUser) { 
        return;
      }
      if (!boardData.projects[draggableId] || !boardData.projectOrder.includes(draggableId)) {
          fetchBoardData(); 
          return;
      }
      moveProject(draggableId, destination.index);
      return;
    }

    if (type === 'TASK') {
      if (!boardData.tasks[draggableId]) {
          fetchBoardData(); 
          return;
      }
      if (!boardData.projects[source.droppableId] || (destination.droppableId && !boardData.projects[destination.droppableId])) {
           fetchBoardData(); 
           return;
      }

      const startProjectId = source.droppableId;
      const finishProjectId = destination.droppableId;
      if (startProjectId === finishProjectId) {
        if (!boardData.projects[startProjectId]?.taskIds.includes(draggableId)) {
            fetchBoardData();
            return;
        }
        moveTaskWithinProject(startProjectId, draggableId, destination.index);
      } else {
        if (!boardData.projects[startProjectId]?.taskIds.includes(draggableId)) {
            fetchBoardData();
            return;
        }
        moveTaskBetweenProjects(startProjectId, finishProjectId, draggableId, destination.index);
      }
    }
  }, [currentUser, moveProject, moveTaskWithinProject, moveTaskBetweenProjects, boardData, fetchBoardData]); 
  
  if (loadingAuth) {
    return (
      <div className={`flex flex-col h-screen font-sans ${theme} items-center justify-center`}>
        <div className="p-4 text-center text-lg text-foreground">
          Authenticating...
          {loadingDuration > 5 && (
            <div className="mt-2 text-sm text-muted-foreground">
              This is taking longer than usual ({loadingDuration}s)
            </div>
          )}
          {loadingDuration > 10 && (
            <div className="mt-2 text-sm text-destructive">
              If this continues, try refreshing the page
            </div>
          )}
        </div>
        <svg className="animate-spin h-8 w-8 text-primary mt-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {loadingDuration > 8 && (
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Refresh Page
          </button>
        )}
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />; 
  }

  if (!filteredBoardData) {
    return (
      <div className={`flex flex-col h-screen font-sans ${theme} bg-background text-foreground`}>
        <Navbar />
        <div className="p-4 text-center text-lg">Loading board data...</div>
         <div className="flex items-center justify-center mt-4">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
      </div>
    );
  }

  const noProjectsExist = boardData && boardData.projectOrder.length === 0;
  const hasProjectsButNoneMatch = boardData && boardData.projectOrder.length > 0 && filteredBoardData.projectOrder.length === 0;

  return (
    <div className={`flex flex-col h-screen font-sans ${theme} bg-background text-foreground`}>
      <Navbar />

      <div className="flex-grow flex flex-col overflow-hidden">
        {noProjectsExist ? (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center text-neutral-500 dark:text-neutral-400">
              <h3 className="text-lg font-semibold">No Projects Yet</h3>
              {currentUser && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.ORG_MAINTAINER) ? (
                  <p>Create your first project to get started.</p>
              ) : (
                  <p>No projects have been created yet. Please contact an administrator.</p>
              )}
            </div>
          </div>
        ) : hasProjectsButNoneMatch ? (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center text-neutral-500 dark:text-neutral-400">
              <h3 className="text-lg font-semibold">
                {isFocusMode && !searchTerm ? "No Tasks in Focus" : "No Results Found"}
              </h3>
              <p>
                {isFocusMode && !searchTerm
                  ? "You have no assigned tasks or mentions."
                  : "Try adjusting your search term or turning off Focus Mode."}
              </p>
            </div>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex-grow p-4 overflow-x-auto hide-scrollbar">
              <Droppable
                droppableId="all-projects"
                direction="horizontal"
                type={DROPPABLE_TYPE_PROJECT}
              >
                {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex w-max space-x-4 items-start p-2 ${
                      snapshot.isDraggingOver
                        ? 'bg-neutral-200 dark:bg-neutral-800'
                        : ''
                    }`}
                  >
                    {filteredBoardData.projectOrder.map(
                      (projectId: string, index: number) => {
                        const project: ProjectColumn | undefined =
                          filteredBoardData.projects[projectId];
                        if (!project) {
                          return null;
                        }
                        const tasks: Task[] = project.taskIds
                          .map(
                            (taskId: string): Task | undefined =>
                              boardData?.tasks[taskId]
                          ) // Use original boardData for full task info
                          .filter((task?: Task): task is Task => !!task);

                        return (
                          <ProjectColumnComponent
                            key={project.id}
                            project={project}
                            tasks={tasks}
                            index={index}
                          />
                        );
                      }
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </DragDropContext>
        )}
      </div>
      
      {showAddProjectModal && <AddProjectModal />}
      {showAddTaskModalForProject && <AddTaskModal projectId={showAddTaskModalForProject} />}
      {showCreateUserModal && <CreateUserModal />}
      {showManageAccessModal && <ManageUserAccessModal />}
      {editingProject && <EditProjectModal project={editingProject} />}
      {editingTask && <EditTaskModal task={editingTask} />}
      {viewingTaskComments && <CommentsModal task={viewingTaskComments} onClose={() => setViewingTaskComments(null)} />}
      {confirmationModalState.isOpen && (
        <ConfirmationModal
          isOpen={confirmationModalState.isOpen}
          title={confirmationModalState.title}
          message={confirmationModalState.message}
          onConfirm={handleConfirmDeletion}
          onCancel={hideConfirmationModal}
          confirmText={confirmationModalState.confirmText}
          cancelText={confirmationModalState.cancelText}
        />
      )}
    </div>
  );
};

export default HomePage;
