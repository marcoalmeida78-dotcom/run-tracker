// ============================================================================
// TABELAS DE CLASSIFICAÇÃO DO TESTE DE COOPER (12 MINUTOS)
// ----------------------------------------------------------------------------
// Transcrito tal e qual do documento de referência fornecido. Cada faixa
// etária tem 4 limiares de distância (metros) que separam os 5 níveis:
// Muito Mau | Mau | Médio | Bom | Excelente.
// thresholds = [limite Muito Mau→Mau, Mau→Médio, Médio→Bom, Bom→Excelente]
// ============================================================================

export const COOPER_LEVELS = ['Muito Mau', 'Mau', 'Médio', 'Bom', 'Excelente'];

export const COOPER_TABLE_MEN = [
  { minAge: 13, maxAge: 14, thresholds: [2000, 2200, 2400, 2700] },
  { minAge: 15, maxAge: 16, thresholds: [2200, 2300, 2500, 2800] },
  { minAge: 17, maxAge: 19, thresholds: [2300, 2500, 2700, 3000] },
  { minAge: 20, maxAge: 29, thresholds: [1600, 2200, 2400, 2800] },
  { minAge: 30, maxAge: 39, thresholds: [1500, 2000, 2300, 2700] },
  { minAge: 40, maxAge: 49, thresholds: [1400, 1700, 2100, 2500] },
  { minAge: 50, maxAge: 999, thresholds: [1300, 1600, 2000, 2400] },
];

export const COOPER_TABLE_WOMEN = [
  { minAge: 13, maxAge: 14, thresholds: [1600, 1900, 2100, 2300] },
  { minAge: 15, maxAge: 16, thresholds: [1700, 2000, 2200, 2500] },
  { minAge: 17, maxAge: 19, thresholds: [1700, 1800, 2100, 2400] },
  { minAge: 20, maxAge: 29, thresholds: [1500, 1800, 2200, 2700] },
  { minAge: 30, maxAge: 39, thresholds: [1400, 1700, 2000, 2500] },
  { minAge: 40, maxAge: 49, thresholds: [1200, 1500, 1900, 2300] },
  { minAge: 50, maxAge: 999, thresholds: [1100, 1400, 1700, 2200] },
];
