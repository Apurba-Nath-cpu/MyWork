
import type { DropResult, DraggableLocation } from '@hello-pangea/dnd';
export type { DropResult, DraggableLocation };

export enum UserRole {
  ADMIN = 'ADMIN',
  ORG_MAINTAINER = 'ORG_MAINTAINER',
  MEMBER = 'MEMBER',
}

export enum ProjectRole {
  MAINTAINER = 'MAINTAINER',
  MEMBER = 'MEMBER',
}

export interface ProjectMembership {
  projectId: string;
  role: ProjectRole;
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
  projectMemberships: ProjectMembership[];
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
  commentCount: number;
}

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  userId: string;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatarUrl' | 'role'>;
}

export interface ProjectColumn {
  id: string; // Project ID
  title: string;
  taskIds: string[]; // Ordered list of task IDs
  organization_id: string; // Foreign key to organizations table
}

export interface BoardData {
  tasks: Record<string, Task>;
  projects: Record<string, ProjectColumn>;
  projectOrder: string[]; // Ordered list of project IDs
}

export interface UserCreationData {
  name: string;
  email: string;
  role: UserRole;
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

// For AuthContext
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

export interface AuthContextType {
  currentUser: User | null;
  supabaseUser: SupabaseAuthUser | null;
  users: User[]; 
  loadingAuth: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string, organizationName: string, avatarFile?: File) => Promise<{ success: boolean; error?: string; isOrgNameConflict?: boolean; isEmailConflict?: boolean }>;
  logout: () => Promise<void>;
  fetchPublicUsers: (organizationId: string) => Promise<void>; 
}


export interface DataContextType {
  boardData: BoardData | null;
  usersForSuggestions: Array<Pick<User, 'id' | 'name' | 'role'>>;
  fetchBoardData: () => Promise<void>;
  addProject: (title: string) => Promise<void>;
  updateProject: (updatedProject: Omit<ProjectColumn, 'taskIds'>) => Promise<void>;
  addTask: (
    projectId: string, 
    title: string, 
    description: string | undefined, 
    assigneeIds: string[], 
    eta: string | undefined,
    status: TaskStatus,
    priority: TaskPriority,
    tags: string[]
  ) => Promise<void>;
  moveProject: (projectId: string, newIndex: number) => Promise<void>;
  moveTaskWithinProject: (projectId: string, taskId: string, newIndex: number) => Promise<void>;
  moveTaskBetweenProjects: (startProjectId: string, finishProjectId: string, taskId: string, newIndex: number) => Promise<void>;
  updateTask: (updatedTask: Task) => Promise<void>;
  getCommentsForTask: (taskId: string) => Promise<Comment[]>;
  addComment: (taskId: string, content: string) => Promise<Comment | null>;
  deleteComment: (commentId: string, taskId: string) => Promise<void>;
  
  showAddProjectModal: boolean;
  setShowAddProjectModal: (show: boolean) => void;
  showAddTaskModalForProject: string | null; // projectId or null
  setShowAddTaskModalForProject: (projectId: string | null) => void;
  showCreateUserModal: boolean;
  setShowCreateUserModal: (show: boolean) => void;
  showManageAccessModal: boolean;
  setShowManageAccessModal: (show: boolean) => void;

  editingProject: ProjectColumn | null;
  setEditingProject: (project: ProjectColumn | null) => void;
  editingTask: Task | null;
  setEditingTask: (task: Task | null) => void;
  viewingTaskComments: Task | null;
  setViewingTaskComments: (task: Task | null) => void;

  confirmationModalState: ConfirmationModalState;
  showConfirmationModal: (title: string, message: string, onConfirmAction: () => void, confirmText?: string, cancelText?: string) => void;
  hideConfirmationModal: () => void;
  handleConfirmDeletion: () => void; 

  requestProjectDeletion: (projectId: string) => void;
  requestTaskDeletion: (taskId: string, projectId: string) => void;

  searchTerm: string;
  setSearchTerm: (term: string) => void;
}
