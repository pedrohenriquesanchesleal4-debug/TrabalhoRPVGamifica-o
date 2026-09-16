import { ApiError } from '@/lib/http';

/**
 * Rate limit em memória, janela deslizante.
 *
 * Projeto em sala de aula, uma instância: um Map por chave com timestamps é
 * limite suficiente. O objetivo não é proteger contra DDoS — é impedir que o
 * mesmo navegador/roteador crie dezenas de partidas (ou dispare chamadas de
 * IA pós-partida) por acidente ou de propósito, estourando a cota gratuita do
 * Gemini no meio da aula.
 *
 * Em deploy serverless multi-instância isso é por-instância; para o uso real
 * (Vercel Hobby + 30 alunos + 1 professor) é aceitável e documentado.
 */

const buckets = new Map<string, number[]>();

/** Limpa buckets antigos para não crescer sem limite durante a sessão. */
function sweep(now: number): void {
  if (buckets.size > 500) {
    const stale: string[] = [];
    for (const [key, times] of buckets) {
      // Se o bucket inteiro está velho, remove a entrada inteira.
      if (times.length === 0 || times[times.length - 1]! < now - 60_000) {
        stale.push(key);
      }
    }
    for (const key of stale) buckets.delete(key);
  }
}

/**
 * Garante que `key` não exceda `max` chamadas em `windowMs`.
 * Lança ApiError('conflict', ...) quando o limite estoura.
 */
export function rateLimit(key: string, max: number, windowMs: number, label: string): void {
  const now = Date.now();
  sweep(now);

  const times = buckets.get(key) ?? [];
  const fresh = times.filter((t) => now - t < windowMs);

  if (fresh.length >= max) {
    throw new ApiError('conflict', `Muitas tentativas agora. ${label}`);
  }

  fresh.push(now);
  buckets.set(key, fresh);
}

/** IP do cliente, com fallback para requisições sem o header. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  const real = request.headers.get('x-real-ip');
  return real?.trim() || 'unknown';
}