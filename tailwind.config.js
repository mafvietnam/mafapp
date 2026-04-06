/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        maf: {
          purple: '#7e22ce',
          pink: '#db2777',
          orange: '#f97316',
          dark: '#0B1121',
          red: '#F42A68',
          violet: '#9130F8',
        },
        'dark-card': '#111827',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
