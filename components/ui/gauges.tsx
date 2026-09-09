/*
  Os quatro medidores do boletim.

  Regra que não se negocia: cada indicador tem FORMA própria, não só cor. Dois
  verdes vizinhos numa barra idêntica se confundem em daltonismo e a seis
  metros de distância num projetor. Aqui a silhueta já diz qual indicador é,
  mesmo em escala de cinza, mesmo desfocado.

  · Finanças        selo de carimbo que fecha girando
  · Produção        caule que cresce da base para cima
  · Tecnologia      barras de sinal, tipo gráfico de jornal econômico
  · Sustentabilidade lençol freático subindo dentro do perfil do solo

  Todos desenham num viewBox 0 0 40 40, herdam a cor de `currentColor` e são
  puramente decorativos: `aria-hidden`. O valor legível em texto fica sempre ao
  lado, no componente que os usa. Nenhum deles depende de gradiente, filtro ou
  imagem.
*/

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export interface GaugeProps {
  /** 0..100 */
  value: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Finanças · selo de carimbo
// ---------------------------------------------------------------------------

const SELO_RAIO = 13.5;
const SELO_VOLTA = 2 * Math.PI * SELO_RAIO;
/** Serrilha do selo: 24 dentes ao redor, como borda de estampilha. */
const SELO_DENTES = Array.from({ length: 24 }, (_, index) => (index * 360) / 24);

export function SeloFinancas({ value, className }: GaugeProps) {
  const pct = clamp(value);
  const preenchido = SELO_VOLTA * (pct / 100);

  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <g stroke="currentColor" fill="none" strokeLinecap="round">
        {SELO_DENTES.map((angulo) => (
          <line
            key={angulo}
            x1="20"
            y1="2.5"
            x2="20"
            y2="5"
            strokeWidth="1.2"
            opacity="0.3"
            transform={`rotate(${angulo} 20 20)`}
          />
        ))}

        <circle cx="20" cy="20" r={SELO_RAIO} strokeWidth="2.5" opacity="0.16" />

        <circle
          cx="20"
          cy="20"
          r={SELO_RAIO}
          strokeWidth="2.5"
          strokeDasharray={`${preenchido} ${SELO_VOLTA}`}
          transform="rotate(-90 20 20)"
          style={{ transition: 'stroke-dasharray 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />

        {/*
          Aro interno de moeda. Um traço reto atravessando o círculo lia como
          sinal de proibido, que é o oposto do sentido do indicador.
        */}
        <circle cx="20" cy="20" r="6.5" strokeWidth="1.2" opacity="0.3" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Produção · caule que cresce
// ---------------------------------------------------------------------------

/*
  O caule sobe do solo (y=36) até o topo (y=5) com cinco pares de folha. O
  crescimento é uma máscara retangular que sobe da base: com produção baixa só
  o pé da planta aparece, com produção alta a parte aérea inteira aparece.
*/
const CAULE_BASE = 36;
const CAULE_TOPO = 5;
const CAULE_ALTURA = CAULE_BASE - CAULE_TOPO;

const FOLHAS = [
  { y: 30, lado: -1 },
  { y: 25, lado: 1 },
  { y: 20, lado: -1 },
  { y: 15, lado: 1 },
  { y: 10.5, lado: -1 },
];

function desenhoCaule(id: string) {
  return (
    <g id={id} stroke="currentColor" fill="none" strokeLinecap="round">
      <path d={`M20 ${CAULE_BASE} C 20 28, 19.4 18, 20 ${CAULE_TOPO}`} strokeWidth="2" />
      {FOLHAS.map(({ y, lado }) => (
        <path
          key={`${y}-${lado}`}
          d={`M20 ${y} C ${20 + lado * 4} ${y - 0.6}, ${20 + lado * 7.5} ${y - 2.4}, ${20 + lado * 8.6} ${y - 5.4}`}
          strokeWidth="1.7"
        />
      ))}
    </g>
  );
}

export function CauleProducao({ value, className }: GaugeProps) {
  const pct = clamp(value);
  const alturaVisivel = (CAULE_ALTURA * pct) / 100;
  const recorteId = `caule-recorte-${Math.round(pct)}`;

  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={recorteId}>
          <rect
            x="0"
            y={CAULE_BASE - alturaVisivel}
            width="40"
            height={alturaVisivel + 4}
            style={{ transition: 'y 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </clipPath>
      </defs>

      {/* Linha do solo: referência fixa, sempre visível. */}
      <line
        x1="8"
        y1={CAULE_BASE}
        x2="32"
        y2={CAULE_BASE}
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.45"
      />

      <g opacity="0.15">{desenhoCaule('caule-fantasma')}</g>
      <g clipPath={`url(#${recorteId})`}>{desenhoCaule('caule-vivo')}</g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tecnologia · barras de sinal
// ---------------------------------------------------------------------------

/*
  Cinco barras crescentes, estética de gráfico de jornal econômico. O número de
  barras acesas é discreto de propósito: tecnologia no jogo se adota em degrau
  (a equipe compra ou não compra), não em fração contínua.
*/
const BARRAS = [
  { x: 6, altura: 9 },
  { x: 13, altura: 15 },
  { x: 20, altura: 21 },
  { x: 27, altura: 26 },
  { x: 34, altura: 31 },
];

export function BarrasTecnologia({ value, className }: GaugeProps) {
  const pct = clamp(value);
  const acesas = pct <= 0 ? 0 : Math.max(1, Math.round((pct / 100) * BARRAS.length));

  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <line
        x1="3"
        y1="36.5"
        x2="37"
        y2="36.5"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.45"
      />

      {BARRAS.map(({ x, altura }, indice) => {
        const acesa = indice < acesas;
        return (
          <rect
            key={x}
            x={x - 2.4}
            y={35 - altura}
            width="4.8"
            height={altura}
            fill="currentColor"
            opacity={acesa ? 1 : 0.16}
            style={{ transition: 'opacity 350ms ease-out' }}
          />
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sustentabilidade · lençol freático no perfil do solo
// ---------------------------------------------------------------------------

/*
  Recorte vertical do terreno visto de lado, o mesmo vocabulário gráfico da
  cena da propriedade: a água sobe dentro do perfil conforme a sustentabilidade
  sobe, e a folha no topo só aparece quando o solo está de fato recuperado.
*/
const PERFIL_TOPO = 6;
const PERFIL_BASE = 36;
const PERFIL_ALTURA = PERFIL_BASE - PERFIL_TOPO;

export function LencolSustentabilidade({ value, className }: GaugeProps) {
  const pct = clamp(value);
  const alturaAgua = (PERFIL_ALTURA * pct) / 100;
  const nivel = PERFIL_BASE - alturaAgua;
  const recuperado = pct >= 70;

  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      {/* Água acumulada. */}
      <rect
        x="10"
        y={nivel}
        width="20"
        height={alturaAgua}
        fill="currentColor"
        opacity="0.28"
        style={{ transition: 'y 500ms cubic-bezier(0.16, 1, 0.3, 1), height 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      />

      {/* Linha do nível: a leitura precisa de uma aresta nítida, não de degradê. */}
      {pct > 0 ? (
        <line
          x1="10"
          y1={nivel}
          x2="30"
          y2={nivel}
          stroke="currentColor"
          strokeWidth="2"
          style={{ transition: 'y1 500ms cubic-bezier(0.16, 1, 0.3, 1), y2 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      ) : null}

      {/* Perfil do terreno: moldura aberta em cima, como corte de trincheira. */}
      <path
        d={`M10 ${PERFIL_TOPO} L10 ${PERFIL_BASE} L30 ${PERFIL_BASE} L30 ${PERFIL_TOPO}`}
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="square"
      />

      {/* Folha de topo: sinal binário de solo recuperado. */}
      <path
        d="M20 8.5 C 20 5, 22.6 2.6, 26 2.4 C 25.6 6, 23.2 8.4, 20 8.5 Z"
        fill="currentColor"
        opacity={recuperado ? 0.95 : 0.14}
        style={{ transition: 'opacity 350ms ease-out' }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Despacho por tipo
// ---------------------------------------------------------------------------

export type IndicatorKind = 'financas' | 'producao' | 'tecnologia' | 'sustentabilidade';

const GAUGE: Record<IndicatorKind, (props: GaugeProps) => React.ReactElement> = {
  financas: SeloFinancas,
  producao: CauleProducao,
  tecnologia: BarrasTecnologia,
  sustentabilidade: LencolSustentabilidade,
};

/** Cor de tinta de cada indicador, para aplicar via `text-*` no wrapper. */
export const GAUGE_INK: Record<IndicatorKind, string> = {
  financas: 'text-financas',
  producao: 'text-producao',
  tecnologia: 'text-tecnologia',
  sustentabilidade: 'text-sustentabilidade',
};

/** Rótulo canônico de cada indicador. Usado em toda superfície. */
export const GAUGE_LABEL: Record<IndicatorKind, string> = {
  financas: 'Finanças',
  producao: 'Produção',
  tecnologia: 'Tecnologia',
  sustentabilidade: 'Sustentabilidade',
};

export function Gauge({ kind, value, className }: GaugeProps & { kind: IndicatorKind }) {
  const Desenho = GAUGE[kind];
  return <Desenho value={value} className={className} />;
}
