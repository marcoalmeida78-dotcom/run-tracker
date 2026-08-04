import { RUN_PROGRAM_LEVELS } from '../constants/runProgram';

// --- FORMATAÇÃO DE TEMPO ---
export const formatHMS = (totalSec) => {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- DISTÂNCIA ENTRE DOIS PONTOS GPS (fórmula de Haversine) ---
export const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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
export const calculateRockportVo2Max = (timeSec, distKm, profile) => {
  const weightKg = parseFloat(profile.weight) || 70;
  const age = parseFloat(profile.age) || 30;
  const gender = profile.gender || 'masculino';
  const timeMinutes = timeSec / 60;
  const weightLbs = weightKg * 2.20462;
  let baseVo2 =
    132.853 - (0.0769 * weightLbs) - (0.3877 * age) + (gender === 'masculino' ? 6.315 : 0) -
    (3.2649 * timeMinutes) - (0.1565 * (distKm * 1000));
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
