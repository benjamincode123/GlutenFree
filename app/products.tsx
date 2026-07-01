import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlutenBadge } from '../src/components/GlutenBadge';
import { getProductRepository } from '../src/data/repository';
import { Product } from '../src/db/types';

export default function ProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      getProductRepository()
        .getAll()
        .then((rows) => {
          if (!cancelled) setProducts(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1B7F3B" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={products}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <Text style={styles.countText}>
          {products.length} product{products.length === 1 ? '' : 's'} in database
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyText}>No products yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() =>
            router.push({ pathname: '/result', params: { barcode: item.barcode } })
          }
        >
          <View style={styles.rowText}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.barcode}>{item.barcode}</Text>
          </View>
          <GlutenBadge rating={item.glutenRating} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  content: {
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6F8',
  },
  countText: {
    fontSize: 13,
    color: '#5F6368',
    marginBottom: 12,
    fontWeight: '600',
  },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202124',
  },
  barcode: {
    fontSize: 13,
    color: '#80868B',
    marginTop: 2,
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#80868B',
  },
});
