
import { createClient, type SupabaseClient, type Session, type User as SupabaseAuthUser, type AuthError as SupabaseAuthError, type PostgrestError as SupabasePostgrestError } from '@supabase/supabase-js';
import { type BoardData, type ProjectColumn, type Task, type User, UserRole, TaskStatus, TaskPriority, type Organization } from '../types';
import type { SignUpError, CreateUserAccountError } from '../types'; // Use extended types

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Conditionally initialize Supabase client
export const supabase: SupabaseClient | null = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!supabase) {
  console.error('Supabase URL or Anon Key is not configured. Please check your .env file. The application will not connect to Supabase, but will continue to run.');
}

const createNotConfiguredError = (name: string) => ({
  name,
  message: "Supabase client is not configured. Please check environment variables.",
});


// --- Authentication & Organization Functions ---
export const signUpUserAndCreateOrg = async (
  email: string, 
  password: string, 
  name: string, 
  organizationName: string, 
  avatarFile?: File
): Promise<{ success: boolean; error: SignUpError | null; user: SupabaseAuthUser | null }> => {
  if (!supabase) {
    return { success: false, error: createNotConfiguredError('ConfigurationError') as SignUpError, user: null };
  }
  console.log("Supabase: Signing up user and creating organization", { email, name, organizationName });

  // Step 0: Check if organization name already exists
  const { data: existingOrg, error: existingOrgQueryError } = await supabase
    .from('organizations')
    .select('id')
    .eq('name', organizationName)
    .maybeSingle();

  if (existingOrgQueryError && existingOrgQueryError.code !== 'PGRST116') { // PGRST116 is 'Row not found'
    console.error("Error checking for existing organization name:", existingOrgQueryError);
    return { 
        success: false, 
        error: { name: "OrgQueryError", message: existingOrgQueryError.message } as SignUpError, 
        user: null 
    };
  }
  if (existingOrg) {
    return { 
        success: false, 
        error: { name: "OrgNameConflictError", message: "Organization name already exists.", isOrgNameConflict: true } as SignUpError, 
        user: null 
    };
  }
  
  let authData: { user: SupabaseAuthUser | null; session: Session | null; } | null = null;
  let authError: SupabaseAuthError | null = null;

  // Step 1: Sign up the user with Supabase Auth
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });
    authData = data;
    authError = error;
  } catch (e) {
    if (e instanceof Error) {
        authError = { name: 'UnexpectedSignUpError', message: e.message } as SupabaseAuthError;
    } else {
        authError = { name: 'UnexpectedSignUpError', message: 'An unknown error occurred during sign up.' } as SupabaseAuthError;
    }
  }  

  if (authError || !authData?.user) {
    const signUpError: SignUpError = {
        ...(authError || { name: 'UnknownAuthError', message: 'Authentication sign up failed.' }), 
        message: authError?.message || "Authentication sign up failed.",
        isEmailConflict: authError?.message.toLowerCase().includes("user already registered") || authError?.message.toLowerCase().includes("email link is invalid or has expired"), 
    } as SignUpError;
    return { success: false, error: signUpError, user: null };
  }
  const authUser = authData.user;

  // Step 2: Create Organization
  console.log(`Supabase: Creating organization "${organizationName}" for admin ID: ${authUser.id}`);
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: organizationName, admin_id: authUser.id })
    .select('id')
    .single();

  if (orgError || !orgData) {
    console.error("Error creating organization:", orgError);
    // If org creation fails (e.g. race condition on name if DB constraint is set), report it
     const finalError: SignUpError = { 
        name: "OrganizationCreationError", 
        message: orgError?.message || "Failed to create organization.",
        isOrgNameConflict: orgError?.code === '23505' // PostgreSQL unique violation code
    };
    return { success: false, error: finalError, user: authUser };
  }
  const organizationId = orgData.id;

  // Step 3: Upload avatar if provided
  let avatarPublicUrl: string | undefined = undefined;
  if (avatarFile) {
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${authUser.id}.${fileExt}`; 
    const filePath = `avatars/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars') 
      .upload(filePath, avatarFile, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError);
    } else {
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      avatarPublicUrl = publicUrlData?.publicUrl;
    }
  }

  // Step 4: Create corresponding profile in public.users table, linking to organization
  console.log(`Supabase: Creating profile in public.users for user ID: ${authUser.id}, org ID: ${organizationId}`);
  const { error: profileError } = await supabase
    .from('users')
    .insert([{ 
      id: authUser.id, 
      name, 
      email: authUser.email, 
      role: UserRole.ADMIN, 
      avatar_url: avatarPublicUrl,
      organization_id: organizationId
    }]);

  if (profileError) {
    console.error("Error creating user profile in public.users:", profileError);
    const signUpError: SignUpError = {
        message: profileError.message || "Failed to create user profile.",
        name: "ProfileCreationError",
        status: (profileError as SupabasePostgrestError).code ? parseInt((profileError as SupabasePostgrestError).code) : undefined,
        isEmailConflict: (profileError as SupabasePostgrestError).code === '23505', // Check if it's a unique constraint violation on email
    } as SignUpError;
    return { success: false, error: signUpError, user: authUser };
  }
  
  console.log('Supabase: User signed up, organization created, and profile created successfully.');
  return { success: true, error: null, user: authUser };
};

