'use client';

import { useState } from 'react';
import { Check, Lock, MessageCircleWarning, TriangleAlert } from 'lucide-react';
import { Button, Rotulo, formatMoney } from '@/components/ui/primitives';
import type { StoredOption } from '@/lib/game-service';

/**
 * SAFRA DF · Carta de ocorrência — direção V6 "Amanhecer do Cerrado".
 *
 * A carta é um `terraco` que varia pela severidade do evento:
 * `terr-alerta` para alertas, `terr-verde` para oportunidades, `terr-neutro`
 * para o padrão. A narrativa tem prioridade visual; custo e efeitos são
 * colunas de dado discretas.
 *
 * As opções ficam abaixo da carta em `banco pisavel`, com seleção clara
 * (cor de moldura + ícone de confirmação, acessível via `aria-pressed`).
 * A confirmação é sempre em dois toques: selecionar + confirmar.
 *
 * A partir de 768px a carta e as opções migram para duas colunas (narrativa
 * 60% à esquerda, opções 40% à direita, sticky); no celular empilham.
 *
 * Zero laço infinito. `.travado` no clique de confirmação (movimento seco
 * de encaixe, 220ms, via globals.css).
 */

const REASON_LABEL: Record<string, string> = {
  insufficient_cash: 'Caixa insuficiente',
  missing_trait: 'A equipe ainda não tem o que esta opção exige',
};

function classes(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export interface EventCardData {
  title: string;
  narrative: string;
  options: StoredOption[];
  roleHint: string | null;
}

/**
 * Família de cor do painel da carta, derivada da severidade do evento.
 * Alertas de alta severidade → `terr-alerta`; oportunidades positivas →
 * `terr-verde`; neutro → `terr-neutro`.
 *
 * A severidade é decidida por heurística local baseada no título: se o
 * título contém palavras-chave de alerta, a carta puxa para ferrugem.
 */
function familiesFromEvent(title: string): { terr: string; label: string; labelText: string } {
  const lower = title.toLowerCase();
  if (lower.includes('alerta') || lower.includes('crise') || lower.includes('seca') || lower.includes('praga') || lower.includes('perda')) {
    return { terr: 'terr-alerta', label: 'OCORRÊNCIA · ALERTA', labelText: 'text-alerta-texto' };
  }
  if (lower.includes('oportunidade') || lower.includes('parceria') || lower.includes('capacitação') || lower.includes('apoio')) {
    return { terr: 'terr-verde', label: 'OCORRÊNCIA · OPORTUNIDADE', labelText: 'text-verde-300' };
  }
  return { terr: 'terr-neutro', label: 'OCORRÊNCIA', labelText: 'text-terra-500' };
}

export function EventCard({
  event,
  roundLabel,
  roleLabel,
  onConfirm,
}: {
  event: EventCardData;
  /** "Rodada X de N · Fase", renderizado dentro da carta. */
  roundLabel: string;
  roleLabel: string;
  onConfirm: (optionKey: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dispara a animação `.travado` no instante do clique, não depois da
  // resposta do servidor: feedback físico de "a trava mecânica fechou".
  const [locking, setLocking] = useState(false);

  function pick(optionKey: string, available: boolean) {
    if (!available || submitting) return;
    setError(null);
    setSelected((current) => (current === optionKey ? null : optionKey));
  }

  async function confirm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setLocking(true);
    setError(null);
    try {
      await onConfirm(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a decisão.');
      setSubmitting(false);
      setLocking(false);
    }
  }

  const severity = familiesFromEvent(event.title);

  return (
    <div className="flex flex-col gap-5 md:grid md:grid-cols-[60%_40%] md:items-start md:gap-6">
      {/* Carta da ocorrência: narrativa primeiro, efeitos depois. */}
      <div className={classes('degrau terraco animate-emergir flex flex-col gap-3 p-4', severity.terr)}>
        <div className="flex items-center gap-3">
          <Rotulo className={severity.labelText}>{severity.label}</Rotulo>
          <span className="rotulo text-terra-500">{roundLabel}</span>
        </div>

        <h2 className="relevo-md text-terra-900">{event.title}</h2>

        <p className="text-base leading-[1.6] text-terra-900">{event.narrative}</p>

        {/* Filete de separação: narrativa → opções/dica. */}
        <div aria-hidden="true" className="h-px bg-terra-500/20" />

        {event.roleHint ? (
          <div className="degrau banco terr-financas flex gap-3 p-3.5">
            <MessageCircleWarning
              size={20}
              className="mt-0.5 shrink-0 text-financas-texto"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1.5">
              <Rotulo className="text-financas-texto">Só você, {roleLabel}, sabe disto</Rotulo>
              <p className="text-sm font-medium text-terra-900">{event.roleHint}</p>
              <p className="text-xs text-terra-700">
                Os outros colegas têm outras informações. Falem em voz alta antes de decidir.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Coluna de opções: selection radio, confirmação. */}
      <div className="flex flex-col gap-3 md:sticky md:top-4">
        <span className="rotulo text-terra-500">ESCOLHA UMA OPÇÃO</span>

        {event.options.map((option) => {
          const isSelected = selected === option.key;
          const reason = option.reason ? REASON_LABEL[option.reason] ?? option.reason : null;

          return (
            <button
              key={option.key}
              type="button"
              disabled={!option.available || submitting}
              onClick={() => pick(option.key, option.available)}
              aria-pressed={isSelected}
              className={classes(
                'degrau pisavel animate-emergir flex min-h-14 w-full flex-col gap-1 p-3.5 text-left',
                isSelected ? 'mirante terr-azul' : 'banco terr-claro',
                'disabled:cursor-not-allowed disabled:opacity-45',
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  {isSelected ? (
                    <span
                      aria-hidden="true"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-azul-300 text-azul-800"
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 rounded-full border-2 border-terra-500/40"
                    />
                  )}
                  <span
                    className={classes(
                      'text-base font-semibold',
                      isSelected ? 'text-azul-300' : 'text-terra-900',
                    )}
                  >
                    {option.label}
                  </span>
                </span>
                <span
                  className={classes(
                    'dado shrink-0 text-sm font-bold',
                    isSelected ? 'text-azul-300' : 'text-terra-900',
                  )}
                >
                  {option.displayCost > 0 ? formatMoney(option.displayCost) : 'Sem custo'}
                </span>
              </span>
              <span className={isSelected ? 'text-sm text-azul-700' : 'text-sm text-terra-700'}>
                {option.detail}
              </span>
              {!option.available && reason ? (
                <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-alerta-texto">
                  <TriangleAlert size={14} aria-hidden="true" />
                  {reason}
                </span>
              ) : null}
            </button>
          );
        })}

        {selected ? (
          <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-4">
            <p className="flex items-start gap-2 text-sm text-terra-700">
              <Lock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Depois de confirmar, a equipe não pode mais mudar esta decisão nesta rodada.
            </p>

            {error ? (
              <p role="alert" className="text-sm font-semibold text-alerta-texto">
                {error}
              </p>
            ) : null}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="silencioso"
                onClick={() => setSelected(null)}
                disabled={submitting}
              >
                Trocar escolha
              </Button>
              <Button
                type="button"
                variant="destaque"
                size="grande"
                onClick={confirm}
                disabled={submitting}
                className={classes('flex-1', locking && 'travado')}
              >
                {submitting ? 'CONFIRMANDO...' : 'CONFIRMAR DECISÃO'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
