
"use client";
import React, { useState, useEffect, FormEvent, useCallback } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Task, Comment, UserRole, ProjectRole } from '../types';
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
  const { currentUser } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const fetchAndSetComments = useCallback(async () => {
    setLoadingComments(true);
    const fetchedComments = await getCommentsForTask(task.id);
    setComments(fetchedComments);
    setLoadingComments(false);
  }, [getCommentsForTask, task.id]);

  useEffect(() => {
    fetchAndSetComments();
  }, [fetchAndSetComments]);
  
  const canComment = React.useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.ORG_MAINTAINER) {
      return true;
    }
    const membership = currentUser.projectMemberships.find(m => m.projectId === task.projectId);
    if (membership?.role === ProjectRole.MAINTAINER) {
      return true;
    }
    if (membership?.role === ProjectRole.MEMBER && task.assigneeIds.includes(currentUser.id)) {
      return true;
    }
    return false;
  }, [currentUser, task.projectId, task.assigneeIds]);

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !canComment) return;

    setIsSubmittingComment(true);
    const added = await addComment(task.id, newComment.trim());
    if (added) {
      setNewComment('');
      await fetchAndSetComments();
    }
    setIsSubmittingComment(false);
  };
  
  const handleDeleteComment = async (commentId: string) => {
      if (window.confirm("Are you sure you want to delete this comment?")) {
        await deleteComment(commentId, task.id);
        await fetchAndSetComments();
      }
  };

  const formatRole = (role: UserRole) => {
    return role.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
  };

  const canDeleteComment = (comment: Comment) => {
      if(!currentUser) return false;
      if(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.ORG_MAINTAINER) return true;
      return comment.userId === currentUser.id;
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={`Comments for: ${task.title}`}>
      <div className="space-y-4 max-h-[70vh] flex flex-col">
        
        <form onSubmit={handleAddComment} className="space-y-2 sticky top-0 bg-card pt-2 pb-4 border-b">
          <Textarea
            placeholder={canComment ? "Add a comment..." : "You don't have permission to comment on this task."}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={!canComment || isSubmittingComment}
            rows={3}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={!canComment || !newComment.trim() || isSubmittingComment}>
              {isSubmittingComment ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        </form>

        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
          {loadingComments ? (
            <p className="text-sm text-muted-foreground">Loading comments...</p>
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
                        <Badge variant="secondary" className="text-xs">{formatRole(comment.user.role)}</Badge>
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
            <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first to comment!</p>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CommentsModal;
