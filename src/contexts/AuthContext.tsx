
"use client";
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { type User, UserRole, type Organization } from '../types';
import * as supabaseService from '../services/supabaseService';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { SignUpError } from '../services/supabaseService';
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  currentUser: User | null;
  supabaseUser: SupabaseAuthUser | null;
  users: User[]; // Users within the current user's organization
  loadingAuth: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string, organizationName: string, avatarFile?: File) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  createUser: (name: string, email: string, role: UserRole) => Promise<{success: boolean; user: User | null; error?: string; isEmailConflict?: boolean}>;
  fetchPublicUsers: () => Promise<void>; // Renamed for clarity, still fetches users for the current org
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseAuthUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setLoadingAuth(true);
    const { data: authListener } = supabaseService.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        try {
          const authUserFromSession = session?.user || null;
          setSupabaseUser(authUserFromSession);

          if (authUserFromSession) {
            const userProfile = await supabaseService.getUserProfile(authUserFromSession.id);
            setCurrentUser(userProfile); // This will now include organization_id
            if (!userProfile) {
              console.warn(`No profile found in public.users for authenticated user ID: ${authUserFromSession.id}.`);
            } else {
              // Fetch users for the organization if the user is an Admin
              if (userProfile.role === UserRole.ADMIN && userProfile.organization_id) {
                await fetchPublicUsers(userProfile.organization_id);
              } else {
                setUsers([]); // Non-admins or users without org don't see other users list for now
              }
            }
          } else {
            setCurrentUser(null);
            setUsers([]);
          }
        } catch (error) {
            console.error("Error processing auth state change:", error);
            setCurrentUser(null);
            setUsers([]);
        } finally {
            setLoadingAuth(false);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); // Removed fetchPublicUsers from dependencies to avoid loop, it's called conditionally

  const fetchPublicUsers = useCallback(async (organizationId?: string) => {
    const orgIdToFetch = organizationId || currentUser?.organization_id;
    if (currentUser?.role === UserRole.ADMIN && orgIdToFetch) {
        const fetchedUsers = await supabaseService.getUsers(orgIdToFetch);
        setUsers(fetchedUsers);
    } else {
        setUsers([]); // Clear users if not admin or no orgId
    }
  }, [currentUser]);


  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { success, error } = await supabaseService.signInUser(email, password);
    if (!success) {
        return { success: false, error: error?.message || 'Invalid credentials or network issue.'};
    }
    // onAuthStateChange will handle setting currentUser and fetching org users
    return { success: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, organizationName: string, avatarFile?: File): Promise<{ success: boolean; error?: string }> => {
    // This flow is for an Admin creating their account AND organization. Role is ADMIN.
    const result = await supabaseService.signUpUserAndCreateOrg(email, password, name, organizationName, avatarFile);

    if (!result.success) {
      if (result.error?.isEmailConflict) {
        return { success: false, error: "User with this email already exists. Please try logging in." };
      }
      return { success: false, error: result.error?.message || 'Could not create account and organization.' };
    }

    if (result.user) {
      const { data: sessionData } = await supabaseService.getSession();
      if (!result.user.email_confirmed_at && sessionData.session === null) {
        toast({
          title: "Sign Up Successful!",
          description: "Please check your email to confirm your account.",
        });
      } else {
        toast({
          title: "Sign Up Successful!",
          description: "Account and organization created. You will be logged in automatically.",
        });
      }
    }
    // onAuthStateChange will handle setting currentUser and fetching org users
    return { success: true };
  }, [toast]);

  const logout = useCallback(async () => {
    setLoadingAuth(true);
    await supabaseService.signOutUser();
    // onAuthStateChange will set currentUser to null
  }, []);

  const createUser = useCallback(async (name: string, email: string, role: UserRole): Promise<{success: boolean; user: User | null; error?: string; isEmailConflict?: boolean}> => {
    if (currentUser?.role !== UserRole.ADMIN || !currentUser.organization_id) {
      toast({
        title: "Permission Denied",
        description: "Only Admins can create user profiles within their organization.",
        variant: "destructive",
      });
      return { success: false, user: null, error: "Permission denied or no organization." };
    }
    const result = await supabaseService.createUserAccount(name, email, role, currentUser.organization_id);
    if (result.user) {
      setUsers(prevUsers => [...prevUsers, result.user!].sort((a,b) => a.name.localeCompare(b.name)));
      toast({
        title: "User Created",
        description: `User profile for ${result.user.name} created successfully.`,
      });
      return { success: true, user: result.user };
    } else {
      const errorMessage = result.error?.isEmailConflict ? "Email already in use." : (result.error?.message || `Failed to create user profile for ${name}.`);
      toast({
        title: "Error Creating User",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, user: null, error: errorMessage, isEmailConflict: result.error?.isEmailConflict };
    }
  }, [currentUser, toast]);

  return (
    <AuthContext.Provider value={{ currentUser, supabaseUser, users, loadingAuth, login, signUp, logout, createUser, fetchPublicUsers }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

