import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { getProductRepository } from '../src/data/repository';
import {
  ALL_GLUTEN_RATINGS,
  getGlutenRatingMeta,
  GlutenRating,
} from '../src/db/types';

export default function AddProductScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const params = useLocalSearchParams<{ barcode?: string }>();
  const initialBarcode = (params.barcode ?? '').toString();

  const [barcode, setBarcode] = useState(initialBarcode);
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [rating, setRating] = useState<GlutenRating | null>(null);
  const [loading, setLoading] = useState(Boolean(initialBarcode));
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // If a barcode was passed in, prefill the form when it already exists.
  useEffect(() => {
    let cancelled = false;
    if (!initialBarcode) {
      setLoading(false);
      return;
    }
    getProductRepository()
      .getByBarcode(initialBarcode)
      .then((existing) => {
        if (cancelled) return;
        if (existing) {
          setName(existing.name);
          setIngredients(existing.ingredients ?? '');
          setRating(existing.glutenRating);
          setIsEditing(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialBarcode]);

  async function handleSave() {
    if (!barcode.trim()) {
      Alert.alert('Missing barcode', 'Please enter or scan a barcode.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter the product name.');
      return;
    }
    if (!rating) {
      Alert.alert('Missing gluten rating', 'Please choose a gluten rating.');
      return;
    }

    setSaving(true);
    try {
      await getProductRepository().addProduct({
        barcode: barcode.trim(),
        name: name.trim(),
        ingredients: ingredients.trim() || null,
        glutenRating: rating,
      });
      Alert.alert(
        'Saved',
        `"${name.trim()}" has been ${isEditing ? 'updated' : 'added'}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Return to the scanner and clear the intermediate screens.
              router.dismissAll();
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : 'Unknown error.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.guardTitle}>Admin access required</Text>
        <Text style={styles.guardText}>
          Only admins (level 100) can add or edit products.
        </Text>
        <Pressable style={styles.guardButton} onPress={() => router.back()}>
          <Text style={styles.guardButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1B7F3B" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>
          {isEditing ? 'Edit product' : 'Add a product'}
        </Text>
        <Text style={styles.subheading}>
          Save what this product contains and whether it is gluten free.
        </Text>

        <Text style={styles.label}>Barcode</Text>
        <TextInput
          style={styles.input}
          placeholder="Barcode digits"
          placeholderTextColor="#9AA0A6"
          keyboardType="number-pad"
          value={barcode}
          onChangeText={setBarcode}
          editable={!initialBarcode}
        />
        {Boolean(initialBarcode) && (
          <Text style={styles.hint}>Barcode taken from the scan.</Text>
        )}

        <Text style={styles.label}>Product name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Gluten Free Bread"
          placeholderTextColor="#9AA0A6"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Ingredients / contents</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="List the ingredients and any 'produced in a facility that also handles wheat' notes."
          placeholderTextColor="#9AA0A6"
          value={ingredients}
          onChangeText={setIngredients}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Gluten rating</Text>
        {ALL_GLUTEN_RATINGS.map((option) => {
          const meta = getGlutenRatingMeta(option);
          const selected = rating === option;
          return (
            <Pressable
              key={option}
              style={[
                styles.ratingOption,
                {
                  borderColor: selected ? meta.color : '#DADCE0',
                  backgroundColor: selected ? meta.backgroundColor : '#fff',
                },
              ]}
              onPress={() => setRating(option)}
            >
              <View style={[styles.ratingDot, { backgroundColor: meta.color }]} />
              <View style={styles.ratingTextWrap}>
                <Text style={[styles.ratingLabel, { color: meta.color }]}>
                  {meta.label}
                </Text>
                <Text style={styles.ratingDesc}>{meta.description}</Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: selected ? meta.color : '#BDC1C6' },
                ]}
              >
                {selected && (
                  <View style={[styles.radioInner, { backgroundColor: meta.color }]} />
                )}
              </View>
            </Pressable>
          );
        })}

        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : isEditing ? 'Save changes' : 'Save product'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6F8',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#202124',
  },
  subheading: {
    fontSize: 14,
    color: '#5F6368',
    marginTop: 4,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3C4043',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#202124',
  },
  multiline: {
    minHeight: 100,
  },
  hint: {
    fontSize: 12,
    color: '#80868B',
    marginTop: 4,
  },
  ratingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  ratingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  ratingTextWrap: {
    flex: 1,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  ratingDesc: {
    fontSize: 13,
    color: '#5F6368',
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#1B7F3B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#A8C7B4',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  guardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 8,
  },
  guardText: {
    fontSize: 14,
    color: '#5F6368',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  guardButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1B7F3B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  guardButtonText: {
    color: '#1B7F3B',
    fontWeight: '700',
    fontSize: 15,
  },
});
