
import type { User, BoardData } from '../types';
import { UserRole } from '../types';

export const APP_TITLE = "ProjectFlow";

// Updated MOCK_USERS with placeholder UUIDs
export const MOCK_USERS: User[] = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Alice Admin (Mock)', email: 'admin@example.com', role: UserRole.ADMIN, avatarUrl: 'https://picsum.photos/seed/alice/40/40' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Bob Maintainer (Mock)', email: 'bob@example.com', role: UserRole.MAINTAINER, avatarUrl: 'https://picsum.photos/seed/bob/40/40' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Charlie Member (Mock)', email: 'charlie@example.com', role: UserRole.MEMBER, avatarUrl: 'https://picsum.photos/seed/charlie/40/40' },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Diana Developer (Mock)', email: 'diana@example.com', role: UserRole.MEMBER, avatarUrl: 'https://picsum.photos/seed/diana/40/40' },
  { id: '00000000-0000-0000-0000-000000000005', name: 'Edward Engineer (Mock)', email: 'edward@example.com', role: UserRole.MEMBER, avatarUrl: 'https://picsum.photos/seed/edward/40/40' },
];

// Updated INITIAL_BOARD_DATA to use mock UUIDs for consistency, though this data is primarily for local fallback
// and not directly persisted unless Supabase fetching fails and the app is modified to use it.
export const INITIAL_BOARD_DATA: BoardData = {
  tasks: {
    'task-1': { id: 'task-1', projectId: 'project-1', title: 'Setup project repository', description: 'Initialize git, add readme', assigneeIds: ['00000000-0000-0000-0000-000000000002'], eta: '2024-08-01' },
    'task-2': { id: 'task-2', projectId: 'project-1', title: 'Design database schema', description: 'Plan tables and relations', assigneeIds: ['00000000-0000-0000-0000-000000000003'], eta: '2024-08-05' },
    'task-3': { id: 'task-3', projectId: 'project-1', title: 'Implement authentication', description: 'User login and registration', assigneeIds: ['00000000-0000-0000-0000-000000000004'], eta: '2024-08-10' },
    'task-4': { id: 'task-4', projectId: 'project-2', title: 'Develop homepage UI', description: 'Create wireframes and mockups', assigneeIds: ['00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005'], eta: '2024-08-15' },
    'task-5': { id: 'task-5', projectId: 'project-2', title: 'Write API documentation', description: 'Document all endpoints', assigneeIds: ['00000000-0000-0000-0000-000000000002'], eta: '2024-08-20' },
  },
  projects: {
    'project-1': { id: 'project-1', title: 'Phoenix Project (Initial Mock)', maintainerIds: ['00000000-0000-0000-0000-000000000002'], taskIds: ['task-1', 'task-2', 'task-3'] },
    'project-2': { id: 'project-2', title: 'Marketing Campaign Q3 (Initial Mock)', maintainerIds: ['00000000-0000-0000-0000-000000000002'], taskIds: ['task-4', 'task-5'] },
    'project-3': { id: 'project-3', title: 'Infrastructure Upgrade (Initial Mock)', maintainerIds: [], taskIds: [] },
  },
  projectOrder: ['project-1', 'project-2', 'project-3'],
};

export const DROPPABLE_TYPE_PROJECT = "PROJECT";
export const DROPPABLE_TYPE_TASK = "TASK";

