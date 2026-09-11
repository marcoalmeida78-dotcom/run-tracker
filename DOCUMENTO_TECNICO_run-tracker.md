# Zero aos 5K — Documento Técnico

> Documento de orientação para retomar o desenvolvimento desta app numa nova
> conversa, sem ter de reconstruir todo o raciocínio a partir do código.
> Cobre a arquitetura, as funções principais, e — mais importante — o
> histórico de decisões e bugs já corrigidos na zona mais delicada da app
> (medição de distância por GPS), para não se repetirem erros já feitos.

## 1. O que é a app

App de corrida/caminhada em Expo/React Native, atualmente publicada como
"Zero aos 5K" (`slug: zero-aos-5k`, pacote Android
`com.marcoalmeida.zeroaos5k`). Nome interno do projeto/repositório:
`run-tracker`.

Funcionalidades principais:
- **Programa "0 aos 5K"**: 25 níveis, 3 sessões cada (75 sessões), com
  intervalos de corrida/caminhada que vão aumentando o tempo de corrida a
  cada nível.
- **Caminhadas**: caminhada livre, desafio "Só até à Esquina" (500m, com
  opção de repetir), desafio dos 2km sem olhar para o ecrã.
- **Desafios de corrida**: corrida livre, Teste de Cooper (12 min), 1,5
  Milhas, 1 Milha, Morte Súbita (10 blocos de 100m com tempo decrescente),
  5km em 30 Minutos.
- **Explicação do desafio antes de começar**: ao escolher qualquer desafio
  de caminhada ou de corrida (não as versões "livre"), aparece primeiro um
  modal com a descrição e as regras — só arranca o exercício (GPS, timer,
  áudio "Vamos começar!") se o utilizador confirmar. Ver secção 4.1.
- **Histórico** de todos os treinos, com distância, tempo, ritmo (ao vivo
  durante o exercício e "ritmo sessão" no histórico), calorias, VO2 Máx
  (quando aplicável) e estado (concluído/falhado).
- **Sincronização com o Google Health Connect** (Android): escreve cada
  treino concluído no Health Connect (sessão de exercício, calorias,
  distância, VO2 Máx) e, ao iniciar a app, LÊ o peso mais recente gravado no
  Health Connect (ex: pela app "Saúde & Metabolismo"/balança Xiaomi) para
  atualizar automaticamente o perfil. Ver secção 6.
- **Frase motivacional** no ecrã principal, rotativa a cada abertura da app.
- **Versão interna da app**, mostrada no rodapé do ecrã principal. Ver
  secção 11.

Esta app já foi separada de uma app-irmã, **Saúde & Metabolismo**
(composição corporal, TMB, balança Xiaomi) — ver `SEPARACAO_APPS.md` na raiz
do projeto para o histórico dessa separação. As duas apps só comunicam via
Health Connect (não partilham armazenamento).

## 2. Stack técnica

- Expo SDK ~52, Expo Router (`expo-router/entry`), React Native.
- `expo-location` (GPS, tarefa em segundo plano via `expo-task-manager`).
- `@react-native-async-storage/async-storage` (persistência local — perfil,
  histórico, definições).
- `react-native-health-connect` (só Android; carregado com `require()`
  dentro de uma função, nunca no topo do ficheiro — ver secção 5).
- `react-native-webview` + Leaflet (mapa da rota, ver
  `constants/mapHtml.js`).
- Testes: Jest + `jest-expo`. Correr com `npx jest` (pode ser preciso
  `npm install` primeiro se o `node_modules` não vier no zip).

## 3. Estrutura de ficheiros

