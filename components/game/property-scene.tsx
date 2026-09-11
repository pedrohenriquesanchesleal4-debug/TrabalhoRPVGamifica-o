import { useEffect, useId, useRef, useState } from 'react';
import { PROPERTY_BY_KEY } from '@/data/properties';
import { GAUGE_ICON, INDICATOR_KEY_TO_KIND } from '@/components/ui/gauges';

/**
 * SAFRA DF · parcela vista de cima, curvas de nível (direção V6 "Amanhecer do Cerrado").
 *
 * Substitui o corte lateral de solo da direção anterior ("Boletim de Safra").
 * A cena agora é a propriedade vista de cima, em perspectiva levemente
 * oblíqua (trapézios simples, nunca isometria): três anéis concêntricos que
 * afunilam para o topo, simulando o terraceamento em curva de nível que dá
 * nome à direção.
 *
 * De fora para dentro: anel de vegetação nativa (textura pontilhada ligada à
 * SUSTENTABILIDADE), anel de plantio (fileiras verticais ligadas à
 * PRODUÇÃO) e o núcleo, a sede da propriedade (ícones de TECNOLOGIA
 * acumulativos). Um canal de água sinuoso atravessa os três anéis; sua
 * espessura reflete a mesma sustentabilidade que rege a vegetação nativa (a
 * API deste componente não recebe finanças, então o indicador de água usa o
 * dado disponível mais próximo do tema "água/conservação").
 *
 * `viewBox` fixo 0..200 quadrado: mesmo desenho serve para a cena cheia e
 * para a faixa `compact`, que descarta os anéis e mostra só o núcleo mais o
 * glifo de identidade, em escala de destaque, para nunca mais confundir as
 * seis propriedades entre si numa miniatura.
 */

const VIEW = 200;

/** Anel externo · vegetação nativa. Trapézio mais largo, mais próximo da borda. */
const OUTER = { topY: 30, botY: 178, topX0: 40, topX1: 160, botX0: 14, botX1: 186 };
/** Anel médio · área de plantio. */
const MID = { topY: 64, botY: 146, topX0: 64, topX1: 136, botX0: 48, botX1: 152 };
/** Núcleo · sede da propriedade. */
const CORE = { topY: 80, botY: 136, topX0: 76, topX1: 124, botX0: 68, botX1: 132 };
const CORE_CX = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Contorno em perspectiva oblíqua: trapézio simples, sem isometria. */
function trapezoid(t: { topY: number; botY: number; topX0: number; topX1: number; botX0: number; botX1: number }): string {
  return `M ${t.topX0} ${t.topY} L ${t.topX1} ${t.topY} L ${t.botX1} ${t.botY} L ${t.botX0} ${t.botY} Z`;
}

/** Faixa entre topo e base de um trapézio, para posicionar linha/ponto em função de x normalizado (0..1) e y absoluto. */
function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

const GOLDEN_ANGLE_RAD = (137.50776 * Math.PI) / 180;

/**
 * Pontos fixos da textura pontilhada do anel externo, gerados uma única vez
 * (sem `Math.random`, sem divergência entre servidor e cliente). A ordem é
 * estável: crescer a contagem só acrescenta pontos novos, nunca reposiciona
 * os existentes.
 */
function gerarPontosVegetacao(n: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const r = 58 + (92 - 58) * Math.sqrt(t);
    const angle = i * GOLDEN_ANGLE_RAD;
    return { x: 100 + r * Math.cos(angle), y: 104 + r * Math.sin(angle) * 0.62 };
  });
}
const VEGETATION_POINTS = gerarPontosVegetacao(24);
const VEGETATION_TETO = VEGETATION_POINTS.length;
const CROP_TETO = 12;

/** Patamares de tecnologia, cumulativos: nunca somem depois de aparecer. */
const TECH_TIERS = [
  { key: 'sol', min: 30, x: 76, y: 84 },
  { key: 'gotas', min: 60, x: 95.5, y: 84 },
  { key: 'antena', min: 85, x: 115, y: 84 },
] as const;

function descreverProducao(v: number): string {
  if (v < 20) return 'poucas fileiras de plantio, a parcela é quase só vegetação nativa';
  if (v < 50) return 'fileiras de plantio em expansão';
  if (v < 80) return 'plantio ocupando boa parte da parcela';
  return 'plantio denso, cobrindo quase toda a área cultivável';
}

