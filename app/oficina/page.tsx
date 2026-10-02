import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Accessibility,
  BookOpen,
  Compass,
  Cpu,
  Footprints,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Leaf,
  ListChecks,
  Megaphone,
  MessageCircle,
  Quote,
  Radio,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Star,
  Store,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { SectionHeading } from '@/components/ui/primitives';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import {
  MAX_ACOES_POR_ESTAGIO,
  OFICINA_BLOCOS_INFO,
  OFICINA_CATEGORIAS_INFO,
  OFICINA_CATEGORIAS_ORDEM,
  OFICINA_INDICADORES_INFO,
  OFICINA_PERFIS_INFO,
  OFICINA_STAGES_ORDEM,
  OFICINA_STAGE_META,
  type OficinaIndicador,
  type OficinaPerfil,
} from '@/types/oficina';

/**
 * Página institucional do segundo modo de jogo: "Oficina Safra DF".
 *
 * O Diagnóstico (`app/page.tsx`) já se apresenta como o jogo principal. Esta
 * página existe porque a Oficina era invisível: só aparecia como uma opção
 * dentro de `/admin`. Aqui o texto responde, em ordem, o que é, como
 * funciona, por que é diferente, e termina em quem cria.
 *
 * REGRA DESTA PÁGINA: todo número que aparece sai de `data/oficina-content.ts`
 * ou de `types/oficina.ts`. Nada é digitado à mão, então o conteúdo não
 * divergemdo motor quando alguém edita uma pista, um bloco ou uma ação. Se a
 * Oficina ganhar uma ação amanhã, esta página mostra 11 sem ninguém editar
 * nada.
 *
 * É a única página do projeto que descreve números: os demais pontos de
 * entrada contam coisas que a interface já mostra. Aqui o número é o
 * argumento, e por isso ele tem que ser verdadeiro e datado de "uma turma".
 */

export const metadata: Metadata = {
  title: 'Oficina Safra DF',
  description:
    'Segundo modo de jogo do Safra DF: de 1 a 6 equipes jogam juntas na mesma comunidade do Cerrado, descobrem e compartilham pistas e recebem categorias de destaque em vez de ranking.',
};

// ---------------------------------------------------------------------------
// Ícones: o conteúdo declara o nome como string (`icone`), a página escolhe o
// desenho. A string continua sendo a fonte da verdade do dado.
// ---------------------------------------------------------------------------

const ICONE: Record<string, LucideIcon> = {
  Accessibility,
  Compass,
  Cpu,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Leaf,
  ListChecks,
  Megaphone,
  MessageCircle,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Star,
  Store,
  Truck,
  Users,
  Wrench,
};

/** Ícone do conteúdo com queda para um neutro: dado novo nunca quebra a tela. */
function iconeDo(nome: string): LucideIcon {
  return ICONE[nome] ?? Footprints;
}

/** Perfil do conteúdo na ordem de distribuição das equipes (`OFICINA_PERFIS_ORDEM`). */
const PERFIS: OficinaPerfil[] = [
  'produtores',
  'cooperativa',
  'comercializacao',
  'logistica',
  'juventude_tech',
  'articulacao',
];

/** Os oito indicadores, na ordem de declaração do contrato de domínio. */
const INDICADORES: OficinaIndicador[] = [
  'cooperacao',
  'organizacao',
  'mercado',
  'conhecimento',
  'sustentabilidade',
  'confianca',
  'inclusao',
  'viabilidade',
];

/** Fatos do cabeçalho. Todos derivados, nenhum digitado. */
const FATOS = [
  { numero: 6, rotulo: 'equipes na mesma sala' },
  { numero: OFICINA_STAGES_ORDEM.length, rotulo: 'etapas que a turma atravessa junta' },
  { numero: OFICINA_CONTENT.acoes.length, rotulo: 'ações para descobrir e resolver' },
  { numero: INDICADORES.length, rotulo: 'indicadores que a equipe movimenta' },
] as const;

