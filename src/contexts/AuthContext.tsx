
"use client";
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { type User, UserRole } from '../types';
import * as supabaseService from '../services/supabaseService';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { SignUpError } from '../services/supabaseService';
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  currentUser: User | null;
  supabaseUser: SupabaseAuthUser | null;
  users: User[];
  loadingAuth: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string, role: UserRole, avatarFile?: File) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  createUser: (name: string, email: string, role: UserRole) => Promise<{success: boolean; user: User | null; error?: string; isEmailConflict?: boolean}>;
  fetchPublicUsers: () => Promise<void>;
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
            setCurrentUser(userProfile);
            if (!userProfile) {
              console.warn(`No profile found in public.users for authenticated user ID: ${authUserFromSession.id}. User may need to complete profile creation or there's a data inconsistency.`);
            }
          } else {
            setCurrentUser(null);
          }
        } catch (error) {
            console.error("Error processing auth state change:", error);
            setCurrentUser(null);
        } finally {
            setLoadingAuth(false);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const fetchPublicUsers = useCallback(async () => {
    const fetchedUsers = await supabaseService.getUsers();
    setUsers(fetchedUsers);
  }, []);

  useEffect(() => {
    if (currentUser?.role === UserRole.ADMIN) {
      fetchPublicUsers();
    } else {
      setUsers([]);
    }
  }, [currentUser, fetchPublicUsers]);


  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoadingAuth(true);
    const { success, error } = await supabaseService.signInUser(email, password);
    if (!success) {
        setLoadingAuth(false);
        return { success: false, error: error?.message || 'Invalid credentials or network issue.'};
    }
    return { success: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, role: UserRole, avatarFile?: File): Promise<{ success: boolean; error?: string }> => {
    setLoadingAuth(true);
    const result = await supabaseService.signUpUser(email, password, name, role, avatarFile);

    if (!result.success) {
      setLoadingAuth(false);
      if (result.error?.isEmailConflict) {
        return { success: false, error: "User with this email already exists. Please try logging in." };
      }
      return { success: false, error: result.error?.message || 'Could not create account.' };
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
          description: "Account created. You will be logged in automatically.",
        });
      }
    }
    return { success: true };
  }, [setLoadingAuth, toast]);

  const logout = useCallback(async () => {
    setLoadingAuth(true);
    await supabaseService.signOutUser();
  }, []);

  const createUser = useCallback(async (name: string, email: string, role: UserRole): Promise<{success: boolean; user: User | null; error?: string; isEmailConflict?: boolean}> => {
    if (currentUser?.role !== UserRole.ADMIN) {
      toast({
        title: "Permission Denied",
        description: "Only Admins can create user profiles.",
        variant: "destructive",
      });
      return { success: false, user: null, error: "Permission denied." };
    }
    const result = await supabaseService.createUserAccount(name, email, role);
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
