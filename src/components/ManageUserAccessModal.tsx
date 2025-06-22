
"use client";
import React, { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Modal from './Modal';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { User, UserRole, ProjectRole } from '../types';
import { useToast } from "@/hooks/use-toast";
import { updateUserAccessAction, type UpdateUserAccessActionState } from '@/actions/userActions';
import * as supabaseService from '@/services/supabaseService';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800 disabled:bg-opacity-50"
    >
      {pending ? 'Updating...' : 'Update Access'}
    </button>
  );
}

const ManageUserAccessModal: React.FC = () => {
  const { currentUser, users } = useAuth();
  const { showManageAccessModal, setShowManageAccessModal, boardData } = useData();
  const { toast } = useToast();

  const initialState: UpdateUserAccessActionState = { message: '', isError: false };
  const [state, formAction] = useFormState(updateUserAccessAction, initialState);

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isOrgMaintainer, setIsOrgMaintainer] = useState(false);
  const [projectAssignments, setProjectAssignments] = useState<Record<string, ProjectRole>>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const handleClose = React.useCallback(() => {
    setShowManageAccessModal(false);
    setSelectedUserId('');
    setIsOrgMaintainer(false);
    setProjectAssignments({});
  }, [setShowManageAccessModal]);

  useEffect(() => {
    if (!selectedUserId) {
      setIsOrgMaintainer(false);
      setProjectAssignments({});
      return;
    }

    const fetchUserDetails = async () => {
      setIsLoadingDetails(true);
      const userProfile = await supabaseService.getUserProfile(selectedUserId);
      if (userProfile) {
        setIsOrgMaintainer(userProfile.role === UserRole.ORG_MAINTAINER);
        const assignments: Record<string, ProjectRole> = {};
        userProfile.projectMemberships.forEach(m => {
          assignments[m.projectId] = m.role;
        });
        setProjectAssignments(assignments);
      }
      setIsLoadingDetails(false);
    };

    fetchUserDetails();
  }, [selectedUserId]);

  useEffect(() => {
    if (state.message) {
      toast({
        title: state.isError ? "Update Error" : "Success",
        description: state.message,
        variant: state.isError ? "destructive" : "default",
      });
      if (!state.isError) {
        handleClose();
      }
    }
  }, [state, toast, handleClose]);

  if (!showManageAccessModal) return null;

  return (
    <Modal isOpen={showManageAccessModal} onClose={handleClose} title="Manage User Access">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="userSelect" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Select User to Edit
          </Label>
          <select
            id="userSelect"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 focus:ring-primary-500 focus:border-primary-500"
            required
          >
            <option value="" disabled>-- Select a user --</option>
            {users.map(user => (
              <option
                key={user.id}
                value={user.id}
                disabled={
                  user.id === currentUser?.id || // Can't edit self
                  (currentUser?.role === UserRole.ORG_MAINTAINER && user.role === UserRole.ADMIN) // Org Maintainer can't edit Admin
                }
              >
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </div>

        {selectedUserId && !isLoadingDetails && (
          <>
            <div className="space-y-2 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isOrgMaintainer"
                  checked={isOrgMaintainer}
                  onCheckedChange={(checked) => setIsOrgMaintainer(Boolean(checked))}
                />
                <Label htmlFor="isOrgMaintainer" className="text-sm font-medium leading-none">
                  Assign as Organization Maintainer
                </Label>
              </div>
            </div>

            {!isOrgMaintainer && (
              <div>
                <Label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Project Assignments
                </Label>
                <div className="max-h-48 overflow-y-auto border border-neutral-300 dark:border-neutral-600 rounded-md p-2 space-y-2 bg-white dark:bg-neutral-700">
                  {boardData && boardData.projectOrder.length > 0 ? (
                    boardData.projectOrder.map(projectId => {
                      const project = boardData.projects[projectId];
                      return (
                        <div key={projectId} className="flex items-center justify-between">
                          <span className="text-sm text-neutral-800 dark:text-neutral-200">{project.title}</span>
                          <select
                            onChange={(e) => setProjectAssignments(prev => ({...prev, [projectId]: e.target.value as ProjectRole}))}
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
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">No projects available.</p>
                  )}
                </div>
              </div>
            )}
            
            <input type="hidden" name="userId" value={selectedUserId} />
            <input type="hidden" name="role" value={isOrgMaintainer ? UserRole.ORG_MAINTAINER : UserRole.MEMBER} />
            <input type="hidden" name="projectAssignments" value={JSON.stringify(projectAssignments)} />

            <div className="mt-6 flex justify-end space-x-3">
              <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-500 border border-neutral-300 dark:border-neutral-500 rounded-md shadow-sm">
                Cancel
              </button>
              <SubmitButton />
            </div>
          </>
        )}

        {isLoadingDetails && <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">Loading user details...</p>}
      </form>
    </Modal>
  );
};

export default ManageUserAccessModal;
