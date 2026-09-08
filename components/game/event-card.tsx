'use client';

import { useState } from 'react';
import { Button, Carimbo, formatMoney } from '@/components/ui/primitives';
import type { StoredOption } from '@/lib/game-service';

/**
 * A ocorrência do dia, escrita na ficha.
 *
 * A confirmação é sempre em dois toques: tocar marca a opção com um "X" a
 * lápis, e só um segundo botão fecha. Isso evita que um toque acidental trave
 * o time numa opção antes de a equipe conversar, que é o ponto do jogo.
 *
 * Ao confirmar, o carimbo bate na ficha. Não é enfeite: é a regra "a decisão
 * não pode ser trocada" virando gesto, para o aluno sentir o peso antes de a
 * consequência aparecer.
 */

const REASON_LABEL: Record<string, string> = {
  insufficient_cash: 'Caixa insuficiente',
  missing_trait: 'A equipe ainda não tem o que esta opção exige',
};

/** Letra da opção no papel: A, B, C, D, E. */
function letra(index: number): string {
  return String.fromCharCode(65 + index);
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
    <article className="ficha ficha-margem flex flex-col gap-5 py-5 pr-5">
      <header className="flex flex-col gap-2">
        <span className="rotulo text-carimbo-600">Ocorrência</span>
        <h2 className="text-xl leading-snug text-tinta-900 sm:text-2xl">{event.title}</h2>
        <p className="font-caderno text-sm leading-relaxed text-tinta-700 sm:text-base">
          {event.narrative}
        </p>
      </header>

      {event.roleHint ? (
        /*
          A dica de função é o que obriga a equipe a falar em voz alta: cada
          jogador vê uma linha que os outros quatro não veem. Ela é marcada
          como recado à parte, colado na ficha, não como mais um parágrafo.
        */
        <aside className="border border-dashed border-carimbo-500/60 bg-carimbo-500/5 p-3">
          <span className="rotulo text-carimbo-600">
            Só você, {roleLabel}, sabe disto
          </span>
          <p className="mt-1.5 font-caderno text-sm text-tinta-900">{event.roleHint}</p>
          <p className="mt-1.5 text-xs text-tinta-500">
            Os outros colegas receberam outras informações. Falem em voz alta antes de decidir.
          </p>
        </aside>
      ) : null}

      <div className="flex flex-col">
        <span className="rotulo mb-2">Opções lançadas</span>

        <ul className="flex flex-col">
          {event.options.map((option, index) => {
            const isSelected = selected === option.key;
            const reason = option.reason ? REASON_LABEL[option.reason] ?? option.reason : null;

            return (
              <li key={option.key} className="border-t border-dashed border-papel-300 first:border-t-0">
                <button
                  type="button"
                  disabled={!option.available || submitting}
                  onClick={() => pick(option.key, option.available)}
                  aria-pressed={isSelected}
                  className={[
                    'flex w-full items-start gap-3 py-3 text-left transition-colors duration-150',
                    'disabled:cursor-not-allowed disabled:opacity-45',
                    isSelected ? 'bg-carimbo-500/8' : 'hover:bg-papel-100',
                  ].join(' ')}
                >
                  {/*
                    A caixinha de marcar da ficha em papel. Marcada, recebe um
                    "X" a caneta: estado que se lê pela forma, não pela cor.
                  */}
                  <span
                    className={[
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border font-maquina text-sm font-bold',
                      isSelected
                        ? 'border-carimbo-500 bg-carimbo-500 text-papel-000'
                        : 'border-tinta-900/40 text-tinta-700',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {isSelected ? '×' : letra(index)}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline gap-2">
                      <span className="font-maquina text-base font-bold text-tinta-900">
                        {option.label}
                      </span>
                      <span className="pontilhado" aria-hidden="true" />
                      <span className="tabular shrink-0 text-sm font-bold text-tinta-900">
                        {option.displayCost > 0 ? `-${formatMoney(option.displayCost)}` : 'Sem custo'}
                      </span>
                    </span>

                    <span className="font-caderno text-sm text-tinta-500">{option.detail}</span>

                    {!option.available && reason ? (
                      <span className="mt-1 font-maquina text-xs font-bold uppercase tracking-wider text-carimbo-600">
                        Indisponível: {reason}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selected ? (
        <footer className="flex flex-col gap-3 border-t border-tinta-900/20 pt-4">
          <p className="font-maquina text-xs uppercase leading-relaxed tracking-wider text-tinta-500">
            Depois de carimbar, a equipe não pode mais trocar esta decisão nesta rodada.
          </p>

          {error ? (
            <p role="alert" className="font-maquina text-sm text-carimbo-600">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="silencioso"
              onClick={() => setSelected(null)}
              disabled={submitting}
            >
              Apagar
            </Button>
            <Button
              type="button"
              variant="principal"
              size="grande"
              onClick={confirm}
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? 'Carimbando...' : 'Carimbar decisão'}
            </Button>
          </div>
        </footer>
      ) : null}
    </article>
  );
}

/**
 * A ficha depois de carimbada.
 *
 * Vive fora de `EventCard` porque o estado "decidido" vem do servidor, não da
 * seleção local: quando a tela recarrega, o carimbo continua lá.
 */
export function DecisionStamp({
  optionLabel,
  round,
}: {
  optionLabel: string;
  round: number;
}) {
  return (
    <article className="ficha ficha-margem flex flex-col gap-4 py-5 pr-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="rotulo">Lançado no caderno</span>
          <p className="font-maquina text-lg font-bold leading-snug text-tinta-900">
            {optionLabel}
          </p>
        </div>

        <Carimbo detail={`Rodada ${round}`} bate>
          Decidido
        </Carimbo>
      </div>

      <p className="font-caderno text-sm text-tinta-500">
        A equipe já decidiu e não é possível mudar nesta rodada. Enquanto o tempo corre, vejam
        o que os colegas ainda estão fazendo.
      </p>
    </article>
  );
}
