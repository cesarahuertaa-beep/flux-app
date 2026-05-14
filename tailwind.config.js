/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#04080f',
          accent: '#2e5cb8',
          accentLight: '#3d6fd0'
        }
      }
    },
  },
  plugins: [],
}