```
app.json, eas.json, package.json     — configuração Expo/EAS
src/app/
  index.js                           — ecrã principal / máquina de estados do exercício (grande, ~1650 linhas)
  _layout.js
  components/
    MainScreen.js                    — ecrã inicial (menus, frase motivacional)
    ActiveExerciseScreen.js          — ecrã do exercício em curso (mapa, métricas, botões)
    MotivationalQuote.js             — frase rotativa (ver secção 8)
    menus/                           — um ficheiro por secção do menu principal
      RunProgramMenu.js              — "0 aos 5K" (25 níveis, indicador de progresso)
      WalksMenu.js                   — caminhadas
      ChallengesMenu.js              — desafios de corrida
      HistoryMenu.js                 — histórico
      SettingsMenu.js                — definições, Health Connect, backup
    modals/
      AppModals.js                   — todos os modais (resultado de teste, Morte Súbita/5km30, esquina)
  constants/
    runProgram.js                    — RUN_PROGRAM_LEVELS (25 níveis), SUDDEN_DEATH_BLOCKS
    motivationalQuotes.js            — as 56 frases
    challengeInfo.js                 — título/descrição/regras de cada desafio (modal antes de começar, ver secção 4.1)
    appVersion.js                    — APP_VERSION, mostrada no rodapé do ecrã principal (ver secção 11)
    cooperClassification.js, mapColors.js, mapHtml.js, themes.js
  utils/
    calculations.js                  — TODA a matemática (GPS, ritmo, calorias, VO2 Máx) — ver secção 5
    healthConnectSync.js             — sincronização com Health Connect — ver secção 6
    cooperTest.js, debugLog.js
  tasks/
    locationTask.js                  — definição da tarefa de GPS em segundo plano
  __tests__/
    calculations.test.js             — a maioria dos testes (75+), incluindo os de regressão do GPS
    healthConnectSync.test.js
    cooperTest.test.js
__mocks__/react-native-health-connect.js   — mock Jest (usado automaticamente pelos testes)
```

## 4. Arquitetura geral (`index.js`)

Um único componente grande faz de máquina de estados para todo o ciclo de
vida de um exercício. Pontos-chave:

- **Início**: `startExerciseSession(type, title, config)` — `type` é uma
  string livre (`'run_normal'`, `'walk_normal'`, `'run_program'`,
  `'walk_esquina'`, `'challenge_cooper'`, `'challenge_1.5m'`,
  `'challenge_1milha'`, `'challenge_morte_subita'`, `'challenge_5k30'`,
  `'walk_rockport'`, `'walk_2km'`...). `config` traz `targetDistKm` e/ou
  `targetTimeSec` quando aplicável — a maior parte da lógica de fim de
  exercício é genérica a partir destes dois campos, com exceções explícitas
  para os tipos que precisam de comportamento próprio.
- **GPS**: `handleLocationUpdate(loc)` — chamado a cada posição nova
  (primeiro plano e segundo plano, ver `tasks/locationTask.js`). É aqui que
  a distância é calculada e filtrada. **Ver secção 5 — é a zona mais
  sensível de toda a app.**
- **Relógio**: `tickExercise(now, currentDist, currentSpeed)` — corre a
  cada atualização de GPS e também por um `setInterval` de reserva (linha
  ~734), para o cronómetro não parar se o GPS momentaneamente não enviar
  atualizações. Atualiza `seconds`, o ritmo "ao vivo" (janela deslizante,
  ver secção 5.5), o progresso de fases (programa/Morte Súbita), e decide
  quando terminar o exercício (`autoFinishExercise` / falhas específicas).
- **Fim de exercício**: três caminhos principais:
  - `autoFinishExercise(type, title, finalSec, finalDist, finalSpeed, config)`
    — caminho genérico (sucesso), usado por quase todos os tipos. Tem
    ramos especiais para `challenge_morte_subita` e `challenge_5k30`
    (sucesso/falha decidido pela distância) e para os tipos que pedem
    frequência cardíaca (`walk_rockport`, `challenge_cooper`,
    `challenge_1.5m`, `challenge_1milha` — via `pendingFinishRef` +
    `finalizePendingTest`).
  - `handleSuddenDeathFailure(configBlock, ...)` — falha específica do
    Morte Súbita (tempo de bloco esgotado).
  - `fail2KmChallenge()` — falha do desafio dos 2km (olhou para o ecrã).