export const signInUser = async (email: string, password: string): 
  Promise<{ success: boolean; error: SupabaseAuthError | null; user: SupabaseAuthUser | null }> => {
  if (!supabase) return { success: false, error: createNotConfiguredError('ConfigurationError'), user: null };
  console.log("Supabase: Signing in user", { email });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { success: false, error, user: null };
  }
  return { success: true, error: null, user: data.user };
};

export const signOutUser = async (): Promise<{ error: SupabaseAuthError | null }> => {
  if (!supabase) return { error: null };
  console.log("Supabase: Signing out user");
  return await supabase.auth.signOut();
};

export const onAuthStateChange = (callback: (event: string, session: Session | null) => void) => {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange(callback);
};

export const waitForInitialSession = (): Promise<Session | null> => {
  return new Promise((resolve) => {
    if (!supabase) {
      console.warn('🛑 Supabase is not initialized.');
      resolve(null);
      return;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('📦 Auth state change event:', event);
        // if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
          console.log('🎯 Received INITIAL_SESSION');
          resolve(session ?? null);
          subscription.subscription.unsubscribe();
        // }
      }
    );
  });
};


export const getSession = async (
  retriesLeft = 10,
  delayMs = 100,
  timeoutMs = 300
): Promise<{ data: { session: Session | null }, error: any }> => {
  if (typeof window === 'undefined') {
    console.log('⛔ Not in browser');
    return { data: { session: null }, error: null };
  }

  if (!supabase) {
    console.log('🔴 Supabase not initialized');
    return { data: { session: null }, error: null };
  }

  try {
    const session = await Promise.race([
      waitForInitialSession(), // use the listener-based hydration
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('⏰ Timed out waiting for INITIAL_SESSION')), timeoutMs)
      ),
    ]);

    console.log('📦 Final session:', session);

    if (session || retriesLeft <= 0) {
      return { data: { session }, error: null };
    }

    console.log(`🔁 Retrying... attempts left: ${retriesLeft - 1}`);
  } catch (err: any) {
    console.warn(`⚠️ Error or timeout: ${err.message}`);
    if (retriesLeft <= 0) {
      return { data: { session: null }, error: err };
    }
  }

  await new Promise((res) => setTimeout(res, delayMs));
  return getSession(retriesLeft - 1, delayMs, timeoutMs);
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  if (!supabase) return null;
  console.log("Supabase: Fetching user profile from public.users for ID:", userId);
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, avatar_url, organization_id') 
    .eq('id', userId)
    .single();

  console.log('📦 getUserProfile:', data, error);
  
  if (error && error.code !== 'PGRST116') { 
    console.error("Error fetching user profile:", error);
  }
  if (data) {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role as UserRole,
      avatarUrl: data.avatar_url,
      organization_id: data.organization_id,
    };
  }
  return null;
};

export const createUserAccount = async (name: string, email: string, role: UserRole, organizationId: string): 
  Promise<{user: User | null; error: CreateUserAccountError | null}> => {
  if (!supabase) return { user: null, error: createNotConfiguredError('ConfigurationError') as CreateUserAccountError };
  console.log("Supabase Admin: Creating user profile in public.users", { name, email, role, organizationId });
  
  if (!email.includes('@')) {
    const errorObj: CreateUserAccountError = { message: "Invalid email format.", code: "22000", details: "", hint: "" }; 
    return { user: null, error: errorObj };
  }

  // Check for username uniqueness within the organization
  const { data: existingUserByName, error: nameCheckError } = await supabase
    .from('users')
    .select('id')
    .eq('name', name)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (nameCheckError && nameCheckError.code !== 'PGRST116') {
    console.error("Error checking for existing username in org:", nameCheckError);
    return { user: null, error: nameCheckError as CreateUserAccountError };
  }
  if (existingUserByName) {
    return { user: null, error: { message: "Username already exists in this organization.", code: "23505", isUsernameConflictInOrg: true } as CreateUserAccountError };
  }

  // Check for global email uniqueness in public.users
  const { data: existingUserByEmail, error: emailCheckError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (emailCheckError && emailCheckError.code !== 'PGRST116') {
     console.error("Error checking for existing email:", emailCheckError);
    return { user: null, error: emailCheckError as CreateUserAccountError };
  }
  if (existingUserByEmail) {
    return { user: null, error: { message: "Email address is already in use.", code: "23505", isEmailConflict: true } as CreateUserAccountError };
  }

  const avatarUrl = `https://picsum.photos/seed/${encodeURIComponent(email)}/40/40`; 

  const { data, error: insertError } = await supabase
    .from('users')
    .insert([{ name, email, role, avatar_url: avatarUrl, organization_id: organizationId }]) 
    .select('id, name, email, role, avatar_url, organization_id')
    .single();

  if (insertError) {
    const finalError: CreateUserAccountError = {
      ...(insertError as SupabasePostgrestError),
      isEmailConflict: insertError.code === '23505' && insertError.message.includes('users_email_unique'), 
      isUsernameConflictInOrg: insertError.code === '23505' && insertError.message.includes('users_name_organization_id_unique'),
    };
    console.error("Supabase Admin: Error creating user profile in public.users:", finalError);
    return { user: null, error: finalError };
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
        organization_id: data.organization_id,
      }, 
      error: null 
    };
  }
  return { user: null, error: { message: "Unknown error creating user profile", code: "00000", details:"", hint:"" } as CreateUserAccountError };
};

