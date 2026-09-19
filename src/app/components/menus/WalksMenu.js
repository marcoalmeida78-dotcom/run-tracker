import { Text, TouchableOpacity, View } from 'react-native';
import { formatHMS, getBestDistanceForTitle, getBestTimeForTitle } from '../../utils/calculations';

// Ponto (09/2026): o utilizador reparou que o "melhor registo histórico" só
// aparecia no Teste de Cooper, em nenhum outro desafio de caminhada ou de
// corrida. Cada desafio tem um alvo diferente — ou é uma distância fixa (o
// que varia é o tempo a completá-la, por isso "melhor" = tempo mais baixo)
// ou é um tempo fixo (o que varia é a distância percorrida nesse tempo, por
// isso "melhor" = distância mais alta). "Caminhada livre" não tem alvo
// nenhum, por isso não mostra nada — tal como "Corrida livre" em
// ChallengesMenu.js.
const WALK_RECORD_KIND = {
  walk_rockport: 'time',
  walk_10m: 'distance',
  walk_esquina: 'distance',
  walk_2km: 'time',
};

function getBestLabel(history, title, kind) {
  if (kind === 'distance') {
    const bestKm = getBestDistanceForTitle(history, title);
    return bestKm !== null ? `🏆 O teu melhor: ${bestKm.toFixed(2)} km` : null;
  }
  const bestSec = getBestTimeForTitle(history, title);
  return bestSec !== null ? `🏆 O teu melhor: ${formatHMS(bestSec)}` : null;
}

export default function WalksMenu({ styles, onClose, onStartExercise, history }) {
  // "label" é o texto do botão (igual ao que já existia); "title" é o texto
  // exato gravado no histórico de cada exercício (usado por onStartExercise
  // e para procurar o melhor registo) — nem sempre são o mesmo texto (ex:
  // "Esquina", em que o botão diz "Desafio Só até..." mas o título gravado
  // é só "Só até...").
  const items = [
    { type: 'walk_rockport', label: 'Desafio Rockport (1609m)', title: 'Desafio Rockport (1609m)', config: { targetDistKm: 1.609 } },
    { type: 'walk_10m', label: 'Desafio 10 Minutos', title: 'Desafio 10 Minutos', config: { targetTimeSec: 600 } },
    { type: 'walk_esquina', label: 'Desafio Só até à Esquina (500m)', title: 'Só até à Esquina (500m)', config: { targetDistKm: 0.5 } },
    { type: 'walk_2km', label: 'Desafio 2km sem olhar para o telemóvel', title: 'Desafio 2km sem olhar para o telemóvel', config: { targetDistKm: 2.0 } },
  ];

  return (
    <View style={styles.accordionBodyGrid}>
      <View style={styles.submenuHeader}>
        <Text style={styles.submenuHeaderText}>SUBMENU: 02 - CAMINHADAS</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.submenuCloseText}>▲ FECHAR</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.itemBtn} onPress={() => onStartExercise('walk_normal', 'Caminhada livre')}>
        <Text style={styles.itemBtnText}>Caminhada livre</Text>
      </TouchableOpacity>

      {items.map(({ type, label, title, config }) => {
        const bestLabel = getBestLabel(history, title, WALK_RECORD_KIND[type]);
        return (
          <TouchableOpacity key={type} style={styles.itemBtn} onPress={() => onStartExercise(type, title, config)}>
            <Text style={styles.itemBtnText}>{label}</Text>
            {bestLabel && <Text style={styles.itemBtnSubText}>{bestLabel}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
