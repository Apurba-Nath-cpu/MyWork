
"use client";
import React from 'react';
import { Draggable, Droppable } from 'react-beautiful-dnd';
import type { DraggableProvided, DroppableProvided, DraggableStateSnapshot, DroppableStateSnapshot } from 'react-beautiful-dnd';
import type { ProjectColumn, Task } from '../types';
import TaskCard from './TaskCard';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { UserRole } from '../types';
import { PlusIcon, TrashIcon, PencilIcon } from './custom-icons';
import { DROPPABLE_TYPE_TASK } from '../lib/constants';

interface ProjectColumnProps {
  project: ProjectColumn;
  tasks: Task[];
  index: number; 
}

const ProjectColumnComponent: React.FC<ProjectColumnProps> = ({ project, tasks, index }) => {
  const { currentUser } = useAuth();
  const { setShowAddTaskModalForProject, requestProjectDeletion, setEditingProject } = useData();

  const canAddTask = currentUser?.role === UserRole.ADMIN || 
                     (project && Array.isArray(project.maintainerIds) && project.maintainerIds.includes(currentUser?.id || ""));
  const canEditProject = currentUser?.role === UserRole.ADMIN;
  const canDeleteProject = currentUser?.role === UserRole.ADMIN;


  const handleDeleteProject = () => {
    if (!canDeleteProject) {
        alert("Permission denied: Only Admins can delete projects.");
        return;
    }
    requestProjectDeletion(project.id);
  };

  const handleEditProject = () => {
    if (!canEditProject) {
        alert("Permission denied: Only Admins can edit projects.");
        return;
    }
    setEditingProject(project);
  };

  return (
    <Draggable draggableId={project.id} index={index}>
      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
        <div
          {...provided.draggableProps}
          ref={provided.innerRef}
          className="bg-neutral-200 dark:bg-neutral-800 rounded-lg p-3 shadow-lg w-80 flex-shrink-0 flex flex-col"
        >
          <div className="flex items-center justify-between mb-3 p-1">
            <div {...provided.dragHandleProps} className="text-lg font-semibold cursor-grab active:cursor-grabbing flex-grow break-all pr-2 text-neutral-800 dark:text-neutral-100">
              {project.title}
            </div>
            <div className="flex items-center flex-shrink-0">
              {canEditProject && (
                <button
                  onClick={handleEditProject}
                  className="p-1 text-neutral-500 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-500 transition-colors"
                  title={`Edit project "${project.title}"`}
                  aria-label={`Edit project ${project.title}`}
                >
                  <PencilIcon className="w-5 h-5" />
                </button>
              )}
              {canDeleteProject && (
                <button
                  onClick={handleDeleteProject}
                  className="ml-1 p-1 text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-500 transition-colors"
                  title={`Delete project "${project.title}"`}
                  aria-label={`Delete project ${project.title}`}
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          
          <Droppable 
            droppableId={project.id} 
            type={DROPPABLE_TYPE_TASK}
            isDropDisabled={false} 
            isCombineEnabled={false} 
            ignoreContainerClipping={false}
          >
            {(providedDroppable: DroppableProvided, snapshotDroppable: DroppableStateSnapshot) => (
              <div
                ref={providedDroppable.innerRef}
                {...providedDroppable.droppableProps}
                style={{scrollbarWidth: 'none'}}
                className={`flex-grow p-1 rounded min-h-[60px] ${snapshotDroppable.isDraggingOver ? 'bg-primary-100 dark:bg-primary-700' : 'bg-neutral-100 dark:bg-neutral-700'} 
                            overflow-y-auto max-h-[calc(100vh-20rem)] 
                            dark:scrollbar-thumb-neutral-600 dark:hover:scrollbar-thumb-neutral-500`}
              >
                {tasks.map((task, taskIndex) => (
                  <TaskCard key={task.id} task={task} index={taskIndex} />
                ))}
                {providedDroppable.placeholder}
                 {tasks.length === 0 && !snapshotDroppable.isDraggingOver && (
                  <p className="text-xs text-center text-neutral-400 dark:text-neutral-500 py-4">No tasks yet. Drag tasks here or add a new one.</p>
                )}
              </div>
            )}
          </Droppable>

          {canAddTask && (
            <button
              onClick={() => setShowAddTaskModalForProject(project.id)}
              className="mt-3 flex items-center justify-center p-2 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded transition-colors w-full"
              aria-label={`Add task to ${project.title}`}
            >
              <PlusIcon className="w-4 h-4 mr-1" /> Add Task
            </button>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default ProjectColumnComponent;
