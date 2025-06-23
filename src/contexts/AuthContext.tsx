
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

  const fetchUserProfileWithTimeout = useCallback(async (userId: string, timeoutMs = 10000): Promise<User | null> => {
    try {
      const profilePromise = supabaseService.getUserProfile(userId);
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), timeoutMs)
      );
      
      const userProfile = await Promise.race([profilePromise, timeoutPromise]);
      return userProfile;
    } catch (error) {
      return null;
    }
  }, []);

  const handleAuthUserChange = useCallback(async (authUser: SupabaseAuthUser | null, isInitialLoad = false) => {
    setSupabaseUser(authUser);
    
    if (authUser) {
      try {
        if (!isInitialLoad) {
          await new Promise(res => setTimeout(res, 200));
        }
        
        const userProfile = await fetchUserProfileWithTimeout(authUser.id);
        
        if (userProfile) {
          setCurrentUser(userProfile);
        } else {
          setCurrentUser(null);
          setSupabaseUser(null);
        }
      } catch (error) {
        setCurrentUser(null);
        setSupabaseUser(null);
      }
    } else {
      setCurrentUser(null);
    }
    
    setLoadingAuth(false);
  }, [fetchUserProfileWithTimeout]);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mounted = true;
    const { data: authListener } = supabaseService.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
        setCurrentUser(null);
        setSupabaseUser(session?.user ?? null);
        setLoadingAuth(false);
      } else {
        // Any other event means we are not in password recovery mode.
        setIsResettingPassword(false);
        await handleAuthUserChange(session?.user ?? null, event === 'INITIAL_SESSION');
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [handleAuthUserChange]);

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
    
    const loginResult = await login(email, password);

    if (loginResult.success) {
      toast({
        title: "Sign Up Successful!",
        description: "Your account has been created and you are now logged in.",
      });
      return { success: true };
    } else {
      toast({
          title: "Sign Up Successful!",
          description: "Please check your email to confirm your account and then log in.",
          variant: "default",
      });
      return { success: true };
    }
  }, [login, toast]);

  const logout = useCallback(async () => {
    const { error } = await supabaseService.signOutUser();

    if (error) {
      if (error.message.includes("Auth session missing") || error.message.includes("No active session")) {
        setCurrentUser(null);
        setUsers([]);
        setSupabaseUser(null);
        setLoadingAuth(false);
      } else {
        toast({ title: "Logout Failed", description: error.message, variant: "destructive" });
        setLoadingAuth(false);
      }
    } else {
      // This handles the case where logout is successful, ensuring state is cleared.
       setCurrentUser(null);
       setUsers([]);
       setSupabaseUser(null);
       setLoadingAuth(false);
    }
  }, [toast]);

  const sendPasswordResetEmail = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabaseService.sendPasswordResetEmail(email);

    toast({
        title: "Check Your Email",
        description: "If an account exists for that email, a password reset link has been sent.",
        variant: "default"
    });

    if (error) {
        console.error("Password reset error:", error.message);
        return { success: false, error: error.message };
    }

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
    
    // After a successful password update, the user should be logged out
    // of the recovery session and redirected to log in with their new password.
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

    