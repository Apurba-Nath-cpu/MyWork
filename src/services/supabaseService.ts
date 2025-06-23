
import { createClient, type SupabaseClient, type Session, type User as SupabaseAuthUser, type AuthError as SupabaseAuthError, type PostgrestError as SupabasePostgrestError } from '@supabase/supabase-js';
import { type BoardData, type ProjectColumn, type Task, type User, UserRole, ProjectRole, TaskStatus, TaskPriority, type Organization, type Comment, type ProjectMembership } from '../types';
import type { SignUpError, CreateUserAccountError } from '../types'; // Use extended types

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Conditionally initialize Supabase client
export const supabase: SupabaseClient | null = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!supabase) {
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

  // Step 0: Check if organization name already exists
  const { data: existingOrg, error: existingOrgQueryError } = await supabase
    .from('organizations')
    .select('id')
    .eq('name', organizationName)
    .maybeSingle();

  if (existingOrgQueryError && existingOrgQueryError.code !== 'PGRST116') { // PGRST116 is 'Row not found'
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
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: organizationName, admin_id: authUser.id })
    .select('id')
    .single();

  if (orgError || !orgData) {
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

    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      avatarPublicUrl = publicUrlData?.publicUrl;
    }
  }

  // Step 4: Create corresponding profile in public.users table, linking to organization
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
    const signUpError: SignUpError = {
        message: profileError.message || "Failed to create user profile.",
        name: "ProfileCreationError",
        status: (profileError as SupabasePostgrestError).code ? parseInt((profileError as SupabasePostgrestError).code) : undefined,
        isEmailConflict: (profileError as SupabasePostgrestError).code === '23505', // Check if it's a unique constraint violation on email
    } as SignUpError;
    return { success: false, error: signUpError, user: authUser };
  }
  
  return { success: true, error: null, user: authUser };
};

export const signUpUser = async (
  email: string, 
  password: string, 
): Promise<{ success: boolean; error: SignUpError | null; user: SupabaseAuthUser | null }> => {
  let authData: { user: SupabaseAuthUser | null; session: Session | null; } | null = null;
  let authError: SupabaseAuthError | null = null;
  if(!supabase) return { success: false, error: createNotConfiguredError('ConfigurationError'), user: null };
  
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

  //
  return { success: true, error: null, user: authUser };
}

export const signInUser = async (email: string, password: string): 
  Promise<{ success: boolean; error: SupabaseAuthError | null; user: SupabaseAuthUser | null }> => {
  if (!supabase) return { success: false, error: createNotConfiguredError('ConfigurationError'), user: null };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { success: false, error, user: null };
  }
  return { success: true, error: null, user: data.user };
};

export const signOutUser = async (): Promise<{ error: SupabaseAuthError | null }> => {
  if (!supabase) return { error: null };
  return await supabase.auth.signOut();
};

export const onAuthStateChange = (callback: (event: string, session: Session | null) => void) => {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange(callback);
};

export const waitForInitialSession = (): Promise<Session | null> => {
  return new Promise((resolve) => {
    if (!supabase) {
      resolve(null);
      return;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
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
    return { data: { session: null }, error: null };
  }

  if (!supabase) {
    return { data: { session: null }, error: null };
  }

  try {
    const session = await Promise.race([
      waitForInitialSession(), // use the listener-based hydration
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('⏰ Timed out waiting for INITIAL_SESSION')), timeoutMs)
      ),
    ]);


    if (session || retriesLeft <= 0) {
      return { data: { session }, error: null };
    }

  } catch (err: any) {
    if (retriesLeft <= 0) {
      return { data: { session: null }, error: err };
    }
  }

  await new Promise((res) => setTimeout(res, delayMs));
  return getSession(retriesLeft - 1, delayMs, timeoutMs);
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  if (!supabase) return null;
  
  try {
    // Fetch user profile and project memberships in parallel
    const [profileResult, membershipsResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, email, role, avatar_url, organization_id') 
        .eq('id', userId)
        .single(),
      supabase
        .from('project_members')
        .select('project_id, role')
        .eq('user_id', userId)
    ]);

    const { data: profileData, error: profileError } = profileResult;
    const { data: membershipsData, error: membershipsError } = membershipsResult;


    if (profileError) {
      if (profileError.code === 'PGRST116') {
        return null;
      }
      throw profileError;
    }

    if (membershipsError) {
      // We can decide to fail or continue without memberships
      throw membershipsError;
    }
    
    if (profileData) {
      return {
        id: profileData.id,
        name: profileData.name,
        email: profileData.email,
        role: profileData.role as UserRole,
        avatarUrl: profileData.avatar_url,
        organization_id: profileData.organization_id,
        projectMemberships: (membershipsData || []).map(m => ({
          projectId: m.project_id,
          role: m.role as ProjectRole,
        })),
      };
    }
    
    return null;
  } catch (error) {
    throw error;
  }
};


