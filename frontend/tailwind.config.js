/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6ff',
          200: '#b8cdff',
          300: '#8aa9ff',
          400: '#5a80ff',
          500: '#345dff',
          600: '#1f3b6b',
          700: '#19305a',
          800: '#142547',
          900: '#0e1b34',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
