'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cpu, Leaf, Sprout, Wallet, type LucideIcon } from 'lucide-react';
import type { IndicatorKey } from '@/types/game';

/*
  Os quatro indicadores, herdados da V3 e re-tingidos para a paleta noturna da V4.

  Forma unificada: um CANAL, a valeta que corre no pé do terraço conduzindo
  água. Trilha escavada, preenchimento sólido na cor do indicador, ícone fixo
  à esquerda e número impresso à direita.

  Três canais redundantes de leitura, e nenhum deles é a cor:
  · o ícone diz QUAL indicador é (forma);
  · o comprimento do preenchimento diz a proporção;
  · o número impresso diz o valor exato.

  Isso é requisito de acessibilidade (daltonismo) e de projeção (a seis metros
  numa sala com luz acesa, matiz próximo vira o mesmo cinza).

  Movimento 3 · vazão: o preenchimento cresce por `transform: scaleX()` a
  partir da borda esquerda. É `transition`, não `animation`, de propósito:
  transição não dispara na primeira pintura, então o canal só se move quando o
  valor MUDA de verdade pelo realtime, nunca a cada troca de tela. Zero
  JavaScript, e `transform` é a única propriedade animada, o que mantém o
  movimento liso em celular popular.
*/

export type IndicatorKind = 'financas' | 'producao' | 'tecnologia' | 'sustentabilidade';

/**
 * Ícone de cada indicador: o canal de leitura que não depende de cor.
 *
 * Exportado (não só usado internamente) porque a identidade visual das 6
 * propriedades (mapa do DF, faixa de propriedades, selo na cena) reaproveita
 * exatamente este ícone e esta cor: zero glifo novo fora do sistema de
 * indicadores já existente.
 */
export const GAUGE_ICON: Record<IndicatorKind, LucideIcon> = {
  financas: Wallet,
  producao: Sprout,
  tecnologia: Cpu,
  sustentabilidade: Leaf,
};
const ICONE = GAUGE_ICON;

/** Converte a chave de indicador do domínio (`cash`, `production`...) na família de cor/ícone do canal. */
export const INDICATOR_KEY_TO_KIND: Record<IndicatorKey, IndicatorKind> = {
  cash: 'financas',
  production: 'producao',
  technology: 'tecnologia',
  sustainability: 'sustentabilidade',
};

/** Rótulo canônico. Usado em toda superfície, sem variação. */
export const GAUGE_LABEL: Record<IndicatorKind, string> = {
  financas: 'Finanças',
  producao: 'Produção',
  tecnologia: 'Tecnologia',
  sustentabilidade: 'Sustentabilidade',
};

/**
 * Cor de preenchimento do canal, por indicador.
 *
 * O tom "600" (ou o `financas` cheio) só aparece como superfície e ícone. Para
 * TEXTO pequeno existe `GAUGE_INK_TEXTO`, porque o 600 não passa AA em corpo.
 */
const PREENCHIMENTO: Record<IndicatorKind, string> = {
  financas: 'bg-financas',
  producao: 'bg-producao',
  tecnologia: 'bg-tecnologia',
  sustentabilidade: 'bg-sustentabilidade',
};

/** Cor de ícone: mesma família do preenchimento, tamanho de UI. */
export const GAUGE_INK: Record<IndicatorKind, string> = {
  financas: 'text-financas-texto',
  producao: 'text-verde-700',
  tecnologia: 'text-azul-700',
  sustentabilidade: 'text-sustentabilidade-texto',
};

/** Família de terraço correspondente, para tingir um degrau do indicador. */
export const GAUGE_TERRACO: Record<IndicatorKind, string> = {
  financas: 'terr-financas',
  producao: 'terr-verde',
  tecnologia: 'terr-azul',
  sustentabilidade: 'terr-sustentabilidade',
};

export type CanalSize = 'aluno' | 'projecao' | 'compacto';

const ALTURA: Record<CanalSize, string> = {
  compacto: 'h-1.5',
  aluno: 'h-2',
  // Grosso de propósito: o professor lê isto do fundo da sala.
  projecao: 'h-4',
};

