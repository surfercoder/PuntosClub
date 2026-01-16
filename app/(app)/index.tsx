import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import QRCode from 'react-qr-code';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import type { BeneficiaryOrganization } from '../../types';

export default function HomeScreen() {
  const {
    beneficiary,
    userOrganizations,
    organizationsLoading,
    signOut,
    refreshOrganizations,
  } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Generate QR code value - contains beneficiary ID for identification
  const qrValue = beneficiary?.id ? JSON.stringify({
    type: 'beneficiary',
    id: beneficiary.id,
    email: beneficiary.email,
    name: `${beneficiary.first_name} ${beneficiary.last_name}`,
  }) : '';

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

  const handleOrganizationPress = (item: BeneficiaryOrganization) => {
    router.push({
      pathname: '/(app)/organization/[id]',
      params: { id: item.organization_id },
    });
  };

  const handleExplorePress = () => {
    router.push('/(app)/explore');
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refreshOrganizations();
    setRefreshing(false);
  }, [refreshOrganizations]);

  const renderOrganizationCard = ({ item }: { item: BeneficiaryOrganization }) => (
    <TouchableOpacity
      style={styles.orgCard}
      onPress={() => handleOrganizationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.orgCardContent}>
        <View style={styles.orgInfo}>
          <Text style={styles.orgName}>{item.organization?.name || 'Organizacion'}</Text>
          <Text style={styles.orgSubtext}>Miembro desde {new Date(item.joined_date).toLocaleDateString('es-AR')}</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsNumber}>{item.available_points.toLocaleString()}</Text>
          <Text style={styles.pointsLabel}>puntos</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowQRModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowQRModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tu codigo QR</Text>
            <Text style={styles.modalSubtitle}>
              Mostra este codigo al cajero para acumular puntos
            </Text>
            <View style={styles.qrContainerLarge}>
              {qrValue && (
                <QRCode
                  value={qrValue}
                  size={250}
                  level="H"
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                />
              )}
            </View>
            <Text style={styles.userName}>
              {beneficiary?.first_name} {beneficiary?.last_name}
            </Text>
            <Text style={styles.userEmail}>{beneficiary?.email}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <FlatList
        data={userOrganizations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderOrganizationCard}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
        }
        ListHeaderComponent={
          <>
            {/* Header Card with QR */}
            <View style={styles.headerCard}>
              <View style={styles.headerTop}>
                <View style={styles.greetingContainer}>
                  <Text style={styles.greeting}>
                    Hola, {beneficiary?.first_name || 'Usuario'}!
                  </Text>
                  <Text style={styles.greetingSubtext}>Toca el QR para ampliarlo</Text>
                </View>
                <TouchableOpacity
                  style={styles.qrContainerSmall}
                  onPress={() => setShowQRModal(true)}
                  activeOpacity={0.8}
                >
                  {qrValue && (
                    <QRCode
                      value={qrValue}
                      size={70}
                      level="M"
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* My Organizations Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mis Organizaciones</Text>
              <Text style={styles.sectionSubtitle}>
                {userOrganizations.length > 0
                  ? `${userOrganizations.length} organizacion${userOrganizations.length !== 1 ? 'es' : ''}`
                  : 'Aun no perteneces a ninguna'}
              </Text>
            </View>

            {organizationsLoading && userOrganizations.length === 0 && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#7C3AED" />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !organizationsLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No perteneces a ninguna organizacion todavia.
              </Text>
              <Text style={styles.emptySubtext}>
                Explora organizaciones para empezar a acumular puntos.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            {/* Explore Section */}
            <TouchableOpacity style={styles.exploreCard} onPress={handleExplorePress}>
              <View style={styles.exploreContent}>
                <Text style={styles.exploreTitle}>Explorar Organizaciones</Text>
                <Text style={styles.exploreSubtitle}>
                  Descubre nuevas tiendas y comienza a acumular puntos
                </Text>
              </View>
              <Text style={styles.exploreArrow}>→</Text>
            </TouchableOpacity>

            {/* Account Info */}
            <TouchableOpacity 
              style={styles.infoCard}
              onPress={() => router.push('/(app)/profile')}
              activeOpacity={0.7}
            >
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle}>Tu cuenta</Text>
                <Text style={styles.editLink}>Editar →</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nombre</Text>
                <Text style={styles.infoValue}>
                  {beneficiary?.first_name} {beneficiary?.last_name}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{beneficiary?.email}</Text>
              </View>
              {beneficiary?.phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Telefono</Text>
                  <Text style={styles.infoValue}>{beneficiary.phone}</Text>
                </View>
              )}
              {beneficiary?.document_id && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>DNI</Text>
                  <Text style={styles.infoValue}>{beneficiary.document_id}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Sign Out Button */}
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Cerrar Sesion</Text>
            </TouchableOpacity>
          </>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  listContent: {
    padding: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  qrContainerLarge: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  closeButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Header styles
  headerCard: {
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  greetingSubtext: {
    fontSize: 12,
    color: '#E9D5FF',
    marginTop: 4,
  },
  qrContainerSmall: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 12,
    marginLeft: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  orgCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orgCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  orgSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  pointsBadge: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  pointsNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  pointsLabel: {
    fontSize: 10,
    color: '#E9D5FF',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  exploreCard: {
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7C3AED',
    borderStyle: 'dashed',
  },
  exploreContent: {
    flex: 1,
  },
  exploreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7C3AED',
    marginBottom: 4,
  },
  exploreSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  exploreArrow: {
    fontSize: 24,
    color: '#7C3AED',
    marginLeft: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  signOutButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 32,
  },
  signOutText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
});
