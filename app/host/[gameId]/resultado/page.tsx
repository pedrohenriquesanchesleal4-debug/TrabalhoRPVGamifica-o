'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, Landmark, Lightbulb, Sprout } from 'lucide-react';
import { fetchProjection, RequestError } from '@/lib/client-api';
import { useGameChannel } from '@/hooks/use-game-channel';
import { Button, Degrau, Rotulo, SectionHeading } from '@/components/ui/primitives';
import { RankingTable } from '@/components/host/ranking-table';
import { IndicatorComparison } from '@/components/host/indicator-comparison';
import { DiagnosticBars } from '@/components/host/diagnostic-bars';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { POLICY_DISCLAIMER } from '@/data/policies';
import type { HostView } from '@/lib/game-service';

/**
 * Resultado e debriefing, em cinco blocos navegáveis na mesma página.
 *
 * V6 "Amanhecer do Cerrado": momento de clímax com "A SAFRA TERMINOU."
 * em gradiente dourado, paisagem atmosférica e entradas cinemáticas.
 *
 * A ordem é proposital: primeiro o placar concreto (com prêmios que não são
 * só dinheiro), depois os contrastes do diagnóstico, depois a ponte para
 * política pública/tecnologia real (bloco 4), e por último uma pergunta
 * sozinha na tela, sem resposta pronta, para abrir a exposição teórica.
 */

