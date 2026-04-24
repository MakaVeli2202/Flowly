export const theme = {
  colors: {
    // ── Brand ─────────────────────────────────────────────────────────────
    primary:      '#C8A96B',    // golden — CTAs, active states, accents
    secondary:    '#0EA5A0',    // teal — secondary accents (web)
    ink:          '#0D1117',    // darkest — text on primary-coloured surfaces

    // ── Background hierarchy (dark → slightly lighter) ─────────────────────
    bg:           '#0D1117',    // page / screen background
    panel:        '#0F1520',    // nav bars, drawers, overlays
    inputBg:      '#0A1119',    // input fields (one step darker than bg)

    // ��─ Text hierarchy ─────────────────────────────────────────────────────
    text:         '#E8E9EC',    // primary body text
    mist:         '#B0B8C3',    // section labels, captions, field labels
    textMuted:    '#7A8495',    // placeholder text, secondary info

    // ── Borders ────────────────────────────────────────────────────────────
    border:       'rgba(255,255,255,0.11)',    // glass border (matches web)
    borderStrong: 'rgba(255,255,255,0.20)',    // focused / elevated border

    // ── Semantic status colours ─────────────────────────────────────────────
    success:      '#22C55E',
    successBg:    'rgba(34,197,94,0.08)',
    successBorder:'rgba(34,197,94,0.25)',

    warning:      '#F59E0B',
    warningBg:    'rgba(245,158,11,0.08)',
    warningBorder:'rgba(245,158,11,0.25)',

    danger:       '#EF4444',
    dangerBg:     '#1C0A0A',
    dangerBorder: '#7F1D1D',

    info:         '#60A5FA',
    infoBg:       'rgba(96,165,250,0.08)',
    infoBorder:   'rgba(96,165,250,0.25)',

    // ── Primary tints ────────────────────────────────────────────────────
    primaryBg:    'rgba(200,169,107,0.08)',
    primaryBg2:   'rgba(200,169,107,0.14)',
    primaryBorder:'rgba(200,169,107,0.25)',
  },

  radius: {
    xs:   6,
    sm:   10,
    md:   14,
    lg:   18,
    xl:   22,
    xxl:  28,
    full: 999,
  },

  spacing: {
    xs:  6,
    sm:  10,
    md:  14,
    lg:  20,
    xl:  28,
    xxl: 40,
  },

  card: {
    bg:       'rgba(255,255,255,0.05)',
    bgAlt:    'rgba(255,255,255,0.08)',
    border:   'rgba(255,255,255,0.11)',
  },

shadow: {
    card: {
      shadowColor:  '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius:  18,
      elevation:     6,
    },
    heavy: {
      shadowColor:  '#000',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.35,
      shadowRadius:  45,
      elevation:    8,
    },
    medium: {
      shadowColor:  '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius:  16,
      elevation:    4,
    },
    glow: {
      shadowColor:  '#C8A96B',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius:  20,
      elevation:    0,
    },
  },
};