'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, Lightbulb, Sprout } from 'lucide-react';
import { fetchProjection, RequestError } from '@/lib/client-api';
import { useGameChannel } from '@/hooks/use-game-channel';
import { Button, SectionHeading } from '@/components/ui/primitives';
import { RankingTable } from '@/components/host/ranking-table';
import { DiagnosticBars } from '@/components/host/diagnostic-bars';
import { POLICY_DISCLAIMER } from '@/data/policies';
import type { HostView } from '@/lib/game-service';

/**
 * Resultado e debriefing, em três blocos navegáveis na mesma página.
 *
 * A ordem é proposital: primeiro o placar concreto (com prêmios que não são
 * só dinheiro), depois os contrastes do diagnóstico, e por último uma
 * pergunta sozinha na tela, sem resposta pronta, para abrir a exposição
 * teórica.
 */

const BLOCK_COUNT = 3;

export default function ResultadoPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : null;

  const [view, setView] = useState<HostView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [block, setBlock] = useState(0);

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
          : 'Não foi possível carregar o resultado. Verifique a conexão.',
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
        <p className="text-lg text-mata-700">{error}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-xl text-mata-600">Carregando resultado...</p>
      </main>
    );
  }

  if (view.scores.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <Sprout className="text-mata-500" size={36} aria-hidden />
        <h1 className="text-3xl text-mata-900">O resultado ainda não foi calculado</h1>
        <p className="max-w-prose text-mata-600">
          Volte ao painel do professor em <code className="tabular">/admin</code> e clique em
          “Encerrar partida” para fechar as cinco rodadas e gerar o ranking, os perfis e os
          prêmios de cada equipe.
        </p>
      </main>
    );
  }

  const propertyByTeam = Object.fromEntries(
    view.teams.map((team) => [team.id, team.propertyKey]),
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-8 py-10">
      <nav className="flex items-center justify-between gap-4">
        <span className="rotulo">
          Bloco {block + 1} de {BLOCK_COUNT}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secundario"
            onClick={() => setBlock((value) => Math.max(0, value - 1))}
            disabled={block === 0}
          >
            <ArrowLeft size={16} aria-hidden />
            Anterior
          </Button>
          <Button
            variant="principal"
            onClick={() => setBlock((value) => Math.min(BLOCK_COUNT - 1, value + 1))}
            disabled={block === BLOCK_COUNT - 1}
          >
            Próximo
            <ArrowRight size={16} aria-hidden />
          </Button>
        </div>
      </nav>

      {block === 0 ? (
        <section className="flex flex-col gap-6" aria-live="polite">
          <SectionHeading
            overline="Bloco 1"
            title="A safra terminou"
            description="Dinheiro é um dos quatro indicadores, não o único jeito de se destacar: os prêmios abaixo reconhecem estratégias diferentes."
          />
          <RankingTable scores={view.scores} propertyByTeam={propertyByTeam} />
        </section>
      ) : null}

      {block === 1 ? (
        <section className="flex flex-col gap-8" aria-live="polite">
          <SectionHeading
            overline="Bloco 2"
            title="Mas o que realmente aprendemos?"
            description="O que a turma fez, agregado, sem apontar equipe certa ou errada."
          />

          <div className="carta p-6">
            <DiagnosticBars entries={view.diagnostics} />
          </div>

          {view.teachingHooks.length > 0 ? (
            <div className="flex flex-col gap-3">
              <span className="rotulo">Ganchos para o debate</span>
              <ul className="flex flex-col gap-3">
                {view.teachingHooks.map((hook, index) => (
                  <li
                    key={index}
                    className="carta flex items-start gap-3 border-l-4 border-l-terra-500 p-5 text-lg text-mata-800"
                  >
                    <Lightbulb className="mt-1 shrink-0 text-terra-500" size={20} aria-hidden />
                    <span>{hook}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="border-t border-areia-200 pt-4 text-xs text-mata-500">
            {POLICY_DISCLAIMER}
          </p>
        </section>
      ) : null}

      {block === 2 ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-8 py-16 text-center">
          <span className="rotulo">Para pensar</span>
          <h1 className="max-w-4xl text-balance text-4xl leading-tight text-mata-900 sm:text-5xl">
            O principal problema da agricultura familiar é a falta de tecnologia ou a dificuldade
            de acesso e adoção dessas tecnologias?
          </h1>
        </section>
      ) : null}
    </main>
  );
}
