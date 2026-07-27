import { Text, TouchableOpacity, View } from 'react-native';
import { formatHMS } from '../../utils/calculations';

export default function HistoryMenu({ styles, onClose, history, onDeleteHistoryItem }) {
  return (
    <View style={styles.accordionBodyGrid}>
      <View style={styles.submenuHeader}>
        <Text style={styles.submenuHeaderText}>SUBMENU: HISTÓRICO</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.submenuCloseText}>▲ FECHAR</Text>
        </TouchableOpacity>
      </View>

      {history.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum exercício concluído ainda.</Text>
      ) : (
        history.map((item) => (
          <View key={item.id} style={styles.historyCard}>
            <View style={styles.historyHeaderRow}>
              <Text style={styles.historyTitle}>{item.title} - {item.date}</Text>
              <TouchableOpacity onPress={() => onDeleteHistoryItem(item.id)}>
                <Text>🗑️</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.historySub}>Distância: {item.distanceKm} km | Tempo: {formatHMS(item.timeSec)}</Text>
          </View>
        ))
      )}
    </View>
  );
}
