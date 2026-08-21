import { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getLeafletMapHtml } from '../constants/mapHtml';
import { LIME_GREEN } from '../constants/mapColors';
import { SUDDEN_DEATH_BLOCKS } from '../constants/runProgram';
import { calculateCalories, calculatePace, formatHMS } from '../utils/calculations';

export default function ActiveExerciseScreen({
  colors,
  styles,
  webviewRef,
  onMapLoadEnd,
  exerciseTitle,
  exerciseType,
  suddenDeathBlock,
  suddenDeathBlockSecondsLeft,
  suddenDeathBlockProgressM,
  distance,
  timelinePhases,
  currentPhaseIndex,
  phaseTimeLeft,
  seconds,
  speed,
  profile,
  activeConfig,
  isPaused,
  onTogglePause,
  onFinishUser,
  onCancel,
  onSkipPhase,
  noSignalAlert,
  bestTimeSec,
  bestCooperClassification,
}) {
  // O traço/bola do mapa é sempre verde-lima, fixo — não segue o esquema de
  // cores da app (pedido explícito, para se destacar sempre sobre o mapa).
  // Continua memoizado porque este ecrã re-renderiza a cada segundo/
  // atualização de GPS durante o exercício, e o HTML do WebView não precisa
  // de ser recriado a cada render.
  const mapHtml = useMemo(() => getLeafletMapHtml(LIME_GREEN), []);

  return (
    <ScrollView contentContainerStyle={styles.activeExerciseScroll}>
      {/* Ponto 5: Aviso de Falta de GPS / Rede no topo do menu ativo */}
      {noSignalAlert && (
        <View style={{ backgroundColor: '#ef4444', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', textAlign: 'center' }}>
            ⚠️ Sem sinal de GPS ou de Rede Móvel. Aguarde ou volte ao menu anterior.
          </Text>
        </View>
      )}

      <View style={styles.headerContainerActive}>
        <Text style={styles.activeTitle}>{exerciseTitle}</Text>
        {/* Teste de Cooper: os 12 min são fixos, por isso "melhor tempo" não
            faz sentido aqui — mostra antes a melhor classificação alcançada. */}
        {exerciseType === 'challenge_cooper' ? (
          <Text style={styles.bestTimeText}>
            {bestCooperClassification
              ? <>🏅 O teu melhor: <Text style={styles.bestTimeHighlight}>{bestCooperClassification.label}</Text></>
              : 'Ainda não tens uma classificação registada neste teste.'}
          </Text>
        ) : (
          exerciseType !== 'run_program' && (
            <Text style={styles.bestTimeText}>
              {bestTimeSec !== null && bestTimeSec !== undefined
                ? <>🏆 Melhor tempo: <Text style={styles.bestTimeHighlight}>{formatHMS(bestTimeSec)}</Text></>
                : 'Ainda não tens um melhor tempo registado para este exercício.'}
            </Text>
          )
        )}
      </View>

      <View style={styles.mapContainer}>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          onLoadEnd={onMapLoadEnd}
        />
      </View>

      {/* Card Morte Súbita — a distância de cada bloco vem sempre de
          constants/runProgram.js (não fixa aqui), para se a alterares nesse
          ficheiro (distKm) a barra e os valores mostrados ajustarem-se
          sozinhos. O progresso em si (suddenDeathBlockProgressM) já vem
          calculado corretamente por bloco a partir do index.js. */}
      {exerciseType === 'challenge_morte_subita' && (() => {
        const currentBlockTargetM = Math.round((SUDDEN_DEATH_BLOCKS[suddenDeathBlock - 1]?.distKm ?? 0.1) * 1000);
        return (
          <View style={styles.rockportProgressCard}>
            <View style={styles.rockportHeaderRow}>
              <Text style={styles.rockportLabel}>BLOCO ATUAL: {suddenDeathBlock} / {SUDDEN_DEATH_BLOCKS.length}</Text>
              <Text style={styles.rockportValue}>{suddenDeathBlockProgressM ?? 0} / {currentBlockTargetM} m</Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${Math.min(100, ((suddenDeathBlockProgressM ?? 0) / currentBlockTargetM) * 100)}%` }]} />
            </View>
          <View style={styles.recordHighlightBox}>
            <Text style={styles.recordTitle}>CONTAGEM DECRESCENTE DO BLOCO</Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: 'bold',
                color: '#ef4444',
                textAlign: 'center',
                marginTop: 4,
                textShadowColor: 'rgba(255,255,255,0.6)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }}
            >
              {formatHMS(suddenDeathBlockSecondsLeft ?? 0)}
            </Text>
          </View>
        </View>
        );
      })()}

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

          {/* Saltar aquecimento/arrefecimento EM DIRETO, sem cancelar a sessão */}
          {(timelinePhases[currentPhaseIndex]?.type === 'warmup' || timelinePhases[currentPhaseIndex]?.type === 'cooldown') && (
            <TouchableOpacity style={styles.skipPhaseBtn} onPress={onSkipPhase}>
              <Text style={styles.skipPhaseBtnText}>
                {timelinePhases[currentPhaseIndex]?.type === 'warmup' ? 'SALTAR AQUECIMENTO ▶' : 'SALTAR ARREFECIMENTO ▶'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.bentoGridActive}>
        <View style={styles.bentoCardActive}>
          <Text style={styles.metricLabel}>RITMO (MIN/KM)</Text>
          <Text style={styles.metricValue}>{calculatePace(distance, seconds) ?? '--'}</Text>
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
        {/* Ponto 1: Botão Terminar e Guardar ocupa o espaço que era da Cadência.
            Existe em todos os exercícios, exceto nas sessões do plano 0 aos 5K (75 sessões). */}
        {exerciseType !== 'run_program' && (
          <TouchableOpacity style={[styles.bentoCardActive, styles.bentoFinishCard]} onPress={onFinishUser}>
            <Text style={styles.bentoFinishCardText}>TERMINAR{'\n'}E GUARDAR</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Botões de Ação do Exercício */}
      <View style={{ gap: 10, marginTop: 15, width: '100%' }}>
        <View style={styles.activeBtnRow}>
          <TouchableOpacity style={styles.pauseBtn} onPress={onTogglePause}>
            <Text style={styles.pauseBtnText}>{isPaused ? 'RETOMAR' : 'PAUSAR'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>CANCELAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}