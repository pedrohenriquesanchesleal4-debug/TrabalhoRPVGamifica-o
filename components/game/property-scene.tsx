import { useId } from 'react';
import { PROPERTY_BY_KEY } from '@/data/properties';

/**
 * SAFRA DF · retrato SVG da propriedade rural.
 *
 * Composição em camadas fixas (céu, terra, estrada, reservatório, casa,
 * galpão, plantação, equipamentos, vegetação nativa) desenhadas por poucas
 * formas repetidas via `<symbol>` + `<use>`. Cada camada lê um dos três
 * indicadores da equipe; a identidade de cada propriedade vem de um elemento
 * fixo ligado ao seu foco produtivo (túnel de morango, trator, galinheiro,
 * curral, canteiro ou nascente), sempre presente, independente dos números.
 *
 * `viewBox` fixo com `preserveAspectRatio="xMidYMid slice"`: o mesmo desenho
 * serve para a miniatura da projeção, a faixa `compact` do celular e o bloco
 * cheio da tela do aluno, apenas cortando as bordas conforme o recipiente.
 */

const VIEW_W = 400;
const VIEW_H = 220;

/** Linha do horizonte: acima é céu de areia, abaixo é terra batida. */
const HORIZON_Y = 132;

/** Azul-esverdeado dessaturado do reservatório: não é um token de indicador, é ilustração. */
const COR_AGUA = '#4f7a7a';
const COR_AGUA_BAIXA = '#7a8a72';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Deslocamento pseudo-orgânico determinístico: nunca `Math.random`, a cena precisa renderizar igual sempre. */
function jitter(seed: number, amplitude: number): number {
  return (Math.sin(seed * 12.9898) * 43758.5453 % 1) * amplitude;
}

type PropertyKey =
  | 'sitio-horizonte'
  | 'cerrado-vivo'
  | 'boa-esperanca'
  | 'riacho-verde'
  | 'nova-safra'
  | 'planalto-familiar';

type CropSymbol = 'crop-touceira' | 'crop-tunel' | 'crop-lamina';

interface Ponto {
  x: number;
  y: number;
}

interface Layout {
  /** Casa: base do telhado no chão, apex acima. */
  house: Ponto;
  houseScale: number;
  /** Assentamento recente: estrutura ainda incompleta, sem janela, madeira à vista. */
  houseFinished: boolean;
  shed: Ponto;
  shedScale: number;
  /** Faixa de plantação: linha de base e limites horizontais. */
  field: { x0: number; x1: number; y: number };
  cropSymbol: CropSymbol;
  cropColsMax: number;
  cropRowsMax: number;
  reservoir: Ponto;
  reservoirScale: number;
  /** Ponto de entrada da estrada na borda do cenário. */
  roadFrom: Ponto;
  /** Até 5 posições de árvore nativa, reveladas em ordem conforme a sustentabilidade sobe. */
  treeSpots: Ponto[];
  /** Até 6 posições de solo exposto/coberto. */
  soilSpots: Ponto[];
}

