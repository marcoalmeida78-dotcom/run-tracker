// ============================================================================
// TESTES: utils/calculations.js
// ----------------------------------------------------------------------------
// Valores esperados calculados à mão a partir das fórmulas exatas do código
// (ver comentários em cada bloco). Onde há aritmética de vírgula flutuante,
// usa-se toBeCloseTo em vez de igualdade exata.
// ============================================================================
import {
  calculateHaversine,
  calculateVincenty,
  calculateCalories,
  calculatePace,
  calculateRockportVo2Max,
  calculate15MilesVo2Max,
  calculate1MileRunVo2Max,
  calculateRouteDistanceKm,
  evaluateGpsMovement,
  getBestTimeForTitle,
  getFinalDistanceKm,
  getSuddenDeathProgress,
  GPS_MIN_MOVEMENT_KM,
  isGpsAccuracyAcceptable,
  isSegmentSpeedPlausible,
  simplifyRouteDouglasPeucker,
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

describe('calculateVincenty', () => {
  it('devolve 0 para o mesmo ponto', () => {
    expect(calculateVincenty(38.7223, -9.1393, 38.7223, -9.1393)).toBeCloseTo(0, 5);
  });

  it('dá um valor muito próximo do Haversine para distâncias curtas (diferença <0.5%)', () => {
    // Para distâncias curtas (o caso real desta app — uma sessão de treino),
    // Vincenty e Haversine só divergem pela ligeira diferença entre uma
    // esfera perfeita e o elipsoide WGS-84 — a diferença é pequena mas
    // sistemática, e é precisamente essa a razão de trocar de fórmula.
    const hav = calculateHaversine(38.7223, -9.1393, 38.73, -9.15);
    const vin = calculateVincenty(38.7223, -9.1393, 38.73, -9.15);
    const diffPct = Math.abs(vin - hav) / hav;
    expect(diffPct).toBeLessThan(0.005);
  });

  it('no equador, 1 grau de latitude ≈ 110.57 km no elipsoide WGS-84 (difere do valor esférico do Haversine, 111.19 km — é exatamente essa correção que o Vincenty introduz)', () => {
    expect(calculateVincenty(0, 0, 1, 0)).toBeCloseTo(110.57, 1);
  });

  it('a distância aumenta de forma monótona com a diferença de latitude', () => {
    const d1 = calculateVincenty(0, 0, 0.001, 0);
    const d2 = calculateVincenty(0, 0, 0.01, 0);
    const d3 = calculateVincenty(0, 0, 0.1, 0);
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });
});

describe('isGpsAccuracyAcceptable', () => {
  it('aceita leituras com boa precisão (accuracy <= 25m)', () => {
    expect(isGpsAccuracyAcceptable(5)).toBe(true);
    expect(isGpsAccuracyAcceptable(25)).toBe(true);
  });

  it('rejeita leituras com fraca precisão (accuracy > 25m)', () => {
    expect(isGpsAccuracyAcceptable(26)).toBe(false);
    expect(isGpsAccuracyAcceptable(100)).toBe(false);
  });

  it('não rejeita só por falta de informação de precisão (accuracy nula/indefinida)', () => {
    expect(isGpsAccuracyAcceptable(null)).toBe(true);
    expect(isGpsAccuracyAcceptable(undefined)).toBe(true);
    expect(isGpsAccuracyAcceptable(NaN)).toBe(true);
  });
});

describe('GPS_MIN_MOVEMENT_KM (piso de movimento mínimo)', () => {
  // Bug grave relatado após a primeira versão deste filtro: fazer o piso
  // SUBIR com a accuracy (ex: 70% da accuracy) parecia razoável em teoria,
  // mas como as leituras de GPS chegam a cada ~1 segundo, o movimento real
  // nesse intervalo (1-4m a correr/andar) já é da mesma ordem de grandeza da
  // própria margem de erro do GPS (normal rondar os 10-20m) — o filtro
  // acabava por rejeitar quase todo o movimento real (distância parada,
  // pausas por "inatividade" mesmo em andamento). Por isso o piso tem de ser
  // pequeno e FIXO, não escalado.
  it('é um valor pequeno e fixo (1.5m), não uma função', () => {
    expect(GPS_MIN_MOVEMENT_KM).toBeCloseTo(0.0015, 5);
  });

  it('um segundo de corrida lenta (~2m/s → ~2m por leitura) ultrapassa o piso', () => {
    const metersPerReading = 2;
    expect(metersPerReading / 1000).toBeGreaterThan(GPS_MIN_MOVEMENT_KM);
  });
});

describe('isSegmentSpeedPlausible', () => {
  it('aceita velocidades normais de corrida/caminhada', () => {
    // 3m em 1s = 10.8 km/h (corrida moderada)
    expect(isSegmentSpeedPlausible(0.003, 1)).toBe(true);
  });

  it('rejeita um salto de GPS que implique uma velocidade impossível a pé', () => {
    // 50m num único segundo = 180 km/h — impossível a pé, é erro de GPS
    expect(isSegmentSpeedPlausible(0.05, 1)).toBe(false);
  });

  it('não rejeita só por falta de intervalo de tempo válido (dt nulo, zero ou negativo)', () => {
    expect(isSegmentSpeedPlausible(0.05, null)).toBe(true);
    expect(isSegmentSpeedPlausible(0.05, 0)).toBe(true);
    expect(isSegmentSpeedPlausible(0.05, -1)).toBe(true);
  });
});

describe('evaluateGpsMovement (âncora com acumulação)', () => {
  // Esta é a correção do bug real relatado: uma caminhada livre de mais de
  // 1km ficou registada com ~350m. A causa: a versão anterior comparava
  // sempre com a leitura imediatamente anterior e avançava essa referência
  // a cada leitura — mesmo quando o movimento ficava abaixo do piso. A um
  // ritmo de caminhada normal (~1.2 m/s, abaixo do piso de 1.5m), isto
  // perdia praticamente 100% da distância, leitura atrás de leitura.
  const degPerMeterLat = 1 / 111320;
  const lat = 38.7223;
  const lon = -9.1393;
  const metersToPoint = (m) => ({ latitude: lat + m * degPerMeterLat, longitude: lon });

  it('não avança (não conta) um único passo de caminhada lenta, abaixo do piso', () => {
    const anchor = metersToPoint(0);
    const point = metersToPoint(1.2); // abaixo do piso de 1.5m
    const result = evaluateGpsMovement(anchor, 0, point, 1000); // timestamps em ms
    expect(result.shouldCommit).toBe(false);
  });

  it('CRÍTICO: ao contrário da versão anterior, o movimento lento soma-se ao longo de várias leituras contra a MESMA âncora, até ultrapassar o piso', () => {
    const anchor = metersToPoint(0);
    // 1 passo (1.2m) não basta...
    expect(evaluateGpsMovement(anchor, 0, metersToPoint(1.2), 1000).shouldCommit).toBe(false);
    // ...mas comparado com a MESMA âncora, 2 passos (2.4m) já ultrapassa o piso.
    const twoSteps = evaluateGpsMovement(anchor, 0, metersToPoint(2.4), 2000);
    expect(twoSteps.shouldCommit).toBe(true);
    expect(twoSteps.distanceKm).toBeCloseTo(0.0024, 4);
  });

  it('simula uma caminhada real de 1000m a ritmo lento (1.2 m/s) e confirma que quase toda a distância é contabilizada', () => {
    let anchor = metersToPoint(0);
    let anchorT = 0;
    let total = 0;
    const metersPerTick = 1.2;
    const ticks = Math.round(1000 / metersPerTick);

    for (let i = 1; i <= ticks; i++) {
      const point = metersToPoint(i * metersPerTick);
      const tMs = i * 1000; // timestamps em ms, 1 leitura por segundo
      const result = evaluateGpsMovement(anchor, anchorT, point, tMs);
      if (result.shouldCommit) {
        total += result.distanceKm;
        anchor = point;
        anchorT = tMs;
      }
      // se não ultrapassar o piso, a âncora fica-se — não avança.
    }

    // Com o bug antigo isto dava ~0m. Com a correção, fica muito próximo do
    // real (perde-se quando muito uma fração do último troço por ainda não
    // ter ultrapassado o piso quando a simulação termina).
    expect(total * 1000).toBeGreaterThan(990);
  });

  it('um salto de GPS implausível não avança a âncora nem conta distância', () => {
    const anchor = metersToPoint(0);
    const impossibleJump = metersToPoint(50); // 50m num único segundo = 180km/h
    const result = evaluateGpsMovement(anchor, 0, impossibleJump, 1000);
    expect(result.plausible).toBe(false);
    expect(result.shouldCommit).toBe(false);
  });

  it('não rebenta com timestamps nulos/indefinidos (trata como sem informação de tempo)', () => {
    const anchor = metersToPoint(0);
    const point = metersToPoint(5);
    expect(() => evaluateGpsMovement(anchor, null, point, null)).not.toThrow();
  });
});

describe('simplifyRouteDouglasPeucker', () => {
  it('mantém uma linha reta praticamente igual (sem pontos redundantes a remover)', () => {
    const straightLine = [
      { latitude: 0, longitude: 0 },
      { latitude: 0.001, longitude: 0 },
      { latitude: 0.002, longitude: 0 },
      { latitude: 0.003, longitude: 0 },
    ];
    const simplified = simplifyRouteDouglasPeucker(straightLine);
    expect(simplified.length).toBe(2); // só os extremos, pontos do meio são colineares
    expect(simplified[0]).toEqual(straightLine[0]);
    expect(simplified[simplified.length - 1]).toEqual(straightLine[3]);
  });

  it('remove um "zigue-zague" de ruído entre dois pontos praticamente parados', () => {
    const noisyStationary = [
      { latitude: 38.7223, longitude: -9.1393 },
      { latitude: 38.72231, longitude: -9.13929 }, // ruído ~1-2m
      { latitude: 38.72229, longitude: -9.13931 }, // ruído ~1-2m
      { latitude: 38.7223, longitude: -9.1393 },
    ];
    const simplified = simplifyRouteDouglasPeucker(noisyStationary);
    expect(simplified.length).toBeLessThan(noisyStationary.length);
  });

  it('mantém uma curva real (desvio grande o suficiente para não ser ruído)', () => {
    const realCurve = [
      { latitude: 0, longitude: 0 },
      { latitude: 0.001, longitude: 0.001 }, // desvio de dezenas de metros — é a estrada a virar
      { latitude: 0.002, longitude: 0 },
    ];
    const simplified = simplifyRouteDouglasPeucker(realCurve);
    expect(simplified.length).toBe(3); // mantém o ponto da curva
  });

  it('devolve o próprio array (copiado) para menos de 3 pontos', () => {
    const twoPoints = [
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 },
    ];
    expect(simplifyRouteDouglasPeucker(twoPoints)).toEqual(twoPoints);
  });
});

