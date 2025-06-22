
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
  const { toast } = useToast();

  const fetchPublicUsers = useCallback(async (organizationId: string) => {
    if (organizationId) {
        const fetchedUsers = await supabaseService.getUsers(organizationId);
        setUsers(fetchedUsers);
    } else {
        setUsers([]);
    }
  }, []); 

  // Centralized function to handle user profile fetching with timeout
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

  // Centralized function to handle auth user changes
  const handleAuthUserChange = useCallback(async (authUser: SupabaseAuthUser | null, isInitialLoad = false) => {
    
    setSupabaseUser(authUser);
    
    if (authUser) {
      try {
        // Add a small delay only for non-initial loads to ensure session is fully established
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

  // Single useEffect to handle all auth state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mounted = true;
    let authListenerData: { data: { subscription: { unsubscribe: () => void } } } | null = null;

    const initializeAuth = async () => {
      try {
        
        // Get initial session with a shorter timeout
        const { data: { session } } = await supabaseService.getSession(3, 100, 5000);
        
        if (mounted) {
          if (session?.user) {
            await handleAuthUserChange(session.user, true);
          } else {
            setLoadingAuth(false);
          }
        }

        // Set up auth state listener
        if (mounted) {
          authListenerData = supabaseService.onAuthStateChange(async (event, session) => {
            
            // Skip INITIAL_SESSION as we handled it above
            if (event === 'INITIAL_SESSION') {
              return;
            }
            
            if (mounted) {
              await handleAuthUserChange(session?.user ?? null, false);
            }
          });
        }
      } catch (error) {
        if (mounted) {
          setLoadingAuth(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      if (authListenerData) {
        authListenerData.data.subscription.unsubscribe();
      }
    };
  }, [handleAuthUserChange]);

  // This effect fetches the list of all users in the org *after* we know who the current user is.
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
        setCurrentUser(null);
        setUsers([]);
        setSupabaseUser(null);
        setLoadingAuth(false);
      } else {
        toast({ title: "Logout Failed", description: error.message, variant: "destructive" });
        setLoadingAuth(false);
      }
    }
  }, [toast]);

  return (
    <AuthContext.Provider value={{ currentUser, supabaseUser, users, loadingAuth, login, signUp, logout, fetchPublicUsers }}>
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
