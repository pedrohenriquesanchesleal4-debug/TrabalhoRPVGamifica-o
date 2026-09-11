'use client';

/**
 * SAFRA DF · paisagem do amanhecer (06:20) sobre o Cerrado.
 *
 * Cenário vetorial reutilizável, direção visual V6 "Amanhecer do Cerrado":
 * a janela pela qual as telas cinemáticas olham — home, entrada, abertura da
 * partida e projeção do professor. Feito 100% em SVG + CSS, sem imagem, sem
 * vídeo, sem WebGL, sem biblioteca.
 *
 * Camadas, de trás para frente: céu de 06:20 (gradiente noturno→quente no
 * horizonte), brilho do sol nascente (respiro lento, `animate-amanhecer`),
 * estrelas que apagam (`luz-pisca`, cintilar), serras em silhueta, copas de
 * ipê como manchas escuras, o sol, nuvens à deriva (`nuvem-painel`, 46s),
 * pássaros cruzando (`bando`, 17s), a estrada de terra com divisor pontilhado,
 * as fileiras de plantio em perspectiva, a sede da fazenda com janela acesa e
 * touceiras de capim balançando no primeiro plano (`folhagem`, 5s).
 *
 * Todos os laços são `transform`/`opacity` e moram na paisagem — nunca em
 * painel de dado. `prefers-reduced-motion: reduce` é resolvido globalmente
 * em `globals.css` (classes `.ceu-respiro`, `.bando`, `.nuvem-painel`,
 * `.folhagem`, `.luz-pisca` ganham estado estático explícito).
 *
 * Uso: `<CerradoLandscape className="...">` dentro de um contêiner com
 * overflow-hidden; `preserveAspectRatio="xMidYMid slice"` corta o cenário
 * para caber em qualquer proporção (celular 9:19, projetor 16:9).
 */

const VIEW_W = 1440;
const VIEW_H = 760;

/** Estrelas do fim da noite e janelas acesas, com piscas defasadas. */
const LUZES: { x: number; y: number; r: number; delay: string }[] = [
  { x: 208, y: 120, r: 2, delay: '0s' },
  { x: 420, y: 82, r: 1.6, delay: '-1.4s' },
  { x: 604, y: 140, r: 2, delay: '-2.6s' },
  { x: 1288, y: 96, r: 1.6, delay: '-0.8s' },
  { x: 1336, y: 178, r: 2, delay: '-2.1s' },
  { x: 1152, y: 414, r: 1.8, delay: '-1.9s' },
  { x: 968, y: 430, r: 1.6, delay: '-3s' },
];

/** Fileiras de plantio em perspectiva, do rodapé ao horizonte (vanishing point ~(306, 520)). */
const FILEIRAS = Array.from({ length: 9 }, (_, i) => {
  const f = i / 8;
  const x0 = 62 + f * 430;
  const x1 = 306 + (f - 0.5) * 60;
  return { x0, x1, y0: 760, y1: 530 };
});

/** Pássaros: um caminho em V por ave, desenhados no espaço local do grupo. */
function Bando() {
  return (
    <>
      <g className="bando animate-voo" style={{ animationDelay: '-3s' }} aria-hidden="true">
        <path
          d="M0 0 q 5 -8 11 -1 q 6 -7 12 1 M0 14 q 5 -8 11 -1 q 6 -7 12 1"
          fill="none"
          stroke="var(--color-terra-500)"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
          transform="translate(60, 190)"
        />
      </g>
      <g className="bando animate-voo" style={{ animationDelay: '-12s' }} aria-hidden="true">
        <path
          d="M0 0 q 4 -6 9 -1 q 5 -6 10 1"
          fill="none"
          stroke="var(--color-terra-500)"
          strokeOpacity="0.45"
          strokeWidth="1.8"
          strokeLinecap="round"
          transform="translate(180, 108)"
        />
      </g>
    </>
  );
}

