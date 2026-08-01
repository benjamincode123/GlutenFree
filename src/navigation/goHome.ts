import type { Router } from 'expo-router';

/** Always land on the AltUten scanner / home screen. */
export function goHome(router: Router): void {
  try {
    if (typeof router.dismissTo === 'function') {
      router.dismissTo('/');
      return;
    }
  } catch {
    // Fall through.
  }
  try {
    if (typeof router.dismissAll === 'function') {
      router.dismissAll();
    }
  } catch {
    // Fall through.
  }
  router.replace('/');
}

/** Prefer previous screen; if the stack is empty, go home. */
export function goBackOrHome(router: Router): void {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // Fall through.
  }
  goHome(router);
}