- Todos os caminhos de fim gravam um registo em `@user_history`
  (AsyncStorage) e chamam `syncExerciseRecordToHealthConnect(record)`
  (fire-and-forget, nunca bloqueia nem lança erro — ver secção 6).

### 4.1 Explicação do desafio antes de começar

- Os menus (`WalksMenu.js`, `ChallengesMenu.js`) **nunca chamam
  `startExerciseSession` diretamente** — chamam sempre a prop
  `onStartExercise`, que o `index.js` liga a `requestStartExercise(type,
  title, config)`, não a `startExerciseSession`.
- `requestStartExercise` verifica se existe uma entrada para aquele `type`
  em `CHALLENGE_INFO` (`constants/challengeInfo.js`). Se existir, guarda
  `{ type, title, config }` em `pendingChallengeStart` (estado) e o
  `AppModals` mostra o modal de regras (`pendingChallengeInfo`); só chama
  `startExerciseSession` de facto se o utilizador tocar em "SIM, COMEÇAR"
  (`confirmPendingChallengeStart`). Se tocar em "CANCELAR"
  (`cancelPendingChallengeStart`), nada acontece — nenhuma permissão de GPS
  é pedida nem timer é iniciado antes da confirmação.
- `'run_normal'` e `'walk_normal'` (as versões "livres") **não têm** entrada
  em `CHALLENGE_INFO` — arrancam logo, sem modal, tal como antes.
- Para adicionar um novo desafio com regras: basta criar a entrada
  correspondente em `CHALLENGE_INFO` (chave = o mesmo `type` usado na
  chamada a `onStartExercise` no menu) — não é preciso tocar em mais nada,
  o modal aparece automaticamente.

### Forma de um registo do histórico

```js
{
  id, title, date, startTime, endTime,   // ISO strings
  timeSec, distanceKm, pace, calories, speed, vo2Max,
  failed: bool,                          // true = desafio não cumprido
  heartRate,                             // só nos tipos com teste de FC
  // Morte Súbita e 5km/30min também têm:
  metersDone, metersMissing, metersTarget, failedAtBlock (só Morte Súbita),
}
```

## 5. Medição de distância por GPS — LER COM ATENÇÃO

Esta é, de longe, a zona mais retocada da app, com **três bugs sérios
seguidos** já corrigidos aqui. Antes de mexer nisto outra vez, ler esta
secção toda.

### 5.1 Histórico dos bugs (por ordem)

1. **Distância a mais** (bug original): o limiar mínimo de movimento entre
   duas leituras de GPS era demasiado baixo (1m), sem qualquer filtro de
   precisão — o ruído normal do GPS (leituras a "vaguear" alguns metros
   mesmo parado) era somado como se fosse distância real, inflacionando o
   total ao longo da sessão. Sintoma relatado: 5.01km medidos num percurso
   real de ~4km.

2. **Distância a menos** (1ª tentativa de correção, com um bug novo): a
   correção fez o limiar de movimento mínimo **subir** com a imprecisão do
   GPS reportada (`accuracy`). Parecia razoável, mas como as leituras
   chegam a cada ~1 segundo, o movimento real por leitura (1-4m a
   correr/andar) já é da mesma ordem de grandeza da própria imprecisão do
   GPS normal (10-20m é comum, mesmo com boa receção) — o filtro acabava
   por rejeitar quase todo o movimento real. Sintoma: distância parada,
   ritmo com valores absurdos, pausas automáticas por "inatividade" mesmo
   em andamento.

