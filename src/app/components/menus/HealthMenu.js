import React, { useEffect, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, Text, TouchableOpacity, View } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import {
  aggregateRecord,
  getGrantedPermissions,
  initialize,
  requestPermission,
} from 'react-native-health-connect';

const bleManager = new BleManager();

const HEALTH_PERMISSIONS = [
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
];

export default function HealthMenu({ colors, onClose }) {
  const [activeCalories, setActiveCalories] = useState(0);
  const [isScanningScale, setIsScanningScale] = useState(false);
  const [scaleData, setScaleData] = useState(null);

  useEffect(() => {
    setupHealthConnect();
  }, []);

  const setupHealthConnect = async () => {
    try {
      const isInitialized = await initialize();
      if (!isInitialized) return;

      const currentPermissions = await getGrantedPermissions();
      const alreadyGranted = HEALTH_PERMISSIONS.every((req) =>
        currentPermissions.some(
          (granted) =>
            granted.recordType === req.recordType && granted.accessType === req.accessType
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
      console.error('Erro ao configurar o Health Connect:', error);
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

      const activeResult = await aggregateRecord({
        recordType: 'ActiveCaloriesBurned',
        timeRangeFilter,
      });

      if (activeResult?.ENERGY_TOTAL?.inKilocalories) {
        setActiveCalories(Math.round(activeResult.ENERGY_TOTAL.inKilocalories));
      } else {
        const totalResult = await aggregateRecord({
          recordType: 'TotalCaloriesBurned',
          timeRangeFilter,
        });

        if (totalResult?.ENERGY_TOTAL?.inKilocalories) {
          setActiveCalories(Math.round(totalResult.ENERGY_TOTAL.inKilocalories));
        }
      }
    } catch (error) {
      console.error('Erro ao ler calorias:', error);
    }
  };

  // --------------------------------------------------------------------------
  // PEDIDO DE PERMISSÕES DE BLUETOOTH (ANDROID)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // CONEXÃO COM A BALANÇA XIAOMI (BLE)
  // --------------------------------------------------------------------------
  const handleScanXiaomiScale = async () => {
    if (isScanningScale) return;

    // 1. Pedir permissões do SO
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      Alert.alert('Permissão Negada', 'A app precisa de permissão de Bluetooth para procurar a balança.');
      return;
    }

    // 2. Verificar se o Bluetooth está ativo
    const state = await bleManager.state();
    if (state !== 'PoweredOn') {
      Alert.alert('Bluetooth Desligado', 'Por favor, liga o Bluetooth do telemóvel e tenta novamente.');
      return;
    }

    setIsScanningScale(true);
    Alert.alert('Balança Xiaomi', 'A procurar... Suba para a balança agora para ativar a transmissão.');

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Erro no scan BLE:', error);
        setIsScanningScale(false);
        bleManager.stopDeviceScan();
        Alert.alert('Erro Bluetooth', 'Falha ao iniciar a pesquisa de dispositivos.');
        return;
      }

      if (device && (device.name?.includes('MI Scale') || device.name?.includes('MIBCO') || device.name?.includes('MIBFS'))) {
        bleManager.stopDeviceScan();
        setIsScanningScale(false);

        Alert.alert('Balança Detetada', `Ligado com sucesso a: ${device.name || 'Xiaomi Scale'}`);
        setScaleData({ name: device.name, status: 'Conetado' });
      }
    });

    setTimeout(() => {
      if (isScanningScale) {
        bleManager.stopDeviceScan();
        setIsScanningScale(false);
      }
    }, 12000);
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

      {/* PAINEL DE CALORIAS GOOGLE FIT */}
      <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <Text style={{ color: '#94a3b8', fontSize: 12 }}>CALORIAS DO GOOGLE FIT (HOJE)</Text>
        <Text style={{ color: '#38bdf8', fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
          {activeCalories} <Text style={{ fontSize: 14, color: '#e2e8f0' }}>kcal</Text>
        </Text>
        <TouchableOpacity onPress={fetchActiveCalories} style={{ marginTop: 8 }}>
          <Text style={{ color: '#a3e635', fontSize: 12 }}>🔄 Atualizar dados do Fit</Text>
        </TouchableOpacity>
      </View>

      {/* BOTÃO DA BALANÇA XIAOMI */}
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
          {isScanningScale ? '⏳ A PROCURAR BALANÇA...' : '⚖️ LER BALANÇA XIAOMI'}
        </Text>
      </TouchableOpacity>

      {scaleData && (
        <Text style={{ color: '#4ade80', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          ✓ Dispositivo: {scaleData.name}
        </Text>
      )}
    </View>
  );
}