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
        // Tokens oficiales del Manual de Identidad Visual (Sección 2 y Sección 8)
        eco: {
          forest: "#063B2E", // Verde bosque (Principal: encabezados, barra superior, navegación)
          green: "#168A2E", // Verde Eco (Acciones principales, botones positivos, estados activos)
          leaf: "#65A90A", // Verde hoja (Acentos naturales, etiquetas, elementos gráficos)
          teal: "#0A9B70", // Verde turquesa (Conexión e innovación, enlaces, flujo reciclable)
          yellow: "#F6C400", // Amarillo solar (Llamados de atención, puntos, indicadores)
          orange: "#F28C00", // Naranja mariposa (Acento secundario para insignias y transformación)
          charcoal: "#202522", // Carbón (Texto principal sobre fondos claros)
          background: "#F2F5F2", // Fondo general de descanso visual
          white: "#FFFFFF",
        },
        // Escalas semánticas alineadas a los códigos HEX oficiales del Manual
        huerta: {
          50: "#F2F5F2",
          100: "#E1EFE4",
          200: "#C2DFC8",
          400: "#65A90A", // Verde hoja
          500: "#65A90A", // Verde hoja (#65A90A)
          600: "#168A2E", // Verde Eco (#168A2E)
          700: "#116B23",
          800: "#063B2E", // Verde bosque (#063B2E)
          900: "#063B2E", // Verde bosque (#063B2E)
          950: "#04261E",
        },
        reciclaje: {
          50: "#EAF8F3",
          100: "#CEF0E5",
          200: "#9FE1CC",
          500: "#0A9B70", // Verde turquesa (#0A9B70)
          600: "#0A9B70", // Verde turquesa (#0A9B70)
          700: "#077A58",
          800: "#063B2E",
          900: "#063B2E",
          950: "#04261E",
        },
        sol: {
          50: "#FFFDF0",
          100: "#FEF6C7",
          200: "#FDEBA0",
          300: "#F8D348",
          400: "#F6C400", // Amarillo solar (#F6C400)
          500: "#F6C400", // Amarillo solar (#F6C400)
          600: "#F28C00", // Naranja mariposa (#F28C00)
          700: "#C86E00",
          800: "#9A5200",
          900: "#202522",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Poppins", "Arial", "sans-serif"],
        sans: ["var(--font-body)", "Inter", "Arial", "sans-serif"],
        body: ["var(--font-body)", "Inter", "Arial", "sans-serif"],
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(6, 59, 46, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
