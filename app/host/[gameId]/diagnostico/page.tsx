'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Lightbulb } from 'lucide-react';
import { fetchProjection, RequestError } from '@/lib/client-api';
import { useGameChannel } from '@/hooks/use-game-channel';
import { Degrau, Rotulo, SectionHeading } from '@/components/ui/primitives';
import { DiagnosticBars } from '@/components/host/diagnostic-bars';
import { PROPERTY_BY_KEY } from '@/data/properties';
import { POLICY_DISCLAIMER } from '@/data/policies';
import { ROUND_META } from '@/types/game';
import type { HostView } from '@/lib/game-service';

/**
 * Diagnóstico da turma: a peça central da aula.
 *
 * Nada aqui classifica equipe como certa ou errada. O `mirante` único no
 * topo é a pergunta que abre o debate: o gancho mais forte já calculado por
 * `game/diagnostics.ts` (o primeiro de `teachingHooks`, porque a função os
 * empilha em ordem de força do contraste). Abaixo, cada métrica da turma é
 * um `banco` com o canal reaproveitado, e por último o histórico por equipe
 * em coluna única, nunca em grade: seis caixas iguais lado a lado é
 * exatamente a geometria que esta direção proíbe.
 *
 * V6 "Amanhecer do Cerrado": console de controle com entrada cinemática,
 * mirante como pergunta-gancho, sem paisagem competindo com a leitura.
 */
export default function DiagnosticoPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : null;

  const [view, setView] = useState<HostView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gameId) return;
    try {
      const next = await fetchProjection(gameId);
      setView(next);
      setError(null);
    } catch (err) {
      setError(
        err instanceof RequestError
          ? err.message
          : 'Não foi possível carregar o diagnóstico. Verifique a conexão.',
      );
    }
  }, [gameId]);

  // A busca inicial roda dentro de uma função assíncrona local, e não como
  // chamada direta no corpo do efeito: assim nenhum setState acontece de forma
  // sincrona durante a sincronização, e o guarda de cancelamento evita
  // atualizar uma tela que já foi desmontada.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await load();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  useGameChannel({
    gameId,
    onEvent: () => void load(),
    onTeamUpdate: () => void load(),
  });

  if (!gameId) return null;

  if (error && !view) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="text-alerta" size={32} aria-hidden />
        <p className="text-lg text-terra-700">{error}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="dado-lg text-terra-700">Carregando diagnóstico...</p>
      </main>
    );
  }

  const hasDecisions = view.diagnostics.some((entry) => entry.decisions > 0);
  const showPolicyDisclaimer = view.diagnostics.some(
    (entry) => entry.tag === 'public_policy' && entry.decisions > 0,
  );
  const openingHook = view.teachingHooks[0] ?? null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-10 px-8 py-10">
      {/* Cabeçalho do console: identidade + título. */}
      <header className="flex flex-col gap-2 animate-emergir">
        <Rotulo>SAFRA DF · Diagnóstico da turma</Rotulo>
        <h1 className="relevo-lg text-terra-900">O que a turma fez</h1>
        <div className="filete-amanhecer mt-1 w-24" />
      </header>

      {/* Pergunta-gancho: mirante em destaque, entrada com atraso. */}
      {openingHook ? (
        <div className="animate-emergir" style={{ animationDelay: '100ms' }}>
          <Degrau nivel="mirante" familia="azul" className="flex flex-col gap-3 p-6 sm:p-8">
            <Rotulo className="text-azul-300">Pergunta para abrir o debate</Rotulo>
            <h2 className="relevo-lg text-terra-900">{openingHook}</h2>
          </Degrau>
        </div>
      ) : (
        <div className="animate-emergir" style={{ animationDelay: '100ms' }}>
          <Degrau nivel="mirante" familia="claro" className="flex items-center gap-3 p-6">
            <AlertTriangle className="shrink-0 text-terra-500" size={22} aria-hidden />
            <p className="text-terra-700">
              Ainda não há decisões suficientes registradas para gerar um gancho de debate. O
              diagnóstico ganha corpo à medida que as equipes jogam as rodadas.
            </p>
          </Degrau>
        </div>
      )}

      {/* Barras de diagnóstico: contagem por comportamento agregado. */}
      {hasDecisions ? (
        <section className="flex flex-col gap-4 animate-emergir" style={{ animationDelay: '200ms' }}>
          <SectionHeading overline="O que a turma decidiu" title="Contagem por comportamento" />
          <DiagnosticBars entries={view.diagnostics} />
        </section>
      ) : null}

      {/* Ganchos adicionais: lista simples, sem cards. */}
      {view.teachingHooks.length > 1 ? (
        <section className="flex flex-col gap-4 animate-emergir" style={{ animationDelay: '300ms' }}>
          <SectionHeading overline="Mais ganchos para o debate" title="Outras perguntas prontas" />
          <ul className="flex flex-col gap-4">
            {view.teachingHooks.slice(1).map((hook, index) => (
              <li key={index} className="flex items-start gap-3 text-lg text-terra-700">
                <Lightbulb className="mt-1 shrink-0 text-terra-500" size={20} aria-hidden />
                <span>{hook}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Histórico por equipe: coluna única, nunca grade. */}
      <section className="flex flex-col gap-4 animate-emergir" style={{ animationDelay: '400ms' }}>
        <SectionHeading
          overline="Por equipe"
          title="Histórico de decisões, rodada a rodada"
        />
        <div className="flex flex-col gap-3">
          {view.teams.map((team) => {
            const property = PROPERTY_BY_KEY[team.propertyKey];
            return (
              <Degrau
                key={team.id}
                nivel="banco"
                familia="neutro"
                className="flex flex-col gap-3 p-5"
              >
                <header className="flex flex-col gap-0.5">
                  <Rotulo>{property?.region ?? 'Propriedade'}</Rotulo>
                  <h3 className="relevo-sm text-terra-900">{team.name}</h3>
                </header>

                {team.history.length === 0 ? (
                  <p className="text-sm text-terra-500">Nenhuma decisão registrada ainda.</p>
                ) : (
                  <ol className="flex flex-col gap-1">
                    {team.history.map((entry) => {
                      const phase = ROUND_META[
                        (Object.keys(ROUND_META) as (keyof typeof ROUND_META)[]).find(
                          (key) => ROUND_META[key].index === entry.roundIndex,
                        ) ?? 'preparacao'
                      ];
                      return (
                        <li
                          key={`${team.id}-${entry.roundIndex}`}
                          className="flex items-baseline justify-between gap-3 py-1"
                        >
                          <span className="text-sm text-terra-500">
                            Rodada {entry.roundIndex} · {phase.title}
                          </span>
                          <span className="text-right text-sm font-bold text-terra-900">
                            {entry.optionLabel}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Degrau>
            );
          })}
        </div>
      </section>

      {showPolicyDisclaimer ? (
        <p className="border-t-2 border-nevoa-200 pt-4 text-xs text-terra-500 animate-emergir" style={{ animationDelay: '500ms' }}>
          {POLICY_DISCLAIMER}
        </p>
      ) : null}
    </main>
  );
}
