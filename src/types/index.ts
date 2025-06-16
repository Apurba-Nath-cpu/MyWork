
export enum UserRole {
  ADMIN = 'ADMIN',
  MAINTAINER = 'MAINTAINER',
  MEMBER = 'MEMBER',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigneeIds: string[]; // User IDs
  eta: string; // ISO date string or human-readable
  projectId: string;
  // Fields from TaskFlow that are not in this new types.ts, but were in old one
  deadline?: string; 
  importance?: TaskImportance; // Need TaskImportance if used
  emoji?: string;
  priorityScore?: number;
  reason?: string;
  order?: number; // For maintaining order within a column
}

// Added from original TaskFlow types
export type TaskImportance = 'low' | 'medium' | 'high';


export interface ProjectColumn {
  id: string; // Project ID
  title: string;
  taskIds: string[]; // Ordered list of task IDs
  maintainerIds: string[]; // User IDs of maintainers
  // order?: number; // Not in user provided type, but common for column ordering
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
}

export interface ConfirmationModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirmAction: (() => void) | null;
  confirmText?: string;
  cancelText?: string;
}
