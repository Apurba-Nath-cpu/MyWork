
"use client";
import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Task, UserRole, TaskStatus, TaskPriority, ProjectRole, Comment } from '../types';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from 'date-fns';
import { cn } from "@/lib/utils";

interface EditTaskModalProps {
  task: Task;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ task }) => {
  const { setEditingTask, updateTask, usersForSuggestions, boardData, getCommentsForTask, addComment } = useData();
  const { currentUser } = useAuth();

  // Form state
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assigneeIds);
  const [eta, setEta] = useState(task.eta || '');
  const [status, setStatus] = useState<TaskStatus>(task.status || TaskStatus.TODO);
  const [priority, setPriority] = useState<TaskPriority>(task.priority || TaskPriority.P2);
  const [tagsString, setTagsString] = useState(task.tags?.join(', ') || '');
  const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const project = boardData?.projects[task.projectId];

  const fetchAndSetComments = React.useCallback(async () => {
    setLoadingComments(true);
    const fetchedComments = await getCommentsForTask(task.id);
    setComments(fetchedComments);
    setLoadingComments(false);
  }, [getCommentsForTask, task.id]);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setAssigneeIds(task.assigneeIds);
    setEta(task.eta || '');
    setStatus(task.status || TaskStatus.TODO);
    setPriority(task.priority || TaskPriority.P2);
    setTagsString(task.tags?.join(', ') || '');
    setAssigneeSearchTerm('');
    
    // Fetch comments when task changes
    fetchAndSetComments();

  }, [task, fetchAndSetComments]);

  const canEditTask = useMemo(() => {
    if (!currentUser || !project) return false;
    const isProjectMaintainer = currentUser.projectMemberships.some(m => m.projectId === task.projectId && m.role === ProjectRole.MAINTAINER);
    return [UserRole.ADMIN, UserRole.ORG_MAINTAINER].includes(currentUser.role) || isProjectMaintainer;
  }, [currentUser, project, task.projectId]);
  
  const canComment = useMemo(() => {
    if (!currentUser || !project) return false;
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.ORG_MAINTAINER) {
      return true;
    }
    const membership = currentUser.projectMemberships.find(m => m.projectId === project.id);
    if (membership?.role === ProjectRole.MAINTAINER) {
      return true;
    }
    if (membership?.role === ProjectRole.MEMBER && task.assigneeIds.includes(currentUser.id)) {
      return true;
    }
    return false;
  }, [currentUser, project, task.assigneeIds]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Task title is required.');
      return;
    }
     if (!project) {
        alert("Associated project not found.");
        return;
    }
    if (!canEditTask) {
        alert("You do not have permission to edit this task.");
        return;
    }
    const tagsArray = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    updateTask({ ...task, title, description, assigneeIds, eta, status, priority, tags: tagsArray });
  };

  const handleAssigneeToggle = (userId: string) => {
    setAssigneeIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };
  
  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !canComment) return;
    
    setIsSubmittingComment(true);
    const added = await addComment(task.id, newComment.trim());
    if(added) {
        setNewComment('');
        await fetchAndSetComments(); // Refetch to get the latest list
    }
    setIsSubmittingComment(false);
  }

  const filteredUsers = usersForSuggestions
    .filter(user => user.name.toLowerCase().includes(assigneeSearchTerm.toLowerCase()));

  return (
    <Modal isOpen={!!task} onClose={() => setEditingTask(null)} title={`Edit Task: ${task.title}`}>
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="editTaskTitle" className="text-neutral-700 dark:text-neutral-300">Task Title</Label>
            <Input id="editTaskTitle" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={!canEditTask} />
          </div>

          <div>
            <Label htmlFor="editTaskDescription" className="text-neutral-700 dark:text-neutral-300">Description (Optional)</Label>
            <Textarea id="editTaskDescription" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={!canEditTask} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="editTaskStatus" className="text-neutral-700 dark:text-neutral-300">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)} disabled={!canEditTask}>
                <SelectTrigger id="editTaskStatus"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>{Object.values(TaskStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editTaskPriority" className="text-neutral-700 dark:text-neutral-300">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)} disabled={!canEditTask}>
                <SelectTrigger id="editTaskPriority"><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>{Object.values(TaskPriority).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="editTaskTags" className="text-neutral-700 dark:text-neutral-300">Tags (comma-separated)</Label>
            <Input id="editTaskTags" value={tagsString} onChange={(e) => setTagsString(e.target.value)} placeholder="e.g., bug, feature, UI" disabled={!canEditTask} />
          </div>

          <div>
            <Label htmlFor="editTaskEta" className="text-neutral-700 dark:text-neutral-300">ETA (Optional)</Label>
            <Input type="date" id="editTaskEta" value={eta} onChange={(e) => setEta(e.target.value)} disabled={!canEditTask} />
          </div>

          <div>
            <Label className="text-neutral-700 dark:text-neutral-300">Assignees (Optional)</Label>
            <Input placeholder="Search users..." value={assigneeSearchTerm} onChange={(e) => setAssigneeSearchTerm(e.target.value)} className="mb-2" disabled={!canEditTask} />
            <div className="max-h-40 overflow-y-auto border border-input rounded-md p-2 space-y-1 bg-background">
              {filteredUsers.length > 0 ? filteredUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-1 hover:bg-accent hover:text-accent-foreground rounded">
                  <label htmlFor={`edit-assignee-${user.id}`} className="text-sm flex-grow cursor-pointer">{user.name}</label>
                  <input type="checkbox" id={`edit-assignee-${user.id}`} checked={assigneeIds.includes(user.id)} onChange={() => handleAssigneeToggle(user.id)} className="form-checkbox h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary ml-2" disabled={!canEditTask} />
                </div>
              )) : <p className="text-xs text-muted-foreground">No matching users found.</p>}
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
            <Button type="submit" disabled={!canEditTask}>Save Changes</Button>
          </div>
        </form>

        <Separator className="my-6" />

        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Comments</h3>
            {loadingComments ? (
                <p className="text-sm text-muted-foreground">Loading comments...</p>
            ) : comments.length > 0 ? (
                <div className="space-y-4">
                    {comments.map(comment => {
                        const isPrivilegedCommenter = comment.user.role === UserRole.ADMIN || comment.user.role === UserRole.ORG_MAINTAINER;
                        return (
                        <div key={comment.id} className={cn("flex items-start space-x-3 p-3 rounded-md", isPrivilegedCommenter ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50" : "bg-transparent")}>
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={comment.user.avatarUrl} alt={comment.user.name} />
                                <AvatarFallback>{comment.user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-card-foreground">{comment.user.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</p>
                                </div>
                                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
                            </div>
                        </div>
                        )
                    })}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
            )}

            <form onSubmit={handleAddComment} className="space-y-2">
                <Textarea 
                  placeholder={canComment ? "Add a comment..." : "You don't have permission to comment on this task."}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={!canComment || isSubmittingComment}
                />
                <div className="flex justify-end">
                    <Button type="submit" disabled={!canComment || !newComment.trim() || isSubmittingComment}>
                        {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                    </Button>
                </div>
            </form>
        </div>
      </div>
    </Modal>
  );
};

export default EditTaskModal;
