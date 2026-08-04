// ============================================================================
// MÓDULO ISOLADO: REGISTO DE DIAGNÓSTICO / RELATÓRIO DE ERROS
// ----------------------------------------------------------------------------
// Pequeno "log" interno da app, guardado em memória e persistido no
// AsyncStorage, para conseguirmos perceber o que se passa em funcionalidades
// difíceis de depurar à distância (ex: balança Xiaomi via Bluetooth, Google
// Fit / Health Connect). Não é importado por nada crítico da app — é só um
// extra de diagnóstico, por isso uma falha aqui nunca deve conseguir
// rebentar nenhuma outra funcionalidade (todas as funções protegem-se a si
// próprias com try/catch e nunca lançam erro para quem as chama).
//
// Como usar noutros ficheiros:
//   import { logEvent } from '../utils/debugLog';
//   logEvent('GoogleFit', 'Erro ao inicializar', error);
//
// Como ver o relatório: menu DEFINIÇÕES → "Relatório de Erros e Diagnóstico".
// ============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG_LOG_KEY = '@app_debug_log';
const MAX_ENTRIES = 200;

let memoryLog = [];
let loaded = false;
let loadPromise = null;

const persist = async () => {
  try {
    await AsyncStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(memoryLog));
  } catch (e) {
    // Falha a guardar o log não pode nunca rebentar a app.
  }
};

const ensureLoaded = async () => {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const saved = await AsyncStorage.getItem(DEBUG_LOG_KEY);
        if (saved) memoryLog = JSON.parse(saved);
      } catch (e) {
        memoryLog = [];
      }
      loaded = true;
    })();
  }
  await loadPromise;
};

// Converte erros/objetos extra num sufixo de texto legível, sem nunca
// lançar exceção (mesmo com objetos estranhos, referências circulares, etc.)
const stringifyExtra = (extra) => {
  if (extra === undefined || extra === null) return '';
  if (extra instanceof Error) {
    const codePart = extra.code ? ` | code: ${extra.code}` : '';
    return ` — erro: ${extra.message || String(extra)}${codePart}`;
  }
  try {
    return ` — ${JSON.stringify(extra)}`;
  } catch (e) {
    try {
      return ` — ${String(extra)}`;
    } catch (e2) {
      return '';
    }
  }
};

/**
 * Regista um evento de diagnóstico. Nunca lança erro — é seguro chamar de
 * qualquer sítio, incluindo dentro de blocos catch.
 * @param {string} scope - área da app (ex: 'GoogleFit', 'BalançaXiaomi', 'GPS')
 * @param {string} message - descrição curta do que aconteceu
 * @param {any} [extra] - dados adicionais (objeto, Error, etc.) — opcional
 */
export const logEvent = (scope, message, extra) => {
  try {
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time: new Date().toLocaleString('pt-PT'),
      scope: scope || 'Geral',
      message: `${message || ''}${stringifyExtra(extra)}`,
    };
    memoryLog = [entry, ...memoryLog].slice(0, MAX_ENTRIES);
    persist();
    return entry;
  } catch (e) {
    return null;
  }
};

/** Devolve todas as entradas do log (mais recente primeiro). */
export const getDebugLog = async () => {
  try {
    await ensureLoaded();
    return memoryLog;
  } catch (e) {
    return [];
  }
};

/** Limpa por completo o registo de diagnóstico. */
export const clearDebugLog = async () => {
  memoryLog = [];
  loaded = true;
  await persist();
};

/** Formata as entradas do log como texto simples, pronto a copiar/partilhar. */
export const formatDebugLogAsText = (entries) => {
  if (!entries || entries.length === 0) {
    return 'Sem registos de diagnóstico ainda. Usa a app normalmente (ex: tenta ligar à balança ou abrir o menu Saúde) e depois volta aqui.';
  }
  return entries.map((e) => `[${e.time}] (${e.scope}) ${e.message}`).join('\n');
};
