'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Loader2, TriangleAlert, Users } from 'lucide-react';
import { fetchLobby, joinGame, RequestError, type LobbyResponse, type LobbyTeamResponse } from '@/lib/client-api';
import { playerSession } from '@/lib/client-session';
import { Button, Field, Rotulo } from '@/components/ui/primitives';
import { PropertyScene } from '@/components/game/property-scene';
import { PROPERTY_BY_KEY } from '@/data/properties';

/**
 * Entrada do aluno, em três passos: código → propriedade e papel → nome.
 *
 * O código resolve o lobby público (`GET /api/games/lobby`), que mostra as 6
 * propriedades com vaga e papel livre. O jogador escolhe onde entrar em vez
 * de só receber o que o auto-assign sortear; se a vaga some entre a escolha e
 * a confirmação (corrida com outro colega clicando ao mesmo tempo), o servidor
 * devolve conflito e a tela mostra o lobby atualizado, sem travar quem tenta
 * de novo.
 */

type Step = 'codigo' | 'lobby' | 'nome';

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
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 md:justify-between px-5 py-8 sm:px-6 sm:py-10 md:max-w-3xl md:py-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-10">
          <div className="flex flex-col gap-5 md:w-2/5 md:shrink-0">
            <div className="degrau terraco terr-fundo-azul flex items-center gap-4 px-5 py-5">
              <div className="w-16 shrink-0">
                <PropertyScene compact propertyKey="cerrado-vivo" production={55} technology={45} sustainability={60} />
              </div>
              <div className="flex flex-col gap-1">
                <Rotulo className="text-azul-300">Safra DF</Rotulo>
                <h1 className="relevo-md text-white">Continuar como {existing.playerName}</h1>
              </div>
            </div>
            <p className="text-sm text-terra-700 md:max-w-[32ch]">
              Você já está na equipe {existing.teamName}, partida {existing.gameCode}.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-1">
            <Button
              type="button"
              variant="principal"
              size="grande"
              onClick={() => router.push('/jogar')}
            >
              Continuar como {existing.playerName}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="silencioso"
              onClick={() => {
                playerSession.clear();
                setShowForm(true);
              }}
            >
              Entrar com outro código
            </Button>
          </div>
        </div>

        <p className="text-xs text-terra-500">
          Sem senha e sem e-mail: só o código da turma e o seu nome ficam guardados neste
          aparelho.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-8 sm:px-6 sm:py-10 md:max-w-3xl md:py-16">
      <div className="flex flex-col gap-5">
        <div className="degrau terraco terr-fundo-azul flex items-center gap-4 px-5 py-5">
          <div className="w-16 shrink-0">
            <PropertyScene compact propertyKey="cerrado-vivo" production={55} technology={45} sustainability={60} />
          </div>
          <div className="flex flex-col gap-1">
            <Rotulo className="text-azul-300">Safra DF · Módulo de entrada</Rotulo>
            <h1 className="relevo-md text-white">
              {step === 'codigo'
                ? 'Entrar na partida'
                : step === 'lobby'
                  ? 'Escolha propriedade e função'
                  : 'Confirme seu nome'}
            </h1>
          </div>
        </div>

        {step === 'codigo' ? (
          <form className="flex flex-col gap-6" onSubmit={handleBuscarEquipes} noValidate>
            <p className="text-sm text-terra-700">
              Peça o código de 4 a 8 letras que o professor está projetando na tela.
            </p>
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
              disabled={loadingLobby}
            />

            {error ? (
              <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-alerta-texto">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="principal" size="grande" disabled={loadingLobby}>
              {loadingLobby ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  Buscando equipes...
                </>
              ) : (
                <>
                  Ver equipes
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        ) : null}

        {step === 'lobby' && lobby ? (
          <div className="flex flex-col gap-5">
            <button
              type="button"
              onClick={() => setStep('codigo')}
              className="flex w-fit items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-terra-500"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Trocar código
            </button>

            {error ? (
              <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-alerta-texto">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-3">
              <Rotulo>Passo 1 · Escolha a propriedade</Rotulo>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {lobby.teams.map((team) => {
                  const property = PROPERTY_BY_KEY[team.propertyKey];
                  const full = team.slotsUsed >= team.slotsMax;
                  const isSelected = selectedTeam?.id === team.id;
                  return (
                    <li key={team.id}>
                      <button
                        type="button"
                        disabled={full}
                        onClick={() => pickTeam(team)}
                        className={[
                          'degrau pisavel flex w-full flex-col gap-1.5 p-3.5 text-left',
                          isSelected ? 'mirante terr-financas' : 'banco terr-claro',
                          'disabled:cursor-not-allowed disabled:opacity-45',
                        ].join(' ')}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className={isSelected ? 'relevo-sm text-financas-texto' : 'relevo-sm text-terra-900'}>
                            {team.name}
                          </span>
                          {isSelected ? <Check size={16} className="shrink-0 text-financas-texto" aria-hidden="true" /> : null}
                        </span>
                        <span className="text-xs text-terra-700">{property?.region ?? 'Propriedade'}</span>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-terra-500">
                          <Users size={12} aria-hidden="true" />
                          {team.slotsUsed}/{team.slotsMax} vagas · {full ? 'completa' : 'com vaga'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {selectedTeam ? (
              <div className="flex flex-col gap-3">
                <Rotulo>Passo 2 · Escolha sua função</Rotulo>
                <ul className="flex flex-col gap-2">
                  {selectedTeam.roles.map((entry) => {
                    const isSelected = selectedRole === entry.role;
                    return (
                      <li key={entry.role}>
                        <button
                          type="button"
                          disabled={entry.taken}
                          onClick={() => pickRole(entry.role, entry.taken)}
                          className={[
                            'degrau pisavel banco flex w-full items-center justify-between gap-3 p-3 text-left',
                            isSelected ? 'terr-financas' : 'terr-claro',
                            'disabled:cursor-not-allowed disabled:opacity-45',
                          ].join(' ')}
                        >
                          <span className={isSelected ? 'text-sm font-bold text-financas-texto' : 'text-sm font-bold text-terra-900'}>
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
            ) : null}

            <Button
              type="button"
              variant="principal"
              size="grande"
              disabled={!selectedTeam || !selectedRole}
              onClick={() => setStep('nome')}
            >
              Continuar
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        {step === 'nome' ? (
          <form className="flex flex-col gap-6" onSubmit={handleConfirmarEntrada} noValidate>
            <button
              type="button"
              onClick={() => setStep('lobby')}
              className="flex w-fit items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-terra-500"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Trocar propriedade ou função
            </button>

            {selectedTeam ? (
              <p className="text-sm text-terra-700">
                Você entra em <span className="font-bold text-terra-900">{selectedTeam.name}</span> como{' '}
                <span className="font-bold text-terra-900">
                  {selectedTeam.roles.find((entry) => entry.role === selectedRole)?.roleLabel}
                </span>
                .
              </p>
            ) : null}

            <Field
              label="Seu nome"
              name="nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={40}
              placeholder="Como o time deve te chamar"
              disabled={submitting}
            />

            {error ? (
              <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-alerta-texto">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : null}

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
        ) : null}
      </div>

      <p className="text-xs text-terra-500">
        Sem cadastro: em menos de um minuto sua equipe já está esperando você na propriedade.
      </p>
    </main>
  );
}
