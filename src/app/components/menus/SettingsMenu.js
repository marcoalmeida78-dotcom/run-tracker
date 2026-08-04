import { useEffect, useRef, useState } from 'react';
import { Alert, PanResponder, Share, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { THEMES } from '../../constants/themes';
import { clearDebugLog, formatDebugLogAsText, getDebugLog } from '../../utils/debugLog';

// Slider simples (sem dependências externas) para ajustar a opacidade do
// "nevoeiro" sobre a imagem de fundo. Arrasta-se o polegar ou toca-se
// diretamente na barra para definir o valor (0 a 1).
function OpacitySlider({ styles, value, onChange }) {
  // Importante: o PanResponder só é criado UMA VEZ (useRef). Por isso não pode
  // ler diretamente de useState (isso ficaria "preso" no valor do 1º render, que é
  // sempre 0 antes do onLayout correr) — tem de ler sempre de refs, cujo .current
  // é sempre o valor mais recente, mesmo dentro de um closure criado há muito tempo.
  const trackRef = useRef(null);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Usa coordenadas absolutas do ecrã (pageX) em vez de locationX. O locationX é
  // relativo ao elemento exato que é tocado — se tocares em cima da bola (que é uma
  // vista mais pequena por cima da barra), o valor passa a ser relativo À BOLA e não
  // à barra toda, o que fazia "saltar" sempre para perto do zero. Com pageX + a posição
  // medida da barra, o cálculo é sempre o mesmo, seja onde for que toques.
  const updateFromPageX = (pageX) => {
    const width = trackWidthRef.current;
    if (width <= 0) return;
    const localX = pageX - trackPageXRef.current;
    const ratio = Math.max(0, Math.min(1, localX / width));
    onChangeRef.current(ratio);
  };

  const measureTrack = () => {
    trackRef.current?.measure((x, y, width, height, pageX) => {
      trackWidthRef.current = width;
      trackPageXRef.current = pageX;
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      // Só "rouba" o gesto ao ScrollView à volta quando o arrasto é claramente horizontal,
      // para não impedir o scroll vertical normal do menu de Definições.
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderGrant: (evt, gestureState) => updateFromPageX(gestureState.x0),
      onPanResponderMove: (evt, gestureState) => updateFromPageX(gestureState.moveX),
    })
  ).current;

  return (
    <View
      ref={trackRef}
      style={styles.sliderTrackWrapper}
      onLayout={measureTrack}
      {...panResponder.panHandlers}
    >
      <View style={styles.sliderTrackBg} pointerEvents="none">
        <View style={[styles.sliderTrackFill, { width: `${value * 100}%` }]} />
      </View>
      <View style={[styles.sliderThumb, { left: `${value * 100}%` }]} pointerEvents="none" />
    </View>
  );
}

// Secção de diagnóstico: mostra o registo interno de eventos/erros (ex: balança
// Xiaomi, Google Fit) para que possa ser copiado e partilhado ao pedir ajuda.
// É totalmente isolada — não lê nem escreve em nenhum outro estado da app.
function DebugReportSection({ styles }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadLog = async () => {
    setLoading(true);
    const log = await getDebugLog();
    setEntries(log);
    setLoading(false);
  };

  useEffect(() => {
    loadLog();
  }, []);

  const handleShare = async () => {
    const text = formatDebugLogAsText(entries);
    try {
      await Share.share({ message: text });
    } catch (e) {}
  };

  const handleClear = () => {
    Alert.alert('Limpar Registo', 'Tem a certeza que deseja apagar todo o relatório de diagnóstico?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar',
        style: 'destructive',
        onPress: async () => {
          await clearDebugLog();
          setEntries([]);
        },
      },
    ]);
  };

  return (
    <>
      <View style={styles.divider} />
      <Text style={styles.sectionSubTitle}>RELATÓRIO DE ERROS E DIAGNÓSTICO</Text>
      <Text style={styles.tileSubDark}>
        Regista automaticamente o que se passa em funcionalidades como a balança Xiaomi e o Google
        Fit, para ajudar a perceber falhas. Usa "Partilhar" para enviar o texto.
      </Text>

      <TouchableOpacity style={styles.itemBtn} onPress={() => { setExpanded(!expanded); if (!expanded) loadLog(); }}>
        <Text style={styles.itemBtnText}>
          {expanded ? '▲ Esconder' : '▼ Ver'} registo ({loading ? '...' : entries.length} eventos)
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.accordionBodyGrid}>
          <Text style={{ color: styles.itemBtnText?.color, fontSize: 11, lineHeight: 16 }}>
            {formatDebugLogAsText(entries)}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
        <TouchableOpacity style={[styles.itemBtn, { flex: 1, marginBottom: 0 }]} onPress={loadLog}>
          <Text style={styles.itemBtnText}>🔄 Atualizar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.itemBtn, { flex: 1, marginBottom: 0 }]} onPress={handleShare}>
          <Text style={styles.itemBtnText}>📤 Partilhar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.itemBtn, { flex: 1, marginBottom: 0 }]} onPress={handleClear}>
          <Text style={styles.itemBtnText}>🗑️ Limpar</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

