// Testa a correção do erro "All records must have the same type": o
// syncExerciseRecordToHealthConnect construía uma única lista com registos de
// vários tipos (ExerciseSession, ActiveCaloriesBurned, Distance, Vo2Max) e
// chamava insertRecords() UMA VEZ com tudo misturado — a biblioteca rejeita
// isso sempre que há mais de um tipo na mesma chamada (ver
// node_modules/react-native-health-connect/src/index.tsx). A correção agrupa
// os registos por tipo e faz uma chamada a insertRecords() por grupo.
jest.mock('@react-native-async-storage/async-storage', () => {
  const mock = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  // healthConnectSync.js importa este módulo dinamicamente (await import(...))
  // e depois lê `.default` — sob o Jest, import() dinâmico não aplica o mesmo
  // interop de ESM que o import estático, por isso expomos explicitamente
  // `default` aqui para o mock funcionar em ambos os casos.
  return { __esModule: true, default: mock, ...mock };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as hc from 'react-native-health-connect';
import { syncExerciseRecordToHealthConnect } from '../utils/healthConnectSync';

describe('syncExerciseRecordToHealthConnect', () => {
  const baseRecord = {
    id: 'abc123',
    title: 'Corrida: Nível 1 - Sessão 1',
    startTime: '2026-08-19T10:00:00.000Z',
    endTime: '2026-08-19T10:30:00.000Z',
    distanceKm: '3.20',
    calories: 250,
    vo2Max: 38.5,
    failed: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    await AsyncStorage.setItem('@sync_health_connect_enabled', 'true');
    hc.getGrantedPermissions.mockResolvedValue([{ recordType: 'ExerciseSession', accessType: 'write' }]);
    hc.insertRecords.mockImplementation(() => Promise.resolve(['id']));
  });

  it('nunca chama insertRecords com mais de um tipo de registo na mesma chamada', async () => {
    await syncExerciseRecordToHealthConnect(baseRecord);

    expect(hc.insertRecords).toHaveBeenCalled();
    for (const call of hc.insertRecords.mock.calls) {
      const recordsInCall = call[0];
      const typesInCall = new Set(recordsInCall.map((r) => r.recordType));
      expect(typesInCall.size).toBe(1);
    }
  });

  it('faz uma chamada separada para cada tipo presente (sessão, calorias, distância, VO2 Máx)', async () => {
    await syncExerciseRecordToHealthConnect(baseRecord);

    const calledTypes = hc.insertRecords.mock.calls.map((call) => call[0][0].recordType).sort();
    expect(calledTypes).toEqual(['ActiveCaloriesBurned', 'Distance', 'ExerciseSession', 'Vo2Max'].sort());
  });

  it('se um tipo falhar, continua a tentar sincronizar os restantes', async () => {
    hc.insertRecords.mockImplementation((group) => {
      if (group[0].recordType === 'Vo2Max') return Promise.reject(new Error('falhou VO2'));
      return Promise.resolve(['id']);
    });

    await syncExerciseRecordToHealthConnect(baseRecord);

    const calledTypes = hc.insertRecords.mock.calls.map((call) => call[0][0].recordType).sort();
    expect(calledTypes).toEqual(['ActiveCaloriesBurned', 'Distance', 'ExerciseSession', 'Vo2Max'].sort());
  });

  it('sincroniza também os registos falhados (ex: desafio não cumprido) — a distância/calorias são reais na mesma', async () => {
    await syncExerciseRecordToHealthConnect({ ...baseRecord, failed: true });

    expect(hc.insertRecords).toHaveBeenCalled();
    const calledTypes = hc.insertRecords.mock.calls.map((call) => call[0][0].recordType).sort();
    expect(calledTypes).toEqual(['ActiveCaloriesBurned', 'Distance', 'ExerciseSession', 'Vo2Max'].sort());
  });

  it('não sincroniza registos sem startTime/endTime válidos', async () => {
    await syncExerciseRecordToHealthConnect({ ...baseRecord, startTime: null });
    expect(hc.insertRecords).not.toHaveBeenCalled();
  });
});
