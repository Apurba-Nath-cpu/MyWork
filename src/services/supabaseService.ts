
import { createClient, SupabaseClient, Session, User as SupabaseAuthUser, AuthError, PostgrestError } from '@supabase/supabase-js';
import type { BoardData, ProjectColumn, Task, User, UserRole } from '../types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const SCRIPT_ERROR_MESSAGE = 'Supabase URL or Anon Key is not configured. Please check your .env file. App may not work correctly.';
  console.error(SCRIPT_ERROR_MESSAGE);
  // Avoid alert in server-side or build environments
  if (typeof window !== 'undefined') {
    alert(SCRIPT_ERROR_MESSAGE);
  }
  throw new Error(SCRIPT_ERROR_MESSAGE);
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Custom Error type to include more specific error info
export interface SignUpError extends AuthError {
  isEmailConflict?: boolean;
}

export interface CreateUserAccountError extends PostgrestError {
  isEmailConflict?: boolean;
}


// --- Authentication Functions ---
export const signUpUser = async (email: string, password: string, name: string, role: UserRole, avatarFile?: File): 
  Promise<{ success: boolean; error: SignUpError | null; user: SupabaseAuthUser | null }> => {
  console.log("Supabase: Signing up user", { email, name, role });
  // Step 1: Sign up the user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

  if (authError || !authData.user) {
    console.error("Error signing up (Supabase Auth):", authError);
    const signUpError: SignUpError = {
        ...(authError || {}), // Spread authError if it exists
        message: authError?.message || "Authentication sign up failed.",
        isEmailConflict: authError?.message.toLowerCase().includes("user already registered") || authError?.message.toLowerCase().includes("email link is invalid or has expired"), 
    } as SignUpError;
    return { success: false, error: signUpError, user: null };
  }
  const authUser = authData.user;

  // Step 2: Upload avatar if provided
  let avatarPublicUrl: string | undefined = undefined;
  if (avatarFile) {
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${authUser.id}.${fileExt}`; 
    const filePath = `avatars/${fileName}`;
    
    console.log(`Supabase: Uploading avatar to ${filePath}`);
    const { error: uploadError } = await supabase.storage
      .from('avatars') 
      .upload(filePath, avatarFile, {
        cacheControl: '3600',
        upsert: true, 
      });

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError);
      // Specific log for common bucket issue:
      if (uploadError.message.toLowerCase().includes("bucket not found")) {
        console.error("AVATAR UPLOAD FAILED: The 'avatars' bucket was not found in Supabase Storage. Please create it.");
      }
    } else {
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      avatarPublicUrl = publicUrlData?.publicUrl;
      console.log('Supabase: Avatar uploaded, public URL:', avatarPublicUrl);
    }
  }

  // Step 3: Create a corresponding profile in the public.users table
  console.log(`Supabase: Creating profile in public.users for user ID: ${authUser.id}`);
  const { error: profileError } = await supabase
    .from('users')
    .insert([{ 
      id: authUser.id, 
      name, 
      email: authUser.email, 
      role, 
      avatar_url: avatarPublicUrl 
    }]);

  if (profileError) {
    console.error("Error creating user profile in public.users:", profileError);
    const signUpError: SignUpError = {
        message: profileError.message || "Failed to create user profile.",
        name: "ProfileCreationError",
        status: (profileError as PostgrestError).code ? parseInt((profileError as PostgrestError).code) : undefined,
        isEmailConflict: (profileError as PostgrestError).code === '23505', // PostgreSQL unique violation
    } as SignUpError;
    return { success: false, error: signUpError, user: authUser };
  }
  
  console.log('Supabase: User signed up and profile created successfully.');
  return { success: true, error: null, user: authUser };
};

export const signInUser = async (email: string, password: string): 
  Promise<{ success: boolean; error: AuthError | null; user: SupabaseAuthUser | null }> => {
  console.log("Supabase: Signing in user", { email });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { success: false, error, user: null };
  }
  return { success: true, error: null, user: data.user };
};

export const signOutUser = async (): Promise<{ error: AuthError | null }> => {
  console.log("Supabase: Signing out user");
  return await supabase.auth.signOut();
};

export const onAuthStateChange = (callback: (event: string, session: Session | null) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};

export const getSession = async () => {
  return await supabase.auth.getSession();
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  console.log("Supabase: Fetching user profile from public.users for ID:", userId);
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, avatar_url') // Explicitly select columns matching User type
    .eq('id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116: "Searched item was not found" - not an error if user profile doesn't exist yet
    console.error("Error fetching user profile:", error);
  }
  if (data) {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role as UserRole, // Assume role from DB matches enum
      avatarUrl: data.avatar_url,
    };
  }
  return null;
};

export const createUserAccount = async (name: string, email: string, role: UserRole): 
  Promise<{user: User | null; error: CreateUserAccountError | null}> => {
  console.log("Supabase Admin: Creating user profile in public.users", { name, email, role });
  if (!email.includes('@')) { // Basic client-side check, server will also validate
    console.error("Supabase Admin: Invalid email format for user profile creation.");
    const errorObj = { message: "Invalid email format.", code: "22000", details: "", hint: "" } as CreateUserAccountError; // Generic code for bad input
    return { user: null, error: errorObj };
  }
  const avatarUrl = `https://picsum.photos/seed/${encodeURIComponent(email)}/40/40`; 

  const { data, error } = await supabase
    .from('users')
    .insert([{ name, email, role, avatar_url: avatarUrl }]) 
    .select('id, name, email, role, avatar_url')
    .single();

  if (error) {
    const createUserError: CreateUserAccountError = {
      ...(error as PostgrestError),
      isEmailConflict: (error as PostgrestError).code === '23505', // PostgreSQL unique violation
    };
    if (createUserError.isEmailConflict) { 
      console.warn(`Supabase Admin: User profile with email ${email} already exists in public.users.`);
    } else {
      console.error("Supabase Admin: Error creating user profile in public.users:", createUserError);
    }
    return { user: null, error: createUserError };
  }
  console.log("Supabase Admin: User profile created in public.users:", data);
  if (data) {
    return { 
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role as UserRole,
        avatarUrl: data.avatar_url,
      }, 
      error: null 
    };
  }
  return { user: null, error: { message: "Unknown error creating user profile", code: "00000", details:"", hint:"" } as CreateUserAccountError };
};

