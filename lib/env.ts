/**
 * Variáveis de ambiente, validadas na primeira leitura.
 *
 * A separação é deliberada: `publicEnv` pode ir para o navegador, `serverEnv`
 * nunca. A service_role key dá acesso total ao banco ignorando RLS, então ela
 * só é lida em código de servidor. Importar `serverEnv` de um Client Component
 * quebra o build, e isso é proteção, não inconveniente.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Copie .env.example para .env.local e preencha com as chaves do seu projeto Supabase.`,
    );
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

/** Chaves públicas presentes: usado para exibir aviso de configuração na UI. */
export function isSupabaseConfigured(): boolean {
  return publicEnv.supabaseUrl !== '' && publicEnv.supabaseAnonKey !== '';
}

export function requirePublicEnv() {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', publicEnv.supabaseUrl),
    supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', publicEnv.supabaseAnonKey),
  };
}

/** Somente servidor. Nunca importe isto de um componente com "use client". */
export function requireServerEnv() {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: required(
      'SUPABASE_SERVICE_ROLE_KEY',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}
