import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../utils/supabase';
import type { Redemption } from '../../../../types';

export default function RedemptionHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userOrganizations, beneficiary } = useAuth();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const membership = userOrganizations.find(
    (org) => org.organization_id.toString() === id
  );

  const fetchRedemptions = useCallback(async () => {
    if (!beneficiary?.id || !id) return;

    try {
      console.log('Fetching redemptions for beneficiary:', beneficiary.id, 'organization:', id);
      console.log('Beneficiary ID type:', typeof beneficiary.id);
      console.log('Beneficiary object:', beneficiary);
      
      // Check all redemptions in the database with different ID types
      const { data: allRedemptions } = await supabase
        .from('redemption')
        .select('*')
        .order('redemption_date', { ascending: false })
        .limit(10);
      
      console.log('All recent redemptions in DB:', allRedemptions);
      
      // Try with string ID
      const { data: stringIdData } = await supabase
        .from('redemption')
        .select('*')
        .eq('beneficiary_id', beneficiary.id.toString());
      
      console.log('Redemptions with string ID:', stringIdData);
      
      // Try with number ID
      const { data: numberIdData } = await supabase
        .from('redemption')
        .select('*')
        .eq('beneficiary_id', beneficiary.id);
      
      console.log('Redemptions with number ID:', numberIdData);
      
      const { data, error } = await supabase
        .from('redemption')
        .select(`
          id,
          beneficiary_id,
          product_id,
          points_used,
          quantity,
          redemption_date,
          product:product_id(
            id,
            name,
            description,
            required_points,
            organization_id,
            category:category_id(id, name)
          )
        `)
        .eq('beneficiary_id', beneficiary.id)
        .order('redemption_date', { ascending: false });

      console.log('Query result:', { data, error, dataLength: data?.length });

      if (error) {
        console.error('Error fetching redemptions:', error);
        setRedemptions([]);
      } else if (data) {
        console.log('Raw data:', JSON.stringify(data, null, 2));
        const mappedData = data.map((r: any) => ({
          id: r.id,
          beneficiary_id: r.beneficiary_id,
          product_id: r.product_id,
          organization_id: id,
          points_redeemed: r.points_used,
          status: 'completed',
          redeemed_by: null,
          redeemed_at: r.redemption_date,
          product: r.product ? {
            id: r.product.id,
            category_id: r.product.category?.[0]?.id || '',
            name: r.product.name,
            description: r.product.description,
            required_points: r.product.required_points,
            active: true,
            creation_date: '',
            category: r.product.category?.[0] || undefined,
          } : undefined,
        }));
        console.log('Mapped data:', mappedData.length, 'redemptions');
        setRedemptions(mappedData);
      } else {
        console.log('No data returned');
        setRedemptions([]);
      }
    } catch (err) {
      console.error('Exception fetching redemptions:', err);
      setRedemptions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [beneficiary, id]);

  useEffect(() => {
    fetchRedemptions();
  }, [fetchRedemptions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRedemptions();
  }, [fetchRedemptions]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderRedemptionItem = ({ item }: { item: Redemption }) => (
    <View style={styles.redemptionCard}>
      <View style={styles.redemptionHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>
            {item.product?.name || 'Producto eliminado'}
          </Text>
          {item.product?.category && (
            <Text style={styles.productCategory}>
              {item.product.category.name}
            </Text>
          )}
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>
            -{item.points_redeemed.toLocaleString()}
          </Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>
      
      {item.product?.description && (
        <Text style={styles.productDescription} numberOfLines={2}>
          {item.product.description}
        </Text>
      )}
      
      <View style={styles.redemptionFooter}>
        <Text style={styles.dateText}>{formatDate(item.redeemed_at)}</Text>
        <View
          style={[
            styles.statusBadge,
            item.status === 'completed' ? styles.statusCompleted : styles.statusPending,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              item.status === 'completed' ? styles.statusTextCompleted : styles.statusTextPending,
            ]}
          >
            {item.status === 'completed' ? 'Completado' : 'Pendiente'}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Historial de Canjes',
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

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Historial de Canjes',
          headerStyle: { backgroundColor: '#7C3AED' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <View style={styles.container}>
        {/* Summary Card */}
        {membership && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Total Canjeado</Text>
            <Text style={styles.summaryValue}>
              {membership.total_points_redeemed.toLocaleString()} pts
            </Text>
            <Text style={styles.summarySubtitle}>
              {redemptions.length} {redemptions.length === 1 ? 'canje' : 'canjes'} realizados
            </Text>
          </View>
        )}

        {/* Redemptions List */}
        {redemptions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎁</Text>
            <Text style={styles.emptyTitle}>Sin canjes aún</Text>
            <Text style={styles.emptySubtitle}>
              Tus canjes de productos aparecerán aquí
            </Text>
          </View>
        ) : (
          <FlatList
            data={redemptions}
            keyExtractor={(item) => item.id}
            renderItem={renderRedemptionItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#7C3AED']}
                tintColor="#7C3AED"
              />
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  summaryCard: {
    backgroundColor: '#7C3AED',
    padding: 24,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 14,
    color: '#E9D5FF',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#E9D5FF',
  },
  listContent: {
    padding: 16,
  },
  redemptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  redemptionHeader: {
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
  pointsBadge: {
    alignItems: 'flex-end',
  },
  pointsText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  pointsLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  productDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  redemptionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: '#059669',
  },
  statusTextPending: {
    color: '#D97706',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
