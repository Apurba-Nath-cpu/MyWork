
"use client";
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface AddTaskModalProps {
  projectId: string;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ projectId }) => {
  const { 
    showAddTaskModalForProject, 
    setShowAddTaskModalForProject, 
    addTask, 
    usersForSuggestions, 
    boardData 
  } = useData();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [eta, setEta] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const project = boardData?.projects[projectId];

  useEffect(() => {
    if (showAddTaskModalForProject === projectId) {
      setTitle('');
      setDescription('');
      setAssigneeIds([]);
      setEta('');
      setSearchTerm('');
    }
  }, [showAddTaskModalForProject, projectId]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Task title is required.');
      return;
    }
    if (!project) {
        alert("Project not found.");
        return;
    }

    const canAddTask = currentUser?.role === UserRole.ADMIN || project.maintainerIds.includes(currentUser?.id || '');
    if (!canAddTask) {
        alert("Only Admins or Project Maintainers can add tasks to this project.");
        return;
    }

    addTask(projectId, title, description, assigneeIds, eta);
  };

  const handleAssigneeToggle = (userId: string) => {
    setAssigneeIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = usersForSuggestions
    .filter(user => user.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Modal 
      isOpen={true} 
      onClose={() => {
        setShowAddTaskModalForProject(null);
      }} 
      title={`Add Task to "${project?.title || 'Project'}"`}
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor={`taskTitle-${projectId}`} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Task Title
          </label>
          <input
            type="text"
            id={`taskTitle-${projectId}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor={`taskDescription-${projectId}`} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Description (Optional)
          </label>
          <textarea
            id={`taskDescription-${projectId}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="mb-4">
          <label htmlFor={`taskEta-${projectId}`} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            ETA (Estimated Time of Arrival/Completion)
          </label>
          <input
            type="date"
            id={`taskEta-${projectId}`}
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="mb-4">
          <label htmlFor={`assigneeSearch-${projectId}`} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Assignees (Optional)
          </label>
          <input
            type="text"
            id={`assigneeSearch-${projectId}`}
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 mb-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
          />
          <div className="max-h-40 overflow-y-auto border border-neutral-300 dark:border-neutral-600 rounded-md p-2 space-y-1">
            {filteredUsers.length > 0 ? filteredUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between p-1 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded">
                <label htmlFor={`assignee-${projectId}-${user.id}`} className="text-sm flex-grow cursor-pointer">{user.name}</label>
                <input
                  type="checkbox"
                  id={`assignee-${projectId}-${user.id}`}
                  checked={assigneeIds.includes(user.id)}
                  onChange={() => handleAssigneeToggle(user.id)}
                  className="form-checkbox h-4 w-4 text-primary-600 rounded border-neutral-300 dark:border-neutral-500 focus:ring-primary-500 ml-2"
                />
              </div>
            )) : <p className="text-xs text-neutral-500 dark:text-neutral-400">No matching users found.</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setShowAddTaskModalForProject(null);
            }}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-500 border border-neutral-300 dark:border-neutral-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
          >
            Add Task
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTaskModal;
