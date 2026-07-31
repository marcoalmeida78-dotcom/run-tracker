import React, { useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import {
  aggregateRecord,
  getGrantedPermissions,
  initialize,
  requestPermission,
} from 'react-native-health-connect';

const bleManager = new BleManager();

// Definição clara das permissões necessárias para o Google Fit / Health Connect
const HEALTH_PERMISSIONS = [
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
];

export default function HealthMenu({ colors, onClose }) {
  const [activeCalories, setActiveCalories] = useState(0);
  const [isScanningScale, setIsScanningScale] = useState(false);
  const [scaleData, setScaleData] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  // --------------------------------------------------------------------------
  // 1. INICIALIZAÇÃO E PEDIDO DE PERMISSÕES PERMANENTES
  // --------------------------------------------------------------------------
  useEffect(() => {
    setupHealthConnect();
  }, []);

  const setupHealthConnect = async () => {
    try {
      // 1. Inicializa a ligação ao Health Connect
      const isInitialized = await initialize();
      if (!isInitialized) {
        console.log('Health Connect não está disponível neste dispositivo.');
        return;
      }

      // 2. Verifica se as permissões já foram concedidas anteriormente
      const currentPermissions = await getGrantedPermissions();
      const alreadyGranted = HEALTH_PERMISSIONS.every((req) =>
        currentPermissions.some(
          (granted) =>
            granted.recordType === req.recordType && granted.accessType === req.accessType
        )
      );

      if (alreadyGranted) {
        setHasPermission(true);
        await fetchActiveCalories();
      } else {
        // 3. Se ainda não foram concedidas, solicita ao sistema (Pop-up do Android)
        const granted = await requestPermission(HEALTH_PERMISSIONS);
        if (granted && granted.length > 0) {
          setHasPermission(true);
          await fetchActiveCalories();
        } else {
          console.log('Permissão do Health Connect recusada pelo utilizador.');
        }
      }
    } catch (error) {
      console.error('Erro ao configurar o Health Connect:', error);
    }
  };

  // --------------------------------------------------------------------------
  // 2. LEITURA DE CALORIAS ATIVAS DO DIA (00:00 até Agora)
  // --------------------------------------------------------------------------
  const fetchActiveCalories = async () => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

      const timeRangeFilter = {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      };

      // Tentar procurar ActiveCaloriesBurned (ex: minutos ativos / corridas)
      const activeResult = await aggregateRecord({
        recordType: 'ActiveCaloriesBurned',
        timeRangeFilter,
      });

      if (activeResult?.ENERGY_TOTAL?.inKilocalories) {
        setActiveCalories(Math.round(activeResult.ENERGY_TOTAL.inKilocalories));
      } else {
        // Fallback: TotalCaloriesBurned caso o Fit reporte o acumulado do dia
        const totalResult = await aggregateRecord({
          recordType: 'TotalCaloriesBurned',
          timeRangeFilter,
        });

        if (totalResult?.ENERGY_TOTAL?.inKilocalories) {
          setActiveCalories(Math.round(totalResult.ENERGY_TOTAL.inKilocalories));
        }
      }
    } catch (error) {
      console.error('Erro ao ler calorias do Health Connect:', error);
    }
  };

  // --------------------------------------------------------------------------
  // 3. LEITURA DA BALANÇA XIAOMI (BLE)
  // --------------------------------------------------------------------------
  const handleScanXiaomiScale = () => {
    if (isScanningScale) return;

    setIsScanningScale(true);
    Alert.alert('Balança Xiaomi', 'A procurar balança... Suba para a balança agora.');

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Erro no scan BLE:', error);
        setIsScanningScale(false);
        bleManager.stopDeviceScan();
        Alert.alert('Erro BLE', 'Não foi possível ligar ao Bluetooth.');
        return;
      }

      if (device && (device.name?.includes('MI Scale') || device.name?.includes('MIBCO') || device.name?.includes('MIBFS'))) {
        bleManager.stopDeviceScan();
        setIsScanningScale(false);

        Alert.alert('Balança Detetada', `Balança ligada: ${device.name || 'Xiaomi Scale'}`);
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