import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import type { Beneficiary, BeneficiaryOrganization, Organization } from '../types';
import { setupPushNotifications } from '../utils/pushNotifications';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  beneficiary: Beneficiary | null;
  userOrganizations: BeneficiaryOrganization[];
  allOrganizations: Organization[];
  loading: boolean;
  organizationsLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, userData: { first_name: string; last_name: string; phone?: string; document_id?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  joinOrganization: (organizationId: string) => Promise<{ error: Error | null }>;
  refreshOrganizations: () => Promise<void>;
  refreshBeneficiary: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<BeneficiaryOrganization[]>([]);
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);

  const fetchUserOrganizations = useCallback(async (beneficiaryId: string) => {
    try {
      setOrganizationsLoading(true);
      const { data, error } = await supabase
        .from('beneficiary_organization')
        .select(`
          *,
          organization:organization_id (
            id,
            name,
            business_name,
            tax_id,
            logo_url,
            creation_date
          )
        `)
        .eq('beneficiary_id', beneficiaryId)
        .eq('is_active', true);

      if (error) {
        return;
      }

      setUserOrganizations(data || []);
    } catch (error) {
    } finally {
      setOrganizationsLoading(false);
    }
  }, []);

  const fetchAllOrganizations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('organization')
        .select('*')
        .order('name');

      if (error) {
        return;
      }

      setAllOrganizations(data || []);
    } catch (error) {
    }
  }, []);

  const refreshOrganizations = useCallback(async () => {
    if (beneficiary?.id) {
      await Promise.all([
        fetchUserOrganizations(beneficiary.id),
        fetchAllOrganizations()
      ]);
    }
  }, [beneficiary?.id, fetchUserOrganizations, fetchAllOrganizations]);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const initializeAuth = async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Auth initialization timeout'));
          }, 10000);
        });

        const sessionPromise = supabase.auth.getSession();

        const { data: { session } } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]);

        clearTimeout(timeoutId);

        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchBeneficiary(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setSession(null);
          setUser(null);
          setBeneficiary(null);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchBeneficiary(session.user.id);
      } else {
        setBeneficiary(null);
        setUserOrganizations([]);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // Ref to store the realtime channel
  const organizationsChannelRef = useRef<RealtimeChannel | null>(null);

  // Fetch organizations and set up realtime subscription when beneficiary changes
  useEffect(() => {
    if (beneficiary?.id) {
      fetchUserOrganizations(beneficiary.id);
      fetchAllOrganizations();

      // Set up realtime subscription for organization membership changes
      const channel = supabase
        .channel(`beneficiary-orgs-${beneficiary.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'beneficiary_organization',
            filter: `beneficiary_id=eq.${beneficiary.id}`,
          },
          async (payload) => {
            
            if (payload.eventType === 'UPDATE' && payload.new) {
              // For updates, optimistically update the state
              setUserOrganizations((prev) => {
                const updated = prev.map((org) => {
                  if (org.id === payload.new.id) {
                    return {
                      ...org,
                      available_points: payload.new.available_points,
                      total_points_earned: payload.new.total_points_earned,
                      total_points_redeemed: payload.new.total_points_redeemed,
                      updated_at: payload.new.updated_at,
                    };
                  }
                  return org;
                });
                return updated;
              });
            } else {
              // For INSERT and DELETE, refetch all organizations
              await fetchUserOrganizations(beneficiary.id);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Subscribed to organization changes
          } else if (status === 'CHANNEL_ERROR') {
            // Error subscribing to organization changes
          } else if (status === 'TIMED_OUT') {
            // Subscription timed out
          }
        });

      organizationsChannelRef.current = channel;

      // Cleanup subscription on unmount or beneficiary change
      return () => {
        if (organizationsChannelRef.current) {
          supabase.removeChannel(organizationsChannelRef.current);
          organizationsChannelRef.current = null;
        }
      };
    }
  }, [beneficiary?.id, fetchUserOrganizations, fetchAllOrganizations]);

  const fetchBeneficiary = async (authUserId: string) => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('fetchBeneficiary timeout'));
        }, 8000);
      });

      const queryPromise = supabase
        .from('beneficiary')
        .select('*, user_role:role_id(name)')
        .eq('auth_user_id', authUserId)
        .single();

      const { data, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]);

      if (error) {
        await supabase.auth.signOut();
        setBeneficiary(null);
      } else if (data) {
        const roleName = (data.user_role as any)?.name;
        if (roleName !== 'final_user') {
          await supabase.auth.signOut();
          setBeneficiary(null);
        } else {
          setBeneficiary(data);
          setupPushNotifications().catch(error => {
          });
        }
      }
    } catch (error) {
      setBeneficiary(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      if (data.user) {
        // Verify this user is a beneficiary with final_user role
        const { data: beneficiaryData, error: beneficiaryError } = await supabase
          .from('beneficiary')
          .select('*, user_role:role_id(name)')
          .eq('auth_user_id', data.user.id)
          .single();

        if (beneficiaryError || !beneficiaryData) {
          await supabase.auth.signOut();
          return { error: new Error('Esta cuenta no está registrada como usuario final. Por favor usa la app correcta.') };
        }

        const roleName = (beneficiaryData.user_role as any)?.name;
        if (roleName !== 'final_user') {
          await supabase.auth.signOut();
          return { error: new Error('Esta cuenta no tiene permisos de usuario final.') };
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    userData: { first_name: string; last_name: string; phone?: string; document_id?: string }
  ): Promise<{ error: Error | null }> => {
    try {
      // Create the auth user with metadata - the database trigger will create the beneficiary record
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'puntosclub://auth/email-confirmed',
          data: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone: userData.phone || null,
            document_id: userData.document_id || null,
          },
        },
      });

      if (authError) {
        return { error: authError };
      }

      if (!authData.user) {
        return { error: new Error('Error al crear la cuenta') };
      }

      // The beneficiary record is automatically created by the database trigger
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const joinOrganization = async (organizationId: string): Promise<{ error: Error | null }> => {
    if (!beneficiary?.id) {
      return { error: new Error('No hay usuario autenticado') };
    }

    try {
      // Check if already joined
      const { data: existing } = await supabase
        .from('beneficiary_organization')
        .select('id, is_active')
        .eq('beneficiary_id', beneficiary.id)
        .eq('organization_id', organizationId)
        .single();

      if (existing) {
        if (existing.is_active) {
          return { error: new Error('Ya perteneces a esta organizacion') };
        }
        // Reactivate membership
        const { error: updateError } = await supabase
          .from('beneficiary_organization')
          .update({ is_active: true })
          .eq('id', existing.id);

        if (updateError) {
          return { error: new Error('Error al reactivar membresia: ' + updateError.message) };
        }
      } else {
        // Create new membership
        const { error: insertError } = await supabase
          .from('beneficiary_organization')
          .insert({
            beneficiary_id: beneficiary.id,
            organization_id: organizationId,
            available_points: 0,
            total_points_earned: 0,
            total_points_redeemed: 0,
            is_active: true,
          });

        if (insertError) {
          return { error: new Error('Error al unirse a la organizacion: ' + insertError.message) };
        }
      }

      // Refresh organizations list
      await fetchUserOrganizations(beneficiary.id);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const refreshBeneficiary = useCallback(async () => {
    if (user?.id) {
      await fetchBeneficiary(user.id);
    }
  }, [user?.id]);

  const signOut = async () => {
    // Clean up realtime subscription
    if (organizationsChannelRef.current) {
      supabase.removeChannel(organizationsChannelRef.current);
      organizationsChannelRef.current = null;
    }
    await supabase.auth.signOut();
    setBeneficiary(null);
    setUserOrganizations([]);
  };

  return (
    <AuthContext.Provider value={{
      session,
      user,
      beneficiary,
      userOrganizations,
      allOrganizations,
      loading,
      organizationsLoading,
      signIn,
      signUp,
      signOut,
      joinOrganization,
      refreshOrganizations,
      refreshBeneficiary
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
