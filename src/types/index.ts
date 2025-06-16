
export enum UserRole {
  ADMIN = 'ADMIN',
  MAINTAINER = 'MAINTAINER',
  MEMBER = 'MEMBER',
}

export interface Organization {
  id: string;
  name: string;
  admin_id: string; // User ID of the admin who created the org
  created_at?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  organization_id: string; // Foreign key to organizations table
}

export enum TaskStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done',
  BLOCKED = 'Blocked',
}

export enum TaskPriority {
  P0 = 'P0 - Critical',
  P1 = 'P1 - High',
  P2 = 'P2 - Medium',
  P3 = 'P3 - Low',
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigneeIds: string[]; // User IDs
  eta: string; // ISO date string or human-readable
  projectId: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
}

export interface ProjectColumn {
  id: string; // Project ID
  title: string;
  taskIds: string[]; // Ordered list of task IDs
  maintainerIds: string[]; // User IDs of maintainers
  organization_id: string; // Foreign key to organizations table
}

export interface BoardData {
  tasks: Record<string, Task>;
  projects: Record<string, ProjectColumn>;
  projectOrder: string[]; // Ordered list of project IDs
}

// For react-beautiful-dnd
export interface DraggableLocation {
  droppableId: string;
  index: number;
}

export interface DropResult {
  draggableId:string;
  type: string;
  source: DraggableLocation;
  destination?: DraggableLocation | null; // Nullable if dropped outside
  reason?: 'DROP' | 'CANCEL';
}

export interface UserCreationData {
  name: string;
  email: string;
  role: UserRole;
  // organization_id will be handled by the context
}

export interface ConfirmationModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirmAction: (() => void) | null;
  confirmText?: string;
  cancelText?: string;
}

// Extended Error types for Supabase service
import type { AuthError, PostgrestError } from '@supabase/supabase-js';

export interface SignUpError extends AuthError {
  isEmailConflict?: boolean;
  isOrgNameConflict?: boolean;
}

export interface CreateUserAccountError extends PostgrestError {
  isEmailConflict?: boolean;
  isUsernameConflictInOrg?: boolean; // For username conflict within the same organization
}
