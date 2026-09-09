// ============================================================================
// MÓDULO ISOLADO: SINCRONIZAÇÃO DE TREINOS COM O GOOGLE HEALTH CONNECT
// ----------------------------------------------------------------------------
// Esta app (Zero aos 5K) e a app separada "Saúde & Metabolismo" já não
// partilham armazenamento (são duas instalações distintas). Para que a app
// de Saúde consiga ver os treinos feitos aqui, esta app ESCREVE cada treino
// concluído no Google Health Connect (ExerciseSession + calorias + VO2 Máx,
// quando existir) — a app de Saúde depois LÊ esses mesmos registos.
//
// Só Android (Health Connect é uma API exclusiva do Android — ver ponto 16.4
// da documentação técnica). Só corre se o utilizador ativar a sincronização
// nas Definições (@sync_health_connect_enabled). Nunca lança erro para quem
// chama — uma falha aqui não pode nunca interromper o fluxo normal da app
// (o registo já está gravado no histórico local antes de isto ser chamado).
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { logEvent } from './debugLog';

const SYNC_ENABLED_KEY = '@sync_health_connect_enabled';

const WRITE_PERMISSIONS = [
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'TotalCaloriesBurned' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'write', recordType: 'Vo2Max' },
];

// Permissão de LEITURA do peso — usada só por readLatestWeightFromHealthConnect
// (ponto 2 do pedido: ler o peso ao Health Connect e atualizar o perfil ao
// iniciar a app). Precisa também da entrada correspondente em app.json
// (android.permissions: "android.permission.health.READ_WEIGHT").
const WEIGHT_READ_PERMISSION = [{ accessType: 'read', recordType: 'Weight' }];

// Carregado de forma preguiçosa (lazy) — em vez de import estático no topo do
// ficheiro — porque este módulo agora é importado por index.js, que corre em
// qualquer plataforma (incluindo o preview web); um import estático de uma
// biblioteca nativa Android-only rebentaria esse caso. Usa require() (não
// import() dinâmico) porque continua a ser preguiçoso — só corre quando a
// função é chamada, sempre depois do Platform.OS === 'android' — mas é
// suportado tanto pelo Metro como pelos testes automáticos (Jest), ao
// contrário de import() dinâmico.
// (O AsyncStorage, ao contrário desta, funciona em todas as plataformas —
// por isso é importado normalmente no topo do ficheiro, como no resto da app.)
const loadHealthConnect = async () => {
  if (Platform.OS !== 'android') return null;
  try {
    return require('react-native-health-connect');
  } catch (e) {
    logEvent('HealthConnectSync', 'Biblioteca react-native-health-connect indisponível.', e);
    return null;
  }
};

export const isHealthConnectSyncEnabled = async () => {
  try {
    const saved = await AsyncStorage.getItem(SYNC_ENABLED_KEY);
    return saved === 'true';
  } catch (e) {
    return false;
  }
};

export const setHealthConnectSyncEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (e) {}
};

/**
 * Pede as permissões de ESCRITA necessárias no Health Connect. Chamado
 * quando o utilizador ativa a sincronização nas Definições.
 */
export const requestHealthConnectWritePermissions = async () => {
  if (Platform.OS !== 'android') {
    return { success: false, error: 'O Health Connect só está disponível no Android.' };
  }
  const hc = await loadHealthConnect();
  if (!hc) return { success: false, error: 'Health Connect indisponível neste dispositivo.' };

  try {
    const isInitialized = await hc.initialize();
    if (!isInitialized) {
      logEvent('HealthConnectSync', 'initialize() devolveu false.');
      return { success: false, error: 'Health Connect não está disponível neste dispositivo.' };
    }
    const granted = await hc.getGrantedPermissions();
    const alreadyGranted = WRITE_PERMISSIONS.every((req) =>
      granted.some((g) => g.recordType === req.recordType && g.accessType === req.accessType)
    );
    if (alreadyGranted) return { success: true };

    const result = await hc.requestPermission(WRITE_PERMISSIONS);
    logEvent('HealthConnectSync', 'Resultado do pedido de permissão de escrita', { result });
    if (!result || result.length === 0) {
      return { success: false, error: 'Permissão do Health Connect recusada.' };
    }
    return { success: true };
  } catch (error) {
    logEvent('HealthConnectSync', 'Exceção ao pedir permissões de escrita', error);
    return { success: false, error: 'Erro ao comunicar com o Health Connect.' };
  }
};

/**
 * Escreve um treino concluído (registo do histórico local) no Health
 * Connect, para a app de Saúde o conseguir ler. Fire-and-forget: nunca
 * lança erro, e não bloqueia a UI de quem chama (não é preciso `await`).
 *
 * Sincroniza também os treinos falhados (ex: Morte Súbita, Desafio 5km em 30
 * Minutos) — o exercício aconteceu na mesma (distância percorrida, calorias
 * gastas), mesmo que o objetivo do desafio não tenha sido cumprido.
 *
 * @param {object} record - o mesmo objeto já gravado em @user_history
 *   (precisa de startTime/endTime válidos — registos sem essas datas não são
 *   sincronizados, já que o Health Connect exige uma sessão com duração).
 */
