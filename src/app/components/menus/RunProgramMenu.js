import { Text, TouchableOpacity, View } from 'react-native';
import { RUN_PROGRAM_LEVELS } from '../../constants/runProgram';
import { getBestDistanceForTitle } from '../../utils/calculations';

export default function RunProgramMenu({
  styles,
  onClose,
  currentSessionIndex,
  completedSessions,
  activeLevelAccordion,
  onToggleLevelAccordion,
  onSelectProgramSession,
  history,
}) {
  return (
    <View style={styles.accordionBodyGrid}>
      <View style={styles.submenuHeader}>
        <Text style={styles.submenuHeaderText}>SUBMENU: 03 - 0 AOS 5K</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.submenuCloseText}>▲ FECHAR PLANO</Text>
        </TouchableOpacity>
      </View>

      {RUN_PROGRAM_LEVELS.map((lvl, index) => {
        const currentLevelIndex = Math.floor(currentSessionIndex / 3);
        const isCurrentLevel = index === currentLevelIndex;
        const isOpen = activeLevelAccordion === lvl.id;

        // Quantas das 3 sessões deste nível já foram concluídas — usado para
        // o indicador de progresso no cabeçalho (visível mesmo fechado).
        const levelDoneCount = lvl.sessions.reduce((count, _sess, sIdx) => {
          const globalIdx = index * 3 + sIdx;
          return completedSessions.includes(globalIdx) ? count + 1 : count;
        }, 0);
        const isLevelComplete = levelDoneCount === lvl.sessions.length;

        return (
          <View key={lvl.id} style={[styles.levelCard, isLevelComplete && styles.levelCardComplete]}>
            <TouchableOpacity
              style={[styles.levelHeader, isCurrentLevel && styles.levelHeaderActive]}
              onPress={() => onToggleLevelAccordion(lvl.id)}
            >
              <View style={styles.levelTitleRow}>
                {isCurrentLevel && <View style={styles.currentDot} />}
                <Text style={[styles.levelTitle, isCurrentLevel && styles.levelTitleActiveText]}>
                  {lvl.title} {isCurrentLevel ? '(ATUAL)' : ''}
                </Text>
                <View style={styles.levelProgressRow}>
                  {lvl.sessions.map((_sess, sIdx) => {
                    const globalIdx = index * 3 + sIdx;
                    const done = completedSessions.includes(globalIdx);
                    return <View key={sIdx} style={[styles.levelProgressDot, done && styles.levelProgressDotDone]} />;
                  })}
                </View>
              </View>
              <Text style={styles.levelChevron}>{isOpen ? '▲ FECHAR' : '▼'}</Text>
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.levelDetailsContainer}>
                <Text style={styles.levelSummaryText}>{lvl.summary}</Text>
                <View style={styles.sessionList}>
                  {lvl.sessions.map((sess, sIdx) => {
                    const globalIdx = index * 3 + sIdx;
                    const isRecommendedSess = globalIdx === currentSessionIndex;
                    const isDoneSess = completedSessions.includes(globalIdx);
                    // Maior distância já percorrida nesta sessão em concreto (mesmo título
                    // usado ao guardar o treino — ver launchProgramSession em index.js).
                    // Não é "melhor tempo" porque cada sessão dura sempre o mesmo tempo
                    // fixo — o que varia é a distância percorrida nesse tempo.
                    const sessionTitle = `Corrida: ${lvl.title} - ${sess}`;
                    const bestSessionDistanceKm = getBestDistanceForTitle(history, sessionTitle);
                    return (
                      <View key={sIdx} style={styles.sessBtnColumn}>
                        <TouchableOpacity
                          style={[styles.sessBtn, styles.sessBtnInColumn, isDoneSess && styles.sessBtnDone, isRecommendedSess && styles.sessBtnRecommended]}
                          onPress={() => onSelectProgramSession(globalIdx)}
                        >
                          <Text style={[styles.sessBtnText, isDoneSess && styles.sessBtnTextDone, isRecommendedSess && styles.sessBtnTextRecommended]}>
                            {sess} {isRecommendedSess ? '★' : isDoneSess ? '✓' : ''}
                          </Text>
                        </TouchableOpacity>
                        {bestSessionDistanceKm !== null && (
                          <Text style={styles.sessionBestTimeText}>🏆 {bestSessionDistanceKm.toFixed(2)} km</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
