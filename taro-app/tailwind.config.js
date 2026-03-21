/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#07C160',
        'primary-light': '#E8F5E9',
        danger: '#FF5252',
      },
    },
  },
  plugins: [],
  // 小程序不支持的选择器
  corePlugins: {
    preflight: false,
  },
}
