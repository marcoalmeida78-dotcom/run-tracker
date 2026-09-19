import { Text, TouchableOpacity, View } from 'react-native';
import { getBestCooperClassification } from '../../utils/cooperTest';
import { formatHMS, getBestTimeForTitle } from '../../utils/calculations';

// Ponto (09/2026): o utilizador reparou que o "melhor registo histórico" só
// aparecia no Teste de Cooper. Os outros desafios de corrida são todos de
// distância fixa (o que varia é o tempo a completá-la), por isso "melhor" =
// tempo mais baixo já registado — usa-se getBestTimeForTitle, o mesmo
// mecanismo já usado no ecrã do exercício ativo (ActiveExerciseScreen.js).
export default function ChallengesMenu({ styles, onClose, onStartExercise, history, profile }) {
  const bestCooper = getBestCooperClassification(history, profile);

  const items = [
    { type: 'challenge_1.5m', title: 'Desafio 1,5 Milhas (2400m)', config: { targetDistKm: 2.4 } },
    { type: 'challenge_1milha', title: 'Desafio 1 Milha (1609m)', config: { targetDistKm: 1.609 } },
    { type: 'challenge_morte_subita', title: 'Desafio Morte Súbita (1000m)', config: { targetDistKm: 1.0 } },
    { type: 'challenge_5k30', title: 'Desafio 5km em 30 Minutos', config: { targetDistKm: 5.0, targetTimeSec: 1800 } },
  ];

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

      {items.map(({ type, title, config }) => {
        const bestSec = getBestTimeForTitle(history, title);
        return (
          <TouchableOpacity key={type} style={styles.itemBtn} onPress={() => onStartExercise(type, title, config)}>
            <Text style={styles.itemBtnText}>{title}</Text>
            {bestSec !== null && <Text style={styles.itemBtnSubText}>🏆 O teu melhor: {formatHMS(bestSec)}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
