// --- CONFIGURAÇÃO DO DESAFIO MORTE SÚBITA ---
export const SUDDEN_DEATH_BLOCKS = [
  { block: 1, distKm: 0.1, timeSec: 65 },
  { block: 2, distKm: 0.1, timeSec: 60 },
  { block: 3, distKm: 0.1, timeSec: 55 },
  { block: 4, distKm: 0.1, timeSec: 50 },
  { block: 5, distKm: 0.1, timeSec: 45 },
  { block: 6, distKm: 0.1, timeSec: 40 },
  { block: 7, distKm: 0.1, timeSec: 35 },
  { block: 8, distKm: 0.1, timeSec: 30 },
  { block: 9, distKm: 0.1, timeSec: 25 },
  { block: 10, distKm: 0.1, timeSec: 20 },
];

// --- PROGRAMA 0 AOS 5K (75 SESSÕES / 25 NÍVEIS) ---
export const RUN_PROGRAM_LEVELS = [
  { id: 1, title: 'Nível 1', sessions: ['Sessão 1', 'Sessão 2', 'Sessão 3'], summary: '10s corrida / 1m caminhada (18 repetições)', runSec: 10, walkSec: 60, repeats: 18 },
  { id: 2, title: 'Nível 2', sessions: ['Sessão 4', 'Sessão 5', 'Sessão 6'], summary: '15s corrida / 1m caminhada (17 repetições)', runSec: 15, walkSec: 60, repeats: 17 },
  { id: 3, title: 'Nível 3', sessions: ['Sessão 7', 'Sessão 8', 'Sessão 9'], summary: '20s corrida / 1m caminhada (16 repetições)', runSec: 20, walkSec: 60, repeats: 16 },
  { id: 4, title: 'Nível 4', sessions: ['Sessão 10', 'Sessão 11', 'Sessão 12'], summary: '25s corrida / 1m caminhada (15 repetições)', runSec: 25, walkSec: 60, repeats: 15 },
  { id: 5, title: 'Nível 5', sessions: ['Sessão 13', 'Sessão 14', 'Sessão 15'], summary: '30s corrida / 1m caminhada (14 repetições)', runSec: 30, walkSec: 60, repeats: 14 },
  { id: 6, title: 'Nível 6', sessions: ['Sessão 16', 'Sessão 17', 'Sessão 18'], summary: '35s corrida / 1m caminhada (13 repetições)', runSec: 35, walkSec: 60, repeats: 13 },
  { id: 7, title: 'Nível 7', sessions: ['Sessão 19', 'Sessão 20', 'Sessão 21'], summary: '40s corrida / 1m caminhada (13 repetições)', runSec: 40, walkSec: 60, repeats: 13 },
  { id: 8, title: 'Nível 8', sessions: ['Sessão 22', 'Sessão 23', 'Sessão 24'], summary: '45s corrida / 1m caminhada (12 repetições)', runSec: 45, walkSec: 60, repeats: 12 },
  { id: 9, title: 'Nível 9', sessions: ['Sessão 25', 'Sessão 26', 'Sessão 27'], summary: '50s corrida / 1m caminhada (11 repetições)', runSec: 50, walkSec: 60, repeats: 11 },
  { id: 10, title: 'Nível 10', sessions: ['Sessão 28', 'Sessão 29', 'Sessão 30'], summary: '55s corrida / 1m caminhada (11 repetições)', runSec: 55, walkSec: 60, repeats: 11 },
  { id: 11, title: 'Nível 11', sessions: ['Sessão 31', 'Sessão 32', 'Sessão 33'], summary: '1m corrida / 1m caminhada (8 repetições)', runSec: 60, walkSec: 60, repeats: 8 },
  { id: 12, title: 'Nível 12', sessions: ['Sessão 34', 'Sessão 35', 'Sessão 36'], summary: '1m15s corrida / 1m caminhada (9 repetições)', runSec: 75, walkSec: 60, repeats: 9 },
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
  { id: 24, title: 'Nível 24', sessions: ['Sessão 70', 'Sessão 71', 'Sessão 72'], summary: '20m corrida / 3m caminhada (1 repetição longa)', runSec: 1200, walkSec: 180, repeats: 2 },//marco alterei a repetição de 1 para 2
  { id: 25, title: 'Nível 25 (Objetivo 5K)', sessions: ['Sessão 73', 'Sessão 74', 'Sessão 75'], summary: '30 min de corrida contínua para atingir os 5K', runSec: 1800, walkSec: 0, repeats: 1 },
];
