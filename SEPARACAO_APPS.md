# Separação: Zero aos 5K vs. Saúde & Metabolismo

Este repositório deixou de conter o menu Saúde & Metabolismo. Esse menu foi
extraído para uma app própria, completamente separada (ver o outro pacote
entregue, `saude-metabolismo`).

## O que mudou aqui

- Removidos: `components/menus/HealthMenu.js`, `utils/healthCalculations.js`,
  `utils/bodyComposition.js`, `utils/healthTrends.js`, `utils/healthReminders.js`
  e os respetivos testes.
- Removidas as dependências `react-native-ble-plx` (balança Xiaomi),
  `react-native-chart-kit` (gráfico de evolução) e `expo-notifications`
  (lembrete de pesagem) — só eram usadas pelo menu Saúde.
- `MainScreen.js` já não tem o separador "07 — Saúde & Metabolismo"; a secção
  seguinte ("Barra de Energia") passou de 08 para 07.
- **Nova funcionalidade**: esta app agora consegue **escrever** cada treino
  concluído no Google Health Connect (`utils/healthConnectSync.js`) —
  sessão de exercício, calorias, distância e VO2 Máx (quando aplicável).
  É assim que a app de Saúde consegue "ver" os teus treinos, já que as duas
  apps não partilham armazenamento (são instalações separadas). Fica
  desligado por omissão — ativa-se em **Definições → Sincronização com
  Google Health Connect**.
- `app.json`: substituída a permissão de leitura de calorias por permissões
  de **escrita** (`WRITE_EXERCISE`, `WRITE_ACTIVE_CALORIES_BURNED`,
  `WRITE_TOTAL_CALORIES_BURNED`, `WRITE_DISTANCE`, `WRITE_VO2_MAX`).
- A cópia de segurança (Definições → Cópia de Segurança) deixou de incluir
  as chaves do menu Saúde (`@health_scale_history`, `@health_weight_goal`,
  `@health_body_measurements`) — essas agora vivem só na app de Saúde.

## Bugs corrigidos nesta revisão

1. **`onExportBackup`/`onImportBackup` nunca chegavam ao `SettingsMenu`** —
   o `index.js` passava estas props ao `MainScreen`, mas o `MainScreen` não
   as declarava nem as reencaminhava para o `SettingsMenu`. Os botões
   "Exportar Todos os Dados" / "Importar e Substituir" ficavam a chamar
   `onPress={undefined}` — não faziam nada ao tocar. Corrigido.

## Por confirmar (não alterado, por incerteza sobre a tua estrutura real de pastas)

- `index.js` faz `require('../../assets/images/fundo.png')`. A partir da
  posição deste ficheiro neste pacote (raiz do projeto), isso aponta para
  **fora** do projeto. Vale a pena confirmar o caminho real da tua imagem de
  fundo no teu repositório — não mexi nisto porque a pasta `assets/` não
  veio incluída no ficheiro que me enviaste, e não quis arriscar partir um
  caminho que podia estar correto na tua estrutura real (ex: se o teu
  `index.js` vive mais fundo, tipo `app/(algo)/index.js`).
- **Nível 24 do plano 0 aos 5K** (`constants/runProgram.js`): o texto
  (`summary`) diz "1 repetição longa", mas o valor real é `repeats: 2`
  (a sessão gerada tem, de facto, 2 blocos de 20 min de corrida). Não
  corrigi porque não sei qual dos dois está errado — se a intenção era
  mesmo 1 repetição só, o `runSec`/`repeats` é que precisa de mudar; se a
  intenção são 2 repetições, é só o texto que está desatualizado.

## Sincronização com a app de Saúde

Ver `utils/healthConnectSync.js`. Resumo: ao terminar um treino, se a
sincronização estiver ativada, este ficheiro escreve no Health Connect:
- `ExerciseSession` (tipo "corrida", com o título do treino)
- `ActiveCaloriesBurned` (se `calories > 0`)
- `Distance` (se `distanceKm > 0`)
- `Vo2Max` (se o treino calculou um VO2 Máx — Cooper/Rockport/1/1.5 milhas)

Treinos marcados como `failed` (Morte Súbita ou "2km sem olhar" falhados)
não são sincronizados, para não distorcer os totais de calorias/exercício
da app de Saúde com tentativas incompletas.