/** Touceira de capim: um único traço em V composto, balançando na base. */
function Touceira({ x, y, s = 1, delay = '0s' }: { x: number; y: number; s?: number; delay?: string }) {
  return (
    <g
      className="folhagem animate-balanco"
      style={{ transformBox: 'fill-box', transformOrigin: 'bottom', animationDelay: delay }}
      aria-hidden="true"
    >
      <path
        d="M0 16 q 7 -14 14 1 q 7 -13 14 1"
        fill="none"
        stroke="var(--color-verde-700)"
        strokeOpacity="0.5"
        strokeWidth="2.4"
        strokeLinecap="round"
        transform={`translate(${x}, ${y}) scale(${s})`}
      />
    </g>
  );
}

export function CerradoLandscape({ className }: { className?: string }) {
  return (
    <div className={['pointer-events-none absolute inset-0 overflow-hidden', className ?? ''].join(' ')} aria-hidden="true">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
        className="block h-full w-full"
      >
        <defs>
          {/* Céu de 06:20: ainda noturno no zênite, quente no horizonte. */}
          <linearGradient id="ceu-v6" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--color-nevoa-50)' }} />
            <stop offset="58%" style={{ stopColor: 'var(--color-nevoa-50)' }} />
            <stop offset="82%" style={{ stopColor: 'var(--color-verde-800)', stopOpacity: '0.55' }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-amanhecer)', stopOpacity: '0.3' }} />
          </linearGradient>
          {/* Glória do sol: brilho radial largo atrás do horizonte, respira em 9s. */}
          <radialGradient id="gloria-v6" cx="0.74" cy="0.62" r="0.6">
            <stop offset="0%" style={{ stopColor: 'var(--color-amanhecer)', stopOpacity: '0.5' }} />
            <stop offset="55%" style={{ stopColor: 'var(--color-amanhecer)', stopOpacity: '0.16' }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-amanhecer)', stopOpacity: '0' }} />
          </radialGradient>
        </defs>

        {/* Céu. */}
        <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#ceu-v6)" />

        {/* Glória do amanhecer: único laço de luz do sistema, opacity-only. */}
        <rect
          className="ceu-respiro animate-amanhecer"
          x="0"
          y="0"
          width={VIEW_W}
          height={VIEW_H}
          fill="url(#gloria-v6)"
        />

        {/* Estrelas e janelas distantes, apagando com o dia. */}
        {LUZES.map((luz) => (
          <circle
            key={`${luz.x}-${luz.y}`}
            cx={luz.x}
            cy={luz.y}
            r={luz.r}
            className="luz-pisca animate-cintilar"
            style={{ animationDelay: luz.delay }}
            fill="var(--color-financas-texto)"
            opacity="0.5"
          />
        ))}

        {/* Nuvens à deriva (46s, transform-only). */}
        <g className="nuvem-painel animate-nuvem" style={{ animationDelay: '-9s' }}>
          <ellipse cx="250" cy="128" rx="132" ry="15" fill="var(--color-terra-500)" opacity="0.14" />
          <ellipse cx="196" cy="143" rx="78" ry="11" fill="var(--color-terra-500)" opacity="0.1" />
        </g>
        <g className="nuvem-painel animate-nuvem" style={{ animationDelay: '-31s' }}>
          <ellipse cx="940" cy="96" rx="158" ry="17" fill="var(--color-terra-500)" opacity="0.12" />
          <ellipse cx="1000" cy="110" rx="88" ry="12" fill="var(--color-terra-500)" opacity="0.09" />
        </g>

        {/* Serra distante. */}
        <path
          d="M0 520 L170 470 L352 506 L556 458 L760 501 L982 450 L1184 497 L1440 455 L1440 760 L0 760 Z"
          fill="var(--color-verde-800)"
          opacity="0.55"
        />
        {/* Serra próxima. */}
        <path
          d="M0 566 L240 512 L452 552 L690 498 L930 556 L1180 508 L1440 556 L1440 760 L0 760 Z"
          fill="var(--color-nevoa-100)"
          opacity="0.92"
        />

        {/* O sol, atrás das copas: só o topo emerso da serra. */}
        <circle cx="1042" cy="452" r="42" fill="var(--color-amanhecer)" opacity="0.55" />
        <circle cx="1042" cy="452" r="26" fill="var(--color-financas)" opacity="0.6" />

        {/* Copas de ipê em silhueta, sobre a serra próxima. */}
        <g fill="var(--color-nevoa-100)" opacity="0.95">
          <path d="M158 508 q -14 -30 2 -48 q 18 -16 30 4 q 16 -8 22 8 q -8 26 -30 36 Z M172 496 l 3 26" />
          <path d="M418 520 q -16 -34 -2 -56 q 20 -20 34 6 q 18 -10 25 10 q -8 32 -34 40 Z M436 504 l 4 30" />
          <path d="M686 512 q -12 -28 4 -46 q 16 -14 28 4 q 14 -8 22 8 q -6 24 -28 34 Z M700 500 l 3 26" />
          <path d="M904 512 q -14 -30 2 -50 q 18 -16 30 5 q 16 -8 22 10 q -8 24 -30 35 Z M918 498 l 3 28" />
          <path d="M1216 518 q -10 -26 4 -42 q 14 -12 26 4 q 12 -6 20 8 q -6 22 -26 30 Z M1228 506 l 3 24" />
        </g>

        {/* Pássaros. */}
        <Bando />

        {/* Ocupação: fileiras de plantio em perspectiva, ecoando a produção. */}
        {FILEIRAS.map((linha) => (
          <line
            key={`${linha.x0}-${linha.x1}`}
            x1={linha.x0}
            y1={linha.y0}
            x2={linha.x1}
            y2={linha.y1}
            stroke="var(--color-verde-700)"
            strokeOpacity="0.14"
            strokeWidth="2.6"
          />
        ))}

        {/* Estrada de terra: o acesso à fazenda. */}
        <path
          d="M760 760 C 790 668, 910 596, 1052 542"
          fill="none"
          stroke="var(--color-nevoa-200)"
          strokeOpacity="0.5"
          strokeWidth="13"
        />
        <path
          d="M760 760 C 790 668, 910 596, 1052 542"
          fill="none"
          stroke="var(--color-financas)"
          strokeOpacity="0.35"
          strokeWidth="1.6"
          strokeDasharray="2 30"
          strokeLinecap="round"
        />

        {/* Sede da fazenda: casa com janela acesa e silo. */}
        <g>
          {/* Silo. */}
          <rect x="1076" y="480" width="17" height="38" fill="var(--color-nevoa-100)" stroke="var(--color-nevoa-200)" strokeWidth="1.2" />
          <path d="M1072 482 L1084.5 462 L1097 482 Z" fill="var(--color-verde-800)" />
          {/* Casa. */}
          <rect x="1026" y="500" width="48" height="26" fill="var(--color-nevoa-100)" stroke="var(--color-nevoa-200)" strokeWidth="1.2" />
          <path d="M1022 502 L1050 484 L1078 502 Z" fill="var(--color-verde-800)" />
          {/* Janelas acesas: os olhos da fazenda. */}
          <rect x="1036" y="508" width="7" height="7" className="luz-pisca animate-cintilar" fill="var(--color-financas-texto)" />
          <rect x="1052" y="508" width="7" height="7" className="luz-pisca animate-cintilar" style={{ animationDelay: '-1.6s' }} fill="var(--color-financas-texto)" />
        </g>

        {/* Capim do primeiro plano: balanço na base, defasado. */}
        <Touceira x={96} y={632} s={1.15} delay="-1.2s" />
        <Touceira x={330} y={690} s={0.9} delay="-3.1s" />
        <Touceira x={640} y={606} s={1} delay="-2s" />
        <Touceira x={1232} y={666} s={1.25} delay="-0.4s" />
        <Touceira x={1360} y={600} s={0.85} delay="-2.7s" />
      </svg>
    </div>
  );
}