/** Comparação entre os dois modos. O eixo que muda a aula está em `nota`. */
const COMPARACAO = [
  {
    criterio: 'O que a equipe administra',
    diagnostico: 'Uma propriedade rural do Distrito Federal, com caixa próprio.',
    oficina: 'Um setor da Boa Vista do Cerrado, a mesma comunidade para todo mundo.',
  },
  {
    criterio: 'Cada pessoa recebe',
    diagnostico: 'Uma função com informação que os colegas do grupo não têm.',
    oficina: 'O mesmo mapa, o mesmo evento e a mesma trilha da turma.',
  },
  {
    criterio: 'Como o tempo passa',
    diagnostico: 'Cinco rodadas, cada equipe decide o seu movimento.',
    oficina: 'Seis etapas e o professor avança quando a sala está pronta.',
  },
  {
    criterio: 'Onde a equipe trava',
    diagnostico: 'No orçamento: o dinheiro não fecha, e é para parecer que não fecha.',
    oficina: 'Em sete ações por etapa, e algumas só existem depois de uma pista.',
  },
  {
    criterio: 'O que existe no fim',
    diagnostico: 'Ranking com pesos que o professor escolhe na criação da partida.',
    oficina: 'Seis categorias de destaque, uma para cada equipe, sem primeiro lugar.',
  },
] as const;

// ---------------------------------------------------------------------------
// Peças de layout
// ---------------------------------------------------------------------------

/** Filtete dourado: divisor estrutural entre as bandas da página. */
function Divisor() {
  return <div className="filete-amanhecer w-full" aria-hidden="true" />;
}

/**
 * Link que age como botão.
 *
 * `next/link` não aceita `className` de CTA pronta: o CTA dourado vive em
 * `components/ui/primitives.tsx` como `Button variant="destaque"`, que é
 * `<button>`. Estas classes são as mesmas do botão, copiadas para o link para
 * que o alvo de toque continue com 56px.
 */
const CTA_DOURADO =
  'degrau banco pisavel bg-financas text-(--cor-tinta-escuro) inline-flex min-h-14 items-center justify-center gap-2 px-6 text-base font-bold tracking-[0.01em]';

const CTA_NEUTRO =
  'degrau banco pisavel terr-claro text-terra-900 inline-flex min-h-14 items-center justify-center gap-2 px-6 text-base font-bold tracking-[0.01em]';