export const deleteUserByAdmin = async (
  userIdToDelete: string,
  adminUserId: string, 
  organizationId: string
): Promise<{ success: boolean; error?: { message: string } }> => {
  if (!supabase) return { success: false, error: createNotConfiguredError('ConfigurationError') };

  if (userIdToDelete === adminUserId) {
    return { success: false, error: { message: "Admin cannot delete themselves through this function." } };
  }

  // Delete from public.users first
  const { error: deleteProfileError } = await supabase
    .from('users')
    .delete()
    .eq('id', userIdToDelete)
    .eq('organization_id', organizationId); // Ensure admin is deleting from their own org

  if (deleteProfileError) {
    console.error("Error deleting user profile from public.users:", deleteProfileError);
    return { success: false, error: { message: `Failed to delete user profile: ${deleteProfileError.message}` } };
  }

  // Attempt to delete from auth.users
  try {
    const { error: deleteAuthUserError } = await supabase.auth.admin.deleteUser(userIdToDelete);
    if (deleteAuthUserError) {
      console.warn(`User profile ${userIdToDelete} deleted, but failed to delete auth user: ${deleteAuthUserError.message}. This may require manual cleanup or a backend admin call.`);
    } else {
      console.log(`User ${userIdToDelete} (profile and auth) deleted by admin ${adminUserId}.`);
    }
  } catch (e: any) {
     console.warn(`User profile ${userIdToDelete} deleted. Error during auth user deletion attempt: ${e.message}. This usually means the client doesn't have admin rights for auth operations.`);
  }

  return { success: true };
};


export const getUsers = async (organizationId: string): Promise<User[]> => {
  if (!supabase) return [];
  console.log(`Supabase: Fetching user profiles from public.users for organization ID: ${organizationId}`);
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, avatar_url, organization_id')
    .eq('organization_id', organizationId)
    .order('name');
  if (error) {
    console.error("Error fetching all user profiles for org:", error);
    return [];
  }
  return (data || []).map(d => ({
      id: d.id,
      name: d.name,
      email: d.email,
      role: d.role as UserRole,
      avatarUrl: d.avatar_url,
      organization_id: d.organization_id,
  }));
};

export const getBoardData = async (organizationId: string): Promise<BoardData> => {
  if (!supabase) return { tasks: {}, projects: {}, projectOrder: [] };
  console.log(`Supabase: Fetching board data for organization ID: ${organizationId}`);
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .order('order_index');

  if (projectsError) {
    console.error("Error fetching projects for org:", projectsError);
    throw projectsError;
  }

  const projectIds = (projectsData || []).map(p => p.id);
  let tasksData: any[] = []; 
  let tasksError: SupabasePostgrestError | null = null;

  if (projectIds.length > 0) {
      const { data, error } = await supabase
        .from('tasks')
        .select('*') 
        .in('project_id', projectIds)
        .order('project_id') 
        .order('order_index');
      tasksData = data || [];
      tasksError = error;
  }


  if (tasksError) {
    console.error("Error fetching tasks for org:", tasksError);
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
      organization_id: project.organization_id,
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
      status: task.status as TaskStatus || TaskStatus.TODO,
      priority: task.priority as TaskPriority || TaskPriority.P2,
      tags: task.tags || [],
    };
    if (boardData.projects[task.project_id]) {
      boardData.projects[task.project_id].taskIds.push(task.id);
    }
  });
  
  for (const projectId in boardData.projects) {
    const projectTasks = (tasksData || []).filter(t => t.project_id === projectId)
                                     .sort((a,b) => a.order_index - b.order_index);
    boardData.projects[projectId].taskIds = projectTasks.map(t => t.id);
  }
  
  return boardData;
};

