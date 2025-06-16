
"use client";
import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import type { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';
import { Task, UserRole, TaskStatus, TaskPriority } from '../types'; 
import { useAuth } from '../contexts/AuthContext';
import { UserCircleIcon, CalendarDaysIcon, TrashIcon, PencilIcon, TagIcon, ExclamationTriangleIcon, CheckCircleIcon, CircleIcon, ClockIcon } from './custom-icons'; 
import { useData } from '../contexts/DataContext';
import { Badge } from "@/components/ui/badge"; 
import { cn } from "@/lib/utils";


interface TaskCardProps {
  task: Task;
  index: number; 
}

const getStatusIcon = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.TODO:
      return <CircleIcon className="w-3 h-3 mr-1" />;
    case TaskStatus.IN_PROGRESS:
      return <ClockIcon className="w-3 h-3 mr-1 text-blue-500" />;
    case TaskStatus.DONE:
      return <CheckCircleIcon className="w-3 h-3 mr-1 text-green-500" />;
    case TaskStatus.BLOCKED:
      return <ExclamationTriangleIcon className="w-3 h-3 mr-1 text-red-500" />; // Changed from AlertTriangleIcon
    default:
      return <CircleIcon className="w-3 h-3 mr-1" />;
  }
};

const getPriorityClasses = (priority: TaskPriority): string => {
  switch (priority) {
    case TaskPriority.P0:
      return "border-red-500 text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900";
    case TaskPriority.P1:
      return "border-orange-500 text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900";
    case TaskPriority.P2:
      return "border-yellow-500 text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900";
    case TaskPriority.P3:
      return "border-green-500 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900";
    default:
      return "border-neutral-300 dark:border-neutral-600";
  }
};


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
          className={cn(
            `bg-card text-card-foreground p-3 mb-3 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-grab active:cursor-grabbing border-l-4`,
            snapshot.isDragging ? 'ring-2 ring-primary dark:ring-primary-foreground' : '',
            getPriorityClasses(task.priority || TaskPriority.P3) // Border color based on priority
          )}
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-neutral-800 dark:text-neutral-100 break-all pr-2">{task.title}</h4>
            <div className="flex-shrink-0 flex items-center">
              {canModifyTask && (
                <button 
                    onClick={handleEdit}
                    className="text-neutral-500 hover:text-primary p-1 dark:text-neutral-400 dark:hover:text-primary-light"
                    title="Edit task"
                    aria-label={`Edit task ${task.title}`}
                >
                    <PencilIcon className="w-4 h-4" />
                </button>
              )}
              {canModifyTask && (
                <button 
                    onClick={handleDelete}
                    className="text-neutral-500 hover:text-destructive p-1 ml-1 dark:text-neutral-400 dark:hover:text-destructive-light"
                    title="Delete task"
                    aria-label={`Delete task ${task.title}`}
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {task.description && <p className="text-xs text-muted-foreground mb-2 break-words">{task.description}</p>}
          
          <div className="flex flex-col space-y-2 text-xs text-muted-foreground mb-3">
            <div className="flex items-center">
              {getStatusIcon(task.status || TaskStatus.TODO)}
              <span>{task.status || TaskStatus.TODO}</span>
            </div>
            <div className="flex items-center">
              <CalendarDaysIcon className="w-3 h-3 mr-1" />
              <span>ETA: {task.eta ? new Date(task.eta).toLocaleDateString() : 'Not set'}</span>
            </div>
             <div className="flex items-center">
              <Badge variant="outline" className={cn("text-xs px-1.5 py-0.5", getPriorityClasses(task.priority || TaskPriority.P3))}>
                {task.priority || TaskPriority.P3}
              </Badge>
            </div>
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {task.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0.5 bg-accent/20 text-accent-foreground hover:bg-accent/30">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1 items-center">
            {task.assigneeIds.map(assigneeId => {
              const assignee = users.find(u => u.id === assigneeId);
              return (
                <div key={assigneeId} title={getAssigneeName(assigneeId)} className="flex items-center bg-neutral-100 dark:bg-neutral-600 rounded-full pl-0.5 pr-2 py-0.5 text-xs">
                  {assignee?.avatarUrl ? (
                    <img src={assignee.avatarUrl} alt={assignee.name} className="w-4 h-4 rounded-full mr-1 object-cover" />
                  ) : (
                    <UserCircleIcon className="w-4 h-4 mr-1 text-neutral-400 dark:text-neutral-500" />
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
