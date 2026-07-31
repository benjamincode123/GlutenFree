export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryMuted: string;
  danger: string;
  onPrimary: string;
}

/** Light: black accents on white. Dark: white accents on black — same pairing, inverted. */
export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  border: '#E5E5E5',
  text: '#0F1115',
  textSecondary: '#6B7280',
  primary: '#0F1115',
  primaryMuted: '#D1D5DB',
  danger: '#B3261E',
  onPrimary: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  background: '#0F1115',
  surface: '#1A1D22',
  border: '#2A2E35',
  text: '#FFFFFF',
  textSecondary: '#9AA0A6',
  primary: '#FFFFFF',
  primaryMuted: '#2A2E35',
  danger: '#F28B82',
  onPrimary: '#0F1115',
};
