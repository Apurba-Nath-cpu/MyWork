"use client";
import React, { useState, useEffect, FormEvent, useCallback, useMemo, useRef } from 'react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [highlightedMentionIndex, setHighlightedMentionIndex] = useState(0);
  const suggestionsContainerRef = useRef<HTMLDivElement>(null);


  const nameToUserMap = useMemo(() => new Map(users.map(u => [u.name.replace(/\s/g, ''), u])), [users]);

  const canComment = useMemo(() => {
    if (!currentUser) return false;
    if ([UserRole.ADMIN, UserRole.ORG_MAINTAINER].includes(currentUser.role)) return true;
    if (currentUser.projectMemberships.some((m) => m.projectId === task.projectId)) return true;
    if (task.assigneeIds.includes(currentUser.id)) return true;
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
  
  useEffect(() => {
    setHighlightedMentionIndex(0);
  }, [mentionQuery]);

  useEffect(() => {
    if (showMentionSuggestions && suggestionsContainerRef.current && filteredMentionSuggestions.length > 0) {
      const highlightedElement = suggestionsContainerRef.current.children[highlightedMentionIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedMentionIndex, showMentionSuggestions, filteredMentionSuggestions]);


  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewComment(text);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
        setShowMentionSuggestions(true);
        setMentionQuery(mentionMatch[1]);
    } else {
        setShowMentionSuggestions(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionSuggestions && filteredMentionSuggestions.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedMentionIndex(prev => (prev + 1) % filteredMentionSuggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedMentionIndex(prev => (prev - 1 + filteredMentionSuggestions.length) % filteredMentionSuggestions.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleMentionSelect(filteredMentionSuggestions[highlightedMentionIndex]);
        }
    }
  };


  const handleMentionSelect = (user: Pick<User, 'id' | 'name'>) => {
    const cursorPos = textareaRef.current?.selectionStart ?? 0;
    const textBeforeCursor = newComment.substring(0, cursorPos);
    
    const mentionPattern = /@(\w*)$/;
    const safeUsername = user.name.replace(/\s/g, '');
    const replacedText = textBeforeCursor.replace(mentionPattern, `@${safeUsername} `);

    setNewComment(replacedText + newComment.substring(cursorPos));
    setShowMentionSuggestions(false);
    
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentionedUsernames = new Set(Array.from(newComment.matchAll(mentionRegex), m => m[1]));
    const mentionedUserIds = Array.from(mentionedUsernames)
      .map(username => nameToUserMap.get(username)?.id)
      .filter((id): id is string => !!id);

    setIsSubmittingComment(true);
    const added = await addComment(task.id, newComment.trim(), mentionedUserIds);
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
    
    return 'Member';
  };

  const canDeleteComment = (comment: Comment) => {
    if (!currentUser) return false;
    if (comment.userId === currentUser.id) return true;
    if (currentUser.role === UserRole.ADMIN) return true;
    if (currentUser.role === UserRole.ORG_MAINTAINER && comment.user.role !== UserRole.ADMIN) return true;
    return false;
  };
  
  const renderWithMentions = (text: string) => {
    const mentionRegex = /(@[a-zA-Z0-9_]+)/g;
    
    return text.split(mentionRegex).map((part, index) => {
        if (part.startsWith('@')) {
            const username = part.substring(1);
            if (nameToUserMap.has(username)) {
                return <strong key={index} className="text-primary font-semibold bg-primary/10 px-1 rounded">{part}</strong>;
            }
        }
        return part;
    });
  };
  
  const filteredMentionSuggestions = useMemo(() => {
    if (!mentionQuery) return users;
    return users.filter(user => user.name.toLowerCase().includes(mentionQuery.toLowerCase()));
  }, [mentionQuery, users]);

  return (
    <Modal isOpen={true} onClose={onClose} title={`Comments for: ${task.title}`}>
      <div className="space-y-4 max-h-[70vh] flex flex-col">
        
        {canComment && (
          <div className="relative">
            <form onSubmit={handleAddComment} className="space-y-2 sticky top-0 bg-card pt-2 pb-4 border-b">
              <Textarea
                ref={textareaRef}
                placeholder="Add a comment... Type @ to mention a user."
                value={newComment}
                onChange={handleCommentChange}
                onKeyDown={handleKeyDown}
                disabled={isSubmittingComment}
                rows={3}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!newComment.trim() || isSubmittingComment}>
                  {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                </Button>
              </div>
            </form>
            {showMentionSuggestions && (
              <div
                ref={suggestionsContainerRef} 
                className="absolute z-10 w-full max-h-48 overflow-y-auto bg-card border border-border rounded-md shadow-lg mt-1 hide-scrollbar"
              >
                {filteredMentionSuggestions.length > 0 ? (
                  filteredMentionSuggestions.map((user, index) => (
                    <div
                      key={user.id}
                      onClick={() => handleMentionSelect(user)}
                      onMouseOver={() => setHighlightedMentionIndex(index)}
                      className={cn(
                          "flex items-center p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer",
                          index === highlightedMentionIndex && "bg-accent text-accent-foreground"
                      )}
                    >
                      <Avatar className="h-6 w-6 mr-2">
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{user.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">No users found</div>
                )}
              </div>
            )}
          </div>
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
                    <p className="text-sm text-foreground mt-2 whitespace-pre-wrap break-words">{renderWithMentions(comment.content)}</p>
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
