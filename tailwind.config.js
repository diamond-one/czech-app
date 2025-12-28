/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                brand: {
                    blue: "#3F9AAE",
                    teal: "#79C9C5",
                    yellow: "#FFE2AF",
                    orange: "#F96E5B",
                }
            },
        },
    },
    plugins: [],
};
