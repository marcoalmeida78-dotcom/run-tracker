// ============================================================================
// MENU SAÚDE & METABOLISMO — módulo isolado
// ----------------------------------------------------------------------------
// Este ficheiro concentra TODA a funcionalidade do menu Saúde (TMB, resumo
// diário de calorias, Google Fit, balança Xiaomi, composição corporal,
// tendências, objetivo de peso, medidas corporais, lembrete de pesagem e
// exportação de relatório). Não é importado por mais nenhum sítio da app além
// do MainScreen, e não altera nenhuma lógica dos outros menus. Para desligar
// o menu Saúde por completo, basta remover o bloco correspondente no
// MainScreen.js — nada aqui tem de ser tocado.
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  PermissionsAndroid,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { LineChart } from 'react-native-chart-kit';
import { calculateBMR, computeDailyEnergySummary, suggestDailyWaterMl } from '../../utils/healthCalculations';
import { classifyBMI, classifyWHR, classifyWHtR, computeBodyComposition } from '../../utils/bodyComposition';
import { computeMovingAverageWeight, computeTrendAlert, estimateGoalProgress } from '../../utils/healthTrends';
import { calculateFcMaxTanaka } from '../../utils/cooperTest';
import { cancelWeighInReminder, getWeighInReminderStatus, scheduleWeighInReminder } from '../../utils/healthReminders';
import { logEvent } from '../../utils/debugLog';

const SCALE_HISTORY_KEY = '@health_scale_history';
const WEIGHT_GOAL_KEY = '@health_weight_goal';
const MEASUREMENTS_KEY = '@health_body_measurements';
const SCAN_TIMEOUT_MS = 25000;

// Nomes/UUIDs conhecidos das balanças Xiaomi Mi Body Composition Scale (1 e 2).
const SCALE_NAME_MATCH = /MIBFS|MIBCS|MI ?SCALE|XMTZC/i;
const BODY_COMPOSITION_UUID_FRAGMENT = '181b';

// Presets de hora para o lembrete diário de pesagem (mantém a UI simples,
// sem precisar de um componente nativo de escolha de hora).
const REMINDER_TIME_PRESETS = [
  { label: '07:00', hour: 7, minute: 0 },
  { label: '08:00', hour: 8, minute: 0 },
  { label: '09:00', hour: 9, minute: 0 },
];

let bleManagerInstance = null;
const getBleManager = () => {
  if (!bleManagerInstance) bleManagerInstance = new BleManager();
  return bleManagerInstance;
};

// ----------------------------------------------------------------------------
// Descodificação do pacote BLE da balança Xiaomi (Service Data, UUID 0x181B).
// NOTA HONESTA: este é o layout de bytes documentado pela comunidade (projeto
// openScale) para a Mi Body Composition Scale 2. Firmwares diferentes podem
// variar ligeiramente — por isso o painel mostra sempre os bytes em hex, para
// se conseguir confirmar/ajustar caso o peso não bata certo com a balança real.
// ----------------------------------------------------------------------------
const parseXiaomiPacket = (base64Data) => {
  try {
    const raw = global.atob ? global.atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary');
    const buffer = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);

    if (buffer.length < 13) return null;

    const ctrl1 = buffer[0];
    const ctrl2 = buffer[1];
    const isStabilized = (ctrl2 & 0x20) !== 0;
    const hasImpedance = (ctrl2 & 0x02) !== 0;
    const isLbsOrCatty = (ctrl1 & 0x01) !== 0 || (ctrl1 & 0x40) !== 0;

    const weightRaw = buffer[11] | (buffer[12] << 8);
    const weight = isLbsOrCatty ? weightRaw / 100 : weightRaw / 200;
    const impedance = hasImpedance ? (buffer[9] | (buffer[10] << 8)) : null;

    const hex = Array.from(buffer).map((b) => b.toString(16).padStart(2, '0')).join(' ');

    return {
      weight: Number(weight.toFixed(1)),
      impedance,
      isStabilized,
      unit: isLbsOrCatty ? 'lb' : 'kg',
      hex,
    };
  } catch (e) {
    return null;
  }
};

