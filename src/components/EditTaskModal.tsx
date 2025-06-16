
"use client";
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Task, UserRole } from '../types';

interface EditTaskModalProps {
  task: Task;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ task }) => {
  const { setEditingTask, updateTask, usersForSuggestions, boardData } = useData();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assigneeIds);
  const [eta, setEta] = useState(task.eta || '');
  const [searchTerm, setSearchTerm] = useState('');

  const project = boardData?.projects[task.projectId];

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setAssigneeIds(task.assigneeIds);
    setEta(task.eta || '');
    setSearchTerm('');
  }, [task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Task title is required.');
      return;
    }
     if (!project) {
        alert("Associated project not found.");
        return;
    }

    const canEdit = currentUser?.role === UserRole.ADMIN || project.maintainerIds.includes(currentUser?.id || '');
    if (!canEdit) {
        alert("You do not have permission to edit this task.");
        return;
    }
    
    updateTask({ ...task, title, description, assigneeIds, eta });
  };

  const handleAssigneeToggle = (userId: string) => {
    setAssigneeIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = usersForSuggestions
    .filter(user => user.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Modal isOpen={!!task} onClose={() => setEditingTask(null)} title={`Edit Task: ${task.title}`}>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="editTaskTitle" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Task Title
          </label>
          <input
            type="text"
            id="editTaskTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="editTaskDescription" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Description (Optional)
          </label>
          <textarea
            id="editTaskDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="editTaskEta" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            ETA
          </label>
          <input
            type="date"
            id="editTaskEta"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Assignees (Optional)
          </label>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 mb-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
          />
          <div className="max-h-40 overflow-y-auto border border-neutral-300 dark:border-neutral-600 rounded-md p-2 space-y-1 bg-white dark:bg-neutral-700">
            {filteredUsers.length > 0 ? filteredUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between p-1 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded">
                <span className="text-sm">{user.name}</span>
                <input
                  type="checkbox"
                  checked={assigneeIds.includes(user.id)}
                  onChange={() => handleAssigneeToggle(user.id)}
                  className="form-checkbox h-4 w-4 text-primary-600 rounded border-neutral-300 dark:border-neutral-500 focus:ring-primary-500"
                />
              </div>
            )) : <p className="text-xs text-neutral-500 dark:text-neutral-400">No matching users found.</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => setEditingTask(null)}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-500 border border-neutral-300 dark:border-neutral-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
          >
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditTaskModal;
