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

export const isWalkingActivity = (type) => type.startsWith('walk');

export const calculateDynamicCadence = (currentSpeedKmH, type) => {
  const spd = parseFloat(currentSpeedKmH) || 0;
  if (isWalkingActivity(type)) {
    if (spd <= 0) return 105;
    // Modelo baseado no comprimento médio do passo (~0.70 m) em vez de uma
    // fórmula linear arbitrária. cadência (passos/min) = distância por minuto / comprimento do passo.
    // Ex: a 5 km/h -> (5000/60)/0.70 ≈ 119 SPM, próximo do valor real observado (115-118 passos/min).
    const stepLengthM = 0.70;
    const metersPerMin = spd * (1000 / 60);
    const spm = metersPerMin / stepLengthM;
    return Math.max(70, Math.min(140, Math.round(spm)));
  } else {
    if (spd <= 0) return 160;
    // Corrida: a cadência real varia pouco com a velocidade (tipicamente 150-185 SPM);
    // o que aumenta com a velocidade é sobretudo o comprimento da passada, não a cadência.
    const spm = spd <= 6 ? 150 : 150 + (spd - 6) * 4;
    return Math.max(140, Math.min(190, Math.round(spm)));
  }
};

export const getCadenceFeedback = (spm, type, colors) => {
  if (isWalkingActivity(type)) {
    if (spm < 90) return { label: 'Cadência Baixa (<90 SPM)', color: colors.COLOR_PRIMARY };
    if (spm <= 170) return { label: 'Cadência Ideal (90-170 SPM)', color: colors.COLOR_PRIMARY };
    return { label: 'Cadência Alta (>170 SPM)', color: colors.COLOR_SECONDARY };
  } else {
    if (spm < 150) return { label: 'Cadência Baixa (<150 SPM)', color: colors.COLOR_PRIMARY };
    if (spm <= 200) return { label: 'Cadência Ideal (150-200 SPM)', color: colors.COLOR_PRIMARY };
    return { label: 'Cadência Alta (>200 SPM)', color: colors.COLOR_SECONDARY };
  }
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

// --- GERAÇÃO DA TIMELINE DE UMA SESSÃO DO PROGRAMA 0 AOS 5K ---
export const generateTimeline = (sessionIdx) => {
  const lvlIdx = Math.floor(sessionIdx / 3);
  const lvl = RUN_PROGRAM_LEVELS[lvlIdx];
  const phases = [{ id: 0, label: 'AQUECIMENTO', durationSec: 300, type: 'warmup' }];
  let idCounter = 1;
  for (let i = 0; i < lvl.repeats; i++) {
    phases.push({ id: idCounter++, label: `CORRIDA ${i + 1}`, durationSec: lvl.runSec, type: 'run' });
    if (lvl.walkSec > 0) {
      phases.push({ id: idCounter++, label: `CAMINHADA ${i + 1}`, durationSec: lvl.walkSec, type: 'walk' });
    }
  }
  phases.push({ id: idCounter++, label: 'ARREFECIMENTO', durationSec: 300, type: 'cooldown' });
  return phases;
};
