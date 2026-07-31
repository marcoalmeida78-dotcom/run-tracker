import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';

const bleManager = new BleManager();

export default function XiaomiScaleMenu({ onBack, colors }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scaleData, setScaleData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    return () => {
      bleManager.stopDeviceScan();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  };

  const startScanAndReadScale = async () => {
    setErrorMsg('');
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setErrorMsg('Permissão de Bluetooth/Localização recusada.');
      return;
    }

    setIsScanning(true);

    // Serviço standard de Body Composition da Xiaomi (0x181B / 0x181D)
    bleManager.startDeviceScan(null, null, async (error, device) => {
      if (error) {
        setErrorMsg('Erro ao procurar Bluetooth: ' + error.message);
        setIsScanning(false);
        return;
      }

      // Identifica a balança pelo nome ou pelas Service UUIDs da Xiaomi (Mi Body Composition Scale 2)
      if (device?.name?.includes('MIBCO') || device?.name?.includes('NBody') || device?.serviceUUIDs?.includes('181b')) {
        bleManager.stopDeviceScan();
        
        // Descodifica os dados transmitidos diretamente no pacote de anúncio BLE (ServiceData)
        if (device.serviceData) {
          const rawData = Object.values(device.serviceData)[0];
          if (rawData) {
            parseXiaomiScalePayload(rawData);
          }
        }
        setIsScanning(false);
      }
    });

    // Parar scan automático após 20 segundos se não encontrar
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
    }, 20000);
  };

  // Descodificação dos Bytes da Xiaomi Body Composition 2 (Medição estabilizada, peso e impedância)
  const parseXiaomiScalePayload = async (base64Data) => {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const isStabilized = (buffer[1] & (1 << 5)) !== 0; // Bit de medição finalizada

      if (!isStabilized) return;

      // Leitura do Peso (Bytes 1 e 2 em kg)
      const weightRaw = ((buffer[12] & 0xFF) << 8) | (buffer[11] & 0xFF);
      const weight = (weightRaw / 200).toFixed(1); // Fator de escala da Xiaomi

      // Leitura da Impedância / Bioimpedância (Bytes 9 e 10)
      const impedance = ((buffer[10] & 0xFF) << 8) | (buffer[9] & 0xFF);

      const reading = {
        weight,
        impedance,
        timestamp: new Date().toISOString()
      };

      setScaleData(reading);

      // Atualiza automaticamente o peso no perfil da app para manter a TMB recalculada
      const savedSettings = await AsyncStorage.getItem('@user_settings');
      const parsed = savedSettings ? JSON.parse(savedSettings) : {};
      parsed.weight = weight;
      await AsyncStorage.setItem('@user_settings', JSON.stringify(parsed));

    } catch (e) {
      setErrorMsg('Erro ao processar dados da balança.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors?.background || '#121212' }]}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>← Voltar ao Menu Saúde</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors?.text || '#FFF' }]}>Balança Xiaomi Body Composition 2 ⚖️</Text>

      <TouchableOpacity 
        style={[styles.scanButton, { backgroundColor: isScanning ? '#555' : '#00E676' }]} 
        onPress={startScanAndReadScale} 
        disabled={isScanning}
      >
        <Text style={styles.scanText}>
          {isScanning ? 'A procurar balança por Bluetooth...' : 'Subir para a Balança & Registar'}
        </Text>
      </TouchableOpacity>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      {scaleData && (
        <View style={[styles.resultCard, { backgroundColor: colors?.cardBackground || '#1E1E1E' }]}>
          <Text style={styles.resultTitle}>Leitura Bluetooth Recebida:</Text>
          <Text style={styles.resultItem}>Peso Medido: <Text style={styles.highlight}>{scaleData.weight} kg</Text></Text>
          <Text style={styles.resultItem}>Impedância: <Text style={styles.highlight}>{scaleData.impedance} Ω</Text></Text>
          <Text style={styles.subtext}>O teu peso foi atualizado no perfil e a TMB recalculada!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  backButton: { marginBottom: 16 },
  backText: { color: '#2979FF', fontSize: 16, fontWeight: 'bold' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  scanButton: { padding: 18, borderRadius: 12, alignItems: 'center' },
  scanText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  errorText: { color: '#FF5252', marginTop: 12, textAlign: 'center' },
  resultCard: { padding: 20, borderRadius: 12, marginTop: 20 },
  resultTitle: { color: '#AAA', fontSize: 14, marginBottom: 12 },
  resultItem: { color: '#FFF', fontSize: 18, marginVertical: 6 },
  highlight: { color: '#00E676', fontWeight: 'bold' },
  subtext: { color: '#888', fontSize: 12, marginTop: 10 }
});
