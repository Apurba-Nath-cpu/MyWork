"use client";
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as supabaseService from '../services/supabaseService';
import { User, AuthContextType } from '../types';
import { useToast } from "@/hooks/use-toast";
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [supabaseUser, setSupabaseUser] = useState<SupabaseAuthUser | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const fetchPublicUsers = useCallback(async (organizationId: string) => {
        const publicUsers = await supabaseService.getUsers(organizationId);
        setUsers(publicUsers);
    }, []);

    const fetchUserProfile = useCallback(async (
        authUserId: string, 
        retryCount = 3, 
        delay = 300
    ): Promise<User | null> => {
        for (let i = 0; i < retryCount; i++) {
            try {
                const userProfile = await supabaseService.getUserProfile(authUserId);
                if (userProfile) {
                    return userProfile;
                }
            } catch (error) {
                console.error(`Attempt ${i + 1} to fetch profile failed:`, error);
            }
            if (i < retryCount - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return null;
    }, []);
    
    const handleSession = useCallback(async (session: Session) => {
        try {
            setSupabaseUser(session.user);
            const userProfile = await fetchUserProfile(session.user.id);

            if (userProfile) {
                setCurrentUser(userProfile);
                await fetchPublicUsers(userProfile.organization_id);
                setLoadingAuth(false); // Set loading false ONLY on full success
            } else {
                toast({
                    title: "Login Error",
                    description: "Could not retrieve your user profile. Please try logging in again or contact support.",
                    variant: "destructive",
                });
                // Ensure loading is set to false even if signOut fails
                setLoadingAuth(false);
                await supabaseService.signOutUser(); 
            }
        } catch (error) {
            console.error("Error in handleSession:", error);
            setLoadingAuth(false);
            toast({
                title: "Authentication Error",
                description: "An unexpected error occurred during authentication.",
                variant: "destructive",
            });
        }
    }, [fetchUserProfile, fetchPublicUsers, toast]);

    useEffect(() => {
        let mounted = true;
        let authSubscription: { unsubscribe: () => void } | null = null;

        const initializeAuth = async () => {
            if (!supabaseService.supabase) {
                console.error("Supabase client is not initialized. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment.");
                toast({
                    title: "Application Not Configured",
                    description: "The connection to the backend is not set up. Please check your environment variables.",
                    variant: "destructive",
                    duration: Infinity,
                });
                if (mounted) setLoadingAuth(false);
                return;
            }

            try {
                // Get initial session
                const { data: { session }, error } = await supabaseService.supabase.auth.getSession();
                
                if (error) {
                    console.error("Error getting initial session:", error);
                    if (mounted) setLoadingAuth(false);
                    return;
                }

                // Handle initial session if it exists
                if (session && mounted) {
                    await handleSession(session);
                } else if (mounted) {
                    setLoadingAuth(false);
                }

                // Set up auth state listener
                const { data: { subscription } } = supabaseService.onAuthStateChange(async (event, session) => {
                    if (!mounted) return;

                    console.log("Auth state change:", event, !!session);

                    if (event === 'PASSWORD_RECOVERY') {
                        setIsResettingPassword(true);
                        setLoadingAuth(false);
                        return;
                    }

                    if (event === 'SIGNED_IN') {
                        setIsResettingPassword(false);
                    }
                    
                    if (session) {
                        await handleSession(session);
                    } else {
                        setCurrentUser(null);
                        setSupabaseUser(null);
                        setUsers([]);
                        setIsResettingPassword(false);
                        setLoadingAuth(false);
                    }
                });

                authSubscription = subscription;

            } catch (error) {
                console.error("Error initializing auth:", error);
                if (mounted) setLoadingAuth(false);
            }
        };

        // Add a timeout as a safety net
        const timeoutId = setTimeout(() => {
            if (mounted && loadingAuth) {
                console.warn("Auth initialization timed out, setting loadingAuth to false");
                setLoadingAuth(false);
            }
        }, 10000); // 10 second timeout

        initializeAuth();

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
            authSubscription?.unsubscribe();
        };
    }, []); // Remove handleSession and toast from dependencies to prevent re-initialization

    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { success, error } = await supabaseService.signInUser(email, password);
            if (success) {
                return { success: true };
            }
            return { success: false, error: error?.message || "An unknown error occurred." };
        } catch (err) {
            console.error("Login error:", err);
            return { success: false, error: "An unexpected error occurred during login." };
        }
    };

    const signUp = async (email: string, password: string, name: string, organizationName: string) => {
        try {
            const result = await supabaseService.signUpUserAndCreateOrg(email, password, name, organizationName);
            
            if (result.success) {
                toast({
                    title: "Account Created",
                    description: "Success! Please check your email to confirm your account.",
                });
                return { success: true };
            } else {
                // Safely handle the error object
                const errorMessage = result.error?.message || "An unknown error occurred during sign up.";
                const isOrgNameConflict = result.error?.isOrgNameConflict || false;
                const isEmailConflict = result.error?.isEmailConflict || false;
                
                console.error("Sign up error:", result.error);
                
                return { 
                    success: false, 
                    error: errorMessage, 
                    isOrgNameConflict, 
                    isEmailConflict 
                };
            }
        } catch (err) {
            console.error("Unexpected sign up error:", err);
            return { 
                success: false, 
                error: "An unexpected error occurred during sign up.",
                isOrgNameConflict: false,
                isEmailConflict: false
            };
        }
    };

    const logout = async () => {
        try {
            await supabaseService.signOutUser();
            router.push('/'); 
        } catch (error) {
            console.error("Logout error:", error);
            // Still redirect even if logout fails
            router.push('/');
        }
    };
    
    const sendPasswordResetEmail = async (email: string) => {
        try {
            const { error } = await supabaseService.sendPasswordResetEmail(email);
            if (error) {
                const errorMessage = error.message || "Failed to send password reset email.";
                toast({
                    title: "Error Sending Email",
                    description: errorMessage,
                    variant: "destructive",
                });
                return { success: false, error: errorMessage };
            }
            toast({
                title: "Password Reset Email Sent",
                description: "If an account exists, you'll receive reset instructions.",
            });
            return { success: true };
        } catch (err) {
            console.error("Password reset error:", err);
            const errorMessage = "An unexpected error occurred while sending the password reset email.";
            toast({
                title: "Error Sending Email",
                description: errorMessage,
                variant: "destructive",
            });
            return { success: false, error: errorMessage };
        }
    };

    const updatePassword = async (password: string) => {
        try {
            const { error } = await supabaseService.updateUserPassword(password);
            if (error) {
                const errorMessage = error.message || "Failed to update password.";
                toast({
                    title: "Error Updating Password",
                    description: errorMessage,
                    variant: "destructive",
                });
                return { success: false, error: errorMessage };
            }
            toast({
                title: "Password Updated",
                description: "Your password has been changed. Please log in with your new password.",
            });
            await logout();
            return { success: true };
        } catch (err) {
            console.error("Update password error:", err);
            const errorMessage = "An unexpected error occurred while updating the password.";
            toast({
                title: "Error Updating Password",
                description: errorMessage,
                variant: "destructive",
            });
            return { success: false, error: errorMessage };
        }
    };

    const value: AuthContextType = { 
        currentUser, 
        supabaseUser,
        users,
        loadingAuth, 
        isResettingPassword,
        setIsResettingPassword,
        login, 
        signUp, 
        logout,
        fetchPublicUsers,
        sendPasswordResetEmail,
        updatePassword
    };

    return (
        <AuthContext.Provider value={value}>
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
