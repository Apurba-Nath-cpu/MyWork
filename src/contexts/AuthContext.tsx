
'use client';
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { type User, UserRole, type Organization, type AuthContextType } from '../types';
import * as supabaseService from '../services/supabaseService';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { SignUpError, CreateUserAccountError } from '../types'; 
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/router';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseAuthUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  // const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  // const router = useRouter();

  // useEffect(() => {
    // setIsMounted(true);
  // }, []);

  const fetchPublicUsers = useCallback(async (organizationId: string) => {
    if (organizationId) {
        const fetchedUsers = await supabaseService.getUsers(organizationId);
        setUsers(fetchedUsers);
    } else {
        console.warn("fetchPublicUsers called without a valid organizationId.");
        setUsers([]);
    }
  }, []); 

  // This effect handles the initial auth check and subsequent auth state changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 1. Check for an existing session on initial render
    const checkInitialSession = async () => {
      setLoadingAuth(true);
      try {
        console.log('fetching session');
        const { data: { session } } = await supabaseService.getSession(5, 100);
        console.log('fetched session', session);
        if (session) {
          const userProfile = await supabaseService.getUserProfile(session.user.id);
          console.log('userProfile', userProfile);
          setLoadingAuth(false);
          setCurrentUser(userProfile);
          setSupabaseUser(session.user);
        } else {
          console.log('no session');
          setCurrentUser(null);
          setSupabaseUser(null);
        }
      } catch (error) {
        console.error("Error during initial session check:", error);
        setCurrentUser(null);
        setSupabaseUser(null);
      } finally {
        console.log('in finally auth');
        setLoadingAuth(false);
      }
    };

    checkInitialSession();

    // router.events.on('routeChangeComplete', checkInitialSession);
    // window.addEventListener('pageshow', checkInitialSession);

    // 2. Set up a listener for subsequent auth events (e.g., login, logout in another tab)
    const { data: authListener } = supabaseService.onAuthStateChange(
      async (_event, session) => {
        // The 'INITIAL_SESSION' event is handled by checkInitialSession, 
        // so we can ignore it here to prevent redundant fetches and race conditions.
        if (_event === 'INITIAL_SESSION') {
          return;
        }

        const authUser = session?.user ?? null;
        setSupabaseUser(authUser);
        if (authUser) {
          // A login event occurred
          const userProfile = await supabaseService.getUserProfile(authUser.id);
          setCurrentUser(userProfile);
          setLoadingAuth(false);
        } else {
          // A logout event occurred
          setCurrentUser(null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
      // window.removeEventListener('pageshow', checkInitialSession);
      // router.events.off('routeChangeComplete', checkInitialSession);
    };
  }, []); // Run only once on component mount


  // This effect fetches the list of all users in the org *after* we know who the current user is.
  // This decouples it from the initial "Authenticating..." state.
  useEffect(() => {
    if (currentUser?.organization_id) {
      fetchPublicUsers(currentUser.organization_id);
    } else {
      // If there's no current user or they have no org, clear the users list.
      setUsers([]);
    }
  }, [currentUser, fetchPublicUsers]);


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
    return { success: true, isOrgNameConflict: false, isEmailConflict: false };
  }, [toast]);

  const logout = useCallback(async () => {
    const { error } = await supabaseService.signOutUser();

    if (error) {
      if (error.message.includes("Auth session missing") || error.message.includes("No active session")) {
        console.log("Logout: No active session or session already invalid. Forcing client logout state.");
        setCurrentUser(null);
        setUsers([]);
        setSupabaseUser(null);
        setLoadingAuth(false);
      } else {
        console.error("Logout error:", error);
        toast({ title: "Logout Failed", description: error.message, variant: "destructive" });
        setLoadingAuth(false);
      }
    }
  }, [toast]);

  const createUser = useCallback(async (name: string, email: string, role: UserRole): Promise<{success: boolean; user: User | null; error?: string; isEmailConflict?: boolean; isUsernameConflictInOrg?: boolean}> => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN || !currentUser.organization_id) {
      const errMsg = "Only Admins can create user profiles within their organization.";
      toast({ title: "Permission Denied", description: errMsg, variant: "destructive" });
      return { success: false, user: null, error: errMsg };
    }
    const result = await supabaseService.createUserAccount(name, email, role, currentUser.organization_id);
    
    if (result.user) {
      await fetchPublicUsers(currentUser.organization_id);
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
  }, [currentUser, toast, fetchPublicUsers]);

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
      await fetchPublicUsers(currentUser.organization_id);
      toast({ title: "User Deleted", description: `User profile has been deleted. Note: The user's authentication entry might still exist and require manual cleanup by a Supabase project admin if direct auth deletion failed.` });
      return { success: true };
    } else {
      toast({ title: "Error Deleting User", description: result.error?.message || "Could not delete user profile.", variant: "destructive" });
      return { success: false, error: result.error?.message };
    }
  }, [currentUser, toast, fetchPublicUsers]);


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