const BLOCK_COUNT = 5;

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
        <p className="text-lg text-terra-700">{error}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="dado-lg text-terra-700">Carregando resultado...</p>
      </main>
    );
  }

  if (view.scores.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <Sprout className="text-terra-500" size={36} aria-hidden />
        <h1 className="relevo-md text-terra-900">O resultado ainda não foi calculado</h1>
        <p className="max-w-prose text-terra-700">
          Volte ao painel do professor em <code className="dado">/admin</code> e clique em
          &quot;Encerrar partida&quot; para fechar as cinco rodadas e gerar o ranking, os perfis e
          os prêmios de cada equipe.
        </p>
      </main>
    );
  }

  const propertyByTeam = Object.fromEntries(
    view.teams.map((team) => [team.id, team.propertyKey]),
  );

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-8 py-10 overflow-hidden">
      {/* Paisagem atmosférica: fundo cênico de amanhecer, baixa opacidade. */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-15">
        <CerradoLandscape />
      </div>

      {/* Overlay escuro sutil para garantir leitura do texto sobre a paisagem. */}
      <div className="pointer-events-none fixed inset-0 z-[1] bg-nevoa-50/50" />

      {/* Conteúdo acima da paisagem. */}
      <div className="relative z-[2] flex flex-col gap-8">
        <nav className="flex items-center justify-between gap-4">
          <Rotulo>
            Bloco {block + 1} de {BLOCK_COUNT}
          </Rotulo>
          <div className="flex gap-3">
            <Button
              variant="secundario"
              size="grande"
              onClick={() => setBlock((value) => Math.max(0, value - 1))}
              disabled={block === 0}
            >
              <ArrowLeft size={18} aria-hidden />
              Anterior
            </Button>
            <Button
              variant="principal"
              size="grande"
              onClick={() => setBlock((value) => Math.min(BLOCK_COUNT - 1, value + 1))}
              disabled={block === BLOCK_COUNT - 1}
            >
              Próximo
              <ArrowRight size={18} aria-hidden />
            </Button>
          </div>
        </nav>

        {/* ----------------------------------------------------------------
            BLOCO 1 · RESULTADO FINAL — Momento de clímax
            "A SAFRA TERMINOU." em gradiente dourado, RankingTable com
            campeã em mirante.
            ---------------------------------------------------------------- */}
        {block === 0 ? (
          <section className="flex flex-col gap-6 animate-emergir" aria-live="polite">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Rotulo className="text-financas-texto">Resultado final</Rotulo>
              <h1 className="titulo-amanhecer text-6xl font-bold uppercase leading-[0.9] tracking-[0.004em] sm:text-7xl lg:text-8xl">
                A SAFRA TERMINOU.
              </h1>
              <div className="filete-amanhecer mt-2 w-48" />
            </div>

            <RankingTable scores={view.scores} propertyByTeam={propertyByTeam} />
          </section>
        ) : null}

        {/* ----------------------------------------------------------------
            BLOCO 2 · CONTRASTE POR INDICADOR
            Quem se destacou em quê — eixo a eixo.
            ---------------------------------------------------------------- */}
        {block === 1 ? (
          <section className="flex flex-col gap-6 animate-emergir" aria-live="polite">
            <SectionHeading
              overline="Bloco 2"
              title="Quem se destacou em quê"
              description="O índice composto tem um peso por eixo, mas cada eixo conta a própria história: a equipe com o melhor caixa não é sempre a equipe com a melhor sustentabilidade."
            />

            <IndicatorComparison scores={view.scores} propertyByTeam={propertyByTeam} />
          </section>
        ) : null}

        {/* ----------------------------------------------------------------
            BLOCO 3 · DIAGNÓSTICO AGREGADO
            O que a turma fez, sem apontar equipe certa ou errada.
            ---------------------------------------------------------------- */}
        {block === 2 ? (
          <section className="flex flex-col gap-8 animate-emergir" aria-live="polite">
            <SectionHeading
              overline="Bloco 3"
              title="Mas o que realmente aprendemos?"
              description="O que a turma fez, agregado, sem apontar equipe certa ou errada."
            />

            <DiagnosticBars entries={view.diagnostics} />

            {view.teachingHooks.length > 0 ? (
              <div className="flex flex-col gap-3">
                <Rotulo>Ganchos para o debate</Rotulo>
                <ul className="flex flex-col gap-4">
                  {view.teachingHooks.map((hook, index) => (
                    <li key={index} className="flex items-start gap-3 text-lg text-terra-700">
                      <Lightbulb className="mt-1 shrink-0 text-terra-500" size={20} aria-hidden />
                      <span>{hook}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="border-t-2 border-nevoa-200 pt-4 text-xs text-terra-500">
              {POLICY_DISCLAIMER}
            </p>
          </section>
        ) : null}

        {/* ----------------------------------------------------------------
            BLOCO 4 · POLÍTICA PÚBLICA E TECNOLOGIA
            Ponte entre o que a turma fez e os programas reais.
            ---------------------------------------------------------------- */}
        {block === 3 ? (
          <section className="flex flex-col gap-8 animate-emergir" aria-live="polite">
            <SectionHeading
              overline="Bloco 4"
              title="Onde política pública e tecnologia entram"
              description="O que a turma fez, conectado ao programa real que existe para isso: não diz se a equipe acertou, diz o que existe de verdade."
            />

            {view.policyConnections.length === 0 ? (
              <p className="text-terra-700">
                Ainda não há decisões suficientes para conectar a um programa real. A conexão ganha
                corpo à medida que as equipes jogam as rodadas.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {view.policyConnections.map((connection) => (
                  <li key={connection.tag} className="degrau terraco terr-neutro flex flex-col gap-3 p-5">
                    <div className="flex items-start gap-3">
                      <Landmark className="mt-1 shrink-0 text-financas-texto" size={20} aria-hidden />
                      <div className="flex flex-col gap-1">
                        <Rotulo className="text-financas-texto">
                          {connection.policy.acronym} · {connection.policy.scope}
                        </Rotulo>
                        <h3 className="relevo-sm text-terra-900">{connection.policy.name}</h3>
                      </div>
                    </div>
                    <p className="text-base leading-[1.6] text-terra-900">{connection.note}</p>
                    <p className="text-sm text-terra-700">{connection.policy.description}</p>
                  </li>
                ))}
              </ul>
            )}

            <p className="border-t-2 border-nevoa-200 pt-4 text-xs text-terra-500">
              {POLICY_DISCLAIMER}
            </p>
          </section>
        ) : null}

        {/* ----------------------------------------------------------------
            BLOCO 5 · FECHAMENTO — "AGORA, PENSEM."
            Momento de transição para o debate aberto. Pergunta em mirante
            com filete dourado, sem resposta pronta.
            ---------------------------------------------------------------- */}
        {block === 4 ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-8 py-12 animate-emergir">
            <div className="flex flex-col items-center gap-4 text-center">
              <Rotulo className="text-financas-texto">Momento de reflexão</Rotulo>
              <h1 className="titulo-amanhecer text-5xl font-bold uppercase leading-[0.92] tracking-[0.004em] sm:text-6xl lg:text-7xl">
                AGORA, PENSEM.
              </h1>
              <div className="filete-amanhecer mt-1 w-32" />
            </div>

            <Degrau nivel="mirante" familia="azul" className="flex w-full max-w-3xl flex-col items-center gap-6 p-8 text-center">
              <Rotulo className="text-azul-300">Para pensar</Rotulo>
              <h2 className="relevo-lg text-terra-900">
                O principal problema da agricultura familiar é a falta de tecnologia ou a dificuldade
                de acesso e adoção dessas tecnologias?
              </h2>
            </Degrau>

            <p className="max-w-xl text-center text-sm leading-relaxed text-terra-700">
              Proponha esta pergunta à turma. Não existe resposta única: o objetivo é que cada equipe
              argumente a partir da experiência de gerenciar sua propriedade durante as cinco rodadas.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
