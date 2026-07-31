import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateBMR, fetchRealGoogleFitSessions, deduplicateAndCalculateTotalCalories } from '../../utils/healthCalculations';

export default function HealthMenu({ onNavigateToScale, colors }) {
  const [bmr, setBmr] = useState(0);
  const [activeCalories, setActiveCalories] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    setLoading(true);
    try {
      // 1. Carregar perfil do utilizador
      const savedSettings = await AsyncStorage.getItem('@user_settings');
      let weight = 70, height = 175, age = 30, gender = 'male';

      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        weight = parsed.weight || weight;
        height = parsed.height || height;
        age = parsed.age || age;
        gender = parsed.gender || gender;
      }

      const calculatedBMR = calculateBMR(weight, height, age, gender);
      setBmr(calculatedBMR);

      // 2. Carregar treinos da própria App de Corrida
      const savedHistory = await AsyncStorage.getItem('@run_history');
      const appRuns = savedHistory ? JSON.parse(savedHistory) : [];

      // 3. Obter treinos REAIS do Google Fit / Health Connect
      const googleFitData = await fetchRealGoogleFitSessions();

      // 4. Aplicar desduplicação e subtração de calorias basais
      const netActive = deduplicateAndCalculateTotalCalories(googleFitData, appRuns, calculatedBMR);
      setActiveCalories(netActive);

    } catch (e) {
      console.error('Erro ao calcular métricas reais de saúde:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors?.background || '#121212' }]}>
      <Text style={[styles.title, { color: colors?.text || '#FFF' }]}>Saúde & Metabolismo 🏥</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#00E676" style={{ marginVertical: 30 }} />
      ) : (
        <View style={[styles.card, { backgroundColor: colors?.cardBackground || '#1E1E1E' }]}>
          <Text style={styles.cardTitle}>🔥 Taxa Metabólica Basal (TMB)</Text>
          <Text style={styles.metricValue}>{bmr} <Text style={styles.unit}>kcal/dia</Text></Text>
          <Text style={styles.subtext}>Fórmula Mifflin-St Jeor (Energia em repouso).</Text>

          <View style={styles.divider} />

          <Text style={styles.cardTitle}>🏃‍♂️ Calorias Ativas Líquidas (Hoje)</Text>
          <Text style={styles.metricValue}>{activeCalories} <Text style={styles.unit}>kcal</Text></Text>
          <Text style={styles.subtext}>Obtidas via Google Fit + App de corrida sem dupla contagem.</Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: colors?.accent || '#2979FF' }]} 
        onPress={onNavigateToScale}
      >
        <Text style={styles.buttonText}>⚖️ Ler Balança Xiaomi Body Composition 2</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  card: { padding: 20, borderRadius: 12, marginBottom: 16 },
  cardTitle: { fontSize: 14, color: '#AAA', marginBottom: 6 },
  metricValue: { fontSize: 32, fontWeight: 'bold', color: '#00E676' },
  unit: { fontSize: 16, color: '#FFF' },
  subtext: { fontSize: 12, color: '#888', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 16 },
  button: { padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