const ICONE_PX: Record<CanalSize, number> = {
  compacto: 14,
  aluno: 18,
  projecao: 28,
};

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * A trilha do canal com o preenchimento proporcional.
 *
 * Decorativa por si: quem descreve o valor para leitor de tela é o `role`
 * e o `aria-label` do componente que a envolve.
 */
export function CanalTrilha({
  kind,
  value,
  size = 'aluno',
  className,
}: {
  kind: IndicatorKind;
  value: number;
  size?: CanalSize;
  className?: string;
}) {
  const pct = clamp(value);

  return (
    <div
      aria-hidden="true"
      className={[
        'w-full overflow-hidden rounded-full bg-nevoa-200',
        // A borda superior escurecida é a parede da valeta vista de cima.
        'shadow-[inset_0_1px_0_0_rgba(16,36,29,0.18)]',
        ALTURA[size],
        className ?? '',
      ].join(' ')}
    >
      <div
        className={[
          'h-full w-full origin-left rounded-full',
          'transition-transform duration-500 ease-out',
          PREENCHIMENTO[kind],
        ].join(' ')}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}

/** Ícone do indicador, no tamanho da superfície. */
export function CanalIcone({
  kind,
  size = 'aluno',
  className,
}: {
  kind: IndicatorKind;
  size?: CanalSize;
  className?: string;
}) {
  const Icone = ICONE[kind];
  return (
    <Icone
      size={ICONE_PX[size]}
      strokeWidth={2.2}
      aria-hidden="true"
      className={[GAUGE_INK[kind], 'shrink-0', className ?? ''].join(' ')}
    />
  );
}

// ---------------------------------------------------------------------------
// Dial: manômetro de painel industrial, forma primária dos 4 indicadores
// ---------------------------------------------------------------------------

/*
  Direção V5 "Painel de Silo": o indicador não é mais um anel de progresso
  (V4), é um MOSTRADOR com escala numerada e PONTEIRO, como o manômetro de
  pressão de um painel de silo/central de controle.

  Quatro leituras redundantes agora, uma a mais que o anel da V4:
  · o ícone diz QUAL indicador é (forma);
  · as marcações de escala (ticks) dão a referência absoluta 0..100;
  · o PONTEIRO aponta o valor exato, girando sobre um eixo fixo;
  · o arco de faixa (mesmo `stroke-dashoffset` da V4) ainda preenche
    proporcionalmente, then a leitura por comprimento não se perde.
  · o número impresso ao lado (em `Meter`, não neste componente) fecha com o
    valor exato por extenso.

  Geometria: mostrador em domo (240° de varredura, ápice no topo, eixo do
  ponteiro no terço inferior do quadrado que envolve o SVG), o desenho mais
  comum de manômetro analógico. Ângulo em convenção de tela (0°=direita,
  90°=baixo, sentido horário crescente): início 150° (baixo-esquerda),
  fim 390°=30° (baixo-direita), atravessando 270° (topo) no meio do curso.

  Movimento: o ponteiro gira via `transform: rotate()` num `<g>` com
  `transform-origin` no eixo, `transition` em `transform` (nunca `animation`:
  só dispara quando o valor muda de verdade, disciplina de sempre). Curva
  `ease-out` simples, sem overshoot, "parada seca" de instrumento mecânico,
  não elástico. `prefers-reduced-motion` já é coberto pela regra global em
  `globals.css` (zera toda `transition-duration`).
*/

interface DialDimensao {
  diametro: number;
  espessura: number;
  raioTicksMaior: number;
  raioTicksMenor: number;
  raioPonteiro: number;
  raioCubo: number;
  comTicksMenores: boolean;
}

const DIAL_DIMENSAO: Record<CanalSize, DialDimensao> = {
  compacto: {
    diametro: 32,
    espessura: 3,
    raioTicksMaior: 13,
    raioTicksMenor: 10,
    raioPonteiro: 11,
    raioCubo: 2.2,
    comTicksMenores: false,
  },
  aluno: {
    diametro: 58,
    espessura: 4,
    raioTicksMaior: 24,
    raioTicksMenor: 19,
    raioPonteiro: 20,
    raioCubo: 3.4,
    comTicksMenores: true,
  },
  // Grosso e grande de propósito: o professor lê isto do fundo da sala.
  projecao: {
    diametro: 108,
    espessura: 6,
    raioTicksMaior: 45,
    raioTicksMenor: 36,
    raioPonteiro: 38,
    raioCubo: 6,
    comTicksMenores: true,
  },
};

/** Ângulo (graus, convenção de tela) do início e do fim da varredura do mostrador. */
const ANGULO_INICIO = 150;
const VARREDURA = 240;

/** Ponto no perímetro do mostrador para um ângulo em graus. */
function pontoNoAngulo(cx: number, cy: number, raio: number, anguloGraus: number): [number, number] {
  const rad = (anguloGraus * Math.PI) / 180;
  return [cx + raio * Math.cos(rad), cy + raio * Math.sin(rad)];
}

/** Ângulo do ponteiro para um valor 0..100. */
function anguloDoValor(pct: number): number {
  return ANGULO_INICIO + (pct / 100) * VARREDURA;
}

export function CanalArco({
  kind,
  value,
  size = 'aluno',
  className,
  children,
}: {
  kind: IndicatorKind;
  value: number;
  size?: CanalSize;
  className?: string;
  /** Conteúdo centralizado dentro do eixo do mostrador (o ícone do indicador). */
  children?: ReactNode;
}) {
  const pct = clamp(value);
  const { diametro, espessura, raioTicksMaior, raioTicksMenor, raioPonteiro, raioCubo, comTicksMenores } =
    DIAL_DIMENSAO[size];

  // O eixo do ponteiro mora no terço inferior do quadrado, não no centro: é o
  // que dá o formato de domo (arco bulge para cima, abertura embaixo), como
  // um manômetro de verdade.
  const eixoX = diametro / 2;
  const eixoY = diametro * 0.62;
  const raioTrilha = raioTicksMaior;

  const inicio = pontoNoAngulo(eixoX, eixoY, raioTrilha, ANGULO_INICIO);
  const fim = pontoNoAngulo(eixoX, eixoY, raioTrilha, ANGULO_INICIO + VARREDURA);
  const perimetro = (VARREDURA / 360) * 2 * Math.PI * raioTrilha;
  const offset = perimetro * (1 - pct / 100);

  const ticksMaiores = [0, 25, 50, 75, 100];
  const ticksMenores = comTicksMenores
    ? [10, 20, 30, 40, 60, 70, 80, 90].filter((tick) => !ticksMaiores.includes(tick))
    : [];

  const ponteiroAngulo = anguloDoValor(pct);
  // O ponteiro é desenhado apontando para cima (270°, base = topo do quadro) e
  // rotacionado pelo delta até o ângulo real: assim a rotação parte sempre da
  // mesma referência, o que é o que permite ao CSS `transition` animar entre
  // valores sucessivos sem salto de referência.
  const rotacaoPonteiro = ponteiroAngulo - 270;

  return (
    <span
      aria-hidden="true"
      className={['relative inline-flex shrink-0 items-center justify-center', className ?? ''].join(' ')}
      style={{ width: diametro, height: diametro }}
    >
      <svg width={diametro} height={diametro} viewBox={`0 0 ${diametro} ${diametro}`}>
        {/* Trilha do mostrador: a faixa cinza-aço por trás da escala. */}
        <path
          d={`M ${inicio[0]} ${inicio[1]} A ${raioTrilha} ${raioTrilha} 0 1 1 ${fim[0]} ${fim[1]}`}
          fill="none"
          stroke="var(--color-nevoa-200)"
          strokeWidth={espessura}
          strokeLinecap="round"
        />
        {/* Faixa de valor: mesma leitura por comprimento que o anel da V4 mantinha. */}
        <path
          d={`M ${inicio[0]} ${inicio[1]} A ${raioTrilha} ${raioTrilha} 0 1 1 ${fim[0]} ${fim[1]}`}
          fill="none"
          stroke={`var(--color-${kind})`}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={perimetro}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 550ms ease-out' }}
        />

        {/* Marcações de escala: a referência absoluta que um anel sozinho não dava. */}
        {ticksMaiores.map((tick) => {
          const angulo = anguloDoValor(tick);
          const [x1, y1] = pontoNoAngulo(eixoX, eixoY, raioTicksMaior + 1, angulo);
          const [x2, y2] = pontoNoAngulo(eixoX, eixoY, raioTicksMenor - 1, angulo);
          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--color-terra-500)"
              strokeWidth={Math.max(1, espessura * 0.32)}
              strokeLinecap="round"
            />
          );
        })}
        {ticksMenores.map((tick) => {
          const angulo = anguloDoValor(tick);
          const [x1, y1] = pontoNoAngulo(eixoX, eixoY, raioTicksMaior, angulo);
          const [x2, y2] = pontoNoAngulo(eixoX, eixoY, raioTicksMenor + 2, angulo);
          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--color-nevoa-200)"
              strokeWidth={Math.max(0.75, espessura * 0.2)}
              strokeLinecap="round"
            />
          );
        })}

        {/* Ponteiro: gira sobre o eixo fixo, ease-out sem overshoot, parada seca. */}
        <g
          style={{
            transformOrigin: `${eixoX}px ${eixoY}px`,
            transform: `rotate(${rotacaoPonteiro}deg)`,
            transition: 'transform 550ms ease-out',
          }}
        >
          <line
            x1={eixoX}
            y1={eixoY}
            x2={eixoX}
            y2={eixoY - raioPonteiro}
            stroke={`var(--color-${kind})`}
            strokeWidth={Math.max(1.25, espessura * 0.45)}
            strokeLinecap="round"
          />
        </g>
        {/* Cubo do eixo: o parafuso central do mostrador. */}
        <circle cx={eixoX} cy={eixoY} r={raioCubo} fill="var(--color-nevoa-200)" />
        <circle cx={eixoX} cy={eixoY} r={raioCubo * 0.45} fill="var(--color-terra-500)" />
      </svg>
      {children ? (
        <span
          className="absolute inset-x-0 flex items-center justify-center"
          style={{ top: eixoY - diametro * 0.42, height: diametro * 0.4 }}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Contador que sobe/desce até `target` em vez de trocar de número seco.
 *
 * Só anima quando o alvo muda de fato (não na primeira pintura, mesma regra
 * do resto do sistema de movimento) e respeita `prefers-reduced-motion`
 * lendo a media query diretamente: quando reduzido, o valor salta direto
 * para o alvo, sem passo intermediário.
 */
export function useCountUp(target: number, durationMs = 550): number {
  const [displayed, setDisplayed] = useState(target);
  // `fromRef` nasce igual a `target`: no primeiro efeito, `from === target` é
  // verdadeiro e a função sai sem tocar em estado, então não existe pintura
  // extra na montagem, só quando o alvo muda de verdade depois.
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      // Ainda assim agendado via rAF (não uma chamada síncrona solta no corpo
      // do efeito): o valor salta direto para o alvo, sem passo intermediário.
      fromRef.current = target;
      rafRef.current = requestAnimationFrame(() => setDisplayed(target));
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }

    const start = performance.now();

    function passo(now: number) {
      const decorrido = now - start;
      const progresso = Math.min(1, decorrido / durationMs);
      // Ease-out: acelera no início, assenta no fim, mesma curva do resto do motion system.
      const facilitado = 1 - Math.pow(1 - progresso, 3);
      const atual = from + (target - from) * facilitado;
      setDisplayed(atual);

      if (progresso < 1) {
        rafRef.current = requestAnimationFrame(passo);
      } else {
        fromRef.current = target;
      }
    }

    rafRef.current = requestAnimationFrame(passo);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return displayed;
}
