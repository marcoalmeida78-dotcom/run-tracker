// --- EXPLICAÇÃO E REGRAS DE CADA DESAFIO ---
// Usado pelo novo modal que aparece ANTES de um desafio de caminhada ou de
// corrida começar (ver requestStartExercise em index.js). Só os tipos aqui
// listados mostram o modal — 'walk_normal' e 'run_normal' (livres, sem
// regras) arrancam logo, tal como antes.
// Cada entrada: title (igual ao texto do botão no menu, por consistência),
// description (o que é o desafio) e rules (lista de regras, mostradas como
// pontos no modal).
export const CHALLENGE_INFO = {
  // --- Caminhadas ---
  walk_rockport: {
    title: 'Desafio Rockport (1609m)',
    description: 'Teste de caminhada de 1 milha (1609 metros) usado para estimar o teu VO2 Máx a partir do tempo que demoras a completar a distância e da tua frequência cardíaca no fim.',
    rules: [
      'Percorre 1609 metros a bom ritmo, sem correr.',
      'No fim, podes introduzir os teus batimentos cardíacos (bpm) para calcular o VO2 Máx, a FC Máx e a zona de intensidade.',
      'Podes saltar a introdução dos batimentos se não os tiveres.',
    ],
  },
  walk_10m: {
    title: 'Desafio 10 Minutos',
    description: 'Caminhada cronometrada de 10 minutos, sem distância mínima obrigatória.',
    rules: [
      'O cronómetro corre durante exatamente 10 minutos.',
      'O treino termina automaticamente ao fim do tempo.',
      'A distância percorrida nesses 10 minutos fica registada no histórico.',
    ],
  },
  walk_esquina: {
    title: 'Só até à Esquina (500m)',
    description: 'Caminhada curta de 500 metros, com a opção de continuar por mais 500m no fim de cada troço.',
    rules: [
      'Percorre 500 metros.',
      'No fim de cada 500m, escolhes entre continuar mais 500m ou terminar e guardar o treino.',
      'Podes repetir este processo tantas vezes quantas quiseres.',
    ],
  },
  walk_2km: {
    title: 'Desafio 2km sem olhar para o telemóvel',
    description: 'Caminhada de 2000 metros em que o objetivo é não olhar para o ecrã do telemóvel até à distância estar completa.',
    rules: [
      'Percorre 2000 metros sem olhar para o ecrã do telemóvel.',
      'Se a app detetar que o ecrã foi ligado ou a app posta em segundo plano antes dos 2km, o desafio fica registado como não concluído.',
      'Mantém o telemóvel no bolso ou virado para baixo até à app avisar que terminaste.',
    ],
  },

  // --- Desafios de corrida ---
  challenge_cooper: {
    title: 'Teste de Cooper (12 min)',
    description: 'Corre a maior distância possível em 12 minutos — um teste clássico para estimar o teu VO2 Máx e o nível de condição cardiovascular.',
    rules: [
      'Corre (ou caminha, se precisares) durante exatamente 12 minutos, ao teu ritmo máximo sustentável.',
      'O treino termina automaticamente ao fim dos 12 minutos.',
      'No fim, podes introduzir os batimentos cardíacos para calcular o VO2 Máx e a classificação.',
    ],
  },
  'challenge_1.5m': {
    title: 'Desafio 1,5 Milhas (2400m)',
    description: 'Corre 2400 metros (1,5 milhas) o mais rápido possível — outro teste clássico de VO2 Máx baseado no tempo total.',
    rules: [
      'Corre 2400 metros.',
      'O treino termina automaticamente ao atingires a distância.',
      'No fim, podes introduzir os batimentos cardíacos para calcular o VO2 Máx.',
    ],
  },
  challenge_1milha: {
    title: 'Desafio 1 Milha (1609m)',
    description: 'Corre 1609 metros (1 milha) o mais rápido possível.',
    rules: [
      'Corre 1609 metros.',
      'Vais receber avisos de voz a cada 250 metros percorridos.',
      'O treino termina automaticamente ao atingires a distância.',
    ],
  },
  challenge_morte_subita: {
    title: 'Desafio Morte Súbita (1000m)',
    description: '10 blocos de 100 metros, cada um com um tempo-limite cada vez mais curto. Se não cumprires os 100m de um bloco dentro do tempo, o desafio termina aí.',
    rules: [
      'São 10 blocos de 100m cada (1000m no total).',
      'O tempo-limite de cada bloco diminui a cada bloco: começa nos 65s do bloco 1 e desce até aos 20s no bloco 10.',
      'Se não completares os 100m de um bloco dentro do tempo, o desafio termina e fica registado o bloco em que falhaste.',
      'Se completares os 10 blocos, o desafio fica concluído com sucesso.',
    ],
  },
  challenge_5k30: {
    title: 'Desafio 5km em 30 Minutos',
    description: 'Percorre 5 quilómetros em, no máximo, 30 minutos.',
    rules: [
      'Objetivo: 5000 metros em até 30 minutos.',
      'Se atingires os 5km antes dos 30 minutos, o desafio termina logo com sucesso.',
      'Se os 30 minutos esgotarem sem atingires os 5km, o desafio termina e fica registado como não concluído, com a distância real percorrida.',
    ],
  },
};
