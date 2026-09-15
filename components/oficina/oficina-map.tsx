'use client';

import { useMemo, useState } from 'react';
import {
  Antenna,
  Building2,
  Check,
  Home,
  MessageCircle,
  Search,
  ShoppingBag,
  Sprout,
  Store,
  School,
  Route,
  Wrench,
  Warehouse,
} from 'lucide-react';
import {
  executarOficinaAcao,
  type OficinaPanelResponse,
} from '@/lib/client-api';
import { playerSession } from '@/lib/client-session';
import { Button, Pill, Rotulo } from '@/components/ui/primitives';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import { MAX_ACOES_UI } from '@/components/oficina/oficina-player';
import type { OficinaLocal } from '@/types/oficina';

/**
 * Mapa do território · Oficina Safra DF.
 *
 * A comunidade em um olhar: dez pontos espalhados por uma vista de cima do
 * Cerrado, desenhada em SVG puro (terra, estradas, riacho, matas, quintais).
 * Cada ponto é um botão real — clicar abre o painel do lugar com situação,
 * problema, a voz do personagem e as ações (investigar / conversar). A pista
 * já descoberta pela equipe acende o ponto em verde.
 *
 * Leve de propósito: zero imagem, zero biblioteca, zero 3D. O mapa estica
 * junto com a tela (`aspect-ratio` fixo = nenhuma distorção), e os pontos
 * são posicionados em % — funcionam de 320px a projetor.
 */

const VIEW_W = 1000;
const VIEW_H = 640;

interface Ponto {
  local: OficinaLocal;
  x: number; // em unidades do viewBox (0..VIEW_W)
  y: number;
}

const PONTOS: Omit<Ponto, 'local'>[] = [
  { x: 210, y: 140 }, // atec
  { x: 520, y: 150 }, // escola
  { x: 850, y: 130 }, // conectividade
  { x: 320, y: 300 }, // cooperativa
  { x: 540, y: 340 }, // feira
  { x: 800, y: 330 }, // mercado
  { x: 150, y: 470 }, // propriedades
  { x: 710, y: 470 }, // centro_distribuicao
  { x: 390, y: 565 }, // estrada
  { x: 600, y: 555 }, // sede
];

const ICONE_POR_LOCAL: Record<string, React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>> = {
  propriedades: Sprout,
  cooperativa: Building2,
  feira: Store,
  escola: School,
  mercado: ShoppingBag,
  estrada: Route,
  atec: Wrench,
  centro_distribuicao: Warehouse,
  conectividade: Antenna,
  sede: Home,
};

const TIPO_ROTULO: Record<OficinaLocal['tipo'], string> = {
  producao: 'Produção',
  organizacao: 'Organização',
  mercado: 'Mercado',
  servico: 'Serviço',
  infraestrutura: 'Infraestrutura',
};

/** Quintais de plantio nas áreas de produção (pequenos retângulos). */
const QUINTAIS = [
  { x: 90, y: 420, w: 34, h: 22 },
  { x: 132, y: 404, w: 30, h: 20 },
  { x: 178, y: 428, w: 34, h: 22 },
  { x: 118, y: 452, w: 30, h: 20 },
  { x: 164, y: 402, w: 28, h: 18 },
  { x: 92, y: 460, w: 30, h: 18 },
];

/** Moitas de cerrado (manchas de mata). */
const MATAS = [
  { cx: 700, cy: 90, r: 26 },
  { cx: 742, cy: 108, r: 20 },
  { cx: 920, cy: 210, r: 22 },
  { cx: 958, cy: 236, r: 16 },
  { cx: 66, cy: 120, r: 20 },
  { cx: 102, cy: 142, r: 15 },
  { cx: 880, cy: 540, r: 24 },
  { cx: 936, cy: 560, r: 18 },
];

