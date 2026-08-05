// ============================================================================
// MÓDULO ISOLADO: TESTE DE COOPER, FC MÁX E ZONAS DE INTENSIDADE
// ----------------------------------------------------------------------------
// Três fórmulas independentes, todas verificadas contra fontes publicadas
// (não inventadas):
//   1) Classificação do Cooper — tabelas oficiais do documento de referência.
//   2) VO2 Máx do Cooper — Cooper (1968): (distância_m − 504.9) / 44.73.
//      Só usa a distância (não os batimentos cardíacos — a fórmula oficial
//      do teste de Cooper não os usa).
//   3) FC Máx — fórmula de Tanaka et al. (2001): 208 − 0.7×idade. Só depende
//      da idade, é a mesma em qualquer momento (não "pertence" a um teste).
//   4) Zona de intensidade — a partir de %FC Máx, usando as bandas
//      fornecidas (50-60% / 60-70% / 70-80% / 80-90% / 90-100%).
// ============================================================================
import { COOPER_TABLE_MEN, COOPER_TABLE_WOMEN, COOPER_LEVELS } from '../constants/cooperClassification';

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Classifica a distância percorrida no teste de Cooper (12 min), segundo
 * idade e género, num dos 5 níveis. Devolve também um "rank" (0-4) para
 * comparar classificações entre testes diferentes.
 */
export const classifyCooperDistance = (distanceM, age, gender) => {
  if (!distanceM || !age) return null;
  const isMale = (gender || 'masculino').toLowerCase().startsWith('m');
  const table = isMale ? COOPER_TABLE_MEN : COOPER_TABLE_WOMEN;

  // Se a idade for menor que a faixa mais baixa da tabela, usa essa faixa na
  // mesma (não faz sentido não classificar só por a pessoa ter 12 anos).
  const bracket =
    table.find((b) => age >= b.minAge && age <= b.maxAge) ||
    (age < table[0].minAge ? table[0] : table[table.length - 1]);

  const [t1, t2, t3, t4] = bracket.thresholds;
  let rank = 0;
  if (distanceM >= t4) rank = 4;
  else if (distanceM >= t3) rank = 3;
  else if (distanceM >= t2) rank = 2;
  else if (distanceM >= t1) rank = 1;
  else rank = 0;

  return { label: COOPER_LEVELS[rank], rank };
};

/**
 * VO2 Máx pelo teste de Cooper — Cooper, K.H. (1968), "A Means of Assessing
 * Maximal Oxygen Intake". Só precisa da distância percorrida em 12 minutos.
 */
export const calculateCooperVo2Max = (distanceM) => {
  if (!distanceM || distanceM <= 0) return null;
  const vo2 = (distanceM - 504.9) / 44.73;
  return Math.max(15, Math.min(85, round1(vo2)));
};

/**
 * FC Máx — Tanaka, Monahan & Seals (2001), a fórmula etária mais citada
 * atualmente (mais precisa que a clássica 220−idade). Só depende da idade.
 */
export const calculateFcMaxTanaka = (age) => {
  const parsedAge = parseFloat(age);
  if (!parsedAge || parsedAge <= 0) return null;
  return Math.round(208 - 0.7 * parsedAge);
};

const ZONES = [
  { zone: 1, min: 0.5, max: 0.6, label: 'Recuperação / Caminhada' },
  { zone: 2, min: 0.6, max: 0.7, label: 'Resistência Base / Corrida Ligeira' },
  { zone: 3, min: 0.7, max: 0.8, label: 'Aeróbica / Ritmo Moderado' },
  { zone: 4, min: 0.8, max: 0.9, label: 'Limiar / Ritmo Intenso' },
  { zone: 5, min: 0.9, max: 1.01, label: 'Máximo / Sprint' },
];

/**
 * Classifica um batimento cardíaco (bpm) numa das 5 zonas de intensidade,
 * a partir da % de FC Máx atingida. Fora das bandas 50-100%, sinaliza isso
 * em vez de forçar uma zona.
 */
export const classifyHeartRateZone = (heartRate, fcMax) => {
  if (!heartRate || !fcMax) return null;
  const percent = heartRate / fcMax;

  if (percent < 0.5) {
    return { zone: null, label: 'Abaixo da Zona 1 (esforço muito leve)', percent: Math.round(percent * 100) };
  }
  if (percent > 1.0) {
    return { zone: 5, label: 'Acima da Zona 5 (esforço máximo)', percent: Math.round(percent * 100) };
  }

  const found = ZONES.find((z) => percent >= z.min && percent < z.max) || ZONES[ZONES.length - 1];
  return { zone: found.zone, label: found.label, percent: Math.round(percent * 100) };
};

/**
 * Melhor classificação do Teste de Cooper já alcançada no histórico — usada
 * para mostrar "o teu melhor resultado" como motivação ao iniciar um novo
 * teste. Usa a classificação já guardada em cada registo (a partir desta
 * atualização); para registos antigos sem esse campo, recalcula com o perfil
 * atual como aproximação razoável.
 */
export const getBestCooperClassification = (history = [], profile = {}) => {
  const cooperEntries = (history || []).filter((item) => item.title === 'Teste de Cooper (12 min)');
  if (cooperEntries.length === 0) return null;

  let best = null;
  cooperEntries.forEach((entry) => {
    let label = entry.cooperClassification;
    let rank = label ? COOPER_LEVELS.indexOf(label) : -1;

    if (rank === -1) {
      const distanceM = parseFloat(entry.distanceKm) * 1000;
      const recomputed = classifyCooperDistance(distanceM, parseFloat(profile?.age), profile?.gender);
      if (recomputed) {
        label = recomputed.label;
        rank = recomputed.rank;
      }
    }

    if (rank > (best?.rank ?? -1)) {
      best = { label, rank };
    }
  });

  return best;
};
