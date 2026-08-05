// ============================================================================
// MÓDULO ISOLADO: TENDÊNCIAS DE PESO E COMPOSIÇÃO CORPORAL
// ----------------------------------------------------------------------------
// Tudo aqui é aritmética simples sobre o teu próprio histórico (médias,
// diferenças, extrapolação linear) — não há nenhuma fórmula clínica nova
// inventada. Só compara os teus dados com os teus próprios dados.
// ============================================================================

const round1 = (n) => Math.round(n * 10) / 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Média móvel do peso nos últimos `windowDays` dias (por omissão, 7).
 * Ajuda a filtrar o "ruído" das flutuações diárias (água, comida, etc.),
 * técnica recomendada por várias apps de acompanhamento de peso.
 */
export const computeMovingAverageWeight = (scaleHistory = [], windowDays = 7) => {
  if (!scaleHistory || scaleHistory.length === 0) return null;
  const cutoff = Date.now() - windowDays * DAY_MS;
  const withinWindow = scaleHistory.filter((e) => Number(e.id) >= cutoff);
  if (withinWindow.length === 0) return null;
  const avg = withinWindow.reduce((sum, e) => sum + Number(e.weight || 0), 0) / withinWindow.length;
  return round1(avg);
};

const averageOf = (arr, key) => {
  const valid = arr.filter((e) => e[key] != null && !Number.isNaN(Number(e[key])));
  if (valid.length === 0) return null;
  return valid.reduce((sum, e) => sum + Number(e[key]), 0) / valid.length;
};

/**
 * Compara a média da última semana com a média da semana anterior, e gera
 * uma mensagem simples sobre a tendência — incluindo, quando há dados de
 * composição corporal, se a mudança de peso parece ser sobretudo massa gorda
 * ou massa magra. Regras simples e transparentes, não um diagnóstico.
 */
export const computeTrendAlert = (scaleHistory = []) => {
  if (!scaleHistory || scaleHistory.length < 2) return null;

  const now = Date.now();
  const recentWindow = scaleHistory.filter((e) => Number(e.id) >= now - DAY_MS * 7);
  const priorWindow = scaleHistory.filter(
    (e) => Number(e.id) < now - DAY_MS * 7 && Number(e.id) >= now - DAY_MS * 14
  );

  if (recentWindow.length === 0 || priorWindow.length === 0) return null; // dados insuficientes

  const recentWeight = averageOf(recentWindow, 'weight');
  const priorWeight = averageOf(priorWindow, 'weight');
  if (recentWeight == null || priorWeight == null) return null;

  const weightDelta = recentWeight - priorWeight;

  if (Math.abs(weightDelta) < 0.3) {
    return { type: 'stable', message: `Peso estável nas últimas 2 semanas (média de ${round1(recentWeight)} kg).` };
  }

  let compositionNote = '';
  const recentFat = averageOf(recentWindow, 'fatMassKg');
  const priorFat = averageOf(priorWindow, 'fatMassKg');
  const recentLean = averageOf(recentWindow, 'leanMassKg');
  const priorLean = averageOf(priorWindow, 'leanMassKg');

  if (recentFat != null && priorFat != null && recentLean != null && priorLean != null) {
    const fatDelta = recentFat - priorFat;
    const leanDelta = recentLean - priorLean;

    if (weightDelta < 0) {
      if (fatDelta < 0 && leanDelta >= -0.15) {
        compositionNote = ' — sobretudo à custa de massa gorda 👍';
      } else if (leanDelta < -0.3 && Math.abs(leanDelta) >= Math.abs(fatDelta) * 0.5) {
        compositionNote = ' — atenção, parte significativa parece ser massa magra, não só gordura.';
      }
    } else if (leanDelta > 0.2 && fatDelta <= leanDelta) {
      compositionNote = ' — parece incluir ganho de massa magra.';
    } else if (fatDelta > 0.3) {
      compositionNote = ' — sobretudo massa gorda.';
    }
  }

  const direction = weightDelta < 0 ? 'Perdeste' : 'Ganhaste';
  return {
    type: weightDelta < 0 ? 'loss' : 'gain',
    message: `${direction} ${round1(Math.abs(weightDelta))} kg nas últimas 2 semanas${compositionNote}`,
  };
};

/**
 * Progresso em relação a um objetivo de peso, e uma estimativa (linear, a
 * partir da tua taxa de mudança recente) de quando o poderás atingir.
 * Devolve etaWeeks = null quando não há tendência clara na direção certa —
 * mais honesto do que inventar uma data.
 */
export const estimateGoalProgress = (scaleHistory = [], goalWeightKg, startWeightKg) => {
  if (!scaleHistory || scaleHistory.length === 0 || !goalWeightKg) return null;

  const sorted = [...scaleHistory].sort((a, b) => Number(a.id) - Number(b.id));
  const currentWeight = Number(sorted[sorted.length - 1].weight);
  const baseline = startWeightKg != null ? Number(startWeightKg) : Number(sorted[0].weight);

  const totalToChange = baseline - goalWeightKg;
  const changedSoFar = baseline - currentWeight;
  const progressPercent =
    totalToChange !== 0 ? Math.max(0, Math.min(100, (changedSoFar / totalToChange) * 100)) : 100;

  // Taxa de mudança recente (kg/semana), usando até às últimas 4 semanas de pesagens.
  const recentEntries = sorted.filter((e) => Number(e.id) >= Date.now() - 28 * DAY_MS);
  let ratePerWeek = null;
  if (recentEntries.length >= 2) {
    const first = recentEntries[0];
    const last = recentEntries[recentEntries.length - 1];
    const daysSpan = (Number(last.id) - Number(first.id)) / DAY_MS;
    if (daysSpan >= 3) {
      ratePerWeek = ((Number(last.weight) - Number(first.weight)) / daysSpan) * 7;
    }
  }

  const remaining = goalWeightKg - currentWeight;
  let etaWeeks = null;
  if (ratePerWeek && Math.abs(ratePerWeek) > 0.02 && Math.sign(ratePerWeek) === Math.sign(remaining)) {
    etaWeeks = Math.round(Math.abs(remaining / ratePerWeek));
  }

  return {
    currentWeight: round1(currentWeight),
    remainingKg: round1(remaining),
    progressPercent: Math.round(progressPercent),
    ratePerWeek: ratePerWeek != null ? round1(ratePerWeek) : null,
    etaWeeks,
  };
};