3. **Distância a menos outra vez** (2ª tentativa, bug mais subtil): trocado
   o limiar escalado por um piso **fixo e pequeno** (1.5m) — mas a
   referência ("âncora", o ponto anterior usado para medir a distância
   seguinte) avançava **a cada leitura**, mesmo quando o movimento ficava
   abaixo do piso. A ritmo de caminhada normal (~1.2 m/s), cada leitura
   individual fica quase sempre abaixo de qualquer piso razoável — e como a
   âncora avançava sempre, esse movimento nunca tinha oportunidade de se ir
   somando ao longo de várias leituras: era apagado, leitura atrás de
   leitura. Simulação confirmou: **perda de praticamente 100% da distância**
   a ritmo de caminhada lento. Sintoma real relatado: caminhada de >1km
   registada com ~350m.

   Nesta mesma correção foi também **removida** uma 4ª peça que tinha sido
   adicionada entretanto — uma limpeza final do trajeto com
   Douglas-Peucker, que recalculava a distância gravada a partir da rota
   GPS completa simplificada. Foi revertida por precaução (não por ter um
   bug confirmado, mas por já serem dois bugs sérios seguidos nesta zona, e
   por ser difícil validar contra todas as formas possíveis de percurso
   real). As funções (`simplifyRouteDouglasPeucker`,
   `calculateRouteDistanceKm`, `getFinalDistanceKm`) **continuam no código,
   testadas, mas não estão a ser chamadas por `index.js`** — ficam
   disponíveis se um dia se quiser retomar essa ideia (ex: só para suavizar
   visualmente a linha no mapa, não para a distância gravada).

### 5.2 Desenho atual (o que está em produção agora)

Tudo em `handleLocationUpdate` (`index.js`) + `utils/calculations.js`:

1. **Filtro de precisão** (`isGpsAccuracyAcceptable`, `GPS_ACCURACY_REJECT_METERS = 25`):
   leituras com `accuracy > 25m` são ignoradas por completo — nem contam
   distância, nem avançam a referência.
2. **Filtro de velocidade implausível por segmento**
   (`isSegmentSpeedPlausible`, `GPS_MAX_PLAUSIBLE_SEGMENT_SPEED_KMH = 30`):
   se a distância entre duas leituras implicar uma velocidade impossível a
   pé/a correr, esse salto é ignorado (só esse segmento — não pausa o
   treino; isso é feito por um filtro diferente e já mais antigo, baseado
   na velocidade instantânea do GPS, que pausa a sessão toda acima de
   25km/h sustidos, para detetar deslocação em veículo).
3. **Piso de movimento COM acumulação** (`evaluateGpsMovement`,
   `GPS_MIN_MOVEMENT_KM = 0.0015` = 1.5m): a peça corrigida no bug #3. A
   âncora só avança quando o movimento acumulado desde ela ultrapassa o
   piso — até lá, cada nova leitura é comparada com a **mesma** âncora,
   dando ao movimento lento espaço para se ir juntando ao longo de várias
   leituras em vez de ser reiniciado a cada segundo.
4. **Fórmula de distância**: `calculateVincenty` (elipsoide WGS-84, o mesmo
   modelo que o GPS já usa internamente) em vez de `calculateHaversine`
   (esfera perfeita) — mais precisa, ~0.3%→<0.05% de erro. `calculateHaversine`
   mantém-se exportada como rede de segurança (usada por `calculateVincenty`
   se o cálculo iterativo não convergir — praticamente nunca acontece a
   estas distâncias curtas).

A distância gravada no histórico é **sempre a acumulada ao vivo** por este
mecanismo — não há nenhuma recalculação a posteriori neste momento (ver
5.1, ponto 3).

### 5.3 Se for preciso voltar a mexer aqui

- **Testar sempre com ritmo de CAMINHADA lenta**, não só corrida — é onde
  os três bugs se manifestaram (a corrida, sendo mais rápida, mascara
  problemas no piso mínimo/âncora porque o movimento por leitura fica bem
  acima de qualquer limiar razoável).
- Há testes de regressão específicos em `calculations.test.js`
  (`describe('evaluateGpsMovement...')`) que simulam uma caminhada real a
  1.2 m/s durante 1000m e confirmam que quase toda a distância é
  contabilizada — correr sempre antes de alterar esta zona, e considerar
  adicionar um teste equivalente para qualquer cenário novo antes de mexer.
