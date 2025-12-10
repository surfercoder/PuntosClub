import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

type Beneficiary = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  document_id: string | null;
  available_points: number;
  role_id: string | null;
  auth_user_id: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  beneficiary: Beneficiary | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, userData: { first_name: string; last_name: string; phone?: string; document_id?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const signOut = async () => {
    await supabase.auth.signOut();
    setBeneficiary(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, beneficiary, loading, signIn, signUp, signOut }}>
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
