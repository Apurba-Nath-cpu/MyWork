
"use client";
import React, { useState } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';

const AddProjectModal: React.FC = () => {
  const { showAddProjectModal, setShowAddProjectModal, addProject, usersForSuggestions } = useData();
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [maintainerIds, setMaintainerIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Project title is required.');
      return;
    }
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
        alert("Only Admins can create projects.");
        return;
    }
    addProject(title, maintainerIds);
    setTitle('');
    setMaintainerIds([]);
    setSearchTerm('');
    // setShowAddProjectModal(false); // DataContext handles this now in addProject
  };

  const handleMaintainerToggle = (userId: string) => {
    setMaintainerIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = usersForSuggestions
    .filter(user => user.role === UserRole.MAINTAINER || user.role === UserRole.ADMIN) // Only suggest users who can be maintainers
    .filter(user => user.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!showAddProjectModal) return null;

  return (
    <Modal isOpen={showAddProjectModal} onClose={() => setShowAddProjectModal(false)} title="Create New Project">
      <form onSubmit={handleSubmit} aria-labelledby="modal-title-add-project">
        <div className="mb-4">
          <label htmlFor="projectTitle" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Project Title
          </label>
          <input
            type="text"
            id="projectTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
            required
            aria-required="true"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="maintainerSearch" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Assign Maintainers (Optional, select Admins or Maintainers)
          </label>
          <input
            type="text"
            id="maintainerSearch"
            placeholder="Search users by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 mb-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
            aria-controls="maintainer-list"
          />
          <div id="maintainer-list" className="max-h-40 overflow-y-auto border border-neutral-300 dark:border-neutral-600 rounded-md p-2 space-y-1 bg-white dark:bg-neutral-700">
            {filteredUsers.length > 0 ? filteredUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between p-1 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded">
                <label htmlFor={`maintainer-${user.id}`} className="text-sm cursor-pointer flex-grow text-neutral-800 dark:text-neutral-200">
                  {user.name} ({user.id === currentUser?.id ? "You" : user.role})
                </label>
                <input
                  type="checkbox"
                  id={`maintainer-${user.id}`}
                  checked={maintainerIds.includes(user.id)}
                  onChange={() => handleMaintainerToggle(user.id)}
                  className="form-checkbox h-4 w-4 text-primary-600 rounded border-neutral-400 dark:border-neutral-500 focus:ring-primary-500 ml-2 bg-white dark:bg-neutral-700"
                  aria-label={`Assign ${user.name} as maintainer`}
                />
              </div>
            )) : <p className="text-xs text-neutral-500 dark:text-neutral-400 p-1">No matching users found. Ensure users with Admin or Maintainer roles exist.</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => setShowAddProjectModal(false)}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-500 border border-neutral-300 dark:border-neutral-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
          >
            Create Project
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddProjectModal;
