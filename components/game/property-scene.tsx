import { useId } from 'react';
import { PROPERTY_BY_KEY } from '@/data/properties';

/**
 * SAFRA DF · corte lateral do solo da propriedade.
 *
 * Linguagem de prancha técnica de agronomia, não fazendinha ilustrada: corte
 * vertical do terreno visto de lado, com a parte aérea como matéria principal
 * e o perfil de solo como base.
 *
 * De baixo para cima: lençol freático (lâmina fina), subsolo, solo
 * superficial, linha do solo, e acima dela a lavoura (fileira de plantas cuja
 * quantidade cresce com a PRODUÇÃO, cada uma com raiz simples). Casa e galpão
 * assentam exatamente na linha do solo, com tique de fundação. Tecnologia
 * soma-se numa régua vertical de patamares fixos, cada um com sua faixa
 * própria (nunca cruza outro rótulo). A identidade de cada propriedade é um
 * selo de linha fina fixo no canto superior direito.
 *
 * `viewBox` fixo com `preserveAspectRatio="xMidYMid slice"`: o mesmo desenho
 * serve para a miniatura da projeção, a faixa `compact` do celular e o bloco
 * cheio da tela do aluno, cortando só as bordas conforme o recipiente.
 */

const VIEW_W = 400;
const VIEW_H = 220;

/** Faixa realmente enquadrada no bloco cheio: sem corte, mostra 106-220 inteiro. */
const VIEW_Y = 106;
const VIEW_VISIBLE_H = VIEW_H - VIEW_Y;

/**
 * Zona segura: sobrevive ao corte mais apertado da faixa `compact` (que
 * mostra só o miolo de 82 dos 114 visíveis, cortando ~16px de cada borda).
 * Selo de identidade fica sempre dentro de 122-204.
 */
const SAFE_TOP = 122;
const SAFE_BOTTOM = 204;

/**
 * Linha do solo: a matéria da cena é o que cresce acima dela. Aérea ocupa a
 * maior parte da faixa visível (~58%), o perfil de solo é a base (~42%),
 * dividido em solo superficial fixo e subsolo/lençol variáveis.
 */
const SOIL_Y = 172;
const TOPSOIL_H = 14;
const UNDER_SHARED_H = VIEW_H - SOIL_Y - TOPSOIL_H;

const HOUSE_X = 55;
const SHED_X = 345;
const FIELD_X0 = 105;
const FIELD_X1 = 300;
const SPINE_X = 322;
const BADGE_X = 378;
const BADGE_Y = 140;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type PropertyKey =
  | 'sitio-horizonte'
  | 'cerrado-vivo'
  | 'boa-esperanca'
  | 'riacho-verde'
  | 'nova-safra'
  | 'planalto-familiar';

/** Selo de identidade: glifo de linha fina + etiqueta curta, fixo por propriedade. */
const IDENTITY: Record<PropertyKey, { label: string; houseFinished: boolean }> = {
  'sitio-horizonte': { label: 'hortaliças', houseFinished: true },
  'cerrado-vivo': { label: 'nascente', houseFinished: true },
  'boa-esperanca': { label: 'morango', houseFinished: true },
  'riacho-verde': { label: 'grãos', houseFinished: true },
  'nova-safra': { label: 'avicultura', houseFinished: false },
  'planalto-familiar': { label: 'laticínios', houseFinished: true },
};

/** Patamares de tecnologia, do mais básico ao mais avançado: régua de faixas fixas, nunca se sobrepõem. */
const TECH_TIERS = [
  { key: 'rega', min: 20, dy: -26 },
  { key: 'solar', min: 40, dy: -38 },
  { key: 'sensor', min: 65, dy: -50 },
  { key: 'estufa', min: 90, dy: -62 },
] as const;

/** Descrição textual por faixa: alimenta o `aria-label`, único canal para leitor de tela. */
function descreverProducao(v: number): string {
  if (v < 34) return 'poucos pés na lavoura, raiz rasa';
  if (v < 67) return 'lavoura em desenvolvimento, raiz mais profunda';
  return 'lavoura densa, raiz profunda e ramificada';
}

function descreverTecnologia(v: number): string {
  if (v < 20) return 'sem equipamento visível';
  if (v < 40) return 'com irrigação instalada';
  if (v < 65) return 'com irrigação e painel solar';
  if (v < 90) return 'com irrigação, painel solar e sensor de campo';
  return 'com estrutura completa: irrigação, painel solar, sensor e estufa';
}

