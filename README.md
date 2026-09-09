# SAFRA DF · Decisões que Alimentam

Jogo web multiplayer sobre **agricultura familiar no Distrito Federal**, feito
para ser a **primeira atividade** de uma aula sobre desafios de adoção de
tecnologia e o papel das políticas públicas.

Cada grupo administra uma pequena propriedade rural fictícia do DF, recebe
R$ 80.000 e atravessa cinco rodadas de decisões sob informação incompleta. A
partida dura de 15 a 20 minutos e não ensina o conteúdo: ela **revela o que a
turma já pensa**, e as decisões viram o material que o professor usa na
exposição e no debate que vêm depois.

> O jogo não termina quando a partida termina. O painel de diagnóstico mostra o
> que a turma fez, sem classificar ninguém como certo ou errado, e o professor
> conduz a aula a partir dali.

---

## Índice

1. [O que já está pronto](#o-que-já-está-pronto)
2. [Stack e custo](#stack-e-custo)
3. [Arquitetura](#arquitetura)
4. [Instalação](#instalação)
5. [Configurar o Supabase](#configurar-o-supabase)
6. [Variáveis de ambiente](#variáveis-de-ambiente)
7. [Rodar local](#rodar-local)
8. [Deploy na Vercel](#deploy-na-vercel)
9. [Como dar a aula](#como-dar-a-aula)
10. [Editar o conteúdo pedagógico](#editar-o-conteúdo-pedagógico)
11. [Ajustar duração, orçamento e pesos](#ajustar-duração-orçamento-e-pesos)
12. [Testes e simulação](#testes-e-simulação)
13. [Estrutura de pastas](#estrutura-de-pastas)
14. [Limites do plano gratuito](#limites-do-plano-gratuito)
15. [Solução de problemas](#solução-de-problemas)

---

## O que já está pronto

| Requisito | Estado |
|---|---|
| 6 equipes com propriedade, indicadores e histórico próprios | pronto |
| 5 funções por equipe com informação complementar por função | pronto |
| 5 rodadas (preparação, produção, mercado, desafio, colheita) | pronto |
| Eventos com 3 a 5 opções, sem resposta certa, com incerteza | pronto |
| Engine determinística separada da interface | pronto |
| Validação no servidor, RLS e navegador sem escrita no banco | pronto |
| Multiplayer por eventos via Supabase Realtime, sem polling | pronto |
| Painel do professor, projeção, diagnóstico e debriefing | pronto |
| Ranking multifatorial com perfis e prêmios | pronto |
| Testes da engine, do conteúdo e simulação de partida | pronto |

---

## Stack e custo

| Camada | Escolha | Custo |
|---|---|---|
| Front e back | Next.js 16 (App Router) + TypeScript + Tailwind v4 | grátis |
| Banco | PostgreSQL no Supabase | plano Free |
| Tempo real | Supabase Realtime (Postgres Changes) | plano Free |
| Ícones | lucide-react | grátis |
| Hospedagem | Vercel Hobby | grátis |
| Testes | Vitest | grátis |

Sem IA, sem API paga, sem serviço externo pago, sem imagem ou vídeo pesado. A
propriedade visual é SVG gerado em código.

---

## Arquitetura

```
                       ┌──────────────────────────────┐
   celular do aluno ──▶│  Next.js (Vercel)            │
   projetor  ─────────▶│  páginas + route handlers    │
                       └──────┬───────────────┬───────┘
                    service_role│               │anon (só SELECT)
                              ▼               ▼
                       ┌──────────────────────────────┐
                       │  Supabase PostgreSQL         │
                       │  RLS + tabela game_events    │
                       └──────────────────────────────┘
                                     │
                              Realtime (push)
                                     ▼
                          todos os clientes da partida
```

Três camadas, com uma regra que não se quebra:

1. **`app/api/**` (route handlers)** falam com o banco usando a `service_role`
   key. É o único caminho de escrita do sistema.
2. **`lib/game-service.ts`** orquestra: lê o estado do banco, chama a engine,
   grava o resultado e publica o evento de realtime.
3. **`game/engine.ts`** são as regras puras: recebe estado, devolve estado. Não
   conhece HTTP, banco, React nem relógio. É por isso que a partida inteira pode
   ser simulada e testada sem subir nada.

**O navegador nunca escreve no banco.** A chave anon do cliente tem apenas
`SELECT`, e só nas tabelas de estado público. Abrir o DevTools e tentar mudar
caixa, indicador, rodada ou pontuação não funciona: o privilégio de escrita foi
revogado no schema e não existe política de `INSERT`/`UPDATE` para o papel anon.
Tokens de professor e de jogador ficam em tabelas separadas, como hash SHA-256,
sem acesso nenhum para o cliente.

O multiplayer é **orientado a eventos**: o servidor grava um fato em
`game_events` ("a rodada 2 começou") e os clientes reagem buscando o que
precisam. Não existe polling e não se transmite o estado inteiro da partida a
cada mudança.

---

## Instalação

Requisitos: Node.js 20.9 ou mais novo e uma conta gratuita no Supabase.

```bash
git clone https://github.com/pedrohenriquesanchesleal4-debug/TrabalhoRPVGamifica-o.git
cd TrabalhoRPVGamifica-o
npm install
```

---

## Configurar o Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo no
   plano **Free**. Escolha a região mais próxima (`South America (São Paulo)`).
   Guarde a senha do banco: ela não é necessária para o jogo, mas o Supabase
   pede na criação.
2. No painel do projeto, abra **SQL Editor** e cole o conteúdo inteiro de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Clique em **Run**. O script cria as 12 tabelas, os índices, as políticas de
   Row Level Security, revoga a escrita do papel anon e inscreve as tabelas
   necessárias na publicação de Realtime.
3. Confira em **Database > Replication** (ou **Database > Publications**) que a
   publicação `supabase_realtime` inclui `game_events`, `teams`, `players` e
   `games`. O script já faz isso, mas vale conferir antes da aula.
4. Em **Project Settings > API**, copie a **Project URL**, a chave **anon** e a
   chave **service_role**.

O script é idempotente: rodar de novo não apaga dados nem duplica política.

---

## Variáveis de ambiente

```bash
cp .env.example .env.local
```

| Variável | Onde vive | Para que serve |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente e servidor | endereço do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente | leitura pública e Realtime |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** | escrita autoritativa |

A `service_role` key ignora RLS e tem acesso total ao banco. Ela nunca leva
prefixo `NEXT_PUBLIC_`, nunca aparece em código de cliente e nunca vai para o
Git. Na Vercel, cadastre como variável de ambiente do projeto.

---

## Rodar local

```bash
npm run dev
```

Abra `http://localhost:3000`.

| Rota | Quem usa | O que é |
|---|---|---|
| `/` | todos | porta de entrada: aluno ou professor |
| `/entrar` | aluno | código da partida e nome |
| `/jogar` | aluno | a partida: evento, discussão, decisão, consequência |
| `/admin` | professor | criar partida e controlar as rodadas |
| `/host/[gameId]` | professor | projeção para a turma |
| `/host/[gameId]/diagnostico` | professor | o que a turma fez, agregado |
| `/host/[gameId]/resultado` | professor | ranking, perfis e debriefing |

Para testar sozinho, abra `/admin` em uma janela e `/entrar` em várias abas
anônimas: cada aba entra como um jogador e é distribuída na equipe mais vazia.

---

## Deploy na Vercel

```bash
npm i -g vercel
vercel
vercel --prod
```

Ou pelo site: **Add New > Project**, importe o repositório do GitHub e cadastre
as três variáveis de ambiente antes do primeiro build. A Vercel detecta o
Next.js sozinho, sem configuração extra.

Depois do deploy, o endereço da projeção é
`https://<seu-projeto>.vercel.app/host/<gameId>` e o dos alunos é
`https://<seu-projeto>.vercel.app`.

---

## Como dar a aula

**Antes de entrar na sala**

1. Abra o site e crie uma partida de teste. Isso também "acorda" o projeto do
   Supabase, que hiberna depois de dias sem uso no plano gratuito.
2. Confira o Wi-Fi da sala. Trinta celulares em rede ruim é o único risco real
   de operação.

**Na aula, na ordem**

1. Abra `/admin` no computador e clique em **Criar partida**.
2. Projete o **código** que aparece na tela (ou abra `/host/[gameId]`, que
   mostra o código em tipo grande).
3. Peça aos alunos que acessem o endereço, toquem em **Entrar na partida** e
   digitem o código e o primeiro nome. O sistema distribui as 6 equipes
   equilibradas e dá uma função a cada jogador.
4. Explique em uma frase: *"cada grupo administra uma propriedade rural do DF,
   tem R$ 80.000 e cinco rodadas. Cada pessoa recebe uma informação que os
   outros não têm, então conversem antes de confirmar."*
5. Clique em **Iniciar rodada**. Os grupos discutem e confirmam.
6. Quando as equipes tiverem decidido (ou o tempo acabar), clique em
   **Resolver rodada**. Todas as consequências aparecem ao mesmo tempo.
7. Repita para as 5 rodadas. Vale comentar em voz alta o que aparecer de
   interessante entre uma rodada e outra.
8. Ao fim da rodada 5, clique em **Encerrar partida**.
9. Projete `/host/[gameId]/resultado` para o ranking e os perfis, e
   `/host/[gameId]/diagnostico` para o retrato do que a turma fez.
10. Use a pergunta final da tela para abrir o debate e começar a exposição.

**Se algo der errado**: **Pausar** congela a rodada sem perder tempo de decisão
(o cronômetro retoma de onde parou) e **Reiniciar** devolve a partida ao lobby
mantendo os alunos conectados, com as mesmas equipes e funções.

---

## Editar o conteúdo pedagógico

Todo o conteúdo está separado da lógica e da interface. Editar estes arquivos
muda o jogo sem tocar em nenhum componente React.

| Arquivo | Conteúdo |
|---|---|
| `data/events.ts` | as 15 cartas de evento, opções, efeitos, riscos, dicas por função e ganchos de debate |
| `data/properties.ts` | as 6 propriedades, região, foco e modificadores iniciais |
| `data/technologies.ts` | catálogo de tecnologias com custo, benefício, requisito e risco |
| `data/policies.ts` | PAA, PNAE, PAPA-DF, Emater-DF, crédito e cooperativismo |

**Anatomia de uma opção de evento**

```ts
{
  key: 'a',
  label: 'Comprar à vista',
  detail: 'Paga R$ 20.000 do caixa agora e instala nesta semana.',
  displayCost: 20000,          // usado para checar se a equipe pode escolher
  effects: {
    cash: -20000,
    technology: 14,
    productionIfTrained: 12,   // só vira produção se a equipe tiver capacitação
    traits: { irrigation: true, opportunitiesTaken: 1 },
  },
  risk: {                      // opcional: incerteza determinística
    chance: 0.55,
    bonus: { production: 7 },
    penalty: { production: -9 },
    bonusNote: 'Texto mostrado só depois da resolução.',
    penaltyNote: 'Idem.',
  },
  tags: ['tech_invest', 'risk_high'],  // alimentam o diagnóstico da turma
  requiresCash: true,
  requiresTraits: ['inCooperative'],   // opcional
}
```

Três coisas valem entender antes de editar:

- **`productionIfTrained` é o coração pedagógico.** Sem `trained`, o ganho não
  acontece: ele vira `idleTech`, tecnologia parada, e só se converte em produção
  quando a equipe busca capacitação. É assim que o jogo faz a turma descobrir na
  prática que "ter tecnologia" e "conseguir adotar tecnologia" são problemas
  diferentes.
- **`tags` não julgam.** Elas alimentam o painel de diagnóstico ("4 de 6 equipes
  investiram em tecnologia"). Não existe tag de resposta certa.
- **Os valores são fictícios** e existem para pesar dentro do orçamento do jogo.
  Nenhuma regra, limite ou percentual real de programa público é afirmado no
  conteúdo: os dados oficiais entram na exposição do professor.

Depois de editar, rode `npm run test` (as regras de conteúdo são verificadas por
teste: número de opções, tags válidas, textos sem travessão, opção impossível de
pagar) e `npm run simulate` para ver o efeito no balanceamento.

---

## Ajustar duração, orçamento e pesos

Padrões em `types/game.ts` (`DEFAULT_CONFIG`):

```ts
initialBudget: 80_000,     // orçamento de cada equipe
roundSeconds: 180,         // 3 minutos por rodada
teamCount: 6,              // até 6 equipes
maxPlayersPerTeam: 6,
weights: { finances: 25, production: 25, technology: 20, sustainability: 30 },
```

Tudo isso também é configurável **na criação da partida**, no bloco de opções do
`/admin`, sem alterar código. Os pesos do ranking são configuráveis de propósito:
deixa explícito para a turma que "vencer" depende do que se decide valorizar.

---

## Testes e simulação

Quatro níveis, do mais rápido ao mais parecido com a aula de verdade.

```bash
npm run test        # engine, diagnóstico, sorteio determinístico e conteúdo
npm run typecheck   # TypeScript strict
npm run lint
npm run verify      # typecheck + lint + test + build, em sequência
```

**Sem banco, em milissegundos.** A engine é pura, então dá para jogar a partida
inteira offline e conferir se o balanceamento produz perfis diferentes em vez de
um caminho ótimo óbvio:

```bash
npm run simulate                     # 6 equipes, 5 estratégias, 5 rodadas
npm run simulate -- --seed=aula-2b   # reproduz a mesma partida
npm run simulate -- --json
```

**Com banco, pela API.** Joga uma partida inteira contra o seu Supabase: cria,
entra com a turma, abre e resolve as cinco rodadas, encerra e confere o
resultado. Verifica também o que não se vê na tela: equipes equilibradas,
decisão imutável, token de professor inválido recusado, eventos chegando por
realtime e projeção pública sem nenhum segredo dentro.

```bash
npm run dev                          # em outro terminal
npm run smoke                        # 12 alunos, localhost
npm run smoke -- --players=30        # o cenário real da aula
npm run smoke -- --base=https://seu-projeto.vercel.app --players=30
```

**No navegador de verdade.** Playwright abre o painel do professor, a projeção e
12 celulares de aluno ao mesmo tempo e joga uma rodada clicando na interface.
É o teste que prova que o realtime chega ao navegador (as opções aparecem
sozinhas, sem ninguém recarregar), que a confirmação em dois toques trava a
decisão e que nenhuma tela lança erro de JavaScript. Grava capturas em
`screenshots/`.

```bash
npm run browser-check                # headless
npm run browser-check -- --headed    # para assistir acontecendo
```

**Antes da aula, na prática:** rode `npm run smoke -- --base=<sua-url>
--players=30` apontando para o site publicado. Se passar, o ambiente está
pronto, e o projeto do Supabase sai da hibernação no mesmo movimento.

---

## Estrutura de pastas

```
app/
  page.tsx                    porta de entrada
  entrar/                     aluno: código e nome
  jogar/                      aluno: a partida
  admin/                      professor: controle
  host/[gameId]/              projeção, diagnóstico e resultado
  api/                        route handlers (o único caminho de escrita)
components/
  ui/primitives.tsx           botão, campo, pílula, barra de indicador
  game/                       carta de evento, indicadores, equipe, propriedade
  host/                       painéis de projeção
game/
  engine.ts                   regras puras: decisão, rodada, pontuação, perfil
  diagnostics.ts              agregação do que a turma fez
  rng.ts                      sorteio determinístico e reprodutível
lib/
  game-service.ts             orquestração servidor: banco + engine + realtime
  supabase.ts                 clientes admin (service_role) e browser (anon)
  tokens.ts                   código de partida e token com hash
  http.ts                     validação e formato de erro
  client-api.ts               cliente HTTP da interface
data/                         conteúdo pedagógico editável
supabase/migrations/          schema, RLS e realtime
tests/                        engine, conteúdo, diagnóstico
scripts/simulate.ts           partida completa sem banco
docs/CONTRATO.md              contrato interno de API e design
```

---

## Limites do plano gratuito

| Limite | Valor no Free | Impacto na aula |
|---|---|---|
| Projeto hibernando | pausa após ~7 dias sem uso | **acorde o projeto no dia anterior** criando uma partida de teste |
| Conexões Realtime simultâneas | 200 | suficiente para 100 conexões, que é a meta do projeto |
| Mensagens Realtime | 2 milhões por mês | uma partida de 30 alunos gasta na casa das centenas |
| Banco | 500 MB | cada partida ocupa poucos KB |
| Vercel Hobby | uso não comercial | trabalho acadêmico se encaixa |

O consumo é baixo porque o jogo transmite **eventos**, não estado: nenhum
cliente fica perguntando ao servidor se algo mudou.

---

## Solução de problemas

**"Variável de ambiente ausente"**
O `.env.local` não existe ou está incompleto. Copie de `.env.example`. Depois de
editar, reinicie o `npm run dev`.

**Nenhuma partida com esse código**
O código tem 5 caracteres, sem as letras e números que se confundem (não existe
O, 0, I, 1 nem S, 5 no alfabeto de geração). Confira na tela projetada.

**Os indicadores não atualizam sozinhos**
O Realtime não está publicando. Rode de novo o bloco final de
`0001_init.sql` e confira em **Database > Replication** se `game_events`,
`teams`, `players` e `games` estão na publicação `supabase_realtime`.

**A primeira requisição do dia demora muito**
Projeto do Supabase saindo da hibernação do plano gratuito. Acorde antes da
aula.

**Uma equipe não consegue escolher nenhuma opção**
Ela está sem caixa para as opções pagas. Isso é jogo, não defeito: as opções
sem custo continuam disponíveis, e ficar sem dinheiro é exatamente o tipo de
situação que rende debate depois.

**"Esta equipe já confirmou a decisão desta rodada"**
Decisão é definitiva por regra do jogo, garantida por restrição de unicidade no
banco. Só a resolução da rodada libera a próxima escolha.

---

## Licença e uso

Material didático. As propriedades, valores, prazos e situações são fictícios e
servem à simulação. Regras, critérios e limites reais do PAA, PNAE, PAPA-DF, da
assistência técnica da Emater-DF e das linhas de crédito rural devem ser
consultados nas fontes oficiais e apresentados pelo professor na exposição.
