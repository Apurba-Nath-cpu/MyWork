
"use client";
import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import type { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import { Task, UserRole } from '../types'; 
import { useAuth } from '../contexts/AuthContext';
import { UserCircleIcon, CalendarDaysIcon, TrashIcon, PencilIcon } from './custom-icons'; 
import { useData } from '../contexts/DataContext';


interface TaskCardProps {
  task: Task;
  index: number; 
}

const TaskCard: React.FC<TaskCardProps> = ({ task, index }) => {
  const { users, currentUser } = useAuth(); 
  const { requestTaskDeletion, setEditingTask, boardData } = useData();

  const getAssigneeName = (userId: string) => users.find(u => u.id === userId)?.name || 'Unknown';
  
  const project = boardData?.projects[task.projectId];
  const canModifyTask = currentUser?.role === UserRole.ADMIN || (project?.maintainerIds.includes(currentUser?.id || ''));

  const handleDelete = () => {
    if (!canModifyTask) {
        alert("Permission denied: You cannot delete this task.");
        return;
    }
    requestTaskDeletion(task.id, task.projectId);
  };

  const handleEdit = () => {
    setEditingTask(task);
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white dark:bg-neutral-700 p-3 mb-3 rounded shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing
                      ${snapshot.isDragging ? 'border-2 border-primary-500 dark:border-primary-400 ring-2 ring-primary-500' : ''}`}
        >
          <div className="flex justify-between items-start mb-1">
            <h4 className="font-medium text-neutral-800 dark:text-neutral-100 break-all pr-2">{task.title}</h4>
            <div className="flex-shrink-0 flex items-center">
              {canModifyTask && (
                <button 
                    onClick={handleEdit}
                    className="text-neutral-400 hover:text-primary-500 dark:text-neutral-500 dark:hover:text-primary-400 p-1"
                    title="Edit task"
                    aria-label={`Edit task ${task.title}`}
                >
                    <PencilIcon className="w-4 h-4" />
                </button>
              )}
              {canModifyTask && (
                <button 
                    onClick={handleDelete}
                    className="text-neutral-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-500 p-1 ml-1"
                    title="Delete task"
                    aria-label={`Delete task ${task.title}`}
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {task.description && <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-2 break-words">{task.description}</p>}
          <div className="flex items-center text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            <CalendarDaysIcon className="w-3 h-3 mr-1" />
            <span>ETA: {task.eta ? new Date(task.eta).toLocaleDateString() : 'Not set'}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {task.assigneeIds.map(assigneeId => {
              const assignee = users.find(u => u.id === assigneeId);
              return (
                <div key={assigneeId} title={getAssigneeName(assigneeId)} className="flex items-center bg-neutral-200 dark:bg-neutral-600 rounded-full px-2 py-0.5 text-xs">
                  {assignee?.avatarUrl ? (
                    <img src={assignee.avatarUrl} alt={assignee.name} className="w-4 h-4 rounded-full mr-1 object-cover" />
                  ) : (
                    <UserCircleIcon className="w-4 h-4 mr-1" />
                  )}
                  <span className="truncate max-w-[80px] text-neutral-700 dark:text-neutral-200">{getAssigneeName(assigneeId).split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;
