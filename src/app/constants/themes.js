// --- TEMAS / PALETAS DE CORES DA APLICAÇÃO ---
//
// Desde que a aplicação passou a usar uma imagem de fundo (fundo.png),
// as cores de superfície (COLOR_BG_MAIN, COLOR_CARD_BG, COLOR_PRIMARY_BG,
// COLOR_DIVIDER) usam rgba() com transparência, para que a imagem se veja
// através dos menus/cartões ("efeito vidro fosco").
//
// Todos os temas usam agora o mesmo nível de transparência nos cartões
// (mesmo alpha em COLOR_CARD_BG / COLOR_BG_MAIN / COLOR_PRIMARY_BG /
// COLOR_DIVIDER), à semelhança do tema "Vidro Branco". Os únicos valores
// que variam de tema para tema são a matiz (o RGB) e o próprio texto.
//
// COLOR_PRIMARY e COLOR_SECONDARY mantêm-se sólidos (sem transparência)
// porque são usados como cor de TEXTO — texto transparente sobre uma foto
// deixaria de ser legível.
//
// COLOR_PRIMARY_BG é o equivalente translúcido de COLOR_PRIMARY, usado
// apenas quando COLOR_PRIMARY servia de FUNDO a um cartão (nunca como texto).
//
// COLOR_ACCENT_TEXT é a cor de texto usada em cima de botões com fundo
// COLOR_LIME_ENERGY (ex: "INICIAR CORRIDA"). Nos temas normais é igual a
// COLOR_PRIMARY (como já era); no tema "Vidro Branco" o botão de destaque
// é branco opaco, por isso o texto tem de ser escuro para se ler.
export const THEMES = {
  default: {
    id: 'default',
    name: 'Sálvia & Menta',
    COLOR_BG_MAIN: 'rgba(232, 240, 236, 0.28)',
    COLOR_CARD_BG: 'rgba(244, 248, 245, 0.46)',
    COLOR_PRIMARY: '#2D4A3E',
    COLOR_PRIMARY_BG: 'rgba(45, 74, 62, 0.55)',
    COLOR_SECONDARY: '#3F5E52',
    COLOR_DIVIDER: 'rgba(194, 213, 201, 0.45)',
    COLOR_LIME_ENERGY: '#73B08C',
    COLOR_ACCENT_TEXT: '#2D4A3E',
    COLOR_RED_ACCENT: '#D97770',
  },
  wellness: {
    id: 'wellness',
    name: 'Azul Sereno',
    COLOR_BG_MAIN: 'rgba(235, 242, 247, 0.28)',
    COLOR_CARD_BG: 'rgba(245, 249, 252, 0.45)',
    COLOR_PRIMARY: '#2B3A4A',
    COLOR_PRIMARY_BG: 'rgba(43, 58, 74, 0.55)',
    COLOR_SECONDARY: '#3E5468',
    COLOR_DIVIDER: 'rgba(200, 215, 227, 0.45)',
    COLOR_LIME_ENERGY: '#6BA4C8',
    COLOR_ACCENT_TEXT: '#2B3A4A',
    COLOR_RED_ACCENT: '#E07A5F',
  },
  neon: {
    id: 'neon',
    name: 'Areia & Mostarda',
    COLOR_BG_MAIN: 'rgba(245, 240, 235, 0.28)',
    COLOR_CARD_BG: 'rgba(250, 246, 240, 0.55)',
    COLOR_PRIMARY: '#3D3228',
    COLOR_PRIMARY_BG: 'rgba(61, 50, 40, 0.55)',
    COLOR_SECONDARY: '#5E4F3F',
    COLOR_DIVIDER: 'rgba(221, 211, 199, 0.45)',
    COLOR_LIME_ENERGY: '#D99B26',
    COLOR_ACCENT_TEXT: '#3D3228',
    COLOR_RED_ACCENT: '#C85A54',
  },
  glass: {
    id: 'glass',
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
