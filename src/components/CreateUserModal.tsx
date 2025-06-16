
"use client";
import React, { useState }  from 'react';
import Modal from './Modal';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { UserRole } from '../types';
import type { UserCreationData } from '../types';
import { useToast } from "@/hooks/use-toast";

const CreateUserModal: React.FC = () => {
  const { createUser } = useAuth();
  const { showCreateUserModal, setShowCreateUserModal } = useData();
  const { toast } = useToast();

  const [formData, setFormData] = useState<UserCreationData>({
    name: '',
    email: '',
    role: UserRole.MEMBER, 
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim() || !formData.email.trim()) {
      const msg = 'Name and Email are required.';
      setError(msg);
      toast({ title: "Validation Error", description: msg, variant: "destructive" });
      return;
    }
    if (!formData.email.includes('@')) { 
        const msg = 'Please enter a valid email address.';
        setError(msg);
        toast({ title: "Validation Error", description: msg, variant: "destructive" });
        return;
    }

    const result = await createUser(formData.name, formData.email, formData.role);
    if (result.success && result.user) {
      setFormData({ name: '', email: '', role: UserRole.MEMBER }); 
      setShowCreateUserModal(false);
      // Toast for success is handled in AuthContext's createUser
    } else {
      // AuthContext's createUser handles detailed toasts for conflicts
      // Set local error for display in modal if needed, AuthContext returns error message.
      setError(result.error || 'Failed to create user profile.');
    }
  };

  if (!showCreateUserModal) return null;

  return (
    <Modal isOpen={showCreateUserModal} onClose={() => setShowCreateUserModal(false)} title="Create New User Profile">
      <form onSubmit={handleSubmit} aria-labelledby="modal-title-create-user">
        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 p-2 rounded text-center">{error}</p>}
        <div className="mb-4">
          <label htmlFor="userName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Full Name
          </label>
          <input
            type="text"
            id="userName"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="userEmail" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Email Address
          </label>
          <input
            type="email"
            id="userEmail"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="userRole" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Role
          </label>
          <select
            id="userRole"
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
          >
            {Object.values(UserRole).map(roleValue => (
              <option key={roleValue} value={roleValue}>
                {roleValue.charAt(0).toUpperCase() + roleValue.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
                setShowCreateUserModal(false);
                setError(null);
                setFormData({ name: '', email: '', role: UserRole.MEMBER });
            }}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-500 border border-neutral-300 dark:border-neutral-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
          >
            Create User
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateUserModal;
