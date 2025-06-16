
"use client";
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, TaskStatus, TaskPriority } from '../types';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AddTaskModalProps {
  projectId: string;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ projectId }) => {
  const { 
    showAddTaskModalForProject, 
    setShowAddTaskModalForProject, 
    addTask, 
    usersForSuggestions, 
    boardData 
  } = useData();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [eta, setEta] = useState('');
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.P2);
  const [tagsString, setTagsString] = useState('');
  const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');

  const project = boardData?.projects[projectId];

  useEffect(() => {
    if (showAddTaskModalForProject === projectId) {
      setTitle('');
      setDescription('');
      setAssigneeIds([]);
      setEta('');
      setStatus(TaskStatus.TODO);
      setPriority(TaskPriority.P2);
      setTagsString('');
      setAssigneeSearchTerm('');
    }
  }, [showAddTaskModalForProject, projectId]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Task title is required.');
      return;
    }
    if (!project) {
        alert("Project not found.");
        return;
    }

    const canAddTaskPermission = currentUser?.role === UserRole.ADMIN || 
                               (project && Array.isArray(project.maintainerIds) && project.maintainerIds.includes(currentUser?.id || ''));
    if (!canAddTaskPermission) {
        alert("Only Admins or Project Maintainers can add tasks to this project.");
        return;
    }
    const tagsArray = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    addTask(projectId, title, description, assigneeIds, eta, status, priority, tagsArray);
  };

  const handleAssigneeToggle = (userId: string) => {
    setAssigneeIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = usersForSuggestions
    .filter(user => user.name.toLowerCase().includes(assigneeSearchTerm.toLowerCase()));

  return (
    <Modal 
      isOpen={true} 
      onClose={() => {
        setShowAddTaskModalForProject(null);
      }} 
      title={`Add Task to "${project?.title || 'Project'}"`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor={`taskTitle-${projectId}`} className="text-neutral-700 dark:text-neutral-300">Task Title</Label>
          <Input
            id={`taskTitle-${projectId}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor={`taskDescription-${projectId}`} className="text-neutral-700 dark:text-neutral-300">Description (Optional)</Label>
          <Textarea
            id={`taskDescription-${projectId}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`taskStatus-${projectId}`} className="text-neutral-700 dark:text-neutral-300">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
              <SelectTrigger id={`taskStatus-${projectId}`}>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TaskStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`taskPriority-${projectId}`} className="text-neutral-700 dark:text-neutral-300">Priority</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
              <SelectTrigger id={`taskPriority-${projectId}`}>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TaskPriority).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor={`taskTags-${projectId}`} className="text-neutral-700 dark:text-neutral-300">Tags (comma-separated)</Label>
          <Input
            id={`taskTags-${projectId}`}
            value={tagsString}
            onChange={(e) => setTagsString(e.target.value)}
            placeholder="e.g., bug, feature, UI"
          />
        </div>

        <div>
          <Label htmlFor={`taskEta-${projectId}`} className="text-neutral-700 dark:text-neutral-300">ETA (Optional)</Label>
          <Input
            type="date"
            id={`taskEta-${projectId}`}
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor={`assigneeSearch-${projectId}`} className="text-neutral-700 dark:text-neutral-300">Assignees (Optional)</Label>
          <Input
            id={`assigneeSearch-${projectId}`}
            placeholder="Search users..."
            value={assigneeSearchTerm}
            onChange={(e) => setAssigneeSearchTerm(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-40 overflow-y-auto border border-input rounded-md p-2 space-y-1 bg-background">
            {filteredUsers.length > 0 ? filteredUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between p-1 hover:bg-accent hover:text-accent-foreground rounded">
                <label htmlFor={`assignee-${projectId}-${user.id}`} className="text-sm flex-grow cursor-pointer">{user.name}</label>
                <input
                  type="checkbox"
                  id={`assignee-${projectId}-${user.id}`}
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
            onClick={() => {
              setShowAddTaskModalForProject(null);
            }}
          >
            Cancel
          </Button>
          <Button type="submit">Add Task</Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTaskModal;