function descreverSustentabilidade(v: number): string {
  if (v < 35) return 'lençol freático baixo e copa rala';
  if (v < 67) return 'lençol freático em nível médio e copa moderada';
  return 'lençol freático alto e copa densa';
}

function construirAriaLabel(propertyKey: string, production: number, technology: number, sustainability: number): string {
  const nome = PROPERTY_BY_KEY[propertyKey]?.name ?? 'Propriedade';
  return `${nome}: ${descreverProducao(production)}, ${descreverTecnologia(technology)}, ${descreverSustentabilidade(sustainability)}.`;
}

/** Selo de identidade: um traço distintivo por propriedade, simples o bastante para ler pequeno. */
function BadgeGlyph({ propertyKey }: { propertyKey: PropertyKey }) {
  const strokeProps = { fill: 'none', stroke: 'var(--color-tinta-900)', strokeWidth: 1.3, strokeLinecap: 'round' as const };

  switch (propertyKey) {
    case 'sitio-horizonte':
      // Folhas de hortaliça: três lóbulos saindo de um talo curto.
      return (
        <g {...strokeProps}>
          <path d="M11 20 L11 12" />
          <path d="M11 14 C6 13 4 9 5 4 C9 5 11 8 11 14 Z" />
          <path d="M11 14 C16 13 18 9 17 4 C13 5 11 8 11 14 Z" />
        </g>
      );
    case 'cerrado-vivo':
      // Nascente: gota com onda na base.
      return (
        <g {...strokeProps}>
          <path d="M11 3 C15 9 16 12 16 14 C16 17.3 13.6 20 11 20 C8.4 20 6 17.3 6 14 C6 12 7 9 11 3 Z" />
          <path d="M4 20.5 Q11 23 18 20.5" />
        </g>
      );
    case 'boa-esperanca':
      // Túnel baixo sobre a fileira de morango.
      return (
        <g {...strokeProps}>
          <path d="M2 20 Q11 4 20 20" />
          <line x1="2" y1="20" x2="20" y2="20" />
          <circle cx="11" cy="16" r="2" fill="var(--color-tinta-900)" stroke="none" />
        </g>
      );
    case 'riacho-verde':
      // Espiga de grão.
      return (
        <g {...strokeProps}>
          <line x1="11" y1="21" x2="11" y2="3" />
          {[6, 9.5, 13, 16.5].map((y) => (
            <g key={y}>
              <line x1="11" y1={y} x2="6" y2={y - 2.4} />
              <line x1="11" y1={y} x2="16" y2={y - 2.4} />
            </g>
          ))}
        </g>
      );
    case 'nova-safra':
      // Ovo em ninho: assentamento recente, avicultura como início de renda.
      return (
        <g {...strokeProps}>
          <ellipse cx="11" cy="11" rx="6" ry="7.4" />
          <path d="M2 19 Q11 15 20 19" />
        </g>
      );
    case 'planalto-familiar':
      // Cunha de queijo.
      return (
        <g {...strokeProps}>
          <path d="M3 18 L11 5 L19 18 Z" />
          <circle cx="12" cy="14.5" r="1" fill="var(--color-tinta-900)" stroke="none" />
          <circle cx="9" cy="16.5" r="0.8" fill="var(--color-tinta-900)" stroke="none" />
        </g>
      );
    default:
      return null;
  }
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

  const key = (propertyKey in IDENTITY ? propertyKey : 'sitio-horizonte') as PropertyKey;
  const identity = IDENTITY[key];
  const ariaLabel = construirAriaLabel(propertyKey, p, t, s);

  // Lençol freático: lâmina fina que sobe com a sustentabilidade, empurrando o subsolo, nunca dominando a cena.
  const waterH = 6 + (s / 100) * 22;
  const subsoloH = UNDER_SHARED_H - waterH;
  const waterY = VIEW_H - waterH;
  const subsoloY = SOIL_Y + TOPSOIL_H;

  // Copa: densidade e opacidade das folhas sobem com a sustentabilidade.
  const copaOpacidade = 0.32 + (s / 100) * 0.68;

  // Lavoura: número de pés cresce com a produção, distribuídos em fileira. Uma planta não é lavoura.
  const cropCount = compact
    ? clamp(2 + Math.floor(p / 25), 2, 5)
    : clamp(3 + Math.floor(p / 12), 3, 11);
  const cropXs = Array.from({ length: cropCount }, (_, i) => FIELD_X0 + ((i + 0.5) * (FIELD_X1 - FIELD_X0)) / cropCount);

  // Planta padrão (aérea + raiz simples), compartilhada por toda a fileira via <use>: mesma altura e raiz para todos os pés.
  const plantId = `${uid}-planta`;
  const stemStrokeW = 1.1 + (p / 100) * 1.2;
  const stemApexLocal = -(8 + (p / 100) * (compact ? 30 : 44));
  const rootDepthLocal = 10 + (p / 100) * (compact ? 22 : 32);
  const FOLHAS_LOCAL = [
    { y: stemApexLocal * 0.35, lado: -1 as const },
    { y: stemApexLocal * 0.6, lado: 1 as const },
    { y: stemApexLocal * 0.85, lado: -1 as const },
  ];

  // Escala dos elementos que sobram na faixa compacta: menos coisa, cada uma maior, para não parecer diagrama truncado.
  const houseScale = compact ? 1.3 : 1;
  const shedScale = compact ? 1.3 : 1;
  const badgeScale = compact ? 1.15 : 1;

  // Equipamentos: cada patamar soma um item, nunca remove o anterior.
  const activeTechCount = TECH_TIERS.filter((tier) => t >= tier.min).length;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      focusable="false"
      viewBox={`0 ${VIEW_Y} ${VIEW_W} ${VIEW_VISIBLE_H}`}
      preserveAspectRatio="xMidYMid slice"
      className={`block w-full ${compact ? 'aspect-[400/82]' : 'aspect-[400/114]'} ${className ?? ''}`}
    >
      <defs>
        {/* Planta padrão em coordenadas locais (solo em y=0): reaproveitada por toda a fileira. */}
        <g id={plantId}>
          <path
            d={`M0 0 C 0 ${stemApexLocal * 0.5}, -0.6 ${stemApexLocal * 0.8}, 0 ${stemApexLocal}`}
            fill="none"
            stroke="var(--color-producao)"
            strokeWidth={stemStrokeW}
            strokeLinecap="round"
            style={{ transition: 'd 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
          {FOLHAS_LOCAL.map(({ y, lado }, i) => (
            <path
              key={i}
              d={`M0 ${y} C ${lado * 4} ${y - 0.4}, ${lado * 7} ${y - 1.6}, ${lado * 8} ${y - 3.6}`}
              fill="none"
              stroke="var(--color-producao)"
              strokeWidth={stemStrokeW * 0.75}
              strokeLinecap="round"
              opacity={copaOpacidade}
            />
          ))}
          <path
            d={`M0 0 Q ${rootDepthLocal * 0.2} ${rootDepthLocal * 0.5} 0 ${rootDepthLocal}`}
            fill="none"
            stroke="var(--color-producao)"
            strokeWidth={Math.max(stemStrokeW - 0.3, 0.7)}
            strokeLinecap="round"
            opacity="0.85"
            style={{ transition: 'd 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </g>
      </defs>

      {/* Perfil do solo: base da cena, não a matéria dela. Chapado, fio de separação, sem degradê. */}
      <rect x="0" y={SOIL_Y} width={VIEW_W} height={TOPSOIL_H} fill="var(--color-papel-400)" />
      <rect
        x="0"
        y={subsoloY}
        width={VIEW_W}
        height={Math.max(subsoloH, 0)}
        fill="var(--color-tinta-500)"
        style={{ transition: 'height 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      />
      <rect
        x="0"
        y={waterY}
        width={VIEW_W}
        height={waterH}
        fill="var(--color-sustentabilidade)"
        opacity="0.82"
        style={{ transition: 'y 500ms cubic-bezier(0.16, 1, 0.3, 1), height 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      />
      <line x1="0" y1={subsoloY} x2={VIEW_W} y2={subsoloY} stroke="var(--color-regua)" strokeWidth="1" />
      <line
        x1="0"
        y1={waterY}
        x2={VIEW_W}
        y2={waterY}
        stroke="var(--color-regua)"
        strokeWidth="1"
        style={{ transition: 'y1 500ms cubic-bezier(0.16, 1, 0.3, 1), y2 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      />
      {/* Linha do solo: referência fixa entre a terra e o ar. */}
      <line x1="0" y1={SOIL_Y} x2={VIEW_W} y2={SOIL_Y} stroke="var(--color-tinta-900)" strokeWidth="1.4" />

      {/* Lavoura: fileira de pés, cada um com parte aérea e raiz, quantidade cresce com a produção. */}
      {cropXs.map((x, i) => (
        <use key={i} href={`#${plantId}`} x={x} y={SOIL_Y} />
      ))}

      {/* Casa: elevação de linha fina, sem preenchimento, assentada na linha do solo com tique de fundação. */}
      <g transform={`translate(${HOUSE_X}, ${SOIL_Y}) scale(${houseScale})`} fill="none" stroke="var(--color-tinta-900)" strokeWidth="1.2">
        <path d="M-16,-12 L0,-26 L16,-12" strokeDasharray={identity.houseFinished ? undefined : '2.5 2.5'} />
        <path d="M-14,-12 L-14,0 L14,0 L14,-12" strokeDasharray={identity.houseFinished ? undefined : '2.5 2.5'} />
        {identity.houseFinished && <line x1="4" y1="0" x2="4" y2="-12" strokeWidth="1" />}
        <line x1="-18" y1="1.2" x2="-14" y2="1.2" strokeWidth="1.4" opacity="0.55" />
        <line x1="14" y1="1.2" x2="18" y2="1.2" strokeWidth="1.4" opacity="0.55" />
      </g>

      {/* Galpão: elevação de duas águas, mesma linguagem de linha fina, também assentado e com fundação. */}
      <g transform={`translate(${SHED_X}, ${SOIL_Y}) scale(${shedScale})`} fill="none" stroke="var(--color-tinta-900)" strokeWidth="1.2">
        <path d="M-20,-8 L0,-20 L20,-8" />
        <path d="M-18,-8 L-18,0 L18,0 L18,-8" />
        <line x1="-18" y1="-4" x2="18" y2="-4" strokeWidth="0.8" opacity="0.6" />
        <line x1="-22" y1="1.2" x2="-18" y2="1.2" strokeWidth="1.4" opacity="0.55" />
        <line x1="18" y1="1.2" x2="22" y2="1.2" strokeWidth="1.4" opacity="0.55" />
      </g>

      {/* Tecnologia, bloco cheio: régua vertical de patamares fixos. Cada rótulo tem faixa própria, nunca cruza outro. */}
      {!compact && (
        <g>
          <line
            x1={SPINE_X}
            y1={SOIL_Y - 6}
            x2={SPINE_X}
            y2={SOIL_Y + TECH_TIERS[TECH_TIERS.length - 1].dy}
            stroke="var(--color-tinta-900)"
            strokeWidth="1"
            opacity="0.3"
          />
          {TECH_TIERS.map((tier) => {
            const ativo = t >= tier.min;
            const y = SOIL_Y + tier.dy;
            return (
              <g key={tier.key}>
                <line
                  x1={SPINE_X - 5}
                  y1={y}
                  x2={SPINE_X + 5}
                  y2={y}
                  stroke="var(--color-tecnologia)"
                  strokeWidth="1.4"
                  opacity={ativo ? 1 : 0.18}
                  style={{ transition: 'opacity 350ms ease-out' }}
                />
                {ativo && (
                  <text x={SPINE_X + 9} y={y + 2.6} fontFamily="var(--font-mono)" fontSize="7" fill="var(--color-tinta-700)">
                    {tier.key}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      )}

      {/* Tecnologia, faixa compacta: sem linha de chamada nem rótulo, só um pequeno bloco de marcas ao lado do galpão. */}
      {compact && activeTechCount > 0 && (
        <g>
          {TECH_TIERS.filter((tier) => t >= tier.min).map((tier, i) => (
            <rect
              key={tier.key}
              x={SHED_X + 26}
              y={SOIL_Y - 14 - i * 9}
              width="7"
              height="7"
              fill="var(--color-tecnologia)"
            />
          ))}
        </g>
      )}

      {/* Selo de identidade: glifo fixo por propriedade, sempre no mesmo lugar, sempre inteiro e livre de colisão. */}
      <g transform={`translate(${BADGE_X - 11 * badgeScale}, ${BADGE_Y - 11 * badgeScale}) scale(${badgeScale})`}>
        <BadgeGlyph propertyKey={key} />
      </g>
      {!compact && (
        <text
          x={BADGE_X}
          y={Math.min(BADGE_Y + 20, SAFE_BOTTOM - 4)}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="7"
          fill="var(--color-tinta-700)"
        >
          {identity.label}
        </text>
      )}
    </svg>
  );
}