describe('calculateRouteDistanceKm', () => {
  it('soma a distância Vincenty entre pontos consecutivos', () => {
    const points = [
      { latitude: 0, longitude: 0 },
      { latitude: 0.01, longitude: 0 },
      { latitude: 0.02, longitude: 0 },
    ];
    const total = calculateRouteDistanceKm(points);
    const expected = calculateVincenty(0, 0, 0.01, 0) + calculateVincenty(0.01, 0, 0.02, 0);
    expect(total).toBeCloseTo(expected, 6);
  });

  it('devolve 0 para menos de 2 pontos', () => {
    expect(calculateRouteDistanceKm([])).toBe(0);
    expect(calculateRouteDistanceKm([{ latitude: 0, longitude: 0 }])).toBe(0);
  });
});

describe('getFinalDistanceKm', () => {
  // Esta é a correção do bug relatado (5.01km vs 3.98km no mesmo percurso):
  // no fim da sessão, a distância gravada passa a ser recalculada a partir do
  // trajeto GPS completo e simplificado, em vez do valor acumulado ao vivo.
  // Por construção geométrica (desigualdade triangular), simplificar um
  // trajeto nunca pode torná-lo mais comprido — por isso o valor recalculado
  // nunca pode ser MAIOR do que a soma bruta ponto-a-ponto do mesmo trajeto.
  it('para um trajeto com ruído, o valor recalculado nunca excede a soma bruta ponto-a-ponto', () => {
    const noisyRoute = [
      { latitude: 38.7223, longitude: -9.1393 },
      { latitude: 38.72235, longitude: -9.13925 },
      { latitude: 38.7224, longitude: -9.1392 },
      { latitude: 38.72235, longitude: -9.13925 }, // "recuo" de ruído
      { latitude: 38.7225, longitude: -9.1391 },
      { latitude: 38.7226, longitude: -9.139 },
    ];
    const rawSum = calculateRouteDistanceKm(noisyRoute);
    const cleaned = getFinalDistanceKm(noisyRoute, rawSum);
    expect(cleaned).toBeLessThanOrEqual(rawSum + 1e-9);
  });

  it('cai em segurança para o valor ao vivo com poucos pontos GPS (sessão muito curta)', () => {
    const tooFewPoints = [{ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0 }];
    expect(getFinalDistanceKm(tooFewPoints, 1.23)).toBe(1.23);
    expect(getFinalDistanceKm(null, 1.23)).toBe(1.23);
    expect(getFinalDistanceKm([], 1.23)).toBe(1.23);
  });
});

