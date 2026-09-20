export const theme = {
  colors: {
    // Neutrals
    inkBlack: '#0F1115',
    charcoal: '#3F4552',
    slateGray: '#6B7280',
    steelGray: '#9CA3AF',
    mist: '#E5E7EB',
    cloud: '#F3F4F6',
    paperWhite: '#FFFFFF',

    // Competitor colors — reserved for corner identity only
    aka: '#E11D2E',
    akaTint: '#FDE7E9',
    ao: '#0B57D0',
    aoTint: '#E8F0FE',

    // Semantic
    success: '#15803D',
    successTint: '#E7F4EC',
    warning: '#B45309',
    warningTint: '#FDF2E3',
    danger: '#9F1239',
    dangerTint: '#FBE7EC',
  },

  // One family per weight: React Native selects custom-font weights by family name.
  fonts: {
    sans: {
      light: 'Switzer-Light',
      regular: 'Switzer-Regular',
      medium: 'Switzer-Medium',
    },
    display: 'FacultyGlyphic-Regular', // login headline only
    mono: 'GeistMono_700Bold', // score-display and timer-display only
  },

  type: {
    caption: { fontSize: 12, lineHeight: 17, letterSpacing: 0 },
    label: { fontSize: 13, lineHeight: 17, letterSpacing: 0.26 },
    body: { fontSize: 15, lineHeight: 22 },
    bodyLg: { fontSize: 17, lineHeight: 24, letterSpacing: -0.17 },
    subheading: { fontSize: 19, lineHeight: 25, letterSpacing: -0.19 },
    headingSm: { fontSize: 22, lineHeight: 28, letterSpacing: -0.22 },
    heading: { fontSize: 28, lineHeight: 34, letterSpacing: -0.42 },
    headingLg: { fontSize: 34, lineHeight: 39, letterSpacing: -0.68 },
    display: { fontSize: 40, lineHeight: 42, letterSpacing: -0.8 },
    timerDisplay: { fontSize: 56, lineHeight: 56, fontFamily: 'GeistMono_700Bold' },
    scoreDisplay: { fontSize: 96, lineHeight: 96, fontFamily: 'GeistMono_700Bold' },
  },

  spacing: {
    4: 4, 8: 8, 12: 12, 16: 16, 24: 24, 32: 32, 48: 48,
  },

  radii: {
    card: 16,
    chip: 8,
    button: 9999,
    scorePanel: 20,
    sheetTop: 24,
  },

  touchTarget: {
    minimum: 48,
    scoreButton: 56,
  },

  // Primary button fill: CSS linear-gradient(360deg, #111111, #444444), i.e. dark at the bottom, lighter at the top.
  // Warm cream that fades to white behind the greeting on the empty events screen (top to bottom).
  gradients: {
    primary: ['#111111', '#444444'],
    welcome: ['#FAECD6', '#FFFFFF'],
  },

  shadows: {
    subtle: {
      shadowColor: '#0F1115',
      shadowOpacity: 0.06,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1, // Android
    },
    scorePanel: {
      shadowColor: '#0F1115',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6, // Android
    },
  },
} as const;
