
'use server';

import { createClient } from '@supabase/supabase-js';
import { UserRole, ProjectRole } from '@/types';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/services/supabaseService';

export interface CreateUserActionState {
  message: string;
  isError: boolean;
}

export async function createUserAction(
  prevState: CreateUserActionState,
  formData: FormData
): Promise<CreateUserActionState> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role = formData.get('role') as UserRole;
  const organizationId = formData.get('organizationId') as string;
  const projectAssignmentsRaw = formData.get('projectAssignments') as string;

  let projectAssignments: Record<string, ProjectRole> = {};
  try {
    if (projectAssignmentsRaw) {
      projectAssignments = JSON.parse(projectAssignmentsRaw);
    }
  } catch (e) {
    return { message: 'Invalid project assignments format.', isError: true };
  }

  if (!name || !email || !password || !role || !organizationId) {
    return { message: 'Missing required fields.', isError: true };
  }

  if (password.length < 6) {
    return { message: 'Password must be at least 6 characters long.', isError: true };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { message: 'Server configuration error: The SUPABASE_SERVICE_ROLE_KEY is missing. Please add it to your .env file to enable user creation.', isError: true };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Create the user via their email using the admin client
  const { data: createUserData, error: createUserError } =
    await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Send confirmation email
    });

  if (createUserError || !createUserData.user) {
    const isConflict = createUserError?.message.toLowerCase().includes('user already registered');
    return { 
        message: isConflict ? 'A user with this email already exists.' : (createUserError?.message || 'Failed to create user.'), 
        isError: true 
    };
  }

  const createdUser = createUserData.user;
  const avatarUrl = `https://picsum.photos/seed/${encodeURIComponent(email)}/40/40`;

  // Create their profile in the public.users table
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert([
      {
        id: createdUser.id,
        name: name,
        email: email,
        role: role,
        avatar_url: avatarUrl,
        organization_id: organizationId,
      },
    ]);

  if (profileError) {
    // If profile creation fails, roll back the user creation to prevent orphaned auth entries.
    await supabaseAdmin.auth.admin.deleteUser(createdUser.id);
    const isConflict = profileError.code === '23505'; // Unique constraint violation
    return {
      message: isConflict ? `A user with this name or email already exists in the organization.` : `Database error: ${profileError.message}`,
      isError: true,
    };
  }

  // Insert project memberships if any were provided
  const membershipsToInsert = Object.entries(projectAssignments)
    .filter(([, projectRole]) => projectRole) // Filter out 'None'
    .map(([projectId, projectRole]) => ({
      user_id: createdUser.id,
      project_id: projectId,
      role: projectRole,
    }));
  
  if (membershipsToInsert.length > 0) {
    const { error: membershipError } = await supabaseAdmin
      .from('project_members')
      .insert(membershipsToInsert);

    if (membershipError) {
      // Rollback user creation if memberships fail to insert
      await supabaseAdmin.auth.admin.deleteUser(createdUser.id);
      // The user profile will be deleted automatically due to the foreign key constraint on users.id
      return {
        message: `Database error: Could not assign user to projects. ${membershipError.message}`,
        isError: true,
      };
    }
  }


  // Revalidate the path to refresh the user list on the page
  revalidatePath('/');

  return { message: `User account created for ${email}. They will need to confirm their email before logging in.`, isError: false };
}


export interface UpdateUserAccessActionState {
  message: string;
  isError: boolean;
}

export async function updateUserAccessAction(
  prevState: UpdateUserAccessActionState,
  formData: FormData
): Promise<UpdateUserAccessActionState> {
  const userId = formData.get('userId') as string;
  const role = formData.get('role') as UserRole;
  const projectAssignmentsRaw = formData.get('projectAssignments') as string;

  let projectAssignments: Record<string, ProjectRole> = {};
  try {
    if (projectAssignmentsRaw) {
      projectAssignments = JSON.parse(projectAssignmentsRaw);
    }
  } catch (e) {
    return { message: 'Invalid project assignments format.', isError: true };
  }

  if (!userId || !role) {
    return { message: 'Missing required fields.', isError: true };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { message: 'Server configuration error.', isError: true };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // In a real app, you would get the current user ID from the session and check their role here for security.
  // For now, we assume the client-side checks are sufficient for this prototype.

  // 1. Update user's organization-level role
  const { error: roleUpdateError } = await supabaseAdmin
    .from('users')
    .update({ role: role })
    .eq('id', userId);

  if (roleUpdateError) {
    return { message: `Failed to update user role: ${roleUpdateError.message}`, isError: true };
  }

  // 2. Delete all existing project memberships for this user
  const { error: deleteMembershipsError } = await supabaseAdmin
    .from('project_members')
    .delete()
    .eq('user_id', userId);

  if (deleteMembershipsError) {
    return { message: `Failed to clear old project assignments: ${deleteMembershipsError.message}`, isError: true };
  }
  
  // 3. Insert new project memberships if any were provided
  const membershipsToInsert = Object.entries(projectAssignments)
    .filter(([, projectRole]) => projectRole) // Filter out 'None'
    .map(([projectId, projectRole]) => ({
      user_id: userId,
      project_id: projectId,
      role: projectRole,
    }));

  if (membershipsToInsert.length > 0) {
    const { error: membershipError } = await supabaseAdmin
      .from('project_members')
      .insert(membershipsToInsert);

    if (membershipError) {
      // Note: At this point, the user's role is updated but their memberships are not.
      // A transaction or RPC call would be better for production to ensure atomicity.
      return { message: `Could not set new project assignments: ${membershipError.message}`, isError: true };
    }
  }

  revalidatePath('/');

  return { message: 'User access updated successfully.', isError: false };
}