function descreverTecnologia(v: number): string {
  const ativos = TECH_TIERS.filter((tier) => v >= tier.min).map((tier) =>
    tier.key === 'sol' ? 'energia solar' : tier.key === 'gotas' ? 'irrigação por gotejamento' : 'antena de conectividade',
  );
  if (ativos.length === 0) return 'sede sem estrutura tecnológica instalada';
  return `sede equipada com ${ativos.join(', ')}`;
}

function descreverSustentabilidade(v: number): string {
  if (v < 35) return 'vegetação nativa rala ao redor da parcela e canal de água estreito';
  if (v < 70) return 'vegetação nativa em recuperação e canal de água moderado';
  return 'vegetação nativa densa cercando a parcela e canal de água caudaloso';
}

function construirAriaLabel(propertyKey: string, production: number, technology: number, sustainability: number): string {
  const nome = PROPERTY_BY_KEY[propertyKey]?.name ?? 'Propriedade';
  return `${nome}: ${descreverProducao(production)}. ${descreverTecnologia(technology)}. ${descreverSustentabilidade(sustainability)}.`;
}

type PropertyKey =
  | 'sitio-horizonte'
  | 'cerrado-vivo'
  | 'boa-esperanca'
  | 'riacho-verde'
  | 'nova-safra'
  | 'planalto-familiar';

const IDENTITY_LABEL: Record<PropertyKey, string> = {
  'sitio-horizonte': 'hortaliças',
  'cerrado-vivo': 'nascente',
  'boa-esperanca': 'morango',
  'riacho-verde': 'grãos',
  'nova-safra': 'avicultura',
  'planalto-familiar': 'laticínios',
};

/**
 * Glifo de identidade: um traço por propriedade, desenhado em coordenadas
 * locais 0..22 e posicionado em escala de destaque no núcleo (nunca um selo
 * de poucos pixels no canto, que era o problema da versão anterior). Cada
 * glifo usa no máximo 2 nós SVG (um traço e, quando precisa de um ponto
 * sólido, um preenchimento à parte).
 */