export const createUserAccount = async (id: string, name: string, email: string, role: UserRole, organizationId: string): 
  Promise<{user: User | null; error: CreateUserAccountError | null}> => {
  if (!supabase) return { user: null, error: createNotConfiguredError('ConfigurationError') as CreateUserAccountError };
  
  if (!email.includes('@')) {
    const errorObj: CreateUserAccountError = { message: "Invalid email format.", code: "22000", details: "", hint: "" }; 
    return { user: null, error: errorObj };
  }

  const avatarUrl = `https://picsum.photos/seed/${encodeURIComponent(email)}/40/40`; 

  const { data, error: insertError } = await supabase
    .from('users')
    .upsert([{ 
      id,
      name, 
      email, 
      role, 
      avatar_url: avatarUrl, 
      organization_id: organizationId 
    }], { 
      onConflict: 'email',
      ignoreDuplicates: false 
    })
    .select('id, name, email, role, avatar_url, organization_id')
    .single();

  if (insertError) {
    const finalError: CreateUserAccountError = {
      ...(insertError as SupabasePostgrestError),
      isEmailConflict: insertError.code === '23505' && (
        insertError.message.includes('users_email_key') || 
        insertError.message.includes('users_email_unique')
      ), 
      isUsernameConflictInOrg: insertError.code === '23505' && insertError.message.includes('users_name_organization_id_unique'),
    };
    return { user: null, error: finalError };
  }

  if (data) {
    return { 
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role as UserRole,
        avatarUrl: data.avatar_url,
        organization_id: data.organization_id,
        projectMemberships: [], // New user has no memberships yet
      }, 
      error: null 
    };
  }
  return { user: null, error: { message: "Unknown error creating user profile", code: "00000", details:"", hint:"" } as CreateUserAccountError };
};

export const getUsers = async (organizationId: string): Promise<User[]> => {
  if (!supabase) return [];
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, name, email, role, avatar_url, organization_id')
    .eq('organization_id', organizationId)
    .order('name');
  
  if (usersError) {
    return [];
  }
  if (!usersData) return [];

  // Fetch all project memberships for the users in the organization
  const userIds = usersData.map(u => u.id);
  const { data: membershipsData, error: membershipsError } = await supabase
    .from('project_members')
    .select('user_id, project_id, role')
    .in('user_id', userIds);

  if (membershipsError) {
    // Fail gracefully, return users without memberships.
    return usersData.map(d => ({
        id: d.id,
        name: d.name,
        email: d.email,
        role: d.role as UserRole,
        avatarUrl: d.avatar_url,
        organization_id: d.organization_id,
        projectMemberships: [],
    }));
  }

  const membershipsByUserId = new Map<string, ProjectMembership[]>();
  (membershipsData || []).forEach(m => {
    const userMemberships = membershipsByUserId.get(m.user_id) || [];
    userMemberships.push({ projectId: m.project_id, role: m.role as ProjectRole });
    membershipsByUserId.set(m.user_id, userMemberships);
  });

  return (usersData || []).map(d => ({
      id: d.id,
      name: d.name,
      email: d.email,
      role: d.role as UserRole,
      avatarUrl: d.avatar_url,
      organization_id: d.organization_id,
      projectMemberships: membershipsByUserId.get(d.id) || [],
  }));
};

