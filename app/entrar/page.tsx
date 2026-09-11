'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Loader2, TriangleAlert, Users } from 'lucide-react';
import { fetchLobby, joinGame, RequestError, type LobbyResponse, type LobbyTeamResponse } from '@/lib/client-api';
import { playerSession } from '@/lib/client-session';
import { Button, Field, Rotulo } from '@/components/ui/primitives';
import { GAUGE_INK, GAUGE_TERRACO, INDICATOR_KEY_TO_KIND, type IndicatorKind } from '@/components/ui/gauges';
import { PropertyScene } from '@/components/game/property-scene';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { PROPERTY_BY_KEY } from '@/data/properties';
import { ROLE_MISSION, type Role } from '@/types/game';

/**
 * Entrada do aluno, em três passos: código → propriedade e papel → nome.
 * Redesign V6 "Amanhecer do Cerrado": o fluxo inteiro acontece diante da
 * paisagem de 06:20 (06:20), com os degraus de terra-noite por cima.
 *
 * A LÓGICA é a mesma de sempre: o código resolve o lobby público
 * (`GET /api/games/lobby`), que mostra as 6 propriedades com vaga e papel
 * livre. O jogador escolhe onde entrar em vez de só receber o que o
 * auto-assign sortear; se a vaga some entre a escolha e a confirmação (corrida
 * com outro colega clicando ao mesmo tempo), o servidor devolve conflito e a
 * tela mostra o lobby atualizado, sem travar quem tenta de novo. Cada handler,
 * cada fetch e cada rota foram preservados; só a apresentação mudou.
 *
 * Observação de estado: este fluxo não tem tela de espera por host — depois de
 * confirmar o nome, `joinGame` grava a sessão e `router.push('/jogar')` entrega
 * a partida ao destino, que cuida da própria abertura.
 */

type Step = 'codigo' | 'lobby' | 'nome';

/** Tom de identidade da propriedade: a cor do indicador de destaque dela. */
function highlightTone(propertyKey: string): { kind: IndicatorKind; terr: string; ink: string } | null {
  const property = PROPERTY_BY_KEY[propertyKey];
  if (!property) return null;
  const kind = INDICATOR_KEY_TO_KIND[property.highlight.indicator];
  return { kind, terr: GAUGE_TERRACO[kind], ink: GAUGE_INK[kind] };
}

/** Fundo: a paisagem fica, o texto lê — escurece a base e o lado do conteúdo. */
const CENARIO_OVERLAY = [
  'linear-gradient(to top, var(--cor-cena-topo) 20%, color-mix(in srgb, var(--cor-cena-topo) 55%, transparent) 44%, transparent 66%)',
  'radial-gradient(90% 64% at 12% 98%, var(--cor-cena-topo) 8%, transparent 60%)',
].join(', ');