export const createProject = async (title: string, maintainerIds: string[], orderIndex: number, organizationId: string): Promise<ProjectColumn | null> => {
  if (!supabase) return null;
  console.log("Supabase: Creating project", { title, maintainerIds, orderIndex, organizationId });
  const { data, error } = await supabase
    .from('projects')
    .insert([{ title, maintainer_ids: maintainerIds, order_index: orderIndex, organization_id: organizationId }])
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
    taskIds: [],
    organization_id: data.organization_id,
  };
};

export const updateProject = async (updatedProject: ProjectColumn): Promise<boolean> => {
  if (!supabase) return false;
  console.log("Supabase: Updating project", updatedProject.id);
  const { error } = await supabase
    .from('projects')
    .update({ 
      title: updatedProject.title, 
      maintainer_ids: updatedProject.maintainerIds 
    })
    .eq('id', updatedProject.id);

  if (error) {
    console.error("Error updating project:", error);
    return false;
  }
  return true;
};

export const deleteProject = async (projectId: string): Promise<boolean> => {
  if (!supabase) return false;
  console.log("Supabase: Deleting project", projectId);
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) {
    console.error("Error deleting project:", error);
    return false;
  }
  return true;
};

export const createTask = async (
  projectId: string, 
  title: string, 
  description: string | undefined, 
  assigneeIds: string[], 
  eta: string | undefined, 
  orderIndex: number,
  status: TaskStatus,
  priority: TaskPriority,
  tags: string[]
): Promise<Task | null> => {
  if (!supabase) return null;
  console.log("Supabase: Creating task", { projectId, title, orderIndex, status, priority, tags });
  const taskToInsert = { 
      project_id: projectId, 
      title, 
      description: description || null, 
      assignee_ids: assigneeIds.length > 0 ? assigneeIds : null, 
      eta: eta || null, 
      order_index: orderIndex,
      status: status,
      priority: priority,
      tags: tags.length > 0 ? tags : null,
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
    status: data.status as TaskStatus,
    priority: data.priority as TaskPriority,
    tags: data.tags || [],
  };
};

export const updateTask = async (updatedTask: Task): Promise<boolean> => {
  if (!supabase) return false;
  console.log("Supabase: Updating task", updatedTask.id);
  const { error } = await supabase
    .from('tasks')
    .update({
      title: updatedTask.title,
      description: updatedTask.description || null,
      assignee_ids: updatedTask.assigneeIds.length > 0 ? updatedTask.assigneeIds : null,
      eta: updatedTask.eta || null,
      project_id: updatedTask.projectId,
      status: updatedTask.status,
      priority: updatedTask.priority,
      tags: updatedTask.tags.length > 0 ? updatedTask.tags : null,
    })
    .eq('id', updatedTask.id);

  if (error) {
    console.error("Error updating task:", error);
    return false;
  }
  return true;
};

export const deleteTask = async (taskId: string): Promise<boolean> => {
  if (!supabase) return false;
  console.log("Supabase: Deleting task", taskId);
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) {
    console.error("Error deleting task:", error);
    return false;
  }
  return true;
};

export const updateProjectOrder = async (projectOrder: string[]): Promise<boolean> => {
  if (!supabase) return false;
  console.log("Supabase: Updating project order");
  const updates = projectOrder.map((projectId, index) => 
    supabase.from('projects').update({ order_index: index }).eq('id', projectId)
  );
  try {
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
  if (!supabase) return false;
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
  newTaskIdsInNewProject: string[],
): Promise<boolean> => {
  if (!supabase) return false;
  console.log(`Supabase: Moving task ${taskId} to project ${newProjectId} and updating order.`);
  
  const taskNewOrderIndex = newTaskIdsInNewProject.indexOf(taskId);
  if (taskNewOrderIndex === -1) {
    console.error(`Task ${taskId} not found in newTaskIdsInNewProject for project ${newProjectId}. Aborting move.`);
    return false;
  }

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ project_id: newProjectId, order_index: taskNewOrderIndex })
    .eq('id', taskId);

  if (updateError) {
    console.error(`Error moving task ${taskId} to project ${newProjectId}:`, updateError);
    return false;
  }

  const newProjectOrderUpdates = newTaskIdsInNewProject.map((id, index) =>
    supabase.from('tasks').update({ order_index: index }).eq('id', id).eq('project_id', newProjectId)
  );

  try {
    const results = await Promise.all(newProjectOrderUpdates);
    for (const res of results) {
      if (res.error) throw res.error; 
    }
    return true;
  } catch (error) {
    console.error(`Error finalizing task order in new project ${newProjectId} after move:`, error);
    return false;
  }
};