export const syncExerciseRecordToHealthConnect = async (record) => {
  try {
    if (Platform.OS !== 'android') return;
    if (!record) return;
    if (!record.startTime || !record.endTime) return;

    const enabled = await isHealthConnectSyncEnabled();
    if (!enabled) return;

    const hc = await loadHealthConnect();
    if (!hc) return;

    const isInitialized = await hc.initialize();
    if (!isInitialized) return;

    const granted = await hc.getGrantedPermissions();
    const hasExercisePerm = granted.some((g) => g.recordType === 'ExerciseSession' && g.accessType === 'write');
    if (!hasExercisePerm) {
      logEvent('HealthConnectSync', 'Sincronização ativada mas sem permissão de escrita concedida — a saltar.');
      return;
    }

    const startTime = record.startTime;
    const endTime = record.endTime;
    const distanceKm = parseFloat(record.distanceKm) || 0;
    const calories = parseFloat(record.calories) || 0;

    const records = [
      {
        recordType: 'ExerciseSession',
        startTime,
        endTime,
        exerciseType: 56, // RUNNING (valor da tabela de tipos de exercício do Health Connect)
        title: record.title || 'Treino (Zero aos 5K)',
        metadata: { clientRecordId: `zeroaos5k_${record.id}` },
      },
    ];

    if (calories > 0) {
      records.push({
        recordType: 'ActiveCaloriesBurned',
        startTime,
        endTime,
        energy: { unit: 'kilocalories', value: calories },
        metadata: { clientRecordId: `zeroaos5k_cal_${record.id}` },
      });
    }

    if (distanceKm > 0) {
      records.push({
        recordType: 'Distance',
        startTime,
        endTime,
        distance: { unit: 'meters', value: distanceKm * 1000 },
        metadata: { clientRecordId: `zeroaos5k_dist_${record.id}` },
      });
    }

    if (record.vo2Max != null) {
      records.push({
        recordType: 'Vo2Max',
        time: endTime,
        vo2MillilitersPerMinuteKilogram: record.vo2Max,
        metadata: { clientRecordId: `zeroaos5k_vo2_${record.id}` },
      });
    }

    // A biblioteca só aceita um insertRecords() por CHAMADA com registos todos
    // do mesmo tipo (rejeita listas mistas com "All records must have the
    // same type") — por isso agrupamos os registos por tipo e fazemos uma
    // chamada por grupo, em vez de uma única chamada com tudo misturado. Cada
    // grupo é isolado no seu próprio try/catch: se um tipo falhar (ex: VO2
    // Máx), os restantes (sessão, calorias, distância) continuam a ser
    // gravados na mesma.
    const recordsByType = records.reduce((groups, rec) => {
      (groups[rec.recordType] = groups[rec.recordType] || []).push(rec);
      return groups;
    }, {});

    let anySuccess = false;
    for (const [recordType, group] of Object.entries(recordsByType)) {
      try {
        await hc.insertRecords(group);
        anySuccess = true;
      } catch (typeError) {
        logEvent('HealthConnectSync', `Erro ao sincronizar registos do tipo ${recordType}`, typeError);
      }
    }
    if (anySuccess) {
      logEvent('HealthConnectSync', 'Treino sincronizado com o Health Connect', { title: record.title });
    }
  } catch (error) {
    // Nunca deixa a sincronização (uma funcionalidade extra) afetar o fluxo
    // principal da app — o treino já está gravado no histórico local.
    logEvent('HealthConnectSync', 'Erro ao sincronizar treino com o Health Connect', error);
  }
};

/**
 * Lê o registo de peso mais recente do Google Health Connect (ex: gravado
 * pela balança Xiaomi através da app "Saúde & Metabolismo" — ver ponto 2 do
 * pedido do utilizador). Chamado ao iniciar esta app, para atualizar
 * automaticamente o campo "weight" do perfil sem o utilizador ter de o fazer
 * à mão.
 *
 * Pede a permissão de LEITURA do peso na primeira vez (mostra o ecrã de
 * permissões do Health Connect); se for recusada, ou não houver nenhum
 * registo, devolve null e o chamador simplesmente não atualiza o perfil —
 * nunca lança erro, para nunca poder interromper o arranque da app.
 *
 * @returns {Promise<number|null>} peso em kg (1 casa decimal) ou null.
 */
export const readLatestWeightFromHealthConnect = async () => {
  try {
    if (Platform.OS !== 'android') return null;

    const hc = await loadHealthConnect();
    if (!hc) return null;

    const isInitialized = await hc.initialize();
    if (!isInitialized) return null;

    const granted = await hc.getGrantedPermissions();
    const hasReadPerm = granted.some((g) => g.recordType === 'Weight' && g.accessType === 'read');
    if (!hasReadPerm) {
      const result = await hc.requestPermission(WEIGHT_READ_PERMISSION);
      const nowGranted = (result || []).some((g) => g.recordType === 'Weight' && g.accessType === 'read');
      if (!nowGranted) {
        logEvent('HealthConnectSync', 'Permissão de leitura do peso recusada — perfil não atualizado.');
        return null;
      }
    }

    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const { records } = await hc.readRecords('Weight', {
      timeRangeFilter: {
        operator: 'between',
        startTime: oneYearAgo.toISOString(),
        endTime: now.toISOString(),
      },
    });

    if (!records || records.length === 0) return null;

    // A biblioteca não garante que os registos vêm ordenados — escolhe
    // explicitamente o mais recente por "time" (registo instantâneo, sem
    // startTime/endTime, ao contrário dos registos de exercício).
    const latest = records.reduce((latestSoFar, rec) => {
      const recTime = new Date(rec.time).getTime();
      const bestTime = new Date(latestSoFar.time).getTime();
      return recTime > bestTime ? rec : latestSoFar;
    }, records[0]);

    const weightKg = latest?.weight?.inKilograms;
    if (!weightKg || weightKg <= 0) return null;

    return Math.round(weightKg * 10) / 10;
  } catch (error) {
    logEvent('HealthConnectSync', 'Erro ao ler o peso do Health Connect', error);
    return null;
  }
};
