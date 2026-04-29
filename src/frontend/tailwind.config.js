/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: { DEFAULT: '#1a3a6b', light: '#2a5298', dim: '#0f2447' },
      },
    },
  },
  plugins: [],
};