const requestBluetoothPermissions = async () => {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return (
      granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

export default function HealthMenu({ colors, profile, history, onSaveProfile, onClose }) {
  const s = useMemo(() => buildStyles(colors), [colors]);

  // --- Resumo diário (TMB + exercícios app + Google Fit sem duplicar) ---
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const bmrOnly = useMemo(() => calculateBMR(profile), [profile]);

  const loadSummary = async () => {
    setLoadingSummary(true);
    const result = await computeDailyEnergySummary(profile, history);
    setSummary(result);
    setLoadingSummary(false);
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, history]);

  // --- Balança Xiaomi ---
  const [scanStatus, setScanStatus] = useState('idle'); // idle | scanning | found | error
  const [statusMessage, setStatusMessage] = useState('');
  const [liveReading, setLiveReading] = useState(null); // { weight, impedance, isStabilized, unit, hex }
  const [lastSavedReading, setLastSavedReading] = useState(null);
  const [scaleHistory, setScaleHistory] = useState([]);
  const [showScaleHistory, setShowScaleHistory] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [chartMetric, setChartMetric] = useState('weight'); // weight | fat | water | lean
  const scanTimeoutRef = useRef(null);

  const bmiInfo = useMemo(() => classifyBMI(parseFloat(profile?.weight), parseFloat(profile?.height)), [profile]);
  const movingAvgWeight = useMemo(() => computeMovingAverageWeight(scaleHistory, 7), [scaleHistory]);
  // FC Máx (Tanaka) — só depende da idade do perfil, por isso é sempre
  // recalculada ao vivo (não precisa de estar "presa" a um teste concluído).
  const fcMax = useMemo(() => calculateFcMaxTanaka(profile?.age), [profile]);
  // VO2 Máx mais recente — de qualquer teste que o tenha calculado (Cooper,
  // Rockport, ou os desafios de 1/1.5 milhas), o que for mais recente ganha.
  const latestVo2 = useMemo(() => {
    const withVo2 = (history || []).filter((item) => item.vo2Max != null);
    if (withVo2.length === 0) return null;
    const sorted = [...withVo2].sort((a, b) => Number(b.id) - Number(a.id));
    return { value: sorted[0].vo2Max, title: sorted[0].title, date: sorted[0].date };
  }, [history]);
  const trendAlert = useMemo(() => computeTrendAlert(scaleHistory), [scaleHistory]);

  // Sugestão de água diária: peso mais recente conhecido (balança > perfil) +
  // calorias de exercício de hoje (já calculadas no resumo diário).
  const waterSuggestion = useMemo(() => {
    const weightKg = scaleHistory[0]?.weight ?? parseFloat(profile?.weight);
    const exerciseKcal = (summary?.appExerciseCalories || 0) + (summary?.fitCalories || 0);
    return suggestDailyWaterMl(weightKg, exerciseKcal);
  }, [scaleHistory, profile, summary]);

  // Últimas N pesagens (mais antiga → mais recente) prontas para o gráfico de evolução.
  const chartEntries = useMemo(() => {
    return [...scaleHistory]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .slice(-15);
  }, [scaleHistory]);

  const CHART_METRICS = {
    weight: { key: 'weight', label: 'Peso', unit: 'kg', color: () => colors?.COLOR_LIME_ENERGY || '#3b82f6' },
    fat: { key: 'bodyFatPercent', label: 'Massa Gorda', unit: '%', color: () => colors?.COLOR_RED_ACCENT || '#ef4444' },
    lean: { key: 'leanMassPercent', label: 'Massa Magra', unit: '%', color: () => colors?.COLOR_PRIMARY || '#22c55e' },
    water: { key: 'bodyWaterPercent', label: 'Água Corporal', unit: '%', color: () => '#38bdf8' },
  };

  const activeChartMetric = CHART_METRICS[chartMetric];
  const chartDataPoints = chartEntries
    .filter((e) => e[activeChartMetric.key] != null)
    .map((e) => Number(e[activeChartMetric.key]));
  const chartLabels = chartEntries
    .filter((e) => e[activeChartMetric.key] != null)
    .map((e) => e.date.slice(0, 5)); // "dd/mm"

  // --- Objetivo de peso ---
  const [goal, setGoal] = useState(null); // { goalWeightKg, startWeightKg }
  const [goalInput, setGoalInput] = useState('');
  const goalProgress = useMemo(
    () => (goal ? estimateGoalProgress(scaleHistory, goal.goalWeightKg, goal.startWeightKg) : null),
    [scaleHistory, goal]
  );

  // --- Medidas corporais (cintura/anca) ---
  const [measurements, setMeasurements] = useState([]);
  const [waistInput, setWaistInput] = useState('');
  const [hipInput, setHipInput] = useState('');
  const [showMeasurements, setShowMeasurements] = useState(false);
  const latestMeasurement = measurements[0] || null;
  const whrInfo = useMemo(
    () => (latestMeasurement ? classifyWHR(latestMeasurement.waist, latestMeasurement.hip, profile?.gender) : null),
    [latestMeasurement, profile]
  );
  // WHtR só precisa da cintura (já recolhida acima) + altura do perfil — não
  // precisa de nenhum campo novo, ao contrário do WHR que também usa a anca.
  const whtrInfo = useMemo(
    () => (latestMeasurement ? classifyWHtR(latestMeasurement.waist, parseFloat(profile?.height)) : null),
    [latestMeasurement, profile]
  );

  // --- Lembrete de pesagem ---
  const [reminderStatus, setReminderStatus] = useState(null); // { hour, minute } | null
  const [reminderBusy, setReminderBusy] = useState(false);

  useEffect(() => {
    loadScaleHistory();
    loadGoal();
    loadMeasurements();
    loadReminderStatus();
    return () => {
      stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadScaleHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem(SCALE_HISTORY_KEY);
      setScaleHistory(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setScaleHistory([]);
    }
  };

  const loadGoal = async () => {
    try {
      const saved = await AsyncStorage.getItem(WEIGHT_GOAL_KEY);
      setGoal(saved ? JSON.parse(saved) : null);
    } catch (e) {
      setGoal(null);
    }
  };

  const loadMeasurements = async () => {
    try {
      const saved = await AsyncStorage.getItem(MEASUREMENTS_KEY);
      setMeasurements(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setMeasurements([]);
    }
  };

  const loadReminderStatus = async () => {
    const status = await getWeighInReminderStatus();
    setReminderStatus(status);
  };

  const stopScan = () => {
    try {
      getBleManager().stopDeviceScan();
    } catch (e) {}
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  };

  const saveScaleReading = async (reading) => {
    // Composição corporal: usa o peso desta pesagem + altura/idade/género do
    // perfil + a impedância desta pesagem, comparada com as impedâncias de
    // pesagens anteriores (para o ajuste auto-calibrado — ver bodyComposition.js).
    // Guardamos o resultado JUNTO da pesagem (não recalculamos depois), para
    // que o histórico fique estável mesmo que o perfil mude no futuro.
    // Últimas 10 pesagens anteriores — mantém a auto-calibração "atual" em vez
    // de arrastar uma média de meses/anos que dilui mudanças recentes no corpo.
    const priorImpedances = scaleHistory.slice(0, 10).map((item) => item.impedance).filter(Boolean);
    const composition = computeBodyComposition({
      weightKg: reading.weight,
      heightCm: parseFloat(profile?.height),
      age: parseInt(profile?.age, 10),
      gender: profile?.gender,
      impedance: reading.impedance,
      priorImpedances,
    });

    const entry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('pt-PT'),
      time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      weight: reading.weight,
      impedance: reading.impedance,
      unit: reading.unit,
      ...(composition || {}),
    };
    const updated = [entry, ...scaleHistory];
    setScaleHistory(updated);
    setLastSavedReading(entry);
    try {
      await AsyncStorage.setItem(SCALE_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleDeleteScaleEntry = (id) => {
    Alert.alert('Apagar Registo', 'Eliminar esta pesagem do histórico da balança?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const updated = scaleHistory.filter((item) => item.id !== id);
          setScaleHistory(updated);
          await AsyncStorage.setItem(SCALE_HISTORY_KEY, JSON.stringify(updated));
        },
      },
    ]);
  };

  const handleUseWeightInProfile = (weight) => {
    if (!onSaveProfile) return;
    onSaveProfile({ ...(profile || {}), weight: String(weight) });
    Alert.alert('Peso Atualizado', `O peso do perfil foi atualizado para ${weight} kg. A TMB foi recalculada.`);
  };

  const handleScanXiaomiScale = async () => {
    if (scanStatus === 'scanning') {
      stopScan();
      setScanStatus('idle');
      setStatusMessage('Leitura cancelada.');
      return;
    }

    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      logEvent('BalançaXiaomi', 'Permissão de Bluetooth/Localização recusada pelo utilizador.');
      Alert.alert('Permissão Necessária', 'É preciso permitir o Bluetooth e a Localização para procurar a balança.');
      return;
    }

    const manager = getBleManager();
    const bleState = await manager.state();
    logEvent('BalançaXiaomi', 'Estado do Bluetooth antes de procurar', { bleState });
    if (bleState !== 'PoweredOn') {
      Alert.alert('Bluetooth Desligado', 'Ativa o Bluetooth do telemóvel e tenta novamente.');
      return;
    }

    setLiveReading(null);
    setScanStatus('scanning');
    setStatusMessage('A comunicar com a balança... sobe para a balança agora.');
    logEvent('BalançaXiaomi', 'Início da procura por dispositivos Bluetooth.');

    manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error) {
        logEvent('BalançaXiaomi', 'Erro devolvido pelo startDeviceScan', error);
        setScanStatus('error');
        setStatusMessage('Erro ao procurar por Bluetooth.');
        stopScan();
        return;
      }
      if (!device) return;

      const nameMatches = device.name && SCALE_NAME_MATCH.test(device.name);
      const uuidMatches = device.serviceUUIDs?.some((u) => u.toLowerCase().includes(BODY_COMPOSITION_UUID_FRAGMENT));
      if (!nameMatches && !uuidMatches) return;

      logEvent('BalançaXiaomi', 'Dispositivo compatível encontrado', { name: device.name, id: device.id });

      const serviceDataMap = device.serviceData || {};
      const rawKey = Object.keys(serviceDataMap).find((k) => k.toLowerCase().includes(BODY_COMPOSITION_UUID_FRAGMENT));
      const rawPayload = rawKey ? serviceDataMap[rawKey] : Object.values(serviceDataMap)[0];
      if (!rawPayload) {
        logEvent('BalançaXiaomi', 'Dispositivo encontrado mas sem serviceData legível.');
        return;
      }

      const parsed = parseXiaomiPacket(rawPayload);
      if (!parsed) {
        logEvent('BalançaXiaomi', 'Falha ao descodificar o pacote recebido da balança.');
        return;
      }

      // Atualiza sempre o peso "ao vivo" enquanto a balança ainda está a estabilizar.
      setLiveReading(parsed);
      setStatusMessage(parsed.isStabilized ? 'Peso estabilizado ✅' : 'A ler... mantém-te parado na balança.');

      if (parsed.isStabilized) {
        logEvent('BalançaXiaomi', 'Peso estabilizado e guardado', { weight: parsed.weight, unit: parsed.unit });
        stopScan();
        setScanStatus('found');
        saveScaleReading(parsed);
      }
    });

    scanTimeoutRef.current = setTimeout(() => {
      stopScan();
      setScanStatus((current) => {
        if (current === 'scanning') {
          logEvent('BalançaXiaomi', 'Tempo limite de procura atingido sem encontrar a balança.');
          setStatusMessage('Tempo limite atingido. A balança não foi encontrada — tenta novamente.');
          return 'idle';
        }
        return current;
      });
    }, SCAN_TIMEOUT_MS);
  };

  // --- Objetivo de peso ---
  const handleSaveGoal = async () => {
    const goalWeightKg = parseFloat(goalInput.replace(',', '.'));
    if (!goalWeightKg || goalWeightKg <= 0) {
      Alert.alert('Peso inválido', 'Introduz um peso-objetivo válido, em kg.');
      return;
    }
    const startWeightKg = scaleHistory[0]?.weight ?? parseFloat(profile?.weight) ?? goalWeightKg;
    const newGoal = { goalWeightKg, startWeightKg, setAt: Date.now() };
    setGoal(newGoal);
    setGoalInput('');
    try {
      await AsyncStorage.setItem(WEIGHT_GOAL_KEY, JSON.stringify(newGoal));
    } catch (e) {}
  };

  const handleClearGoal = () => {
    Alert.alert('Remover Objetivo', 'Queres remover o teu objetivo de peso atual?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setGoal(null);
          await AsyncStorage.removeItem(WEIGHT_GOAL_KEY);
        },
      },
    ]);
  };

  // --- Medidas corporais ---
  const handleSaveMeasurement = async () => {
    const waist = parseFloat(waistInput.replace(',', '.'));
    const hip = parseFloat(hipInput.replace(',', '.'));
    if (!waist || !hip) {
      Alert.alert('Medidas inválidas', 'Introduz a cintura e a anca em centímetros.');
      return;
    }
    const entry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('pt-PT'),
      waist,
      hip,
    };
    const updated = [entry, ...measurements];
    setMeasurements(updated);
    setWaistInput('');
    setHipInput('');
    try {
      await AsyncStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleDeleteMeasurement = (id) => {
    Alert.alert('Apagar Medida', 'Eliminar este registo de medidas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const updated = measurements.filter((item) => item.id !== id);
          setMeasurements(updated);
          await AsyncStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(updated));
        },
      },
    ]);
  };

  // --- Lembrete de pesagem ---
  const handleSetReminder = async (hour, minute) => {
    setReminderBusy(true);
    const result = await scheduleWeighInReminder(hour, minute);
    setReminderBusy(false);
    if (!result.success) {
      Alert.alert('Não foi possível agendar', result.error || 'Tenta novamente.');
      return;
    }
    setReminderStatus({ hour, minute });
  };

  const handleCancelReminder = async () => {
    setReminderBusy(true);
    await cancelWeighInReminder();
    setReminderBusy(false);
    setReminderStatus(null);
  };

  // --- Exportar relatório ---
  const handleExportReport = async () => {
    const lines = [
      '🏥 RELATÓRIO DE SAÚDE & METABOLISMO',
      '',
      `Data: ${new Date().toLocaleDateString('pt-PT')}`,
    ];

    if (scaleHistory[0]) {
      lines.push('', `Peso atual: ${scaleHistory[0].weight} ${scaleHistory[0].unit}`);
      if (movingAvgWeight != null) lines.push(`Média (7 dias): ${movingAvgWeight} kg`);
      if (scaleHistory[0].bodyFatPercent != null) {
        lines.push(
          `Massa gorda: ${scaleHistory[0].bodyFatPercent}% (${scaleHistory[0].fatMassKg} kg)`,
          `Massa magra: ${scaleHistory[0].leanMassPercent}% (${scaleHistory[0].leanMassKg} kg)`,
          `Água corporal: ${scaleHistory[0].bodyWaterPercent}% (${scaleHistory[0].bodyWaterKg} kg)`
        );
      }
    }
    if (bmiInfo) lines.push(`IMC: ${bmiInfo.bmi} (${bmiInfo.label})`);
    if (whrInfo) lines.push(`Rácio cintura-anca: ${whrInfo.whr} (${whrInfo.label})`);
    if (whtrInfo) lines.push(`Rácio cintura-altura: ${whtrInfo.whtr} (${whtrInfo.label})`);
    if (latestVo2) lines.push(`VO2 Máx: ${latestVo2.value} ml/kg/min (${latestVo2.title})`);
    if (fcMax != null) lines.push(`FC Máx (Tanaka): ${fcMax} bpm`);
    if (trendAlert) lines.push('', `Tendência: ${trendAlert.message}`);
    if (goal && goalProgress) {
      lines.push(
        '',
        `Objetivo: ${goal.goalWeightKg} kg — progresso ${goalProgress.progressPercent}%` +
          (goalProgress.etaWeeks ? ` (estimativa: ~${goalProgress.etaWeeks} semanas)` : '')
      );
    }
    lines.push('', `TMB: ${summary?.bmr ?? bmrOnly} kcal`, `Gasto total hoje: ${summary?.total ?? bmrOnly} kcal`);
    if (summary?.fitSteps) lines.push(`Passos hoje (Google Fit): ${summary.fitSteps}`);
    if (waterSuggestion) lines.push(`Água sugerida hoje: ${(waterSuggestion / 1000).toFixed(1)} L`);
    lines.push('', '(Estimativas geradas pela app — não substituem avaliação médica.)');

    try {
      await Share.share({ message: lines.join('\n') });
    } catch (e) {}
  };

  const dotColor =
    scanStatus === 'found' ? '#22c55e' : scanStatus === 'scanning' ? '#eab308' : scanStatus === 'error' ? '#ef4444' : colors?.COLOR_DIVIDER;

  return (
    <View style={s.wrapper}>
      <View style={s.header}>
        <Text style={s.headerText}>SUBMENU: 07 - SAÚDE & METABOLISMO</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose}>
            <Text style={s.closeText}>▲ FECHAR</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* RESUMO DIÁRIO — o resultado final pedido: TMB + exercícios da app + Google Fit sem duplicar */}
      <View style={s.totalCard}>
        <Text style={s.totalLabel}>GASTO ENERGÉTICO TOTAL DE HOJE</Text>
        <Text style={s.totalValue}>
          {loadingSummary ? '...' : summary?.total ?? bmrOnly} <Text style={s.totalUnit}>kcal</Text>
        </Text>

        <View style={s.breakdownRow}>
          <Text style={s.breakdownLabel}>🔥 TMB (para viver)</Text>
          <Text style={s.breakdownValue}>{summary?.bmr ?? bmrOnly} kcal</Text>
        </View>
        <View style={s.breakdownRow}>
          <Text style={s.breakdownLabel}>🏃 Exercícios na app {summary ? `(${summary.appWorkoutCount})` : ''}</Text>
          <Text style={s.breakdownValue}>+{summary?.appExerciseCalories ?? 0} kcal</Text>
        </View>
        <View style={s.breakdownRow}>
          <Text style={s.breakdownLabel}>📱 Google Fit (passos, sem repetir)</Text>
          <Text style={s.breakdownValue}>+{summary?.fitCalories ?? 0} kcal</Text>
        </View>
        {summary?.fitSteps != null && summary.fitSteps > 0 && (
          <Text style={s.fitStepsHint}>👣 {summary.fitSteps.toLocaleString('pt-PT')} passos hoje (Google Fit)</Text>
        )}

        {summary?.fitError && <Text style={s.warningText}>⚠️ {summary.fitError}</Text>}

        <TouchableOpacity onPress={loadSummary} style={s.refreshBtn}>
          <Text style={s.refreshBtnText}>🔄 Atualizar resumo</Text>
        </TouchableOpacity>
      </View>

      {/* TENDÊNCIA — comparação simples e transparente das últimas 2 semanas */}
      {trendAlert && (
        <View style={[s.trendBox, trendAlert.type === 'loss' && s.trendBoxLoss, trendAlert.type === 'gain' && s.trendBoxGain]}>
          <Text style={s.trendText}>📊 {trendAlert.message}</Text>
        </View>
      )}

      {/* ESTATÍSTICAS RÁPIDAS — IMC + média de peso a 7 dias */}
      {(bmiInfo || movingAvgWeight != null) && (
        <View style={s.quickStatsRow}>
          {bmiInfo && (
            <View style={s.quickStatItem}>
              <Text style={s.bmiLabel}>IMC: <Text style={s.bmiValue}>{bmiInfo.bmi}</Text></Text>
              <Text style={s.bmiBadge}>{bmiInfo.label}</Text>
            </View>
          )}
          {movingAvgWeight != null && (
            <View style={s.quickStatItem}>
              <Text style={s.bmiLabel}>Média 7d: <Text style={s.bmiValue}>{movingAvgWeight} kg</Text></Text>
            </View>
          )}
        </View>
      )}

      {/* VO2 MÁX / FC MÁX — VO2 Máx vem do teste mais recente (Cooper, Rockport,
          etc.); FC Máx (Tanaka) é sempre calculada ao vivo a partir da idade. */}
      {(latestVo2 || fcMax != null) && (
        <View style={s.quickStatsRow}>
          {latestVo2 && (
            <View style={s.quickStatItem}>
              <Text style={s.bmiLabel}>VO2 Máx: <Text style={s.bmiValue}>{latestVo2.value}</Text></Text>
              <Text style={s.bmiBadge}>{latestVo2.title.split('(')[0].trim()}</Text>
            </View>
          )}
          {fcMax != null && (
            <View style={s.quickStatItem}>
              <Text style={s.bmiLabel}>FC Máx: <Text style={s.bmiValue}>{fcMax} bpm</Text></Text>
            </View>
          )}
        </View>
      )}

      {/* HIDRATAÇÃO — orientação geral, não prescrição médica */}
      {waterSuggestion != null && (
        <View style={s.hydrationRow}>
          <Text style={s.hydrationText}>
            💧 Sugestão de água hoje: <Text style={s.hydrationValue}>{(waterSuggestion / 1000).toFixed(1)} L</Text>
          </Text>
        </View>
      )}

      {/* OBJETIVO DE PESO */}
      <View style={s.card}>
        <Text style={s.cardTitle}>🎯 OBJETIVO DE PESO</Text>

        {goal ? (
          <View style={{ marginTop: 10 }}>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>Objetivo</Text>
              <Text style={s.breakdownValue}>{goal.goalWeightKg} kg</Text>
            </View>
            {goalProgress && (
              <>
                <View style={s.progressBarTrack}>
                  <View style={[s.progressBarFill, { width: `${goalProgress.progressPercent}%` }]} />
                </View>
                <Text style={s.progressText}>
                  {goalProgress.progressPercent}% do caminho · faltam {Math.abs(goalProgress.remainingKg)} kg
                </Text>
                <Text style={s.progressSubText}>
                  {goalProgress.etaWeeks != null
                    ? `À taxa atual (${goalProgress.ratePerWeek > 0 ? '+' : ''}${goalProgress.ratePerWeek} kg/semana), estimativa de ~${goalProgress.etaWeeks} semanas.`
                    : 'Ainda sem tendência clara nessa direção para estimar uma data.'}
                </Text>
              </>
            )}
            <TouchableOpacity onPress={handleClearGoal} style={s.linkBtn}>
              <Text style={s.deleteText}>Remover objetivo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.goalInputRow}>
            <TextInput
              style={s.goalInput}
              placeholder="Peso-objetivo (kg)"
              placeholderTextColor={colors?.COLOR_SECONDARY || '#94a3b8'}
              keyboardType="decimal-pad"
              value={goalInput}
              onChangeText={setGoalInput}
            />
            <TouchableOpacity onPress={handleSaveGoal} style={s.goalSaveBtn}>
              <Text style={s.goalSaveBtnText}>Definir</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* BALANÇA XIAOMI */}
      <View style={s.card}>
        <View style={s.scaleHeaderRow}>
          <Text style={s.cardTitle}>⚖️ BALANÇA XIAOMI</Text>
          <View style={s.connectionPill}>
            <View style={[s.connectionDot, { backgroundColor: dotColor }]} />
            <Text style={s.connectionText}>
              {scanStatus === 'scanning' ? 'A comunicar...' : scanStatus === 'found' ? 'Ligado' : scanStatus === 'error' ? 'Erro' : 'Desligado'}
            </Text>
          </View>
        </View>

        {liveReading && (
          <View style={s.liveWeightBox}>
            <Text style={s.liveWeightValue}>
              {liveReading.weight} <Text style={s.liveWeightUnit}>{liveReading.unit}</Text>
            </Text>
            {liveReading.impedance != null && (
              <Text style={s.liveImpedance}>Impedância: {liveReading.impedance} Ω</Text>
            )}
          </View>
        )}

        {statusMessage !== '' && <Text style={s.statusMessage}>{statusMessage}</Text>}

        <TouchableOpacity
          onPress={handleScanXiaomiScale}
          style={[s.scanBtn, scanStatus === 'scanning' && s.scanBtnActive]}
        >
          <Text style={s.scanBtnText}>
            {scanStatus === 'scanning' ? '⏹ CANCELAR LEITURA' : '⚖️ LIGAR À BALANÇA'}
          </Text>
        </TouchableOpacity>

        {lastSavedReading && (
          <TouchableOpacity onPress={() => handleUseWeightInProfile(lastSavedReading.weight)} style={s.linkBtn}>
            <Text style={s.linkBtnText}>Usar {lastSavedReading.weight} kg como peso do perfil ➔</Text>
          </TouchableOpacity>
        )}

        {/* COMPOSIÇÃO CORPORAL — calculada a partir do peso+impedância desta
            pesagem e da altura/idade/género do perfil. Ver utils/bodyComposition.js
            para a explicação completa da fórmula e das suas limitações. */}
        {lastSavedReading?.bodyFatPercent != null ? (
          <View style={s.compositionBox}>
            <Text style={s.compositionDisclaimer}>
              Estimativa (não é um valor clínico) — a Xiaomi não publica o algoritmo exato da balança.
            </Text>
            <View style={s.compositionRow}>
              <View style={s.compositionItem}>
                <Text style={s.compositionValue}>{lastSavedReading.bodyFatPercent}%</Text>
                <Text style={s.compositionLabel}>Massa Gorda</Text>
                <Text style={s.compositionSubLabel}>{lastSavedReading.fatMassKg} kg</Text>
              </View>
              <View style={s.compositionItem}>
                <Text style={s.compositionValue}>{lastSavedReading.leanMassPercent}%</Text>
                <Text style={s.compositionLabel}>Massa Magra</Text>
                <Text style={s.compositionSubLabel}>{lastSavedReading.leanMassKg} kg</Text>
              </View>
              <View style={s.compositionItem}>
                <Text style={s.compositionValue}>{lastSavedReading.bodyWaterPercent}%</Text>
                <Text style={s.compositionLabel}>Água Corporal</Text>
                <Text style={s.compositionSubLabel}>{lastSavedReading.bodyWaterKg} kg</Text>
              </View>
            </View>
          </View>
        ) : (
          lastSavedReading && (
            <Text style={s.compositionHint}>
              Preenche a tua altura e idade no perfil para veres também massa gorda, massa magra e água corporal.
            </Text>
          )
        )}

        <TouchableOpacity onPress={() => setShowScaleHistory(!showScaleHistory)} style={s.linkBtn}>
          <Text style={s.linkBtnText}>
            {showScaleHistory ? '▲ Esconder' : '▼ Ver'} histórico da balança ({scaleHistory.length})
          </Text>
        </TouchableOpacity>

        {showScaleHistory && (
          <View style={s.scaleHistoryList}>
            {scaleHistory.length === 0 && <Text style={s.emptyText}>Ainda não há pesagens registadas.</Text>}
            {scaleHistory.map((entry) => (
              <View key={entry.id} style={s.scaleHistoryRow}>
                <View>
                  <Text style={s.scaleHistoryWeight}>{entry.weight} {entry.unit}</Text>
                  <Text style={s.scaleHistoryMeta}>
                    {entry.date} às {entry.time}{entry.impedance != null ? ` · ${entry.impedance} Ω` : ''}
                  </Text>
                  {entry.bodyFatPercent != null && (
                    <Text style={s.scaleHistoryComposition}>
                      🩶 {entry.bodyFatPercent}% gordura · 💧 {entry.bodyWaterPercent}% água
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDeleteScaleEntry(entry.id)}>
                  <Text style={s.deleteText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {liveReading?.hex && (
          <TouchableOpacity onPress={() => setShowDebug(!showDebug)} style={s.linkBtn}>
            <Text style={s.debugToggleText}>{showDebug ? '▲ esconder' : '▼ mostrar'} bytes recebidos (avançado)</Text>
          </TouchableOpacity>
        )}
        {showDebug && liveReading?.hex && <Text style={s.debugText}>{liveReading.hex}</Text>}
      </View>

      {/* MEDIDAS CORPORAIS — cintura/anca, para o rácio cintura-anca (WHR) e
          cintura-altura (WHtR, só precisa da cintura + altura do perfil). */}
      <View style={s.card}>
        <Text style={s.cardTitle}>📏 MEDIDAS CORPORAIS</Text>
        <Text style={s.compositionDisclaimer}>
          Rácio cintura-anca (OMS) e cintura-altura (Ashwell) — mede com a fita métrica esticada, sem apertar.
        </Text>

        {(whrInfo || whtrInfo) && (
          <View style={s.whrRow}>
            {whrInfo && (
              <View style={[s.whrBox, whrInfo.isElevated && s.whrBoxElevated]}>
                <Text style={s.whrValue}>WHR: {whrInfo.whr}</Text>
                <Text style={s.whrLabel}>{whrInfo.label}</Text>
              </View>
            )}
            {whtrInfo && (
              <View style={[s.whrBox, whtrInfo.isElevated && s.whrBoxElevated]}>
                <Text style={s.whrValue}>WHtR: {whtrInfo.whtr}</Text>
                <Text style={s.whrLabel}>{whtrInfo.label}</Text>
              </View>
            )}
          </View>
        )}

        <View style={s.goalInputRow}>
          <TextInput
            style={[s.goalInput, { marginRight: 6 }]}
            placeholder="Cintura (cm)"
            placeholderTextColor={colors?.COLOR_SECONDARY || '#94a3b8'}
            keyboardType="decimal-pad"
            value={waistInput}
            onChangeText={setWaistInput}
          />
          <TextInput
            style={s.goalInput}
            placeholder="Anca (cm)"
            placeholderTextColor={colors?.COLOR_SECONDARY || '#94a3b8'}
            keyboardType="decimal-pad"
            value={hipInput}
            onChangeText={setHipInput}
          />
          <TouchableOpacity onPress={handleSaveMeasurement} style={s.goalSaveBtn}>
            <Text style={s.goalSaveBtnText}>Guardar</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setShowMeasurements(!showMeasurements)} style={s.linkBtn}>
          <Text style={s.linkBtnText}>
            {showMeasurements ? '▲ Esconder' : '▼ Ver'} histórico de medidas ({measurements.length})
          </Text>
        </TouchableOpacity>

        {showMeasurements && (
          <View style={s.scaleHistoryList}>
            {measurements.length === 0 && <Text style={s.emptyText}>Ainda não há medidas registadas.</Text>}
            {measurements.map((entry) => (
              <View key={entry.id} style={s.scaleHistoryRow}>
                <View>
                  <Text style={s.scaleHistoryWeight}>Cintura {entry.waist} cm · Anca {entry.hip} cm</Text>
                  <Text style={s.scaleHistoryMeta}>{entry.date}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteMeasurement(entry.id)}>
                  <Text style={s.deleteText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* EVOLUÇÃO — gráfico com as últimas pesagens, para ver a tendência ao
          longo do tempo (o que realmente importa numa balança de casa). */}
      {chartEntries.length >= 2 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>📈 EVOLUÇÃO</Text>

          <View style={s.chartToggleRow}>
            {Object.entries(CHART_METRICS).map(([metricKey, m]) => (
              <TouchableOpacity
                key={metricKey}
                onPress={() => setChartMetric(metricKey)}
                style={[s.chartToggleBtn, chartMetric === metricKey && s.chartToggleBtnActive]}
              >
                <Text style={[s.chartToggleText, chartMetric === metricKey && s.chartToggleTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {chartDataPoints.length >= 2 ? (
            <LineChart
              data={{ labels: chartLabels, datasets: [{ data: chartDataPoints }] }}
              width={Dimensions.get('window').width - 76}
              height={180}
              yAxisSuffix={activeChartMetric.unit === '%' ? '%' : ''}
              chartConfig={{
                backgroundGradientFrom: colors?.COLOR_CARD_BG || '#1e293b',
                backgroundGradientTo: colors?.COLOR_CARD_BG || '#1e293b',
                backgroundGradientFromOpacity: 0.001,
                backgroundGradientToOpacity: 0.001,
                decimalPlaces: 1,
                color: (opacity = 1) => activeChartMetric.color(opacity),
                labelColor: () => colors?.COLOR_SECONDARY || '#94a3b8',
                propsForDots: { r: '3' },
              }}
              bezier
              style={{ borderRadius: 12, marginTop: 8 }}
            />
          ) : (
            <Text style={s.emptyText}>
              Ainda não há dados suficientes de {activeChartMetric.label.toLowerCase()} para desenhar o gráfico.
            </Text>
          )}
        </View>
      )}

      {/* LEMBRETE DE PESAGEM */}
      <View style={s.card}>
        <Text style={s.cardTitle}>⏰ LEMBRETE DE PESAGEM</Text>
        <Text style={s.compositionDisclaimer}>
          A hora exata pode variar um pouco consoante a otimização de bateria do telemóvel.
        </Text>
        <View style={s.chartToggleRow}>
          {REMINDER_TIME_PRESETS.map((preset) => {
            const isActive = reminderStatus?.hour === preset.hour && reminderStatus?.minute === preset.minute;
            return (
              <TouchableOpacity
                key={preset.label}
                disabled={reminderBusy}
                onPress={() => handleSetReminder(preset.hour, preset.minute)}
                style={[s.chartToggleBtn, isActive && s.chartToggleBtnActive]}
              >
                <Text style={[s.chartToggleText, isActive && s.chartToggleTextActive]}>{preset.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {reminderStatus ? (
          <TouchableOpacity onPress={handleCancelReminder} disabled={reminderBusy} style={s.linkBtn}>
            <Text style={s.deleteText}>Desligar lembrete</Text>
          </TouchableOpacity>
        ) : (
          <Text style={s.compositionHint}>Sem lembrete agendado — escolhe uma hora acima para ativar.</Text>
        )}
      </View>

      {/* EXPORTAR RELATÓRIO */}
      <TouchableOpacity onPress={handleExportReport} style={s.exportBtn}>
        <Text style={s.exportBtnText}>📤 Exportar / Partilhar Relatório</Text>
      </TouchableOpacity>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Estilos do menu Saúde — derivados da paleta do tema ativo (colors), para
// ficar visualmente coerente com o resto da app em qualquer um dos temas,
// sem depender do styles/styles.js partilhado (mantém o isolamento do menu).
// ----------------------------------------------------------------------------
const buildStyles = (colors = {}) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: colors.COLOR_CARD_BG || 'rgba(30,41,59,0.9)',
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.COLOR_DIVIDER || 'rgba(255,255,255,0.2)',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.COLOR_DIVIDER || 'rgba(255,255,255,0.2)',
      paddingBottom: 8,
    },
    headerText: { color: colors.COLOR_PRIMARY || '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
    closeText: { color: colors.COLOR_SECONDARY || '#ccc', fontWeight: '700', fontSize: 11 },

    totalCard: {
      backgroundColor: colors.COLOR_PRIMARY_BG || 'rgba(15,23,42,0.7)',
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.COLOR_DIVIDER || 'rgba(255,255,255,0.15)',
    },
    totalLabel: { color: colors.COLOR_SECONDARY || '#94a3b8', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    totalValue: { color: colors.COLOR_LIME_ENERGY || '#4ade80', fontSize: 32, fontWeight: '900', marginTop: 4, marginBottom: 10 },
    totalUnit: { fontSize: 15, color: colors.COLOR_PRIMARY || '#e2e8f0', fontWeight: '600' },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    breakdownLabel: { color: colors.COLOR_SECONDARY || '#cbd5e1', fontSize: 12 },
    breakdownValue: { color: colors.COLOR_PRIMARY || '#fff', fontSize: 12, fontWeight: '700' },
    warningText: { color: colors.COLOR_RED_ACCENT || '#f87171', fontSize: 11, marginTop: 8 },
    fitStepsHint: { color: colors.COLOR_SECONDARY || '#94a3b8', fontSize: 10, marginTop: -2, marginBottom: 4 },
    refreshBtn: { marginTop: 10, alignSelf: 'flex-start' },
    refreshBtnText: { color: colors.COLOR_LIME_ENERGY || '#a3e635', fontSize: 12, fontWeight: '700' },

    card: {
      backgroundColor: colors.COLOR_BG_MAIN || 'rgba(15,23,42,0.5)',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.COLOR_DIVIDER || 'rgba(255,255,255,0.15)',
      marginBottom: 12,
    },
    cardTitle: { color: colors.COLOR_PRIMARY || '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
    scaleHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    connectionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.COLOR_CARD_BG || 'rgba(255,255,255,0.08)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    connectionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    connectionText: { color: colors.COLOR_SECONDARY || '#cbd5e1', fontSize: 10, fontWeight: '700' },

    liveWeightBox: { alignItems: 'center', paddingVertical: 12 },
    liveWeightValue: { color: colors.COLOR_PRIMARY || '#fff', fontSize: 40, fontWeight: '900' },
    liveWeightUnit: { fontSize: 16, color: colors.COLOR_SECONDARY || '#cbd5e1' },
    liveImpedance: { color: colors.COLOR_SECONDARY || '#94a3b8', fontSize: 12, marginTop: 4 },

    statusMessage: { color: colors.COLOR_SECONDARY || '#cbd5e1', fontSize: 12, textAlign: 'center', marginBottom: 10 },

    scanBtn: {
      backgroundColor: colors.COLOR_LIME_ENERGY || '#3b82f6',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    scanBtnActive: { backgroundColor: colors.COLOR_RED_ACCENT || '#ef4444' },
    scanBtnText: { color: colors.COLOR_ACCENT_TEXT || '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

    linkBtn: { marginTop: 12, alignItems: 'center' },
    linkBtnText: { color: colors.COLOR_LIME_ENERGY || '#a3e635', fontSize: 12, fontWeight: '700' },

    scaleHistoryList: { marginTop: 10 },
    emptyText: { color: colors.COLOR_SECONDARY || '#94a3b8', fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: 8 },
    scaleHistoryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.COLOR_DIVIDER || 'rgba(255,255,255,0.1)',
    },
    scaleHistoryWeight: { color: colors.COLOR_PRIMARY || '#fff', fontWeight: '700', fontSize: 14 },
    scaleHistoryMeta: { color: colors.COLOR_SECONDARY || '#94a3b8', fontSize: 11 },
    deleteText: { color: colors.COLOR_RED_ACCENT || '#f87171', fontSize: 11, fontWeight: '700' },

    debugToggleText: { color: colors.COLOR_SECONDARY || '#64748b', fontSize: 10 },
    debugText: {
      color: colors.COLOR_SECONDARY || '#64748b',
      fontSize: 10,
      marginTop: 6,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },

    // --- IMC / estatísticas rápidas ---
    quickStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    quickStatItem: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.COLOR_CARD_BG || 'rgba(255,255,255,0.06)',
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    bmiLabel: { color: colors.COLOR_SECONDARY || '#cbd5e1', fontSize: 12, fontWeight: '600' },
    bmiValue: { color: colors.COLOR_PRIMARY || '#fff', fontWeight: '800' },
    bmiBadge: { color: colors.COLOR_LIME_ENERGY || '#a3e635', fontSize: 11, fontWeight: '800' },

    // --- Tendência ---
    trendBox: {
      backgroundColor: colors.COLOR_CARD_BG || 'rgba(255,255,255,0.08)',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.COLOR_DIVIDER || 'rgba(255,255,255,0.2)',
    },
    trendBoxLoss: { borderLeftColor: colors.COLOR_LIME_ENERGY || '#22c55e' },
    trendBoxGain: { borderLeftColor: colors.COLOR_RED_ACCENT || '#ef4444' },
    trendText: { color: colors.COLOR_PRIMARY || '#fff', fontSize: 12, fontWeight: '600' },

    // --- Hidratação ---
    hydrationRow: {
      backgroundColor: colors.COLOR_CARD_BG || 'rgba(255,255,255,0.06)',
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    hydrationText: { color: colors.COLOR_SECONDARY || '#cbd5e1', fontSize: 12, fontWeight: '600' },
    hydrationValue: { color: '#38bdf8', fontWeight: '800' },

    // --- Composição corporal (massa gorda/magra/água) ---
    compositionBox: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.COLOR_DIVIDER || 'rgba(255,255,255,0.12)',
    },
    compositionDisclaimer: {
      color: colors.COLOR_SECONDARY || '#94a3b8',
      fontSize: 9,
      fontStyle: 'italic',
      textAlign: 'center',
      marginBottom: 8,
    },
    compositionRow: { flexDirection: 'row', justifyContent: 'space-around' },
    compositionItem: { alignItems: 'center', flex: 1 },
    compositionValue: { color: colors.COLOR_PRIMARY || '#fff', fontSize: 16, fontWeight: '800' },
    compositionLabel: { color: colors.COLOR_SECONDARY || '#cbd5e1', fontSize: 10, fontWeight: '700', marginTop: 2 },
    compositionSubLabel: { color: colors.COLOR_SECONDARY || '#64748b', fontSize: 9, marginTop: 1 },
    compositionHint: {
      color: colors.COLOR_SECONDARY || '#94a3b8',
      fontSize: 10,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 10,
    },
    scaleHistoryComposition: { color: colors.COLOR_SECONDARY || '#94a3b8', fontSize: 10, marginTop: 2 },

    // --- Gráfico de evolução / presets de hora do lembrete ---
    chartToggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    chartToggleBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.COLOR_CARD_BG || 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: colors.COLOR_DIVIDER || 'rgba(255,255,255,0.15)',
    },
    chartToggleBtnActive: { backgroundColor: colors.COLOR_LIME_ENERGY || '#3b82f6', borderColor: 'transparent' },
    chartToggleText: { color: colors.COLOR_SECONDARY || '#cbd5e1', fontSize: 10, fontWeight: '700' },
    chartToggleTextActive: { color: colors.COLOR_ACCENT_TEXT || '#fff' },

    // --- Objetivo de peso ---
    goalInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    goalInput: {
      flex: 1,
      backgroundColor: colors.COLOR_CARD_BG || 'rgba(255,255,255,0.08)',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: colors.COLOR_PRIMARY || '#fff',
      fontSize: 12,
      borderWidth: 1,
      borderColor: colors.COLOR_DIVIDER || 'rgba(255,255,255,0.15)',
    },
    goalSaveBtn: {
      backgroundColor: colors.COLOR_LIME_ENERGY || '#3b82f6',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginLeft: 8,
    },
    goalSaveBtnText: { color: colors.COLOR_ACCENT_TEXT || '#fff', fontWeight: '800', fontSize: 12 },
    progressBarTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.COLOR_CARD_BG || 'rgba(255,255,255,0.1)',
      marginTop: 10,
      overflow: 'hidden',
    },
    progressBarFill: { height: '100%', backgroundColor: colors.COLOR_LIME_ENERGY || '#22c55e', borderRadius: 4 },
    progressText: { color: colors.COLOR_PRIMARY || '#fff', fontSize: 11, fontWeight: '700', marginTop: 6 },
    progressSubText: { color: colors.COLOR_SECONDARY || '#94a3b8', fontSize: 10, marginTop: 2 },

    // --- WHR / WHtR ---
    whrRow: { flexDirection: 'row', gap: 8 },
    whrBox: {
      flex: 1,
      backgroundColor: colors.COLOR_CARD_BG || 'rgba(255,255,255,0.08)',
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.COLOR_LIME_ENERGY || '#22c55e',
    },
    whrBoxElevated: { borderLeftColor: colors.COLOR_RED_ACCENT || '#ef4444' },
    whrValue: { color: colors.COLOR_PRIMARY || '#fff', fontWeight: '800', fontSize: 13 },
    whrLabel: { color: colors.COLOR_SECONDARY || '#cbd5e1', fontSize: 11, marginTop: 2 },

    // --- Exportar relatório ---
    exportBtn: {
      backgroundColor: colors.COLOR_CARD_BG || 'rgba(255,255,255,0.08)',
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.COLOR_DIVIDER || 'rgba(255,255,255,0.15)',
    },
    exportBtnText: { color: colors.COLOR_PRIMARY || '#fff', fontWeight: '800', fontSize: 12 },
  });