export default function SettingsMenu({
  styles,
  onClose,
  currentTheme,
  onChangeTheme,
  profile,
  onSaveProfile,
  onResetAllData,
  fogOpacity,
  onChangeFogOpacity,
}) {
  return (
    <View style={styles.accordionBodyGrid}>
      <View style={styles.submenuHeader}>
        <Text style={styles.submenuHeaderText}>SUBMENU: 05 - DEFINIÇÕES</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.submenuCloseText}>▲ FECHAR</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionSubTitle}>ESQUEMA DE CORES</Text>
      <View style={styles.themeSelectorContainer}>
        {Object.keys(THEMES).map((themeKey) => {
          const isSelected = currentTheme === themeKey;
          const themeItem = THEMES[themeKey];
          return (
            <TouchableOpacity
              key={themeKey}
              style={[styles.themeBtn, isSelected && styles.themeBtnActive]}
              onPress={() => onChangeTheme(themeKey)}
            >
              <Text style={[styles.themeBtnText, isSelected && styles.themeBtnTextActive]}>
                {themeItem.name} {isSelected ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionSubTitle}>OPACIDADE DO FUNDO (NEVOEIRO)</Text>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.inputLabel}>Imagem visível</Text>
        <Text style={styles.sliderValueText}>{Math.round(fogOpacity * 100)}%</Text>
        <Text style={styles.inputLabel}>Nevoeiro total</Text>
      </View>
      <OpacitySlider styles={styles} value={fogOpacity} onChange={onChangeFogOpacity} />

      <View style={styles.divider} />
      <Text style={styles.sectionSubTitle}>PERFIL DO UTILIZADOR</Text>

      <Text style={styles.inputLabel}>Peso (kg):</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={profile.weight}
        onChangeText={(val) => onSaveProfile({ ...profile, weight: val })}
      />

      <Text style={styles.inputLabel}>Altura (cm):</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={profile.height}
        onChangeText={(val) => onSaveProfile({ ...profile, height: val })}
      />

      <Text style={styles.inputLabel}>Idade (anos):</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={profile.age}
        onChangeText={(val) => onSaveProfile({ ...profile, age: val })}
      />

      <Text style={styles.inputLabel}>Género:</Text>
      <View style={styles.themeSelectorContainer}>
        {[
          { key: 'masculino', label: 'Masculino' },
          { key: 'feminino', label: 'Feminino' },
        ].map((genderOption) => {
          const isSelected = (profile.gender || 'masculino') === genderOption.key;
          return (
            <TouchableOpacity
              key={genderOption.key}
              style={[styles.themeBtn, isSelected && styles.themeBtnActive]}
              onPress={() => onSaveProfile({ ...profile, gender: genderOption.key })}
            >
              <Text style={[styles.themeBtnText, isSelected && styles.themeBtnTextActive]}>
                {genderOption.label} {isSelected ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <DebugReportSection styles={styles} />

      <View style={styles.divider} />
      <TouchableOpacity style={styles.dangerBtn} onPress={onResetAllData}>
        <Text style={styles.dangerBtnText}>REINICIAR TODA A APLICAÇÃO</Text>
      </TouchableOpacity>
    </View>
  );
}
