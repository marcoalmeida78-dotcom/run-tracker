import { Text, TouchableOpacity, View } from 'react-native';
import { RUN_PROGRAM_LEVELS } from '../../constants/runProgram';

export default function RunProgramMenu({
  styles,
  onClose,
  currentSessionIndex,
  completedSessions,
  activeLevelAccordion,
  onToggleLevelAccordion,
  onSelectProgramSession,
  skipWarmup,
  onToggleSkipWarmup,
  skipCooldown,
  onToggleSkipCooldown,
}) {
  return (
    <View style={styles.accordionBodyGrid}>
      <View style={styles.submenuHeader}>
        <Text style={styles.submenuHeaderText}>SUBMENU: 03 - 0 AOS 5K</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.submenuCloseText}>▲ FECHAR PLANO</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.skipOptionsRow}>
        <TouchableOpacity
          style={[styles.skipOptionBtn, skipWarmup && styles.skipOptionBtnActive]}
          onPress={onToggleSkipWarmup}
        >
          <Text style={[styles.skipOptionText, skipWarmup && styles.skipOptionTextActive]}>
            {skipWarmup ? '✓ ' : ''}Saltar aquecimento
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.skipOptionBtn, skipCooldown && styles.skipOptionBtnActive, { marginRight: 0 }]}
          onPress={onToggleSkipCooldown}
        >
          <Text style={[styles.skipOptionText, skipCooldown && styles.skipOptionTextActive]}>
            {skipCooldown ? '✓ ' : ''}Saltar arrefecimento
          </Text>
        </TouchableOpacity>
      </View>

      {RUN_PROGRAM_LEVELS.map((lvl, index) => {
        const currentLevelIndex = Math.floor(currentSessionIndex / 3);
        const isCurrentLevel = index === currentLevelIndex;
        const isOpen = activeLevelAccordion === lvl.id;

        return (
          <View key={lvl.id} style={styles.levelCard}>
            <TouchableOpacity
              style={[styles.levelHeader, isCurrentLevel && styles.levelHeaderActive]}
              onPress={() => onToggleLevelAccordion(lvl.id)}
            >
              <View style={styles.levelTitleRow}>
                {isCurrentLevel && <View style={styles.currentDot} />}
                <Text style={[styles.levelTitle, isCurrentLevel && styles.levelTitleActiveText]}>
                  {lvl.title} {isCurrentLevel ? '(ATUAL)' : ''}
                </Text>
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
                    return (
                      <TouchableOpacity
                        key={sIdx}
                        style={[styles.sessBtn, isDoneSess && styles.sessBtnDone, isRecommendedSess && styles.sessBtnRecommended]}
                        onPress={() => onSelectProgramSession(globalIdx)}
                      >
                        <Text style={[styles.sessBtnText, isDoneSess && styles.sessBtnTextDone, isRecommendedSess && styles.sessBtnTextRecommended]}>
                          {sess} {isRecommendedSess ? '★' : isDoneSess ? '✓' : ''}
                        </Text>
                      </TouchableOpacity>
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
