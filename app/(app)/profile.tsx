import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import { router } from 'expo-router';
import AddressInput, { type AddressData } from '../../components/AddressInput';
import type { Address } from '../../types';
import Constants from 'expo-constants';

export default function ProfileScreen() {
  const { beneficiary, signOut, refreshBeneficiary } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [existingAddress, setExistingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState({
    first_name: beneficiary?.first_name || '',
    last_name: beneficiary?.last_name || '',
    email: beneficiary?.email || '',
    phone: beneficiary?.phone || '',
    document_id: beneficiary?.document_id || '',
  });
  const [addressData, setAddressData] = useState<Partial<AddressData>>({
    street: '',
    number: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
  });

  const googleApiKey = Constants.expoConfig?.extra?.googleMapsApiKey || '';

  // Update form data when beneficiary changes
  useEffect(() => {
    if (beneficiary) {
      setFormData({
        first_name: beneficiary.first_name || '',
        last_name: beneficiary.last_name || '',
        email: beneficiary.email || '',
        phone: beneficiary.phone || '',
        document_id: beneficiary.document_id || '',
      });
    }
  }, [beneficiary]);

  useEffect(() => {
    if (beneficiary?.address_id) {
      fetchAddress(beneficiary.address_id);
    } else {
      // Reset address data if no address_id
      setExistingAddress(null);
      setAddressData({
        street: '',
        number: '',
        city: '',
        state: '',
        zip_code: '',
        country: '',
      });
    }
  }, [beneficiary?.address_id]);

  const fetchAddress = async (addressId: string | number) => {
    try {
      const { data, error } = await supabase
        .from('address')
        .select('*')
        .eq('id', addressId)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setExistingAddress(data);
        setAddressData({
          street: data.street || '',
          number: data.number || '',
          city: data.city || '',
          state: data.state || '',
          zip_code: data.zip_code || '',
          country: data.country || '',
          place_id: data.place_id || undefined,
          latitude: data.latitude || undefined,
          longitude: data.longitude || undefined,
        });
      }
    } catch {
    }
  };

  const handleSave = async () => {
    if (!beneficiary?.id) return;

    setIsLoading(true);
    try {
      let addressId = beneficiary.address_id;

      const hasAddressData = addressData.street && addressData.number && 
                            addressData.city && addressData.state && 
                            addressData.zip_code;

      if (hasAddressData) {
        if (existingAddress) {
          const { error: addressUpdateError } = await supabase
            .from('address')
            .update({
              street: addressData.street,
              number: addressData.number,
              city: addressData.city,
              state: addressData.state,
              zip_code: addressData.zip_code,
              country: addressData.country || null,
              place_id: addressData.place_id || null,
              latitude: addressData.latitude || null,
              longitude: addressData.longitude || null,
            })
            .eq('id', existingAddress.id);

          if (addressUpdateError) throw addressUpdateError;
        } else {
          const { data: newAddress, error: addressCreateError } = await supabase
            .from('address')
            .insert({
              street: addressData.street,
              number: addressData.number,
              city: addressData.city,
              state: addressData.state,
              zip_code: addressData.zip_code,
              country: addressData.country || null,
              place_id: addressData.place_id || null,
              latitude: addressData.latitude || null,
              longitude: addressData.longitude || null,
            })
            .select()
            .single();

          if (addressCreateError) {
            throw addressCreateError;
          }
          addressId = newAddress.id;
        }
      }

      const { error: updateError } = await supabase
        .from('beneficiary')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          document_id: formData.document_id,
          address_id: addressId,
        })
        .eq('id', beneficiary.id);

      if (updateError) {
        throw updateError;
      }

      if (formData.email !== beneficiary.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        });

        if (emailError) {
          throw emailError;
        }

        Alert.alert(
          'Email actualizado',
          'Por favor revisa tu nuevo correo electronico para confirmar el cambio.'
        );
      }

      await refreshBeneficiary();
      
      // Small delay to ensure state updates propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      Alert.alert('Exito', 'Tu perfil ha sido actualizado correctamente.');
      router.back();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo actualizar el perfil';
      Alert.alert(
        'Error',
        errorMessage
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Cerrar Sesion',
      'Estas seguro que deseas cerrar sesion?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesion',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/sign-in');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Mi Perfil</Text>
          <Text style={styles.subtitle}>Actualiza tu informacion personal</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={formData.first_name}
              onChangeText={(text) => setFormData({ ...formData, first_name: text })}
              placeholder="Nombre"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Apellido</Text>
            <TextInput
              style={styles.input}
              value={formData.last_name}
              onChangeText={(text) => setFormData({ ...formData, last_name: text })}
              placeholder="Apellido"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefono</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="Telefono"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>DNI</Text>
            <TextInput
              style={styles.input}
              value={formData.document_id}
              onChangeText={(text) => setFormData({ ...formData, document_id: text })}
              placeholder="DNI"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>

          <AddressInput
            value={addressData}
            onChange={setAddressData}
            googleApiKey={googleApiKey}
          />

          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar Cambios</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Cerrar Sesion</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
});
