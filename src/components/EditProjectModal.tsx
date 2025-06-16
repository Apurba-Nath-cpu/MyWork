
"use client";
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import type { ProjectColumn, UserRole } from '../types';

interface EditProjectModalProps {
  project: ProjectColumn;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ project }) => {
  const { setEditingProject, updateProject, usersForSuggestions } = useData();
  const { currentUser } = useAuth();
  
  const [title, setTitle] = useState(project.title);
  const [maintainerIds, setMaintainerIds] = useState<string[]>(project.maintainerIds);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setTitle(project.title);
    setMaintainerIds(project.maintainerIds);
    setSearchTerm('');
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Project title is required.');
      return;
    }
    if (!currentUser || currentUser.role !== UserRole.ADMIN) { 
        alert("You do not have permission to edit this project.");
        return;
    }
    updateProject({ ...project, title, maintainerIds });
  };

  const handleMaintainerToggle = (userId: string) => {
    setMaintainerIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = usersForSuggestions
    .filter(user => user.role === UserRole.MAINTAINER || user.role === UserRole.ADMIN)
    .filter(user => user.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Modal isOpen={!!project} onClose={() => setEditingProject(null)} title={`Edit Project: ${project.title}`}>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="editProjectTitle" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Project Title
          </label>
          <input
            type="text"
            id="editProjectTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="editMaintainerSearch" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Assign Maintainers (Admins or Maintainers)
          </label>
          <input
            type="text"
            id="editMaintainerSearch"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 mb-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
          />
          <div className="max-h-40 overflow-y-auto border border-neutral-300 dark:border-neutral-600 rounded-md p-2 space-y-1 bg-white dark:bg-neutral-700">
            {filteredUsers.length > 0 ? filteredUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between p-1 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded">
                <label htmlFor={`edit-maintainer-${user.id}`} className="text-sm cursor-pointer flex-grow text-neutral-800 dark:text-neutral-200">
                   {user.name} ({user.id === currentUser?.id ? "You" : user.role})
                </label>
                <input
                  type="checkbox"
                  id={`edit-maintainer-${user.id}`}
                  checked={maintainerIds.includes(user.id)}
                  onChange={() => handleMaintainerToggle(user.id)}
                  className="form-checkbox h-4 w-4 text-primary-600 rounded border-neutral-400 dark:border-neutral-500 focus:ring-primary-500 ml-2 bg-white dark:bg-neutral-700"
                />
              </div>
            )) : <p className="text-xs text-neutral-500 dark:text-neutral-400 p-1">No matching users found.</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => setEditingProject(null)}
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

export default EditProjectModal;
