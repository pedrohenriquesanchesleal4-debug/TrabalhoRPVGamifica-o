'use client';

import { useState } from 'react';
import { Lock, MessageCircleWarning, TriangleAlert } from 'lucide-react';
import { Button, formatMoney } from '@/components/ui/primitives';
import type { StoredOption } from '@/lib/game-service';

/**
 * Carta de evento e lista de opções.
 *
 * A confirmação é sempre em dois toques: tocar seleciona, um segundo botão
 * "Confirmar decisão" fecha. Isso evita que um toque acidental trave o time
 * numa opção antes de conversar.
 */

const REASON_LABEL: Record<string, string> = {
  insufficient_cash: 'Caixa insuficiente',
  missing_trait: 'A equipe ainda não tem o que esta opção exige',
};

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
    <div className="carta flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl text-mata-900 sm:text-2xl">{event.title}</h2>
        <p className="text-sm leading-relaxed text-mata-700 sm:text-base">{event.narrative}</p>
      </div>

      {event.roleHint ? (
        <div className="flex gap-2.5 rounded-carta border border-terra-400/50 bg-terra-500/10 p-3">
          <MessageCircleWarning
            size={18}
            className="mt-0.5 shrink-0 text-terra-600"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <span className="rotulo text-terra-600">Só você, {roleLabel}, sabe disto</span>
            <p className="text-sm text-mata-800">{event.roleHint}</p>
            <p className="text-xs text-mata-600">
              Os outros colegas têm outras informações. Falem em voz alta antes de decidir.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
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
              className={[
                'flex w-full flex-col gap-1 rounded-carta border p-4 text-left transition-colors duration-150',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isSelected
                  ? 'border-terra-500 bg-terra-500/10'
                  : 'border-areia-300 bg-areia-50 hover:border-mata-400',
              ].join(' ')}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-base font-medium text-mata-900">{option.label}</span>
                <span className="tabular shrink-0 text-sm font-semibold text-mata-800">
                  {option.displayCost > 0 ? formatMoney(option.displayCost) : 'Sem custo'}
                </span>
              </span>
              <span className="text-sm text-mata-600">{option.detail}</span>
              {!option.available && reason ? (
                <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-alerta">
                  <TriangleAlert size={14} aria-hidden="true" />
                  {reason}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="flex flex-col gap-3 border-t border-areia-200 pt-4">
          <p className="flex items-start gap-2 text-sm text-mata-700">
            <Lock size={16} className="mt-0.5 shrink-0 text-mata-500" aria-hidden="true" />
            Depois de confirmar, a equipe não pode mais mudar esta decisão nesta rodada.
          </p>

          {error ? (
            <p role="alert" className="text-sm text-alerta">
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