- Antes de reintroduzir qualquer recalculação a posteriori (Douglas-Peucker
  ou outra), ter em conta que a distância gravada e a distância que decide
  sucesso/falha de um desafio (Morte Súbita, 5km/30min) têm de ser
  **sempre o mesmo valor** — já aconteceu um bug em que uma recalculação
  a posteriori contradizia um sucesso já anunciado ao vivo.

### 5.4 Ritmo (pace) — ao vivo vs. sessão

- **Ritmo mostrado durante o exercício** (`ActiveExerciseScreen`, prop
  `currentPace`): NÃO é `calculatePace(distance, seconds)` direto (isso
  seria a média desde o início da sessão inteira, que demora minutos a
  refletir uma mudança de ritmo). É antes uma **janela deslizante de 30
  segundos** (`PACE_WINDOW_SEC` em `index.js`, dentro de `tickExercise` —
  atualmente à volta da linha 636), guardada em `paceWindowRef`. Só passa a
  usar a janela depois de esta ter pelo menos 10s de amostras; antes disso
  cai em segurança para a média desde o início.
  - O utilizador já pediu para mudar `PACE_WINDOW_SEC` de 30 para 10 (fê-lo
    ele próprio, diretamente no código — **confirmar no zip mais recente
    qual o valor atual antes de assumir 30**).
- **Ritmo gravado no histórico** (campo `pace` do registo): continua a ser
  a média da sessão toda (`calculatePace(finalDist, finalSec)`) — faz
  sentido como resumo, ao contrário do ecrã ao vivo. **Já implementado**: o
  `HistoryMenu.js` mostra este campo com a etiqueta "Ritmo sessão" (para não
  se confundir com o ritmo ao vivo), logo a seguir à linha de
  distância/tempo de cada registo.

### 5.5 Mapa — segue a posição automaticamente, mas preserva o zoom do utilizador

- `constants/mapHtml.js` (Leaflet): numa primeira leitura do pedido do
  utilizador, achou-se que ele queria o mapa completamente livre (sem
  nenhum recentrar automático) — passou a chamar `map.setView(...)` só na
  primeira posição GPS, e `marker.setLatLng(...)` (sem mover a vista) nas
  seguintes. O utilizador corrigiu: não era isso — queria sim que o ponto
  ficasse **sempre centrado automaticamente**, só não queria que o zoom
  fosse reposto sozinho.
- **Comportamento final:** `map.setView([current.lat, current.lng],
  map.getZoom())` volta a ser chamado a **cada** atualização de GPS (o
  ponto segue sempre centrado, sem o utilizador ter de tocar em nada) —
  mas o segundo argumento é sempre `map.getZoom()` (o zoom **atual**,
  escolhido pelo utilizador via pinch ou pelos botões +/- do
  `zoomControl: true`), nunca um número fixo. Só a primeira posição GPS usa
  um zoom fixo (17), para dar um enquadramento inicial sensato.
- Botão de recentrar (📍, `styles.mapRecenterBtn` em
  `ActiveExerciseScreen.js`, prop `onRecenterMap` → `recenterMap()` em
  `index.js` → `webviewRef.current.injectJavaScript('recenterMap(); true;')`):
  mantido para o caso de o utilizador arrastar o mapa manualmente (pan) e
  querer voltar a ver o seu ponto centrado sem esperar pela próxima posição
  GPS — com o seguimento automático já a correr a cada posição, é sobretudo
  um botão de recurso para esse intervalo entre atualizações.

### 5.6 Calorias — bug corrigido (09/2026)

- **Bug encontrado pelo utilizador**: reparou que sessões com distâncias e
  ritmos bem diferentes (ex: Nível 17 - Sessão 49, 4.41km a 7.03 min/km, vs.
  Nível 17 - Sessão 50, 3.87km a 8.00 min/km) davam **exatamente as mesmas
  calorias** no histórico. Confirmado e corrigido — não era imaginação.
