// ============================================================================
// TESTES: utils/healthTrends.js
// ----------------------------------------------------------------------------
// Estas funções usam Date.now() internamente para decidir janelas de 7/14/28
// dias — por isso os dados de teste usam sempre "now - X dias" calculado no
// próprio teste, nunca datas fixas, para o teste continuar válido em
// qualquer dia em que for corrido.
// ============================================================================
import { computeMovingAverageWeight, computeTrendAlert, estimateGoalProgress } from '../utils/healthTrends';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (n) => String(now - n * DAY_MS);

describe('computeMovingAverageWeight', () => {
  it('calcula a média só das pesagens dentro da janela de dias pedida', () => {
    const history = [
      { id: daysAgo(1), weight: 80 },
      { id: daysAgo(3), weight: 82 },
      { id: daysAgo(6), weight: 84 },
      { id: daysAgo(10), weight: 90 }, // fora da janela de 7 dias
    ];
    // (80 + 82 + 84) / 3 = 82
    expect(computeMovingAverageWeight(history, 7)).toBe(82);
  });

  it('devolve null com histórico vazio ou sem nada dentro da janela', () => {
    expect(computeMovingAverageWeight([], 7)).toBeNull();
    expect(computeMovingAverageWeight([{ id: daysAgo(30), weight: 80 }], 7)).toBeNull();
  });
});

describe('computeTrendAlert', () => {
  it('diz "estável" quando a diferença é inferior a 0.3kg', () => {
    const history = [
      { id: daysAgo(1), weight: 80 },
      { id: daysAgo(10), weight: 80.2 },
    ];
    const result = computeTrendAlert(history);
    expect(result.type).toBe('stable');
  });

  it('perda de peso sobretudo de massa gorda — nota específica na mensagem', () => {
    const history = [
      { id: daysAgo(1), weight: 78.0, fatMassKg: 14.0, leanMassKg: 64.0 },
      { id: daysAgo(10), weight: 80.0, fatMassKg: 15.9, leanMassKg: 64.1 },
    ];
    const result = computeTrendAlert(history);
    expect(result.type).toBe('loss');
    expect(result.message).toContain('Perdeste 2 kg');
    expect(result.message).toContain('massa gorda');
  });

  it('ganho de peso sobretudo de massa gorda — nota específica na mensagem', () => {
    const history = [
      { id: daysAgo(1), weight: 82, fatMassKg: 16, leanMassKg: 65 },
      { id: daysAgo(10), weight: 80, fatMassKg: 14.5, leanMassKg: 64.9 },
    ];
    const result = computeTrendAlert(history);
    expect(result.type).toBe('gain');
    expect(result.message).toContain('Ganhaste 2 kg');
  });

  it('devolve null sem dados suficientes (só uma das duas semanas, ou histórico curto)', () => {
    expect(computeTrendAlert([{ id: daysAgo(1), weight: 80 }])).toBeNull();
    expect(computeTrendAlert([{ id: daysAgo(1), weight: 80 }, { id: daysAgo(2), weight: 80 }])).toBeNull();
  });
});

describe('estimateGoalProgress', () => {
  it('calcula progresso, taxa semanal e ETA a partir da tendência recente', () => {
    const history = [
      { id: daysAgo(20), weight: 85 },
      { id: daysAgo(10), weight: 82 },
      { id: daysAgo(1), weight: 80 },
    ];
    const result = estimateGoalProgress(history, 75, 85);
    expect(result.currentWeight).toBe(80);
    // (85-80)/(85-75) × 100 = 50%
    expect(result.progressPercent).toBe(50);
    expect(result.remainingKg).toBe(-5);
    expect(result.ratePerWeek).toBeCloseTo(-1.8, 1);
    expect(result.etaWeeks).toBe(3);
  });

  it('etaWeeks fica null quando a tendência vai na direção errada (mais honesto que inventar uma data)', () => {
    const history = [
      { id: daysAgo(10), weight: 80 },
      { id: daysAgo(1), weight: 82 }, // a ganhar peso...
    ];
    // ...mas o objetivo é PERDER peso — não há tendência na direção certa
    const result = estimateGoalProgress(history, 75, 85);
    expect(result.etaWeeks).toBeNull();
  });

  it('devolve null sem histórico ou sem peso-objetivo', () => {
    expect(estimateGoalProgress([], 75, 85)).toBeNull();
    expect(estimateGoalProgress([{ id: daysAgo(1), weight: 80 }], null, 85)).toBeNull();
  });
});