const LAYOUTS: Record<PropertyKey, Layout> = {
  'sitio-horizonte': {
    house: { x: 72, y: 152 },
    houseScale: 1,
    houseFinished: true,
    shed: { x: 332, y: 160 },
    shedScale: 0.82,
    field: { x0: 140, x1: 258, y: 196 },
    cropSymbol: 'crop-touceira',
    cropColsMax: 6,
    cropRowsMax: 2,
    reservoir: { x: 42, y: 188 },
    reservoirScale: 0.75,
    roadFrom: { x: 400, y: 210 },
    treeSpots: [
      { x: 24, y: 150 },
      { x: 372, y: 148 },
      { x: 300, y: 200 },
    ],
    soilSpots: [
      { x: 132, y: 204 },
      { x: 266, y: 202 },
      { x: 198, y: 208 },
      { x: 150, y: 210 },
    ],
  },
  'cerrado-vivo': {
    house: { x: 104, y: 154 },
    houseScale: 1,
    houseFinished: true,
    shed: { x: 300, y: 162 },
    shedScale: 0.88,
    field: { x0: 150, x1: 246, y: 198 },
    cropSymbol: 'crop-touceira',
    cropColsMax: 5,
    cropRowsMax: 2,
    reservoir: { x: 344, y: 192 },
    reservoirScale: 1,
    roadFrom: { x: 0, y: 214 },
    treeSpots: [
      { x: 30, y: 146 },
      { x: 60, y: 168 },
      { x: 210, y: 150 },
      { x: 372, y: 150 },
      { x: 260, y: 176 },
    ],
    soilSpots: [
      { x: 170, y: 206 },
      { x: 214, y: 208 },
    ],
  },
  'boa-esperanca': {
    house: { x: 92, y: 150 },
    houseScale: 1,
    houseFinished: true,
    shed: { x: 322, y: 158 },
    shedScale: 0.82,
    field: { x0: 142, x1: 268, y: 190 },
    cropSymbol: 'crop-tunel',
    cropColsMax: 8,
    cropRowsMax: 1,
    reservoir: { x: 40, y: 184 },
    reservoirScale: 0.8,
    roadFrom: { x: 400, y: 206 },
    treeSpots: [
      { x: 20, y: 148 },
      { x: 378, y: 146 },
      { x: 306, y: 196 },
    ],
    soilSpots: [
      { x: 138, y: 202 },
      { x: 272, y: 200 },
      { x: 205, y: 204 },
      { x: 220, y: 168 },
    ],
  },
  'riacho-verde': {
    house: { x: 52, y: 150 },
    houseScale: 0.85,
    houseFinished: true,
    shed: { x: 336, y: 154 },
    shedScale: 1.15,
    field: { x0: 108, x1: 300, y: 200 },
    cropSymbol: 'crop-lamina',
    cropColsMax: 9,
    cropRowsMax: 3,
    reservoir: { x: 344, y: 200 },
    reservoirScale: 0.9,
    roadFrom: { x: 0, y: 216 },
    treeSpots: [
      { x: 16, y: 146 },
      { x: 386, y: 144 },
    ],
    soilSpots: [
      { x: 120, y: 210 },
      { x: 160, y: 212 },
      { x: 210, y: 210 },
      { x: 260, y: 212 },
      { x: 292, y: 210 },
    ],
  },
  'nova-safra': {
    house: { x: 80, y: 158 },
    houseScale: 0.82,
    houseFinished: false,
    shed: { x: 298, y: 168 },
    shedScale: 0.66,
    field: { x0: 150, x1: 226, y: 194 },
    cropSymbol: 'crop-touceira',
    cropColsMax: 4,
    cropRowsMax: 1,
    reservoir: { x: 38, y: 194 },
    reservoirScale: 0.62,
    roadFrom: { x: 400, y: 212 },
    treeSpots: [
      { x: 24, y: 152 },
      { x: 376, y: 150 },
    ],
    soilSpots: [
      { x: 148, y: 202 },
      { x: 168, y: 208 },
      { x: 200, y: 204 },
      { x: 224, y: 210 },
      { x: 240, y: 200 },
      { x: 130, y: 210 },
    ],
  },
  'planalto-familiar': {
    house: { x: 74, y: 150 },
    houseScale: 1,
    houseFinished: true,
    shed: { x: 246, y: 158 },
    shedScale: 0.9,
    field: { x0: 296, x1: 358, y: 190 },
    cropSymbol: 'crop-touceira',
    cropColsMax: 3,
    cropRowsMax: 1,
    reservoir: { x: 370, y: 190 },
    reservoirScale: 0.7,
    roadFrom: { x: 0, y: 210 },
    treeSpots: [
      { x: 20, y: 148 },
      { x: 380, y: 152 },
      { x: 200, y: 146 },
    ],
    soilSpots: [
      { x: 130, y: 208 },
      { x: 160, y: 206 },
      { x: 108, y: 212 },
    ],
  },
};

/** Descrição textual por faixa: alimenta o `aria-label`, único canal para leitor de tela. */
function descreverProducao(v: number): string {
  if (v < 34) return 'plantação inicial, com poucas fileiras';
  if (v < 67) return 'plantação em desenvolvimento';
  return 'plantação desenvolvida e densa';
}

function descreverTecnologia(v: number): string {
  if (v < 20) return 'sem equipamento visível';
  if (v < 40) return 'com irrigação instalada';
  if (v < 65) return 'com irrigação e painel solar';
  if (v < 90) return 'com irrigação, painel solar e antena de sinal';
  return 'com estrutura completa: irrigação, painel solar, antena e estufa';
}

function descreverSustentabilidade(v: number): string {
  if (v < 35) return 'pouca vegetação nativa, solo exposto e reservatório baixo';
  if (v < 67) return 'vegetação nativa moderada e reservatório em nível médio';
  return 'vegetação nativa preservada, solo coberto e reservatório cheio';
}

