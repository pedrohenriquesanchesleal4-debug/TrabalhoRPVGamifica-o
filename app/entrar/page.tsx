'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, TriangleAlert } from 'lucide-react';
import { joinGame, RequestError } from '@/lib/client-api';
import { playerSession } from '@/lib/client-session';
import { Button, Chapeu, Field } from '@/components/ui/primitives';

/**
 * Entrada do aluno.
 *
 * Meta de sala de aula: menos de um minuto entre abrir esta tela e estar
 * jogando. Sem tutorial, sem etapa extra: código, nome, confirmar.
 */

export default function EntrarPage() {
  const router = useRouter();
  const existing = playerSession.get();

  const [showForm, setShowForm] = useState(!existing);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCodeChange(raw: string) {
    const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(normalized);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (code.length < 4) {
      setError('O código da partida tem pelo menos 4 caracteres.');
      return;
    }
    if (trimmedName.length < 2) {
      setError('Digite seu nome para entrar na equipe.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await joinGame(code, trimmedName);
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
      if (err instanceof RequestError) {
        setError(err.message);
      } else {
        setError('Não foi possível conectar. Verifique a internet e tente de novo.');
      }
      setSubmitting(false);
    }
  }

  if (!showForm && existing) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10">
        <div className="filete-grosso flex flex-col gap-2 pt-3">
          <Chapeu>Safra DF</Chapeu>
          <h1 className="manchete-md text-tinta-900">Continuar como {existing.playerName}</h1>
          <p className="text-sm text-tinta-500">
            Você já está na equipe {existing.teamName}, partida {existing.gameCode}.
          </p>
        </div>

        <div className="flex flex-col gap-3">
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
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10">
      <div className="filete-grosso flex flex-col gap-2 pt-3">
        <Chapeu>Safra DF</Chapeu>
        <h1 className="manchete-md text-tinta-900">Entrar na partida</h1>
        <p className="text-sm text-tinta-500">
          Peça o código de 4 a 8 letras que o professor está projetando na tela.
        </p>
      </div>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
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
          disabled={submitting}
        />

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
          <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-alerta">
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
    </main>
  );
}
