import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  FlatList,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import type { Product } from '../../../types';

type ActiveOffer = {
  id: number;
  display_name: string;
  description: string;
  display_icon: string;
  display_color: string;
  rule_type: string;
  config: { points_per_dollar?: number; percentage?: number };
  time_start: string | null;
  time_end: string | null;
  days_of_week: number[] | null;
  valid_until: string | null;
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export default function OrganizationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userOrganizations, organizationsLoading, beneficiary, refreshOrganizations } = useAuth();
  const [activeOffers, setActiveOffers] = useState<ActiveOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [unfollowLoading, setUnfollowLoading] = useState(false);
  const [activeImageIndices, setActiveImageIndices] = useState<Record<string, number>>({});
  const pointsChannelRef = useRef<RealtimeChannel | null>(null);

  const membership = userOrganizations.find(
    (org) => org.organization_id.toString() === id
  );

  // Set up real-time subscription for points updates
  useEffect(() => {
    if (beneficiary?.id && id) {
      const channel = supabase
        .channel(`org-points-${beneficiary.id}-${id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'beneficiary_organization',
            filter: `beneficiary_id=eq.${beneficiary.id}`,
          },
          (payload) => {
            // Refresh organizations to get updated points
            refreshOrganizations();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Subscribed to points updates
          }
        });

      pointsChannelRef.current = channel;

      return () => {
        if (pointsChannelRef.current) {
          supabase.removeChannel(pointsChannelRef.current);
          pointsChannelRef.current = null;
        }
      };
    }
  }, [beneficiary?.id, id, refreshOrganizations]);

  const fetchActiveOffers = useCallback(async () => {
    setOffersLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_active_offers', {
        p_organization_id: parseInt(id),
        p_branch_id: null,
        p_check_time: new Date().toISOString(),
      });

      if (error) {
        console.error('Error fetching active offers:', error);
        setActiveOffers([]);
      } else if (data) {
        setActiveOffers(data);
      } else {
        setActiveOffers([]);
      }
    } catch (err) {
      console.error('Exception fetching active offers:', err);
      setActiveOffers([]);
    } finally {
      setOffersLoading(false);
    }
  }, [id]);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('product')
        .select(`
          *,
          category:category_id(id, name),
          stock:stock(
            id,
            branch_id,
            quantity,
            branch:branch(id, name)
          )
        `)
        .eq('organization_id', parseInt(id))
        .eq('active', true)
        .order('required_points', { ascending: true });

      if (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      } else if (data) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error('Exception fetching products:', err);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [id]);

  // Fetch active offers for this organization
  useEffect(() => {
    if (id) {
      fetchActiveOffers();
      fetchProducts();
    }
  }, [id, fetchActiveOffers, fetchProducts]);

  const formatTimeRange = (start: string | null, end: string | null) => {
    if (!start && !end) return 'Todo el dia';
    const formatTime = (time: string) => time.slice(0, 5);
    return `${formatTime(start || '00:00')} - ${formatTime(end || '23:59')}`;
  };

  const formatDays = (days: number[] | null) => {
    if (!days || days.length === 0 || days.length === 7) return 'Todos los dias';
    return days.map(d => DAY_NAMES[d]).join(', ');
  };

  const handleUnfollow = async () => {
    if (!membership) return;
    
    Alert.alert(
      'Dejar de seguir organizacion',
      `¿Estas seguro que deseas dejar de seguir a ${organization?.name}? Tu historial de puntos y canjes se mantendra guardado y podras volver a seguir esta organizacion cuando quieras.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dejar de seguir',
          style: 'destructive',
          onPress: async () => {
            setUnfollowLoading(true);
            try {
              const { error } = await supabase
                .from('beneficiary_organization')
                .update({ is_active: false })
                .eq('id', membership.id);

              if (error) {
                Alert.alert(
                  'Error',
                  'No se pudo dejar de seguir la organizacion. Por favor intenta nuevamente.'
                );
                console.error('Error unfollowing organization:', error);
              } else {
                await refreshOrganizations();
                Alert.alert(
                  'Exito',
                  `Has dejado de seguir a ${organization?.name}. Puedes volver a seguir esta organizacion desde la pantalla de explorar.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => router.back(),
                    },
                  ]
                );
              }
            } catch (err) {
              console.error('Exception unfollowing organization:', err);
              Alert.alert(
                'Error',
                'Ocurrio un error inesperado. Por favor intenta nuevamente.'
              );
            } finally {
              setUnfollowLoading(false);
            }
          },
        },
      ]
    );
  };

  if (organizationsLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Cargando...',
            headerStyle: { backgroundColor: '#7C3AED' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      </>
    );
  }

  if (!membership) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'No encontrado',
            headerStyle: { backgroundColor: '#7C3AED' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            No se encontro la membresia con esta organizacion.
          </Text>
        </View>
      </>
    );
  }

  const organization = membership.organization;

  return (
    <>
      <Stack.Screen
        options={{
          title: organization?.name || 'Organizacion',
          headerStyle: { backgroundColor: '#7C3AED' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Points Card */}
        <View style={styles.pointsCard}>
          <Text style={styles.orgName}>{organization?.name}</Text>
          <View style={styles.pointsBox}>
            <Text style={styles.pointsLabel}>Tus Puntos</Text>
            <Text style={styles.pointsValue}>
              {membership.available_points.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Estadisticas</Text>
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => router.push(`/(app)/organization/${id}/history`)}
            >
              <Ionicons name="time-outline" size={18} color="#7C3AED" />
              <Text style={styles.historyButtonText}>Historial</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {membership.total_points_earned.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Puntos ganados</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {membership.total_points_redeemed.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Puntos canjeados</Text>
            </View>
          </View>
        </View>

        {/* Membership Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Informacion de membresia</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Miembro desde</Text>
            <Text style={styles.infoValue}>
              {new Date(membership.joined_date).toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estado</Text>
            <View
              style={[
                styles.statusBadge,
                membership.is_active ? styles.statusActive : styles.statusInactive,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  membership.is_active
                    ? styles.statusTextActive
                    : styles.statusTextInactive,
                ]}
              >
                {membership.is_active ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
          </View>
        </View>

        {/* Organization Details */}
        {organization && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Sobre la organizacion</Text>
            {organization.business_name && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Razon social</Text>
                <Text style={styles.infoValue}>{organization.business_name}</Text>
              </View>
            )}
            {organization.tax_id && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CUIT</Text>
                <Text style={styles.infoValue}>{organization.tax_id}</Text>
              </View>
            )}
          </View>
        )}

        {/* Active Campaigns */}
        {offersLoading ? (
          <View style={styles.offersLoadingCard}>
            <ActivityIndicator size="small" color="#7C3AED" />
            <Text style={styles.offersLoadingText}>Cargando promociones...</Text>
          </View>
        ) : activeOffers.length > 0 ? (
          <View style={styles.offersCard}>
            <Text style={styles.offersTitle}>Promociones Activas</Text>
            {activeOffers.map((offer) => (
              <View key={offer.id} style={styles.offerItem}>
                <View style={[styles.offerIconBg, { backgroundColor: offer.display_color || '#7C3AED' }]}>
                  <Text style={styles.offerIcon}>{offer.display_icon || '🎉'}</Text>
                </View>
                <View style={styles.offerInfo}>
                  <Text style={styles.offerName}>{offer.display_name}</Text>
                  {offer.description && (
                    <Text style={styles.offerDesc}>{offer.description}</Text>
                  )}
                  <View style={styles.offerSchedule}>
                    {(offer.time_start || offer.time_end) && (
                      <Text style={styles.offerTime}>
                        {formatTimeRange(offer.time_start, offer.time_end)}
                      </Text>
                    )}
                    {offer.days_of_week && offer.days_of_week.length < 7 && (
                      <Text style={styles.offerDays}>
                        {formatDays(offer.days_of_week)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Products for Redemption */}
        <View style={styles.productsCard}>
          <Text style={styles.productsTitle}>Productos disponibles para canje</Text>
          <Text style={styles.productsSubtitle}>
            Canjea tus puntos por estos productos
          </Text>
          
          {productsLoading ? (
            <View style={styles.productsLoadingContainer}>
              <ActivityIndicator size="small" color="#7C3AED" />
              <Text style={styles.productsLoadingText}>Cargando productos...</Text>
            </View>
          ) : products.length === 0 ? (
            <View style={styles.emptyProductsContainer}>
              <Text style={styles.emptyProductsText}>🎁</Text>
              <Text style={styles.emptyProductsTitle}>No hay productos disponibles</Text>
              <Text style={styles.emptyProductsSubtitle}>
                Pronto habra productos para canjear con tus puntos
              </Text>
            </View>
          ) : (
            <View style={styles.productsList}>
              {products.map((product) => {
                const totalStock = product.stock?.reduce(
                  (sum, s) => sum + (s.quantity || 0),
                  0
                ) || 0;
                const canAfford = membership.available_points >= product.required_points;
                const inStock = totalStock > 0;

                return (
                  <View
                    key={product.id}
                    style={[
                      styles.productItem,
                      !canAfford && styles.productItemDisabled,
                    ]}
                  >
                    {product.image_urls && product.image_urls.length > 0 && (
                      <View style={styles.imageCarouselContainer}>
                        <FlatList
                          data={product.image_urls}
                          horizontal
                          pagingEnabled
                          showsHorizontalScrollIndicator={false}
                          onScroll={(event) => {
                            const slideIndex = Math.round(
                              event.nativeEvent.contentOffset.x /
                              (Dimensions.get('window').width - 64)
                            );
                            setActiveImageIndices(prev => ({
                              ...prev,
                              [product.id]: slideIndex
                            }));
                          }}
                          scrollEventThrottle={16}
                          renderItem={({ item }) => (
                            <Image
                              source={{ uri: item }}
                              style={styles.productImage}
                              resizeMode="cover"
                            />
                          )}
                          keyExtractor={(item, index) => `${product.id}-image-${index}`}
                        />
                        {product.image_urls.length > 1 && (
                          <View style={styles.paginationDots}>
                            {product.image_urls.map((_, index) => (
                              <View
                                key={index}
                                style={[
                                  styles.dot,
                                  (activeImageIndices[product.id] || 0) === index && styles.activeDot,
                                ]}
                              />
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                    <View style={styles.productHeader}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{product.name}</Text>
                        {product.category && (
                          <Text style={styles.productCategory}>
                            {product.category.name}
                          </Text>
                        )}
                      </View>
                      <View style={styles.productPoints}>
                        <Text style={styles.productPointsValue}>
                          {product.required_points.toLocaleString()}
                        </Text>
                        <Text style={styles.productPointsLabel}>pts</Text>
                      </View>
                    </View>
                    
                    {product.description && (
                      <Text style={styles.productDescription} numberOfLines={2}>
                        {product.description}
                      </Text>
                    )}
                    
                    <View style={styles.productFooter}>
                      <View
                        style={[
                          styles.stockBadge,
                          inStock ? styles.stockBadgeInStock : styles.stockBadgeOutOfStock,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stockBadgeText,
                            inStock ? styles.stockBadgeTextInStock : styles.stockBadgeTextOutOfStock,
                          ]}
                        >
                          {inStock ? `${totalStock} disponibles` : 'Sin stock'}
                        </Text>
                      </View>
                      
                      {!canAfford && inStock && (
                        <Text style={styles.insufficientPointsText}>
                          Te faltan {(product.required_points - membership.available_points).toLocaleString()} pts
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* How to earn points */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Como ganar puntos</Text>
          <Text style={styles.helpText}>
            Realiza compras en {organization?.name || 'esta tienda'} y muestra tu
            DNI al cajero. Los puntos se acreditaran automaticamente a tu cuenta.
          </Text>
        </View>

        {/* Unfollow Button */}
        <TouchableOpacity
          style={[styles.unfollowButton, unfollowLoading && styles.unfollowButtonDisabled]}
          onPress={handleUnfollow}
          disabled={unfollowLoading}
        >
          {unfollowLoading ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <>
              <Ionicons name="remove-circle-outline" size={20} color="#DC2626" />
              <Text style={styles.unfollowButtonText}>Dejar de seguir organizacion</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  pointsCard: {
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  orgName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  pointsBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 20,
  },
  pointsLabel: {
    fontSize: 14,
    color: '#E9D5FF',
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statsCard: {
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
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
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
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
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
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#D1FAE5',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#059669',
  },
  statusTextInactive: {
    color: '#DC2626',
  },
  helpCard: {
    backgroundColor: '#F3E8FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7C3AED',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  // Offers styles
  offersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#7C3AED',
  },
  offersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7C3AED',
    marginBottom: 16,
  },
  offerItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  offerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  offerIcon: {
    fontSize: 20,
  },
  offerInfo: {
    flex: 1,
  },
  offerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  offerDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  offerSchedule: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  offerTime: {
    fontSize: 12,
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  offerDays: {
    fontSize: 12,
    color: '#059669',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  offersLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 16,
  },
  offersLoadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  // Products styles
  productsCard: {
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
  productsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  productsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  productsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  productsLoadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  emptyProductsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyProductsText: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyProductsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptyProductsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  productsList: {
    gap: 12,
  },
  productItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  productItemDisabled: {
    opacity: 0.6,
  },
  imageCarouselContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  productImage: {
    width: Dimensions.get('window').width - 64,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 12,
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  productPoints: {
    alignItems: 'flex-end',
  },
  productPointsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  productPointsLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  productDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stockBadgeInStock: {
    backgroundColor: '#D1FAE5',
  },
  stockBadgeOutOfStock: {
    backgroundColor: '#FEE2E2',
  },
  stockBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stockBadgeTextInStock: {
    color: '#059669',
  },
  stockBadgeTextOutOfStock: {
    color: '#DC2626',
  },
  insufficientPointsText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  unfollowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  unfollowButtonDisabled: {
    opacity: 0.6,
  },
  unfollowButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
});
