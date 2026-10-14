import type { Config } from 'tailwindcss';

// The ONLY place with literal colour, size, radius, shadow and spacing values.
// Values come from docs/design/tokens/*.css and docs/design/uploads/DESIGN-SYSTEM.md section 7.
// Component files reference these tokens by name and contain no hex codes or px sizes.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Complete colour set: no default Tailwind palette, so a stray colour class fails to compile.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      bg: 'rgb(var(--c-bg) / <alpha-value>)', // themed: see src/index.css
      surface: '#FFFFFF',
      'surface-muted': 'rgb(var(--c-muted) / <alpha-value>)',
      border: 'rgb(var(--c-border) / <alpha-value>)',
      'border-strong': 'rgb(var(--c-border-strong) / <alpha-value>)',
      text: '#16242B',
      'text-secondary': '#566269',
      'text-muted': '#8C969B',
      accent: 'rgb(var(--c-accent) / <alpha-value>)',
      'accent-hover': 'rgb(var(--c-accent-hover) / <alpha-value>)',
      'accent-soft': 'rgb(var(--c-accent-soft) / <alpha-value>)',
      confirmed: '#1F7A4D',
      estimated: '#B8752E',
      unavailable: '#76838A',
      'over-budget': '#C2410C',
      'under-budget': '#2F8F5B',
      danger: '#B3261E',
      // Bright colours for text that sits on a photo (login welcome panel).
      'photo-sun': '#FFD86B',
      'photo-sky': '#9BE4FF',
      'photo-coral': '#FFB4A2',
      'photo-mint': '#A7F3C8',
      'photo-lilac': '#E0C8FF',
      'focus-ring': 'rgb(var(--c-accent) / <alpha-value>)',
      'chart-hotels': '#0E6F8E',
      'chart-transportation': '#B8752E',
      'chart-activities': '#2F8F5B',
      'chart-food': '#B3261E',
      'chart-local-transport': '#6B4E8C',
      'chart-misc': '#5F6B6F',
      'modal-backdrop': 'rgba(22,36,43,0.4)',
    },
    fontFamily: {
      display: ['Spectral', 'Georgia', 'serif'],
      sans: ['Inter', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      xs: ['12px', '16px'],
      sm: ['14px', '20px'],
      base: ['16px', '24px'],
      lg: ['20px', '28px'],
      xl: ['24px', '32px'],
      '2xl': ['32px', '40px'],
      '3xl': ['40px', '48px'],
      // Sizes the mockups use inside chips and steppers.
      chip: ['13px', '20px'],
      micro: ['11px', '16px'],
    },
    borderRadius: {
      none: '0',
      sm: '4px',
      md: '8px',
      lg: '12px',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      raised: '0 1px 2px rgba(22,36,43,0.05)',
      overlay: '0 4px 12px rgba(22,36,43,0.08)',
      lift: '0 8px 24px rgba(22,36,43,0.10)',
      modal: '0 16px 40px rgba(22,36,43,0.16)',
    },
    // Spacing is limited to the design system's 4px steps (4 8 12 16 24 32 48 64).
    // Named entries are component sizes defined by the design system and mockups.
    spacing: {
      0: '0px',
      px: '1px',
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      6: '24px',
      8: '32px',
      12: '48px',
      16: '64px',
      nav: '64px', // top navigation bar height
      control: '40px', // button / input / select height
      'control-lg': '44px', // touch-target height on mobile
      avatar: '36px',
      'avatar-sm': '32px',
      stepper: '20px', // booking stepper circle
      dot: '10px', // status dot
      'dot-sm': '8px', // legend dot
      bar: '12px', // stacked budget bar
      score: '6px', // recommendation score bar
      progress: '4px',
      mark: '22px', // wayfinding mark in the nav bar
      'mark-lg': '32px',
      'badge-y': '2px',
      'bubble-y': '10px',
      'bubble-x': '14px',
      'menu-w': '216px',
      'panel-w': '320px',
      hero: '120px', // space above the home headline
      'gallery-hero': '340px', // hotel details hero photo
      'gallery-thumb': '80px', // hotel details thumbnail strip
      map: '200px', // hotel map
      banner: '176px', // destination photo banner on the search and plan pages
      swatch: '20px', // theme colour dot
      'place-w': '192px', // places to visit photo width
      'place-h': '128px', // places to visit photo height
    },
    extend: {
      minHeight: { error: '20px', chat: '700px' },
      maxHeight: { dialog: '70vh' },
      gridTemplateColumns: { home: '360px minmax(480px, 1fr)', hotel: 'minmax(0, 1fr) 360px', planner: 'minmax(0, 1fr) 320px' },
      maxWidth: { booking: '640px', modal: '480px', login: '400px', 'login-wide': '880px', bubble: '70%', results: '85%', chat: '640px' },
      letterSpacing: { header: '0.04em' },
      zIndex: { modal: '100', menu: '10' },
    },
  },
  plugins: [],
} satisfies Config;
