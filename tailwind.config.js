/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gh: {
          bg: '#0d1117',
          canvas: '#161b22',
          surface: '#21262d',
          surface2: '#1c2128',
          border: '#30363d',
          borderMuted: '#21262d',
          accent: '#388bfd',
          accentHover: '#58a6ff',
          accentEmphasis: '#1f6feb',
          text: '#e6edf3',
          textMuted: '#8b949e',
          textSubtle: '#6e7681',
          green: '#3fb950',
          greenDim: '#1a7f37',
          greenBg: 'rgba(63, 185, 80, 0.1)',
          yellow: '#d29922',
          yellowBg: 'rgba(210, 153, 34, 0.1)',
          red: '#f85149',
          redBg: 'rgba(248, 81, 73, 0.1)',
          purple: '#a371f7',
          purpleBg: 'rgba(163, 113, 247, 0.1)',
          orange: '#f0883e',
        }
      },
      fontFamily: {
        mono: ['Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'modal': '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
        'panel': '0 4px 16px rgba(0,0,0,0.3)',
        'accent': '0 0 0 3px rgba(56, 139, 253, 0.3)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      }
    },
  },
  plugins: [],
}
