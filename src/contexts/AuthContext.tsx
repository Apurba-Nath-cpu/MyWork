
'use client';
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
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const { toast } = useToast();

  const fetchPublicUsers = useCallback(async (organizationId: string) => {
    if (organizationId) {
        const fetchedUsers = await supabaseService.getUsers(organizationId);
        setUsers(fetchedUsers);
    } else {
        setUsers([]);
    }
  }, []); 

  const handleAuthUserChange = useCallback(async (authUser: SupabaseAuthUser | null) => {
    setSupabaseUser(authUser);
    
    if (authUser) {
      let userProfile: User | null = null;
      let lastError: Error | null = null;

      // Retry fetching profile a few times to handle potential replication delays on deployment
      for (let i = 0; i < 3; i++) {
        try {
          // Add a small delay, especially for the first attempt right after login/signup
          await new Promise(res => setTimeout(res, i * 250));
          userProfile = await supabaseService.getUserProfile(authUser.id);
          if (userProfile) {
            lastError = null;
            break; // Success, exit loop
          }
        } catch (error: any) {
          lastError = error;
        }
      }

      if (userProfile) {
        setCurrentUser(userProfile);
      } else {
        // If profile is still not found after retries, it's a persistent issue.
        const description = lastError 
            ? `There was a problem fetching your profile. This might be a network or permissions issue.`
            : "Your user profile could not be found after logging in. Please contact support.";
        
        toast({ title: "Login Error", description, variant: "destructive" });
        await supabaseService.signOutUser();
        setCurrentUser(null);
        setSupabaseUser(null);
      }
    } else {
      setCurrentUser(null);
    }
    
    setLoadingAuth(false);
  }, [toast]);
  
  useEffect(() => {
  if (typeof window === 'undefined') return;

  let mounted = true;
  
  // Add timeout fallback to prevent infinite loading
  const loadingTimeout = setTimeout(() => {
    if (mounted) {
      console.warn('Auth loading timeout - forcing loadingAuth to false');
      setLoadingAuth(false);
    }
  }, 4000); // 10 second timeout

  const { data: authListener } = supabaseService.onAuthStateChange(async (event, session) => {
    console.log('Auth state change:', event, session?.user?.id); // Debug log
    
    if (!mounted) return;

    try {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
        setSupabaseUser(session?.user ?? null);
        setCurrentUser(null);
        setLoadingAuth(false);
        clearTimeout(loadingTimeout);
        return;
      }
      
      if (isResettingPassword) {
        if (event === 'SIGNED_OUT') {
           setIsResettingPassword(false);
           setCurrentUser(null);
           setSupabaseUser(null);
           setLoadingAuth(false);
           clearTimeout(loadingTimeout);
        }
        return;
      }
      
      // For all other events (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
      // when not in password recovery mode, run the standard authentication flow.
      await handleAuthUserChange(session?.user ?? null);
    });

  return () => {
    mounted = false;
    clearTimeout(loadingTimeout);
    authListener.subscription.unsubscribe();
  };
}, [handleAuthUserChange, isResettingPassword]);


  useEffect(() => {
    if (currentUser?.organization_id) {
      fetchPublicUsers(currentUser.organization_id);
    } else {
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
      if (result.error?.isOrgNameConflict) {
        errorMessage = "This organization name is already taken. Please choose a different one.";
      } else if (result.error?.isEmailConflict) {
        errorMessage = "This email is already registered. Please try logging in or use a different email.";
      }
      return { success: false, error: errorMessage, isOrgNameConflict: result.error?.isOrgNameConflict, isEmailConflict: result.error?.isEmailConflict };
    }
    
    // After sign up, prompt user to check email instead of auto-logging in, as confirmation is required.
    toast({
        title: "Sign Up Successful!",
        description: "Please check your email to confirm your account and then log in.",
        variant: "default",
    });
    return { success: true };
  }, [toast]);

  const logout = useCallback(async () => {
    // The onAuthStateChange listener will handle clearing the state when it receives the SIGNED_OUT event.
    // We just need to trigger the sign out.
    const { error } = await supabaseService.signOutUser();
    if (error) {
       // Even if sign out from server fails, clear local state to prevent being stuck.
       setCurrentUser(null);
       setUsers([]);
       setSupabaseUser(null);
       setIsResettingPassword(false);
       setLoadingAuth(false);
       toast({ title: "Logout Failed", description: "Could not sign out properly, but session cleared locally.", variant: "destructive" });
    }
  }, [toast]);

  const sendPasswordResetEmail = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabaseService.sendPasswordResetEmail(email);

    if (error) {
        toast({
            title: "Password Reset Error",
            description: error.message,
            variant: "destructive"
        });
        console.error("Password reset error:", error.message);
        return { success: false, error: error.message };
    }

    toast({
        title: "Check Your Email",
        description: "If an account exists for that email, a password reset link has been sent.",
        variant: "default"
    });

    return { success: true };
  }, [toast]);
  
  const updatePassword = useCallback(async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabaseService.updateUserPassword(newPassword);
    if (error) {
      toast({
        title: "Update Failed",
        description: `There was an error updating your password: ${error.message}`,
        variant: "destructive"
      });
      return { success: false, error: error.message };
    }
    
    // After a successful password update, log the user out of the recovery session.
    // The listener will then redirect to the login screen.
    await logout();

    toast({
      title: "Password Updated",
      description: "Your password has been successfully updated. Please log in with your new password.",
      variant: "default"
    });

    return { success: true };
  }, [toast, logout]);


  return (
    <AuthContext.Provider value={{ currentUser, supabaseUser, users, loadingAuth, isResettingPassword, setIsResettingPassword, login, signUp, logout, fetchPublicUsers, sendPasswordResetEmail, updatePassword }}>
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
