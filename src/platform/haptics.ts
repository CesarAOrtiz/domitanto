import * as Haptics from 'expo-haptics';

// La vibración es un complemento: un fallo del motor háptico nunca afecta al apunte.
export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function hapticError(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}

export function hapticTap(): void {
  Haptics.selectionAsync().catch(() => undefined);
}
