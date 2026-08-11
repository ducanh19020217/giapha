/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wood: {
          light: '#8B5A2B',
          DEFAULT: '#654321', // Gỗ ấm
          dark: '#3E2723',
        },
        burgundy: {
          light: '#900C3F',
          DEFAULT: '#581845', // Đỏ mận
          dark: '#4A143C',
        },
        bronze: {
          light: '#CD7F32',
          DEFAULT: '#B87333', // Vàng đồng
          dark: '#8C5A2B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      },
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        }
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      }
    },
  },
  plugins: [],
}