export function OficinaMap({
  eu,
  view,
  busyKey,
  run,
}: {
  eu: OficinaPanelResponse['eu'];
  view: OficinaPanelResponse['view'];
  busyKey: string | null;
  run: (key: string, action: () => Promise<unknown>) => Promise<void>;
}) {
  const locais = OFICINA_CONTENT.locais;
  const pontos: Ponto[] = useMemo(
    () => locais.map((local, index) => ({ local, ...PONTOS[index] })),
    [locais],
  );

  const minhasPistas = view.pistas.filter((p) => p.team_id === eu.teamId);
  const descobertas = new Set(minhasPistas.map((p) => p.pista_id));
  const restantes = Math.max(0, MAX_ACOES_UI - eu.acoesUsadas);

  const [selecionado, setSelecionado] = useState<string>(() => {
    const primeiroIndescoberto = locais.find(
      (local) => local.pista_id && !descobertas.has(local.pista_id),
    );
    return primeiroIndescoberto?.id ?? locais[0]?.id ?? '';
  });

  const pontoAtivo = pontos.find((p) => p.local.id === selecionado) ?? pontos[0];
  const local = pontoAtivo?.local ?? locais[0];

  const personagem = local.personagem_id
    ? OFICINA_CONTENT.personagens.find((p) => p.id === local.personagem_id)
    : null;
  const pista = local.pista_id
    ? OFICINA_CONTENT.pistas.find((p) => p.id === local.pista_id)
    : null;
  const jaDescoberta = Boolean(local.pista_id && descobertas.has(local.pista_id));

  return (
    <div className="flex flex-col gap-3">
      <Rotulo>
        <span className="inline-flex items-center gap-1.5">
          <Route size={14} aria-hidden="true" />
          Mapa da comunidade
        </span>
      </Rotulo>

      <div className="degrau terraco terr-claro overflow-hidden">
        <div className="relative aspect-[1000/640] w-full select-none">
          {/* Cenário puro: estradas, quintais, mata, riacho — só decoração. */}
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} className="fill-terra-800 opacity-[0.06]" />

            {/* Riacho: duas margens e a lâmina d'água. */}
            <path
              d="M840 620 C 780 540, 900 470, 820 400 C 760 350, 900 300, 850 240 C 820 205, 830 170, 840 140"
              fill="none"
              stroke="var(--color-azul-600)"
              strokeOpacity="0.28"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M840 620 C 780 540, 900 470, 820 400 C 760 350, 900 300, 850 240 C 820 205, 830 170, 840 140"
              fill="none"
              stroke="var(--color-azul-300)"
              strokeOpacity="0.35"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="2 10"
            />

            {/* Estrada principal: leito + centro pontilhado. */}
            <path
              d="M70 470 C 240 520, 420 500, 640 470 C 760 452, 860 470, 950 470"
              fill="none"
              stroke="var(--color-terra-700)"
              strokeOpacity="0.38"
              strokeWidth="16"
              strokeLinecap="round"
            />
            <path
              d="M70 470 C 240 520, 420 500, 640 470 C 760 452, 860 470, 950 470"
              fill="none"
              stroke="var(--color-terra-500)"
              strokeOpacity="0.5"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray="7 9"
            />
            {/* Acesso que sobe até o núcleo. */}
            <path
              d="M420 500 C 460 430, 480 380, 520 340"
              fill="none"
              stroke="var(--color-terra-700)"
              strokeOpacity="0.32"
              strokeWidth="11"
              strokeLinecap="round"
            />
            <path
              d="M420 500 C 460 430, 480 380, 520 340"
              fill="none"
              stroke="var(--color-terra-500)"
              strokeOpacity="0.45"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeDasharray="6 8"
            />

            {/* Quintais de produção. */}
            {QUINTAIS.map((q, index) => (
              <rect
                key={index}
                x={q.x}
                y={q.y}
                width={q.w}
                height={q.h}
                rx="4"
                className="fill-verde-600"
                opacity="0.32"
              />
            ))}

            {/* Moitas de cerrado. */}
            {MATAS.map((m, index) => (
              <circle key={index} cx={m.cx} cy={m.cy} r={m.r} className="fill-verde-800" opacity="0.5" />
            ))}

            {/* Legenda discreta de escala. */}
            <g transform="translate(24, 620)">
              <line x1="0" y1="0" x2="70" y2="0" stroke="var(--color-terra-500)" strokeOpacity="0.5" strokeWidth="1.4" />
              <line x1="0" y1="-5" x2="0" y2="5" stroke="var(--color-terra-500)" strokeOpacity="0.5" strokeWidth="1.4" />
              <line x1="70" y1="-5" x2="70" y2="5" stroke="var(--color-terra-500)" strokeOpacity="0.5" strokeWidth="1.4" />
              <text
                x="12"
                y="12"
                fill="var(--color-terra-500)"
                fontSize="11"
                opacity="0.7"
              >
                ~2 km
              </text>
            </g>
          </svg>

          {/* Marcadores: botões reais sobre o cenário, posicionados em %. */}
          {pontos.map(({ local: pontoLocal, x, y }) => {
            const achei = Boolean(pontoLocal.pista_id && descobertas.has(pontoLocal.pista_id));
            const ativo = pontoLocal.id === selecionado;
            const Icone = ICONE_POR_LOCAL[pontoLocal.id] ?? Sprout;
            return (
              <button
                key={pontoLocal.id}
                type="button"
                onClick={() => setSelecionado(pontoLocal.id)}
                aria-pressed={ativo}
                aria-label={`${TIPO_ROTULO[pontoLocal.tipo]} · ${pontoLocal.nome}${achei ? ' · pista descoberta' : ''}`}
                className={[
                  'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1',
                  'focus:outline-none',
                ].join(' ')}
                style={{ left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%` }}
              >
                <span
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-[0_2px_0_rgba(0,0,0,0.35)] transition-transform duration-200',
                    ativo ? 'scale-110' : 'hover:scale-105',
                    achei
                      ? 'border-terra-900/40 bg-verde-600 text-verde-800'
                      : 'border-terra-900/30 bg-nevoa-50 text-terra-900',
                    'focus-visible:shadow-[inset_0_0_0_3px_var(--color-financas)]',
                  ].join(' ')}
                >
                  <Icone size={16} aria-hidden />
                </span>
                {achei ? (
                  <span className="flex items-center gap-0.5 rounded-full bg-verde-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-verde-800">
                    <Check size={9} aria-hidden="true" />
                  </span>
                ) : (
                  <span className="max-w-[92px] truncate rounded-full bg-nevoa-50/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-terra-500">
                    {pontoLocal.nome.split(' ')[0]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Painel do ponto selecionado. */}
      <div
        key={local.id}
        role="region"
        aria-label={`Painel de ${local.nome}`}
        className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Pill tone={jaDescoberta ? 'pronto' : 'neutro'}>{TIPO_ROTULO[local.tipo]}</Pill>
            <h3 className="relevo-md text-terra-900">{local.nome}</h3>
            <p className="text-xs leading-[1.5] text-terra-500">{local.situacao}</p>
          </div>
          <span className="shrink-0 rounded-[5px] bg-terra-800/60 px-2.5 py-1 text-xs font-bold text-terra-900">
            {restantes}/{MAX_ACOES_UI} ações
          </span>
        </div>

        <div className="filete-amanhecer" />

        <p className="text-sm leading-[1.65] text-terra-700">
          <span className="font-bold text-terra-900">O problema do lugar:</span> {local.problema}
        </p>

        {personagem ? (
          <div className="flex flex-col gap-1 rounded-[5px] bg-terra-800/50 p-3">
            <Rotulo>{personagem.nome} · {personagem.papel}</Rotulo>
            <p className="text-[13px] italic leading-[1.6] text-terra-700">“{personagem.fala}”</p>
          </div>
        ) : null}

        {jaDescoberta && pista ? (
          <div className="flex flex-col gap-1 rounded-[5px] border border-verde-700/40 bg-verde-800/30 p-3">
            <Rotulo>
              <span className="inline-flex items-center gap-1 text-verde-600">
                <Check size={13} aria-hidden="true" />
                Pista descoberta
              </span>
            </Rotulo>
            <p className="text-sm font-bold text-terra-900">{pista.titulo}</p>
            <p className="text-xs leading-[1.5] text-terra-700">{pista.texto}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="principal"
            disabled={Boolean(busyKey) || restantes === 0 || jaDescoberta}
            onClick={() =>
              void run(`investigar-${local.id}`, () =>
                executarOficinaAcao(playerSession.get()?.token ?? '', 'investigar', local.id),
              )
            }
          >
            <Search size={15} aria-hidden="true" />
            {jaDescoberta ? 'Pista na mão' : 'Investigar o lugar'}
          </Button>
          {personagem ? (
            <Button
              type="button"
              variant="secundario"
              disabled={Boolean(busyKey) || restantes === 0}
              onClick={() =>
                void run(`conversar-${personagem.id}`, () =>
                  executarOficinaAcao(playerSession.get()?.token ?? '', 'conversar', personagem.id),
                )
              }
            >
              <MessageCircle size={15} aria-hidden="true" />
              Conversar com {personagem.nome.split(' ').slice(-1)[0] ?? personagem.nome}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}