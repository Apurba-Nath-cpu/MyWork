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
        try {
            const publicUsers = await supabaseService.getUsers(organizationId);
            setUsers(publicUsers);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            setUsers([]);
        }
    }, []);

    const fetchUserProfile = useCallback(async (authUserId: string): Promise<User | null> => {
        try {
            const userProfile = await supabaseService.getUserProfile(authUserId);
            return userProfile;
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            return null;
        }
    }, []);

    // Simple initialization
    useEffect(() => {
        let mounted = true;
        let authSubscription: any = null;

        const initAuth = async () => {
            if (!supabaseService.supabase) {
                console.error("Supabase not configured");
                setLoadingAuth(false);
                return;
            }

            try {
                // Get initial session
                const { data: { session }, error } = await supabaseService.supabase.auth.getSession();
                
                if (error) {
                    console.error('Session error:', error);
                }

                // Handle initial session
                if (mounted) {
                    await handleAuthChange(session);
                }

                // Set up listener
                const { data: { subscription } } = supabaseService.supabase.auth.onAuthStateChange(
                    async (event, session) => {
                        console.log('Auth event:', event);
                        
                        if (event === 'PASSWORD_RECOVERY') {
                            setIsResettingPassword(true);
                            setLoadingAuth(false);
                            return;
                        }

                        if (mounted) {
                            await handleAuthChange(session);
                        }
                    }
                );
                
                authSubscription = subscription;

            } catch (error) {
                console.error('Auth init error:', error);
                if (mounted) {
                    setLoadingAuth(false);
                }
            }
        };

        const handleAuthChange = async (session: Session | null) => {
            try {
                if (!session) {
                    // No session - user is logged out
                    setCurrentUser(null);
                    setSupabaseUser(null);
                    setUsers([]);
                    setIsResettingPassword(false);
                    setLoadingAuth(false);
                    return;
                }

                // We have a session
                setSupabaseUser(session.user);

                // Try to get user profile
                const userProfile = await fetchUserProfile(session.user.id);
                
                if (userProfile) {
                    setCurrentUser(userProfile);
                    await fetchPublicUsers(userProfile.organization_id);
                } else {
                    // No profile found - this could be a new user
                    console.warn('No user profile found for authenticated user');
                    
                    // Check if user was just created (within last 2 minutes)
                    const userCreatedAt = new Date(session.user.created_at || 0);
                    const isNewUser = Date.now() - userCreatedAt.getTime() < 120000; // 2 minutes
                    
                    if (isNewUser) {
                        toast({
                            title: "Setting up your account",
                            description: "Please wait while we finish setting up your account...",
                        });
                        
                        // Wait a bit and try again for new users
                        setTimeout(async () => {
                            const retryProfile = await fetchUserProfile(session.user.id);
                            if (retryProfile && mounted) {
                                setCurrentUser(retryProfile);
                                await fetchPublicUsers(retryProfile.organization_id);
                            } else {
                                toast({
                                    title: "Setup incomplete",
                                    description: "Please refresh the page to complete setup.",
                                    variant: "destructive",
                                });
                            }
                        }, 3000);
                    } else {
                        // Existing user with no profile - sign them out
                        toast({
                            title: "Profile not found",
                            description: "Please contact support or try signing up again.",
                            variant: "destructive",
                        });
                        await supabaseService.signOutUser();
                    }
                }
            } catch (error) {
                console.error('Error in handleAuthChange:', error);
            } finally {
                setLoadingAuth(false);
            }
        };

        // Start initialization
        initAuth();

        // Cleanup
        return () => {
            mounted = false;
            if (authSubscription) {
                authSubscription.unsubscribe();
            }
        };
    }, [fetchUserProfile, fetchPublicUsers, toast]);

    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            setLoadingAuth(true);
            const { success, error } = await supabaseService.signInUser(email, password);
            
            if (!success) {
                setLoadingAuth(false);
                return { success: false, error: error?.message || "Login failed" };
            }
            
            // Don't set loading to false here - let the auth state change handle it
            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            setLoadingAuth(false);
            return { success: false, error: "An unexpected error occurred during login." };
        }
    };

    const signUp = async (email: string, password: string, name: string, organizationName: string) => {
        try {
            setLoadingAuth(true);
            const { success, error } = await supabaseService.signUpUserAndCreateOrg(email, password, name, organizationName);
            
            if (success) {
                toast({
                    title: "Account Created",
                    description: "Your account has been created successfully!",
                });
                // Don't set loading to false - let auth state change handle it
                return { success: true };
            } else {
                setLoadingAuth(false);
                return { 
                    success: false, 
                    error: error?.message, 
                    isOrgNameConflict: error?.isOrgNameConflict, 
                    isEmailConflict: error?.isEmailConflict 
                };
            }
        } catch (error) {
            console.error('Sign up error:', error);
            setLoadingAuth(false);
            return { 
                success: false, 
                error: "An unexpected error occurred during sign up." 
            };
        }
    };

    const logout = async () => {
        try {
            await supabaseService.signOutUser();
            toast({
                title: "Logged Out",
                description: "You have been logged out successfully.",
            });
        } catch (error) {
            console.error("Logout error:", error);
            toast({
                title: "Logged Out",
                description: "You have been logged out.",
            });
        }
        // The auth state change will handle clearing the state and navigation
    };
    
    const sendPasswordResetEmail = async (email: string) => {
        try {
            const { error } = await supabaseService.sendPasswordResetEmail(email);
            if (error) {
                toast({
                    title: "Error Sending Email",
                    description: error.message,
                    variant: "destructive",
                });
                return { success: false, error: error.message };
            }
            toast({
                title: "Password Reset Email Sent",
                description: "If an account exists, you'll receive reset instructions.",
            });
            return { success: true };
        } catch (error) {
            console.error('Password reset error:', error);
            toast({
                title: "Error",
                description: "An unexpected error occurred. Please try again.",
                variant: "destructive",
            });
            return { success: false, error: "An unexpected error occurred." };
        }
    };

    const updatePassword = async (password: string) => {
        try {
            const { error } = await supabaseService.updateUserPassword(password);
            if (error) {
                toast({
                    title: "Error Updating Password",
                    description: error.message,
                    variant: "destructive",
                });
                return { success: false, error: error.message };
            }
            toast({
                title: "Password Updated",
                description: "Your password has been changed. Please log in with your new password.",
            });
            await logout();
            return { success: true };
        } catch (error) {
            console.error('Update password error:', error);
            toast({
                title: "Error",
                description: "An unexpected error occurred while updating your password.",
                variant: "destructive",
            });
            return { success: false, error: "An unexpected error occurred." };
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