describe('calculateCalories', () => {
  // Fórmula corrigida em 09/2026 (ver comentário em utils/calculations.js):
  // MET contínuo a partir da velocidade real (equações ACSM), com o mesmo
  // limiar de 7km/h para escolher entre caminhada e corrida.
  // kcal = (VO2/3.5) * 3.5 * peso * (tempo_min) / 200 = VO2 * peso * tempo_min / 200
  it('usa a equação ACSM de corrida quando a velocidade é > 7 km/h', () => {
    // 5km em 30min = 10km/h > 7 → corrida: VO2 = 0.2*166.667+3.5 = 36.833
    // kcal = 36.833*70*30/200 = 386.75 → arredonda para 387
    expect(calculateCalories(5, 1800, 70)).toBe(387);
  });

  it('usa a equação ACSM de caminhada quando a velocidade é ≤ 7 km/h', () => {
    // 2km em 30min = 4km/h ≤ 7 → caminhada: VO2 = 0.1*66.667+3.5 = 10.167
    // kcal = 10.167*70*30/200 = 106.75 → arredonda para 107
    expect(calculateCalories(2, 1800, 70)).toBe(107);
  });

  it('usa 70kg por omissão quando não é dado nenhum peso', () => {
    expect(calculateCalories(2, 1800)).toBe(calculateCalories(2, 1800, 70));
  });

  it('devolve 0 quando o tempo é 0 (sem divisão por zero)', () => {
    expect(calculateCalories(0, 0, 70)).toBe(0);
  });

  // Bug reportado pelo utilizador (histórico real): sessões com a mesma
  // duração mas distâncias bem diferentes davam sempre as mesmas calorias,
  // porque a fórmula antiga só usava o tempo depois de escolher o MET.
  it('dá calorias diferentes a sessões com a mesma duração mas distâncias diferentes', () => {
    // Réplica das sessões 46 (3.74km) e 48 (4.37km) do histórico real do
    // utilizador — ambas com 30:00 exatos, que na fórmula antiga davam as
    // duas 419 kcal.
    const calNivel16Sessao46 = calculateCalories(3.74, 1800, 94);
    const calNivel16Sessao48 = calculateCalories(4.37, 1800, 94);
    expect(calNivel16Sessao46).not.toBe(calNivel16Sessao48);
    expect(calNivel16Sessao48).toBeGreaterThan(calNivel16Sessao46);
  });

  it('protege contra velocidades irreais (erro de GPS) limitando a 24km/h', () => {
    // 1000km numa hora é fisicamente impossível — só pode ser ruído de GPS.
    // Sem o limite, o MET dispararia para um valor absurdo; com o limite a
    // 24km/h, o resultado fica sempre dentro de um intervalo plausível.
    const result = calculateCalories(1000, 3600, 70);
    expect(result).toBe(1754);
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
