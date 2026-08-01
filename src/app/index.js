import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  ImageBackground,
  Platform,
  SafeAreaView,
  StatusBar,
  Vibration,
  View,
} from 'react-native';

import { THEMES } from './constants/themes';
import { RUN_PROGRAM_LEVELS, SUDDEN_DEATH_BLOCKS } from './constants/runProgram';
import { LOCATION_TASK_NAME, setBackgroundLocationHandler } from './tasks/locationTask';
import { getStyles } from './styles/styles';
import {
  calculateCalories,
  calculateHaversine,
  calculate15MilesVo2Max,
  calculate1MileRunVo2Max,
  calculateRockportVo2Max,
  generateTimeline,
} from './utils/calculations';

import AppModals from './components/modals/AppModals';
import MainScreen from './components/MainScreen';
import ActiveExerciseScreen from './components/ActiveExerciseScreen';

const APP_BACKGROUND_IMAGE = require('../../assets/images/fundo.png');

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

  // Opacidade do "nevoeiro" sobre a imagem de fundo (0 = imagem bem visível, 1 = totalmente escondida)
  const [fogOpacity, setFogOpacity] = useState(0.45);

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

  // --- NOVO: Estado de perda de GPS / Rede ---
  const [noSignalAlert, setNoSignalAlert] = useState(false);
  
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
  const lastMilhaNoticeStep = useRef(0);

  // --- NOVO: Ref de segurança (Ponto 3) ---
  const lastMovementTimeRef = useRef(Date.now());
  const safetyPauseTriggeredRef = useRef(false);

  const isPausedRef = useRef(false);
  const isExercisingRef = useRef(false);
  const isFinishingRef = useRef(false);
  const exerciseTypeRef = useRef('');
  const exerciseTitleRef = useRef('');
  const secondsRef = useRef(0);
  const distanceRef = useRef(0);
  const speedRef = useRef(0);
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

      const savedFogOpacity = await AsyncStorage.getItem('@fog_opacity');
      if (savedFogOpacity !== null) {
        const parsedOpacity = parseFloat(savedFogOpacity);
        if (!isNaN(parsedOpacity)) setFogOpacity(Math.max(0, Math.min(1, parsedOpacity)));
      }

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

  const changeFogOpacity = async (value) => {
    const clamped = Math.max(0, Math.min(1, value));
    setFogOpacity(clamped);
    await AsyncStorage.setItem('@fog_opacity', clamped.toString());
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
      // Nota: sem Speech.stop() aqui de propósito — cada comando de áudio fica em fila
      // e toca até ao fim antes do próximo começar, em vez de ser interrompido.
      const voices = await Speech.getAvailableVoicesAsync();
      const ptPtVoice = voices.find(v => v.language && (v.language.toLowerCase() === 'pt-pt' || v.language.toLowerCase() === 'pt_pt'));
      const options = { language: 'pt-PT' };
      if (ptPtVoice) options.voice = ptPtVoice.identifier;
      Speech.speak(text, options);
    } catch (error) {
      Speech.speak(text, { language: 'pt-PT' });
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

  // --- NOVO: Função para ativar a Pausa de Segurança (Ponto 3) ---
  const triggerSafetyPause = (reason) => {
    if (isPausedRef.current || safetyPauseTriggeredRef.current) return;
    safetyPauseTriggeredRef.current = true;
    
    pauseStartTimeRef.current = Date.now();
    setIsPaused(true);
    setSpeed(0);

    Vibration.vibrate([500, 300, 500, 300, 500]);
    const message = reason === 'speed' 
      ? 'Velocidade demasiado elevada detetada. Exercício pausado.' 
      : 'Paragem prolongada detetada. Exercício pausado.';
    playAudio(message);

    Alert.alert(
      '⚠️ Pausa de Segurança',
      reason === 'speed'
        ? 'Detetámos uma velocidade muito elevada para corrida (possível transporte veicular).'
        : 'Detetámos uma paragem prolongada sem movimento.',
      [
        {
          text: 'Cancelar Treino',
          style: 'destructive',
          onPress: () => {
            safetyPauseTriggeredRef.current = false;
            stopAndCleanupExercise();
          },
        },
        {
          text: 'Continuar Exercício',
          onPress: () => {
            safetyPauseTriggeredRef.current = false;
            if (pauseStartTimeRef.current) {
              totalPausedTimeRef.current += (Date.now() - pauseStartTimeRef.current);
            }
            lastMovementTimeRef.current = Date.now();
            setIsPaused(false);
          },
        },
      ],
      { cancelable: false }
    );
  };

  const tickExercise = (now, currentDist, currentSpeed) => {
    if (!isExercisingRef.current || isPausedRef.current || isFinishingRef.current || !startTimeRef.current) return;

    // Ponto 3: Verificação de Paragem Prolongada (> 120s sem alteração significativa na distância)
    if (!safetyPauseTriggeredRef.current && (now - lastMovementTimeRef.current > 120000)) {
      triggerSafetyPause('inactivity');
      return;
    }

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
    // --- PONTO 5: Verificação preliminar de GPS e Rede ---
    let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    const gpsEnabled = await Location.hasServicesEnabledAsync();
    const netState = await Network.getNetworkStateAsync();

    if (fgStatus !== 'granted' || !gpsEnabled || !netState.isConnected) {
      setNoSignalAlert(true);
      Alert.alert(
        'Sinal Indisponível ⚠️',
        'Não foi possível iniciar o treino por falta de sinal de GPS ou de rede móvel/Wi-Fi.',
        [{ text: 'Entendido', onPress: () => setNoSignalAlert(false) }]
      );
      return;
    }

    let { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      Alert.alert('Aviso: Ecrã Desligado', 'Para garantir que a contagem não para quando desligares o ecrã, escolhe a opção "Permitir sempre" nas definições.');
    }

    promptBatteryOptimizationIfNeeded();

    setExerciseType(type);
    exerciseTypeRef.current = type;
    setExerciseTitle(title);
    exerciseTitleRef.current = title;
    setActiveConfig(config);
    activeConfigRef.current = config;

    setSeconds(0);
    setDistance(0);
    setSpeed(0);
    setVo2MaxResult(null);
    setShowEsquinaModal(false);
    esquinaTargetMultiplierRef.current = 1;
    hasGoneBackgroundRef.current = false;
    lastMilhaNoticeStep.current = 0;
    lastMovementTimeRef.current = Date.now();
    safetyPauseTriggeredRef.current = false;

    setSuddenDeathBlock(1);
    suddenDeathBlockRef.current = 1;
    suddenDeathBlockStartTimeRef.current = Date.now();
    lastCountdownSecRef.current = -1;

    setIsExercising(true);
    setIsPaused(false);
    isFinishingRef.current = false;
    
    secondsRef.current = 0;
    distanceRef.current = 0;
    speedRef.current = 0;
    lastLocation.current = null;

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
      // Proteção contra atualizações de GPS "perdidas" que ainda chegam depois de o
      // exercício ter sido cancelado/terminado (ex: race condition entre o cancelamento
      // e a paragem efetiva da tarefa de localização em segundo plano).
      if (!isExercisingRef.current || isPausedRef.current || isFinishingRef.current) return;

      const { latitude, longitude, speed: currentSpeed } = loc.coords;
      const speedKmH = currentSpeed && currentSpeed > 0 ? (currentSpeed * 3.6).toFixed(1) : 0;
      setSpeed(speedKmH);
      speedRef.current = speedKmH;

      // Ponto 3: Deteção de velocidade excessiva em veículo (> 25 km/h)
      if (parseFloat(speedKmH) > 25) {
        triggerSafetyPause('speed');
        return;
      }

      let newDist = distanceRef.current;
      if (lastLocation.current) {
        const added = calculateHaversine(lastLocation.current.latitude, lastLocation.current.longitude, latitude, longitude);
        if (added > 0.001) {
          newDist = distanceRef.current + added;
          setDistance(newDist);
          distanceRef.current = newDist;
          lastMovementTimeRef.current = Date.now(); // Atualiza tempo de último movimento
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

    setBackgroundLocationHandler(handleLocationUpdate);

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

  // Ponto: Saltar aquecimento/arrefecimento EM DIRETO, sem ter de cancelar a sessão.
  // Só é permitido saltar a fase que está atualmente em curso (aquecimento ou arrefecimento).
  const skipCurrentPhase = () => {
    const phases = activeConfigRef.current?.phases;
    if (!phases || !phases.length) return;

    const idx = currentPhaseIndexRef.current;
    const currentPhase = phases[idx];
    if (!currentPhase || (currentPhase.type !== 'warmup' && currentPhase.type !== 'cooldown')) return;

    // Soma a duração de todas as fases até (e incluindo) a fase atual, e "empurra" o
    // relógio interno do exercício para essa fronteira, saltando o tempo restante desta fase.
    let accumulated = 0;
    for (let i = 0; i <= idx; i++) accumulated += phases[i].durationSec;

    const secondsToSkip = accumulated - secondsRef.current;
    if (secondsToSkip > 0) {
      totalPausedTimeRef.current -= secondsToSkip * 1000;
    }
    secondsRef.current = accumulated;
    setSeconds(accumulated);

    if (idx >= phases.length - 1) {
      // Era a última fase (arrefecimento a fechar a sessão) - termina o treino já.
      autoFinishExercise(exerciseTypeRef.current, exerciseTitleRef.current, accumulated, distanceRef.current, speedRef.current, activeConfigRef.current);
      return;
    }

    const nextIdx = idx + 1;
    currentPhaseIndexRef.current = nextIdx;
    setCurrentPhaseIndex(nextIdx);
    setPhaseTimeLeft(phases[nextIdx].durationSec);
    Vibration.vibrate([300, 100, 300]);
    if (phases[nextIdx].type === 'run') playAudio('Comece a correr');
    else if (phases[nextIdx].type === 'walk') playAudio('Comece a andar');
    else if (phases[nextIdx].type === 'cooldown') playAudio('Início do arrefecimento');
    else if (phases[nextIdx].type === 'warmup') playAudio('Aquecimento');
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

  // --- PONTO 1 & 3: Terminar exercício voluntariamente ou via botão ---
  const handleUserFinishExercise = () => {
    Alert.alert(
      'Terminar Treino',
      'Deseja terminar e guardar este exercício no histórico?',
      [
        { text: 'Continuar a andar/correr', style: 'cancel' },
        { text: 'Não Guardar', style: 'destructive', onPress: () => stopAndCleanupExercise() },
        {
          text: 'Guardar Treino',
          onPress: () => {
            autoFinishExercise(exerciseType, exerciseTitle, secondsRef.current, distanceRef.current, speedRef.current, activeConfigRef.current);
          },
        },
      ]
    );
  };

  const cancelExercise = () => {
    Alert.alert('Cancelar Treino', 'Tem a certeza que deseja cancelar?', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim, Cancelar', style: 'destructive', onPress: () => stopAndCleanupExercise() }
    ]);
  };

  const stopAndCleanupExercise = () => {
    // Marca imediatamente como "a terminar" para bloquear qualquer tick ou atualização de
    // localização que já esteja em curso neste preciso instante, e limpa qualquer mensagem
    // de áudio que ainda esteja em fila/a tocar. Isto fecha o "buraco" que permitia que o
    // aviso de fim de bloco da Morte Súbita continuasse a repetir-se depois de cancelar.
    isFinishingRef.current = true;
    try { Speech.stop(); } catch (e) {}

    if (locationTaskActiveRef.current) {
      locationTaskActiveRef.current = false;
      setBackgroundLocationHandler(null);
      Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
        .then((started) => { if (started) return Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME); })
        .catch(() => {});
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Reset completo da identidade do exercício, para que nenhuma referência antiga (tipo,
    // configuração, bloco da Morte Súbita, cronómetro, etc.) sobreviva depois de cancelar.
    exerciseTypeRef.current = '';
    exerciseTitleRef.current = '';
    activeConfigRef.current = null;
    startTimeRef.current = null;
    pauseStartTimeRef.current = null;
    totalPausedTimeRef.current = 0;
    secondsRef.current = 0;
    distanceRef.current = 0;
    speedRef.current = 0;
    currentPhaseIndexRef.current = 0;
    suddenDeathBlockRef.current = 1;
    suddenDeathBlockStartTimeRef.current = 0;
    lastCountdownSecRef.current = -1;

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
      vo2Val = calculateRockportVo2Max(finalSec, finalDist, profile);
      setVo2MaxResult(vo2Val);
    } else if (type === 'challenge_1.5m') {
      vo2Val = calculate15MilesVo2Max(finalSec);
      setVo2MaxResult(vo2Val);
    } else if (type === 'challenge_1milha') {
      vo2Val = calculate1MileRunVo2Max(finalSec, profile);
      setVo2MaxResult(vo2Val);
    }
    playAudio(finishMessage);

    const newRecord = {
      id: Date.now().toString(),
      title,
      date: new Date().toLocaleDateString('pt-PT'),
      // startTime/endTime (ISO): usados apenas pelo menu Saúde para não
      // contar as mesmas calorias duas vezes com o Google Fit. Não afeta
      // nenhuma lógica existente do histórico ou das restantes secções.
      startTime: startTimeRef.current ? new Date(startTimeRef.current).toISOString() : null,
      endTime: new Date().toISOString(),
      timeSec: finalSec,
      distanceKm: finalDist.toFixed(2),
      pace: finalDist > 0 ? (finalSec / 60 / finalDist).toFixed(2) : '0.00',
      calories: calculateCalories(finalDist, finalSec, profile.weight),
      speed: finalSpeed,
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

  // Ponto 4: Conta DIAS DISTINTOS (não o nº de treinos) com pelo menos um exercício
  // guardado no histórico nos últimos 7 dias — é isso que decide a cor da bola de status.
  const getWorkoutsLast7DaysCount = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const uniqueDays = new Set();
    history.forEach(item => {
      const parts = item.date.split('/');
      if (parts.length === 3) {
        const itemDate = new Date(parts[2], parts[1] - 1, parts[0]);
        if (itemDate >= sevenDaysAgo) {
          uniqueDays.add(item.date);
        }
      }
    });
    return uniqueDays.size;
  };

  const workoutsLast7Days = getWorkoutsLast7DaysCount();
  const toggleAccordion = (menuName) => setActiveMenu(activeMenu === menuName ? null : menuName);
  const toggleLevelAccordion = (lvlId) => setActiveLevelAccordion(activeLevelAccordion === lvlId ? null : lvlId);

  const dynamicStyles = getStyles(colors);

  return (
    <ImageBackground source={APP_BACKGROUND_IMAGE} style={{ flex: 1 }} resizeMode="cover">
    <View style={[dynamicStyles.backgroundFogOverlay, { opacity: fogOpacity }]} pointerEvents="none" />
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <AppModals
        colors={colors}
        styles={dynamicStyles}
        showProfileAlert={showProfileAlert}
        onCloseProfileAlert={() => setShowProfileAlert(false)}
        showStatusInfoModal={showStatusInfoModal}
        onCloseStatusInfoModal={() => setShowStatusInfoModal(false)}
        showBatteryInfoModal={showBatteryInfoModal}
        onCloseBatteryInfoModal={() => setShowBatteryInfoModal(false)}
        showBatteryOptimizationModal={showBatteryOptimizationModal}
        onOpenBatterySettings={openBatteryOptimizationSettings}
        onDismissBatteryOptimization={dismissBatteryOptimizationModal}
        showEsquinaModal={showEsquinaModal}
        onContinueEsquinaChallenge={handleContinueEsquinaChallenge}
        onFinishEsquinaChallenge={handleFinishEsquinaChallenge}
      />

      {isExercising ? (
        <ActiveExerciseScreen
          colors={colors}
          styles={dynamicStyles}
          webviewRef={webviewRef}
          onMapLoadEnd={() => { setIsMapReady(true); pushMapUpdate(); }}
          exerciseTitle={exerciseTitle}
          exerciseType={exerciseType}
          suddenDeathBlock={suddenDeathBlock}
          distance={distance}
          timelinePhases={timelinePhases}
          currentPhaseIndex={currentPhaseIndex}
          phaseTimeLeft={phaseTimeLeft}
          seconds={seconds}
          speed={speed}
          profile={profile}
          activeConfig={activeConfig}
          isPaused={isPaused}
          onTogglePause={togglePause}
          onFinishUser={handleUserFinishExercise}
          onCancel={cancelExercise}
          onSkipPhase={skipCurrentPhase}
          noSignalAlert={noSignalAlert}
        />
      ) : (
        <MainScreen
          colors={colors}
          styles={dynamicStyles}
          currentSessionIndex={currentSessionIndex}
          workoutsLast7Days={workoutsLast7Days}
          onShowStatusInfo={() => setShowStatusInfoModal(true)}
          onSelectProgramSession={handleSelectProgramSession}
          activeMenu={activeMenu}
          onToggleAccordion={toggleAccordion}
          activeLevelAccordion={activeLevelAccordion}
          onToggleLevelAccordion={toggleLevelAccordion}
          completedSessions={completedSessions}
          onStartExercise={startExerciseSession}
          currentTheme={currentTheme}
          onChangeTheme={changeTheme}
          profile={profile}
          onSaveProfile={saveProfileData}
          onResetAllData={handleResetAllData}
          history={history}
          onDeleteHistoryItem={handleDeleteHistoryItem}
          onShowBatteryInfo={() => setShowBatteryInfoModal(true)}
          fogOpacity={fogOpacity}
          onChangeFogOpacity={changeFogOpacity}
        />
      )}
    </SafeAreaView>
    </ImageBackground>
  );
}