export const getUsers = async (): Promise<User[]> => {
  console.log("Supabase: Fetching all user profiles from public.users");
  const { data, error } = await supabase.from('users').select('id, name, email, role, avatar_url').order('name');
  if (error) {
    console.error("Error fetching all user profiles:", error);
    return [];
  }
  return (data || []).map(d => ({
      id: d.id,
      name: d.name,
      email: d.email,
      role: d.role as UserRole,
      avatarUrl: d.avatar_url,
  }));
};

export const getBoardData = async (): Promise<BoardData> => {
  console.log("Supabase: Fetching board data");
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .order('order_index');

  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
    throw projectsError;
  }

  const { data: tasksData, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .order('project_id') 
    .order('order_index');


  if (tasksError) {
    console.error("Error fetching tasks:", tasksError);
    throw tasksError;
  }

  const boardData: BoardData = {
    projects: {},
    tasks: {},
    projectOrder: [],
  };

  (projectsData || []).forEach(project => {
    boardData.projects[project.id] = {
      id: project.id,
      title: project.title,
      maintainerIds: project.maintainer_ids || [],
      taskIds: [], 
    };
    boardData.projectOrder.push(project.id);
  });

  (tasksData || []).forEach(task => {
    boardData.tasks[task.id] = {
      id: task.id,
      projectId: task.project_id,
      title: task.title,
      description: task.description,
      assigneeIds: task.assignee_ids || [],
      eta: task.eta,
    };
    if (boardData.projects[task.project_id]) {
      boardData.projects[task.project_id].taskIds.push(task.id);
    }
  });
  
  // Ensure tasks within each project are sorted by their order_index
  // This should ideally be handled by the DB query `order('project_id, order_index')`
  // but we can double-check here.
  for (const projectId in boardData.projects) {
    const projectTasks = (tasksData || []).filter(t => t.project_id === projectId)
                                     .sort((a,b) => a.order_index - b.order_index);
    boardData.projects[projectId].taskIds = projectTasks.map(t => t.id);
  }
  
  return boardData;
};

export const createProject = async (title: string, maintainerIds: string[], orderIndex: number): Promise<ProjectColumn | null> => {
  console.log("Supabase: Creating project", { title, maintainerIds, orderIndex });
  const { data, error } = await supabase
    .from('projects')
    .insert([{ title, maintainer_ids: maintainerIds, order_index: orderIndex }])
    .select()
    .single();

  if (error) {
    console.error("Error creating project:", error);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    maintainerIds: data.maintainer_ids || [],
    taskIds: [], // New project has no tasks initially
  };
};

export const updateProject = async (updatedProject: ProjectColumn): Promise<boolean> => {
  console.log("Supabase: Updating project", updatedProject.id);
  const { error } = await supabase
    .from('projects')
    .update({ 
      title: updatedProject.title, 
      maintainer_ids: updatedProject.maintainerIds 
      // taskIds and order_index are handled separately
    })
    .eq('id', updatedProject.id);

  if (error) {
    console.error("Error updating project:", error);
    return false;
  }
  return true;
};

export const deleteProject = async (projectId: string): Promise<boolean> => {
  console.log("Supabase: Deleting project", projectId);
  // Note: RLS policies should handle cascading deletes of tasks if set up,
  // otherwise tasks might need to be deleted manually or via a DB function.
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) {
    console.error("Error deleting project:", error);
    return false;
  }
  return true;
};

