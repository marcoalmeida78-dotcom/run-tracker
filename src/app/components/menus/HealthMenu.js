import React, { useEffect, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, Text, TouchableOpacity, View } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import {
  aggregateRecord,
  getGrantedPermissions,
  initialize,
  requestPermission,
} from 'react-native-health-connect';
import { calculateBMR } from '../../utils/healthCalculations';

const bleManager = new BleManager();

const HEALTH_PERMISSIONS = [
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'Steps' },
];

export default function HealthMenu({ colors, profile, onClose }) {
  const [activeCalories, setActiveCalories] = useState(0);
  const [isScanningScale, setIsScanningScale] = useState(false);
  const [scaleWeight, setScaleWeight] = useState(null);
  const [scaleStatus, setScaleStatus] = useState('');

  // 1. CÁLCULO DA TMB (TAXA METABÓLICA BASAL)
  const userProfile = profile || { gender: 'male', weight: 75, height: 175, age: 30 };
  const bmrValue = calculateBMR ? calculateBMR(userProfile) : Math.round(10 * (userProfile.weight || 75) + 6.25 * (userProfile.height || 175) - 5 * (userProfile.age || 30) + 5);

  useEffect(() => {
    setupHealthConnect();
  }, []);

  // 2. CONFIGURAÇÃO E LEITURA DO GOOGLE FIT / HEALTH CONNECT
  const setupHealthConnect = async () => {
    try {
      const isInitialized = await initialize();
      if (!isInitialized) return;

      const currentPermissions = await getGrantedPermissions();
      const alreadyGranted = HEALTH_PERMISSIONS.every((req) =>
        currentPermissions.some(
          (granted) => granted.recordType === req.recordType && granted.accessType === req.accessType
        )
      );

      if (alreadyGranted) {
        await fetchActiveCalories();
      } else {
        const granted = await requestPermission(HEALTH_PERMISSIONS);
        if (granted && granted.length > 0) {
          await fetchActiveCalories();
        }
      }
    } catch (error) {
      console.error('Erro ao configurar Health Connect:', error);
    }
  };

  const fetchActiveCalories = async () => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

      const timeRangeFilter = {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      };

      // Tentar obter calorias totais despendidas
      const totalResult = await aggregateRecord({
        recordType: 'TotalCaloriesBurned',
        timeRangeFilter,
      });

      if (totalResult?.ENERGY_TOTAL?.inKilocalories) {
        setActiveCalories(Math.round(totalResult.ENERGY_TOTAL.inKilocalories));
      } else {
        // Fallback para ActiveCaloriesBurned
        const activeResult = await aggregateRecord({
          recordType: 'ActiveCaloriesBurned',
          timeRangeFilter,
        });
        if (activeResult?.ENERGY_TOTAL?.inKilocalories) {
          setActiveCalories(Math.round(activeResult.ENERGY_TOTAL.inKilocalories));
        }
      }
    } catch (error) {
      console.error('Erro ao ler calorias do Health Connect:', error);
    }
  };

  // 3. PERMISSÕES BLUETOOTH (ANDROID)
  const requestBluetoothPermissions = async () => {
    if (Platform.OS === 'android') {
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
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  };

  // 4. PROCESSAR DADOS DE PESO DA BALANÇA XIAOMI (BLE ADVERTISING)
  const parseXiaomiScaleWeight = (manufacturerData) => {
    if (!manufacturerData) return null;
    try {
      // Descodificação de dados hex da Xiaomi Scale
      const buffer = Buffer.from(manufacturerData, 'base64');
      if (buffer.length >= 10) {
        const weightRaw = (buffer[1] << 8) | buffer[0];
        const isLbs = (buffer[2] & 0x01) !== 0;
        const weight = isLbs ? (weightRaw / 100) * 0.453592 : weightRaw / 200;
        return weight.toFixed(1);
      }
    } catch (e) {
      console.log('Erro a descodificar peso:', e);
    }
    return null;
  };

  const handleScanXiaomiScale = async () => {
    if (isScanningScale) return;

    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      Alert.alert('Permissão Negada', 'Necessário permissão de Bluetooth para procurar a balança.');
      return;
    }

    const state = await bleManager.state();
    if (state !== 'PoweredOn') {
      Alert.alert('Bluetooth Desligado', 'Ativa o Bluetooth do telemóvel e tenta novamente.');
      return;
    }

    setIsScanningScale(true);
    setScaleStatus('A procurar balança... Suba para a balança agora.');

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Erro no scan BLE:', error);
        setIsScanningScale(false);
        bleManager.stopDeviceScan();
        setScaleStatus('Erro ao procurar balança.');
        return;
      }

      if (device && (device.name?.includes('MI Scale') || device.name?.includes('MIBCO') || device.name?.includes('MIBFS') || device.name?.includes('Nymi'))) {
        setScaleStatus('Balança encontrada! A ler peso...');
        
        if (device.manufacturerData) {
          const parsedWeight = parseXiaomiScaleWeight(device.manufacturerData);
          if (parsedWeight && parsedWeight > 5) {
            setScaleWeight(parsedWeight);
            setScaleStatus(`Peso registado: ${parsedWeight} kg`);
            bleManager.stopDeviceScan();
            setIsScanningScale(false);
          }
        }
      }
    });

    // Timeout de segurança após 15 segundos
    setTimeout(() => {
      if (isScanningScale) {
        bleManager.stopDeviceScan();
        setIsScanningScale(false);
        if (!scaleWeight) setScaleStatus('Tempo limite atingido. Tente subir novamente para a balança.');
      }
    }, 15000);
  };

  return (
    <View style={{ backgroundColor: colors?.cardBackground || '#1e293b', padding: 16, borderRadius: 12, marginVertical: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>🏥 SAÚDE & METABOLISMO</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: '#94a3b8', fontSize: 14 }}>▲ FECHAR</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* TMB (TAXA METABÓLICA BASAL) */}
      <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>TAXA METABÓLICA BASAL (TMB)</Text>
          <Text style={{ color: '#4ade80', fontSize: 22, fontWeight: 'bold', marginTop: 2 }}>
            {bmrValue} <Text style={{ fontSize: 14, color: '#e2e8f0' }}>kcal/dia</Text>
          </Text>
        </View>
        <Text style={{ fontSize: 24 }}>🔥</Text>
      </View>

      {/* PAINEL DE CALORIAS GOOGLE FIT */}
      <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <Text style={{ color: '#94a3b8', fontSize: 12 }}>CALORIAS REGISTADAS (GOOGLE FIT)</Text>
        <Text style={{ color: '#38bdf8', fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>
          {activeCalories} <Text style={{ fontSize: 14, color: '#e2e8f0' }}>kcal</Text>
        </Text>
        <TouchableOpacity onPress={fetchActiveCalories} style={{ marginTop: 8 }}>
          <Text style={{ color: '#a3e635', fontSize: 12 }}>🔄 Atualizar dados do Fit</Text>
        </TouchableOpacity>
      </View>

      {/* BALANÇA XIAOMI */}
      <TouchableOpacity
        onPress={handleScanXiaomiScale}
        disabled={isScanningScale}
        style={{
          backgroundColor: isScanningScale ? '#475569' : '#3b82f6',
          padding: 12,
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>
          {isScanningScale ? '⏳ A LER BALANÇA...' : '⚖️ LER BALANÇA XIAOMI'}
        </Text>
      </TouchableOpacity>

      {scaleStatus !== '' && (
        <Text style={{ color: scaleWeight ? '#4ade80' : '#cbd5e1', fontSize: 13, textAlign: 'center', marginTop: 8, fontWeight: scaleWeight ? 'bold' : 'normal' }}>
          {scaleStatus}
        </Text>
      )}
    </View>
  );
}
