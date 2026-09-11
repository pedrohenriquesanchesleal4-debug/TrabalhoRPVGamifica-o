# Relatório Final · Redesign SAFRA DF — V6 "Amanhecer do Cerrado"

> 2026-09-11 · Projeto `safra-df` (Next.js 16 · React 19 · Tailwind v4)
> Documento de encerramento: escolhas, retrospectiva honesta e recomendações de política pública, tecnologia e IA+RAG para o domínio retratado.

---

## 1. Resumo executivo

A interface do SAFRA DF foi redesenhada de uma "central de controle industrial" (V5, correto porém frio) para o **instante do amanhecer sobre o Cerrado** (V6): fundo breu verde-escuro, areia dourada no texto, acento único de dourado da safra reservado ao CTA, paisagem vetorial em SVG/CSS puro (zero imagem, zero WebGL, zero biblioteca de animação). Três ondas seguintes responderam a feedback real do usuário: coreografia de movimento por scroll (V6.1), raios generosos + ambiência viva sob redução de movimento (V6.2, horas "os pássaros estão parados") e **tema claro com legibilidade garantida** + fita de dados + banda "como funciona" (V6.3). Cada onda fechou com `npm run verify` verde (typecheck + lint + 94 testes + build, 15 rotas) e contraste medido numericamente. O valor que atravessou tudo: **física de painel preservada** (degrau/banco/terraço/mirante com sombra sólida e raio por altitude), **movimento só `transform`/`opacity`**, e **legibilidade como requisito, não detalhe**.

---

## 2. As escolhas (o que foi decidido e por quê)

### 2.1 Direção visual — por que "Amanhecer do Cerrado"

- **Decisão:** trocar a metáfora "painel de silo" (aço frio) por "sala de controle olhando a janela onde o sol nasce" — sem mudar uma classe do sistema de painel.
- **Por quê:** o usuário disse "a interface está correta mas não brilha os olhos". O problema não era usabilidade nem arquitetura; era **clima**. A solução foi atmosfera na superfície existente, não uma reforma estrutural.
- **Como:** 4 direções de design apresentadas (estilo primeiro), escolhida uma; paleta re-tingida (terra-noite, verde-oliva do Cerrado, ferrugem como segundo quente), texto em areia dourada (nunca `#fff`), textura de fundo em 3 camadas de custo zero (brilho de nascer do sol + grade de plantio subliminar + grão de filme em SVG embutido).
- **Contraste calculado:** todas as duplas de texto da paleta passam AA/AAA (creme×texto 13.6:1; consoles 12.5:1) — a "cor de destaque" não é capricho, é tabela.

### 2.2 Movimento (V6.1) — CSS nativo, custo zero

- **Decisão:** `scroll-driven animations` (`animation-timeline: view()/scroll()`) para revelação abaixo da dobra e parallax do hero — navegador faz o scrub no compositor, zero JS.
- **Por quê:** a disciplina do projeto proíbe biblioteca de animação e JS pesado (celular popular, rede ruim na sala). CSS nativo entrega cinema sem custo.
- **Regras:** só `transform`/`opacity`; loops infinitos apenas em ambiência cênica; `motion-safe:` para entradas de hero; `@supports` garante fallback estático-visível.

### 2.3 Redondinho e reduced-motion (V6.2) — a caixa-preta que explodiu na nossa cara

- **Decisão 1 (raios):** escada `--raio-degrau/banco/terraco/mirante` = 10/10/12/14px, preservando hierarquia (mais alto = mais redondo) — "redondinho" sem cair no `rounded-2xl` uniforme que o anti-AI-slop proíbe.
- **Decisão 2 (birds):** o usuário reportou "não mudou nada" com o código compilado correto. **Causa raiz:** `prefers-reduced-motion: reduce` ativo no ambiente dele (Windows liga global no Chrome). A resposta foi inverter o paradigma: sob redução, **decoração cênica vive lenta (~2× duração, iteração infinita), nunca morre** (`display:none` congelado). Quem pediu menos movimento não pediu um quadro congelado.
- **Lição de processo:** testar o alvo antes de entregar. Uma pergunta ("seu SO tem animações desligadas?") teria evitado a onda inteira.