function construirAriaLabel(propertyKey: string, production: number, technology: number, sustainability: number): string {
  const nome = PROPERTY_BY_KEY[propertyKey]?.name ?? 'Propriedade';
  return `${nome}: ${descreverProducao(production)}, ${descreverTecnologia(technology)}, ${descreverSustentabilidade(sustainability)}.`;
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

  const layout = LAYOUTS[propertyKey as PropertyKey] ?? LAYOUTS['sitio-horizonte'];
  const ariaLabel = construirAriaLabel(propertyKey, p, t, s);

  // Plantação: mais colunas, mais fileiras e escala maior conforme a produção sobe.
  const cropCols = clamp(2 + Math.floor(p / 16), 2, compact ? Math.min(4, layout.cropColsMax) : layout.cropColsMax);
  const cropRows = layout.cropRowsMax === 1
    ? 1
    : clamp(1 + Math.floor(p / 40), 1, compact ? 1 : layout.cropRowsMax);
  const cropScale = 0.68 + (p / 100) * 0.62;
  const cropOpacity = 0.55 + (p / 100) * 0.45;
  const cropCor = p < 34 ? 'var(--color-mata-400)' : p < 67 ? 'var(--color-mata-500)' : 'var(--color-mata-600)';

  // Vegetação nativa: quanto mais sustentável, mais árvores de cerrado reveladas.
  const treeCount = clamp(Math.round((s / 100) * layout.treeSpots.length), 0, layout.treeSpots.length);
  const treesVisiveis = layout.treeSpots.slice(0, treeCount);

  // Solo: exposto quando a sustentabilidade é baixa, coberto quando é alta, neutro na faixa do meio.
  const soloExposto = s < 35;
  const soloCoberto = s >= 65;
  const soilCount = soloExposto
    ? clamp(6 - Math.round(s / 8), 2, layout.soilSpots.length)
    : soloCoberto
      ? clamp(Math.round(((s - 65) / 35) * layout.soilSpots.length), 2, layout.soilSpots.length)
      : 0;
  const soloVisivel = layout.soilSpots.slice(0, soilCount);

  // Reservatório: nível de água sobe com a sustentabilidade; ondulação só aparece com água suficiente.
  const basinW = 46 * layout.reservoirScale;
  const basinH = 20 * layout.reservoirScale;
  const waterLevel = 0.28 + (s / 100) * 0.62;
  const waterH = basinH * waterLevel;
  const mostraOnda = s >= 30;

  // Equipamentos de tecnologia: cada patamar acrescenta um item, nunca remove o anterior.
  const temIrrigacao = t >= 20;
  const temSolar = t >= 40;
  const temSensor = t >= 65;
  const temAntena = t >= 78;
  const temEstufa = t >= 92;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      focusable="false"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      className={`block w-full ${compact ? 'aspect-[4/1.3]' : 'aspect-[4/2.4]'} ${className ?? ''}`}
    >
      {/* Duas animações no total: respiração das copas e ondulação da água. Desligadas com movimento reduzido. */}
      <style>{`
        .sfr-copa { animation: sfr-respira 5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
        .sfr-onda { animation: sfr-ondula 3.2s ease-in-out infinite alternate; }
        @keyframes sfr-respira { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.045); } }
        @keyframes sfr-ondula { from { opacity: 0.35; transform: translateX(-2px); } to { opacity: 0.75; transform: translateX(2px); } }
        @media (prefers-reduced-motion: reduce) {
          .sfr-copa, .sfr-onda { animation: none; }
        }
      `}</style>

      <defs>
        {/* Árvore de cerrado: tronco curto e copa irregular, reaproveitada por toda a cena. */}
        <symbol id={`${uid}-arvore`} viewBox="0 0 20 24">
          <path d="M10 24 L10 13" stroke="var(--color-mata-700)" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="10" cy="9" rx="9" ry="8" fill="var(--color-mata-500)" />
        </symbol>

        {/* Touceira: cultura em canteiro, morango denso ou horta agroecológica. */}
        <symbol id={`${uid}-crop-touceira`} viewBox="0 0 12 12">
          <ellipse cx="6" cy="7" rx="6" ry="5" />
        </symbol>

        {/* Túnel baixo: arco de plástico sobre a fileira de morango. */}
        <symbol id={`${uid}-crop-tunel`} viewBox="0 0 16 10">
          <path d="M0 10 Q8 -2 16 10" fill="none" strokeWidth="2.4" />
        </symbol>

        {/* Lâmina de grão: talo alto e fino, área maior de lavoura. */}
        <symbol id={`${uid}-crop-lamina`} viewBox="0 0 8 20">
          <path d="M4 20 L2 4 M4 20 L6 5 M4 20 L4 2" fill="none" strokeWidth="1.4" strokeLinecap="round" />
        </symbol>

        {/* Solo exposto: mancha clara de terra sem cobertura. */}
        <symbol id={`${uid}-solo-exposto`} viewBox="0 0 12 6">
          <ellipse cx="6" cy="3" rx="6" ry="3" fill="var(--color-areia-400)" />
        </symbol>

        {/* Solo coberto: traço de cobertura vegetal rasteira. */}
        <symbol id={`${uid}-solo-coberto`} viewBox="0 0 14 4">
          <rect x="0" y="0" width="14" height="4" rx="2" fill="var(--color-mata-400)" />
        </symbol>

        {/* Gota de irrigação, reaproveitada ao longo da linha de gotejo. */}
        <symbol id={`${uid}-gota`} viewBox="0 0 6 6">
          <circle cx="3" cy="3" r="2.2" fill="var(--color-tecnologia)" />
        </symbol>
      </defs>

      {/* Céu de areia e terra batida: duas superfícies planas, sem gradiente. */}
      <rect x="0" y="0" width={VIEW_W} height={HORIZON_Y} fill="var(--color-areia-100)" />
      <rect x="0" y={HORIZON_Y} width={VIEW_W} height={VIEW_H - HORIZON_Y} fill="var(--color-areia-200)" />
      <line x1="0" y1={HORIZON_Y} x2={VIEW_W} y2={HORIZON_Y} stroke="var(--color-areia-300)" strokeWidth="1" />

      {/* Estrada: trapézio simples da borda do cenário até a casa. */}
      <polygon
        points={`${layout.roadFrom.x - 14},${layout.roadFrom.y} ${layout.roadFrom.x + 14},${layout.roadFrom.y} ${layout.house.x + 4},${layout.house.y + 20} ${layout.house.x - 4},${layout.house.y + 20}`}
        fill="var(--color-areia-300)"
        stroke="var(--color-areia-400)"
        strokeWidth="0.5"
      />

      {/* Reservatório: bacia fixa, lâmina de água variável, ondulação opcional. */}
      <g transform={`translate(${layout.reservoir.x - basinW / 2}, ${layout.reservoir.y - basinH})`}>
        <rect x="0" y="0" width={basinW} height={basinH} rx="3" fill="none" stroke="var(--color-mata-600)" strokeWidth="1.6" />
        <rect
          x="1.5"
          y={basinH - waterH - 1.5}
          width={basinW - 3}
          height={Math.max(waterH - 1.5, 1)}
          rx="2"
          fill={s < 35 ? COR_AGUA_BAIXA : COR_AGUA}
        />
        {mostraOnda && (
          <path
            className="sfr-onda"
            d={`M4 ${basinH - waterH + 2} Q ${basinW / 2} ${basinH - waterH - 1} ${basinW - 4} ${basinH - waterH + 2}`}
            fill="none"
            stroke="var(--color-areia-100)"
            strokeWidth="1"
            strokeLinecap="round"
          />
        )}
      </g>

      {/* Casa: telhado, parede, porta. Sem janela e parede fina quando a estrutura ainda está incompleta. */}
      <g transform={`translate(${layout.house.x}, ${layout.house.y}) scale(${layout.houseScale})`}>
        <polygon points="-20,-6 0,-24 20,-6" fill="var(--color-mata-700)" />
        <rect x={-16} y={-6} width={32} height={22} fill={layout.houseFinished ? 'var(--color-areia-50)' : 'var(--color-areia-300)'} stroke="var(--color-areia-400)" strokeWidth="1" />
        <rect x={-4} y={4} width={8} height={12} fill="var(--color-mata-800)" />
        {layout.houseFinished && <rect x={7} y={0} width={6} height={6} fill="var(--color-areia-300)" />}
      </g>

      {/* Galpão: telhado em duas águas e parede, escala própria por propriedade. */}
      <g transform={`translate(${layout.shed.x}, ${layout.shed.y}) scale(${layout.shedScale})`}>
        <polygon points="-24,-4 0,-18 24,-4" fill="var(--color-mata-800)" />
        <rect x={-20} y={-4} width={40} height={20} fill="var(--color-mata-600)" />
        <rect x={-4} y={6} width={8} height={10} fill="var(--color-mata-800)" />
      </g>

      {/* Plantação: repetição paramétrica do símbolo da propriedade, densidade e altura seguem a produção. */}
      <g fill={cropCor} stroke={cropCor} opacity={cropOpacity}>
        {Array.from({ length: cropRows }).map((_, row) =>
          Array.from({ length: cropCols }).map((_, col) => {
            const seed = row * 31 + col;
            const stepX = (layout.field.x1 - layout.field.x0) / cropCols;
            const x = layout.field.x0 + stepX * (col + 0.5) + jitter(seed, 2.4);
            const y = layout.field.y - row * 10 + jitter(seed + 5, 1.6);
            const size = 10 * cropScale;
            return (
              <use
                key={`${row}-${col}`}
                href={`#${uid}-${layout.cropSymbol}`}
                x={x - size / 2}
                y={y - size}
                width={size}
                height={size}
              />
            );
          }),
        )}
      </g>

      {/* Identidade fixa por propriedade: silhueta ligada ao foco produtivo, sempre presente. */}
      {propertyKey === 'sitio-horizonte' && (
        <g stroke="var(--color-areia-400)" strokeWidth="1" fill="none">
          <rect x={layout.field.x0 - 8} y={layout.field.y - 22} width={layout.field.x1 - layout.field.x0 + 16} height="26" rx="2" />
        </g>
      )}

      {propertyKey === 'boa-esperanca' && (
        <g stroke="var(--color-mata-700)" strokeWidth="2">
          <line x1={layout.field.x0 - 6} y1={layout.field.y} x2={layout.field.x0 - 6} y2={layout.field.y - 10} />
          <line x1={layout.field.x1 + 6} y1={layout.field.y} x2={layout.field.x1 + 6} y2={layout.field.y - 10} />
        </g>
      )}

      {propertyKey === 'riacho-verde' && (
        <g transform={`translate(${(layout.field.x0 + layout.field.x1) / 2 + 30}, ${layout.field.y + 8})`}>
          <rect x={-16} y={-10} width="26" height="10" rx="1" fill="var(--color-terra-500)" />
          <rect x={-10} y={-18} width="12" height="9" rx="1" fill="var(--color-mata-800)" />
          <circle cx={-11} cy={0} r="3.4" fill="var(--color-mata-900)" />
          <circle cx={6} cy={0} r="3.4" fill="var(--color-mata-900)" />
          <line x1={10} y1={-10} x2={16} y2={-16} stroke="var(--color-mata-700)" strokeWidth="1.6" />
        </g>
      )}

      {propertyKey === 'cerrado-vivo' && (
        <g fill="none" stroke={COR_AGUA} strokeWidth="1.4">
          <path d={`M${layout.reservoir.x + 4} ${layout.reservoir.y - basinH - 10} q4 6 0 10`} />
          <line x1={layout.reservoir.x + 4} y1={layout.reservoir.y - basinH} x2={layout.reservoir.x + 4} y2={layout.reservoir.y - basinH - 10} />
        </g>
      )}

      {propertyKey === 'nova-safra' && (
        <g transform={`translate(${layout.field.x1 + 34}, ${layout.field.y - 4})`}>
          <path d="M-14 0 L-14 -14 L14 -14 L14 0" fill="none" stroke="var(--color-areia-400)" strokeWidth="1.4" />
          <polygon points="-8,-14 0,-22 8,-14" fill="var(--color-mata-700)" />
          <rect x={-8} y={-14} width="16" height="12" fill="var(--color-areia-200)" stroke="var(--color-areia-400)" />
          <ellipse cx="-4" cy="4" rx="3" ry="2.2" fill="var(--color-areia-400)" />
          <ellipse cx="6" cy="5" rx="3" ry="2.2" fill="var(--color-areia-400)" />
        </g>
      )}

      {propertyKey === 'planalto-familiar' && (
        <g>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line
              key={i}
              x1={98 + i * 14}
              y1={198}
              x2={98 + i * 14}
              y2={182}
              stroke="var(--color-mata-700)"
              strokeWidth="2"
            />
          ))}
          <line x1="98" y1="188" x2="168" y2="188" stroke="var(--color-mata-700)" strokeWidth="2" />
          <ellipse cx="126" cy="200" rx="12" ry="7" fill="var(--color-areia-300)" stroke="var(--color-mata-800)" strokeWidth="1" />
          <ellipse cx="152" cy="202" rx="10" ry="6" fill="var(--color-areia-300)" stroke="var(--color-mata-800)" strokeWidth="1" />
          <rect x={230} y={166} width="14" height="16" rx="1" fill="var(--color-areia-50)" stroke="var(--color-tecnologia)" strokeWidth="1.4" />
          <line x1="230" y1="172" x2="244" y2="172" stroke="var(--color-tecnologia)" strokeWidth="1" />
        </g>
      )}

      {/* Vegetação nativa: número de árvores cresce com a sustentabilidade, respirando devagar. */}
      <g className="sfr-copa">
        {treesVisiveis.map((spot, i) => (
          <use key={i} href={`#${uid}-arvore`} x={spot.x - 9} y={spot.y - 20} width="18" height="20" />
        ))}
      </g>

      {/* Cobertura de solo: exposto ou coberto conforme a sustentabilidade, nunca os dois ao mesmo tempo. */}
      <g>
        {soloVisivel.map((spot, i) => (
          <use
            key={i}
            href={soloExposto ? `#${uid}-solo-exposto` : `#${uid}-solo-coberto`}
            x={spot.x - 7}
            y={spot.y - 3}
            width="14"
            height="6"
          />
        ))}
      </g>

      {/* Equipamentos: cada patamar de tecnologia soma um item, nada é removido ao subir. */}
      {temIrrigacao && (
        <g stroke="var(--color-tecnologia)" strokeWidth="1" fill="none">
          <line x1={layout.field.x0} y1={layout.field.y + 6} x2={layout.field.x1} y2={layout.field.y + 6} />
          {[0.15, 0.4, 0.65, 0.9].map((f, i) => (
            <use
              key={i}
              href={`#${uid}-gota`}
              x={layout.field.x0 + (layout.field.x1 - layout.field.x0) * f - 3}
              y={layout.field.y + 3}
              width="6"
              height="6"
            />
          ))}
        </g>
      )}

      {temSolar && (
        <g transform={`translate(${layout.shed.x - 10}, ${layout.shed.y - 26})`}>
          <rect x="0" y="0" width="20" height="10" rx="1" fill="var(--color-mata-900)" stroke="var(--color-tecnologia)" strokeWidth="1" />
          <line x1="0" y1="5" x2="20" y2="5" stroke="var(--color-tecnologia)" strokeWidth="0.6" />
          <line x1="10" y1="0" x2="10" y2="10" stroke="var(--color-tecnologia)" strokeWidth="0.6" />
        </g>
      )}

      {temSensor && (
        <g stroke="var(--color-tecnologia)" strokeWidth="1.4">
          <line x1={layout.field.x1 + 12} y1={layout.field.y + 8} x2={layout.field.x1 + 12} y2={layout.field.y - 12} />
          <circle cx={layout.field.x1 + 12} cy={layout.field.y - 14} r="3" fill="var(--color-tecnologia)" stroke="none" />
        </g>
      )}

      {temAntena && (
        <g stroke="var(--color-mata-800)" strokeWidth="1.2">
          <line x1={layout.house.x + 16} y1={layout.house.y - 24} x2={layout.house.x + 16} y2={layout.house.y - 40} />
          <line x1={layout.house.x + 16} y1={layout.house.y - 36} x2={layout.house.x + 22} y2={layout.house.y - 40} />
          <line x1={layout.house.x + 16} y1={layout.house.y - 32} x2={layout.house.x + 21} y2={layout.house.y - 35} />
        </g>
      )}

      {temEstufa && (
        <g transform={`translate(${layout.shed.x + 34}, ${layout.shed.y - 2})`}>
          <rect x="0" y="-14" width="30" height="14" fill="var(--color-areia-100)" stroke="var(--color-mata-600)" strokeWidth="1" opacity="0.85" />
          <line x1="0" y1="-14" x2="30" y2="0" stroke="var(--color-mata-600)" strokeWidth="0.6" />
          <line x1="10" y1="-14" x2="30" y2="-6" stroke="var(--color-mata-600)" strokeWidth="0.6" />
          <line x1="0" y1="-6" x2="20" y2="0" stroke="var(--color-mata-600)" strokeWidth="0.6" />
        </g>
      )}
    </svg>
  );
}
