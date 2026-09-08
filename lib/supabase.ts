import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requirePublicEnv, requireServerEnv } from './env';

/**
 * Dois clientes, dois níveis de poder.
 *
 * `adminClient` usa a service_role key: ignora RLS e é o ÚNICO caminho de
 * escrita do sistema. Vive só em route handlers.
 *
 * `browserClient` usa a anon key: só consegue ler as tabelas públicas e assinar
 * realtime. Mesmo que alguém extraia essa chave do bundle (e ela é pública por
 * natureza), não há nada que ela permita escrever.
 */

let admin: SupabaseClient | null = null;

/** Cliente de servidor com service_role. Nunca exponha ao cliente. */
export function adminClient(): SupabaseClient {
  if (admin) return admin;

  const { supabaseUrl, serviceRoleKey } = requireServerEnv();

  admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'safra-df-server' } },
  });

  return admin;
}

let browser: SupabaseClient | null = null;

/** Cliente de navegador: leitura pública e realtime. */
export function browserClient(): SupabaseClient {
  if (browser) return browser;

  const { supabaseUrl, supabaseAnonKey } = requirePublicEnv();

  browser = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      // 10 eventos por segundo por conexão é folgado para 5 rodadas e evita
      // estourar a cota de mensagens do plano gratuito com turma cheia.
      params: { eventsPerSecond: 10 },
    },
  });

  return browser;
}
