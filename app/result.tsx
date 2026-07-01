import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { GlutenBadge } from '../src/components/GlutenBadge';
import { getProductRepository } from '../src/data/repository';
import { getGlutenRatingMeta, Product } from '../src/db/types';

type LoadState = 'loading' | 'found' | 'not_found' | 'error';

export default function ResultScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const params = useLocalSearchParams<{ barcode?: string }>();
  const barcode = (params.barcode ?? '').toString();

  const [state, setState] = useState<LoadState>('loading');
  const [product, setProduct] = useState<Product | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        if (!barcode) {
          setState('not_found');
          return;
        }
        setState('loading');
        try {
          const found = await getProductRepository().getByBarcode(barcode);
          if (cancelled) return;
          if (found) {
            setProduct(found);
            setState('found');
          } else {
            setProduct(null);
            setState('not_found');
          }
        } catch (err) {
          if (cancelled) return;
          setErrorMessage(err instanceof Error ? err.message : 'Lookup failed.');
          setState('error');
        }
      }

      load();
      return () => {
        cancelled = true;
      };
    }, [barcode])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.barcodeCard}>
        <Text style={styles.barcodeLabel}>Scanned barcode</Text>
        <Text style={styles.barcodeValue}>{barcode || '—'}</Text>
      </View>

      {state === 'loading' && (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" color="#1B7F3B" />
          <Text style={styles.mutedText}>Looking up product...</Text>
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centerBlock}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.mutedText}>{errorMessage}</Text>
        </View>
      )}

      {state === 'found' && product && (
        <View style={styles.productCard}>
          <Text style={styles.productName}>{product.name}</Text>
          <GlutenBadge rating={product.glutenRating} size="large" />
          <Text style={styles.ratingDescription}>
            {getGlutenRatingMeta(product.glutenRating).description}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Ingredients</Text>
          <Text style={styles.ingredients}>
            {product.ingredients?.trim()
              ? product.ingredients
              : 'No ingredients recorded.'}
          </Text>

          {isAdmin && (
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                router.push({
                  pathname: '/add',
                  params: { barcode: product.barcode },
                })
              }
            >
              <Text style={styles.secondaryButtonText}>Edit this product</Text>
            </Pressable>
          )}
        </View>
      )}

      {state === 'not_found' && (
        <View style={styles.productCard}>
          <Text style={styles.notFoundTitle}>Product not found</Text>
          <Text style={styles.mutedText}>
            {isAdmin
              ? 'This barcode is not in the database yet. You can add it now so it is recognized next time.'
              : 'This barcode is not in the database yet. Only admins can add new products.'}
          </Text>
          {isAdmin && (
            <Pressable
              style={styles.primaryButton}
              onPress={() =>
                router.push({ pathname: '/add', params: { barcode } })
              }
            >
              <Text style={styles.primaryButtonText}>Add this product</Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable style={styles.scanAgainButton} onPress={() => router.back()}>
        <Text style={styles.scanAgainText}>Scan again</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  barcodeCard: {
    backgroundColor: '#181B20',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  barcodeLabel: {
    color: '#8A9099',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  barcodeValue: {
    color: '#4CD787',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  centerBlock: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
  },
  productName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 12,
  },
  ratingDescription: {
    marginTop: 12,
    fontSize: 15,
    color: '#3C4043',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E0E2E6',
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5F6368',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  ingredients: {
    fontSize: 15,
    lineHeight: 22,
    color: '#3C4043',
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 8,
  },
  mutedText: {
    marginTop: 8,
    fontSize: 14,
    color: '#5F6368',
    lineHeight: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#B3261E',
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#1B7F3B',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1B7F3B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1B7F3B',
    fontWeight: '700',
    fontSize: 15,
  },
  scanAgainButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  scanAgainText: {
    color: '#5F6368',
    fontWeight: '600',
    fontSize: 15,
  },
});
