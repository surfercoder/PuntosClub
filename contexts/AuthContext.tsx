import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import type { Beneficiary, BeneficiaryOrganization, Organization } from '../types';

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
            creation_date
          )
        `)
        .eq('beneficiary_id', beneficiaryId)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching user organizations:', error);
        return;
      }

      setUserOrganizations(data || []);
    } catch (error) {
      console.error('Error in fetchUserOrganizations:', error);
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
        console.error('Error fetching all organizations:', error);
        return;
      }

      setAllOrganizations(data || []);
    } catch (error) {
      console.error('Error in fetchAllOrganizations:', error);
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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchBeneficiary(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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

    return () => subscription.unsubscribe();
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
          (payload) => {
            console.log('Organization membership changed:', payload);
            // Refresh organizations when any change happens
            fetchUserOrganizations(beneficiary.id);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to organization changes');
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
      const { data, error } = await supabase
        .from('beneficiary')
        .select('*, user_role:role_id(name)')
        .eq('auth_user_id', authUserId)
        .single();

      if (error) {
        console.error('Error fetching beneficiary:', error);
        // User is authenticated but not a beneficiary - sign them out
        await supabase.auth.signOut();
        setBeneficiary(null);
      } else if (data) {
        // Verify user has final_user role
        const roleName = (data.user_role as any)?.name;
        if (roleName !== 'final_user') {
          console.error('User is not a final_user');
          await supabase.auth.signOut();
          setBeneficiary(null);
        } else {
          setBeneficiary(data);
        }
      }
    } catch (error) {
      console.error('Error in fetchBeneficiary:', error);
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
      // First, create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://puntos-club-admin.vercel.app/auth/email-confirmed',
        },
      });

      if (authError) {
        return { error: authError };
      }

      if (!authData.user) {
        return { error: new Error('Error al crear la cuenta') };
      }

      // Get the final_user role ID
      const { data: roleData, error: roleError } = await supabase
        .from('user_role')
        .select('id')
        .eq('name', 'final_user')
        .single();

      if (roleError || !roleData) {
        // Cleanup: delete the auth user if we can't get the role
        await supabase.auth.signOut();
        return { error: new Error('Error al obtener el rol de usuario') };
      }

      // Create the beneficiary record
      const { error: beneficiaryError } = await supabase
        .from('beneficiary')
        .insert({
          email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone || null,
          document_id: userData.document_id || null,
          available_points: 0,
          role_id: roleData.id,
          auth_user_id: authData.user.id,
        });

      if (beneficiaryError) {
        // Cleanup: sign out if beneficiary creation fails
        await supabase.auth.signOut();
        return { error: new Error('Error al crear el perfil de usuario: ' + beneficiaryError.message) };
      }

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
      refreshOrganizations
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
