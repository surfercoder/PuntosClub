import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

export interface AddressData {
  street: string;
  number: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  place_id?: string;
  latitude?: number;
  longitude?: number;
}

interface AddressInputProps {
  value: Partial<AddressData>;
  onChange: (address: Partial<AddressData>) => void;
  googleApiKey: string;
}

export default function AddressInput({ value, onChange, googleApiKey }: AddressInputProps) {
  const [showManualInput, setShowManualInput] = useState(!googleApiKey);

  // Show manual input if there's existing address data
  useEffect(() => {
    const hasAddressData = value.street || value.number || value.city || value.state || value.zip_code;
    if (hasAddressData) {
      setShowManualInput(true);
    }
  }, [value.street, value.number, value.city, value.state, value.zip_code]);

  const handlePlaceSelected = (data: any, details: any) => {
    if (!details) return;

    const addressComponents: Partial<AddressData> = {
      street: '',
      number: '',
      city: '',
      state: '',
      zip_code: '',
      country: '',
      place_id: details.place_id,
      latitude: details.geometry?.location?.lat,
      longitude: details.geometry?.location?.lng,
    };

    details.address_components?.forEach((component: any) => {
      const componentType = component.types[0];

      switch (componentType) {
        case 'street_number':
          addressComponents.number = component.long_name;
          break;
        case 'route':
          addressComponents.street = component.long_name;
          break;
        case 'locality':
          addressComponents.city = component.long_name;
          break;
        case 'administrative_area_level_2':
          if (!addressComponents.city) {
            addressComponents.city = component.long_name;
          }
          break;
        case 'administrative_area_level_1':
          addressComponents.state = component.long_name;
          break;
        case 'country':
          addressComponents.country = component.long_name;
          break;
        case 'postal_code':
          addressComponents.zip_code = component.long_name;
          break;
      }
    });

    onChange(addressComponents);
    setShowManualInput(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Direccion (Opcional)</Text>
      
      {!showManualInput && googleApiKey && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.autocompleteContainer}
        >
          <GooglePlacesAutocomplete
            placeholder="Buscar direccion..."
            onPress={handlePlaceSelected}
            query={{
              key: googleApiKey,
              language: 'es',
            }}
            fetchDetails={true}
            enablePoweredByContainer={false}
            listViewDisplayed="auto"
            keyboardShouldPersistTaps="handled"
            styles={{
              textInput: styles.autocompleteInput,
              container: styles.autocompleteWrapper,
              listView: styles.autocompleteList,
            }}
            renderDescription={(row) => row.description}
            textInputProps={{
              onFocus: () => {},
              onBlur: () => {},
            }}
          />
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setShowManualInput(true)}
          >
            <Text style={styles.manualButtonText}>Ingresar manualmente</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      )}

      {showManualInput && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Calle</Text>
            <TextInput
              style={styles.input}
              value={value.street || ''}
              onChangeText={(text) => onChange({ ...value, street: text })}
              placeholder="Nombre de la calle"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Numero</Text>
            <TextInput
              style={styles.input}
              value={value.number || ''}
              onChangeText={(text) => onChange({ ...value, number: text })}
              placeholder="Numero"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ciudad</Text>
            <TextInput
              style={styles.input}
              value={value.city || ''}
              onChangeText={(text) => onChange({ ...value, city: text })}
              placeholder="Ciudad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Provincia/Estado</Text>
            <TextInput
              style={styles.input}
              value={value.state || ''}
              onChangeText={(text) => onChange({ ...value, state: text })}
              placeholder="Provincia o Estado"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Codigo Postal</Text>
            <TextInput
              style={styles.input}
              value={value.zip_code || ''}
              onChangeText={(text) => onChange({ ...value, zip_code: text })}
              placeholder="Codigo Postal"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {googleApiKey && (
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => setShowManualInput(false)}
            >
              <Text style={styles.searchButtonText}>Buscar con Google Maps</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  autocompleteContainer: {
    marginBottom: 16,
  },
  autocompleteWrapper: {
    flex: 0,
  },
  autocompleteInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  autocompleteList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginTop: 4,
  },
  manualButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  manualButtonText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
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
  searchButton: {
    marginTop: 8,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '600',
  },
});
