// ============================================================================
// TESTES: utils/bodyComposition.js
// ----------------------------------------------------------------------------
// Valores calculados à mão a partir da fórmula de Deurenberg exata do código:
// BF% = 1.2×IMC + 0.23×idade − 10.8×(homem?1:0) − 5.4
// ============================================================================
import { computeBodyComposition, classifyBMI, classifyWHR, classifyWHtR } from '../utils/bodyComposition';

describe('computeBodyComposition', () => {
  it('calcula corretamente sem ajuste de impedância (homem, 70kg, 175cm, 30 anos)', () => {
    // IMC = 70/1.75² = 22.857142857
    // BF% = 1.2×22.857142857 + 0.23×30 − 10.8 − 5.4 = 18.128571... → 18.1
    const result = computeBodyComposition({ weightKg: 70, heightCm: 175, age: 30, gender: 'masculino' });
    expect(result.bodyFatPercent).toBeCloseTo(18.1, 1);
    expect(result.fatMassKg).toBeCloseTo(12.7, 1);
    expect(result.leanMassKg).toBeCloseTo(57.3, 1);
    expect(result.leanMassPercent).toBeCloseTo(81.9, 1);
    // Água corporal ≈ 73% da massa magra (Pace & Rathbun, 1945)
    expect(result.bodyWaterKg).toBeCloseTo(41.8, 1);
    expect(result.bodyWaterPercent).toBeCloseTo(59.8, 1);
  });

  it('devolve null quando falta altura ou idade (dados essenciais)', () => {
    expect(computeBodyComposition({ weightKg: 70, heightCm: null, age: 30 })).toBeNull();
    expect(computeBodyComposition({ weightKg: 70, heightCm: 175, age: null })).toBeNull();
  });

  it('o ajuste de impedância está limitado a ±2.5 pontos percentuais', () => {
    const base = computeBodyComposition({ weightKg: 70, heightCm: 175, age: 30, gender: 'masculino' });
    // Impedância muito mais alta que a média anterior (600 vs média 500 = +20%,
    // o que sem limite daria +4 pontos — deve ficar preso em +2.5)
    const adjusted = computeBodyComposition({
      weightKg: 70,
      heightCm: 175,
      age: 30,
      gender: 'masculino',
      impedance: 600,
      priorImpedances: [500, 500, 500],
    });
    expect(adjusted.bodyFatPercent - base.bodyFatPercent).toBeCloseTo(2.5, 1);
  });

  it('a % de massa gorda nunca sai do intervalo [3, 60]', () => {
    // Perfil extremo, propositadamente fora do razoável
    const result = computeBodyComposition({ weightKg: 40, heightCm: 220, age: 90, gender: 'feminino' });
    expect(result.bodyFatPercent).toBeGreaterThanOrEqual(3);
    expect(result.bodyFatPercent).toBeLessThanOrEqual(60);
  });
});

describe('classifyBMI (classificação OMS)', () => {
  it('classifica corretamente cada categoria', () => {
    expect(classifyBMI(50, 175).label).toBe('Baixo peso'); // IMC ≈ 16.3
    expect(classifyBMI(70, 175).label).toBe('Peso normal'); // IMC ≈ 22.9
    expect(classifyBMI(85, 175).label).toBe('Excesso de peso'); // IMC ≈ 27.8
    expect(classifyBMI(100, 175).label).toBe('Obesidade'); // IMC ≈ 32.7
  });

  it('devolve null sem peso ou altura', () => {
    expect(classifyBMI(null, 175)).toBeNull();
    expect(classifyBMI(70, null)).toBeNull();
  });
});

describe('classifyWHR (limiares OMS 2008)', () => {
  it('sinaliza risco aumentado no limiar exato (0.90 homens / 0.85 mulheres)', () => {
    expect(classifyWHR(90, 100, 'masculino').isElevated).toBe(true); // WHR = 0.90
    expect(classifyWHR(89, 100, 'masculino').isElevated).toBe(false); // WHR = 0.89
    expect(classifyWHR(85, 100, 'feminino').isElevated).toBe(true); // WHR = 0.85
  });

  it('devolve null sem cintura ou anca', () => {
    expect(classifyWHR(null, 100, 'masculino')).toBeNull();
  });
});

describe('classifyWHtR (Ashwell Shape Chart: 0.4 / 0.5 / 0.6)', () => {
  it('classifica corretamente cada banda', () => {
    expect(classifyWHtR(70, 180).label).toBe('Baixo (magreza)'); // WHtR ≈ 0.389
    expect(classifyWHtR(80, 180).label).toBe('Saudável'); // WHtR ≈ 0.444
    expect(classifyWHtR(95, 180).label).toBe('Risco aumentado'); // WHtR ≈ 0.528
    expect(classifyWHtR(115, 180).label).toBe('Risco elevado'); // WHtR ≈ 0.639
  });

  it('isElevated fica true a partir de 0.5 (o limiar universal)', () => {
    expect(classifyWHtR(90, 180).isElevated).toBe(true); // WHtR = 0.5 exato
    expect(classifyWHtR(89, 180).isElevated).toBe(false); // WHtR < 0.5
  });

  it('devolve null sem cintura ou altura', () => {
    expect(classifyWHtR(null, 180)).toBeNull();
  });
});