function IdentityGlyph({ propertyKey }: { propertyKey: PropertyKey }) {
  const stroke = { fill: 'none', stroke: 'var(--color-terra-900)', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const fill = { fill: 'var(--color-terra-900)', stroke: 'none' };

  switch (propertyKey) {
    case 'sitio-horizonte':
      // Talo com duas folhas em lóbulo: hortaliça.
      return <path {...stroke} d="M11 20 L11 12 M11 14 C6 13 4 9 5 4 C9 5 11 8 11 14 Z M11 14 C16 13 18 9 17 4 C13 5 11 8 11 14 Z" />;
    case 'cerrado-vivo':
      // Gota com onda na base: nascente.
      return (
        <path
          {...stroke}
          d="M11 3 C15 9 16 12 16 14 C16 17.3 13.6 20 11 20 C8.4 20 6 17.3 6 14 C6 12 7 9 11 3 Z M4 20.5 Q11 23 18 20.5"
        />
      );
    case 'boa-esperanca':
      // Túnel baixo sobre a fileira, com o morango como ponto sólido.
      return (
        <>
          <path {...stroke} d="M2 20 Q11 4 20 20 M2 20 L20 20" />
          <circle {...fill} cx="11" cy="16" r="2" />
        </>
      );
    case 'riacho-verde':
      // Espiga de grão: um único traço com quatro pares de aristas.
      return (
        <path
          {...stroke}
          d="M11 21 L11 3 M11 6 L6 3.6 M11 6 L16 3.6 M11 9.5 L6 7.1 M11 9.5 L16 7.1 M11 13 L6 10.6 M11 13 L16 10.6 M11 16.5 L6 14.1 M11 16.5 L16 14.1"
        />
      );
    case 'nova-safra':
      // Ovo em ninho: assentamento recente.
      return (
        <>
          <ellipse {...stroke} cx="11" cy="11" rx="6" ry="7.4" />
          <path {...stroke} d="M2 19 Q11 15 20 19" />
        </>
      );
    case 'planalto-familiar':
      // Cunha de queijo com dois furos sólidos.
      return (
        <>
          <path {...stroke} d="M3 18 L11 5 L19 18 Z" />
          <path {...fill} d="M13 14.5 a1 1 0 1 0 -2 0 a1 1 0 1 0 2 0 M9.8 16.5 a0.8 0.8 0 1 0 -1.6 0 a0.8 0.8 0 1 0 1.6 0" />
        </>
      );
    default:
      return null;
  }
}

/** Ícones de tecnologia, compartilhados via `<symbol>`/`<use>`: nunca um `<svg>` repetido por instância. */
function TechDefs({ idPrefix }: { idPrefix: string }) {
  return (
    <>
      <symbol id={`${idPrefix}-sol`} viewBox="0 0 10 10">
        <path
          d="M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M5 0.5v1.3 M5 8.2v1.3 M0.5 5h1.3 M8.2 5h1.3 M1.8 1.8l0.95 0.95 M7.25 7.25l0.95 0.95 M1.8 8.2l0.95-0.95 M7.25 2.75l0.95-0.95"
          fill="none"
          stroke="var(--color-tecnologia)"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      </symbol>
      <symbol id={`${idPrefix}-antena`} viewBox="0 0 10 10">
        <path
          d="M5 9.2V3 M1.6 9.2 1.6 5 M8.4 9.2 8.4 5 M1 3 5 0.3 9 3"
          fill="none"
          stroke="var(--color-tecnologia)"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
      <symbol id={`${idPrefix}-gotas`} viewBox="0 0 10 10">
        <path
          d="M3 1.6c-1.2 1.6-2 2.8-2 3.8a2 2 0 1 0 4 0c0-1-.8-2.2-2-3.8Zm4.2 1c-1 1.3-1.6 2.2-1.6 3a1.6 1.6 0 1 0 3.2 0c0-.8-.6-1.7-1.6-3Z"
          fill="var(--color-tecnologia)"
        />
      </symbol>
    </>
  );
}

export function PropertyScene({
  propertyKey,
  production,
  technology,
  sustainability,
  className,
  compact,
}: {
  propertyKey: string;
  production: number;
  technology: number;
  sustainability: number;
  className?: string;
  compact?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const p = clamp(production, 0, 100);
  const t = clamp(technology, 0, 100);
  const s = clamp(sustainability, 0, 100);

  const key = (propertyKey in IDENTITY_LABEL ? propertyKey : 'sitio-horizonte') as PropertyKey;
  const ariaLabel = construirAriaLabel(propertyKey, p, t, s);

  const highlight = PROPERTY_BY_KEY[propertyKey]?.highlight;
  const highlightKind = highlight ? INDICATOR_KEY_TO_KIND[highlight.indicator] : null;
  const HighlightIcon = highlightKind ? GAUGE_ICON[highlightKind] : null;
  const highlightColorToken = highlightKind ?? 'terra-700';

  // Anel de plantio: fileiras sobem em degraus de +2 a cada faixa de 20 pontos de produção, teto 12.
  const plantioTier = Math.floor(p / 20);
  const cropCount = clamp(2 + plantioTier * 2, 2, CROP_TETO);

  // Anel de vegetação nativa: contagem e opacidade crescem com a sustentabilidade, teto de 24 pontos.
  const vegetationCount = clamp(Math.round((s / 100) * VEGETATION_TETO), 0, VEGETATION_TETO);
  const vegetationOpacity = 0.3 + (s / 100) * 0.7;
  const vegetationPoints = VEGETATION_POINTS.slice(0, vegetationCount);

  // Canal de água: espessura transiciona (nunca em laço) entre crise e situação saudável.
  const canalStrokeWidth = 2 + (s / 100) * 4;

  // Movimento 6 "copa cresce": dispara uma única vez quando a produção cruza uma faixa, nunca no carregamento inicial.
  const prevTierRef = useRef(plantioTier);
  const [growPulse, setGrowPulse] = useState(0);
  useEffect(() => {
    if (plantioTier > prevTierRef.current) {
      setGrowPulse((v) => v + 1);
    }
    prevTierRef.current = plantioTier;
  }, [plantioTier]);

  const ativosTecnologia = TECH_TIERS.filter((tier) => t >= tier.min);

  if (compact) {
    // Faixa reduzida: só o núcleo mais o glifo de identidade, ~4 nós, sem anéis.
    return (
      <svg
        role="img"
        aria-label={ariaLabel}
        focusable="false"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        preserveAspectRatio="xMidYMid meet"
        className={`block w-full aspect-square ${className ?? ''}`}
      >
        <path d={trapezoid(CORE)} fill="var(--color-nevoa-100)" stroke="var(--color-terra-700)" strokeWidth="1.5" />
        <g transform="translate(76,90) scale(2.05)">
          <IdentityGlyph propertyKey={key} />
        </g>
      </svg>
    );
  }

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      focusable="false"
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      preserveAspectRatio="xMidYMid meet"
      className={`block w-full aspect-square ${className ?? ''}`}
    >
      <defs>
        <TechDefs idPrefix={`${uid}-ico`} />
        {/* Luz ambiente da V6: a parcela respira num breu levemente quente, não num vazio chapado. */}
        <radialGradient id={`${uid}-breu`} cx="0.5" cy="0.42" r="0.85">
          <stop offset="0%" style={{ stopColor: 'var(--color-nevoa-100)' }} />
          <stop offset="72%" style={{ stopColor: 'var(--color-nevoa-50)', stopOpacity: '0.9' }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-nevoa-50)' }} />
        </radialGradient>
        {/* Afago da produção alta: brilho dourado atrás da sede quando a safra está boa. */}
        <radialGradient id={`${uid}-colheita`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" style={{ stopColor: 'var(--color-financas)', stopOpacity: '0.34' }} />
          <stop offset="70%" style={{ stopColor: 'var(--color-financas)', stopOpacity: '0.1' }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-financas)', stopOpacity: '0' }} />
        </radialGradient>
      </defs>

      {/* Fundo: breu com luz de 06:20, atrás de tudo. */}
      <rect width={VIEW} height={VIEW} fill={`url(#${uid}-breu)`} />
      {/* Colheita em andamento: só acende em produção alta, transição única (nunca laço). */}
      <circle
        cx={CORE_CX}
        cy={104}
        r={90}
        fill={`url(#${uid}-colheita)`}
        opacity={p >= 80 ? 1 : 0}
        style={{ transition: 'opacity 700ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      />

      {/* Anel externo · vegetação nativa: contorno + textura pontilhada ligada à sustentabilidade. */}
      <path d={trapezoid(OUTER)} fill="var(--color-verde-300)" fillOpacity="0.28" stroke="var(--color-verde-700)" strokeWidth="1.5" />
      {vegetationPoints.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="2.1" fill="var(--color-sustentabilidade)" opacity={vegetationOpacity} />
      ))}

      {/* Anel médio · área de plantio: contorno + fileiras verticais ligadas à produção. Remonta a cada nova faixa para disparar o motion "copa cresce". */}
      <g
        key={growPulse}
        className={growPulse > 0 ? 'animate-copa' : ''}
        style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
      >
        <path d={trapezoid(MID)} fill="var(--color-producao)" fillOpacity="0.16" stroke="var(--color-producao)" strokeWidth="1.5" />
        {Array.from({ length: cropCount }, (_, i) => {
          const f = (i + 0.5) / cropCount;
          const x1 = lerp(MID.topX0, MID.topX1, f);
          const x2 = lerp(MID.botX0, MID.botX1, f);
          return (
            <line key={i} x1={x1} y1={MID.topY + 4} x2={x2} y2={MID.botY - 4} stroke="var(--color-producao)" strokeWidth="2" strokeLinecap="round" />
          );
        })}
      </g>

      {/* Canal de água: atravessa os anéis, espessura transiciona entre crise e situação saudável. */}
      <path
        d="M100 20 C 60 50, 140 70, 90 100 C 50 125, 120 150, 100 190"
        fill="none"
        stroke="var(--color-terra-900)"
        strokeOpacity="0.12"
        strokeWidth={canalStrokeWidth + 2.4}
        strokeLinecap="round"
      />
      <path
        d="M100 20 C 60 50, 140 70, 90 100 C 50 125, 120 150, 100 190"
        fill="none"
        stroke="var(--color-sustentabilidade)"
        strokeWidth={canalStrokeWidth}
        strokeLinecap="round"
        style={{ transition: 'stroke-width 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      />

      {/* Núcleo · sede da propriedade: contorno neutro, ícones acumulativos de tecnologia, glifo de identidade em destaque. */}
      <path d={trapezoid(CORE)} fill="var(--color-nevoa-100)" stroke="var(--color-terra-700)" strokeWidth="1.5" />
      {ativosTecnologia.map((tier) => (
        <use key={tier.key} href={`#${uid}-ico-${tier.key}`} x={tier.x} y={tier.y} width="9" height="9" />
      ))}
      <g transform={`translate(${CORE_CX - 14},100) scale(1.27)`}>
        <IdentityGlyph propertyKey={key} />
      </g>
      {HighlightIcon ? (
        // Selo do atributo de destaque: marca-d'água discreta no canto da sede, mesma
        // cor do indicador em toda a interface, opacidade baixa para não competir com
        // o glifo de identidade nem os ícones de tecnologia acumulados.
        <g transform="translate(107,84)" opacity="0.32" style={{ color: `var(--color-${highlightColorToken})` }}>
          <HighlightIcon size={11} strokeWidth={2.4} />
        </g>
      ) : null}
      <text x={CORE_CX} y={134} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="6" fill="var(--color-terra-700)">
        {IDENTITY_LABEL[key]}
      </text>
    </svg>
  );
}
