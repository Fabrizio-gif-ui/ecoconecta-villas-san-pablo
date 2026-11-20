import {
  Apple,
  Coffee,
  CupSoda,
  FileText,
  Leaf,
  Milk,
  Package,
  Wine,
} from "lucide-react";

const MATERIALS = [
  {
    name: "Cáscaras y Verduras",
    flow: "Orgánico · Huerta",
    icon: Apple,
    style: "border-huerta-200 bg-huerta-50 text-huerta-800",
  },
  {
    name: "Borra de Café",
    flow: "Orgánico · Huerta",
    icon: Coffee,
    style: "border-huerta-200 bg-huerta-50 text-huerta-800",
  },
  {
    name: "Hojas y Jardín",
    flow: "Orgánico · Huerta",
    icon: Leaf,
    style: "border-huerta-200 bg-huerta-50 text-huerta-800",
  },
  {
    name: "Botellas Plásticas PET",
    flow: "Reciclable · Limpio",
    icon: Milk,
    style: "border-reciclaje-200 bg-reciclaje-50 text-reciclaje-700",
  },
  {
    name: "Cartón Desarmado",
    flow: "Reciclable · Seco",
    icon: Package,
    style: "border-reciclaje-200 bg-reciclaje-50 text-reciclaje-700",
  },
  {
    name: "Papel y Cuadernos",
    flow: "Reciclable · Seco",
    icon: FileText,
    style: "border-reciclaje-200 bg-reciclaje-50 text-reciclaje-700",
  },
  {
    name: "Latas y Aluminio",
    flow: "Reciclable · Enjuagado",
    icon: CupSoda,
    style: "border-reciclaje-200 bg-reciclaje-50 text-reciclaje-700",
  },
  {
    name: "Frascos de Vidrio",
    flow: "Reciclable · Entero",
    icon: Wine,
    style: "border-reciclaje-200 bg-reciclaje-50 text-reciclaje-700",
  },
];

export default function MaterialsStrip() {
  return (
    <section
      aria-label="Materiales que recibimos en Villas de San Pablo"
      className="border-t border-stone-200 bg-white py-10"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <span className="inline-flex rounded-full bg-huerta-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-huerta-800">
            Guía rápida visual (estilo Cataki)
          </span>
          <h2 className="mt-2 text-xl font-black text-stone-900 sm:text-2xl">
            Materiales que aprovechamos en Villas de San Pablo
          </h2>
          <p className="mt-1 text-base text-stone-600">
            Cada ícono tiene su nombre claro para que sepas qué guardar en casa
            o en tu negocio.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {MATERIALS.map((mat) => {
            const Icon = mat.icon;
            return (
              <div
                key={mat.name}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 p-3.5 text-center transition ${mat.style}`}
              >
                <Icon className="h-7 w-7 shrink-0" />
                <span className="mt-2 text-sm font-extrabold leading-snug">
                  {mat.name}
                </span>
                <span className="mt-1 text-xs font-semibold opacity-85">
                  {mat.flow}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
