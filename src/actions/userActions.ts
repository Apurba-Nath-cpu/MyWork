
'use server';

import { createClient } from '@supabase/supabase-js';
import { UserRole, ProjectRole } from '@/types';
import { revalidatePath } from 'next/cache';

export interface InviteUserActionState {
  message: string;
  isError: boolean;
}

export async function inviteUserAction(
  prevState: InviteUserActionState,
  formData: FormData
): Promise<InviteUserActionState> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
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

  if (!name || !email || !role || !organizationId) {
    return { message: 'Missing required fields.', isError: true };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('InviteUserAction: SUPABASE_SERVICE_ROLE_KEY environment variable not set on the server.');
    return { message: 'Server configuration error: The SUPABASE_SERVICE_ROLE_KEY is missing. Please add it to your .env file to enable user invitations.', isError: true };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Invite the user via their email using the admin client
  const { data: inviteData, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email);

  if (inviteError || !inviteData.user) {
    const isConflict = inviteError?.message.toLowerCase().includes('user already registered');
    return { 
        message: isConflict ? 'A user with this email already exists.' : (inviteError?.message || 'Failed to send invitation.'), 
        isError: true 
    };
  }

  const invitedUser = inviteData.user;
  const avatarUrl = `https://picsum.photos/seed/${encodeURIComponent(email)}/40/40`;

  // Create their profile in the public.users table
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert([
      {
        id: invitedUser.id,
        name: name,
        email: email,
        role: role,
        avatar_url: avatarUrl,
        organization_id: organizationId,
      },
    ]);

  if (profileError) {
    // If profile creation fails, roll back the invitation to prevent orphaned auth entries.
    await supabaseAdmin.auth.admin.deleteUser(invitedUser.id);
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
      user_id: invitedUser.id,
      project_id: projectId,
      role: projectRole,
    }));
  
  if (membershipsToInsert.length > 0) {
    const { error: membershipError } = await supabaseAdmin
      .from('project_members')
      .insert(membershipsToInsert);

    if (membershipError) {
      // Rollback user creation if memberships fail to insert
      await supabaseAdmin.auth.admin.deleteUser(invitedUser.id);
      // The user profile will be deleted automatically due to the foreign key constraint on users.id
      return {
        message: `Database error: Could not assign user to projects. ${membershipError.message}`,
        isError: true,
      };
    }
  }


  // Revalidate the path to refresh the user list on the page
  revalidatePath('/');

  return { message: `Invitation successfully sent to ${email}.`, isError: false };
}
