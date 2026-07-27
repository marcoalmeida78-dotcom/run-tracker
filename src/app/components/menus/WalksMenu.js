import { Text, TouchableOpacity, View } from 'react-native';

export default function WalksMenu({ styles, onClose, onStartExercise }) {
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

      <TouchableOpacity style={styles.itemBtn} onPress={() => onStartExercise('walk_rockport', 'Desafio Rockport (1609m)', { targetDistKm: 1.609 })}>
        <Text style={styles.itemBtnText}>Desafio Rockport (1609m)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.itemBtn} onPress={() => onStartExercise('walk_10m', 'Desafio 10 Minutos', { targetTimeSec: 600 })}>
        <Text style={styles.itemBtnText}>Desafio 10 Minutos</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.itemBtn} onPress={() => onStartExercise('walk_esquina', 'Só até à Esquina (500m)', { targetDistKm: 0.5 })}>
        <Text style={styles.itemBtnText}>Desafio Só até à Esquina (500m)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.itemBtn} onPress={() => onStartExercise('walk_2km', 'Desafio 2km sem olhar para o telemóvel', { targetDistKm: 2.0 })}>
        <Text style={styles.itemBtnText}>Desafio 2km sem olhar para o telemóvel</Text>
      </TouchableOpacity>
    </View>
  );
}
