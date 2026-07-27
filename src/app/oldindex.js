import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';
import { WebView } from 'react-native-webview';

// --- TAREFA DE LOCALIZAÇÃO EM SEGUNDO PLANO ---
const LOCATION_TASK_NAME = 'zero-aos-5k-background-location';

let backgroundLocationUpdateHandler = null;

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
    if (error) {
      return;
    }
    if (data) {
      const { locations } = data;
      if (backgroundLocationUpdateHandler && locations && locations.length > 0) {
        locations.forEach((loc) => backgroundLocationUpdateHandler(loc));
      }
    }
  });
}

// --- HTML DO MAPA (Leaflet + tiles OpenStreetMap Standard) ---
const LEAFLET_MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background-color: #f0f0f0; }
    .leaflet-control-attribution { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([38.7223, -9.1393], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    var routeLine = L.polyline([], { color: '#2D4A3E', weight: 4 }).addTo(map);
    var marker = null;
    var hasCentered = false;

    function updateRoute(coords, current) {
      routeLine.setLatLngs(coords.map(function (c) { return [c.lat, c.lng]; }));

      if (current) {
        if (!marker) {
          marker = L.circleMarker([current.lat, current.lng], {
            radius: 8, color: '#ffffff', weight: 2, fillColor: '#2D4A3E', fillOpacity: 1
          }).addTo(map);
        } else {
          marker.setLatLng([current.lat, current.lng]);
        }
        map.setView([current.lat, current.lng], hasCentered ? map.getZoom() : 17);
        hasCentered = true;
      }
    }

    function clearRoute() {
      routeLine.setLatLngs([]);
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
      hasCentered = false;
    }
    true;
  </script>
</body>
</html>
`;

// --- TEMAS / PALETAS DE CORES DA APLICAÇÃO ---
const THEMES = {
  default: {
    id: 'default',
    name: 'Sálvia & Menta',
    COLOR_BG_MAIN: '#E8F0EC',
    COLOR_CARD_BG: '#F4F8F5',
    COLOR_PRIMARY: '#2D4A3E',
    COLOR_SECONDARY: '#52796F',
    COLOR_DIVIDER: '#C2D5C9',
    COLOR_LIME_ENERGY: '#73B08C',
    COLOR_RED_ACCENT: '#D97770',
  },
  wellness: {
    id: 'wellness',
    name: 'Azul Sereno',
    COLOR_BG_MAIN: '#EBF2F7',
    COLOR_CARD_BG: '#F5F9FC',
    COLOR_PRIMARY: '#2B3A4A',
    COLOR_SECONDARY: '#526E85',
    COLOR_DIVIDER: '#C8D7E3',
    COLOR_LIME_ENERGY: '#6BA4C8',
    COLOR_RED_ACCENT: '#E07A5F',
  },
  neon: {
    id: 'neon',
    name: 'Areia & Mostarda',
    COLOR_BG_MAIN: '#F5F0EB',
    COLOR_CARD_BG: '#FAF6F0',
    COLOR_PRIMARY: '#3D3228',
    COLOR_SECONDARY: '#7A6855',
    COLOR_DIVIDER: '#DDD3C7',
    COLOR_LIME_ENERGY: '#D99B26',
    COLOR_RED_ACCENT: '#C85A54',
  },
};

// --- CONFIGURAÇÃO DO DESAFIO MORTE SÚBITA ---
const SUDDEN_DEATH_BLOCKS = [
  { block: 1, distKm: 0.1, timeSec: 45 },
  { block: 2, distKm: 0.2, timeSec: 40 },
  { block: 3, distKm: 0.3, timeSec: 35 },
  { block: 4, distKm: 0.4, timeSec: 30 },
  { block: 5, distKm: 0.5, timeSec: 26 },
  { block: 6, distKm: 0.6, timeSec: 23 },
  { block: 7, distKm: 0.7, timeSec: 20 },
  { block: 8, distKm: 0.8, timeSec: 18 },
  { block: 9, distKm: 0.9, timeSec: 16 },
  { block: 10, distKm: 1.0, timeSec: 14 },
];

// --- PROGRAMA 0 AOS 5K (75 SESSÕES / 25 NÍVEIS) ---
const RUN_PROGRAM_LEVELS = [
  { id: 1, title: 'Nível 1', sessions: ['Sessão 1', 'Sessão 2', 'Sessão 3'], summary: '10s corrida / 1m caminhada (8 repetições)', runSec: 10, walkSec: 60, repeats: 8 },
  { id: 2, title: 'Nível 2', sessions: ['Sessão 4', 'Sessão 5', 'Sessão 6'], summary: '15s corrida / 1m caminhada (8 repetições)', runSec: 15, walkSec: 60, repeats: 8 },
  { id: 3, title: 'Nível 3', sessions: ['Sessão 7', 'Sessão 8', 'Sessão 9'], summary: '20s corrida / 1m caminhada (8 repetições)', runSec: 20, walkSec: 60, repeats: 8 },
  { id: 4, title: 'Nível 4', sessions: ['Sessão 10', 'Sessão 11', 'Sessão 12'], summary: '25s corrida / 1m caminhada (8 repetições)', runSec: 25, walkSec: 60, repeats: 8 },
  { id: 5, title: 'Nível 5', sessions: ['Sessão 13', 'Sessão 14', 'Sessão 15'], summary: '30s corrida / 1m caminhada (8 repetições)', runSec: 30, walkSec: 60, repeats: 8 },
  { id: 6, title: 'Nível 6', sessions: ['Sessão 16', 'Sessão 17', 'Sessão 18'], summary: '35s corrida / 1m caminhada (8 repetições)', runSec: 35, walkSec: 60, repeats: 8 },
  { id: 7, title: 'Nível 7', sessions: ['Sessão 19', 'Sessão 20', 'Sessão 21'], summary: '40s corrida / 1m caminhada (8 repetições)', runSec: 40, walkSec: 60, repeats: 8 },
  { id: 8, title: 'Nível 8', sessions: ['Sessão 22', 'Sessão 23', 'Sessão 24'], summary: '45s corrida / 1m caminhada (8 repetições)', runSec: 45, walkSec: 60, repeats: 8 },
  { id: 9, title: 'Nível 9', sessions: ['Sessão 25', 'Sessão 26', 'Sessão 27'], summary: '50s corrida / 1m caminhada (8 repetições)', runSec: 50, walkSec: 60, repeats: 8 },
  { id: 10, title: 'Nível 10', sessions: ['Sessão 28', 'Sessão 29', 'Sessão 30'], summary: '55s corrida / 1m caminhada (8 repetições)', runSec: 55, walkSec: 60, repeats: 8 },
  { id: 11, title: 'Nível 11', sessions: ['Sessão 31', 'Sessão 32', 'Sessão 33'], summary: '1m corrida / 1m caminhada (8 repetições)', runSec: 60, walkSec: 60, repeats: 8 },
  { id: 12, title: 'Nível 12', sessions: ['Sessão 34', 'Sessão 35', 'Sessão 36'], summary: '1m15s corrida / 1m caminhada (7 repetições)', runSec: 75, walkSec: 60, repeats: 7 },
  { id: 13, title: 'Nível 13', sessions: ['Sessão 37', 'Sessão 38', 'Sessão 39'], summary: '1m30s corrida / 1m caminhada (7 repetições)', runSec: 90, walkSec: 60, repeats: 7 },
  { id: 14, title: 'Nível 14', sessions: ['Sessão 40', 'Sessão 41', 'Sessão 42'], summary: '1m45s corrida / 1m caminhada (6 repetições)', runSec: 105, walkSec: 60, repeats: 6 },
  { id: 15, title: 'Nível 15', sessions: ['Sessão 43', 'Sessão 44', 'Sessão 45'], summary: '2m corrida / 1m caminhada (6 repetições)', runSec: 120, walkSec: 60, repeats: 6 },
  { id: 16, title: 'Nível 16', sessions: ['Sessão 46', 'Sessão 47', 'Sessão 48'], summary: '2m30s corrida / 1m caminhada (6 repetições)', runSec: 150, walkSec: 60, repeats: 6 },
  { id: 17, title: 'Nível 17', sessions: ['Sessão 49', 'Sessão 50', 'Sessão 51'], summary: '3m corrida / 1m30s caminhada (5 repetições)', runSec: 180, walkSec: 90, repeats: 5 },
  { id: 18, title: 'Nível 18', sessions: ['Sessão 52', 'Sessão 53', 'Sessão 54'], summary: '4m corrida / 1m30s caminhada (4 repetições)', runSec: 240, walkSec: 90, repeats: 4 },
  { id: 19, title: 'Nível 19', sessions: ['Sessão 55', 'Sessão 56', 'Sessão 57'], summary: '5m corrida / 2m caminhada (4 repetições)', runSec: 300, walkSec: 120, repeats: 4 },
  { id: 20, title: 'Nível 20', sessions: ['Sessão 58', 'Sessão 59', 'Sessão 60'], summary: '7m corrida / 2m caminhada (3 repetições)', runSec: 420, walkSec: 120, repeats: 3 },
  { id: 21, title: 'Nível 21', sessions: ['Sessão 61', 'Sessão 62', 'Sessão 63'], summary: '9m corrida / 2m caminhada (3 repetições)', runSec: 540, walkSec: 120, repeats: 3 },
  { id: 22, title: 'Nível 22', sessions: ['Sessão 64', 'Sessão 65', 'Sessão 66'], summary: '12m corrida / 2m caminhada (2 repetições)', runSec: 720, walkSec: 120, repeats: 2 },
  { id: 23, title: 'Nível 23', sessions: ['Sessão 67', 'Sessão 68', 'Sessão 69'], summary: '15m corrida / 3m caminhada (2 repetições)', runSec: 900, walkSec: 180, repeats: 2 },
  { id: 24, title: 'Nível 24', sessions: ['Sessão 70', 'Sessão 71', 'Sessão 72'], summary: '20m corrida / 3m caminhada (1 repetição longa)', runSec: 1200, walkSec: 180, repeats: 1 },
  { id: 25, title: 'Nível 25 (Objetivo 5K)', sessions: ['Sessão 73', 'Sessão 74', 'Sessão 75'], summary: '30 min de corrida contínua para atingir os 5K', runSec: 1800, walkSec: 0, repeats: 1 },
];

export default function App() {
  const [currentTheme, setCurrentTheme] = useState('default');
  const colors = THEMES[currentTheme] || THEMES.default;

  const [activeMenu, setActiveMenu] = useState(null);
  const [activeLevelAccordion, setActiveLevelAccordion] = useState(null);
  const [profile, setProfile] = useState({ weight: '', height: '', age: '', gender: 'masculino' });
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  
  const [showStatusInfoModal, setShowStatusInfoModal] = useState(false);
  const [showBatteryInfoModal, setShowBatteryInfoModal] = useState(false);
  const [showBatteryOptimizationModal, setShowBatteryOptimizationModal] = useState(false);

  const [history, setHistory] = useState([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0); 
  const [completedSessions, setCompletedSessions] = useState([]); 

  const [isExercising, setIsExercising] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [exerciseType, setExerciseType] = useState('');
  const [exerciseTitle, setExerciseTitle] = useState('');
  const [activeConfig, setActiveConfig] = useState(null);
  
  const [timelinePhases, setTimelinePhases] = useState([]);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(0);

  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [cadence, setCadence] = useState(115);

  const [isMapReady, setIsMapReady] = useState(false);

  const [vo2MaxResult, setVo2MaxResult] = useState(null);
  const [best10MinDist, setBest10MinDist] = useState(null);
  const [bestEsquinaDist, setBestEsquinaDist] = useState(null);
  const [bestCooperDist, setBestCooperDist] = useState(null);
  const [best15MilhasSec, setBest15MilhasSec] = useState(null);
  const [best1MilhaSec, setBest1MilhaSec] = useState(null);
  
  const [suddenDeathBlock, setSuddenDeathBlock] = useState(1);
  const suddenDeathBlockRef = useRef(1);
  const suddenDeathBlockStartTimeRef = useRef(0);
  const lastCountdownSecRef = useRef(-1);

  const [showEsquinaModal, setShowEsquinaModal] = useState(false);
  const esquinaTargetMultiplierRef = useRef(1);
  
  const appState = useRef(AppState.currentState);
  const hasGoneBackgroundRef = useRef(false);

  const locationTaskActiveRef = useRef(false);
  const lastLocation = useRef(null);
  const routeCoordsRef = useRef([]);
  const currentCoordRef = useRef(null);
  const webviewRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const pauseStartTimeRef = useRef(null);
  const totalPausedTimeRef = useRef(0);
  const lastCadenceNoticeTime = useRef(0);
  const lastMilhaNoticeStep = useRef(0);

  const isPausedRef = useRef(false);
  const isExercisingRef = useRef(false);
  const isFinishingRef = useRef(false);
  const exerciseTypeRef = useRef('');
  const exerciseTitleRef = useRef('');
  const secondsRef = useRef(0);
  const distanceRef = useRef(0);
  const speedRef = useRef(0);
  const cadenceRef = useRef(115);
  const currentPhaseIndexRef = useRef(0);
  const activeConfigRef = useRef(null);
  const best1MilhaSecRef = useRef(null);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isExercisingRef.current = isExercising; }, [isExercising]);
  useEffect(() => { exerciseTypeRef.current = exerciseType; }, [exerciseType]);
  useEffect(() => { exerciseTitleRef.current = exerciseTitle; }, [exerciseTitle]);

  useEffect(() => {
    const prepareBackgroundAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {}
    };
    prepareBackgroundAudio();
  }, []);

  useEffect(() => {
    loadAppData();

    (async () => {
      try {
        const stillRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (stillRunning) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      } catch (e) {}
    })();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (isExercisingRef.current && exerciseTypeRef.current === 'walk_2km') {
        if (nextAppState.match(/inactive|background/)) {
          hasGoneBackgroundRef.current = true;
        }
        if (appState.current.match(/inactive|background/) && nextAppState === 'active' && hasGoneBackgroundRef.current) {
          if (distanceRef.current < 2.0 && secondsRef.current > 10) {
            fail2KmChallenge();
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      stopAndCleanupExercise();
    };
  }, []);

  const fail2KmChallenge = () => {
    stopAndCleanupExercise();
    Vibration.vibrate([400, 200, 400]);
    playAudio('Não conseguiste caminhar 2 quilómetros sem olhar para o ecrã do telemóvel.');
    Alert.alert(
      'Desafio Não Concluído ❌',
      'Não conseguiste caminhar 2km sem olhar para o ecrã do telemóvel. O exercício não foi concluído com êxito e não será registado no histórico.'
    );
  };

  const openBatteryOptimizationSettings = async () => {
    if (Platform.OS === 'android') {
      const packageName = Constants.expoConfig?.android?.package || 'com.marcoalmeida.zeroaos5k';
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
          { data: `package:${packageName}` }
        );
      } catch (e) {
        try {
          await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
          );
        } catch (e2) {}
      }
    }
    try {
      await AsyncStorage.setItem('@battery_optimization_warned', 'true');
    } catch (e) {}
    setShowBatteryOptimizationModal(false);
  };

  const dismissBatteryOptimizationModal = async () => {
    try {
      await AsyncStorage.setItem('@battery_optimization_warned', 'true');
    } catch (e) {}
    setShowBatteryOptimizationModal(false);
  };

  const promptBatteryOptimizationIfNeeded = async () => {
    if (Platform.OS !== 'android') return;
    try {
      const alreadyWarned = await AsyncStorage.getItem('@battery_optimization_warned');
      if (!alreadyWarned) {
        setShowBatteryOptimizationModal(true);
      }
    } catch (e) {}
  };

  const loadAppData = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('@user_theme');
      if (savedTheme && THEMES[savedTheme]) setCurrentTheme(savedTheme);

      const savedProfile = await AsyncStorage.getItem('@user_profile');
      const savedHistory = await AsyncStorage.getItem('@user_history');
      const savedSession = await AsyncStorage.getItem('@current_session_index');
      const savedCompleted = await AsyncStorage.getItem('@completed_sessions');

      let parsedHistory = [];
      if (savedHistory) {
        parsedHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory);
        updateRecordsFromHistory(parsedHistory);
      }

      if (savedProfile) {
        const parsedProfile = JSON.parse(savedProfile);
        setProfile(parsedProfile);
        if (!parsedProfile.weight || !parsedProfile.height || !parsedProfile.age) {
          setShowProfileAlert(true);
        }
      } else {
        setShowProfileAlert(true);
      }

      if (savedCompleted) setCompletedSessions(JSON.parse(savedCompleted));
      
      if (savedSession) {
        const idx = parseInt(savedSession, 10);
        setCurrentSessionIndex(idx);
        setActiveLevelAccordion(Math.floor(idx / 3) + 1);
      } else {
        setCurrentSessionIndex(0);
        setActiveLevelAccordion(1);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const changeTheme = async (themeKey) => {
    setCurrentTheme(themeKey);
    await AsyncStorage.setItem('@user_theme', themeKey);
  };

  const updateRecordsFromHistory = (histList) => {
    const tenMinWorkouts = histList.filter(item => item.title === 'Desafio 10 Minutos');
    setBest10MinDist(tenMinWorkouts.length > 0 ? Math.max(...tenMinWorkouts.map(item => parseFloat(item.distanceKm) || 0)).toFixed(2) : null);

    const esquinaWorkouts = histList.filter(item => item.title.includes('Esquina'));
    setBestEsquinaDist(esquinaWorkouts.length > 0 ? Math.max(...esquinaWorkouts.map(item => parseFloat(item.distanceKm) || 0)).toFixed(2) : null);

    const cooperWorkouts = histList.filter(item => item.title.includes('Cooper'));
    setBestCooperDist(cooperWorkouts.length > 0 ? Math.max(...cooperWorkouts.map(item => parseFloat(item.distanceKm) || 0)).toFixed(2) : null);

    const m15Workouts = histList.filter(item => item.title.includes('1,5 Milhas'));
    if (m15Workouts.length > 0) {
      const minSec = Math.min(...m15Workouts.map(item => parseInt(item.timeSec, 10) || 999999));
      setBest15MilhasSec(minSec !== 999999 ? minSec : null);
    } else {
      setBest15MilhasSec(null);
    }

    const m1Workouts = histList.filter(item => item.title.includes('1 Milha'));
    if (m1Workouts.length > 0) {
      const minSec = Math.min(...m1Workouts.map(item => parseInt(item.timeSec, 10) || 999999));
      const val = minSec !== 999999 ? minSec : null;
      setBest1MilhaSec(val);
      best1MilhaSecRef.current = val;
    } else {
      setBest1MilhaSec(null);
      best1MilhaSecRef.current = null;
    }
  };

  const saveProfileData = async (updatedProfile) => {
    setProfile(updatedProfile);
    await AsyncStorage.setItem('@user_profile', JSON.stringify(updatedProfile));
  };

  const pushMapUpdate = () => {
    if (!webviewRef.current) return;
    const coordsForMap = routeCoordsRef.current.map(c => ({ lat: c.latitude, lng: c.longitude }));
    const currentForMap = currentCoordRef.current ? { lat: currentCoordRef.current.latitude, lng: currentCoordRef.current.longitude } : null;
    webviewRef.current.injectJavaScript(`updateRoute(${JSON.stringify(coordsForMap)}, ${JSON.stringify(currentForMap)}); true;`);
  };

  const clearMapRoute = () => {
    if (webviewRef.current) {
      webviewRef.current.injectJavaScript('clearRoute(); true;');
    }
  };

  const playAudio = async (text) => {
    try {
      Speech.stop();
      const voices = await Speech.getAvailableVoicesAsync();
      const ptPtVoice = voices.find(v => v.language && (v.language.toLowerCase() === 'pt-pt' || v.language.toLowerCase() === 'pt_pt'));
      const options = { language: 'pt-PT' };
      if (ptPtVoice) options.voice = ptPtVoice.identifier;
      Speech.speak(text, options);
    } catch (error) {
      Speech.speak(text, { language: 'pt-PT' });
    }
  };

  const calculateCalories = (distKm, timeSec) => {
    const weight = parseFloat(profile.weight) || 70;
    const hours = timeSec / 3600;
    const speedKmH = hours > 0 ? distKm / hours : 0;
    let met = 4.0;
    if (speedKmH > 7) met = 8.5;
    return Math.round((met * 3.5 * weight * (timeSec / 60)) / 200);
  };

  const calculateRockportVo2Max = (timeSec, distKm) => {
    const weightKg = parseFloat(profile.weight) || 70;
    const age = parseFloat(profile.age) || 30;
    const gender = profile.gender || 'masculino';
    const timeMinutes = timeSec / 60;
    const weightLbs = weightKg * 2.20462;
    let baseVo2 = 132.853 - (0.0769 * weightLbs) - (0.3877 * age) + (gender === 'masculino' ? 6.315 : 0) - (3.2649 * timeMinutes) - (0.1565 * (distKm * 1000));
    return Math.max(15, Math.min(85, Math.round(baseVo2 * 10) / 10));
  };

  const calculate15MilesVo2Max = (timeSec) => {
    const timeMin = timeSec / 60;
    let vo2 = (483 / timeMin) + 3.5;
    return Math.max(15, Math.min(85, Math.round(vo2 * 10) / 10));
  };

  const calculate1MileRunVo2Max = (timeSec) => {
    const weightKg = parseFloat(profile.weight) || 70;
    const age = parseFloat(profile.age) || 30;
    const gender = profile.gender || 'masculino';
    const timeMinutes = timeSec / 60;
    const weightLbs = weightKg * 2.20462;
    let vo2 = 108.844 - (0.1636 * weightLbs) - (1.438 * timeMinutes) - (0.1928 * age) + (gender === 'masculino' ? 6.131 : 0);
    return Math.max(15, Math.min(85, Math.round(vo2 * 10) / 10));
  };

  const isWalkingActivity = (type) => type.startsWith('walk');

  const calculateDynamicCadence = (currentSpeedKmH, type) => {
    const spd = parseFloat(currentSpeedKmH) || 0;
    if (isWalkingActivity(type)) {
      if (spd <= 0) return 105;
      return Math.max(85, Math.min(170, Math.round(95 + (spd * 8))));
    } else {
      if (spd <= 0) return 160;
      return Math.max(140, Math.min(200, Math.round(140 + (spd * 5))));
    }
  };

  const getCadenceFeedback = (spm, type) => {
    if (isWalkingActivity(type)) {
      if (spm < 90) return { label: 'Cadência Baixa (<90 SPM)', color: colors.COLOR_PRIMARY };
      if (spm <= 170) return { label: 'Cadência Ideal (90-170 SPM)', color: colors.COLOR_PRIMARY };
      return { label: 'Cadência Alta (>170 SPM)', color: colors.COLOR_SECONDARY };
    } else {
      if (spm < 150) return { label: 'Cadência Baixa (<150 SPM)', color: colors.COLOR_PRIMARY };
      if (spm <= 200) return { label: 'Cadência Ideal (150-200 SPM)', color: colors.COLOR_PRIMARY };
      return { label: 'Cadência Alta (>200 SPM)', color: colors.COLOR_SECONDARY };
    }
  };

  const check1MilhaAudioMotivation = (currentMeters, currentSec) => {
    const step = Math.floor(currentMeters / 250);
    if (step > lastMilhaNoticeStep.current && step <= 6) {
      lastMilhaNoticeStep.current = step;
      const metersDone = step * 250;
      Vibration.vibrate([200, 100, 200]);
      if (best1MilhaSecRef.current && best1MilhaSecRef.current > 0) {
        const targetPacePerMeter = best1MilhaSecRef.current / 1609;
        const targetSecForStep = targetPacePerMeter * metersDone;
        if (currentSec <= targetSecForStep) {
          playAudio(`Aos ${metersDone} metros estás a ir mais rápido do que o teu melhor histórico! Mantém o ritmo!`);
        } else {
          playAudio(`Aos ${metersDone} metros estás um pouco abaixo do teu recorde. Acelera o passo!`);
        }
      } else {
        playAudio(`Já percorreste ${metersDone} metros. Excelente trabalho, continua!`);
      }
    }
  };

  const generateTimeline = (sessionIdx) => {
    const lvlIdx = Math.floor(sessionIdx / 3);
    const lvl = RUN_PROGRAM_LEVELS[lvlIdx];
    const phases = [{ id: 0, label: 'AQUECIMENTO', durationSec: 300, type: 'warmup' }];
    let idCounter = 1;
    for (let i = 0; i < lvl.repeats; i++) {
      phases.push({ id: idCounter++, label: `CORRIDA ${i + 1}`, durationSec: lvl.runSec, type: 'run' });
      if (lvl.walkSec > 0) {
        phases.push({ id: idCounter++, label: `CAMINHADA ${i + 1}`, durationSec: lvl.walkSec, type: 'walk' });
      }
    }
    phases.push({ id: idCounter++, label: 'ARREFECIMENTO', durationSec: 300, type: 'cooldown' });
    return phases;
  };

  const handleSelectProgramSession = (targetSessionIdx) => {
    if (targetSessionIdx === currentSessionIndex) {
      launchProgramSession(targetSessionIdx, true);
      return;
    }
    if (targetSessionIdx > currentSessionIndex) {
      Alert.alert(
        'Sessão Mais Avançada',
        `Esta sessão (Sessão ${targetSessionIdx + 1}) está à frente da sua recomendação atual. Pretende continuar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Quero apenas desafiar-me', onPress: () => launchProgramSession(targetSessionIdx, false) },
          {
            text: 'Definir esta sessão como novo ponto atual',
            onPress: async () => {
              setCurrentSessionIndex(targetSessionIdx);
              await AsyncStorage.setItem('@current_session_index', targetSessionIdx.toString());
              launchProgramSession(targetSessionIdx, true);
            }
          }
        ]
      );
      return;
    }
    if (targetSessionIdx < currentSessionIndex) {
      Alert.alert(
        'Recuar no Plano',
        `Está a escolher a Sessão ${targetSessionIdx + 1}. Pretende definir esta sessão como a sua nova recomendação atual?`,
        [
          { text: 'Fazer sem alterar recomendação', onPress: () => launchProgramSession(targetSessionIdx, false) },
          {
            text: 'Sim, Recuar Recomendação',
            onPress: () => {
              Alert.alert(
                'Sessões Mais Avançadas',
                'Deseja manter as sessões avançadas que já fez marcadas como "concluídas"?',
                [
                  {
                    text: 'Manter Marcadas',
                    onPress: async () => {
                      setCurrentSessionIndex(targetSessionIdx);
                      await AsyncStorage.setItem('@current_session_index', targetSessionIdx.toString());
                      launchProgramSession(targetSessionIdx, true);
                    }
                  },
                  {
                    text: 'Desmarcar Avançadas',
                    onPress: async () => {
                      const cleaned = completedSessions.filter(id => id <= targetSessionIdx);
                      setCompletedSessions(cleaned);
                      await AsyncStorage.setItem('@completed_sessions', JSON.stringify(cleaned));
                      setCurrentSessionIndex(targetSessionIdx);
                      await AsyncStorage.setItem('@current_session_index', targetSessionIdx.toString());
                      launchProgramSession(targetSessionIdx, true);
                    }
                  }
                ]
              );
            }
          }
        ]
      );
    }
  };

  const launchProgramSession = (sessionIdx, isUpdatingProgression) => {
    const phases = generateTimeline(sessionIdx);
    const totalSec = phases.reduce((acc, p) => acc + p.durationSec, 0);
    setTimelinePhases(phases);
    setCurrentPhaseIndex(0);
    currentPhaseIndexRef.current = 0;
    setPhaseTimeLeft(phases[0].durationSec);

    const lvl = RUN_PROGRAM_LEVELS[Math.floor(sessionIdx / 3)];
    startExerciseSession(
      'run_program',
      `Corrida: ${lvl.title} - ${lvl.sessions[sessionIdx % 3]}`,
      { targetTimeSec: totalSec, phases, sessionIndex: sessionIdx, isProgression: isUpdatingProgression }
    );
  };

  const tickExercise = (now, currentDist, currentSpeed) => {
    if (isPausedRef.current || isFinishingRef.current || !startTimeRef.current) return;

    const elapsedMs = now - startTimeRef.current - totalPausedTimeRef.current;
    const currentSec = Math.floor(elapsedMs / 1000);

    if (currentSec > secondsRef.current) {
      setSeconds(currentSec);
      secondsRef.current = currentSec;

      if (activeConfigRef.current?.phases && activeConfigRef.current.phases.length > 0) {
        updateTimelineProgress(currentSec, activeConfigRef.current.phases);
      }

      if (exerciseTypeRef.current === 'challenge_morte_subita') {
        const configBlock = SUDDEN_DEATH_BLOCKS[suddenDeathBlockRef.current - 1];
        const blockSec = Math.floor((now - suddenDeathBlockStartTimeRef.current) / 1000);

        if (blockSec >= configBlock.timeSec) {
          if (currentDist < configBlock.distKm) {
            stopAndCleanupExercise();
            Vibration.vibrate([400, 200, 400]);
            playAudio(`Tempo esgotado no bloco ${configBlock.block}. Desafio Morte Súbita não concluído.`);
            Alert.alert('Fim do Desafio ❌', `Não conseguiste atingir os ${configBlock.distKm * 1000} metros dentro do tempo limite de ${configBlock.timeSec} segundos.`);
            return;
          } else {
            if (suddenDeathBlockRef.current >= 10) {
              autoFinishExercise(exerciseTypeRef.current, exerciseTitleRef.current, currentSec, currentDist, currentSpeed, activeConfigRef.current);
              return;
            } else {
              const nextBlock = suddenDeathBlockRef.current + 1;
              suddenDeathBlockRef.current = nextBlock;
              setSuddenDeathBlock(nextBlock);
              suddenDeathBlockStartTimeRef.current = Date.now();
              lastCountdownSecRef.current = -1;
              Vibration.vibrate([300, 100, 300]);
              playAudio(`Bloco ${nextBlock} iniciado! Acelera!`);
            }
          }
        }
      }

      if (activeConfigRef.current?.targetTimeSec && currentSec >= activeConfigRef.current.targetTimeSec) {
        autoFinishExercise(exerciseTypeRef.current, exerciseTitleRef.current, currentSec, currentDist, currentSpeed, activeConfigRef.current);
      }
    }

    if (exerciseTypeRef.current !== 'walk_esquina' && activeConfigRef.current?.targetDistKm && currentDist >= activeConfigRef.current.targetDistKm) {
      autoFinishExercise(exerciseTypeRef.current, exerciseTitleRef.current, secondsRef.current, currentDist, currentSpeed, activeConfigRef.current);
    }
  };

  const startExerciseSession = async (type, title, config = {}) => {
    let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      Alert.alert('Permissão Necessária', 'O acesso ao GPS é necessário para registar o treino.');
      return;
    }

    let { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      Alert.alert('Aviso: Ecrã Desligado', 'Para garantir que a contagem não para quando desligares o ecrã, escolhe a opção "Permitir sempre" nas definições.');
    }

    promptBatteryOptimizationIfNeeded();

    const defaultCadence = isWalkingActivity(type) ? 105 : 160;

    setExerciseType(type);
    exerciseTypeRef.current = type;
    setExerciseTitle(title);
    exerciseTitleRef.current = title;
    setActiveConfig(config);
    activeConfigRef.current = config;

    setSeconds(0);
    setDistance(0);
    setSpeed(0);
    setCadence(defaultCadence);
    setVo2MaxResult(null);
    setShowEsquinaModal(false);
    esquinaTargetMultiplierRef.current = 1;
    hasGoneBackgroundRef.current = false;
    lastMilhaNoticeStep.current = 0;

    setSuddenDeathBlock(1);
    suddenDeathBlockRef.current = 1;
    suddenDeathBlockStartTimeRef.current = Date.now();
    lastCountdownSecRef.current = -1;

    cadenceRef.current = defaultCadence;
    setIsExercising(true);
    setIsPaused(false);
    isFinishingRef.current = false;
    
    secondsRef.current = 0;
    distanceRef.current = 0;
    speedRef.current = 0;
    lastLocation.current = null;
    lastCadenceNoticeTime.current = 0;

    routeCoordsRef.current = [];
    currentCoordRef.current = null;
    clearMapRoute();
    try {
      const initialPos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      currentCoordRef.current = { latitude: initialPos.coords.latitude, longitude: initialPos.coords.longitude };
      pushMapUpdate();
    } catch (e) {}

    startTimeRef.current = Date.now();
    pauseStartTimeRef.current = null;
    totalPausedTimeRef.current = 0;

    Vibration.vibrate(300);
    playAudio('Vamos começar!');

    timerRef.current = setInterval(() => {
      tickExercise(Date.now(), distanceRef.current, speedRef.current);
    }, 1000);

    const handleLocationUpdate = (loc) => {
      if (isPausedRef.current || isFinishingRef.current) return;

      const { latitude, longitude, speed: currentSpeed } = loc.coords;
      const speedKmH = currentSpeed && currentSpeed > 0 ? (currentSpeed * 3.6).toFixed(1) : 0;
      setSpeed(speedKmH);
      speedRef.current = speedKmH;

      const updatedCadence = calculateDynamicCadence(speedKmH, type);
      setCadence(updatedCadence);
      cadenceRef.current = updatedCadence;

      let newDist = distanceRef.current;
      if (lastLocation.current) {
        const added = calculateHaversine(lastLocation.current.latitude, lastLocation.current.longitude, latitude, longitude);
        if (added > 0.001) {
          newDist = distanceRef.current + added;
          setDistance(newDist);
          distanceRef.current = newDist;
        }

        if (type === 'challenge_1milha') {
          check1MilhaAudioMotivation(newDist * 1000, secondsRef.current);
        }

        if (type === 'walk_esquina') {
          const targetKm = esquinaTargetMultiplierRef.current * 0.5;
          if (newDist >= targetKm) {
            pauseStartTimeRef.current = Date.now();
            setIsPaused(true);
            setSpeed(0);
            Vibration.vibrate([300, 200, 300]);
            playAudio('Completou 500 metros! Pretendes fazer mais 500 metros?');
            setShowEsquinaModal(true);
          }
        }
      }
      lastLocation.current = { latitude, longitude };

      const newRoutePoint = { latitude, longitude };
      routeCoordsRef.current = [...routeCoordsRef.current, newRoutePoint];
      currentCoordRef.current = newRoutePoint;
      pushMapUpdate();

      tickExercise(Date.now(), newDist, speedKmH);
    };

    backgroundLocationUpdateHandler = handleLocationUpdate;

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 1000,
      distanceInterval: 1,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: "Zero aos 5K em Curso 🏃‍♂️",
        notificationBody: "A acompanhar o teu treino em segundo plano.",
        notificationColor: colors.COLOR_PRIMARY,
      },
    });
    locationTaskActiveRef.current = true;
  };

  const handleContinueEsquinaChallenge = () => {
    setShowEsquinaModal(false);
    esquinaTargetMultiplierRef.current += 1;
    if (pauseStartTimeRef.current) {
      totalPausedTimeRef.current += (Date.now() - pauseStartTimeRef.current);
    }
    setIsPaused(false);
    playAudio('Excelente! Vamos a isso, mais 500 metros!');
  };

  const handleFinishEsquinaChallenge = () => {
    setShowEsquinaModal(false);
    autoFinishExercise(exerciseType, exerciseTitle, seconds, distance, speed, activeConfig);
  };

  const updateTimelineProgress = (elapsedSec, phases) => {
    let accumulated = 0;
    for (let i = 0; i < phases.length; i++) {
      accumulated += phases[i].durationSec;
      if (elapsedSec < accumulated) {
        setPhaseTimeLeft(accumulated - elapsedSec);
        if (currentPhaseIndexRef.current !== i) {
          currentPhaseIndexRef.current = i;
          setCurrentPhaseIndex(i);
          Vibration.vibrate([300, 100, 300]);
          if (phases[i].type === 'run') playAudio('Comece a correr');
          else if (phases[i].type === 'walk') playAudio('Comece a andar');
          else if (phases[i].type === 'cooldown') playAudio('Início do arrefecimento');
          else if (phases[i].type === 'warmup') playAudio('Aquecimento');
        }
        break;
      }
    }
  };

  const skipCurrentPhase = () => {
    if (!activeConfig?.phases) return;
    const currentP = timelinePhases[currentPhaseIndex];
    if (currentP?.type === 'warmup') {
      const warmupDuration = activeConfig.phases[0].durationSec;
      startTimeRef.current = Date.now() - totalPausedTimeRef.current - (warmupDuration * 1000);
      setSeconds(warmupDuration);
      secondsRef.current = warmupDuration;
      updateTimelineProgress(warmupDuration, activeConfig.phases);
      playAudio('Aquecimento saltado. Comece a correr!');
    } else if (currentP?.type === 'cooldown') {
      autoFinishExercise(exerciseType, exerciseTitle, seconds, distance, speed, activeConfig);
    }
  };

  const calculateHaversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const togglePause = () => {
    if (!isPaused) {
      pauseStartTimeRef.current = Date.now();
      setIsPaused(true);
      setSpeed(0);
    } else {
      if (pauseStartTimeRef.current) totalPausedTimeRef.current += (Date.now() - pauseStartTimeRef.current);
      setIsPaused(false);
    }
  };

  const cancelExercise = () => {
    Alert.alert('Cancelar Treino', 'Tem a certeza que deseja cancelar?', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim, Cancelar', style: 'destructive', onPress: () => stopAndCleanupExercise() }
    ]);
  };

  const stopAndCleanupExercise = () => {
    if (locationTaskActiveRef.current) {
      locationTaskActiveRef.current = false;
      backgroundLocationUpdateHandler = null;
      Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
        .then((started) => { if (started) return Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME); })
        .catch(() => {});
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsExercising(false);
    setIsPaused(false);
    setShowEsquinaModal(false);
    routeCoordsRef.current = [];
    currentCoordRef.current = null;
    lastLocation.current = null;
    clearMapRoute();
  };

  const autoFinishExercise = async (type, title, finalSec, finalDist, finalSpeed, config) => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    stopAndCleanupExercise();
    Vibration.vibrate([500, 300, 500]);
    
    let vo2Val = null;
    let finishMessage = 'Parabéns! Completou o treino com sucesso!';
    if (type === 'walk_rockport') {
      vo2Val = calculateRockportVo2Max(finalSec, finalDist);
      setVo2MaxResult(vo2Val);
    } else if (type === 'challenge_1.5m') {
      vo2Val = calculate15MilesVo2Max(finalSec);
      setVo2MaxResult(vo2Val);
    } else if (type === 'challenge_1milha') {
      vo2Val = calculate1MileRunVo2Max(finalSec);
      setVo2MaxResult(vo2Val);
    }
    playAudio(finishMessage);

    const newRecord = {
      id: Date.now().toString(),
      title,
      date: new Date().toLocaleDateString('pt-PT'),
      timeSec: finalSec,
      distanceKm: finalDist.toFixed(2),
      pace: finalDist > 0 ? (finalSec / 60 / finalDist).toFixed(2) : '0.00',
      calories: calculateCalories(finalDist, finalSec),
      speed: finalSpeed,
      cadence,
      vo2Max: vo2Val,
    };

    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    updateRecordsFromHistory(updatedHistory);
    await AsyncStorage.setItem('@user_history', JSON.stringify(updatedHistory));

    if (type === 'run_program' && config?.sessionIndex !== undefined) {
      const doneIdx = config.sessionIndex;
      let updatedCompleted = [...new Set([...completedSessions, doneIdx])];
      setCompletedSessions(updatedCompleted);
      await AsyncStorage.setItem('@completed_sessions', JSON.stringify(updatedCompleted));

      if (config.isProgression) {
        const nextRec = Math.min(74, doneIdx + 1);
        setCurrentSessionIndex(nextRec);
        await AsyncStorage.setItem('@current_session_index', nextRec.toString());
        setActiveLevelAccordion(Math.floor(nextRec / 3) + 1);
      }
    }
  };

  const handleDeleteHistoryItem = (idToDelete) => {
    Alert.alert('Apagar Treino', 'Tem a certeza que deseja eliminar este registo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const updatedHistory = history.filter(item => item.id !== idToDelete);
          setHistory(updatedHistory);
          updateRecordsFromHistory(updatedHistory);
          await AsyncStorage.setItem('@user_history', JSON.stringify(updatedHistory));
        }
      }
    ]);
  };

  const handleResetAllData = () => {
    Alert.alert('Reiniciar Aplicação', 'Tem a certeza que deseja eliminar TODOS os registos?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reiniciar Tudo',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          setCurrentTheme('default');
          setProfile({ weight: '', height: '', age: '', gender: 'masculino' });
          setHistory([]);
          setCompletedSessions([]);
          setCurrentSessionIndex(0);
          setActiveLevelAccordion(1);
          setBest10MinDist(null);
          setBestEsquinaDist(null);
          setBestCooperDist(null);
          setBest15MilhasSec(null);
          setBest1MilhaSec(null);
          best1MilhaSecRef.current = null;
          Alert.alert('Aplicação Reiniciada', 'Todos os registos foram limpos.');
        }
      }
    ]);
  };

  const getWorkoutsLast7DaysCount = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return history.filter(item => {
      const parts = item.date.split('/');
      if (parts.length === 3) {
        const itemDate = new Date(parts[2], parts[1] - 1, parts[0]);
        return itemDate >= sevenDaysAgo;
      }
      return false;
    }).length;
  };

  const workoutsLast7Days = getWorkoutsLast7DaysCount();
  const toggleAccordion = (menuName) => setActiveMenu(activeMenu === menuName ? null : menuName);
  const toggleLevelAccordion = (lvlId) => setActiveLevelAccordion(activeLevelAccordion === lvlId ? null : lvlId);
  const formatHMS = (totalSec) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const dynamicStyles = getStyles(colors);

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar barStyle={currentTheme === 'neon' ? "light-content" : "dark-content"} backgroundColor={colors.COLOR_BG_MAIN} />

      <Modal visible={showProfileAlert} transparent animationType="slide">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalCard}>
            <Text style={dynamicStyles.modalTitle}>Aviso de Perfil</Text>
            <Text style={dynamicStyles.modalText}>Por favor, preencha os dados nas Definições.</Text>
            <TouchableOpacity style={dynamicStyles.modalBtn} onPress={() => setShowProfileAlert(false)}>
              <Text style={dynamicStyles.modalBtnText}>Compreendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showStatusInfoModal} transparent animationType="fade">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalCard}>
            <Text style={dynamicStyles.modalTitle}>🔴 Indicador de Frequência</Text>
            <Text style={dynamicStyles.modalText}>Avalia a consistência nos últimos 7 dias.</Text>
            <TouchableOpacity style={dynamicStyles.modalBtn} onPress={() => setShowStatusInfoModal(false)}>
              <Text style={dynamicStyles.modalBtnText}>Compreendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBatteryInfoModal} transparent animationType="fade">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalCard}>
            <Text style={dynamicStyles.modalTitle}>🔋 Barra de Energia do Plano</Text>
            <Text style={dynamicStyles.modalText}>Reflete a evolução global das 75 sessões (25 níveis).</Text>
            <TouchableOpacity style={dynamicStyles.modalBtn} onPress={() => setShowBatteryInfoModal(false)}>
              <Text style={dynamicStyles.modalBtnText}>Compreendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBatteryOptimizationModal} transparent animationType="fade">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalCard}>
            <Text style={dynamicStyles.modalTitle}>🔋 Otimização de Bateria</Text>
            <Text style={dynamicStyles.modalText}>Desative a otimização para evitar que o GPS pare com o ecrã desligado.</Text>
            <TouchableOpacity style={dynamicStyles.modalBtn} onPress={openBatteryOptimizationSettings}>
              <Text style={dynamicStyles.modalBtnText}>ABRIR DEFINIÇÕES</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[dynamicStyles.modalBtn, { backgroundColor: 'transparent', marginTop: 4 }]} onPress={dismissBatteryOptimizationModal}>
              <Text style={[dynamicStyles.modalBtnText, { color: colors.COLOR_PRIMARY }]}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEsquinaModal} transparent animationType="fade">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.esquinaCard}>
            <Text style={dynamicStyles.esquinaTitle}>🎉 500 Metros Concluídos!</Text>
            <Text style={dynamicStyles.esquinaText}>Pretendes fazer mais 500 metros?</Text>
            <TouchableOpacity style={dynamicStyles.esquinaYesBtn} onPress={handleContinueEsquinaChallenge}>
              <Text style={dynamicStyles.esquinaYesBtnText}>SIM, SÓ MAIS 500M! 🏃‍♂️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dynamicStyles.esquinaNoBtn} onPress={handleFinishEsquinaChallenge}>
              <Text style={dynamicStyles.esquinaNoBtnText}>CONCLUIR TREINO ✓</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isExercising ? (
        <ScrollView contentContainerStyle={dynamicStyles.activeExerciseScroll}>
          <View style={dynamicStyles.headerContainerActive}>
            <Text style={dynamicStyles.activeTitle}>{exerciseTitle}</Text>
          </View>

          <View style={dynamicStyles.mapContainer}>
            <WebView
              ref={webviewRef}
              originWhitelist={['*']}
              source={{ html: LEAFLET_MAP_HTML }}
              style={dynamicStyles.map}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scrollEnabled={false}
              onLoadEnd={() => {
                setIsMapReady(true);
                pushMapUpdate();
              }}
            />
          </View>

          {exerciseType === 'challenge_morte_subita' && (
            <View style={dynamicStyles.rockportProgressCard}>
              <View style={dynamicStyles.rockportHeaderRow}>
                <Text style={dynamicStyles.rockportLabel}>BLOCO ATUAL: {suddenDeathBlock} / 10</Text>
                <Text style={dynamicStyles.rockportValue}>Meta: {suddenDeathBlock * 100} m</Text>
              </View>
              <View style={dynamicStyles.progressBarBackground}>
                <View style={[dynamicStyles.progressBarFill, { width: `${Math.min(100, (distance / (suddenDeathBlock * 0.1)) * 100)}%` }]} />
              </View>
              <View style={dynamicStyles.recordHighlightBox}>
                <Text style={dynamicStyles.recordTitle}>TEMPO LIMITE DO BLOCO</Text>
                <Text style={dynamicStyles.recordValue}>{SUDDEN_DEATH_BLOCKS[suddenDeathBlock - 1]?.timeSec} segundos</Text>
              </View>
            </View>
          )}

          {exerciseType === 'run_program' && timelinePhases.length > 0 && (
            <View style={dynamicStyles.timelineWrapper}>
              <View style={dynamicStyles.phaseHeaderRow}>
                <Text style={dynamicStyles.currentPhaseText}>{timelinePhases[currentPhaseIndex]?.label}</Text>
                <Text style={dynamicStyles.phaseCountdownText}>{formatHMS(phaseTimeLeft)}</Text>
              </View>
              <View style={dynamicStyles.segmentedProgressBarContainer}>
                {timelinePhases.map((phase, idx) => {
                  const isDone = idx < currentPhaseIndex;
                  const isCurrent = idx === currentPhaseIndex;
                  let segColor = (isDone || isCurrent) ? colors.COLOR_LIME_ENERGY : colors.COLOR_DIVIDER;
                  return (
                    <View key={phase.id} style={dynamicStyles.singlePhaseBarSegmentWrapper}>
                      <View style={[dynamicStyles.singlePhaseBarSegment, { backgroundColor: segColor }, isCurrent && dynamicStyles.singlePhaseBarCurrentActive]} />
                      {idx < timelinePhases.length - 1 && <View style={dynamicStyles.segmentDividerLine} />}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={dynamicStyles.bentoGridActive}>
            <View style={dynamicStyles.bentoCardActive}>
              <Text style={dynamicStyles.metricLabel}>RITMO (MIN/KM)</Text>
              <Text style={dynamicStyles.metricValue}>{distance > 0 ? (seconds / 60 / distance).toFixed(2) : '0.00'}</Text>
            </View>
            <View style={dynamicStyles.bentoCardActive}>
              <Text style={dynamicStyles.metricLabel}>DISTÂNCIA</Text>
              <Text style={dynamicStyles.metricValue}>{distance.toFixed(2)} km</Text>
            </View>
            <View style={dynamicStyles.bentoCardActive}>
              <Text style={dynamicStyles.metricLabel}>TEMPO TOTAL</Text>
              <Text style={dynamicStyles.metricValue}>{formatHMS(seconds)}</Text>
            </View>
            <View style={dynamicStyles.bentoCardActive}>
              <Text style={dynamicStyles.metricLabel}>CALORIAS</Text>
              <Text style={dynamicStyles.metricValue}>{calculateCalories(distance, seconds)} kcal</Text>
            </View>
            <View style={dynamicStyles.bentoCardActive}>
              <Text style={dynamicStyles.metricLabel}>VELOCIDADE</Text>
              <Text style={dynamicStyles.metricValue}>{speed} km/h</Text>
            </View>
            <View style={dynamicStyles.bentoCardActive}>
              <Text style={dynamicStyles.metricLabel}>CADÊNCIA</Text>
              <Text style={[dynamicStyles.metricValue, { color: getCadenceFeedback(cadence, exerciseType).color }]}>{cadence} SPM</Text>
            </View>
          </View>

          <View style={dynamicStyles.activeBtnRow}>
            <TouchableOpacity style={dynamicStyles.pauseBtn} onPress={togglePause}>
              <Text style={dynamicStyles.pauseBtnText}>{isPaused ? 'RETOMAR' : 'PAUSAR'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dynamicStyles.cancelBtn} onPress={cancelExercise}>
              <Text style={dynamicStyles.cancelBtnText}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={dynamicStyles.scrollContent}>
          <Text style={dynamicStyles.appHeaderTitle}>ZERO AOS 5K</Text>

          <View style={dynamicStyles.bentoHeroCardPrimary}>
            <View style={dynamicStyles.cardHeaderRow}>
              <View style={dynamicStyles.cardHeaderLeftRow}>
                <Text style={dynamicStyles.tileNumberLight}>01</Text>
                <Text style={dynamicStyles.cardHeaderTitleLight}>SESSÃO RECOMENDADA</Text>
              </View>
              <TouchableOpacity style={dynamicStyles.statusDotTouchable} onPress={() => setShowStatusInfoModal(true)}>
                <View style={[dynamicStyles.statusDotDark, { backgroundColor: workoutsLast7Days > 0 ? colors.COLOR_LIME_ENERGY : colors.COLOR_RED_ACCENT }]} />
              </TouchableOpacity>
            </View>
            <Text style={dynamicStyles.recommendationTextLight}>
              {RUN_PROGRAM_LEVELS[Math.floor(currentSessionIndex / 3)]?.title} - {RUN_PROGRAM_LEVELS[Math.floor(currentSessionIndex / 3)]?.sessions[currentSessionIndex % 3]}
            </Text>
            <TouchableOpacity style={dynamicStyles.actionBtnLight} onPress={() => handleSelectProgramSession(currentSessionIndex)}>
              <Text style={dynamicStyles.actionBtnTextDark}>INICIAR CORRIDA ➔</Text>
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.bentoRow}>
            <TouchableOpacity style={[dynamicStyles.bentoTileSage, activeMenu === 'caminhadas' && dynamicStyles.activeBentoTileHighlight]} onPress={() => toggleAccordion('caminhadas')}>
              <Text style={dynamicStyles.tileNumberPrimary}>02</Text>
              <Text style={dynamicStyles.tileTitleDark}>CAMINHADAS</Text>
              <Text style={dynamicStyles.tileSubDark}>Explorar variações e desafios</Text>
              <Text style={dynamicStyles.tileActionTextDark}>{activeMenu === 'caminhadas' ? '▲ Fechar' : 'Ver opções ▼'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[dynamicStyles.bentoTileSecondary, activeMenu === 'corrida' && dynamicStyles.activeBentoTileHighlight]} onPress={() => toggleAccordion('corrida')}>
              <Text style={dynamicStyles.tileNumberLight}>03</Text>
              <Text style={dynamicStyles.tileTitleLight}>0 AOS 5K</Text>
              <Text style={dynamicStyles.tileSubLight}>Plano de 25 níveis e 75 sessões</Text>
              <Text style={dynamicStyles.tileActionTextLight}>{activeMenu === 'corrida' ? '▲ Fechar' : 'Ver plano ▼'}</Text>
            </TouchableOpacity>
          </View>

          {activeMenu === 'caminhadas' && (
            <View style={dynamicStyles.accordionBodyGrid}>
              <View style={dynamicStyles.submenuHeader}>
                <Text style={dynamicStyles.submenuHeaderText}>SUBMENU: 02 - CAMINHADAS</Text>
                <TouchableOpacity onPress={() => toggleAccordion('caminhadas')}><Text style={dynamicStyles.submenuCloseText}>▲ FECHAR</Text></TouchableOpacity>
              </View>
              <TouchableOpacity style={dynamicStyles.itemBtn} onPress={() => startExerciseSession('walk_normal', 'Caminhada livre')}><Text style={dynamicStyles.itemBtnText}>Caminhada livre</Text></TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.itemBtn} onPress={() => startExerciseSession('walk_rockport', 'Desafio Rockport (1609m)', { targetDistKm: 1.609 })}><Text style={dynamicStyles.itemBtnText}>Desafio Rockport (1609m)</Text></TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.itemBtn} onPress={() => startExerciseSession('walk_10m', 'Desafio 10 Minutos', { targetTimeSec: 600 })}><Text style={dynamicStyles.itemBtnText}>Desafio 10 Minutos</Text></TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.itemBtn} onPress={() => startExerciseSession('walk_esquina', 'Só até à Esquina (500m)', { targetDistKm: 0.5 })}><Text style={dynamicStyles.itemBtnText}>Desafio Só até à Esquina (500m)</Text></TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.itemBtn} onPress={() => startExerciseSession('walk_2km', 'Desafio 2km sem olhar para o telemóvel', { targetDistKm: 2.0 })}><Text style={dynamicStyles.itemBtnText}>Desafio 2km sem olhar para o telemóvel</Text></TouchableOpacity>
            </View>
          )}

          {activeMenu === 'corrida' && (
            <View style={dynamicStyles.accordionBodyGrid}>
              <View style={dynamicStyles.submenuHeader}>
                <Text style={dynamicStyles.submenuHeaderText}>SUBMENU: 03 - 0 AOS 5K</Text>
                <TouchableOpacity onPress={() => toggleAccordion('corrida')}><Text style={dynamicStyles.submenuCloseText}>▲ FECHAR PLANO</Text></TouchableOpacity>
              </View>
              {RUN_PROGRAM_LEVELS.map((lvl, index) => {
                const currentLevelIndex = Math.floor(currentSessionIndex / 3);
                const isCurrentLevel = index === currentLevelIndex;
                const isOpen = activeLevelAccordion === lvl.id;
                return (
                  <View key={lvl.id} style={dynamicStyles.levelCard}>
                    <TouchableOpacity style={[dynamicStyles.levelHeader, isCurrentLevel && dynamicStyles.levelHeaderActive]} onPress={() => toggleLevelAccordion(lvl.id)}>
                      <View style={dynamicStyles.levelTitleRow}>
                        {isCurrentLevel && <View style={dynamicStyles.currentDot} />}
                        <Text style={[dynamicStyles.levelTitle, isCurrentLevel && dynamicStyles.levelTitleActiveText]}>{lvl.title} {isCurrentLevel ? '(ATUAL)' : ''}</Text>
                      </View>
                      <Text style={dynamicStyles.levelChevron}>{isOpen ? '▲ FECHAR' : '▼'}</Text>
                    </TouchableOpacity>
                    {isOpen && (
                      <View style={dynamicStyles.levelDetailsContainer}>
                        <Text style={dynamicStyles.levelSummaryText}>{lvl.summary}</Text>
                        <View style={dynamicStyles.sessionList}>
                          {lvl.sessions.map((sess, sIdx) => {
                            const globalIdx = index * 3 + sIdx;
                            const isRecommendedSess = globalIdx === currentSessionIndex;
                            const isDoneSess = completedSessions.includes(globalIdx);
                            return (
                              <TouchableOpacity key={sIdx} style={[dynamicStyles.sessBtn, isDoneSess && dynamicStyles.sessBtnDone, isRecommendedSess && dynamicStyles.sessBtnRecommended]} onPress={() => handleSelectProgramSession(globalIdx)}>
                                <Text style={[dynamicStyles.sessBtnText, isDoneSess && dynamicStyles.sessBtnTextDone, isRecommendedSess && dynamicStyles.sessBtnTextRecommended]}>{sess} {isRecommendedSess ? '★' : isDoneSess ? '✓' : ''}</Text>
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
          )}

          <View style={dynamicStyles.bentoRow}>
            <TouchableOpacity style={[dynamicStyles.bentoTileSecondary, activeMenu === 'desafios' && dynamicStyles.activeBentoTileHighlight]} onPress={() => toggleAccordion('desafios')}>
              <Text style={dynamicStyles.tileNumberLight}>04</Text>
              <Text style={dynamicStyles.tileTitleLight}>DESAFIOS</Text>
              <Text style={dynamicStyles.tileSubLight}>Cooper, 1.5 Milhas, Morte Súbita...</Text>
              <Text style={dynamicStyles.tileActionTextLight}>{activeMenu === 'desafios' ? '▲ Fechar' : 'Abrir ▼'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[dynamicStyles.bentoTileSage, activeMenu === 'def' && dynamicStyles.activeBentoTileHighlight]} onPress={() => toggleAccordion('def')}>
              <Text style={dynamicStyles.tileNumberPrimary}>05</Text>
              <Text style={dynamicStyles.tileTitleDark}>DEFINIÇÕES</Text>
              <Text style={dynamicStyles.tileSubDark}>configurações e dados de perfil</Text>
              <Text style={dynamicStyles.tileActionTextDark}>{activeMenu === 'def' ? '▲ Fechar' : 'Configurar ▼'}</Text>
            </TouchableOpacity>
          </View>

          {activeMenu === 'desafios' && (
            <View style={dynamicStyles.accordionBodyGrid}>
              <View style={dynamicStyles.submenuHeader}>
                <Text style={dynamicStyles.submenuHeaderText}>SUBMENU: 04 - DESAFIOS</Text>
                <TouchableOpacity onPress={() => toggleAccordion('desafios')}><Text style={dynamicStyles.submenuCloseText}>▲ FECHAR</Text></TouchableOpacity>
              </View>
              <TouchableOpacity style={dynamicStyles.itemBtn} onPress={() => startExerciseSession('challenge_cooper', 'Teste de Cooper (12 min)', { targetTimeSec: 720 })}><Text style={dynamicStyles.itemBtnText}>Teste de Cooper (12 min)</Text></TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.itemBtn} onPress={() => startExerciseSession('challenge_1.5m', 'Desafio 1,5 Milhas (2400m)', { targetDistKm: 2.4 })}><Text style={dynamicStyles.itemBtnText}>Desafio 1,5 Milhas (2400m)</Text></TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.itemBtn} onPress={() => startExerciseSession('challenge_1milha', 'Desafio 1 Milha (1609m)', { targetDistKm: 1.609 })}><Text style={dynamicStyles.itemBtnText}>Desafio 1 Milha (1609m)</Text></TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.itemBtn} onPress={() => startExerciseSession('challenge_morte_subita', 'Desafio Morte Súbita (1000m)', { targetDistKm: 1.0 })}><Text style={dynamicStyles.itemBtnText}>Desafio Morte Súbita (1000m)</Text></TouchableOpacity>
            </View>
          )}

          {activeMenu === 'def' && (
            <View style={dynamicStyles.accordionBodyGrid}>
              <View style={dynamicStyles.submenuHeader}>
                <Text style={dynamicStyles.submenuHeaderText}>SUBMENU: 05 - DEFINIÇÕES</Text>
                <TouchableOpacity onPress={() => toggleAccordion('def')}><Text style={dynamicStyles.submenuCloseText}>▲ FECHAR</Text></TouchableOpacity>
              </View>
              <Text style={dynamicStyles.sectionSubTitle}>ESQUEMA DE CORES</Text>
              <View style={dynamicStyles.themeSelectorContainer}>
                {Object.keys(THEMES).map((themeKey) => {
                  const isSelected = currentTheme === themeKey;
                  const themeItem = THEMES[themeKey];
                  return (
                    <TouchableOpacity key={themeKey} style={[dynamicStyles.themeBtn, isSelected && dynamicStyles.themeBtnActive]} onPress={() => changeTheme(themeKey)}>
                      <Text style={[dynamicStyles.themeBtnText, isSelected && dynamicStyles.themeBtnTextActive]}>{themeItem.name} {isSelected ? '✓' : ''}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={dynamicStyles.divider} />
              <Text style={dynamicStyles.sectionSubTitle}>PERFIL DO UTILIZADOR</Text>
              <Text style={dynamicStyles.inputLabel}>Peso (kg):</Text>
              <TextInput style={dynamicStyles.input} keyboardType="numeric" value={profile.weight} onChangeText={(val) => saveProfileData({ ...profile, weight: val })} />
              <Text style={dynamicStyles.inputLabel}>Altura (cm):</Text>
              <TextInput style={dynamicStyles.input} keyboardType="numeric" value={profile.height} onChangeText={(val) => saveProfileData({ ...profile, height: val })} />
              <Text style={dynamicStyles.inputLabel}>Idade (anos):</Text>
              <TextInput style={dynamicStyles.input} keyboardType="numeric" value={profile.age} onChangeText={(val) => saveProfileData({ ...profile, age: val })} />

              <View style={dynamicStyles.divider} />
              <TouchableOpacity style={dynamicStyles.dangerBtn} onPress={handleResetAllData}>
                <Text style={dynamicStyles.dangerBtnText}>REINICIAR TODA A APLICAÇÃO</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={[dynamicStyles.bentoHeroBottom, activeMenu === 'historico' && dynamicStyles.activeBentoTileHighlight]} onPress={() => toggleAccordion('historico')}>
            <View style={dynamicStyles.cardHeaderRow}>
              <Text style={dynamicStyles.cardHeaderTitleDark}>HISTÓRICO DE EXERCÍCIOS</Text>
              <Text style={dynamicStyles.accordionIcon}>{activeMenu === 'historico' ? '▲ FECHAR' : '▼ VER'}</Text>
            </View>
            <Text style={dynamicStyles.recommendationTextDark}>{history.length} treinos registados no total</Text>
          </TouchableOpacity>

          {activeMenu === 'historico' && (
            <View style={dynamicStyles.accordionBodyGrid}>
              <View style={dynamicStyles.submenuHeader}>
                <Text style={dynamicStyles.submenuHeaderText}>SUBMENU: HISTÓRICO</Text>
                <TouchableOpacity onPress={() => toggleAccordion('historico')}><Text style={dynamicStyles.submenuCloseText}>▲ FECHAR</Text></TouchableOpacity>
              </View>
              {history.length === 0 ? (
                <Text style={dynamicStyles.emptyText}>Nenhum exercício concluído ainda.</Text>
              ) : (
                history.map((item) => (
                  <View key={item.id} style={dynamicStyles.historyCard}>
                    <View style={dynamicStyles.historyHeaderRow}>
                      <Text style={dynamicStyles.historyTitle}>{item.title} - {item.date}</Text>
                      <TouchableOpacity onPress={() => handleDeleteHistoryItem(item.id)}><Text>🗑️</Text></TouchableOpacity>
                    </View>
                    <Text style={dynamicStyles.historySub}>Distância: {item.distanceKm} km | Tempo: {formatHMS(item.timeSec)}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          <TouchableOpacity style={dynamicStyles.batterySectionTouchable} onPress={() => setShowBatteryInfoModal(true)}>
            <View style={dynamicStyles.batteryTitleRow}>
              <Text style={dynamicStyles.batterySectionTitle}>BARRA DE ENERGIA DO PLANO (75 SESSÕES)</Text>
            </View>
            <View style={dynamicStyles.batteryContainer}>
              <View style={dynamicStyles.batterySubGrid}>
                {Array.from({ length: 75 }).map((_, idx) => (
                  <View key={idx} style={[dynamicStyles.batterySegmentSlim, { backgroundColor: completedSessions.includes(idx) ? colors.COLOR_LIME_ENERGY : colors.COLOR_DIVIDER }]} />
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.COLOR_BG_MAIN },
  scrollContent: { padding: 16, paddingTop: 28, paddingBottom: 40 },
  activeExerciseScroll: { padding: 20, paddingTop: 36, paddingBottom: 40 },
  appHeaderTitle: { fontSize: 26, fontWeight: '900', color: colors.COLOR_PRIMARY, textAlign: 'center', marginBottom: 20, marginTop: 16, letterSpacing: 2 },
  mapContainer: { height: 220, borderRadius: 16, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: colors.COLOR_DIVIDER, backgroundColor: '#061414' },
  map: { flex: 1, backgroundColor: 'transparent' },
  bentoHeroCardPrimary: { backgroundColor: colors.COLOR_PRIMARY, borderRadius: 20, padding: 18, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardHeaderLeftRow: { flexDirection: 'row', alignItems: 'center' },
  tileNumberLight: { color: colors.COLOR_LIME_ENERGY, fontWeight: '800', fontSize: 16, marginRight: 8 },
  cardHeaderTitleLight: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 1 },
  statusDotTouchable: { padding: 6 },
  statusDotDark: { width: 12, height: 12, borderRadius: 6 },
  recommendationTextLight: { color: '#E2E8F0', fontSize: 16, fontWeight: '600', marginBottom: 14 },
  actionBtnLight: { backgroundColor: colors.COLOR_LIME_ENERGY, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  actionBtnTextDark: { color: colors.COLOR_PRIMARY, fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  bentoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  bentoTileSage: { backgroundColor: colors.COLOR_CARD_BG, borderRadius: 20, padding: 16, width: '48%', borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  bentoTileSecondary: { backgroundColor: colors.COLOR_PRIMARY, borderRadius: 20, padding: 16, width: '48%' },
  tileNumberPrimary: { color: colors.COLOR_SECONDARY, fontWeight: '800', fontSize: 16, marginBottom: 4 },
  tileTitleDark: { color: colors.COLOR_PRIMARY, fontWeight: '800', fontSize: 15, marginBottom: 4 },
  tileSubDark: { color: colors.COLOR_SECONDARY, fontSize: 11, marginBottom: 12, lineHeight: 14 },
  tileActionTextDark: { color: colors.COLOR_PRIMARY, fontWeight: '700', fontSize: 11 },
  tileTitleLight: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  tileSubLight: { color: '#CBD5E1', fontSize: 11, marginBottom: 12, lineHeight: 14 },
  tileActionTextLight: { color: colors.COLOR_LIME_ENERGY, fontWeight: '700', fontSize: 11 },
  activeBentoTileHighlight: { borderWidth: 2, borderColor: colors.COLOR_LIME_ENERGY },
  accordionBodyGrid: { backgroundColor: colors.COLOR_CARD_BG, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  submenuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.COLOR_DIVIDER, paddingBottom: 8 },
  submenuHeaderText: { color: colors.COLOR_PRIMARY, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  submenuCloseText: { color: colors.COLOR_SECONDARY, fontWeight: '700', fontSize: 11 },
  itemBtn: { backgroundColor: colors.COLOR_BG_MAIN, padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  itemBtnText: { color: colors.COLOR_PRIMARY, fontWeight: '600', fontSize: 13 },
  levelCard: { backgroundColor: colors.COLOR_BG_MAIN, borderRadius: 12, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  levelHeaderActive: { backgroundColor: colors.COLOR_DIVIDER },
  levelTitleRow: { flexDirection: 'row', alignItems: 'center' },
  currentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.COLOR_PRIMARY, marginRight: 6 },
  levelTitle: { fontWeight: '700', fontSize: 13, color: colors.COLOR_PRIMARY },
  levelTitleActiveText: { fontWeight: '900' },
  levelChevron: { fontSize: 11, color: colors.COLOR_SECONDARY, fontWeight: '700' },
  levelDetailsContainer: { padding: 12, paddingTop: 0 },
  levelSummaryText: { fontSize: 11, color: colors.COLOR_SECONDARY, marginBottom: 8, fontStyle: 'italic' },
  sessionList: { flexDirection: 'row', justifyContent: 'space-between' },
  sessBtn: { backgroundColor: colors.COLOR_CARD_BG, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, flex: 1, marginHorizontal: 2, alignItems: 'center', borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  sessBtnDone: { backgroundColor: colors.COLOR_LIME_ENERGY },
  sessBtnRecommended: { borderColor: colors.COLOR_PRIMARY, borderWidth: 2 },
  sessBtnText: { fontSize: 11, fontWeight: '600', color: colors.COLOR_PRIMARY },
  sessBtnTextDone: { color: '#FFFFFF' },
  sessBtnTextRecommended: { fontWeight: '800' },
  bentoHeroBottom: { backgroundColor: colors.COLOR_CARD_BG, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  cardHeaderTitleDark: { color: colors.COLOR_PRIMARY, fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  recommendationTextDark: { color: colors.COLOR_SECONDARY, fontSize: 13, fontWeight: '600', marginTop: 4 },
  accordionIcon: { color: colors.COLOR_PRIMARY, fontWeight: '700', fontSize: 11 },
  historyCard: { backgroundColor: colors.COLOR_BG_MAIN, padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  historyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  historyTitle: { fontWeight: '700', fontSize: 13, color: colors.COLOR_PRIMARY },
  historySub: { fontSize: 11, color: colors.COLOR_SECONDARY },
  emptyText: { color: colors.COLOR_SECONDARY, fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: 10 },
  batterySectionTouchable: { backgroundColor: colors.COLOR_CARD_BG, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  batteryTitleRow: { marginBottom: 10 },
  batterySectionTitle: { color: colors.COLOR_PRIMARY, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  batteryContainer: { alignItems: 'center' },
  batterySubGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%' },
  batterySegmentSlim: { width: '2.9%', height: 16, margin: '0.4%', borderRadius: 2 },
  activeBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  pauseBtn: { backgroundColor: colors.COLOR_PRIMARY, borderRadius: 14, padding: 16, flex: 1, marginRight: 8, alignItems: 'center' },
  pauseBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  cancelBtn: { backgroundColor: colors.COLOR_RED_ACCENT, borderRadius: 14, padding: 16, width: 120, alignItems: 'center' },
  cancelBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  bentoGridActive: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 },
  bentoCardActive: { backgroundColor: colors.COLOR_CARD_BG, borderRadius: 16, padding: 14, width: '48%', marginBottom: 10, borderWidth: 1, borderColor: colors.COLOR_DIVIDER, alignItems: 'center' },
  metricLabel: { color: colors.COLOR_SECONDARY, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  metricValue: { color: colors.COLOR_PRIMARY, fontSize: 18, fontWeight: '900' },
  headerContainerActive: { alignItems: 'center', marginBottom: 16 },
  activeTitle: { fontSize: 20, fontWeight: '900', color: colors.COLOR_PRIMARY, textAlign: 'center' },
  rockportProgressCard: { backgroundColor: colors.COLOR_CARD_BG, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  rockportHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rockportLabel: { color: colors.COLOR_PRIMARY, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  rockportValue: { color: colors.COLOR_SECONDARY, fontWeight: '700', fontSize: 11 },
  progressBarBackground: { height: 8, backgroundColor: colors.COLOR_DIVIDER, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', backgroundColor: colors.COLOR_LIME_ENERGY, borderRadius: 4 },
  recordHighlightBox: { backgroundColor: colors.COLOR_BG_MAIN, padding: 8, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordTitle: { color: colors.COLOR_SECONDARY, fontSize: 10, fontWeight: '700' },
  recordValue: { color: colors.COLOR_PRIMARY, fontSize: 12, fontWeight: '800' },
  timelineWrapper: { backgroundColor: colors.COLOR_CARD_BG, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  phaseHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  currentPhaseText: { color: colors.COLOR_PRIMARY, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  phaseCountdownText: { color: colors.COLOR_SECONDARY, fontWeight: '800', fontSize: 14 },
  segmentedProgressBarContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 12 },
  singlePhaseBarSegmentWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%', paddingHorizontal: 1 },
  singlePhaseBarSegment: { flex: 1, height: 6, borderRadius: 3 },
  singlePhaseBarCurrentActive: { height: 10 },
  segmentDividerLine: { width: 1, height: 4, backgroundColor: '#FFFFFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.COLOR_CARD_BG, borderRadius: 20, padding: 20, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  modalTitle: { fontSize: 16, fontWeight: '900', color: colors.COLOR_PRIMARY, marginBottom: 10, textAlign: 'center' },
  modalText: { fontSize: 13, color: colors.COLOR_SECONDARY, lineHeight: 18, marginBottom: 16, textAlign: 'center' },
  modalBtn: { backgroundColor: colors.COLOR_PRIMARY, borderRadius: 12, padding: 12, alignItems: 'center' },
  modalBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  esquinaCard: { backgroundColor: colors.COLOR_CARD_BG, borderRadius: 20, padding: 20, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: colors.COLOR_DIVIDER, alignItems: 'center' },
  esquinaTitle: { fontSize: 18, fontWeight: '900', color: colors.COLOR_PRIMARY, marginBottom: 10, textAlign: 'center' },
  esquinaText: { fontSize: 13, color: colors.COLOR_SECONDARY, lineHeight: 18, marginBottom: 20, textAlign: 'center' },
  esquinaYesBtn: { backgroundColor: colors.COLOR_LIME_ENERGY, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 10 },
  esquinaYesBtnText: { color: colors.COLOR_PRIMARY, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  esquinaNoBtn: { backgroundColor: colors.COLOR_PRIMARY, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center' },
  esquinaNoBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  sectionSubTitle: { color: colors.COLOR_PRIMARY, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  themeSelectorContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  themeBtn: { backgroundColor: colors.COLOR_BG_MAIN, borderRadius: 10, padding: 10, flex: 1, marginHorizontal: 2, alignItems: 'center', borderWidth: 1, borderColor: colors.COLOR_DIVIDER },
  themeBtnActive: { borderColor: colors.COLOR_PRIMARY, borderWidth: 2, backgroundColor: colors.COLOR_CARD_BG },
  themeBtnText: { fontSize: 10, fontWeight: '700', color: colors.COLOR_PRIMARY, marginTop: 4 },
  themeBtnTextActive: { fontWeight: '900' },
  inputLabel: { fontSize: 11, fontWeight: '700', color: colors.COLOR_SECONDARY, marginBottom: 4 },
  input: { backgroundColor: colors.COLOR_BG_MAIN, borderWidth: 1, borderColor: colors.COLOR_DIVIDER, borderRadius: 10, padding: 10, fontSize: 13, color: colors.COLOR_PRIMARY, marginBottom: 10 },
  divider: { height: 1, backgroundColor: colors.COLOR_DIVIDER, marginVertical: 14 },
  dangerBtn: { backgroundColor: colors.COLOR_RED_ACCENT, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 6 },
  dangerBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, letterSpacing: 1 }
});