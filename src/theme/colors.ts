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

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F8F9FA',
  border: '#E8EAED',
  text: '#202124',
  textSecondary: '#5F6368',
  primary: '#1B7F3B',
  primaryMuted: '#A8C7B4',
  danger: '#B3261E',
  onPrimary: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  background: '#121418',
  surface: '#1A1D22',
  border: '#2A2E35',
  text: '#F1F3F4',
  textSecondary: '#9AA0A6',
  primary: '#3D9B5F',
  primaryMuted: '#2A5A3C',
  danger: '#F28B82',
  onPrimary: '#FFFFFF',
};
