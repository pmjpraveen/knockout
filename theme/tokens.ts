export const theme = {
  colors: {
    // Neutrals
    inkBlack: '#0F1115',
    charcoal: '#525356',
    slateGray: '#646668',
    steelGray: '#BFC0C1',
    mist: '#E9EAEA',
    cloud: '#F7F8F8',
    paperWhite: '#FFFFFF',

    // Competitor colors — reserved for corner identity only
    aka: '#E11D2E',
    akaTint: '#FDE7E9',
    ao: '#0B57D0',
    aoTint: '#E8F0FE',

    // Semantic
    success: '#22794A',
    successTint: '#F5F8F6',
    warning: '#8E571E',
    warningTint: '#FFF5EE',
    danger: '#A2121C',
    dangerTint: '#FDF6F4',
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
    monoMedium: 'GeistMono_500Medium', // the match clock pill
  },

  type: {
    caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0 },
    label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.26 },
    body: { fontSize: 14, lineHeight: 20 },
    bodyLg: { fontSize: 16, lineHeight: 24, letterSpacing: -0.17 },
    subheading: { fontSize: 18, lineHeight: 24, letterSpacing: -0.19 },
    headingSm: { fontSize: 22, lineHeight: 28, letterSpacing: -0.22 },
    heading: { fontSize: 28, lineHeight: 34, letterSpacing: -0.42 },
    headingLg: { fontSize: 32, lineHeight: 40, letterSpacing: -0.68 },
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
    // `minimum` is the true accessibility floor (used by ChoiceChips, ListGroup, TextField, etc.) — kept
    // untouched. Button's own `normal` (40) and `medium` (36) sizes fall below it deliberately; see Button.tsx.
    minimum: 48,
    medium: 36,
    normal: 40,
    scoreButton: 56,
  },

  // Primary button fill: CSS linear-gradient(360deg, #111111, #444444), i.e. dark at the bottom, lighter at the top.
  // Warm cream that fades to white behind the greeting on the empty events screen (top to bottom).
  gradients: {
    primary: ['#111111', '#444444'],
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
