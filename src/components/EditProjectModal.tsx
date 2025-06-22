
"use client";
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { ProjectColumn, UserRole } from '../types';

interface EditProjectModalProps {
  project: ProjectColumn;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ project }) => {
  const { setEditingProject, updateProject } = useData();
  const { currentUser } = useAuth();
  
  const [title, setTitle] = useState(project.title);

  useEffect(() => {
    setTitle(project.title);
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Project title is required.');
      return;
    }
    if (!currentUser || ![UserRole.ADMIN, UserRole.ORG_MAINTAINER].includes(currentUser.role)) { 
        alert("You do not have permission to edit this project.");
        return;
    }
    updateProject({ ...project, title });
  };

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
