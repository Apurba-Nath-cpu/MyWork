
"use client";
import React, { useCallback, useEffect } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import type { DroppableProvided, DroppableStateSnapshot } from '@hello-pangea/dnd';
import type { DropResult, ProjectColumn, Task } from '../types'; 
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
    confirmationModalState,
    hideConfirmationModal,
    handleConfirmDeletion
  } = useData();

  useEffect(() => {
    if (currentUser && !loadingAuth && currentUser.organization_id) {
      fetchBoardData();
    }
  }, [currentUser, loadingAuth, fetchBoardData]);

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
        <div className="p-4 text-center text-lg text-foreground">Authenticating...</div>
        <svg className="animate-spin h-8 w-8 text-primary mt-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />; 
  }

  if (!boardData) {
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

  return (
    <div className={`flex flex-col h-screen font-sans ${theme} bg-background text-foreground`}>
      <Navbar />
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
                className={`flex w-max space-x-4 items-start p-2 ${snapshot.isDraggingOver ? 'bg-neutral-200 dark:bg-neutral-800' : ''}`}
              >
                {boardData.projectOrder.map((projectId: string, index: number) => {
                  const project: ProjectColumn | undefined = boardData.projects[projectId];
                  if (!project) {
                    return null; 
                  }
                  const tasks: Task[] = project.taskIds
                    .map((taskId: string): Task | undefined => boardData.tasks[taskId])
                    .filter((task?: Task): task is Task => !!task); 
                  
                  return (
                    <ProjectColumnComponent
                      key={project.id}
                      project={project} 
                      tasks={tasks}
                      index={index}
                    />
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </DragDropContext>
      {showAddProjectModal && <AddProjectModal />}
      {showAddTaskModalForProject && <AddTaskModal projectId={showAddTaskModalForProject} />}
      {showCreateUserModal && <CreateUserModal />}
      {showManageAccessModal && <ManageUserAccessModal />}
      {editingProject && <EditProjectModal project={editingProject} />}
      {editingTask && <EditTaskModal task={editingTask} />}
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
