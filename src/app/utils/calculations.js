import { RUN_PROGRAM_LEVELS } from '../constants/runProgram';

// --- FORMATAÇÃO DE TEMPO ---
export const formatHMS = (totalSec) => {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- DISTÂNCIA ENTRE DOIS PONTOS GPS (fórmula de Haversine) ---
// Assume a Terra como esfera perfeita — mantida por compatibilidade e usada
// como rede de segurança pelo Vincenty (abaixo) caso este não convirja.
export const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// --- DISTÂNCIA ENTRE DOIS PONTOS GPS (fórmula de Vincenty, elipsoide WGS-84) ---
// A Terra não é uma esfera perfeita (é ligeiramente achatada nos polos) — o
// Haversine assume que é, o que introduz um erro sistemático de ~0.3%. O
// Vincenty usa o mesmo modelo elipsoidal (WGS-84) que o próprio GPS já usa
// internamente, reduzindo esse erro para <0.05%. É iterativo (converge em 2-3
// iterações para pontos próximos como os desta app); no caso raríssimo de não
// convergir (só acontece com pontos quase antípodas, irrelevante aqui), cai
// em segurança para o Haversine em vez de devolver um valor errado.
export const calculateVincenty = (lat1, lon1, lat2, lon2) => {
  const a = 6378137; // semieixo maior WGS-84, metros
  const b = 6356752.314245; // semieixo menor WGS-84, metros
  const f = 1 / 298.257223563; // achatamento WGS-84

  const L = ((lon2 - lon1) * Math.PI) / 180;
  const U1 = Math.atan((1 - f) * Math.tan((lat1 * Math.PI) / 180));
  const U2 = Math.atan((1 - f) * Math.tan((lat2 * Math.PI) / 180));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let lambdaP;
  let iterLimit = 100;
  let cosSqAlpha = 0;
  let sinSigma = 0;
  let cos2SigmaM = 0;
  let cosSigma = 0;
  let sigma = 0;

  do {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt((cosU2 * sinLambda) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2);
    if (sinSigma === 0) return 0; // pontos coincidentes
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;
    const C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda =
      L + (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);

  if (iterLimit === 0) {
    return calculateHaversine(lat1, lon1, lat2, lon2);
  }

  const uSq = (cosSqAlpha * (a * a - b * b)) / (b * b);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

  const distanceM = b * A * (sigma - deltaSigma);
  return distanceM / 1000; // km, para manter a mesma unidade que calculateHaversine
};

// --- FILTROS DE RUÍDO DE GPS EM TEMPO REAL ---
//
// CORREÇÃO IMPORTANTE (esta versão substitui uma tentativa anterior que
// causou uma regressão grave): a primeira versão deste filtro fazia o
// movimento mínimo exigido por leitura SUBIR com a margem de erro (accuracy)
// do GPS. Parecia razoável em teoria, mas na prática as leituras chegam
// aproximadamente a cada 1 segundo — e nesse intervalo tão curto, o
// movimento real de alguém a correr/andar (tipicamente 1 a 4m) já é da
// mesma ordem de grandeza da própria margem de erro do GPS (normal rondar os
// 10-20m, mesmo com boa receção). Ao exigir um movimento maior do que essa
// margem em CADA leitura individual, o filtro acabava por rejeitar quase
// todo o movimento real — a distância deixava de avançar, e a app chegava a
// pausar por "inatividade" mesmo em andamento. A correção usa antes dois
// filtros mais simples e independentes: rejeitar por completo leituras pouco
// fiáveis (piso fixo de precisão), e um piso de movimento mínimo pequeno e
// FIXO (não escalado) só para filtrar o tremor residual do GPS.

// 1) REJEIÇÃO POR PRECISÃO: cada leitura de GPS vem com a sua própria margem
//    de erro (accuracy, em metros). Leituras poucos fiáveis (sinal fraco,
//    perto de árvores/prédios) são ignoradas por completo — nem contam
//    distância, nem passam a ser a posição de referência da leitura
//    seguinte — em vez de lhes aplicar um piso mais exigente.
export const GPS_ACCURACY_REJECT_METERS = 25;
export const isGpsAccuracyAcceptable = (accuracyMeters) => {
  if (typeof accuracyMeters !== 'number' || Number.isNaN(accuracyMeters)) return true; // sem info -> não rejeita só por isto
  return accuracyMeters <= GPS_ACCURACY_REJECT_METERS;
};

// 2) MOVIMENTO MÍNIMO POR LEITURA: piso pequeno e fixo (não escalado pela
//    accuracy — ver explicação acima) só para filtrar o tremor residual do
//    GPS entre leituras muito próximas no tempo.
export const GPS_MIN_MOVEMENT_KM = 0.0015; // 1.5m

// 3) VELOCIDADE IMPLAUSÍVEL POR SEGMENTO: se a distância entre duas leituras
//    consecutivas implicar uma velocidade impossível para alguém a pé/a
//    correr, é sinal de um salto pontual de GPS (erro de posição), não de
//    movimento real — só esse segmento é ignorado, sem pausar o treino
//    (ao contrário da deteção de veículo já existente, que usa a velocidade
//    instantânea do próprio GPS — um sinal diferente e mais estável — para
//    pausar a sessão toda quando sustida acima de 25 km/h).
export const GPS_MAX_PLAUSIBLE_SEGMENT_SPEED_KMH = 30;
export const isSegmentSpeedPlausible = (distanceKm, deltaSeconds) => {
  if (!deltaSeconds || deltaSeconds <= 0) return true; // sem intervalo de tempo para comparar -> não rejeita só por isto
  const impliedKmH = (distanceKm / deltaSeconds) * 3600;
  return impliedKmH <= GPS_MAX_PLAUSIBLE_SEGMENT_SPEED_KMH;
};

// --- SUAVIZAÇÃO DOUGLAS-PEUCKER (aplicada no fim da sessão) ---
// Os filtros em tempo real acima reduzem bastante o ruído, mas ainda pode
// sobrar algum zigue-zague na rota gravada. No fim da sessão, este algoritmo
// simplifica o trajeto completo removendo os pontos que não mudam a forma
// real do percurso (mantém sempre os pontos onde a rota genuinamente muda de
// direção). epsilonKm controla a agressividade: um ponto só é removido se se
// desviar menos do que epsilonKm da linha reta entre os pontos vizinhos que
// ficam. Por construção geométrica (desigualdade triangular), o percurso
// simplificado nunca pode ser mais comprido do que o original — por isso a
// distância recalculada a partir dele só pode aparar excesso acumulado por
// ruído, nunca inflacionar o total.
const perpendicularDistanceKm = (point, lineStart, lineEnd) => {
  if (lineStart.latitude === lineEnd.latitude && lineStart.longitude === lineEnd.longitude) {
    return calculateVincenty(point.latitude, point.longitude, lineStart.latitude, lineStart.longitude);
  }
  // Aproximação em metros planos — válida para as distâncias curtas (dezenas
  // a centenas de metros) entre pontos vizinhos de uma mesma sessão; o erro
  // introduzido é desprezável para este fim (decidir que pontos remover).
  const toXY = (p) => ({
    x: p.longitude * Math.cos((lineStart.latitude * Math.PI) / 180) * 111320,
    y: p.latitude * 110540,
  });
  const p = toXY(point);
  const start = toXY(lineStart);
  const end = toXY(lineEnd);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((p.x - start.x) * dx + (p.y - start.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  const distX = p.x - projX;
  const distY = p.y - projY;
  return Math.sqrt(distX * distX + distY * distY) / 1000; // metros -> km
};

export const simplifyRouteDouglasPeucker = (points, epsilonKm = 0.003) => {
  if (!Array.isArray(points) || points.length < 3) return points ? [...points] : [];

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistanceKm(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilonKm) {
    const left = simplifyRouteDouglasPeucker(points.slice(0, index + 1), epsilonKm);
    const right = simplifyRouteDouglasPeucker(points.slice(index), epsilonKm);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[end]];
};

// Soma a distância (Vincenty) entre pontos consecutivos de um trajeto —
// usada no fim da sessão, sobre o trajeto já simplificado acima, para
// recalcular um total final mais limpo do que o valor acumulado ao vivo.
export const calculateRouteDistanceKm = (points) => {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateVincenty(points[i - 1].latitude, points[i - 1].longitude, points[i].latitude, points[i].longitude);
  }
  return total;
};

// Distância final a gravar no histórico: recalcula a partir do trajeto GPS
// completo (simplificado + Vincenty) quando há pontos suficientes para isso
// fazer sentido; cai em segurança para o valor acumulado ao vivo
// (liveDistKm) em sessões muito curtas (poucos pontos GPS), onde não há
// trajeto suficiente para a simplificação ter qualquer efeito útil.
export const getFinalDistanceKm = (routeCoords, liveDistKm) => {
  if (!Array.isArray(routeCoords) || routeCoords.length < 3) return liveDistKm;
  const simplified = simplifyRouteDouglasPeucker(routeCoords);
  const recomputed = calculateRouteDistanceKm(simplified);
  return recomputed > 0 ? recomputed : liveDistKm;
};

// --- RITMO (MIN/KM) ---
// Ritmo médio = tempo decorrido (em minutos) a dividir pela distância percorrida
// (em km) — fórmula correta e igual à que já estava espalhada por vários
// ecrãs (ActiveExerciseScreen e index.js), agora centralizada aqui para os
// vários sítios nunca poderem divergir entre si.
// Abaixo de 15 metros, dividir por uma distância quase nula produzia valores
// gigantes e sem significado (ex: "950.00 min/km" nos primeiros segundos de
// GPS instável) — isso é o que por vezes parecia "errado"; devolve null
// nesse caso em vez de mostrar um número enganador.
export const calculatePace = (distanceKm, timeSec) => {
  const dist = parseFloat(distanceKm);
  const time = parseFloat(timeSec);
  if (!dist || dist < 0.015 || !time || time <= 0) return null;
  return (time / 60 / dist).toFixed(2);
};

// --- DESAFIO MORTE SÚBITA: PROGRESSO EM METROS ---
// O desafio tem sempre um total fixo (10 blocos x 100m = 1000m, ver
// constants/runProgram.js). A partir da distância total percorrida (em km)
// devolve exatamente quantos metros foram feitos e quantos faltam para
// completar o desafio todo — usado tanto quando é concluído com sucesso
// como quando falha a meio de um bloco.
export const getSuddenDeathProgress = (distanceKm, totalBlocks = 10, metersPerBlock = 100) => {
  const metersTarget = totalBlocks * metersPerBlock;
  const metersDone = Math.min(metersTarget, Math.max(0, Math.round((parseFloat(distanceKm) || 0) * 1000)));
  const metersMissing = Math.max(0, metersTarget - metersDone);
  return { metersDone, metersMissing, metersTarget };
};

// --- CALORIAS ---
// weightKg é opcional: passa o peso do perfil do utilizador; usa 70kg por omissão.
export const calculateCalories = (distKm, timeSec, weightKg = 70) => {
  const weight = parseFloat(weightKg) || 70;
  const hours = timeSec / 3600;
  const speedKmH = hours > 0 ? distKm / hours : 0;
  let met = 4.0;
  if (speedKmH > 7) met = 8.5;
  return Math.round((met * 3.5 * weight * (timeSec / 60)) / 200);
};

// --- ESTIMATIVAS DE VO2 MÁX ---
// Fórmula de Kline et al. (1987) para o Rockport Walking Test — precisa
// mesmo dos batimentos cardíacos (não da distância, que é sempre 1609m fixos
// neste desafio). Sem batimentos, não há forma válida de calcular isto — por
// isso devolve null em vez de inventar um número.
export const calculateRockportVo2Max = (timeSec, heartRate, profile) => {
  if (!heartRate || heartRate <= 0) return null;
  const weightKg = parseFloat(profile.weight) || 70;
  const age = parseFloat(profile.age) || 30;
  const gender = profile.gender || 'masculino';
  const timeMinutes = timeSec / 60;
  const weightLbs = weightKg * 2.20462;
  let baseVo2 =
    132.853 - (0.0769 * weightLbs) - (0.3877 * age) + (gender === 'masculino' ? 6.315 : 0) -
    (3.2649 * timeMinutes) - (0.1565 * heartRate);
  return Math.max(15, Math.min(85, Math.round(baseVo2 * 10) / 10));
};

export const calculate15MilesVo2Max = (timeSec) => {
  const timeMin = timeSec / 60;
  let vo2 = (483 / timeMin) + 3.5;
  return Math.max(15, Math.min(85, Math.round(vo2 * 10) / 10));
};

export const calculate1MileRunVo2Max = (timeSec, profile) => {
  const weightKg = parseFloat(profile.weight) || 70;
  const age = parseFloat(profile.age) || 30;
  const gender = profile.gender || 'masculino';
  const timeMinutes = timeSec / 60;
  const weightLbs = weightKg * 2.20462;
  let vo2 = 108.844 - (0.1636 * weightLbs) - (1.438 * timeMinutes) - (0.1928 * age) + (gender === 'masculino' ? 6.131 : 0);
  return Math.max(15, Math.min(85, Math.round(vo2 * 10) / 10));
};

// --- MELHOR TEMPO REGISTADO NO HISTÓRICO PARA UM DADO EXERCÍCIO/SESSÃO ---
// Recebe a lista de histórico e o título exato do exercício (o mesmo texto
// guardado em cada registo — ver "title" em autoFinishExercise, em index.js)
// e devolve o menor tempo (em segundos) já registado para esse título, ou
// null se ainda não houver nenhum registo. Usado para mostrar "melhor tempo"
// nos exercícios de caminhada/desafios e nas sessões do plano 0 aos 5K, e
// para decidir se um novo recorde pessoal foi batido no fim de um exercício.
export const getBestTimeForTitle = (history = [], title) => {
  if (!title) return null;
  const matching = (history || []).filter((item) => item.title === title);
  if (matching.length === 0) return null;
  const times = matching
    .map((item) => parseInt(item.timeSec, 10))
    .filter((sec) => !Number.isNaN(sec) && sec > 0);
  if (times.length === 0) return null;
  return Math.min(...times);
};

// --- MAIOR DISTÂNCIA REGISTADA NO HISTÓRICO PARA UM DADO TÍTULO ---
// Só faz sentido para as sessões do plano 0 aos 5K: como cada sessão dura
// sempre o mesmo tempo fixo (não é uma corrida "até à meta"), o "melhor
// tempo" acabava por ser sempre igual — o que varia de facto entre
// repetições da mesma sessão é a distância percorrida nesse tempo. Devolve
// a maior distância (em km) já registada para esse título, ou null se ainda
// não houver nenhum registo.
export const getBestDistanceForTitle = (history = [], title) => {
  if (!title) return null;
  const matching = (history || []).filter((item) => item.title === title);
  if (matching.length === 0) return null;
  const distances = matching
    .map((item) => parseFloat(item.distanceKm))
    .filter((km) => !Number.isNaN(km) && km > 0);
  if (distances.length === 0) return null;
  return Math.max(...distances);
};

// --- GERAÇÃO DA TIMELINE DE UMA SESSÃO DO PROGRAMA 0 AOS 5K ---
// O aquecimento e o arrefecimento fazem sempre parte da timeline gerada; saltá-los
// passou a ser uma ação em tempo real dentro da sessão (ver skipCurrentPhase em index.js),
// em vez de uma escolha feita antes de começar.
export const generateTimeline = (sessionIdx) => {
  const lvlIdx = Math.floor(sessionIdx / 3);
  const lvl = RUN_PROGRAM_LEVELS[lvlIdx];
  const phases = [];
  let idCounter = 0;
  phases.push({ id: idCounter++, label: 'AQUECIMENTO', durationSec: 300, type: 'warmup' });
  for (let i = 0; i < lvl.repeats; i++) {
    phases.push({ id: idCounter++, label: `CORRIDA ${i + 1}`, durationSec: lvl.runSec, type: 'run' });
    // Não junta caminhada depois da última corrida: a sessão deve terminar sempre numa secção
    // de corrida, antes do arrefecimento.
    if (lvl.walkSec > 0 && i < lvl.repeats - 1) {
      phases.push({ id: idCounter++, label: `CAMINHADA ${i + 1}`, durationSec: lvl.walkSec, type: 'walk' });
    }
  }
  phases.push({ id: idCounter++, label: 'ARREFECIMENTO', durationSec: 300, type: 'cooldown' });
  return phases;
};
