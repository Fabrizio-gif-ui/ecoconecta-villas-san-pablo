"use client";

interface EcoConectaLogoProps {
  /** 'hero' renderiza el logo completo (>= 260px ancho) sobre fondo blanco con área de seguridad;
   *  'navbar' renderiza el logo original (>= 220px en desktop) dentro de una cápsula blanca de alto contraste sobre la barra #063B2E.
   */
  variant?: "hero" | "navbar" | "card";
  className?: string;
}

export default function EcoConectaLogo({
  variant = "navbar",
  className = "",
}: EcoConectaLogoProps) {
  const sizeClasses =
    variant === "hero"
      ? "w-[280px] sm:w-[340px] px-4 py-2.5 rounded-2xl bg-white shadow-sm border border-[#D8E2DC]"
      : variant === "card"
        ? "w-[240px] sm:w-[270px] px-3.5 py-2 rounded-2xl bg-white border border-[#D8E2DC]"
        : "w-[205px] sm:w-[228px] px-3 py-1.5 rounded-xl bg-white shadow-xs";

  return (
    <div
      className={`inline-flex select-none items-center justify-center ${sizeClasses} ${className}`}
      aria-label="Logotipo oficial EcoConecta Villas de San Pablo"
    >
      <svg
        viewBox="0 0 460 215"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full"
        role="img"
      >
        <title>EcoConecta Villas de San Pablo</title>

        {/* Flecha circular superior izquierda (Economía circular) */}
        <path
          d="M92 66 C 115 36, 152 28, 184 36"
          stroke="#168A2E"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        <polygon points="180,22 204,38 177,49" fill="#65A90A" />

        {/* Mariposa Monarca (Transformación — #F28C00 y #F6C400) */}
        <g transform="translate(38, 12)">
          {/* Ala superior izquierda */}
          <path
            d="M44 48 C 18 10, 0 18, 4 44 C 7 58, 25 62, 44 54 Z"
            fill="#F28C00"
            stroke="#202522"
            strokeWidth="3.5"
          />
          <path
            d="M36 44 C 20 22, 10 26, 13 42 C 15 50, 26 52, 36 47 Z"
            fill="#F6C400"
          />
          {/* Puntos blancos del borde del ala */}
          <circle cx="8" cy="28" r="2.2" fill="#FFFFFF" />
          <circle cx="6" cy="36" r="2" fill="#FFFFFF" />
          <circle cx="9" cy="45" r="2" fill="#FFFFFF" />

          {/* Ala inferior izquierda */}
          <path
            d="M42 54 C 16 56, 8 76, 22 86 C 34 94, 45 76, 45 58 Z"
            fill="#F28C00"
            stroke="#202522"
            strokeWidth="3.5"
          />
          <path
            d="M38 58 C 22 60, 18 72, 26 78 C 33 82, 40 71, 41 60 Z"
            fill="#F6C400"
          />

          {/* Ala derecha en perspectiva */}
          <path
            d="M48 50 C 58 26, 78 24, 74 44 C 71 56, 58 58, 48 54 Z"
            fill="#F6C400"
            stroke="#202522"
            strokeWidth="3"
          />
          {/* Cuerpo y antenas */}
          <ellipse
            cx="46"
            cy="55"
            rx="3.5"
            ry="14"
            transform="rotate(20 46 55)"
            fill="#202522"
          />
          <path
            d="M50 42 C 52 32, 60 28, 64 30"
            stroke="#202522"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M47 41 C 45 31, 39 26, 35 28"
            stroke="#202522"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>

        {/* Hoja y destellos sobre la 'o' de Eco (#65A90A) */}
        <path
          d="M188 76 C 186 52, 206 38, 226 42 C 222 64, 206 78, 188 76 Z"
          fill="#65A90A"
        />
        <path
          d="M192 73 C 202 62, 212 52, 222 45"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* 3 rayos verdes de energía natural */}
        <line
          x1="210"
          y1="30"
          x2="213"
          y2="18"
          stroke="#65A90A"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <line
          x1="226"
          y1="36"
          x2="235"
          y2="26"
          stroke="#65A90A"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <line
          x1="234"
          y1="49"
          x2="246"
          y2="45"
          stroke="#65A90A"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Símbolo de Conexión e Innovación arriba a la derecha (#0A9B70) */}
        <g transform="translate(382, 42)">
          <circle cx="0" cy="0" r="6" fill="#0A9B70" />
          <line
            x1="0"
            y1="-8"
            x2="0"
            y2="-30"
            stroke="#0A9B70"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <line
            x1="6"
            y1="-6"
            x2="22"
            y2="-24"
            stroke="#0A9B70"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <line
            x1="8"
            y1="0"
            x2="32"
            y2="-4"
            stroke="#0A9B70"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <line
            x1="7"
            y1="5"
            x2="28"
            y2="16"
            stroke="#0A9B70"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="8"
            x2="12"
            y2="26"
            stroke="#0A9B70"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <line
            x1="-6"
            y1="6"
            x2="-18"
            y2="20"
            stroke="#0A9B70"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <line
            x1="-8"
            y1="0"
            x2="-30"
            y2="0"
            stroke="#0A9B70"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <line
            x1="-6"
            y1="-6"
            x2="-22"
            y2="-22"
            stroke="#0A9B70"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
        </g>

        {/* Lettering principal: "Eco" (#168A2E) + "Conecta" (#063B2E) */}
        <text
          x="96"
          y="124"
          fontFamily="Poppins, Arial, sans-serif"
          fontWeight="800"
          fontStyle="italic"
          fontSize="60"
          letterSpacing="-1.5"
        >
          <tspan fill="#168A2E">Eco</tspan>
          <tspan fill="#063B2E">Conecta</tspan>
        </text>

        {/* Flecha circular inferior izquierda (#168A2E -> #65A90A) */}
        <path
          d="M84 122 C 80 158, 104 182, 144 184"
          stroke="#168A2E"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        <polygon points="84,106 71,128 97,128" fill="#168A2E" />
        <polygon points="140,171 164,185 138,197" fill="#65A90A" />

        {/* Pastilla Amarillo Solar (#F6C400) "Villas de San Pablo" */}
        <rect
          x="166"
          y="142"
          width="198"
          height="42"
          rx="21"
          fill="#F6C400"
        />
        <text
          x="265"
          y="169"
          textAnchor="middle"
          fontFamily="Poppins, Arial, sans-serif"
          fontWeight="800"
          fontStyle="italic"
          fontSize="20"
          fill="#063B2E"
        >
          Villas de San Pablo
        </text>

        {/* Viviendas comunitarias y hoja inferior derecha (Comunidad y Territorio) */}
        <g transform="translate(368, 134)">
          {/* Casa pequeña */}
          <path
            d="M4 34 L4 20 L16 11 L28 20 L28 34 Z"
            stroke="#168A2E"
            strokeWidth="3"
            fill="#FFFFFF"
          />
          <rect x="13" y="23" width="6" height="11" fill="#063B2E" />
          {/* Edificio/vivienda 2 pisos */}
          <path
            d="M28 34 L28 10 L46 4 L46 34 Z"
            stroke="#063B2E"
            strokeWidth="3"
            fill="#FFFFFF"
          />
          <rect x="33" y="12" width="4" height="4" fill="#063B2E" />
          <rect x="39" y="12" width="4" height="4" fill="#063B2E" />
          <rect x="33" y="20" width="4" height="4" fill="#063B2E" />
          <rect x="39" y="20" width="4" height="4" fill="#063B2E" />
          {/* Hoja lateral */}
          <path
            d="M48 34 C 50 20, 64 16, 72 20 C 68 32, 58 36, 48 34 Z"
            fill="#65A90A"
          />
        </g>

        {/* Línea curva orgánica inferior */}
        <path
          d="M180 194 Q 295 182, 425 193"
          stroke="#168A2E"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
