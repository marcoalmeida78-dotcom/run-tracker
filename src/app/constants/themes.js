// --- ESQUEMA DE CORES DA APLICAÇÃO ---
//
// A app deixou de ter vários esquemas de cores à escolha — fica só o
// "Vidro Branco" (efeito vidro fosco sobre a imagem de fundo, com o
// slider de opacidade em Definições a controlar quanto se vê da foto).
//
// COLOR_PRIMARY e COLOR_SECONDARY mantêm-se sólidos (sem transparência)
// porque são usados como cor de TEXTO — texto transparente sobre uma foto
// deixaria de ser legível.
//
// COLOR_LIME_ENERGY é a cor de destaque geral (botões concluídos, barra de
// energia, barras de progresso, etc.) — no Vidro Branco é branco opaco.
// Não confundir com o verde-lima fixo usado no traço do mapa e no botão
// "Iniciar Corrida" (ver constants/mapColors.js) — esses são sempre
// verde-lima, independentemente deste esquema de cores.
export const THEMES = {
  default: {
    id: 'default',
    name: 'Vidro Branco',
    COLOR_BG_MAIN: 'rgba(255, 255, 255, 0.12)',
    COLOR_CARD_BG: 'rgba(255, 255, 255, 0.22)',
    COLOR_PRIMARY: '#FFFFFF',
    COLOR_PRIMARY_BG: 'rgba(255, 255, 255, 0.22)',
    COLOR_SECONDARY: 'rgba(255, 255, 255, 0.75)',
    COLOR_DIVIDER: 'rgba(255, 255, 255, 0.35)',
    COLOR_LIME_ENERGY: '#FFFFFF',
    COLOR_ACCENT_TEXT: '#1C1C1E',
    COLOR_RED_ACCENT: '#E8615A',
  },
};
