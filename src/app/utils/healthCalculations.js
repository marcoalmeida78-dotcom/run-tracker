// ============================================================================
// MÓDULO ISOLADO: CÁLCULOS DO MENU SAÚDE
// Nada neste ficheiro é importado fora de components/menus/HealthMenu.js,
// para manter a evolução deste menu separada do resto da app já estabilizada.
// ============================================================================
import {
  initialize,
  getGrantedPermissions,
  requestPermission,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { logEvent } from './debugLog';

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

/**
 * Sugestão de água diária (ml) — orientação geral, não uma prescrição médica
 * individual:
 *   - Base: ~35 ml por kg de peso corporal (referência geral amplamente
 *     citada em nutrição, alinhada com as recomendações de ingestão adequada
 *     da EFSA/IOM para adultos saudáveis).
 *   - Extra por exercício: regra de referência comum em nutrição desportiva
 *     de ~1 ml de água extra por kcal gasta em exercício nesse dia.
 */
export const suggestDailyWaterMl = (weightKg, exerciseKcalToday = 0) => {
  if (!weightKg) return null;
  const base = weightKg * 35;
  const extra = Math.max(0, exerciseKcalToday) * 1;
  return Math.round(base + extra);
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
    // Diagnóstico: estado do SDK do Health Connect antes de tudo. Isto ajuda a
    // perceber se o problema é o dispositivo não ter o Health Connect instalado
    // / atualizado, o que é a causa mais comum de falha silenciosa.
    try {
      if (typeof getSdkStatus === 'function') {
        const sdkStatus = await getSdkStatus();
        const statusLabel =
          SdkAvailabilityStatus && typeof sdkStatus === 'number'
            ? Object.keys(SdkAvailabilityStatus).find((k) => SdkAvailabilityStatus[k] === sdkStatus) || sdkStatus
            : sdkStatus;
        logEvent('GoogleFit', 'Estado do SDK Health Connect', { sdkStatus: statusLabel });
      }
    } catch (sdkErr) {
      logEvent('GoogleFit', 'Não foi possível obter o estado do SDK (getSdkStatus)', sdkErr);
    }

    const isInitialized = await initialize();
    logEvent('GoogleFit', 'initialize() concluído', { isInitialized });
    if (!isInitialized) {
      logEvent('GoogleFit', 'initialize() devolveu false — Health Connect indisponível ou não configurado nativamente.');
      return { totalCalories: 0, available: false, error: 'Health Connect não está disponível neste dispositivo.' };
    }

    const granted = await getGrantedPermissions();
    logEvent('GoogleFit', 'Permissões já concedidas', { granted });
    const alreadyGranted = HEALTH_CONNECT_PERMISSIONS.every((req) =>
      granted.some((g) => g.recordType === req.recordType && g.accessType === req.accessType)
    );
    if (!alreadyGranted) {
      const result = await requestPermission(HEALTH_CONNECT_PERMISSIONS);
      logEvent('GoogleFit', 'Resultado do pedido de permissão', { result });
      if (!result || result.length === 0) {
        logEvent('GoogleFit', 'Permissão recusada ou vazia — utilizador não autorizou o acesso.');
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
    logEvent('GoogleFit', 'readRecords concluído', { totalRegistosLidos: response?.records?.length ?? 0 });

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
    // Diagnóstico detalhado no relatório de erros (mensagem/código reais do
    // erro nativo), mas a mensagem mostrada na app mantém-se simples, como já
    // acontecia — para não mudar o comportamento visível existente.
    logEvent('GoogleFit', 'Exceção ao comunicar com o Google Fit / Health Connect', error);
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
