/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a0f',
          800: '#111118',
          700: '#1a1a24',
          600: '#222230',
          500: '#2d2d40',
          400: '#3d3d55',
          300: '#5a5a7a',
        },
        brand: {
          primary: '#4f8ef7',
          secondary: '#7c5ef7',
          accent: '#f75e8e',
          success: '#4fd1c5',
          warning: '#f6ad55',
          danger: '#fc8181',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