- **Causa**: `calculateCalories` (`utils/calculations.js`) escolhia entre
  só DOIS valores fixos de MET (4.0 "caminhada" ou 8.5 "corrida", consoante
  a velocidade média fosse ≤ ou > 7km/h) e depois calculava as calorias só
  a partir do **tempo** — a distância só entrava indiretamente, para
  escolher o "lado do degrau". Duas sessões com a mesma duração e do mesmo
  lado do limiar davam sempre o mesmo resultado, por mais diferente que
  fosse a distância real (prova concreta no histórico real do utilizador:
  Nível 16 - Sessão 46, 3.74km, e Sessão 48, 4.37km, ambas com 30:00 exatos,
  davam as duas 419 kcal — 0.63km de diferença, 0kcal de diferença).
- **Correção**: o MET passou a ser calculado de forma **contínua** a partir
  da velocidade real, usando as equações padrão do ACSM (American College
  of Sports Medicine) para consumo de oxigénio — mantém-se o mesmo limiar
  de 7km/h para escolher entre a equação de caminhada e a de corrida, mas
  agora o MET varia sempre com a velocidade dentro de cada lado, por isso a
  distância volta a refletir-se sempre no resultado. A velocidade usada no
  cálculo é limitada a 24km/h, só para proteger contra picos de erro de GPS
  a inflacionar as calorias (nunca afeta ritmos reais destes exercícios).
- **Registos antigos**: a pedido do utilizador, foram recalculados (não só
  os exercícios futuros). Isto foi feito com uma migração de arranque
  único em `loadAppData()` (`index.js`): na primeira vez que a app abre com
  esta versão, todo o `@user_history` guardado é recalculado com a nova
  fórmula (usando o peso **atual** do perfil, por não existir um "peso
  histórico" por sessão — a mesma aproximação que a fórmula antiga já
  fazia) e a flag `@calories_formula_v2_migrated` fica gravada no
  AsyncStorage para a migração nunca voltar a correr. **Se algum dia se
  fizer outra correção à fórmula de calorias que também deva recalcular o
  histórico, criar uma nova flag** (ex: `@calories_formula_v3_migrated`) —
  não reutilizar esta, ou a migração antiga não volta a correr em telemóveis
  que já a tenham feito.

## 6. Sincronização com o Health Connect (`utils/healthConnectSync.js`)

- Só Android. A biblioteca `react-native-health-connect` é carregada com
  `require()` dentro de uma função (`loadHealthConnect`), nunca com
  `import` estático no topo do ficheiro — necessário para não rebentar em
  plataformas sem a biblioteca nativa, e também porque `import()` dinâmico
  não funciona sob Jest (usar sempre `require()` para isto, não
  `await import()`).
- Ativado/desativado por: `@sync_health_connect_enabled` no AsyncStorage
  (Definições → Sincronização com Google Health Connect).
- **Sincroniza também os registos falhados** (`record.failed === true`) —
  não há nenhum bloqueio por causa disto neste momento. Já existiu um
  bloqueio (`if (record.failed) return`) que impedia isto; foi removido a
  pedido do utilizador, que queria que um desafio falhado (ex: Morte
  Súbita, 5km/30min) sincronizasse a distância/calorias reais na mesma.
- **Regra importante da biblioteca**: `insertRecords()` só aceita registos
  **todos do mesmo tipo** numa única chamada — dá erro "All records must
  have the same type" se se misturar tipos. Por isso o código agrupa os
  registos por `recordType` e faz uma chamada `insertRecords()` por grupo
  (não uma chamada só com tudo misturado). Cada grupo tem o seu próprio
  try/catch — se um tipo falhar (ex: Vo2Max), os outros continuam a ser
  gravados.
- Tipos escritos: `ExerciseSession`, `ActiveCaloriesBurned`,
  `TotalCaloriesBurned`, `Distance`, `Vo2Max` (quando aplicável).
- Só sincroniza registos com `startTime`/`endTime` válidos.

### 6.1 Leitura do peso ao iniciar a app

