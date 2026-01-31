/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00CED1',
          light: '#40E0D0',
          dark: '#008B8B',
        },
        secondary: {
          DEFAULT: '#9370DB',
          light: '#B19CD9',
        },
        dark: '#2D3748',
        'light-bg': '#F7FAFC',
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'neu': '8px 8px 16px rgba(174, 174, 192, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.8)',
        'neu-sm': '4px 4px 8px rgba(174, 174, 192, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.7)',
        'neu-inset': 'inset 4px 4px 8px rgba(174, 174, 192, 0.3), inset -4px -4px 8px rgba(255, 255, 255, 0.8)',
      },
    },
  },
  plugins: [],
}
