import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { LEAFLET_MAP_HTML } from '../constants/mapHtml';
import { SUDDEN_DEATH_BLOCKS } from '../constants/runProgram';
import { calculateCalories, formatHMS, getCadenceFeedback } from '../utils/calculations';

export default function ActiveExerciseScreen({
  colors,
  styles,
  webviewRef,
  onMapLoadEnd,
  exerciseTitle,
  exerciseType,
  suddenDeathBlock,
  distance,
  timelinePhases,
  currentPhaseIndex,
  phaseTimeLeft,
  seconds,
  speed,
  cadence,
  profile,
  isPaused,
  onTogglePause,
  onCancel,
}) {
  return (
    <ScrollView contentContainerStyle={styles.activeExerciseScroll}>
      <View style={styles.headerContainerActive}>
        <Text style={styles.activeTitle}>{exerciseTitle}</Text>
      </View>

      <View style={styles.mapContainer}>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: LEAFLET_MAP_HTML }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          onLoadEnd={onMapLoadEnd}
        />
      </View>

      {exerciseType === 'challenge_morte_subita' && (
        <View style={styles.rockportProgressCard}>
          <View style={styles.rockportHeaderRow}>
            <Text style={styles.rockportLabel}>BLOCO ATUAL: {suddenDeathBlock} / 10</Text>
            <Text style={styles.rockportValue}>Meta: {suddenDeathBlock * 100} m</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, (distance / (suddenDeathBlock * 0.1)) * 100)}%` }]} />
          </View>
          <View style={styles.recordHighlightBox}>
            <Text style={styles.recordTitle}>TEMPO LIMITE DO BLOCO</Text>
            <Text style={styles.recordValue}>{SUDDEN_DEATH_BLOCKS[suddenDeathBlock - 1]?.timeSec} segundos</Text>
          </View>
        </View>
      )}

      {exerciseType === 'run_program' && timelinePhases.length > 0 && (
        <View style={styles.timelineWrapper}>
          <View style={styles.phaseHeaderRow}>
            <Text style={styles.currentPhaseText}>{timelinePhases[currentPhaseIndex]?.label}</Text>
            <Text style={styles.phaseCountdownText}>{formatHMS(phaseTimeLeft)}</Text>
          </View>
          <View style={styles.segmentedProgressBarContainer}>
            {timelinePhases.map((phase, idx) => {
              const isDone = idx < currentPhaseIndex;
              const isCurrent = idx === currentPhaseIndex;
              const segColor = (isDone || isCurrent) ? colors.COLOR_LIME_ENERGY : colors.COLOR_DIVIDER;
              return (
                <View key={phase.id} style={styles.singlePhaseBarSegmentWrapper}>
                  <View style={[styles.singlePhaseBarSegment, { backgroundColor: segColor }, isCurrent && styles.singlePhaseBarCurrentActive]} />
                  {idx < timelinePhases.length - 1 && <View style={styles.segmentDividerLine} />}
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.bentoGridActive}>
        <View style={styles.bentoCardActive}>
          <Text style={styles.metricLabel}>RITMO (MIN/KM)</Text>
          <Text style={styles.metricValue}>{distance > 0 ? (seconds / 60 / distance).toFixed(2) : '0.00'}</Text>
        </View>
        <View style={styles.bentoCardActive}>
          <Text style={styles.metricLabel}>DISTÂNCIA</Text>
          <Text style={styles.metricValue}>{distance.toFixed(2)} km</Text>
        </View>
        <View style={styles.bentoCardActive}>
          <Text style={styles.metricLabel}>TEMPO TOTAL</Text>
          <Text style={styles.metricValue}>{formatHMS(seconds)}</Text>
        </View>
        <View style={styles.bentoCardActive}>
          <Text style={styles.metricLabel}>CALORIAS</Text>
          <Text style={styles.metricValue}>{calculateCalories(distance, seconds, profile.weight)} kcal</Text>
        </View>
        <View style={styles.bentoCardActive}>
          <Text style={styles.metricLabel}>VELOCIDADE</Text>
          <Text style={styles.metricValue}>{speed} km/h</Text>
        </View>
        <View style={styles.bentoCardActive}>
          <Text style={styles.metricLabel}>CADÊNCIA</Text>
          <Text style={[styles.metricValue, { color: getCadenceFeedback(cadence, exerciseType, colors).color }]}>{cadence} SPM</Text>
        </View>
      </View>

      <View style={styles.activeBtnRow}>
        <TouchableOpacity style={styles.pauseBtn} onPress={onTogglePause}>
          <Text style={styles.pauseBtnText}>{isPaused ? 'RETOMAR' : 'PAUSAR'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>CANCELAR</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
