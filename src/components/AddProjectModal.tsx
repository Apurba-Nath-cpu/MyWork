
"use client";
import React, { useState } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

const AddProjectModal: React.FC = () => {
  const { showAddProjectModal, setShowAddProjectModal, addProject } = useData();
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Project title is required.');
      return;
    }
    if (!currentUser || ![UserRole.ADMIN, UserRole.ORG_MAINTAINER].includes(currentUser.role)) {
        alert("Only Admins or Org Maintainers can create projects.");
        return;
    }
    addProject(title);
    setTitle('');
  };


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
