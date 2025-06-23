
"use client";
import React, { useState, useEffect, FormEvent, useCallback, useMemo } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Task, Comment, User, UserRole, ProjectRole } from '../types';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';
import { cn } from "@/lib/utils";
import { TrashIcon } from './custom-icons';

interface CommentsModalProps {
  task: Task;
  onClose: () => void;
}

const CommentsModal: React.FC<CommentsModalProps> = ({ task, onClose }) => {
  const { getCommentsForTask, addComment, deleteComment } = useData();
  const { currentUser, users } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const canComment = useMemo(() => {
    if (!currentUser) return false;
    // Admins and Org Maintainers can always comment
    if ([UserRole.ADMIN, UserRole.ORG_MAINTAINER].includes(currentUser.role)) {
      return true;
    }
    // Any member of the project can comment
    const isProjectMember = currentUser.projectMemberships.some(
      (m) => m.projectId === task.projectId
    );
    if (isProjectMember) {
      return true;
    }
    // Any user assigned to the task can comment
    const isAssignee = task.assigneeIds.includes(currentUser.id);
    if (isAssignee) {
      return true;
    }
    return false;
  }, [currentUser, task]);

  const fetchAndSetComments = useCallback(async () => {
    setLoadingComments(true);
    const fetchedComments = await getCommentsForTask(task.id);
    setComments(fetchedComments);
    setLoadingComments(false);
  }, [getCommentsForTask, task.id]);

  useEffect(() => {
    fetchAndSetComments();
  }, [fetchAndSetComments]);

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    const added = await addComment(task.id, newComment.trim());
    if (added) {
      setNewComment('');
      await fetchAndSetComments();
    }
    // The service layer handles showing the error toast, so we just re-enable the form.
    setIsSubmittingComment(false);
  };
  
  const handleDeleteComment = async (commentId: string) => {
      if (window.confirm("Are you sure you want to delete this comment?")) {
        await deleteComment(commentId, task.id);
        await fetchAndSetComments();
      }
  };

  const getRoleForDisplay = (commentingUser: Pick<User, 'id' | 'role'>): string => {
    if (commentingUser.role === UserRole.ADMIN || commentingUser.role === UserRole.ORG_MAINTAINER) {
      return commentingUser.role.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    }

    const fullUser = users.find(u => u.id === commentingUser.id);
    if (fullUser) {
        const projectMembership = fullUser.projectMemberships.find(m => m.projectId === task.projectId);
        if (projectMembership?.role === ProjectRole.MAINTAINER) {
            return 'Maintainer';
        }
    }
    
    // Default to 'Member' if not a maintainer or if user not found
    return 'Member';
  };

  const canDeleteComment = (comment: Comment) => {
    if (!currentUser) return false;

    // Rule 1: Anyone can delete their own comment.
    if (comment.userId === currentUser.id) {
      return true;
    }

    // Rule 2: An ADMIN can delete any comment.
    if (currentUser.role === UserRole.ADMIN) {
      return true;
    }

    // Rule 3: An ORG_MAINTAINER can delete any comment EXCEPT those from an ADMIN.
    if (currentUser.role === UserRole.ORG_MAINTAINER && comment.user.role !== UserRole.ADMIN) {
      return true;
    }

    return false;
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Comments for: ${task.title}`}>
      <div className="space-y-4 max-h-[70vh] flex flex-col">
        
        {canComment && (
          <form onSubmit={handleAddComment} className="space-y-2 sticky top-0 bg-card pt-2 pb-4 border-b">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={isSubmittingComment}
              rows={3}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!newComment.trim() || isSubmittingComment}>
                {isSubmittingComment ? 'Posting...' : 'Post Comment'}
              </Button>
            </div>
          </form>
        )}

        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
          {loadingComments ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading comments...</p>
          ) : comments.length > 0 ? (
            comments.map(comment => {
              const isPrivilegedCommenter = comment.user.role === UserRole.ADMIN || comment.user.role === UserRole.ORG_MAINTAINER;
              return (
                <div key={comment.id} className={cn("flex items-start space-x-3 p-3 rounded-md", isPrivilegedCommenter ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50" : "bg-transparent")}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.user.avatarUrl} alt={comment.user.name} />
                    <AvatarFallback>{comment.user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-card-foreground">{comment.user.name}</p>
                        <Badge variant="secondary" className="text-xs">{getRoleForDisplay(comment.user)}</Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</p>
                        {canDeleteComment(comment) && (
                            <button onClick={() => handleDeleteComment(comment.id)} title="Delete comment" className="text-muted-foreground hover:text-destructive">
                                <TrashIcon className="w-4 h-4"/>
                            </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-foreground mt-2 whitespace-pre-wrap break-words">{comment.content}</p>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">
              {canComment ? (
                <p>No comments yet. Be the first to comment!</p>
              ) : (
                <p>There are no comments on this task yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CommentsModal;
