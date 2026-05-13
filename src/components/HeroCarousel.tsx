"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PEDIDOSYA_URL } from "@/data/products";

const SLIDES = [
  {
    id: 0,
    bg: "bg-white",
    accentColor: "#7C3AED",
    tagBg: "bg-violet-100 text-violet-700",
    title: "Tu vape favorito,",
    titleAccent: "donde estés",
    titleAccentClass: "text-violet-600",
    subtitle: "Los mejores desechables, pods y liquids en Santiago, RD. Entrega rápida, marcas originales.",
    cta: "Pedir ahora",
    ctaHref: PEDIDOSYA_URL,
    ctaExternal: true,
    ctaClass: "bg-violet-600 text-white hover:bg-violet-700",
    emoji: "💨",
    tag: "Delivery por PedidosYa",
  },
  {
    id: 1,
    bg: "bg-violet-50",
    accentColor: "#7C3AED",
    tagBg: "bg-violet-200 text-violet-800",
    title: "Desechables",
    titleAccent: "premium",
    titleAccentClass: "text-violet-600",
    subtitle: "WAKA, Elf Bar, Geek Bar, Fume, Lost Mary. Hasta 15,000 puffs. Marcas 100% originales.",
    cta: "Ver desechables",
    ctaHref: "/categoria/desechables/",
    ctaExternal: false,
    ctaClass: "bg-violet-600 text-white hover:bg-violet-700",
    emoji: "⚡",
    tag: "Desechables",
  },
  {
    id: 2,
    bg: "bg-blue-50",
    accentColor: "#2563EB",
    tagBg: "bg-blue-100 text-blue-700",
    title: "Pods y kits",
    titleAccent: "recargables",
    titleAccentClass: "text-blue-600",
    subtitle: "IQOS, Caliburn, Drag, Argus. Kits completos para una experiencia superior.",
    cta: "Ver pods",
    ctaHref: "/categoria/pods/",
    ctaExternal: false,
    ctaClass: "bg-blue-600 text-white hover:bg-blue-700",
    emoji: "🔋",
    tag: "Pods & Kits",
  },
  {
    id: 3,
    bg: "bg-emerald-50",
    accentColor: "#059669",
    tagBg: "bg-emerald-100 text-emerald-700",
    title: "Liquids y sales",
    titleAccent: "de nicotina",
    titleAccentClass: "text-emerald-600",
    subtitle: "Sabores únicos. Freebase y nic salts en todas las intensidades.",
    cta: "Ver liquids",
    ctaHref: "/categoria/liquids/",
    ctaExternal: false,
    ctaClass: "bg-emerald-600 text-white hover:bg-emerald-700",
    emoji: "🔥",
    tag: "Liquids",
  },
  {
    id: 4,
    bg: "bg-gray-50",
    accentColor: "#374151",
    tagBg: "bg-gray-200 text-gray-700",
    title: "Heets y accesorios",
    titleAccent: "para IQOS",
    titleAccentClass: "text-gray-700",
    subtitle: "Cajetillas Heets, Terea y todo lo que necesitas para tu IQOS.",
    cta: "Ver accesorios",
    ctaHref: "/categoria/accesorios/",
    ctaExternal: false,
    ctaClass: "bg-gray-800 text-white hover:bg-gray-900",
    emoji: "✨",
    tag: "Accesorios",
  },
];

const INTERVAL = 6000;

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setCurrent((c) => (c + 1) % SLIDES.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, INTERVAL);
    return () => clearInterval(id);
  }, [next, paused]);

  const slide = SLIDES[current];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-gray-100"
      style={{ minHeight: 420 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className={`absolute inset-0 ${slide.bg} flex items-center`}
        >
          <div className="relative z-10 max-w-6xl mx-auto px-10 py-16 w-full flex flex-col md:flex-row items-center gap-8">
            {/* Text */}
            <div className="flex-1 space-y-5">
              <span className={`inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full ${slide.tagBg}`}>
                {slide.tag}
              </span>
              <h1 className="text-4xl md:text-5xl font-normal text-gray-900 leading-tight">
                {slide.title}
                <br />
                <span className={slide.titleAccentClass}>{slide.titleAccent}</span>
              </h1>
              <p className="text-gray-500 text-base md:text-lg max-w-md leading-relaxed font-light">
                {slide.subtitle}
              </p>
              <div className="flex gap-3 pt-1">
                <Link
                  href={slide.ctaHref}
                  target={slide.ctaExternal ? "_blank" : undefined}
                  rel={slide.ctaExternal ? "noopener noreferrer" : undefined}
                  className={`inline-flex items-center gap-2 font-semibold text-sm px-6 py-3 rounded-xl transition-colors ${slide.ctaClass}`}
                >
                  {slide.cta}
                </Link>
                <Link
                  href="/catalogo/"
                  className="inline-flex items-center text-sm px-6 py-3 rounded-xl border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
                >
                  Ver catálogo
                </Link>
              </div>
            </div>

            {/* Emoji */}
            <div className="text-[110px] md:text-[150px] leading-none select-none">
              {slide.emoji}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/80 text-gray-600 hover:bg-white shadow-sm transition-all"
        aria-label="Anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/80 text-gray-600 hover:bg-white shadow-sm transition-all"
        aria-label="Siguiente"
      >
        <ChevronRight size={18} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrent(i)}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === current ? 24 : 8,
              backgroundColor: i === current ? slide.accentColor : "#D1D5DB",
            }}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Progress bar */}
      {!paused && (
        <motion.div
          key={`progress-${current}`}
          className="absolute bottom-0 left-0 h-0.5 z-20"
          style={{ backgroundColor: slide.accentColor }}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: INTERVAL / 1000, ease: "linear" }}
        />
      )}
    </div>
  );
}