export const createTask = async (projectId: string, title: string, description: string | undefined, assigneeIds: string[], eta: string | undefined, orderIndex: number): Promise<Task | null> => {
  console.log("Supabase: Creating task", { projectId, title, orderIndex });
  const taskToInsert = { 
      project_id: projectId, 
      title, 
      description: description || null, 
      assignee_ids: assigneeIds.length > 0 ? assigneeIds : null, 
      eta: eta || null, 
      order_index: orderIndex 
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert([taskToInsert])
    .select()
    .single();
  
  if (error) {
    console.error("Error creating task:", error);
    return null;
  }
  if(!data) return null;
  return {
    id: data.id,
    projectId: data.project_id,
    title: data.title,
    description: data.description,
    assigneeIds: data.assignee_ids || [],
    eta: data.eta,
    // order: data.order_index // Assuming type Task has order property
  };
};

export const updateTask = async (updatedTask: Task): Promise<boolean> => {
  console.log("Supabase: Updating task", updatedTask.id);
  const { error } = await supabase
    .from('tasks')
    .update({
      title: updatedTask.title,
      description: updatedTask.description || null,
      assignee_ids: updatedTask.assigneeIds.length > 0 ? updatedTask.assigneeIds : null,
      eta: updatedTask.eta || null,
      project_id: updatedTask.projectId,
      // order_index is handled by specific reordering functions
    })
    .eq('id', updatedTask.id);

  if (error) {
    console.error("Error updating task:", error);
    return false;
  }
  return true;
};

export const deleteTask = async (taskId: string): Promise<boolean> => {
  console.log("Supabase: Deleting task", taskId);
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) {
    console.error("Error deleting task:", error);
    return false;
  }
  return true;
};

export const updateProjectOrder = async (projectOrder: string[]): Promise<boolean> => {
  console.log("Supabase: Updating project order");
  const updates = projectOrder.map((projectId, index) => 
    supabase.from('projects').update({ order_index: index }).eq('id', projectId)
  );
  try {
    // Supabase recommends batching, but for simplicity, Promise.all is used.
    // For large numbers of projects, consider a stored procedure or fewer calls.
    const results = await Promise.all(updates);
    for (const res of results) {
      if (res.error) throw res.error;
    }
    return true;
  } catch (error) {
    console.error("Error updating project order:", error);
    return false;
  }
};

export const updateTaskOrderInProject = async (projectId: string, taskIds: string[]): Promise<boolean> => {
  console.log(`Supabase: Updating task order in project ${projectId}`);
  const updates = taskIds.map((taskId, index) =>
    supabase.from('tasks').update({ order_index: index, project_id: projectId }).eq('id', taskId)
  );
  try {
    const results = await Promise.all(updates);
    for (const res of results) {
      if (res.error) throw res.error;
    }
    return true;
  } catch (error) {
    console.error(`Error updating task order for project ${projectId}:`, error);
    return false;
  }
};

export const updateTaskProjectAndOrder = async (
  taskId: string, 
  newProjectId: string, 
  newTaskIdsInNewProject: string[], // This should be the complete, final ordered list of task IDs for the new project
): Promise<boolean> => {
  console.log(`Supabase: Moving task ${taskId} to project ${newProjectId} and updating order.`);
  
  const taskNewOrderIndex = newTaskIdsInNewProject.indexOf(taskId);
  if (taskNewOrderIndex === -1) {
    console.error(`Task ${taskId} not found in newTaskIdsInNewProject for project ${newProjectId}. Aborting move.`);
    return false;
  }

  // Step 1: Update the target task's project_id and its specific order_index in the new project.
  const { error: updateError } = await supabase
    .from('tasks')
    .update({ project_id: newProjectId, order_index: taskNewOrderIndex })
    .eq('id', taskId);

  if (updateError) {
    console.error(`Error moving task ${taskId} to project ${newProjectId}:`, updateError);
    return false;
  }

  // Step 2: Re-order all tasks in the new project (including the moved one) to ensure consistency.
  // This loop ensures every task in the new list has its correct order_index.
  const newProjectOrderUpdates = newTaskIdsInNewProject.map((id, index) =>
    supabase.from('tasks').update({ order_index: index }).eq('id', id).eq('project_id', newProjectId)
  );

  try {
    const results = await Promise.all(newProjectOrderUpdates);
    for (const res of results) {
      if (res.error) throw res.error; // If any individual update fails, throw to catch block
    }
    console.log(`Successfully updated order for all tasks in project ${newProjectId}.`);
    return true;
  } catch (error) {
    console.error(`Error finalizing task order in new project ${newProjectId} after move:`, error);
    // Potentially try to revert the task's project_id change if this fails, though that adds complexity.
    return false;
  }
};