### 2.4 Tema claro (V6.3) — tokens, não classes

- **Decisão:** trocar **valores** de tokens (`[data-tema="claro"]` redefinindo as variáveis), jamais tocar nas classes. `text-terra-900` continua certo nos dois temas porque a superfície sobre a qual ele senta inverte junto.
- **Âncora noturna:** a paisagem ganhou 11 tokens `--cor-cena-*` **fixos** — o amanhecer de 06:20 permanece noturno nos dois temas; o claro troca apenas superfícies de leitura e tintas.
- **Três famílias de tinta:** adaptáveis (`--cor-tinta-*`, seguem o tema), fixas de console (`--cor-tinta-panel*`, sempre claras), e a do CTA dourado (`--cor-tinta-escuro`).
- **Contraste medido por script** em pares reais (incluindo pratos mistos = acento 26-30% + creme novo): 1 par estourou, ajustado na hora (#7a4d0b). Sem medição, o tema claro teria vazado 4.15:1.
- **Alternador:** `useSyncExternalStore` (lint do React Compiler proíbe `setState` em effect) + `localStorage` + script anti-FOUC no layout. Presente em home/entrar/admin — **jogo e projeção ficam de fora** (o aluno não escolhe o tema na hora da decisão; o projetor é do professor).

### 2.5 Landing "falta algo" — duas adições de matéria, não de decoração

- **Ticker da safra** sob o hero: fita de dados contínua (loop CSS `translateX(-50%)`, conteúdo duplicado, 34s / 64s sob redução).
- **Banda "COMO FUNCIONA"**: 3 degraus assimétricos (1.15fr + offsets verticais) — um código → cinco rodadas → a consequência volta. Conteúdo real do jogo, não card genérico.

### 2.6 Processo — swarm paralelo com contrato

- Frentes independentes (home / entrar / jogo / professor) executadas **em paralelo** por agentes especializados, coordenadas por **artefatos em disco** (globals.css + contrato de tokens por valor), cada agente rodando typecheck/lint próprio antes de devolver; orquestrador faz fundação (tokens, paisagem, toggle) e o gate final (`npm run verify` + auditoria de CSS compilado + tabela de contraste + anti-slop).

---

## 3. O que poderia ter sido melhor (retrospectiva honesta)

### 3.1 Processo

1. **Não investiguei o ambiente do usuário antes da entrega V6.1.** O código estava certo; o SO do usuário estava em reduced-motion. Cinco minutos de pergunta ("animações do Windows/Chrome desligadas?") teriam economizado uma onda inteira e a percepção de "não mudou nada".
2. **Primeiro build do tema quebrou** (`Missing getServerSnapshot` no `useSyncExternalStore`): li a API com pressa, não o contrato SSR completo. A regra — uSES em componente SSR **exige** o 3º argumento — é uma linha de doc que economizaria o primeiro `verify` vermelho.
3. **Edição `GAUGE_INK` deixou resíduo de sintaxe** (linhas órfãs de keys duplicadas). Zero impacto em produção, mas tipo de sujeira que um diff maior esconde: edições em bloco único e releitura do trecho são baratas.
4. **Tema igual para todos os papéis.** Professor e aluno compartilham o mesmo toggle/persistência por aparelho. Melhor: perfil de tema por papel+partida (o projetor do host nem deveria ter toggle — e não tem, mas por convenção, não por configuração).
5. **Contraste só foi medido por tema**; pares **mistos** (prato tingido = mix de acento + superfície) exigiam medição desde a construção da paleta, não no fim.

### 3.2 Tecnologia

1. **Sem testes visuais (screenshot/regressão).** Contraste e motion são verificados por script/CSS compilado, mas não existe Playwright de UI. Para um app de sala de aula, uma suíte de 3-4 fluxos (entrar → jogar → projeção → fim) valeria o custo.
2. **Acessibilidade além do contraste não foi auditada formalmente** (navegação por teclado, foco, leitor de tela no fluxo de decisão). O contraste é AA+, o resto é boato até ser testado.
3. **Performance mobile qualitativa, não medida.** Garantias (compositor-only, SVG mínimo) são sólidas, mas não há LCP/INP real em aparelho popular.
4. **`prefers-color-scheme` ignorado como default.** Por decisão (não surpreender a sala), mas o caminho ideal é *default* seguir o SO e a sala poder travar o tema manualmente.
5. **Ticker sem teste sob foco/tab:** faixa decorativa tem `aria-hidden`, mas o comportamento sob teclado e a parada sob hover não foram auditados (baixo risco, alto detalhe).

### 3.3 Design

1. A identidade visual é forte, mas as **telas de mapa DF e o "pós-partida"** (resultado/diagnóstico) ainda carregam menos atmosfera que o hero — a próxima onda de polimento deveria começar por aí, não por mais animação.
2. **O ticker e o COMO FUNCIONA vieram por "falta algo"** — um mecanismo de discovery mais sistemático ("o que o jogo precisa contar antes do primeiro clique?") teria antecipado isso na primeira onda.

---

## 4. Além do jogo: políticas públicas e tecnologias para os problemas do Cerrado/DF

O jogo simula um problema real: agricultura familiar com recursos mínimos, água curta, pressão de desmatamento no Cerrado. As recomendações abaixo conectam o que o jogo ensina a alavancas reais.

### 4.1 Políticas públicas

1. **Credito com condicionalidade ambiental** (Plano Safra/ABC+): reduzir custo de juro para pequeno produtor que adota práticas de conservação de solo e água (ilustrações de "proteger" vs "vender" da 5ª rodada sendo recompensadas fora do jogo).
2. **ATER — assistência técnica adaptada à agricultura familiar**: hoje concentrada em médios/grandes; a extensão rural é o multiplicador mais barato de adoção de SAF (sistemas agroflorestais).
3. **PSA — Pagamento por Serviços Ambientais no DF** (marco distrital existe desde 2021): custear, por hectare/ano, produtor que mantém reserva, nascente e vegetação nativa — **o jogo ensina o vocabulário; a política paga o comportamento**.
4. **Outorga de água simplificada para pequenos produtores**: regularização de uso de água com burocracia proporcional ao porte, vinculada a boas práticas de irrigação.
5. **Compras públicas garantidas (PNAE)**: demanda certa e preço justo para a produção familiar — a "decisão de vender" da rodada deixa de ser liquidação forçada.
6. **Educação ambiental como política**: inserir jogos de simulação de decisão (o próprio SAFRA DF) no contraturno/ciências — formação de cidadania hídrica e territorial desde a escola pública do DF.

### 4.2 Tecnologias (dados e conectividade)

1. **Observação da Terra para escopo das políticas**: NDVI/sensoriamento remoto permite *targeting* de crédito/ATER por pressão real de desmatamento (dados do PRODES/Cerrado, ANA, Conab — todos abertos). É o "mapa do DF" do jogo em escala pública.
2. **Sensores de umidade de baixo custo + georreferenciamento simples**: irrigação por necessidade real, não por calendário — água é o recurso mais escasso do jogo e da realidade.
3. **Agricultura de precisão de entrada** (drones/índices de vegetação acessíveis) para propriedades pequenas, não só para grandes lavouras.
4. **Conectividade rural (DF tem manchas de exclusão)**: sem internet de qualidade, nenhuma das tecnologias acima chega à propriedade. Elegibilidade de política pública deveria incluir infraestrutura digital como prioridade de universalização.
5. **Dados abertos como material didático pós-jogo**: o professor pode abrir, após a partida, casos reais com dados da Conab/ANA/IBGE — o jogo vira porta de entrada para leitura de dado público.

---

## 5. IA + RAG integrada ao SAFRA DF — o que eu acho de verdade

**Resposta curta: sim, vale — mas em fases, e a primeira fase não é a que parece.**

### 5.1 O que RAG resolve de fato aqui

O SAFRA DF tem duas fontes de "conhecimento" valiosas: (a) **documentos** (leis, dados, artigos sobre Cerrado/DF/agricultura familiar) e (b) **fatos da própria partida** (5 rodadas × 4 equipes × decisões e consequências — dados estruturados que o app já tem). RAG permite ao assistente **citar a fonte** (lei/dado/rodada) em vez de alucinar — e para menor de idade em sala de aula, citação obrigatória é condição de confiança, não luxo.

### 5.2 O que NÃO fazer

- **Não** gerar "resposta/estratégia ótima da rodada": destruiria exatamente o debate que é o produto do jogo.
- **Não** substituir o professor: o papel da IA é *recuperar e organizar evidência*, não decidir nem avaliar.
- **Não** guardar conversas de menores (LGPD): sessão sem persistência, sem coleta de dados pessoais além do que o jogo já usa.

### 5.3 Faseamento recomendado (custo controlado)

| Fase | O quê | Contexto | Custo/risco |
|---|---|---|---|
| **1 — Pós-partida (agora, barato)** | "Reflexão": assistente que explica consequências das decisões usando **os fatos estruturados daquela partida** como contexto (RAG de fatos, não só docs) + 5-10 fontes oficiais curadas (ANA, Conab, lei do PSA-DF) com citação obrigatória | structured data da partida + corpora pequeno | baixo: contexto pequeno, respostas cacheadas por pergunta frequente |
| **2 — Professor** | Painel de síntese das 4 equipes: padrões, comparações, "o que mudar na próxima rodada" — a IA lê o resultado da turma inteira | dados da partida + docs | médio: contexto maior, mas 1 chamada por turma, não por aluno |
| **3 — Tutor por equipe (opcional)** | Chat/FAQ ao longo da partida com streaming e cache de respostas frequentes | híbrido: keyword+semântico (termos regionais como "cerrado", "outorga" precisam de recuperação híbrida) | alto: 30 alunos × 5 rodadas; exige limite de tokens/partida e fallback offline |

### 5.4 Stack técnica sugerida

- **Vercel AI SDK** (streaming + `onError` controlado) sobre roteador de provider com fallback (OpenAI/Anthropic) — rede de escola é ruim; streaming salva a experiência.
- **Embeddings + pgvector no Supabase que já existe** (a stack atual tem Supabase): os fatos da partida viram vetores localmente, sem infra nova.
- **Recuperação híbrida**: os termos do domínio são regionais e raros (keyword importa tanto quanto vetor).
- **Cache + rate limit por partida**: teto de tokens por turma, respostas idênticas cacheadas, fallback offline ("professor, sem conexão: consulte o roteiro impresso").
- **Guardrail de saída**: citar sempre, responder "não sei" quando o corpus não cobre, nunca opinar sobre "melhor decisão".

### 5.5 A ordem certa

1. **Fase 1 (pós-partida + fatos da partida)** — o maior valor educacional pelo menor custo, e não depende de modelo caro.
2. Usar os **dados abertos do §4.2** como corpus inicial (leis/dados oficiais, rastreáveis).
3. Só então tutor em tempo real, se o projeto de produto justificar o custo por aluno.

O jogo ensina a pergunta (escassez, água, risco). A IA com RAG bem curada ensina a *verificar* (a fonte, a lei, o dado). O professor segue sendo quem decide o que merece ser perguntado.

---

## 6. Estado de encerramento

- **Gate:** `npm run verify` verde ao final de cada onda (V6, V6.1, V6.2, V6.3) — typecheck, lint, 94 testes, build 15 rotas.
- **Memória persistente:** `decisoes.md` D-01…D-07, `erros-corrigidos.md`, `learnings.md` e `contexto.md` atualizados a cada etapa.
- **Documentação de direção visual:** `docs/DIRECAO-VISUAL-V6.md` (especificação + paleta + tabelas de contraste + tema claro).
- **Riscos residuais:** título de hero é gradiente (não é texto plano — leitores de tela leem o conteúdo, ok); tema do professor persiste por aparelho (por design); performance mobile não medida (qualitativa).
- **Anti-AI-slop:** zero Inter, zero gradiente roxo, zero `rounded-2xl` uniforme, zero "hero + 3 cards" — as escolhas de tipografia (Oswald/Manrope/JetBrains), cor dominante (terra-noite + dourado da safra) e assimetria são intencionais e documentadas.

## Adendo (2026-09-11) · Fase 1 de IA entregue: roteiro de debate

Depois do relatório, o professor pediu e recebeu a Fase 1 do plano de IA: botão **"Preparar roteiro de debate"** no Bloco 5 do resultado (/host/[gid]/resultado). Uma chamada ao Gemini por partida, ancorada nos fatos reais da partida (indicadores finais, histórico de decisões por equipe, perfil, prêmios, diagnóstico, ganchos e conexões de política pública). Saída: fala de abertura, 3-5 pontos para sustentar, uma provocação e 2 perguntas para a sala — para o professor, em PT-BR, sem julgar equipes nem declarar estratégia ótima.

Limites de cota respeitados: cache em tabela debate_prep (reabrir a tela nunca regenera), guarda de clique duplo (singleflight), timeout 25s, sem retry em 429, retry único só para rede/5xx, snapshot JSON <7k caracteres. Modelo: gemini-3.6-flash (o 2.5-flash responde 404 para chaves novas — testado ao vivo). Para ativar: executar supabase/migrations/0001_debate_prep.sql no Supabase e definir GEMINI_API_KEY + GEMINI_MODEL no servidor (Vercel).


## Adendo 2 (2026-09-11) · Fase 2 de IA entregue: RAG com citação por fonte

Corpus vetorial de 14 fichas (6 políticas públicas + 8 tecnologias), derivadas dos dados já existentes do app (zero número inventado, fonte por ficha). Fluxo: partida → embedding (gemini-embedding-001, 3072 dims, medido ao vivo) → busca pgvector HNSW das 3 fichas mais próximas → prompt ganha "Materiais de apoio" com nome + Fonte → roteiro cita (Fonte: ...) nos pontos. Custo: 15 embeddings FIXOS (uma vez, via 
pm run embed:corpus); por partida continua 1 geração + 1 embedding, só na primeira abertura (cache). Falha de busca degrada para roteiro sem citação, nunca trava a aula.


## Correção (2026-09-11) · 3072 → 768 dims no corpus

A migration 0002 original falhava no Supabase com ERROR: 54000: column cannot have more than 2000 dimensions for hnsw index — o gemini-embedding-001 entrega 3072 dims por padrão, mas o HNSW do pgvector indexa no máximo 2000. Corrigido ao vivo: o modelo aceita outputDimensionality, e 768 foi confirmado na chave do projeto. A migration 0002 foi reescrita para 768 dims (HNSW volta a funcionar) e ficou idempotente/defensiva: se você rodou a versão 3072 e quebrou no meio, rode 0002 de novo (apaga o estado parcial e recria). Código (lib/corpus.ts, .env.example, .env.local) alinhado: outputDimensionality: 768 em todo embedding. Gate 
pm run verify verde; validar no Supabase e, se o corpus ainda estiver vazio, 
pm run embed:corpus.
