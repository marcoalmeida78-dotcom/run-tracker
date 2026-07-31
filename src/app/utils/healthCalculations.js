import { initialize, requestPermission, readRecords } from 'react-native-health-connect';

/**
 * Cálculo da Taxa Metabólica Basal (TMB) - Mifflin-St Jeor
 */
export const calculateBMR = (weightInKg, heightInCm, age, gender) => {
  if (!weightInKg || !heightInCm || !age) return 0;
  const isMale = gender?.toLowerCase().startsWith('m') || gender?.toLowerCase() === 'male';
  const baseBMR = (10 * parseFloat(weightInKg)) + (6.25 * parseFloat(heightInCm)) - (5 * parseInt(age));
  return Math.round(isMale ? baseBMR + 5 : baseBMR - 161);
};

/**
 * Calcula calorias ativas líquidas descontando a TMB proporcional ao tempo de treino
 */
export const calculateNetActiveCalories = (grossCaloriesBurned, durationInMinutes, dailyBMR) => {
  if (!dailyBMR || dailyBMR <= 0 || !durationInMinutes) return grossCaloriesBurned || 0;
  const bmrPerMinute = dailyBMR / 1440;
  const baselineCaloriesDuringWorkout = durationInMinutes * bmrPerMinute;
  return Math.max(0, Math.round(grossCaloriesBurned - baselineCaloriesDuringWorkout));
};

/**
 * Lê sessões de exercício reais do Google Fit / Health Connect no próprio dia
 */
export const fetchRealGoogleFitSessions = async () => {
  try {
    const isInitialized = await initialize();
    if (!isInitialized) return [];

    // Pedir permissão para ler calorias ativas e sessões de treino
    const grantedPermissions = await requestPermission([
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'ExerciseSession' },
    ]);

    if (!grantedPermissions) return [];

    const startTime = new Date();
    startTime.setHours(0, 0, 0, 0); // Início do dia de hoje
    const endTime = new Date();

    const response = await readRecords('ExerciseSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    return response.records.map(record => ({
      startTime: record.startTime,
      endTime: record.endTime,
      calories: record.activeCalories ? record.activeCalories.inKilocalories : 0,
    }));
  } catch (error) {
    console.warn('Health Connect não disponível ou rejeitado:', error);
    return [];
  }
};

/**
 * Evita duplicação e contagem dupla entre a tua App de Corrida e o Google Fit
 */
export const deduplicateAndCalculateTotalCalories = (googleFitSessions = [], appRunSessions = [], dailyBMR = 0) => {
  let totalNetExerciseCalories = 0;

  // 1. Processar treinos da tua app de corrida (prioridade máxima)
  const appIntervals = appRunSessions.map(run => {
    const netCals = calculateNetActiveCalories(run.calories || 0, run.durationMinutes || 0, dailyBMR);
    totalNetExerciseCalories += netCals;
    return { 
      start: new Date(run.startTime || Date.now()).getTime(), 
      end: new Date(run.endTime || Date.now()).getTime() 
    };
  });

  // 2. Processar treinos do Google Fit apenas fora da janela da app de corrida
  googleFitSessions.forEach(fitSession => {
    const fitStart = new Date(fitSession.startTime).getTime();
    const fitEnd = new Date(fitSession.endTime).getTime();

    const hasOverlap = appIntervals.some(
      app => (fitStart >= app.start && fitStart < app.end) || (fitEnd > app.start && fitEnd <= app.end)
    );

    if (!hasOverlap) {
      const durationMinutes = Math.max(1, (fitEnd - fitStart) / (1000 * 60));
      const netCals = calculateNetActiveCalories(fitSession.calories || 0, durationMinutes, dailyBMR);
      totalNetExerciseCalories += netCals;
    }
  });

  return Math.round(totalNetExerciseCalories);
};
