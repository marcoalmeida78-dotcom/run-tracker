import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { THEMES } from '../../constants/themes';

export default function SettingsMenu({
  styles,
  onClose,
  currentTheme,
  onChangeTheme,
  profile,
  onSaveProfile,
  onResetAllData,
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

      <View style={styles.divider} />
      <TouchableOpacity style={styles.dangerBtn} onPress={onResetAllData}>
        <Text style={styles.dangerBtnText}>REINICIAR TODA A APLICAÇÃO</Text>
      </TouchableOpacity>
    </View>
  );
}
