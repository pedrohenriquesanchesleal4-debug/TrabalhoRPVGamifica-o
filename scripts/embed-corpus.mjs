// Alimenta o corpus vetorial do roteiro de debate (RAG Fase 2).
//
// Pré-requisitos:
//  1. Rodar as migrations 0001 e 0002 no Supabase.
//  2. Servidor local de pé (npm run dev).
//  3. EMBED_ADMIN_KEY definida em .env.local (a mesma que o servidor lê).
//
// Uso: npm run embed:corpus   (ou: node scripts/embed-corpus.mjs)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = readFileSync(resolve('.env.local'), 'utf8');
const get = (name) => {
  const line = env.split('\n').find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : null;
};

const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
const adminKey = get('EMBED_ADMIN_KEY');

if (!adminKey) {
  console.error('EMBED_ADMIN_KEY não encontrada em .env.local. Abortando.');
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/admin/corpus/embed`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${adminKey}`,
    'content-type': 'application/json',
  },
});

const text = await response.text();
console.log(`${response.status}: ${text}`);

if (!response.ok) process.exit(1);