- `readLatestWeightFromHealthConnect()` — chamada uma vez, fire-and-forget,
  no `useEffect` de arranque do `index.js` (a seguir a `loadAppData()`), via
  `syncWeightFromHealthConnect()`. Só tem efeito no Android; nunca lança
  erro nem bloqueia o arranque.
- Pede a permissão de **leitura** do tipo `Weight` (`WEIGHT_READ_PERMISSION`
  em `healthConnectSync.js`) na primeira vez — precisa da entrada
  `android.permission.health.READ_WEIGHT` em `app.json` (já adicionada).
  Isto é uma permissão distinta das de escrita (`WRITE_PERMISSIONS`) usadas
  para sincronizar os treinos.
- Lê os registos `Weight` do último ano, escolhe o mais recente por
  `time` (a biblioteca não garante ordem), e devolve o peso em kg
  (`record.weight.inKilograms`, arredondado a 1 casa decimal) — ou `null` se
  não houver Health Connect, permissão, ou nenhum registo.
- Se devolver um valor, `syncWeightFromHealthConnect` atualiza
  `profile.weight` (estado + `@user_profile` no AsyncStorage) através de um
  atualizador funcional (`setProfile(prev => ...)`), para nunca pisar o
  perfil carregado em paralelo por `loadAppData()`. Se o utilizador não
  tiver a app "Saúde & Metabolismo"/balança a escrever no Health Connect, o
  perfil simplesmente não é tocado por esta função.

## 7. Programa "0 aos 5K" e indicador de progresso

- `RUN_PROGRAM_LEVELS` em `constants/runProgram.js`: 25 níveis, cada um com
  `runSec`, `walkSec`, `repeats` — ver ficheiro para a progressão exata
  (vai de 10s corrida/18 repetições no Nível 1 até 30 min de corrida
  contínua no Nível 25).
- `RunProgramMenu.js`: cada nível mostra, mesmo com o acordeão fechado, 3
  pontos (um por sessão) — preenchido = concluída, só contornado = por
  fazer — e uma borda em destaque quando as 3 estão concluídas. Isto
  permite ver de relance quais os níveis totalmente por fazer, parciais, ou
  completos, sem abrir cada um. O total de blocos/pontos lê sempre
  `SUDDEN_DEATH_BLOCKS.length`/`lvl.sessions.length` (não há números fixos
  escritos à mão — foi corrigido explicitamente para isto, ver histórico).
- **Cores fixas vs. cores do tema**: as bolas de completude preenchidas
  (`styles.levelProgressDotDone`) e o fundo do cabeçalho do nível atual
  (`styles.levelHeaderActive`, com texto a preto via
  `styles.levelTitleActiveText`/`levelChevronActive`) usam o verde-lima
  **fixo** (`LIME_GREEN`, `constants/mapColors.js`), não a variável de tema
  `colors.COLOR_LIME_ENERGY` (essa, no tema único "Vidro Branco" atual, é
  branco — ver `constants/themes.js`). Se um dia se voltar a ter vários
  temas, confirmar que esta escolha continua a fazer sentido.

## 8. Frase motivacional (`MotivationalQuote.js`)

- 56 frases em `constants/motivationalQuotes.js` (array simples de
  strings) — **pode ser editado livremente só nesse ficheiro**, sem tocar
  em mais nada; a rotação adapta-se sozinha ao tamanho da lista.
- Rotação: guarda o índice da última frase mostrada em AsyncStorage
  (`@motivational_quote_index`), avança sequencialmente a cada abertura da
  app (dá a volta ao array), garantindo que todas aparecem antes de
  repetir.
- Estilo: maiúsculas, negrito, `adjustsFontSizeToFit` + `numberOfLines={2}`
  — frases curtas ficam com fonte maior automaticamente, frases longas
  encolhem até caberem em 2 linhas.
- Fica no lugar onde antes estava o título "ZERO AOS 5K" (removido a
  pedido do utilizador).

## 9. Ícones da app

