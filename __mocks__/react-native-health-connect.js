// ============================================================================
// MOCK MANUAL: react-native-health-connect
// ----------------------------------------------------------------------------
// Este ficheiro tem de ficar na RAIZ DO REPOSITÓRIO, dentro de uma pasta
// chamada "__mocks__" (ao lado de node_modules e do package.json) — NÃO
// dentro de src/app/. É assim que o Jest sabe substituir automaticamente
// este módulo nativo (que não existe fora de um telemóvel real) por esta
// versão falsa sempre que for importado durante os testes.
//
// Sem isto, qualquer teste que importe (direta ou indiretamente, através de
// utils/healthCalculations.js) o módulo react-native-health-connect falha
// logo ao carregar o ficheiro, mesmo que o teste em si não precise de nada
// relacionado com o Google Fit / Health Connect.
// ============================================================================
module.exports = {
  initialize: jest.fn(() => Promise.resolve(true)),
  getGrantedPermissions: jest.fn(() => Promise.resolve([])),
  requestPermission: jest.fn(() => Promise.resolve([])),
  readRecords: jest.fn(() => Promise.resolve({ records: [] })),
  getSdkStatus: jest.fn(() => Promise.resolve(3)),
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: 1,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
    SDK_AVAILABLE: 3,
  },
};
