export type TaskImportance = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline?: string; // ISO string
  importance: TaskImportance;
  emoji?: string;
  priorityScore?: number;
  reason?: string;
  order: number; // For maintaining order within a column
}

export interface Column {
  id: string;
  title: string;
  tasks: Task[];
}
