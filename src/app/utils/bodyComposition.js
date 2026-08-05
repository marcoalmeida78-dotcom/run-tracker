// ============================================================================
// MÓDULO ISOLADO: ESTIMATIVA DE COMPOSIÇÃO CORPORAL
// ----------------------------------------------------------------------------
// LEITURA HONESTA, DE PROPÓSITO: o algoritmo exato da Xiaomi/Mi Fit para ler
// impedância → massa gorda/água/músculo é fechado (não publicado). Mesmo
// projetos open-source dedicados (ex: openScale) documentam publicamente que
// as tentativas de o replicar ficam com erros grandes. Por isso, em vez de
// fingir replicar o número exato da Xiaomi, este módulo calcula uma
// ESTIMATIVA com base científica, otimizada para mostrar EVOLUÇÃO ao longo
// do tempo (o que realmente interessa numa balança de casa) e não um valor
// clínico absoluto:
//
//   1) % de massa gorda — fórmula de Deurenberg et al. (1991), baseada em
//      IMC + idade + género. É uma das fórmulas antropométricas mais citadas
//      e não depende de calibração específica de hardware.
//   2) Ajuste pela impedância — em vez de usar uma fórmula BIA genérica
//      "universal" (a literatura científica mostra diferenças de vários kg
//      entre as várias fórmulas publicadas, nenhuma delas validada
//      especificamente para esta balança), comparamos a impedância desta
//      pesagem com a MÉDIA das pesagens anteriores da própria pessoa.
//      Fisiologicamente, impedância mais alta que o costume tende a indicar
//      menos água/massa magra relativa nesse momento, e vice-versa — isto dá
//      sensibilidade real à tendência, de forma pessoal e auto-calibrada.
//   3) Água corporal — constante clássica de Pace & Rathbun (1945): ~73% da
//      massa magra é água. É a mesma constante usada por vários projetos
//      open-source de balanças de bioimpedância.
//
// Nada aqui é aconselhamento médico — é sinalizado na app como estimativa.
// ============================================================================

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * % de massa gorda estimada via fórmula de Deurenberg (1991).
 * BF% = 1.20×IMC + 0.23×idade − 10.8×(1 se homem, 0 se mulher) − 5.4
 */
const estimateBodyFatFromDeurenberg = ({ weightKg, heightCm, age, gender }) => {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const isMale = (gender || 'masculino').toLowerCase().startsWith('m');
  return 1.2 * bmi + 0.23 * age - 10.8 * (isMale ? 1 : 0) - 5.4;
};

/**
 * Ajuste heurístico (não uma fórmula clínica publicada) baseado em como a
 * impedância desta pesagem se compara com a média das pesagens anteriores da
 * mesma pessoa. Limitado a um intervalo pequeno e sensato para nunca dominar
 * a estimativa base do Deurenberg.
 */
const impedanceAdjustment = (currentImpedance, priorImpedances = []) => {
  const validPrior = (priorImpedances || []).filter((v) => typeof v === 'number' && v > 0);
  if (!currentImpedance || validPrior.length === 0) return 0;

  const avg = validPrior.reduce((sum, v) => sum + v, 0) / validPrior.length;
  if (!avg) return 0;

  const deltaRatio = (currentImpedance - avg) / avg; // > 0 = impedância mais alta que o costume
  return Math.max(-2.5, Math.min(2.5, deltaRatio * 20));
};

/**
 * Calcula a estimativa completa de composição corporal para UMA pesagem.
 * @param {object} params
 * @param {number} params.weightKg - peso desta pesagem (kg)
 * @param {number} params.heightCm - altura do perfil (cm)
 * @param {number} params.age - idade do perfil
 * @param {string} params.gender - 'masculino' / 'feminino' (aceita 'male'/'m' etc.)
 * @param {number|null} params.impedance - impedância (Ω) desta pesagem, se disponível
 * @param {number[]} params.priorImpedances - impedâncias de pesagens anteriores (mais recentes primeiro ou por qualquer ordem)
 * @returns {object|null} - null se faltarem dados essenciais do perfil (altura/idade)
 */
export const computeBodyComposition = ({ weightKg, heightCm, age, gender, impedance, priorImpedances = [] }) => {
  if (!weightKg || !heightCm || !age) return null;

  let bodyFatPercent = estimateBodyFatFromDeurenberg({ weightKg, heightCm, age, gender });
  bodyFatPercent += impedanceAdjustment(impedance, priorImpedances);
  // Limites fisiologicamente plausíveis, para nunca mostrar um número absurdo
  // mesmo com dados de perfil incomuns ou uma leitura de impedância estranha.
  bodyFatPercent = Math.max(3, Math.min(60, bodyFatPercent));

  const fatMassKg = weightKg * (bodyFatPercent / 100);
  const leanMassKg = weightKg - fatMassKg;
  const leanMassPercent = 100 - bodyFatPercent;

  const bodyWaterKg = leanMassKg * 0.73;
  const bodyWaterPercent = (bodyWaterKg / weightKg) * 100;

  return {
    bodyFatPercent: round1(bodyFatPercent),
    fatMassKg: round1(fatMassKg),
    leanMassKg: round1(leanMassKg),
    leanMassPercent: round1(leanMassPercent),
    bodyWaterKg: round1(bodyWaterKg),
    bodyWaterPercent: round1(bodyWaterPercent),
  };
};

/**
 * Classificação de IMC (OMS), usada para dar contexto extra no menu.
 */
export const classifyBMI = (weightKg, heightCm) => {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  let label = 'Peso normal';
  if (bmi < 18.5) label = 'Baixo peso';
  else if (bmi >= 25 && bmi < 30) label = 'Excesso de peso';
  else if (bmi >= 30) label = 'Obesidade';
  return { bmi: round1(bmi), label };
};

/**
 * Rácio Cintura-Anca (WHR) e classificação de risco cardiovascular, segundo
 * os limiares publicados pela OMS (relatório de 2008 sobre circunferência da
 * cintura e WHR): risco aumentado a partir de 0.90 em homens e 0.85 em
 * mulheres. É uma fórmula simples (cintura ÷ anca) e uma classificação
 * amplamente citada — não uma avaliação médica individual.
 */
export const classifyWHR = (waistCm, hipCm, gender) => {
  if (!waistCm || !hipCm) return null;
  const whr = waistCm / hipCm;
  const isMale = (gender || 'masculino').toLowerCase().startsWith('m');
  const threshold = isMale ? 0.9 : 0.85;
  const isElevated = whr >= threshold;
  return {
    whr: Math.round(whr * 100) / 100, // arredonda a 2 casas decimais (ex: 0.87)
    threshold,
    label: isElevated ? 'Risco cardiovascular aumentado' : 'Dentro da faixa saudável',
    isElevated,
  };
};