export default function EntrarPage() {
  const router = useRouter();
  const existing = playerSession.get();

  const [showForm, setShowForm] = useState(!existing);
  const [step, setStep] = useState<Step>('codigo');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [lobby, setLobby] = useState<LobbyResponse | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<LobbyTeamResponse | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loadingLobby, setLoadingLobby] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCodeChange(raw: string) {
    const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(normalized);
  }

  async function handleBuscarEquipes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (code.length < 4) {
      setError('O código da partida tem pelo menos 4 caracteres.');
      return;
    }

    setLoadingLobby(true);
    try {
      const response = await fetchLobby(code);
      setLobby(response);
      setStep('lobby');
    } catch (err) {
      setError(
        err instanceof RequestError
          ? err.message
          : 'Não foi possível conectar. Verifique a internet e tente de novo.',
      );
    } finally {
      setLoadingLobby(false);
    }
  }

  async function refreshLobby() {
    try {
      const response = await fetchLobby(code);
      setLobby(response);
      const stillThere = response.teams.find((team) => team.id === selectedTeam?.id);
      setSelectedTeam(stillThere ?? null);
      setSelectedRole(null);
    } catch {
      // Falha silenciosa: a mensagem de erro do próprio submit já cobre o caso.
    }
  }

  function pickTeam(team: LobbyTeamResponse) {
    if (team.slotsUsed >= team.slotsMax) return;
    setError(null);
    setSelectedTeam(team);
    setSelectedRole(null);
  }

  function pickRole(role: string, taken: boolean) {
    if (taken) return;
    setSelectedRole(role);
  }

  async function handleConfirmarEntrada(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Digite seu nome para entrar na equipe.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await joinGame(code, trimmedName, {
        teamId: selectedTeam?.id,
        role: selectedRole ?? undefined,
      });
      playerSession.set({
        token: response.playerToken,
        gameId: response.gameId,
        gameCode: response.gameCode,
        playerName: response.player.name,
        teamName: response.team.name,
        role: response.role,
      });
      router.push('/jogar');
    } catch (err) {
      if (err instanceof RequestError && err.status === 409) {
        // Vaga ou papel some entre a escolha e a confirmação: mostra a lista
        // atualizada em vez de travar o jogador numa escolha que não existe mais.
        setError(`${err.message} A lista foi atualizada: escolha outra vaga.`);
        setStep('lobby');
        await refreshLobby();
      } else {
        setError(
          err instanceof RequestError
            ? err.message
            : 'Não foi possível conectar. Verifique a internet e tente de novo.',
        );
      }
      setSubmitting(false);
    }
  }

  if (!showForm && existing) {
    return (
      <main className="relative min-h-dvh overflow-hidden">
        <CerradoLandscape className="opacity-75" />
        <div aria-hidden="true" className="absolute inset-0" style={{ background: CENARIO_OVERLAY }} />

        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col justify-end gap-7 px-5 py-8 sm:px-6 md:max-w-3xl md:justify-center md:py-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:gap-8">
            <div className="flex flex-col gap-3 md:w-2/5 md:shrink-0">
              <div className="degrau terraco terr-fundo-azul flex items-center gap-4 px-5 py-5 animate-emergir">
                <div className="w-16 shrink-0">
                  <PropertyScene compact propertyKey="cerrado-vivo" production={55} technology={45} sustainability={60} />
                </div>
                <div className="flex flex-col gap-1">
                  <Rotulo className="text-(--cor-tinta-panel-azul)">Safra DF</Rotulo>
                  <h1 className="relevo-md text-white">Continuar como {existing.playerName}</h1>
                </div>
              </div>
              <p className="sobre-cena-suave text-sm md:max-w-[32ch]">
                Você já está na equipe {existing.teamName}, partida {existing.gameCode}.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-1">
              <Button
                type="button"
                variant="destaque"
                size="grande"
                onClick={() => router.push('/jogar')}
              >
                Continuar como {existing.playerName}
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="secundario"
                onClick={() => {
                  playerSession.clear();
                  setShowForm(true);
                }}
              >
                Entrar com outro código
              </Button>
            </div>
          </div>

          <p className="sobre-cena-suave text-xs">
            Sem senha e sem e-mail: só o código da turma e o seu nome ficam guardados neste
            aparelho.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <CerradoLandscape className="opacity-75" />
      <div aria-hidden="true" className="absolute inset-0" style={{ background: CENARIO_OVERLAY }} />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col justify-end gap-7 px-5 py-8 sm:px-6 md:max-w-3xl md:justify-center md:py-12">
        <div className="flex items-center gap-3">
          <span className="w-8 shrink-0 motion-safe:animate-emergir">
            <PropertyScene compact propertyKey="cerrado-vivo" production={55} technology={45} sustainability={60} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 motion-safe:animate-emergir" style={{ animationDelay: '80ms' }}>
            <Rotulo className="text-(--cor-tinta-panel-dourado)">Safra DF · Entrada do aluno</Rotulo>
            <div className="filete-amanhecer w-full" />
          </div>
        </div>

        {step === 'codigo' ? (
          <form
            key="passo-codigo"
            className="degrau terraco terr-claro animate-emergir flex flex-col gap-5 p-5"
            onSubmit={handleBuscarEquipes}
            noValidate
          >
            <header className="flex flex-col gap-1.5">
              <Rotulo>Etapa 01 · Acesso</Rotulo>
              <h1 className="relevo-lg text-terra-900">Digite o código da partida</h1>
              <p className="max-w-[46ch] text-sm text-terra-700">
                Peça o código de 4 a 8 letras que o professor está projetando na tela.
              </p>
            </header>

            <div className="filete-amanhecer" />

            <Field
              label="Código da partida"
              name="codigo"
              value={code}
              onChange={(event) => handleCodeChange(event.target.value)}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={8}
              placeholder="EX: SAFRA1"
              codigo
              hint="Só letras e números, sem espaço."
              error={error}
              disabled={loadingLobby}
            />

            <Button type="submit" variant="destaque" size="grande" disabled={loadingLobby}>
              {loadingLobby ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  Buscando equipes...
                </>
              ) : (
                <>
                  Entrar na fazenda
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        ) : null}

        {step === 'lobby' && lobby ? (
          <div key="passo-lobby" className="animate-emergir flex flex-col gap-4">
            <Button
              type="button"
              variant="secundario"
              onClick={() => setStep('codigo')}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Trocar código
            </Button>

            <header className="flex flex-col gap-1.5 px-1">
              <Rotulo>Etapa 02 · Propriedade e função</Rotulo>
              <h1 className="relevo-lg text-terra-900">Qual propriedade sua equipe vai tocar?</h1>
            </header>

            {error ? (
              <p role="alert" className="flex items-start gap-2 rounded-[5px] bg-nevoa-100 px-4 py-3 text-sm font-semibold text-alerta-texto">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : null}

            <ul
              role="radiogroup"
              aria-label="Propriedades com vaga"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {lobby.teams.map((team) => {
                const property = PROPERTY_BY_KEY[team.propertyKey];
                const tone = highlightTone(team.propertyKey);
                const full = team.slotsUsed >= team.slotsMax;
                const isSelected = selectedTeam?.id === team.id;
                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={full}
                      onClick={() => pickTeam(team)}
                      className={[
                        'degrau pisavel flex w-full items-center gap-3 p-3 text-left',
                        isSelected
                          ? `mirante ${tone?.terr ?? 'terr-financas'} scale-[1.02]`
                          : 'banco terr-claro',
                        'disabled:cursor-not-allowed disabled:opacity-45',
                      ].join(' ')}
                    >
                      <span className="w-10 shrink-0">
                        <PropertyScene compact propertyKey={team.propertyKey} production={50} technology={50} sustainability={50} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={isSelected ? `relevo-sm ${tone?.ink ?? 'text-financas-texto'}` : 'relevo-sm text-terra-900'}>
                          {team.name}
                        </span>
                        <span className="text-xs text-terra-700">{property?.region ?? 'Propriedade'}</span>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-terra-500">
                          <Users size={12} aria-hidden="true" />
                          {team.slotsUsed}/{team.slotsMax} vagas · {full ? 'completa' : 'com vaga'}
                        </span>
                      </span>
                      {isSelected ? (
                        <Check size={16} className={`shrink-0 ${tone?.ink ?? 'text-financas-texto'}`} aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            {selectedTeam ? (
              <section className="degrau terraco terr-claro animate-emergir flex flex-col gap-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="w-14 shrink-0">
                    <PropertyScene compact propertyKey={selectedTeam.propertyKey} production={50} technology={50} sustainability={50} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Rotulo>{PROPERTY_BY_KEY[selectedTeam.propertyKey]?.region ?? 'Propriedade'}</Rotulo>
                    <h2 className="relevo-lg text-terra-900">{selectedTeam.name}</h2>
                    {PROPERTY_BY_KEY[selectedTeam.propertyKey] ? (
                      <p className="text-xs text-terra-700">{PROPERTY_BY_KEY[selectedTeam.propertyKey]?.tagline}</p>
                    ) : null}
                  </div>
                </div>

                <div className="filete-amanhecer" />

                <div className="flex flex-col gap-2">
                  <Rotulo>Escolha sua função</Rotulo>
                  <ul role="radiogroup" aria-label="Função na propriedade" className="flex flex-col gap-2">
                    {selectedTeam.roles.map((entry) => {
                      const isSelected = selectedRole === entry.role;
                      const tone = highlightTone(selectedTeam.propertyKey);
                      return (
                        <li key={entry.role}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            disabled={entry.taken}
                            onClick={() => pickRole(entry.role, entry.taken)}
                            className={[
                              'degrau banco pisavel flex w-full items-center justify-between gap-3 p-3 text-left',
                              isSelected ? tone?.terr ?? 'terr-financas' : 'terr-claro',
                              'disabled:cursor-not-allowed disabled:opacity-45',
                            ].join(' ')}
                          >
                            <span
                              className={
                                isSelected
                                  ? `text-sm font-bold ${tone?.ink ?? 'text-financas-texto'}`
                                  : 'text-sm font-bold text-terra-900'
                              }
                            >
                              {entry.roleLabel}
                            </span>
                            <span className="text-xs text-terra-500">
                              {entry.taken ? `Ocupado por ${entry.playerName ?? 'colega'}` : 'Livre'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            ) : null}

            <Button
              type="button"
              variant="destaque"
              size="grande"
              disabled={!selectedTeam || !selectedRole}
              onClick={() => setStep('nome')}
            >
              Entrar na propriedade
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        {step === 'nome' ? (
          <div key="passo-nome" className="animate-emergir flex flex-col gap-4">
            <Button
              type="button"
              variant="secundario"
              onClick={() => setStep('lobby')}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Trocar propriedade ou função
            </Button>

            {selectedTeam ? (
              <section className="degrau terraco terr-claro flex flex-col gap-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="w-12 shrink-0">
                    <PropertyScene compact propertyKey={selectedTeam.propertyKey} production={50} technology={50} sustainability={50} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Rotulo>{PROPERTY_BY_KEY[selectedTeam.propertyKey]?.region ?? 'Propriedade'}</Rotulo>
                    <p className="relevo-md text-terra-900">{selectedTeam.name}</p>
                  </div>
                </div>
                <p className="text-sm text-terra-700">
                  Você entra como{' '}
                  <span className="font-bold text-terra-900">
                    {selectedTeam.roles.find((entry) => entry.role === selectedRole)?.roleLabel}
                  </span>
                  {ROLE_MISSION[selectedRole as Role] ? (
                    <>
                      . {ROLE_MISSION[selectedRole as Role]}
                    </>
                  ) : (
                    '.'
                  )}
                </p>
              </section>
            ) : null}

            <form
              className="degrau terraco terr-claro flex flex-col gap-5 p-5"
              onSubmit={handleConfirmarEntrada}
              noValidate
            >
              <header className="flex flex-col gap-1.5">
                <Rotulo>Etapa 03 · Identidade</Rotulo>
                <h1 className="relevo-lg text-terra-900">Como o time vai te chamar?</h1>
              </header>

              <div className="filete-amanhecer" />

              <Field
                label="Seu nome"
                name="nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={40}
                placeholder="Como o time deve te chamar"
                error={error}
                disabled={submitting}
              />

              <Button type="submit" variant="principal" size="grande" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight size={18} aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>
          </div>
        ) : null}

        <p className="rotulo">Jogo pedagógico · uso em sala</p>
      </div>
    </main>
  );
}