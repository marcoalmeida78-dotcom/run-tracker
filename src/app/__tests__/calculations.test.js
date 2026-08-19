// ============================================================================
// TESTES: utils/calculations.js
// ----------------------------------------------------------------------------
// Valores esperados calculados à mão a partir das fórmulas exatas do código
// (ver comentários em cada bloco). Onde há aritmética de vírgula flutuante,
// usa-se toBeCloseTo em vez de igualdade exata.
// ============================================================================
import {
  calculateHaversine,
  calculateCalories,
  calculatePace,
  calculateRockportVo2Max,
  calculate15MilesVo2Max,
  calculate1MileRunVo2Max,
  getBestTimeForTitle,
  getSuddenDeathProgress,
  generateTimeline,
  formatHMS,
} from '../utils/calculations';

describe('formatHMS', () => {
  it('formata segundos como HH:MM:SS com zeros à esquerda', () => {
    expect(formatHMS(0)).toBe('00:00:00');
    expect(formatHMS(65)).toBe('00:01:05');
    expect(formatHMS(3661)).toBe('01:01:01');
  });
});

describe('calculateHaversine', () => {
  it('devolve 0 para o mesmo ponto', () => {
    expect(calculateHaversine(38.7223, -9.1393, 38.7223, -9.1393)).toBe(0);
  });

  it('1 grau de latitude ≈ 111.19 km (R=6371, valor de referência bem conhecido)', () => {
    expect(calculateHaversine(0, 0, 1, 0)).toBeCloseTo(111.19, 0);
  });

  it('a distância aumenta de forma monótona com a diferença de latitude', () => {
    const d1 = calculateHaversine(0, 0, 0.001, 0);
    const d2 = calculateHaversine(0, 0, 0.01, 0);
    const d3 = calculateHaversine(0, 0, 0.1, 0);
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });
});

describe('calculatePace', () => {
  // ritmo (min/km) = (tempo_seg / 60) / distância_km
  it('calcula o ritmo médio corretamente', () => {
    // 5km em 25min (1500s) = 5 min/km
    expect(calculatePace(5, 1500)).toBe('5.00');
  });

  it('devolve null com distância percorrida abaixo de 15 metros (evita valores instáveis)', () => {
    expect(calculatePace(0.01, 30)).toBeNull();
    expect(calculatePace(0, 30)).toBeNull();
  });

  it('devolve null com tempo zero ou negativo (sem divisão por zero)', () => {
    expect(calculatePace(1, 0)).toBeNull();
    expect(calculatePace(1, -5)).toBeNull();
  });

  it('é consistente para o mesmo par distância/tempo, independentemente de quantas vezes é chamada', () => {
    expect(calculatePace(3.2, 1000)).toBe(calculatePace(3.2, 1000));
  });
});

describe('getSuddenDeathProgress', () => {
  it('com 0 km percorridos, devolve 0 feitos e 1000 em falta', () => {
    expect(getSuddenDeathProgress(0)).toEqual({ metersDone: 0, metersMissing: 1000, metersTarget: 1000 });
  });

  it('com distância a meio (0.45km), devolve 450 feitos e 550 em falta', () => {
    expect(getSuddenDeathProgress(0.45)).toEqual({ metersDone: 450, metersMissing: 550, metersTarget: 1000 });
  });

  it('com o desafio completo (1km), devolve 1000 feitos e 0 em falta', () => {
    expect(getSuddenDeathProgress(1)).toEqual({ metersDone: 1000, metersMissing: 0, metersTarget: 1000 });
  });

  it('nunca ultrapassa o total (ex: GPS com alguma distância a mais), fica sempre a 0 em falta', () => {
    expect(getSuddenDeathProgress(1.2)).toEqual({ metersDone: 1000, metersMissing: 0, metersTarget: 1000 });
  });
});

describe('calculateCalories', () => {
  // MET=8.5 se velocidade > 7km/h (corrida), MET=4.0 caso contrário (caminhada)
  // kcal = MET * 3.5 * peso * (tempo_min / 200)
  it('usa MET de corrida (8.5) quando a velocidade é > 7 km/h', () => {
    // 5km em 30min = 10km/h > 7 → MET 8.5
    // kcal = 8.5*3.5*70*(30/200) = 312.375 → arredonda para 312
    expect(calculateCalories(5, 1800, 70)).toBe(312);
  });

  it('usa MET de caminhada (4.0) quando a velocidade é ≤ 7 km/h', () => {
    // 2km em 30min = 4km/h ≤ 7 → MET 4.0
    // kcal = 4*3.5*70*(30/200) = 147
    expect(calculateCalories(2, 1800, 70)).toBe(147);
  });

  it('usa 70kg por omissão quando não é dado nenhum peso', () => {
    expect(calculateCalories(2, 1800)).toBe(calculateCalories(2, 1800, 70));
  });

  it('devolve 0 quando o tempo é 0 (sem divisão por zero)', () => {
    expect(calculateCalories(0, 0, 70)).toBe(0);
  });
});