export default function OficinaPage() {
  const etapas = OFICINA_STAGES_ORDEM.map((stage, indice) => ({
    stage,
    indice,
    meta: OFICINA_STAGE_META[stage],
  }));

  const indicadores = INDICADORES.map((chave) => ({
    chave,
    info: OFICINA_INDICADORES_INFO[chave],
  }));

  const perfis = PERFIS.map((perfil) => ({ perfil, info: OFICINA_PERFIS_INFO[perfil] }));
  const blocos = Object.values(OFICINA_BLOCOS_INFO);

  return (
    <main className="w-full">
      {/* ----------------------------------------------------------------
          0 · BARRA DE VOLTA
          A página institucional é uma paragem, não um lugar perdido: sempre
          há um caminho de volta para a home e para a criação de partida.
          ---------------------------------------------------------------- */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="relevo-sm inline-flex min-h-11 items-center text-terra-900 hover:text-financas-texto"
        >
          SAFRA DF
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="rotulo inline-flex min-h-11 items-center px-3 hover:text-terra-900"
          >
            VOLTAR À HOME
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* ----------------------------------------------------------------
          1 · HERO · O QUE É
          Paisagem de 06:20 como fundo, uma definição em duas frases e as
          duas saídas: entender agora ou criar agora.
          ---------------------------------------------------------------- */}
      <section className="relative min-h-[70dvh] overflow-hidden">
        <CerradoLandscape className="z-0" />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[#0d0f0b]/50" />

        <div className="relative z-[2] mx-auto flex min-h-[70dvh] w-full max-w-6xl flex-col justify-end gap-5 px-5 pb-12 sm:px-8 sm:pb-14">
          <div className="flex max-w-2xl flex-col gap-5 motion-safe:animate-emergir">
            <p className="rotulo text-(--cor-tinta-panel-dourado)">
              SEGUNDO MODO DE JOGO · BOA VISTA DO CERRADO
            </p>

            <h1 className="titulo-amanhecer text-5xl font-bold uppercase leading-[0.9] sm:text-6xl lg:text-7xl">
              OFICINA<br />
              SAFRA DF
            </h1>

            <Divisor />

            <p className="max-w-[44ch] text-base leading-relaxed sobre-cena-suave sm:text-lg">
              Um jogo para até seis equipes na mesma sala. Elas não disputam: elas
              investigam a mesma comunidade, compartilham o que descobriram e
              atravessam as mesmas seis etapas no mesmo ritmo.
            </p>

            <p className="max-w-[44ch] text-base leading-relaxed sobre-cena-suave sm:text-lg">
              No fim não existe pódio. Cada equipe recebe uma categoria de
              destaque diferente, e a conversa sobre o que a turma decidiu é o
              produto final.
            </p>

            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href="/admin" className={CTA_DOURADO}>
                CRIAR UMA OFICINA
              </Link>
              <a href="#etapas" className={CTA_NEUTRO}>
                VER AS 6 ETAPAS
              </a>
            </div>

            <p className="rotulo sobre-cena-suave">
              A escolha entre os dois modos acontece em /admin, na criação da partida
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          2 · NÚMEROS DA TURMA
          Um console só, quatro leituras. Sem card: são quatro leituras dentro
          do mesmo painel, separadas por espaço, como um painel de instrumentos.
          ---------------------------------------------------------------- */}
      <section className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="degrau terraco terr-neutro p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
            {FATOS.map((fato) => (
              <div key={fato.rotulo} className="flex min-w-0 flex-col gap-1">
                <span className="dado-xl text-financas-texto">{fato.numero}</span>
                <span className="text-sm leading-snug text-terra-700">{fato.rotulo}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-[62ch] text-sm leading-relaxed text-terra-500">
            Estes números são o tamanho de uma sala de aula, não da internet: seis
            equipes, seis etapas, {OFICINA_CONTENT.acoes.length} ações e{' '}
            {INDICADORES.length} indicadores, todos contados a partir dos arquivos de
            conteúdo do projeto.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          3 · POR QUE É DIFERENTE · OS DOIS MODOS
          O único `mirante` da tela: é o degrau mais alto porque é a resposta
          que o professor precisa antes de escolher. Uma tabela de
          comportamento, não uma lista de benefícios.
          ---------------------------------------------------------------- */}
      <section id="modos" className="revelar mx-auto w-full max-w-6xl px-5 pb-10 sm:px-8 sm:pb-12">
        <div className="degrau mirante terr-financas flex flex-col gap-6 p-5 sm:p-8">
          <SectionHeading
            overline="Diagnóstico e Oficina"
            title="Dois jeitos de usar a mesma sala"
            description="O Diagnóstico põe cada equipe dentro da sua propriedade e faz a informação circular por dentro do grupo. A Oficina põe todo mundo dentro da mesma comunidade e faz a descoberta circular entre os grupos."
            escala="lg"
          />

          <dl className="flex flex-col gap-3 sm:gap-4">
            {/* Cabeçalho das colunas: só a partir de sm, porque no celular o nome
                do modo viaja dentro de cada célula (evita linha duplicada). */}
            <div className="hidden gap-4 sm:grid sm:grid-cols-[0.85fr_1fr_1fr]">
              <span />
              <span className="rotulo pt-3">Diagnóstico</span>
              <span className="rotulo pt-3 text-(--cor-tinta-panel-dourado)">Oficina</span>
            </div>

            {COMPARACAO.map((linha) => (
              <div
                key={linha.criterio}
                className="flex flex-col gap-2 sm:grid sm:grid-cols-[0.85fr_1fr_1fr] sm:items-start sm:gap-4"
              >
                <dt className="relevo-sm pt-1 text-terra-900">{linha.criterio}</dt>
                <dd className="degrau banco terr-neutro p-3.5">
                  <span className="rotulo sm:hidden">Diagnóstico</span>
                  <span className="mt-1 block text-sm leading-relaxed text-terra-700 sm:mt-0">
                    {linha.diagnostico}
                  </span>
                </dd>
                <dd className="degrau banco terr-financas p-3.5">
                  <span className="rotulo sm:hidden text-(--cor-tinta-panel-dourado)">
                    Oficina
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-terra-700 sm:mt-0">
                    {linha.oficina}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          4 · COMO FUNCIONA · AS SEIS ETAPAS
          Linha do tempo, não grade de seis cartões iguais: um trilho à
          esquerda, o número em `dado` e o objetivo que o professor lê em voz
          alta. Título e objetivo vêm de `OFICINA_STAGE_META`, que é o mesmo
          texto que o painel do professor mostra na parede.
          ---------------------------------------------------------------- */}
      <section id="etapas" className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-6 sm:gap-8">
          <SectionHeading
            overline={`${OFICINA_STAGES_ORDEM.length} etapas, uma trilha só`}
            title="A oficina inteira, do começo ao fim"
            description="Não existe etapa paralela nem equipe correndo por fora: o professor abre uma etapa, a turma toda trabalha nela, e ele avança quando a sala está pronta."
          />

          <ol className="flex flex-col gap-5 border-l-2 border-financas/30 pl-4 sm:gap-6 sm:pl-6">
            {etapas.map(({ indice, meta }) => (
              <li key={meta.titulo} className="flex flex-col gap-2 sm:flex-row sm:gap-5">
                <span className="dado text-2xl text-financas-texto sm:w-9 sm:shrink-0 sm:text-3xl">
                  {String(indice + 1).padStart(2, '0')}
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h3 className="relevo-sm text-terra-900">{meta.titulo}</h3>
                  <p className="max-w-[60ch] text-sm leading-relaxed text-terra-700">
                    {meta.objetivo}
                  </p>
                  <p className="max-w-[60ch] text-sm leading-relaxed text-terra-500">
                    {meta.conducting}
                  </p>
                  {meta.meta ? (
                    <p className="text-xs leading-relaxed text-financas-texto">
                      Na tela do jogador: {meta.meta}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          5 · OS SETORES DA COMUNIDADE
          Quem cada equipe representa. A Boa Vista é um lugar do Distrito
          Federal desenhado a partir dos problemas que os núcleos rurais reais
          enfrentam: estrada de terra, cooperativa com câmara fria, escola
          que pode comprar da agricultura familiar, sinal que não chega lá.
          ---------------------------------------------------------------- */}
      <section className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="degrau terraco terr-verde flex flex-col gap-6 p-5 sm:p-8">
          <SectionHeading
            overline={`${perfis.length} setores, ${OFICINA_CONTENT.personagens.length} pessoas, ${OFICINA_CONTENT.locais.length} lugares`}
            title="Cada equipe entra como um setor da Boa Vista"
            description="O perfil orienta o olhar da equipe, não limita o que ela pode fazer. Nenhuma equipe entra em posição melhor que a outra: cada uma enxerga um lado do mesmo problema."
          />

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {perfis.map(({ perfil, info }) => {
              const Icone = iconeDo(info.icone);
              return (
                <li key={perfil} className="degrau banco terr-neutro flex items-start gap-3 p-4">
                  <Icone size={20} strokeWidth={2.2} className="mt-0.5 shrink-0 text-verde-300" aria-hidden="true" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-bold text-terra-900">{info.rotulo}</span>
                    <span className="text-xs leading-relaxed text-terra-700">{info.pitch}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          6 · O LAÇO DA COOPERAÇÃO
          A diferença que a turma sente na mão: descobrir, contar e responder
          junto. Esta é a seção que substitui a ideia de ranking.
          ---------------------------------------------------------------- */}
      <section id="cooperacao" className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-6 sm:gap-8">
          <SectionHeading
            overline="Descobrir, contar, responder junto"
            title="O que faz a Oficina ser colaborativa de verdade"
            description="Não é um conselho de jogue bonitinho: é a estrutura do jogo. A pista descoberta por uma equipe pode ser publicada, e a equipe que tinha exatamente a mesma dificuldade deixa de ter."
          />

          {/* Três degraus assimétricos, como os três momentos do laço. */}
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr] lg:items-start">
            <article className="degrau terraco terr-neutro flex flex-col gap-3 p-5 sm:p-6">
              <span className="dado text-3xl text-financas-texto">01</span>
              <h3 className="relevo-sm text-terra-900">
                {OFICINA_CONTENT.pistas.length} pistas espalhadas pelo território
              </h3>
              <p className="text-sm leading-relaxed text-terra-700">
                Uma equipe investiga um lugar ou conversa com uma pessoa da
                comunidade e encontra o que está travando ali. Cada canto do
                mapa guarda uma pista, e nenhuma equipe começa com o mapa
                inteiro.
              </p>
            </article>

            <article className="degrau terraco terr-azul flex flex-col gap-3 p-5 sm:p-6 lg:mt-6 sm:p-6">
              <span className="dado text-3xl text-financas-texto">02</span>
              <h3 className="relevo-sm text-terra-900">E ela pode ser publicada</h3>
              <p className="text-sm leading-relaxed text-terra-700">
                Publicar uma pista é uma das ações do jogo. A partir daí as
                outras equipes passam a ver aquela descoberta e podem agir em
                cima dela. Descobrir e contar ajuda a turma inteira, e o
                destaque de colaboração olha justamente para isso.
              </p>
            </article>

            <article className="degrau terraco terr-sustentabilidade flex flex-col gap-3 p-5 sm:p-6 lg:mt-12">
              <span className="dado text-3xl text-financas-texto">03</span>
              <h3 className="relevo-sm text-terra-900">
                {OFICINA_CONTENT.eventos.length} situações coletivas
              </h3>
              <p className="text-sm leading-relaxed text-terra-700">
                Chuva no sábado da feira, caminhão na oficina, antena caída,
                chamada pública do PAA: são situações que a comunidade inteira
                enfrenta. A parede mostra a situação e cada equipe responde.
                Nenhuma equipe ganha ou perde por resposta isolada.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          7 · AÇÕES E INDICADORES
          O que a equipe pode fazer e o que ela mexe. Ações com custo em
          pontos de ação (o orçamento da etapa) e efeito real nos indicadores.
          ---------------------------------------------------------------- */}
      <section className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-6 sm:gap-8">
          <SectionHeading
            overline={`${OFICINA_CONTENT.acoes.length} ações · ${MAX_ACOES_POR_ESTAGIO} por etapa`}
            title="O que dá para fazer dentro de uma etapa"
            description="Cada equipe tem um orçamento de pontos de ação na etapa de investigação. Gastar todo o orçamento não é melhor: escolher bem o que fazer é o exercício de sala."
          />

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {OFICINA_CONTENT.acoes.map((acao) => {
              const Icone = iconeDo(acao.icone);
              return (
                <li key={acao.key} className="degrau banco terr-neutro flex items-start gap-3 p-4">
                  <Icone size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-azul-300" aria-hidden="true" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-sm font-bold text-terra-900">{acao.nome}</span>
                      <span className="dado text-xs text-financas-texto">
                        {acao.custo_acoes}{' '}
                        {acao.custo_acoes === 1 ? 'ponto' : 'pontos'} de ação
                      </span>
                    </div>
                    <span className="text-xs leading-relaxed text-terra-700">{acao.descricao}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="degrau terraco terr-neutro flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-2">
              <h3 className="relevo-md text-terra-900">
                {INDICADORES.length} indicadores, nenhum deles é nota
              </h3>
              <p className="max-w-[62ch] text-sm leading-relaxed text-terra-700">
                Toda ação mexe em alguns desses indicadores. Eles vão de 0 a 100
                e descrevem a situação da equipe, não o desempenho dela: uma
                equipe com sustentabilidade baixa não errou, ela escolheu dar
                menos peso ao cuidado ambiental naquele momento.
              </p>
            </div>

            <ul className="flex flex-wrap gap-2">
              {indicadores.map(({ chave, info }) => {
                const Icone = iconeDo(info.icone);
                return (
                  <li
                    key={chave}
                    className="degrau banco terr-neutro flex min-w-0 items-center gap-2 px-3 py-2"
                  >
                    <Icone size={16} strokeWidth={2.4} className="shrink-0 text-sustentabilidade-texto" aria-hidden="true" />
                    <span className="text-sm font-bold text-terra-900">{info.rotulo}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          8 · FIM DE ETAPA: DESTAQUES, NÃO RANKING
          A solução em 13 blocos, uma categoria por equipe e nenhuma
          classificação. A frase que o professor precisa ouvir da turma: todo
          mundo sai com um destaque, porque as categorias medem coisas
          diferentes.
          ---------------------------------------------------------------- */}
      <section id="destaques" className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="degrau terraco terr-claro flex flex-col gap-6 p-5 sm:p-8">
          <SectionHeading
            overline={`${blocos.length} blocos por equipe`}
            title="Cada equipe monta uma solução e recebe um destaque"
            description="Na etapa de solução, a equipe escreve o que propõe em 13 blocos: o problema principal, com quem, usando o que já existe na comunidade, e o que pode dar errado. No fim, cada equipe recebe uma categoria, nunca duas e nunca uma tabela de posição."
            escala="lg"
          />

          <ul className="flex flex-wrap gap-2">
            {blocos.map((bloco) => (
              <li
                key={bloco.rotulo}
                className="degrau banco terr-neutro px-3 py-2 text-xs font-bold text-terra-700"
              >
                {bloco.rotulo}
              </li>
            ))}
          </ul>

          <div className="filete-amanhecer w-full" aria-hidden="true" />

          <div className="flex flex-col gap-4">
            <h3 className="relevo-md text-terra-900">
              {OFICINA_CATEGORIAS_ORDEM.length} categorias, uma para cada equipe
            </h3>
            <p className="max-w-[62ch] text-sm leading-relaxed text-terra-700">
              As categorias olham eixos diferentes: viabilidade, colaboração,
              inclusão, cuidado com o Cerrado, inovação e equilíbrio geral. Com
              até seis equipes, cada uma leva uma, e o que sobra de categoria sem
              dono é um resultado honesto, não um erro do jogo. Não existe
              primeiro lugar nesta tela.
            </p>

            <ul className="flex flex-col gap-3">
              {OFICINA_CATEGORIAS_ORDEM.map((categoria) => {
                const info = OFICINA_CATEGORIAS_INFO[categoria];
                const Icone = iconeDo(info.icone);
                return (
                  <li
                    key={categoria}
                    className="degrau banco terr-neutro flex items-start gap-3 p-4"
                  >
                    <Icone
                      size={20}
                      strokeWidth={2.2}
                      className="mt-0.5 shrink-0 text-financas-texto"
                      aria-hidden="true"
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-bold text-terra-900">{info.rotulo}</span>
                      <span className="text-xs leading-relaxed text-terra-700">
                        {info.explicacao}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="max-w-[62ch] text-sm leading-relaxed text-terra-700">
            Depois do destaque, a oficina fecha com{' '}
            {OFICINA_CONTENT.reflexao_perguntas.length} perguntas para a conversa
            em sala. Elas não têm resposta certa gravada: são perguntas para a
            turma discutir o que deu certo e o que travou.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          9 · O PAPEL DA IA
          Três momentos, uma regra: se a rede falhar, a aula continua. A
          honestidade aqui é técnica, não de marketing.
          ---------------------------------------------------------------- */}
      <section className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="degrau terraco terr-neutro flex flex-col gap-5 p-5 sm:p-8">
          <SectionHeading
            overline="Com a internet, sem a internet"
            title="A IA escreve, mas a oficina não depende dela"
          />

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                Icone: Quote,
                titulo: 'Abertura',
                texto:
                  'Conta o começo da Boa Vista do Cerrado e dá o tom da primeira etapa, quando o professor apresenta a comunidade para a turma.',
              },
              {
                Icone: BookOpen,
                titulo: 'Roteiro do debate',
                texto:
                  'Depois da oficina, escreve o roteiro que o professor usa para abrir a conversa em sala, citando as soluções que as equipes realmente enviaram.',
              },
              {
                Icone: Star,
                titulo: 'Reflexão final',
                texto:
                  'Fecha a etapa de encerramento retomando as perguntas-chave sobre o que a turma aprendeu e onde a proposta ainda é frágil.',
              },
            ].map(({ Icone, titulo, texto }) => (
              <li key={titulo} className="degrau banco terr-neutro flex flex-col gap-2 p-4">
                <Icone size={18} strokeWidth={2.2} className="shrink-0 text-financas-texto" aria-hidden="true" />
                <span className="relevo-sm text-terra-900">{titulo}</span>
                <span className="text-xs leading-relaxed text-terra-700">{texto}</span>
              </li>
            ))}
          </ul>

          <p className="flex max-w-[66ch] flex-col gap-2 text-sm leading-relaxed text-terra-700">
            <span className="relevo-sm flex items-center gap-2 text-terra-900">
              <Radio size={18} strokeWidth={2.2} className="shrink-0 text-sustentabilidade-texto" aria-hidden="true" />
              Se a chave faltar ou a rede cair
            </span>
            <span>
              O jogo tem textos prontos para os três momentos e entra no lugar da
              geração automaticamente. Nenhuma etapa trava esperando resposta de
              ninguém, e a chave da IA é opcional: a Oficina inteira funciona sem
              ela, num computador sem rede, com o projetor ligado no HDMI.
            </span>
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          10 · CTA FINAL
          Quem chega aqui é professor. A resposta é um caminho de dois cliques:
          abrir /admin e escolher o modo.
          ---------------------------------------------------------------- */}
      <section className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="degrau terraco terr-fundo-verde flex flex-col items-center gap-5 p-6 text-center sm:p-10">
          <p className="relevo-lg text-white">
            Uma turma, um aparelho por equipe, seis etapas.
          </p>
          <p className="max-w-[46ch] text-sm leading-relaxed text-(--cor-tinta-panel-amena)">
            Para criar, abra o painel do professor, escolha <strong className="text-white">Oficina Safra DF</strong> no
            seletor de modo e monte a partida. Os alunos entram pelo mesmo endereço
            de sempre.
          </p>

          <Link href="/admin" className={CTA_DOURADO}>
            ABRIR O PAINEL DO PROFESSOR
          </Link>

          <Link
            href="/"
            className="rotulo inline-flex min-h-11 items-center px-3 text-(--cor-tinta-panel-verde) hover:opacity-80"
          >
            Conhecer o modo Diagnóstico
          </Link>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          RODAPÉ
          A comunidade da Boa Vista é fictícia. Dizê-lo aqui evita que alguém
          leia os nomes como cadastro de gente real.
          ---------------------------------------------------------------- */}
      <footer className="mx-auto w-full max-w-6xl px-5 pb-10 sm:px-8">
        <p className="max-w-[70ch] text-xs leading-relaxed text-terra-500">
          A Boa Vista do Cerrado é uma comunidade fictícia, inspirada nos núcleos
          rurais do Distrito Federal. Os nomes, as situações e os prazos existem
          para a simulação: regras, limites e programas públicos reais devem ser
          consultados nas fontes oficiais e mostrados pelo professor na
          exposição, não pelo jogo.
        </p>
      </footer>
    </main>
  );
}