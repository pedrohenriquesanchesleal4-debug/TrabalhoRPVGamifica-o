'use client';

import { useState } from 'react';
import { Lock, MessageCircleWarning, TriangleAlert } from 'lucide-react';
import { Button, Rotulo, formatMoney } from '@/components/ui/primitives';
import type { StoredOption } from '@/lib/game-service';

/**
 * Matéria do evento e lista de opções.
 *
 * A carta é um `terraco` neutro: rótulo da rodada, manchete e narrativa. A
 * dica exclusiva de função vira um `banco` aninhado tingido em `financas`,
 * porque é informação assimétrica, não erro.
 *
 * As opções NÃO ficam dentro da carta: cada uma é o próprio `banco` tocável,
 * em sequência vertical. Ao tocar, a opção vira a decisão ativa e sobe para
 * `mirante`, o único degrau de altitude 3 desta tela: é o que dá à decisão
 * pendente o peso visual que ela tem de fato, sem empatar com o resto da
 * lista. A confirmação é sempre em dois toques: tocar seleciona, um segundo
 * botão "Confirmar decisão" fecha, o que evita que um toque acidental trave o
 * time numa opção antes de conversar.
 *
 * A partir de 768px a carta e a lista de opções migram para duas colunas
 * (narrativa 60% à esquerda, opções 40% à direita, coluna de opções fixa por
 * `position: sticky`); no celular seguem empilhadas.
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
  // Dispara a animação `.travado` (movimento seco de encaixe, ver
  // `@keyframes trava` em globals.css) no instante do clique, não depois da
  // resposta do servidor: é o feedback físico de "a trava mecânica fechou",
  // e ele precisa acontecer no toque, não esperar o round-trip de rede.
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

  return (
    <div className="flex flex-col gap-5 md:grid md:grid-cols-[60%_40%] md:items-start md:gap-6">
      <div className="degrau terraco terr-neutro animate-emergir flex flex-col gap-3 p-4">
        <Rotulo>{roundLabel}</Rotulo>
        <h2 className="relevo-md text-terra-900">{event.title}</h2>
        <p className="text-base leading-[1.6] text-terra-900">{event.narrative}</p>

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

      <div className="flex flex-col gap-3 md:sticky md:top-4">
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
                <span
                  className={classes(
                    'text-base font-semibold',
                    // `terr-azul` é uma mistura clara-mas-ainda-escura (30% de
                    // acento sobre painel escuro): texto precisa do tom CLARO
                    // (`azul-300`, "destaque sobre parede escura"), não do
                    // `azul-800` (quase tão escuro quanto o próprio painel,
                    // que era o bug de contraste real da V4).
                    isSelected ? 'text-azul-300' : 'text-terra-900',
                  )}
                >
                  {option.label}
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
                variant="principal"
                size="grande"
                onClick={confirm}
                disabled={submitting}
                className={classes('flex-1', locking && 'travado')}
              >
                {submitting ? 'Confirmando...' : 'Confirmar decisão'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
