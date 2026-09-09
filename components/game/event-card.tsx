'use client';

import { useState } from 'react';
import { Lock, MessageCircleWarning, TriangleAlert } from 'lucide-react';
import { Button, formatMoney } from '@/components/ui/primitives';
import type { StoredOption } from '@/lib/game-service';

/**
 * Matéria do evento e lista de opções.
 *
 * O evento é a matéria da página: título em manchete, narrativa em olho de
 * abertura, opções como registros separados por filete (nunca pilha de
 * cartões com borda). A confirmação é sempre em dois toques: tocar seleciona,
 * um segundo botão "Confirmar decisão" fecha. Isso evita que um toque
 * acidental trave o time numa opção antes de conversar.
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
  roleLabel,
  onConfirm,
}: {
  event: EventCardData;
  roleLabel: string;
  onConfirm: (optionKey: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(optionKey: string, available: boolean) {
    if (!available || submitting) return;
    setError(null);
    setSelected((current) => (current === optionKey ? null : optionKey));
  }

  async function confirm() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a decisão.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="filete-grosso flex flex-col gap-2 pt-3">
        <h2 className="manchete-md text-tinta-900">{event.title}</h2>
        <p className="olho">{event.narrative}</p>
      </div>

      {event.roleHint ? (
        <div className="bloco-realce flex gap-3 p-4">
          <MessageCircleWarning size={20} className="mt-0.5 shrink-0 text-manchete" aria-hidden="true" />
          <div className="flex flex-col gap-1.5">
            <span className="rotulo text-manchete">Só você, {roleLabel}, sabe disto</span>
            <p className="text-sm font-medium text-tinta-900">{event.roleHint}</p>
            <p className="text-xs text-tinta-500">
              Os outros colegas têm outras informações. Falem em voz alta antes de decidir.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col">
        {event.options.map((option, index) => {
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
                'flex min-h-11 w-full flex-col gap-1 py-3.5 text-left transition-colors duration-150',
                index === 0 ? 'filete-grosso pt-4' : 'filete-fino pt-3.5',
                'disabled:cursor-not-allowed disabled:opacity-45',
                isSelected ? 'bg-papel-200' : 'hover:bg-papel-50',
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-base font-semibold text-tinta-900">{option.label}</span>
                <span className="dado shrink-0 text-sm font-bold text-tinta-900">
                  {option.displayCost > 0 ? formatMoney(option.displayCost) : 'Sem custo'}
                </span>
              </span>
              <span className="text-sm text-tinta-500">{option.detail}</span>
              {!option.available && reason ? (
                <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-alerta">
                  <TriangleAlert size={14} aria-hidden="true" />
                  {reason}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="filete-grosso flex flex-col gap-3 pt-4">
          <p className="flex items-start gap-2 text-sm text-tinta-500">
            <Lock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Depois de confirmar, a equipe não pode mais mudar esta decisão nesta rodada.
          </p>

          {error ? (
            <p role="alert" className="text-sm font-semibold text-alerta">
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
              className="flex-1"
            >
              {submitting ? 'Confirmando...' : 'Confirmar decisão'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
