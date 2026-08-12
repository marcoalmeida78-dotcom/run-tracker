import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RUN_PROGRAM_LEVELS } from '../constants/runProgram';
import ChallengesMenu from './menus/ChallengesMenu';
import HistoryMenu from './menus/HistoryMenu';
import RunProgramMenu from './menus/RunProgramMenu';
import SettingsMenu from './menus/SettingsMenu';
import WalksMenu from './menus/WalksMenu';

export default function MainScreen({
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
  onExportBackup,
  onImportBackup,
  healthSyncEnabled,
  onToggleHealthSync,

  history,
  onDeleteHistoryItem,

  onShowBatteryInfo,
  fogOpacity,
  onChangeFogOpacity,
}) {
  const recommendedLevel = RUN_PROGRAM_LEVELS[Math.floor(currentSessionIndex / 3)];

  // Ponto 4: Determinar a cor exata da bola de status (3 -> verde, 2 -> amarelo, <2 -> vermelho)
  const getStatusDotColor = () => {
    if (workoutsLast7Days >= 3) return '#22c55e'; // Verde
    if (workoutsLast7Days === 2) return '#eab308'; // Amarelo
    return '#ef4444'; // Vermelho
  };

  // Título sempre com cor branca fixa (independente do tema ativo).
  const titleColor = '#ffffff';

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Ponto 7: Título com cor fixa de vidro branco */}
      <Text style={[styles.appHeaderTitle, { color: titleColor }]}>ZERO AOS 5K</Text>

      {/* --- CARTÃO DE SESSÃO RECOMENDADA --- */}
      <View style={styles.bentoHeroCardPrimary}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeftRow}>
            <Text style={styles.tileNumberLight}>01</Text>
            <Text style={styles.cardHeaderTitleLight}>SESSÃO RECOMENDADA</Text>
          </View>
          
          {/* Ponto 4: Bola do topo com lógica de cores fixa nos últimos 7 dias */}
          <TouchableOpacity style={styles.statusDotTouchable} onPress={onShowStatusInfo}>
            <View style={[styles.statusDotDark, { backgroundColor: getStatusDotColor() }]} />
          </TouchableOpacity>
        </View>
        <Text style={styles.recommendationTextLight}>
          {recommendedLevel?.title} - {recommendedLevel?.sessions[currentSessionIndex % 3]}
        </Text>
        <TouchableOpacity style={styles.actionBtnLight} onPress={() => onSelectProgramSession(currentSessionIndex)}>
          <Text style={styles.actionBtnTextDark}>INICIAR CORRIDA ➔</Text>
        </TouchableOpacity>
      </View>

      {/* --- PAR DE MENUS: CAMINHADAS / 0 AOS 5K --- */}
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
          history={history}
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
        <ChallengesMenu
          styles={styles}
          onClose={() => onToggleAccordion('desafios')}
          onStartExercise={onStartExercise}
          history={history}
          profile={profile}
        />
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
          onExportBackup={onExportBackup}
          onImportBackup={onImportBackup}
          healthSyncEnabled={healthSyncEnabled}
          onToggleHealthSync={onToggleHealthSync}
          fogOpacity={fogOpacity}
          onChangeFogOpacity={onChangeFogOpacity}
        />
      )}

      {/* --- HISTÓRICO --- */}
      <TouchableOpacity
        style={[styles.bentoHeroBottom, activeMenu === 'historico' && styles.activeBentoTileHighlight]}
        onPress={() => onToggleAccordion('historico')}
      >
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.tileNumberPrimary}>06</Text>
            <Text style={styles.cardHeaderTitleDark}>HISTÓRICO DE EXERCÍCIOS</Text>
          </View>
          <Text style={styles.accordionIcon}>{activeMenu === 'historico' ? '▲ FECHAR' : '▼ VER'}</Text>
        </View>
        <Text style={styles.recommendationTextDark}>{history.length} treinos registados no total</Text>
      </TouchableOpacity>

      {activeMenu === 'historico' && (
        <HistoryMenu
          styles={styles}
          onClose={() => onToggleAccordion('historico')}
          history={history}
          onDeleteHistoryItem={onDeleteHistoryItem}
        />
      )}

      {/* --- BARRA DE ENERGIA DO PLANO --- */}
      <TouchableOpacity style={styles.batterySectionTouchable} onPress={onShowBatteryInfo}>
        <View style={styles.batteryTitleRow}>
          <Text style={styles.tileNumberPrimary}>07</Text>
          <Text style={styles.batterySectionTitle}>BARRA DE ENERGIA DO PLANO (75 SESSÕES)</Text>
        </View>
        <View style={styles.batteryContainer}>
          <View style={styles.batteryBody}>
            <View style={styles.batteryTrack}>
              {/* Ponto 6: Barra pintada sempre de cor verde limão com opacidade 0.8 */}
              <View 
                style={[
                  styles.batteryFill, 
                  { 
                    width: `${(completedSessions.length / 75) * 100}%`,
                    backgroundColor: '#a3e635', 
                    opacity: 0.8 
                  }
                ]} 
              />
            </View>
          </View>
          <View style={styles.batteryTerminal} />
        </View>
        <Text style={styles.batteryCountText}>{completedSessions.length} / 75 sessões concluídas</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
