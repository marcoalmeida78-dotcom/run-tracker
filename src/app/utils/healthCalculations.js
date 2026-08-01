// ============================================================================
// MÓDULO ISOLADO: CÁLCULOS DO MENU SAÚDE
// Nada neste ficheiro é importado fora de components/menus/HealthMenu.js,
// para manter a evolução deste menu separada do resto da app já estabilizada.
// ============================================================================
import { initialize, getGrantedPermissions, requestPermission, readRecords } from 'react-native-health-connect';

const HEALTH_CONNECT_PERMISSIONS = [
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
];

/**
 * TMB (Taxa Metabólica Basal) — fórmula de Mifflin-St Jeor.
 * Recebe o objeto profile da app ({ weight, height, age, gender }).
 * gender: 'masculino' / 'feminino' (aceita também 'male'/'m').
 */
export const calculateBMR = (profile) => {
  const weight = parseFloat(profile?.weight);
  const height = parseFloat(profile?.height);
  const age = parseInt(profile?.age, 10);
  if (!weight || !height || !age) return 0;

  const genderStr = (profile?.gender || 'masculino').toLowerCase();
  const isMale = genderStr.startsWith('m');

  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(isMale ? base + 5 : base - 161);
};

// Devolve a mesma formatação de data usada no histórico da app (ex: "01/08/2026"),
// para conseguirmos identificar quais os registos de HOJE.
const todayPTString = () => new Date().toLocaleDateString('pt-PT');

/**
 * Soma as calorias dos exercícios feitos HOJE na própria app (menu Histórico),
 * e devolve também os intervalos de tempo desses exercícios (quando disponíveis),
 * para depois se poder evitar contar as mesmas calorias outra vez a partir do
 * Google Fit.
 */
export const getAppExerciseSummaryToday = (history = []) => {
  const today = todayPTString();
  const todaysWorkouts = (history || []).filter((item) => item.date === today);

  let totalCalories = 0;
  const intervals = [];

  todaysWorkouts.forEach((item) => {
    totalCalories += parseFloat(item.calories) || 0;
    // startTime/endTime só existem em registos guardados depois desta atualização.
    // Registos antigos (sem essas datas) continuam a contar para o total de
    // calorias, só não entram na deduplicação por intervalo com o Google Fit.
    if (item.startTime && item.endTime) {
      const start = new Date(item.startTime).getTime();
      const end = new Date(item.endTime).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
        intervals.push({ start, end });
      }
    }
  });

  return { totalCalories: Math.round(totalCalories), workoutCount: todaysWorkouts.length, intervals };
};

const intervalsOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/**
 * Lê do Google Fit / Health Connect as calorias ATIVAS (ActiveCaloriesBurned)
 * registadas hoje, registo a registo (não agregado), e soma apenas as que NÃO
 * se sobrepõem aos intervalos de tempo dos exercícios já feitos na app — assim
 * as mesmas calorias nunca são contadas duas vezes.
 */
export const fetchGoogleFitCaloriesToday = async (excludeIntervals = []) => {
  try {
    const isInitialized = await initialize();
    if (!isInitialized) {
      return { totalCalories: 0, available: false, error: 'Health Connect não está disponível neste dispositivo.' };
    }

    const granted = await getGrantedPermissions();
    const alreadyGranted = HEALTH_CONNECT_PERMISSIONS.every((req) =>
      granted.some((g) => g.recordType === req.recordType && g.accessType === req.accessType)
    );
    if (!alreadyGranted) {
      const result = await requestPermission(HEALTH_CONNECT_PERMISSIONS);
      if (!result || result.length === 0) {
        return { totalCalories: 0, available: false, error: 'Permissão do Google Fit / Health Connect recusada.' };
      }
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const response = await readRecords('ActiveCaloriesBurned', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });

    const records = response?.records || [];
    let totalCalories = 0;

    records.forEach((record) => {
      const recStart = new Date(record.startTime).getTime();
      const recEnd = new Date(record.endTime).getTime();
      const kcal = record.energy?.inKilocalories || 0;

      const overlapsAppWorkout = excludeIntervals.some((iv) =>
        intervalsOverlap(recStart, recEnd, iv.start, iv.end)
      );

      if (!overlapsAppWorkout) {
        totalCalories += kcal;
      }
    });

    return { totalCalories: Math.round(totalCalories), available: true, error: null };
  } catch (error) {
    return { totalCalories: 0, available: false, error: 'Erro ao ler dados do Google Fit.' };
  }
};

/**
 * Junta tudo: TMB + exercícios da app + Google Fit (sem duplicar), como pedido:
 * "quanto o corpo queima para se manter vivo" + exercícios da app + Google Fit
 * fora do intervalo já contado pelos exercícios da app.
 */
export const computeDailyEnergySummary = async (profile, history) => {
  const bmr = calculateBMR(profile);
  const appSummary = getAppExerciseSummaryToday(history);
  const fitResult = await fetchGoogleFitCaloriesToday(appSummary.intervals);

  const total = bmr + appSummary.totalCalories + fitResult.totalCalories;

  return {
    bmr,
    appExerciseCalories: appSummary.totalCalories,
    appWorkoutCount: appSummary.workoutCount,
    fitCalories: fitResult.totalCalories,
    fitAvailable: fitResult.available,
    fitError: fitResult.error,
    total: Math.round(total),
  };
};
