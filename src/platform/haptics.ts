import * as Haptics from 'expo-haptics';

// La vibración es un complemento: un fallo del motor háptico nunca afecta al apunte.
let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function hapticSuccess(): void {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function hapticError(): void {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}

export function hapticTap(): void {
  if (!enabled) return;
  Haptics.selectionAsync().catch(() => undefined);
}
