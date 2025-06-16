
"use client";
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { type User, UserRole, type Organization, type AuthContextType } from '../types';
import * as supabaseService from '../services/supabaseService';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { SignUpError, CreateUserAccountError } from '../types'; 
import { useToast } from "@/hooks/use-toast";

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
            setCurrentUser(userProfile); 
            if (!userProfile) {
              console.warn(`No profile found in public.users for authenticated user ID: ${authUserFromSession.id}.`);
            } else {
              if (userProfile.organization_id) { 
                await fetchPublicUsers(userProfile.organization_id);
              } else {
                setUsers([]); 
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
  }, []); 

  const fetchPublicUsers = useCallback(async (organizationId?: string) => {
    const orgIdToFetch = organizationId || currentUser?.organization_id;
    if (orgIdToFetch) { 
        const fetchedUsers = await supabaseService.getUsers(orgIdToFetch);
        setUsers(fetchedUsers);
    } else {
        setUsers([]); 
    }
  }, [currentUser]);


  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { success, error } = await supabaseService.signInUser(email, password);
    if (!success) {
        return { success: false, error: error?.message || 'Invalid credentials or network issue.'};
    }
    return { success: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, organizationName: string, avatarFile?: File): Promise<{ success: boolean; error?: string; isOrgNameConflict?: boolean; isEmailConflict?: boolean }> => {
    const result = await supabaseService.signUpUserAndCreateOrg(email, password, name, organizationName, avatarFile);

    if (!result.success || !result.user) {
      let errorMessage = result.error?.message || 'Could not create account and organization.';
      if (result.error?.isEmailConflict) {
        errorMessage = "User with this email already exists. Please try logging in.";
      } else if (result.error?.isOrgNameConflict) {
        errorMessage = "Organization name is already taken. Please choose another.";
      }
      return { success: false, error: errorMessage, isOrgNameConflict: result.error?.isOrgNameConflict, isEmailConflict: result.error?.isEmailConflict };
    }
    
    const { data: sessionData } = await supabaseService.getSession();
    if (!result.user.email_confirmed_at && sessionData.session === null) { // Using result.user here (SupabaseAuthUser)
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
    return { success: true, isOrgNameConflict: false, isEmailConflict: false };
  }, [toast]);

  const logout = useCallback(async () => {
    setLoadingAuth(true);
    await supabaseService.signOutUser();
  }, []);

  const createUser = useCallback(async (name: string, email: string, role: UserRole): Promise<{success: boolean; user: User | null; error?: string; isEmailConflict?: boolean; isUsernameConflictInOrg?: boolean}> => {
    if (currentUser?.role !== UserRole.ADMIN || !currentUser.organization_id) {
      const errMsg = "Only Admins can create user profiles within their organization.";
      toast({ title: "Permission Denied", description: errMsg, variant: "destructive" });
      return { success: false, user: null, error: errMsg };
    }
    const result = await supabaseService.createUserAccount(name, email, role, currentUser.organization_id);
    
    if (result.user) {
      setUsers(prevUsers => [...prevUsers, result.user!].sort((a,b) => a.name.localeCompare(b.name)));
      toast({ title: "User Created", description: `User profile for ${result.user.name} created successfully.` });
      return { success: true, user: result.user };
    } else {
      let errorMessage = result.error?.message || `Failed to create user profile for ${name}.`;
      if (result.error?.isEmailConflict) {
        errorMessage = "A user with this email already exists.";
      } else if (result.error?.isUsernameConflictInOrg) {
        errorMessage = "A user with this username already exists in your organization.";
      }
      toast({ title: "Error Creating User", description: errorMessage, variant: "destructive" });
      return { success: false, user: null, error: errorMessage, isEmailConflict: result.error?.isEmailConflict, isUsernameConflictInOrg: result.error?.isUsernameConflictInOrg };
    }
  }, [currentUser, toast]);

  const deleteUserByAdmin = useCallback(async (userIdToDelete: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN || !currentUser.organization_id) {
      const msg = "Only Admins can delete users.";
      toast({ title: "Permission Denied", description: msg, variant: "destructive" });
      return { success: false, error: msg };
    }
    if (userIdToDelete === currentUser.id) {
      const msg = "You cannot delete your own account using this function.";
      toast({ title: "Action Not Allowed", description: msg, variant: "destructive" });
      return { success: false, error: msg };
    }

    const result = await supabaseService.deleteUserByAdmin(userIdToDelete, currentUser.id, currentUser.organization_id);

    if (result.success) {
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userIdToDelete));
      toast({ title: "User Deleted", description: `User profile has been deleted. Note: The user's authentication entry might still exist and require manual cleanup by a Supabase project admin if direct auth deletion failed.` });
      return { success: true };
    } else {
      toast({ title: "Error Deleting User", description: result.error?.message || "Could not delete user profile.", variant: "destructive" });
      return { success: false, error: result.error?.message };
    }
  }, [currentUser, toast]);


  return (
    <AuthContext.Provider value={{ currentUser, supabaseUser, users, loadingAuth, login, signUp, logout, createUser, deleteUserByAdmin, fetchPublicUsers }}>
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
