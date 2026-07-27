import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RUN_PROGRAM_LEVELS } from '../constants/runProgram';
import WalksMenu from './menus/WalksMenu';
import RunProgramMenu from './menus/RunProgramMenu';
import ChallengesMenu from './menus/ChallengesMenu';
import SettingsMenu from './menus/SettingsMenu';
import HistoryMenu from './menus/HistoryMenu';

export default function MainScreen({
  colors,
  styles,

  currentSessionIndex,
  workoutsLast7Days,
  onShowStatusInfo,
  onSelectProgramSession,

  activeMenu,
  onToggleAccordion,

  activeLevelAccordion,
  onToggleLevelAccordion,
  completedSessions,

  onStartExercise,

  currentTheme,
  onChangeTheme,
  profile,
  onSaveProfile,
  onResetAllData,

  history,
  onDeleteHistoryItem,

  onShowBatteryInfo,
}) {
  const recommendedLevel = RUN_PROGRAM_LEVELS[Math.floor(currentSessionIndex / 3)];

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.appHeaderTitle}>ZERO AOS 5K</Text>

      {/* --- CARTÃO DE SESSÃO RECOMENDADA --- */}
      <View style={styles.bentoHeroCardPrimary}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeftRow}>
            <Text style={styles.tileNumberLight}>01</Text>
            <Text style={styles.cardHeaderTitleLight}>SESSÃO RECOMENDADA</Text>
          </View>
          <TouchableOpacity style={styles.statusDotTouchable} onPress={onShowStatusInfo}>
            <View style={[styles.statusDotDark, { backgroundColor: workoutsLast7Days > 0 ? colors.COLOR_LIME_ENERGY : colors.COLOR_RED_ACCENT }]} />
          </TouchableOpacity>
        </View>
        <Text style={styles.recommendationTextLight}>
          {recommendedLevel?.title} - {recommendedLevel?.sessions[currentSessionIndex % 3]}
        </Text>
        <TouchableOpacity style={styles.actionBtnLight} onPress={() => onSelectProgramSession(currentSessionIndex)}>
          <Text style={styles.actionBtnTextDark}>INICIAR CORRIDA ➔</Text>
        </TouchableOpacity>
      </View>

      {/* --- PAR DE MENUS: CAMINHADAS / 0 AOS 5K ---
          Este par fica sempre em linha (bentoRow), esteja um menu aberto ou não,
          para que os cartões não mudem de posição ao expandir. */}
      <View style={styles.bentoRow}>
        <TouchableOpacity
          style={[styles.bentoTileSage, activeMenu === 'caminhadas' && styles.activeBentoTileHighlight]}
          onPress={() => onToggleAccordion('caminhadas')}
        >
          <Text style={styles.tileNumberPrimary}>02</Text>
          <Text style={styles.tileTitleDark}>CAMINHADAS</Text>
          <Text style={styles.tileSubDark}>Explorar variações e desafios</Text>
          <Text style={styles.tileActionTextDark}>{activeMenu === 'caminhadas' ? '▲ Fechar' : 'Ver opções ▼'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bentoTileSecondary, activeMenu === 'corrida' && styles.activeBentoTileHighlight]}
          onPress={() => onToggleAccordion('corrida')}
        >
          <Text style={styles.tileNumberLight}>03</Text>
          <Text style={styles.tileTitleLight}>0 AOS 5K</Text>
          <Text style={styles.tileSubLight}>Plano de 25 níveis e 75 sessões</Text>
          <Text style={styles.tileActionTextLight}>{activeMenu === 'corrida' ? '▲ Fechar' : 'Ver plano ▼'}</Text>
        </TouchableOpacity>
      </View>

      {activeMenu === 'caminhadas' && (
        <WalksMenu styles={styles} onClose={() => onToggleAccordion('caminhadas')} onStartExercise={onStartExercise} />
      )}

      {activeMenu === 'corrida' && (
        <RunProgramMenu
          styles={styles}
          onClose={() => onToggleAccordion('corrida')}
          currentSessionIndex={currentSessionIndex}
          completedSessions={completedSessions}
          activeLevelAccordion={activeLevelAccordion}
          onToggleLevelAccordion={onToggleLevelAccordion}
          onSelectProgramSession={onSelectProgramSession}
        />
      )}

      {/* --- PAR DE MENUS: DESAFIOS / DEFINIÇÕES --- */}
      <View style={styles.bentoRow}>
        <TouchableOpacity
          style={[styles.bentoTileSecondary, activeMenu === 'desafios' && styles.activeBentoTileHighlight]}
          onPress={() => onToggleAccordion('desafios')}
        >
          <Text style={styles.tileNumberLight}>04</Text>
          <Text style={styles.tileTitleLight}>DESAFIOS</Text>
          <Text style={styles.tileSubLight}>Cooper, 1.5 Milhas, Morte Súbita...</Text>
          <Text style={styles.tileActionTextLight}>{activeMenu === 'desafios' ? '▲ Fechar' : 'Abrir ▼'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bentoTileSage, activeMenu === 'def' && styles.activeBentoTileHighlight]}
          onPress={() => onToggleAccordion('def')}
        >
          <Text style={styles.tileNumberPrimary}>05</Text>
          <Text style={styles.tileTitleDark}>DEFINIÇÕES</Text>
          <Text style={styles.tileSubDark}>configurações e dados de perfil</Text>
          <Text style={styles.tileActionTextDark}>{activeMenu === 'def' ? '▲ Fechar' : 'Configurar ▼'}</Text>
        </TouchableOpacity>
      </View>

      {activeMenu === 'desafios' && (
        <ChallengesMenu styles={styles} onClose={() => onToggleAccordion('desafios')} onStartExercise={onStartExercise} />
      )}

      {activeMenu === 'def' && (
        <SettingsMenu
          styles={styles}
          onClose={() => onToggleAccordion('def')}
          currentTheme={currentTheme}
          onChangeTheme={onChangeTheme}
          profile={profile}
          onSaveProfile={onSaveProfile}
          onResetAllData={onResetAllData}
        />
      )}

      {/* --- HISTÓRICO --- */}
      <TouchableOpacity
        style={[styles.bentoHeroBottom, activeMenu === 'historico' && styles.activeBentoTileHighlight]}
        onPress={() => onToggleAccordion('historico')}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitleDark}>HISTÓRICO DE EXERCÍCIOS</Text>
          <Text style={styles.accordionIcon}>{activeMenu === 'historico' ? '▲ FECHAR' : '▼ VER'}</Text>
        </View>
        <Text style={styles.recommendationTextDark}>{history.length} treinos registados no total</Text>
      </TouchableOpacity>

      {activeMenu === 'historico' && (
        <HistoryMenu styles={styles} onClose={() => onToggleAccordion('historico')} history={history} onDeleteHistoryItem={onDeleteHistoryItem} />
      )}

      {/* --- BARRA DE ENERGIA DO PLANO --- */}
      <TouchableOpacity style={styles.batterySectionTouchable} onPress={onShowBatteryInfo}>
        <View style={styles.batteryTitleRow}>
          <Text style={styles.batterySectionTitle}>BARRA DE ENERGIA DO PLANO (75 SESSÕES)</Text>
        </View>
        <View style={styles.batteryContainer}>
          <View style={styles.batterySubGrid}>
            {Array.from({ length: 75 }).map((_, idx) => (
              <View key={idx} style={[styles.batterySegmentSlim, { backgroundColor: completedSessions.includes(idx) ? colors.COLOR_LIME_ENERGY : colors.COLOR_DIVIDER }]} />
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}
