
"use client";
import React, { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Modal from './Modal';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { UserRole } from '../types';
import { useToast } from "@/hooks/use-toast";
import { inviteUserAction, type InviteUserActionState } from '@/actions/userActions';

// Submit button that shows a pending state
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800 disabled:bg-opacity-50"
    >
      {pending ? 'Sending...' : 'Send Invitation'}
    </button>
  );
}

const CreateUserModal: React.FC = () => {
  const { currentUser } = useAuth();
  const { showCreateUserModal, setShowCreateUserModal } = useData();
  const { toast } = useToast();

  const initialState: InviteUserActionState = { message: '', isError: false };
  // Note: The form action is now managed by useFormState
  const [state, formAction] = useFormState(inviteUserAction, initialState);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(UserRole.MEMBER);

  const resetForm = () => {
      setName('');
      setEmail('');
      setRole(UserRole.MEMBER);
  };
  
  // Need to memoize handleClose to use in useEffect dependency array without causing infinite loops.
  const handleClose = React.useCallback(() => {
    resetForm();
    setShowCreateUserModal(false);
  }, [setShowCreateUserModal]);

  useEffect(() => {
    // This effect runs when the server action returns a new state.
    if (state.message) {
      toast({
        title: state.isError ? "Invitation Error" : "Invitation Sent",
        description: state.message,
        variant: state.isError ? "destructive" : "default",
      });

      if (!state.isError) {
        handleClose();
      }
    }
  }, [state, toast, handleClose]);

  if (!showCreateUserModal) return null;

  return (
    <Modal isOpen={showCreateUserModal} onClose={handleClose} title="Invite New User">
      {/* The form now calls the server action directly */}
      <form action={formAction} aria-labelledby="modal-title-create-user" className="space-y-4">
        
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          An invitation will be sent to the user's email address, allowing them to set their password and log in.
        </p>

        <div>
          <label htmlFor="userName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Full Name
          </label>
          <input
            type="text"
            id="userName"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>

        <div>
          <label htmlFor="userEmail" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Email Address
          </label>
          <input
            type="email"
            id="userEmail"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>

        <div>
          <label htmlFor="userRole" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Role
          </label>
          <select
            id="userRole"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
          >
            {Object.values(UserRole).map(roleValue => (
              <option key={roleValue} value={roleValue}>
                {roleValue.charAt(0).toUpperCase() + roleValue.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        
        {/* Pass organizationId to the server action */}
        <input type="hidden" name="organizationId" value={currentUser?.organization_id || ''} />

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-500 border border-neutral-300 dark:border-neutral-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
          >
            Cancel
          </button>
          <SubmitButton />
        </div>
      </form>
    </Modal>
  );
};

export default CreateUserModal;
