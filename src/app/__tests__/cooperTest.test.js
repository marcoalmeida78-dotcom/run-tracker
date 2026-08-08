// ============================================================================
// TESTES: utils/cooperTest.js
// ----------------------------------------------------------------------------
// Usa os limiares reais de constants/cooperClassification.js para a faixa
// 20-29 anos (homens: [1600, 2200, 2400, 2800] / mulheres: [1500, 1800, 2200, 2700]),
// confirmados diretamente no ficheiro antes de escrever estes testes.
// ============================================================================
import {
  classifyCooperDistance,
  calculateCooperVo2Max,
  calculateFcMaxTanaka,
  classifyHeartRateZone,
  getBestCooperClassification,
} from '../utils/cooperTest';

describe('classifyCooperDistance', () => {
  it('classifica corretamente um homem de 25 anos em cada nível (faixa 20-29: 1600/2200/2400/2800)', () => {
    expect(classifyCooperDistance(1500, 25, 'masculino').label).toBe('Muito Mau');
    expect(classifyCooperDistance(1700, 25, 'masculino').label).toBe('Mau');
    expect(classifyCooperDistance(2300, 25, 'masculino').label).toBe('Médio');
    expect(classifyCooperDistance(2500, 25, 'masculino').label).toBe('Bom');
    expect(classifyCooperDistance(2900, 25, 'masculino').label).toBe('Excelente');
  });

  it('classifica corretamente uma mulher de 25 anos (faixa 20-29: 1500/1800/2200/2700)', () => {
    expect(classifyCooperDistance(2000, 25, 'feminino').label).toBe('Médio');
  });

  it('usa a faixa etária mais baixa da tabela quando a idade é inferior a todas', () => {
    // Homem de 10 anos → usa a faixa 13-14 (a mais baixa da tabela)
    const result = classifyCooperDistance(1900, 10, 'masculino');
    expect(result.label).toBe('Muito Mau'); // 1900 < 2000 (limiar da faixa 13-14)
  });

  it('devolve rank crescente (0 a 4) conforme o nível sobe', () => {
    const levels = [1500, 1700, 2300, 2500, 2900].map(
      (d) => classifyCooperDistance(d, 25, 'masculino').rank
    );
    expect(levels).toEqual([0, 1, 2, 3, 4]);
  });

  it('devolve null sem distância ou sem idade', () => {
    expect(classifyCooperDistance(0, 25, 'masculino')).toBeNull();
    expect(classifyCooperDistance(2000, null, 'masculino')).toBeNull();
  });
});

describe('calculateCooperVo2Max — Cooper (1968)', () => {
  it('calcula (distância_m − 504.9) / 44.73', () => {
    // (2400 - 504.9) / 44.73 = 42.4 (calculado à mão)
    expect(calculateCooperVo2Max(2400)).toBeCloseTo(42.4, 1);
  });

  it('devolve null sem distância', () => {
    expect(calculateCooperVo2Max(0)).toBeNull();
    expect(calculateCooperVo2Max(null)).toBeNull();
  });

  it('nunca sai do intervalo [15, 85]', () => {
    expect(calculateCooperVo2Max(100)).toBeGreaterThanOrEqual(15);
    expect(calculateCooperVo2Max(10000)).toBeLessThanOrEqual(85);
  });
});

describe('calculateFcMaxTanaka', () => {
  it('calcula 208 − 0.7×idade', () => {
    expect(calculateFcMaxTanaka(30)).toBe(187);
    expect(calculateFcMaxTanaka(45)).toBe(177); // 176.5 arredonda para 177
  });

  it('devolve null sem idade válida', () => {
    expect(calculateFcMaxTanaka(0)).toBeNull();
    expect(calculateFcMaxTanaka(null)).toBeNull();
  });
});

describe('classifyHeartRateZone', () => {
  const fcMax = 190;

  it('classifica corretamente cada zona (limites de %FCMáx)', () => {
    expect(classifyHeartRateZone(95, fcMax).zone).toBe(1); // 50%
    expect(classifyHeartRateZone(120, fcMax).zone).toBe(2); // ~63%
    expect(classifyHeartRateZone(140, fcMax).zone).toBe(3); // ~74%
    expect(classifyHeartRateZone(160, fcMax).zone).toBe(4); // ~84%
    expect(classifyHeartRateZone(180, fcMax).zone).toBe(5); // ~95%
  });

  it('sinaliza abaixo da Zona 1 sem forçar uma zona', () => {
    const result = classifyHeartRateZone(50, fcMax); // ~26%
    expect(result.zone).toBeNull();
    expect(result.label).toMatch(/Abaixo/);
  });

  it('sinaliza acima da Zona 5 em vez de rejeitar', () => {
    const result = classifyHeartRateZone(200, fcMax); // ~105%
    expect(result.zone).toBe(5);
    expect(result.label).toMatch(/Acima/);
  });

  it('devolve null sem batimentos ou sem FC Máx', () => {
    expect(classifyHeartRateZone(0, fcMax)).toBeNull();
    expect(classifyHeartRateZone(140, null)).toBeNull();
  });
});

describe('getBestCooperClassification', () => {
  it('escolhe a classificação de maior rank entre vários testes de Cooper', () => {
    const history = [
      { title: 'Teste de Cooper (12 min)', cooperClassification: 'Médio', distanceKm: '2.30' },
      { title: 'Teste de Cooper (12 min)', cooperClassification: 'Excelente', distanceKm: '2.90' },
      { title: 'Teste de Cooper (12 min)', cooperClassification: 'Mau', distanceKm: '1.70' },
      { title: 'Desafio Rockport (1609m)', cooperClassification: 'Bom', distanceKm: '1.61' }, // ignorado (título diferente)
    ];
    const best = getBestCooperClassification(history, { age: 25, gender: 'masculino' });
    expect(best.label).toBe('Excelente');
  });

  it('recalcula com o perfil atual se um registo antigo não tiver a classificação guardada', () => {
    const history = [
      { title: 'Teste de Cooper (12 min)', distanceKm: '2.50' }, // sem cooperClassification — regista antigo
    ];
    const best = getBestCooperClassification(history, { age: 25, gender: 'masculino' });
    expect(best.label).toBe('Bom'); // 2500m, homem 25 anos → Bom
  });

  it('devolve null sem nenhum teste de Cooper no histórico', () => {
    expect(getBestCooperClassification([{ title: 'Outra Coisa' }], { age: 25 })).toBeNull();
    expect(getBestCooperClassification([], {})).toBeNull();
  });
});