export const getBoardData = async (organizationId: string): Promise<BoardData> => {
  if (!supabase) return { tasks: {}, projects: {}, projectOrder: [] };
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .order('order_index');

  if (projectsError) {
    throw projectsError;
  }

  const projectIds = (projectsData || []).map(p => p.id);
  let tasksData: any[] = []; 
  let tasksError: SupabasePostgrestError | null = null;

  if (projectIds.length > 0) {
      // Use the view to get comment counts
      const { data, error } = await supabase
        .from('tasks_with_comment_count')
        .select('*') 
        .in('project_id', projectIds)
        .order('project_id') 
        .order('order_index');
      tasksData = data || [];
      tasksError = error;
  }

  if (tasksError) {
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
      commentCount: task.comment_count,
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

export const createProject = async (title: string, orderIndex: number, organizationId: string): Promise<ProjectColumn | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('projects')
    .insert([{ title, order_index: orderIndex, organization_id: organizationId }])
    .select()
    .single();

  if (error) {
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    taskIds: [],
    organization_id: data.organization_id,
  };
};

export const updateProject = async (updatedProject: Omit<ProjectColumn, 'taskIds'>): Promise<boolean> => {
  if (!supabase) return false;
  const { error } = await supabase
    .from('projects')
    .update({ 
      title: updatedProject.title, 
    })
    .eq('id', updatedProject.id);

  if (error) {
    return false;
  }
  return true;
};

export const deleteProject = async (projectId: string): Promise<boolean> => {
  if (!supabase) return false;
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) {
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
    commentCount: 0,
  };
};

export const updateTask = async (updatedTask: Task): Promise<boolean> => {
  if (!supabase) return false;
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
    return false;
  }
  return true;
};

export const deleteTask = async (taskId: string): Promise<boolean> => {
  if (!supabase) return false;
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) {
    return false;
  }
  return true;
};

export const updateProjectOrder = async (projectOrder: string[]): Promise<boolean> => {
  if (!supabase) return false;
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
    return false;
  }
};

export const updateTaskOrderInProject = async (projectId: string, taskIds: string[]): Promise<boolean> => {
  if (!supabase) return false;
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
    return false;
  }
};

export const updateTaskProjectAndOrder = async (
  taskId: string, 
  newProjectId: string, 
  newTaskIdsInNewProject: string[],
): Promise<boolean> => {
  if (!supabase) return false;
  
  const taskNewOrderIndex = newTaskIdsInNewProject.indexOf(taskId);
  if (taskNewOrderIndex === -1) {
    return false;
  }

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ project_id: newProjectId, order_index: taskNewOrderIndex })
    .eq('id', taskId);

  if (updateError) {
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
    return false;
  }
};

export const getCommentsForTask = async (taskId: string): Promise<Comment[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('comments')
    .select(`
      id,
      content,
      created_at,
      user_id,
      users ( id, name, avatar_url, role )
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      taskId: taskId,
      userId: c.user_id,
      user: {
          id: c.users.id,
          name: c.users.name,
          avatarUrl: c.users.avatar_url,
          role: c.users.role as UserRole,
      }
  }));
};

export const addComment = async (taskId: string, userId: string, content: string): Promise<Comment | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('comments')
    .insert({ task_id: taskId, user_id: userId, content })
    .select(`
      id,
      content,
      created_at,
      user_id,
      users ( id, name, avatar_url, role )
    `)
    .single();
  
  if (error) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = data as any;
  return {
    id: c.id,
    content: c.content,
    createdAt: c.created_at,
    taskId: taskId,
    userId: c.user_id,
    user: {
      id: c.users.id,
      name: c.users.name,
      avatarUrl: c.users.avatar_url,
      role: c.users.role as UserRole,
    }
  };
};

export const deleteComment = async (commentId: string): Promise<boolean> => {
  if (!supabase) return false;
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) {
    return false;
  }
  return true;
};
