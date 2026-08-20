import { Text, TouchableOpacity, View } from 'react-native';
import { getBestCooperClassification } from '../../utils/cooperTest';

export default function ChallengesMenu({ styles, onClose, onStartExercise, history, profile }) {
  const bestCooper = getBestCooperClassification(history, profile);

  return (
    <View style={styles.accordionBodyGrid}>
      <View style={styles.submenuHeader}>
        <Text style={styles.submenuHeaderText}>SUBMENU: 04 - DESAFIOS</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.submenuCloseText}>▲ FECHAR</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.itemBtn} onPress={() => onStartExercise('run_normal', 'Corrida livre')}>
        <Text style={styles.itemBtnText}>Corrida livre</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.itemBtn} onPress={() => onStartExercise('challenge_cooper', 'Teste de Cooper (12 min)', { targetTimeSec: 720 })}>
        <Text style={styles.itemBtnText}>Teste de Cooper (12 min)</Text>
        {bestCooper && <Text style={styles.itemBtnSubText}>🏅 O teu melhor: {bestCooper.label}</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.itemBtn} onPress={() => onStartExercise('challenge_1.5m', 'Desafio 1,5 Milhas (2400m)', { targetDistKm: 2.4 })}>
        <Text style={styles.itemBtnText}>Desafio 1,5 Milhas (2400m)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.itemBtn} onPress={() => onStartExercise('challenge_1milha', 'Desafio 1 Milha (1609m)', { targetDistKm: 1.609 })}>
        <Text style={styles.itemBtnText}>Desafio 1 Milha (1609m)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.itemBtn} onPress={() => onStartExercise('challenge_morte_subita', 'Desafio Morte Súbita (1000m)', { targetDistKm: 1.0 })}>
        <Text style={styles.itemBtnText}>Desafio Morte Súbita (1000m)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.itemBtn} onPress={() => onStartExercise('challenge_5k30', 'Desafio 5km em 30 Minutos', { targetDistKm: 5.0, targetTimeSec: 1800 })}>
        <Text style={styles.itemBtnText}>Desafio 5km em 30 Minutos</Text>
      </TouchableOpacity>
    </View>
  );
}
