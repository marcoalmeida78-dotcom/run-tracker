// ============================================================================
// TESTES: utils/healthCalculations.js (calculateBMR e suggestDailyWaterMl)
// ----------------------------------------------------------------------------
// Este ficheiro também importa 'react-native-health-connect' (para as
// funções relacionadas com o Google Fit) — por isso precisa do mock manual
// em __mocks__/react-native-health-connect.js (na raiz do repositório) para
// sequer conseguir ser importado num ambiente de testes. As duas funções
// aqui testadas (TMB e hidratação) não usam esse módulo, só partilham o
// ficheiro com as que usam.
// ============================================================================
import { calculateBMR, suggestDailyWaterMl } from '../utils/healthCalculations';

describe('calculateBMR — Mifflin-St Jeor', () => {
  it('calcula corretamente para um homem', () => {
    // base = 10×80 + 6.25×180 − 5×30 = 1775; homem: +5 = 1780
    expect(calculateBMR({ weight: '80', height: '180', age: '30', gender: 'masculino' })).toBe(1780);
  });

  it('calcula corretamente para uma mulher', () => {
    // base = 10×60 + 6.25×165 − 5×25 = 1506.25; mulher: −161 = 1345.25 → arredonda para 1345
    expect(calculateBMR({ weight: '60', height: '165', age: '25', gender: 'feminino' })).toBe(1345);
  });

  it('devolve 0 quando falta peso, altura ou idade', () => {
    expect(calculateBMR({ weight: '', height: '180', age: '30' })).toBe(0);
    expect(calculateBMR({ weight: '80', height: '', age: '30' })).toBe(0);
    expect(calculateBMR({ weight: '80', height: '180', age: '' })).toBe(0);
    expect(calculateBMR(null)).toBe(0);
  });

  it('assume masculino quando o género não é reconhecido (comportamento documentado)', () => {
    const asMale = calculateBMR({ weight: '80', height: '180', age: '30', gender: 'masculino' });
    const asUnknown = calculateBMR({ weight: '80', height: '180', age: '30', gender: 'xyz' });
    expect(asUnknown).toBe(asMale);
  });
});

describe('suggestDailyWaterMl', () => {
  it('calcula a base (35ml/kg) sem exercício', () => {
    expect(suggestDailyWaterMl(70, 0)).toBe(2450);
  });

  it('soma 1ml por kcal de exercício', () => {
    expect(suggestDailyWaterMl(70, 500)).toBe(2950);
  });

  it('nunca subtrai água por causa de um valor de exercício negativo', () => {
    expect(suggestDailyWaterMl(70, -100)).toBe(2450);
  });

  it('devolve null sem peso', () => {
    expect(suggestDailyWaterMl(null, 500)).toBeNull();
  });
});
