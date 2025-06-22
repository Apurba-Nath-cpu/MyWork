
"use client";
import React, { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Modal from './Modal';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { UserRole, ProjectRole } from '../types';
import { useToast } from "@/hooks/use-toast";
import { createUserAction, type CreateUserActionState } from '@/actions/userActions';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Submit button that shows a pending state
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800 disabled:bg-opacity-50"
    >
      {pending ? 'Creating...' : 'Create User'}
    </button>
  );
}

const CreateUserModal: React.FC = () => {
  const { currentUser } = useAuth();
  const { showCreateUserModal, setShowCreateUserModal, boardData } = useData();
  const { toast } = useToast();

  const initialState: CreateUserActionState = { message: '', isError: false };
  const [state, formAction] = useFormState(createUserAction, initialState);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isOrgMaintainer, setIsOrgMaintainer] = useState(false);
  const [projectAssignments, setProjectAssignments] = useState<Record<string, ProjectRole>>({});

  const handleProjectAssignmentChange = (projectId: string, projectRole: ProjectRole | 'NONE') => {
    setProjectAssignments(prev => {
      const newAssignments = { ...prev };
      if (projectRole === 'NONE') {
        delete newAssignments[projectId];
      } else {
        newAssignments[projectId] = projectRole;
      }
      return newAssignments;
    });
  };

  const resetForm = () => {
      setName('');
      setEmail('');
      setPassword('');
      setIsOrgMaintainer(false);
      setProjectAssignments({});
  };
  
  const handleClose = React.useCallback(() => {
    resetForm();
    setShowCreateUserModal(false);
  }, [setShowCreateUserModal]);

  useEffect(() => {
    if (state.message) {
      toast({
        title: state.isError ? "Creation Error" : "User Created",
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
    <Modal isOpen={showCreateUserModal} onClose={handleClose} title="Create New User">
      <form action={formAction} aria-labelledby="modal-title-create-user" className="space-y-4">
        
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Create a new user account in your organization. An email will be sent for account confirmation.
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
          <label htmlFor="userPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Password
          </label>
          <input
            type="password"
            id="userPassword"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
            required
            minLength={6}
          />
        </div>
        
        <div className="space-y-2 pt-2">
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="isOrgMaintainer"
                    checked={isOrgMaintainer}
                    onCheckedChange={(checked) => setIsOrgMaintainer(Boolean(checked))}
                />
                <Label
                    htmlFor="isOrgMaintainer"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    Assign as Organization Maintainer
                </Label>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 pl-1">
                Org Maintainers can edit all projects and do not need individual assignments.
            </p>
        </div>


        {!isOrgMaintainer && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Project Assignments (Optional)
            </label>
            <div className="max-h-48 overflow-y-auto border border-neutral-300 dark:border-neutral-600 rounded-md p-2 space-y-2 bg-white dark:bg-neutral-700">
              {boardData && boardData.projectOrder.length > 0 ? (
                boardData.projectOrder.map(projectId => {
                  const project = boardData.projects[projectId];
                  return (
                    <div key={projectId} className="flex items-center justify-between">
                      <span className="text-sm text-neutral-800 dark:text-neutral-200">{project.title}</span>
                      <select
                        onChange={(e) => handleProjectAssignmentChange(projectId, e.target.value as ProjectRole | 'NONE')}
                        value={projectAssignments[projectId] || 'NONE'}
                        className="text-sm p-1 border border-neutral-300 dark:border-neutral-500 rounded-md bg-white dark:bg-neutral-600 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="NONE">None</option>
                        <option value={ProjectRole.MEMBER}>Member</option>
                        <option value={ProjectRole.MAINTAINER}>Maintainer</option>
                      </select>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">No projects available to assign.</p>
              )}
            </div>
          </div>
        )}
        
        <input type="hidden" name="role" value={isOrgMaintainer ? UserRole.ORG_MAINTAINER : UserRole.MEMBER} />
        <input type="hidden" name="organizationId" value={currentUser?.organization_id || ''} />
        <input 
            type="hidden" 
            name="projectAssignments" 
            value={isOrgMaintainer ? '{}' : JSON.stringify(projectAssignments)}
        />


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
