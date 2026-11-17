import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: '#FDF2F4',
          100: '#FCE7EB',
          200: '#F9D0D8',
          300: '#F4A9B8',
          400: '#EB758E',
          500: '#DC4467',
          600: '#C2264D',
          700: '#9E163B',
          800: '#800020', // Primary Rich Maroon
          900: '#68051E', // Darker Maroon
          950: '#400210', // Deepest Maroon
        },
        primary: {
          DEFAULT: '#800020',
          hover: '#68051E',
          dark: '#400210',
          light: '#FDF2F4',
        },
        status: {
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626',
          info: '#800020',
        }
      },
      borderRadius: {
        'card': '12px',
        'btn': '8px',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 10px -2px rgba(128, 0, 32, 0.05), 0 1px 3px -1px rgba(0, 0, 0, 0.05)',
        'maroon': '0 4px 14px 0 rgba(128, 0, 32, 0.25)',
      }
    },
  },
  plugins: [],
};
export default config;
