import { Modal, Text, TouchableOpacity, View } from 'react-native';

// Agrupa todos os modais da aplicação num só sítio.
// Cada modal é controlado por uma prop "visible*" vinda do componente principal.
export default function AppModals({
  colors,
  styles,

  showProfileAlert,
  onCloseProfileAlert,

  showStatusInfoModal,
  onCloseStatusInfoModal,

  showBatteryInfoModal,
  onCloseBatteryInfoModal,

  showBatteryOptimizationModal,
  onOpenBatterySettings,
  onDismissBatteryOptimization,

  showEsquinaModal,
  onContinueEsquinaChallenge,
  onFinishEsquinaChallenge,
}) {
  return (
    <>
      <Modal visible={showProfileAlert} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Aviso de Perfil</Text>
            <Text style={styles.modalText}>Por favor, preencha os dados nas Definições.</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={onCloseProfileAlert}>
              <Text style={styles.modalBtnText}>Compreendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showStatusInfoModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔴 Indicador de Frequência</Text>
            <Text style={styles.modalText}>
              Esta bola reflete a tua consistência nos últimos 7 dias, com base no número de
              exercícios guardados no histórico nesse período:{'\n\n'}
              🟢 Verde — 3 ou mais dias com exercício guardado nos últimos 7 dias.{'\n'}
              🟡 Amarelo — exatamente 2 dias com exercício guardado nos últimos 7 dias.{'\n'}
              🔴 Vermelho — menos de 2 dias com exercício guardado nos últimos 7 dias.
            </Text>
            <TouchableOpacity style={styles.modalBtn} onPress={onCloseStatusInfoModal}>
              <Text style={styles.modalBtnText}>Compreendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBatteryInfoModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔋 Barra de Energia do Plano</Text>
            <Text style={styles.modalText}>Reflete a evolução global das 75 sessões (25 níveis).</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={onCloseBatteryInfoModal}>
              <Text style={styles.modalBtnText}>Compreendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBatteryOptimizationModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔋 Otimização de Bateria</Text>
            <Text style={styles.modalText}>Desative a otimização para evitar que o GPS pare com o ecrã desligado.</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={onOpenBatterySettings}>
              <Text style={styles.modalBtnText}>ABRIR DEFINIÇÕES</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: 'transparent', marginTop: 4 }]} onPress={onDismissBatteryOptimization}>
              <Text style={[styles.modalBtnText, { color: colors.COLOR_PRIMARY }]}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEsquinaModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.esquinaCard}>
            <Text style={styles.esquinaTitle}>🎉 500 Metros Concluídos!</Text>
            <Text style={styles.esquinaText}>Pretendes fazer mais 500 metros?</Text>
            <TouchableOpacity style={styles.esquinaYesBtn} onPress={onContinueEsquinaChallenge}>
              <Text style={styles.esquinaYesBtnText}>SIM, SÓ MAIS 500M! 🏃‍♂️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.esquinaNoBtn} onPress={onFinishEsquinaChallenge}>
              <Text style={styles.esquinaNoBtnText}>CONCLUIR TREINO ✓</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
