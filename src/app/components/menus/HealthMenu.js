// ============================================================================
// MENU SAÚDE & METABOLISMO — módulo isolado
// ----------------------------------------------------------------------------
// Este ficheiro concentra TODA a funcionalidade do menu Saúde (TMB, resumo
// diário de calorias, Google Fit e balança Xiaomi). Não é importado por mais
// nenhum sítio da app além do MainScreen, e não altera nenhuma lógica dos
// outros menus. Para desligar o menu Saúde por completo, basta remover o
// bloco correspondente no MainScreen.js — nada aqui tem de ser tocado.
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { calculateBMR, computeDailyEnergySummary } from '../../utils/healthCalculations';
import { logEvent } from '../../utils/debugLog';

const SCALE_HISTORY_KEY = '@health_scale_history';
const SCAN_TIMEOUT_MS = 25000;

// Nomes/UUIDs conhecidos das balanças Xiaomi Mi Body Composition Scale (1 e 2).
const SCALE_NAME_MATCH = /MIBFS|MIBCS|MI ?SCALE|XMTZC/i;
const BODY_COMPOSITION_UUID_FRAGMENT = '181b';

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
  const scanTimeoutRef = useRef(null);

  useEffect(() => {
    loadScaleHistory();
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
    const entry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('pt-PT'),
      time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      weight: reading.weight,
      impedance: reading.impedance,
      unit: reading.unit,
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

  const dotColor =
    scanStatus === 'found' ? '#22c55e' : scanStatus === 'scanning' ? '#eab308' : scanStatus === 'error' ? '#ef4444' : colors?.COLOR_DIVIDER;

  return (
    <View style={s.wrapper}>
      <View style={s.header}>
        <Text style={s.headerText}>🏥 SAÚDE & METABOLISMO</Text>
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
          <Text style={s.breakdownLabel}>📱 Google Fit (sem repetir)</Text>
          <Text style={s.breakdownValue}>+{summary?.fitCalories ?? 0} kcal</Text>
        </View>

        {summary?.fitError && <Text style={s.warningText}>⚠️ {summary.fitError}</Text>}

        <TouchableOpacity onPress={loadSummary} style={s.refreshBtn}>
          <Text style={s.refreshBtnText}>🔄 Atualizar resumo</Text>
        </TouchableOpacity>
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
    refreshBtn: { marginTop: 10, alignSelf: 'flex-start' },
    refreshBtnText: { color: colors.COLOR_LIME_ENERGY || '#a3e635', fontSize: 12, fontWeight: '700' },

    card: {
      backgroundColor: colors.COLOR_BG_MAIN || 'rgba(15,23,42,0.5)',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.COLOR_DIVIDER || 'rgba(255,255,255,0.15)',
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
  });
