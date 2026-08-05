// ============================================================================
// MÓDULO ISOLADO: LEMBRETE DIÁRIO DE PESAGEM
// ----------------------------------------------------------------------------
// Usa a dependência expo-notifications que já estava no projeto (não é
// usada em mais nenhum sítio da app, por isso isto não interfere com nada
// já existente). Escrito de forma defensiva quanto à forma exata do
// "trigger", porque essa API já mudou entre versões do expo-notifications.
// ============================================================================
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logEvent } from './debugLog';

const REMINDER_IDENTIFIER = 'health-scale-weigh-in-reminder';

// Forma atual (SchedulableTriggerInputTypes.DAILY) com fallback para a forma
// mais antiga da API ({ hour, minute, repeats: true } sem "type").
const buildDailyTrigger = (hour, minute) => {
  const DAILY_TYPE = Notifications?.SchedulableTriggerInputTypes?.DAILY;
  if (DAILY_TYPE) {
    return { type: DAILY_TYPE, hour, minute, repeats: true };
  }
  return { hour, minute, repeats: true };
};

export const scheduleWeighInReminder = async (hour = 8, minute = 0) => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      logEvent('LembretePesagem', 'Permissão de notificações recusada.');
      return { success: false, error: 'Permissão de notificações recusada.' };
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Lembretes',
        importance: Notifications.AndroidImportance?.DEFAULT,
      });
    }

    // Cancela qualquer lembrete anterior antes de agendar o novo (para nunca
    // ficar com dois lembretes ao mesmo tempo se o utilizador mudar a hora).
    await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_IDENTIFIER,
      content: {
        title: '⚖️ Hora de te pesares',
        body: 'Pesa-te em jejum, antes do pequeno-almoço, para manteres o histórico consistente.',
      },
      trigger: buildDailyTrigger(hour, minute),
    });

    logEvent('LembretePesagem', 'Lembrete diário agendado', { hour, minute });
    return { success: true };
  } catch (error) {
    logEvent('LembretePesagem', 'Erro ao agendar lembrete', error);
    return { success: false, error: 'Não foi possível agendar o lembrete.' };
  }
};

export const cancelWeighInReminder = async () => {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER);
    logEvent('LembretePesagem', 'Lembrete diário cancelado.');
  } catch (error) {
    logEvent('LembretePesagem', 'Erro ao cancelar lembrete', error);
  }
};

/** Devolve { hour, minute } se houver um lembrete agendado, ou null. */
export const getWeighInReminderStatus = async () => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const found = scheduled.find((n) => n.identifier === REMINDER_IDENTIFIER);
    if (!found) return null;
    const trigger = found.trigger || {};
    return { hour: trigger.hour, minute: trigger.minute };
  } catch (error) {
    logEvent('LembretePesagem', 'Erro ao ler estado do lembrete', error);
    return null;
  }
};