- `assets/icon.png`, `assets/favicon.png`,
  `assets/android-icon-foreground.png` — gerados a partir de ilustrações
  fornecidas pelo utilizador (mascote com barba, óculos), com um script
  Python (não faz parte do projeto, foi só usado uma vez para processar as
  imagens): deteta o círculo da ilustração original, remove a franja/fundo
  com um filtro de precisão + erosão, e recoloca em 3 variantes (fundo
  escuro sólido para o icon.png, transparente e mais pequeno para o
  android-icon-foreground.png dentro da "zona segura" do ícone adaptável
  Android, e reduzido para o favicon.png).
- `app.json` tem `android.adaptiveIcon.foregroundImage` a apontar para
  `./assets/android-icon-foreground.png` — sem isto, o Android ignora esse
  ficheiro e usa sempre só o `icon.png` normal.
- `favicon.png` não está a ser usado em lado nenhum neste momento (a app
  não tem build web configurada) — só serve se um dia se gerar uso web.

## 10. Problemas de build já resolvidos (GitHub Actions / Expo Prebuild)

Dois problemas de dependências já apanhados e corrigidos:

1. **`expo-asset` não encontrado**: ficava só aninhado dentro de
   `node_modules/expo/node_modules/expo-asset`, não acessível na raiz onde
   o Metro precisa dele. Corrigido adicionando `expo-asset` como
   dependência direta no `package.json` (mesma versão que o `expo` já
   pedia).
2. **`@expo/config-plugins` incompatível**: o `react-native-health-connect`
   pede esta dependência sem limite superior de versão
   (`>= 6.0.2`), o que puxava a versão mais recente (57.x) em vez da
   compatível com o SDK 52 (9.0.17, a que todo o resto do projeto usa
   internamente) — duas versões diferentes instaladas ao mesmo tempo.
   Corrigido fixando `@expo/config-plugins: ~9.0.17` diretamente no
   `package.json`.

Se aparecer outro erro parecido ("Cannot find module X" ou conflito de
versões durante o "Gerar pasta nativa Android (Expo Prebuild)"), o padrão a
verificar primeiro é este: uma dependência de terceiros (não o `expo`
propriamente dito) a puxar uma versão instável/incompatível por falta de
limite de versão — resolve-se quase sempre fixando a versão certa
diretamente no `package.json` do projeto.

## 11. Versão interna da app (rodapé do ecrã principal)

- `constants/appVersion.js` exporta `APP_VERSION` (string, ex: `'1.0'`),
  mostrada no fundo do `MainScreen.js` (`styles.appVersionFooterText`).
- **Não é o mesmo campo que `version` em `app.json`** (esse é a versão de
  build/loja, `1.0.0` neste momento, gerida à parte pelo utilizador via
  EAS) — este é só um contador visível ao utilizador dentro da própria app.
- **Convenção pedida pelo utilizador a partir de 08/09/2026**: `APP_VERSION`
  deve avançar 0.1 sempre que for entregue uma atualização com alterações a
  esta app (`1.0` → `1.1` → `1.2` ...). **Atualizar este ficheiro em toda
  entrega futura de código**, antes de zipar.

## 12. Convenções a manter

- **Comentários de código em português**, explicando o "porquê", não só o
  "o quê" — sobretudo em qualquer decisão que já causou um bug (ver secção
  5). Isto tem sido essencial para retomar o trabalho depois de pausas.
- O utilizador pede **cuidado extremo** para não estragar o que já
  funciona — confirmar sempre com testes (`npx jest`) e verificação de
  sintaxe antes de entregar. Preferir alterações pequenas e bem
  isoladas a reescritas grandes.
- Testes ficam em `src/app/__tests__/`, Jest + `jest-expo`. Sempre que se
  corrige um bug relatado pelo utilizador, escrever um teste que o
  reproduz e confirma a correção (é o padrão seguido em toda a app).
- Ao entregar uma atualização: `rm -rf node_modules` antes de zipar (o
  utilizador reinstala/builda no GitHub Actions), e usar sempre
  `present_files` para o zip final aparecer na conversa.