describe('calculateRockportVo2Max — Kline et al. (1987)', () => {
  it('calcula corretamente com batimentos cardíacos válidos (homem)', () => {
    // timeSec=900 (15min), heartRate=140, peso=70kg, idade=30, masculino
    // Valor calculado à mão a partir da fórmula exata do código: 44.8
    const result = calculateRockportVo2Max(900, 140, { weight: 70, age: 30, gender: 'masculino' });
    expect(result).toBeCloseTo(44.8, 1);
  });

  it('devolve null sem batimentos cardíacos (a fórmula exige mesmo este valor)', () => {
    expect(calculateRockportVo2Max(900, null, { weight: 70, age: 30, gender: 'masculino' })).toBeNull();
    expect(calculateRockportVo2Max(900, 0, { weight: 70, age: 30, gender: 'masculino' })).toBeNull();
  });

  it('nunca sai do intervalo fisiologicamente plausível [15, 85]', () => {
    const veryLow = calculateRockportVo2Max(3000, 200, { weight: 120, age: 80, gender: 'feminino' });
    const veryHigh = calculateRockportVo2Max(60, 60, { weight: 50, age: 18, gender: 'masculino' });
    expect(veryLow).toBeGreaterThanOrEqual(15);
    expect(veryHigh).toBeLessThanOrEqual(85);
  });
});

describe('calculate15MilesVo2Max', () => {
  it('calcula corretamente (12 minutos)', () => {
    // timeSec=720 (12min) → vo2 = (483/12)+3.5 = 43.75 → arredonda para 43.8
    expect(calculate15MilesVo2Max(720)).toBeCloseTo(43.8, 1);
  });
});

describe('calculate1MileRunVo2Max', () => {
  it('calcula corretamente (homem, 8 minutos)', () => {
    // timeSec=480 (8min), peso=70kg, idade=30, masculino → 72.4 (calculado à mão)
    const result = calculate1MileRunVo2Max(480, { weight: 70, age: 30, gender: 'masculino' });
    expect(result).toBeCloseTo(72.4, 1);
  });
});

describe('getBestTimeForTitle', () => {
  const history = [
    { title: 'Desafio Rockport (1609m)', timeSec: 900 },
    { title: 'Desafio Rockport (1609m)', timeSec: 850 },
    { title: 'Desafio Rockport (1609m)', timeSec: 920 },
    { title: 'Teste de Cooper (12 min)', timeSec: 720 },
  ];

  it('devolve o menor tempo entre registos com o mesmo título exato', () => {
    expect(getBestTimeForTitle(history, 'Desafio Rockport (1609m)')).toBe(850);
  });

  it('devolve null se não houver nenhum registo com esse título', () => {
    expect(getBestTimeForTitle(history, 'Título Que Não Existe')).toBeNull();
  });

  it('devolve null com histórico vazio ou título vazio', () => {
    expect(getBestTimeForTitle([], 'Qualquer')).toBeNull();
    expect(getBestTimeForTitle(history, '')).toBeNull();
  });

  it('ignora registos com timeSec inválido (NaN ou ≤ 0)', () => {
    const withInvalid = [
      { title: 'X', timeSec: 100 },
      { title: 'X', timeSec: 'não é um número' },
      { title: 'X', timeSec: -5 },
    ];
    expect(getBestTimeForTitle(withInvalid, 'X')).toBe(100);
  });
});

describe('generateTimeline', () => {
  it('começa sempre com aquecimento (300s) e termina sempre com arrefecimento (300s)', () => {
    const phases = generateTimeline(0);
    expect(phases[0]).toMatchObject({ type: 'warmup', durationSec: 300 });
    expect(phases[phases.length - 1]).toMatchObject({ type: 'cooldown', durationSec: 300 });
  });

  it('a fase imediatamente antes do arrefecimento é sempre uma corrida (nunca caminhada)', () => {
    // Testa em várias sessões (níveis diferentes) para confirmar a regra em geral,
    // não só num caso particular.
    [0, 3, 30, 60, 74].forEach((sessionIdx) => {
      const phases = generateTimeline(sessionIdx);
      const beforeCooldown = phases[phases.length - 2];
      expect(beforeCooldown.type).toBe('run');
    });
  });

  it('Nível 1 (sessão 0): 18 repetições de corrida/caminhada, sem caminhada a seguir à última corrida', () => {
    // Nível 1 atual: runSec=10, walkSec=60, repeats=18 (ver constants/runProgram.js)
    // Esperado: 1 aquecimento + 18 corridas + 17 caminhadas + 1 arrefecimento = 37 fases
    const phases = generateTimeline(0);
    expect(phases.length).toBe(37);
    const runCount = phases.filter((p) => p.type === 'run').length;
    const walkCount = phases.filter((p) => p.type === 'walk').length;
    expect(runCount).toBe(18);
    expect(walkCount).toBe(17);
  });
});
