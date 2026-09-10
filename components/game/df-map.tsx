'use client';

import { useState } from 'react';
import { GAUGE_ICON, INDICATOR_KEY_TO_KIND, GAUGE_INK, type IndicatorKind } from '@/components/ui/gauges';
import { PROPERTIES } from '@/data/properties';

/** Variável CSS do tom principal de cada indicador, para tingir o ponto do mapa sem inventar cor nova. */
const KIND_COLOR_VAR: Record<IndicatorKind, string> = {
  financas: 'var(--color-financas)',
  producao: 'var(--color-producao)',
  tecnologia: 'var(--color-tecnologia)',
  sustentabilidade: 'var(--color-sustentabilidade)',
};

/**
 * Mapa estilizado do Distrito Federal.
 *
 * Substitui a faixa horizontal de botões genéricos que existia na home: em
 * vez de uma lista sem geografia, as 6 propriedades ganham um lugar dentro de
 * um contorno reconhecível do território que o jogo simula. O contorno é uma
 * silhueta vetorial simplificada (não é um traçado geograficamente exato:
 * poligonal de poucos nós, no espírito do resto da direção visual), e cada
 * propriedade é um ponto fixo dentro dele.
 *
 * Cada ponto usa a MESMA cor e o MESMO ícone que o indicador de destaque
 * daquela propriedade já tem no sistema de canais (`components/ui/gauges`):
 * zero cor nova fora da paleta fechada da direção "Noite de Cerrado".
 *
 * Hover e foco de teclado revelam o nome em destaque e disparam um pulso
 * (reaproveita o keyframe `nascente`, já definido em `app/globals.css` para o
 * cronômetro): o pulso só existe enquanto o ponto está em foco/hover, então
 * não é um segundo laço permanente na tela, só um eco transitório do mesmo
 * movimento físico. Em touch, o toque cumpre o mesmo papel do hover porque
 * ativa o `:focus` do botão.
 */

const VIEW_W = 300;
const VIEW_H = 340;

/**
 * Contorno estilizado do DF: poligonal de 11 nós, silhueta reconhecível (o
 * "bico" ao norte, o alargamento a leste do lago, o afunilamento ao sul),
 * sem pretensão cartográfica.
 */
const OUTLINE = [
  [150, 20],
  [230, 70],
  [268, 140],
  [255, 210],
  [190, 300],
  [150, 330],
  [110, 300],
  [60, 225],
  [35, 150],
  [55, 80],
  [100, 35],
] as const;

const OUTLINE_PATH = `M ${OUTLINE.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`;

/** Coordenadas fixas das 6 propriedades dentro do contorno (não correspondem a lugares reais). */
const POINTS: Record<string, { x: number; y: number }> = {
  'sitio-horizonte': { x: 150, y: 60 },
  'nova-safra': { x: 195, y: 90 },
  'boa-esperanca': { x: 75, y: 110 },
  'cerrado-vivo': { x: 230, y: 150 },
  'riacho-verde': { x: 210, y: 220 },
  'planalto-familiar': { x: 150, y: 290 },
};

export function DfMap({ className }: { className?: string }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  return (
    <div className={`relative aspect-[300/340] w-full ${className ?? ''}`}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d={OUTLINE_PATH}
          fill="var(--color-nevoa-100)"
          stroke="var(--color-terra-700)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={OUTLINE_PATH}
          fill="none"
          stroke="var(--color-financas)"
          strokeOpacity="0.25"
          strokeWidth="1"
          strokeDasharray="1 7"
          strokeLinecap="round"
        />
      </svg>

      {PROPERTIES.map((property) => {
        const point = POINTS[property.key];
        if (!point) return null;

        const kind = INDICATOR_KEY_TO_KIND[property.highlight.indicator];
        const Icon = GAUGE_ICON[kind];
        const active = activeKey === property.key;
        const labelAbove = point.y > VIEW_H / 2;
        const leftPct = (point.x / VIEW_W) * 100;
        const topPct = (point.y / VIEW_H) * 100;

        return (
          <button
            key={property.key}
            type="button"
            onMouseEnter={() => setActiveKey(property.key)}
            onMouseLeave={() => setActiveKey((current) => (current === property.key ? null : current))}
            onFocus={() => setActiveKey(property.key)}
            onBlur={() => setActiveKey((current) => (current === property.key ? null : current))}
            aria-label={`${property.name}: ${property.highlight.label}, ${property.region}`}
            className="absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
            style={{ left: `${leftPct}%`, top: `${topPct}%` }}
          >
            {active ? (
              <span
                aria-hidden="true"
                className="animate-nascente absolute h-6 w-6 rounded-full"
                style={{ backgroundColor: KIND_COLOR_VAR[kind] }}
              />
            ) : null}

            <span
              aria-hidden="true"
              className={[
                'relative flex h-6 w-6 items-center justify-center rounded-full border-2 transition-transform duration-200',
                active ? 'scale-125' : 'scale-100',
              ].join(' ')}
              style={{
                backgroundColor: 'var(--color-nevoa-50)',
                borderColor: KIND_COLOR_VAR[kind],
              }}
            >
              <Icon size={12} strokeWidth={2.4} className={GAUGE_INK[kind]} aria-hidden="true" />
            </span>

            <span
              aria-hidden="true"
              className={[
                'pointer-events-none absolute left-1/2 w-max max-w-[9.5rem] -translate-x-1/2 rounded-[8px] bg-nevoa-100 px-2.5 py-1.5 text-center shadow-[0_4px_0_0_rgba(0,0,0,0.35)] transition-opacity duration-150',
                labelAbove ? 'bottom-full mb-3' : 'top-full mt-3',
                active ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
            >
              <span className="block text-xs font-bold text-terra-900">{property.name}</span>
              <span className={`block text-[0.625rem] uppercase tracking-[0.08em] ${GAUGE_INK[kind]}`}>
                {property.highlight.label}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
