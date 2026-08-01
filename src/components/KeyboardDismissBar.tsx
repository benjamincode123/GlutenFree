import { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';

/**
 * Shared TextInput wrapper used across the app.
 * No keyboard accessory / “Done” toolbar — the system keyboard dismisses normally.
 */
export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput(props, ref) {
    return <TextInput ref={ref} {...props} />;
  }
);
