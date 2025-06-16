
"use client";
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Task, UserRole, TaskStatus, TaskPriority } from '../types';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EditTaskModalProps {
  task: Task;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ task }) => {
  const { setEditingTask, updateTask, usersForSuggestions, boardData } = useData();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assigneeIds);
  const [eta, setEta] = useState(task.eta || '');
  const [status, setStatus] = useState<TaskStatus>(task.status || TaskStatus.TODO);
  const [priority, setPriority] = useState<TaskPriority>(task.priority || TaskPriority.P2);
  const [tagsString, setTagsString] = useState(task.tags?.join(', ') || '');
  const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');

  const project = boardData?.projects[task.projectId];

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setAssigneeIds(task.assigneeIds);
    setEta(task.eta || '');
    setStatus(task.status || TaskStatus.TODO);
    setPriority(task.priority || TaskPriority.P2);
    setTagsString(task.tags?.join(', ') || '');
    setAssigneeSearchTerm('');
  }, [task]);

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

    const canEditPermission = currentUser?.role === UserRole.ADMIN || 
                            (project && Array.isArray(project.maintainerIds) && project.maintainerIds.includes(currentUser?.id || ''));
    if (!canEditPermission) {
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

  const filteredUsers = usersForSuggestions
    .filter(user => user.name.toLowerCase().includes(assigneeSearchTerm.toLowerCase()));

  return (
    <Modal isOpen={!!task} onClose={() => setEditingTask(null)} title={`Edit Task: ${task.title}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="editTaskTitle" className="text-neutral-700 dark:text-neutral-300">Task Title</Label>
          <Input
            id="editTaskTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="editTaskDescription" className="text-neutral-700 dark:text-neutral-300">Description (Optional)</Label>
          <Textarea
            id="editTaskDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="editTaskStatus" className="text-neutral-700 dark:text-neutral-300">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
              <SelectTrigger id="editTaskStatus">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TaskStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="editTaskPriority" className="text-neutral-700 dark:text-neutral-300">Priority</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
              <SelectTrigger id="editTaskPriority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TaskPriority).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="editTaskTags" className="text-neutral-700 dark:text-neutral-300">Tags (comma-separated)</Label>
          <Input
            id="editTaskTags"
            value={tagsString}
            onChange={(e) => setTagsString(e.target.value)}
            placeholder="e.g., bug, feature, UI"
          />
        </div>

        <div>
          <Label htmlFor="editTaskEta" className="text-neutral-700 dark:text-neutral-300">ETA (Optional)</Label>
          <Input
            type="date"
            id="editTaskEta"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-neutral-700 dark:text-neutral-300">Assignees (Optional)</Label>
          <Input
            placeholder="Search users..."
            value={assigneeSearchTerm}
            onChange={(e) => setAssigneeSearchTerm(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-40 overflow-y-auto border border-input rounded-md p-2 space-y-1 bg-background">
            {filteredUsers.length > 0 ? filteredUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between p-1 hover:bg-accent hover:text-accent-foreground rounded">
                <label htmlFor={`edit-assignee-${user.id}`} className="text-sm flex-grow cursor-pointer">{user.name}</label>
                <input
                  type="checkbox"
                  id={`edit-assignee-${user.id}`}
                  checked={assigneeIds.includes(user.id)}
                  onChange={() => handleAssigneeToggle(user.id)}
                  className="form-checkbox h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary ml-2"
                />
              </div>
            )) : <p className="text-xs text-muted-foreground">No matching users found.</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditingTask(null)}
          >
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditTaskModal;
