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
import { calculateCalories } from './calculations';

// Lê PASSOS, não calorias — ver nota completa em fetchGoogleFitStepsCaloriesToday
// sobre porquê (ActiveCaloriesBurned nunca devolvia dados neste telemóvel).
const HEALTH_CONNECT_PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
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
 * Comprimento de passada estimado a partir da altura — fórmula amplamente
 * usada em apps de pedómetro/fitness para converter passos em distância:
 *   passada(m) ≈ altura(m) × 0.415 (homens) / × 0.413 (mulheres)
 * Não é uma medição real do teu passo — é uma aproximação populacional.
 */
const estimateStrideMeters = (heightCm, gender) => {
  const heightM = parseFloat(heightCm) / 100;
  if (!heightM) return null;
  const isMale = (gender || 'masculino').toLowerCase().startsWith('m');
  return heightM * (isMale ? 0.415 : 0.413);
};

/**
 * Lê os PASSOS do Google Fit / Health Connect registados hoje, registo a
 * registo, e converte-os em calorias — em vez de ler diretamente
 * "ActiveCaloriesBurned", que neste telemóvel (só com dados do próprio
 * telefone, sem relógio/pulseira) devolvia sempre zero registos, porque o
 * Google Fit no telemóvel não costuma escrever esse tipo de dado sozinho,
 * só contagem de passos.
 *
 * Conversão, registo a registo (cada StepsRecord já vem com o seu próprio
 * startTime/endTime):
 *   1) distância(km) = passos × passada_estimada(m) / 1000
 *   2) tempo(seg) = duração real do próprio registo
 *   3) calorias = calculateCalories(distância, tempo, peso) — a MESMA função
 *      e os MESMOS limiares de MET já usados para os exercícios da app, para
 *      não introduzir uma terceira filosofia de cálculo de calorias diferente.
 *
 * Registos que se sobrepõem a um exercício já contado na app continuam a ser
 * excluídos (mesma lógica de sempre), para nunca contar a mesma caminhada
 * duas vezes.
 */
export const fetchGoogleFitStepsCaloriesToday = async (excludeIntervals = [], profile = {}) => {
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
      return { totalCalories: 0, totalSteps: 0, available: false, error: 'Health Connect não está disponível neste dispositivo.' };
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
        return { totalCalories: 0, totalSteps: 0, available: false, error: 'Permissão do Google Fit / Health Connect recusada.' };
      }
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const response = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });
    logEvent('GoogleFit', 'readRecords (Steps) concluído', { totalRegistosLidos: response?.records?.length ?? 0 });

    const records = response?.records || [];
    const strideM = estimateStrideMeters(profile?.height, profile?.gender);
    const weightKg = parseFloat(profile?.weight);

    let totalCalories = 0;
    let totalSteps = 0;

    records.forEach((record) => {
      const recStart = new Date(record.startTime).getTime();
      const recEnd = new Date(record.endTime).getTime();
      const steps = record.count || 0;

      const overlapsAppWorkout = excludeIntervals.some((iv) =>
        intervalsOverlap(recStart, recEnd, iv.start, iv.end)
      );
      if (overlapsAppWorkout) return;

      totalSteps += steps;

      if (!strideM || !weightKg || steps <= 0 || !(recEnd > recStart)) return;

      const distanceKm = (steps * strideM) / 1000;
      const timeSec = (recEnd - recStart) / 1000;
      totalCalories += calculateCalories(distanceKm, timeSec, weightKg);
    });

    if (!strideM || !weightKg) {
      logEvent('GoogleFit', 'Passos lidos mas sem altura/peso no perfil para converter em calorias.', { totalSteps });
    }

    return { totalCalories: Math.round(totalCalories), totalSteps, available: true, error: null };
  } catch (error) {
    // Diagnóstico detalhado no relatório de erros (mensagem/código reais do
    // erro nativo), mas a mensagem mostrada na app mantém-se simples, como já
    // acontecia — para não mudar o comportamento visível existente.
    logEvent('GoogleFit', 'Exceção ao comunicar com o Google Fit / Health Connect', error);
    return { totalCalories: 0, totalSteps: 0, available: false, error: 'Erro ao ler dados do Google Fit.' };
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
  const fitResult = await fetchGoogleFitStepsCaloriesToday(appSummary.intervals, profile);

  const total = bmr + appSummary.totalCalories + fitResult.totalCalories;

  return {
    bmr,
    appExerciseCalories: appSummary.totalCalories,
    appWorkoutCount: appSummary.workoutCount,
    fitCalories: fitResult.totalCalories,
    fitSteps: fitResult.totalSteps,
    fitAvailable: fitResult.available,
    fitError: fitResult.error,
    total: Math.round(total),
  };
};
