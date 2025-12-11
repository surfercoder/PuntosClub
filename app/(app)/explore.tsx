import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import type { Organization } from '../../types';

export default function ExploreScreen() {
  const {
    allOrganizations,
    userOrganizations,
    organizationsLoading,
    joinOrganization,
    refreshOrganizations,
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const userOrgIds = useMemo(
    () => new Set(userOrganizations.map((org) => org.organization_id.toString())),
    [userOrganizations]
  );

  const filteredOrganizations = useMemo(() => {
    if (!searchQuery.trim()) {
      return allOrganizations;
    }
    const query = searchQuery.toLowerCase();
    return allOrganizations.filter(
      (org) =>
        org.name.toLowerCase().includes(query) ||
        org.business_name?.toLowerCase().includes(query)
    );
  }, [allOrganizations, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrganizations();
    setRefreshing(false);
  };

  const handleJoinOrganization = async (org: Organization) => {
    Alert.alert(
      'Unirse a ' + org.name,
      'Quieres unirte a esta organizacion para empezar a acumular puntos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Unirse',
          onPress: async () => {
            setJoiningId(org.id);
            const { error } = await joinOrganization(org.id);
            setJoiningId(null);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              Alert.alert(
                'Exito',
                `Te has unido a ${org.name}. Ya puedes empezar a acumular puntos!`
              );
            }
          },
        },
      ]
    );
  };

  const renderOrganizationItem = ({ item }: { item: Organization }) => {
    const isMember = userOrgIds.has(item.id.toString());
    const isJoining = joiningId === item.id;

    return (
      <View style={styles.orgCard}>
        <View style={styles.orgInfo}>
          <Text style={styles.orgName}>{item.name}</Text>
          {item.business_name && (
            <Text style={styles.orgSubtext}>{item.business_name}</Text>
          )}
        </View>
        {isMember ? (
          <View style={styles.memberBadge}>
            <Text style={styles.memberText}>Miembro</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => handleJoinOrganization(item)}
            disabled={isJoining}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.joinButtonText}>Unirse</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Explorar',
          headerStyle: { backgroundColor: '#7C3AED' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar organizaciones..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={filteredOrganizations}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderOrganizationItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C3AED"
            />
          }
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              <Text style={styles.headerTitle}>Organizaciones disponibles</Text>
              <Text style={styles.headerSubtitle}>
                {filteredOrganizations.length} organizacion
                {filteredOrganizations.length !== 1 ? 'es' : ''} encontrada
                {filteredOrganizations.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
          ListEmptyComponent={
            organizationsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? 'No se encontraron organizaciones con ese nombre.'
                    : 'No hay organizaciones disponibles.'}
                </Text>
              </View>
            )
          }
          contentContainerStyle={styles.listContent}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  headerContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  orgCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  orgSubtext: {
    fontSize: 13,
    color: '#6B7280',
  },
  joinButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  memberBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  memberText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
});
