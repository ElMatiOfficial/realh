/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'human-dark': '#0f172a',
                'human-panel': '#1e293b',
                'human-neon': '#00f0ff',
                'human-bio': '#00ff9d',
            },
            animation: {
                'scan': 'scan 3s ease-in-out infinite',
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                scan: {
                    '0%, 100%': { transform: 'translateY(0)', opacity: '0.5' },
                    '50%': { transform: 'translateY(100%)', opacity: '1' },
                }
            }
        },
    },
    plugins: [],
}
