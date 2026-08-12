// ============================================================================
// PLUGIN LOCAL: CORRIGE O CRASH DO HEALTH CONNECT AO PEDIR PERMISSÃO
// ----------------------------------------------------------------------------
// Problema que este plugin resolve:
// A biblioteca "react-native-health-connect" precisa que o MainActivity
// nativo registe um "permission delegate" para conseguir tratar o resultado
// do pedido de permissões do Health Connect. Em projetos Expo puramente
// "managed" (sem pasta android/ no repositório) isto não é injetado
// automaticamente pela versão atual da biblioteca, o que causa um crash
// nativo assim que se chama requestPermission() — exatamente o que estava a
// acontecer ao abrir o menu Saúde & Metabolismo.
//
// Como funciona:
// Este plugin corre em CADA "expo prebuild" (inclui os feitos pelo EAS Build)
// e edita os ficheiros nativos gerados (MainActivity.kt e AndroidManifest.xml)
// automaticamente, para que nunca percas esta alteração ao recriares a pasta
// android/. Não precisas de editar nada à mão dentro de android/.
//
// Onde é usado: referenciado em app.json, dentro de "plugins".
// ============================================================================
const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const PERMISSION_DELEGATE_IMPORT =
  'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const PERMISSION_DELEGATE_TAG = 'health-connect-permission-delegate';
const PERMISSION_DELEGATE_LINE = '    HealthConnectPermissionDelegate.setPermissionDelegate(this)';

// --- 1) Regista o HealthConnectPermissionDelegate no MainActivity ---------
// Sem isto, chamar requestPermission() faz a app crashar (erro nativo:
// "lateinit property ... has not been initialized").
function withHealthConnectPermissionDelegate(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      console.warn(
        '[withHealthConnectFix] MainActivity não está em Kotlin — este plugin só sabe editar Kotlin. ' +
          'Regista manualmente o HealthConnectPermissionDelegate no MainActivity.'
      );
      return config;
    }

    let contents = config.modResults.contents;

    // Garante o import (uma única vez, mesmo em prebuilds repetidos)
    if (!contents.includes(PERMISSION_DELEGATE_IMPORT)) {
      contents = contents.replace(
        /^package .+$/m,
        (match) => `${match}\n\n${PERMISSION_DELEGATE_IMPORT}`
      );
    }

    // Garante a linha de registo logo a seguir ao super.onCreate(...) dentro
    // do onCreate() já existente no template do Expo. mergeContents é
    // idempotente — não duplica a linha em prebuilds seguintes.
    const merged = mergeContents({
      tag: PERMISSION_DELEGATE_TAG,
      src: contents,
      newSrc: PERMISSION_DELEGATE_LINE,
      anchor: /super\.onCreate\([^)]*\)/,
      offset: 1,
      comment: '//',
    });

    config.modResults.contents = merged.contents;
    return config;
  });
}

// --- 2) Adiciona o activity-alias exigido pelo Health Connect no Android 14+
// Sem isto, o link de "política de privacidade" no ecrã de permissões do
// Health Connect (Android 14+) pode falhar. É uma adição simples e segura,
// recomendada pela documentação oficial da biblioteca.
function withHealthConnectManifestAlias(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults?.manifest?.application?.[0];
    if (!application) return config;

    const aliasName = 'ViewPermissionUsageActivity';
    const existingAliases = application['activity-alias'] || [];
    const alreadyThere = existingAliases.some(
      (alias) => alias?.$?.['android:name'] === aliasName
    );

    if (!alreadyThere) {
      application['activity-alias'] = [
        ...existingAliases,
        {
          $: {
            'android:name': aliasName,
            'android:exported': 'true',
            'android:targetActivity': '.MainActivity',
            'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
          },
          'intent-filter': [
            {
              action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
              category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
            },
          ],
        },
      ];
    }

    return config;
  });
}

module.exports = function withHealthConnectFix(config) {
  config = withHealthConnectPermissionDelegate(config);
  config = withHealthConnectManifestAlias(config);
  return config;
};
