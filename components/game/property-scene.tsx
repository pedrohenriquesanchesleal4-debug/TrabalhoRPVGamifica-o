import { useId } from 'react';
import { PROPERTY_BY_KEY } from '@/data/properties';

/**
 * SAFRA DF · a propriedade desenhada a nanquim na folha do caderno.
 *
 * Não é ilustração colorida: é o croqui que o agricultor rabisca na margem
 * para explicar onde fica cada coisa. Traço fino de tinta, hachura em vez de
 * preenchimento chapado, e lápis de cor só nos três pontos que os indicadores
 * governam: a lavoura (produção), os equipamentos (tecnologia) e a água mais a
 * mata (sustentabilidade).
 *
 * A geometria de cada propriedade é fixa e vive em `LAYOUTS`: casa, galpão,
 * talhão, reservatório, estrada, árvores e manchas de solo. O que muda com o
 * jogo é a densidade da lavoura, quantos equipamentos existem, quanta mata
 * sobrou e o nível do reservatório. A identidade de cada sítio vem de um
 * elemento fixo ligado ao seu foco produtivo, sempre presente, independente
 * dos números.
 *
 * `viewBox` fixo com `preserveAspectRatio="xMidYMid slice"`: o mesmo croqui
 * serve para a miniatura da projeção, a faixa `compact` do celular e o bloco
 * cheio da tela do aluno, apenas cortando as bordas conforme o recipiente.
 */

const VIEW_W = 400;
const VIEW_H = 220;

/**
 * Faixa realmente enquadrada.
 *
 * O desenho usa a altura toda de 220 para posicionar (horizonte em 132, casas e
 * árvores subindo a partir de 148), mas todo o conteúdo vive entre 120 e 215:
 * enquadrar de 0 a 220 deixaria mais da metade do quadro em papel vazio. O
 * recorte começa um pouco acima do telhado mais alto e vai até o rodapé.
 */
const VIEW_Y = 106;
const VIEW_VISIBLE_H = VIEW_H - VIEW_Y;

/** Linha do horizonte: acima é papel limpo, abaixo é o talhão hachurado. */
const HORIZON_Y = 132;

/** Traço de tinta e traços de lápis: as únicas cores do croqui. */
const TINTA = 'var(--color-tinta-900)';
const TINTA_FRACA = 'var(--color-tinta-400)';
const PAPEL = 'var(--color-papel-000)';
const LAPIS_LAVOURA = 'var(--color-producao)';
const LAPIS_MAQUINA = 'var(--color-tecnologia)';
const LAPIS_AGUA = 'var(--color-sustentabilidade)';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Duas casas decimais: o atributo SVG vira a mesma string no servidor e no cliente. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Deslocamento pseudo-orgânico determinístico.
 *
 * Nunca `Math.random`, porque a cena precisa renderizar igual sempre. E nunca
 * `Math.sin` tampouco: o resultado de `Math.sin` é definido pela implementação
 * em JavaScript, então o Node do servidor e o V8 do navegador podem divergir no
 * último bit. Isso vazava como erro de hidratação nas telas de cliente que
 * desenham o croqui, porque a coordenada renderizada no servidor não batia com
 * a do cliente. Um hash inteiro de 32 bits dá o mesmo número em toda engine, e
 * o arredondamento em duas casas garante que a string do atributo também seja
 * idêntica dos dois lados.
 */
function jitter(seed: number, amplitude: number): number {
  let hash = Math.trunc(seed) | 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d) | 0;
  hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39) | 0;
  hash = (hash ^ (hash >>> 15)) >>> 0;
  const unit = hash / 0xffffffff;
  return Math.round(unit * amplitude * 100) / 100;
}

type PropertyKey =
  | 'sitio-horizonte'
  | 'cerrado-vivo'
  | 'boa-esperanca'
  | 'riacho-verde'
  | 'nova-safra'
  | 'planalto-familiar';

type CropSymbol = 'crop-touceira' | 'crop-tunel' | 'crop-lamina';

interface Ponto {
  x: number;
  y: number;
}

interface Layout {
  /** Casa: base do telhado no chão, apex acima. */
  house: Ponto;
  houseScale: number;
  /** Assentamento recente: estrutura ainda incompleta, sem janela, madeira à vista. */
  houseFinished: boolean;
  shed: Ponto;
  shedScale: number;
  /** Faixa de plantação: linha de base e limites horizontais. */
  field: { x0: number; x1: number; y: number };
  cropSymbol: CropSymbol;
  cropColsMax: number;
  cropRowsMax: number;
  reservoir: Ponto;
  reservoirScale: number;
  /** Ponto de entrada da estrada na borda do cenário. */
  roadFrom: Ponto;
  /** Até 5 posições de árvore nativa, reveladas em ordem conforme a sustentabilidade sobe. */
  treeSpots: Ponto[];
  /** Até 6 posições de solo exposto/coberto. */
  soilSpots: Ponto[];
}

const LAYOUTS: Record<PropertyKey, Layout> = {
  'sitio-horizonte': {
    house: { x: 72, y: 152 },
    houseScale: 1,
    houseFinished: true,
    shed: { x: 332, y: 160 },
    shedScale: 0.82,
    field: { x0: 140, x1: 258, y: 196 },
    cropSymbol: 'crop-touceira',
    cropColsMax: 6,
    cropRowsMax: 2,
    reservoir: { x: 42, y: 188 },
    reservoirScale: 0.75,
    roadFrom: { x: 400, y: 210 },
    treeSpots: [
      { x: 24, y: 150 },
      { x: 372, y: 148 },
      { x: 300, y: 200 },
    ],
    soilSpots: [
      { x: 132, y: 204 },
      { x: 266, y: 202 },
      { x: 198, y: 208 },
      { x: 150, y: 210 },
    ],
  },
  'cerrado-vivo': {
    house: { x: 104, y: 154 },
    houseScale: 1,
    houseFinished: true,
    shed: { x: 300, y: 162 },
    shedScale: 0.88,
    field: { x0: 150, x1: 246, y: 198 },
    cropSymbol: 'crop-touceira',
    cropColsMax: 5,
    cropRowsMax: 2,
    reservoir: { x: 344, y: 192 },
    reservoirScale: 1,
    roadFrom: { x: 0, y: 214 },
    treeSpots: [
      { x: 30, y: 146 },
      { x: 60, y: 168 },
      { x: 210, y: 150 },
      { x: 372, y: 150 },
      { x: 260, y: 176 },
    ],
    soilSpots: [
      { x: 170, y: 206 },
      { x: 214, y: 208 },
    ],
  },
  'boa-esperanca': {
    house: { x: 92, y: 150 },
    houseScale: 1,
    houseFinished: true,
    shed: { x: 322, y: 158 },
    shedScale: 0.82,
    field: { x0: 142, x1: 268, y: 190 },
    cropSymbol: 'crop-tunel',
    cropColsMax: 8,
    cropRowsMax: 1,
    reservoir: { x: 40, y: 184 },
    reservoirScale: 0.8,
    roadFrom: { x: 400, y: 206 },
    treeSpots: [
      { x: 20, y: 148 },
      { x: 378, y: 146 },
      { x: 306, y: 196 },
    ],
    soilSpots: [
      { x: 138, y: 202 },
      { x: 272, y: 200 },
      { x: 205, y: 204 },
      { x: 220, y: 168 },
    ],
  },
  'riacho-verde': {
    house: { x: 52, y: 150 },
    houseScale: 0.85,
    houseFinished: true,
    shed: { x: 336, y: 154 },
    shedScale: 1.15,
    field: { x0: 108, x1: 300, y: 200 },
    cropSymbol: 'crop-lamina',
    cropColsMax: 9,
    cropRowsMax: 3,
    reservoir: { x: 344, y: 200 },
    reservoirScale: 0.9,
    roadFrom: { x: 0, y: 216 },
    treeSpots: [
      { x: 16, y: 146 },
      { x: 386, y: 144 },
    ],
    soilSpots: [
      { x: 120, y: 210 },
      { x: 160, y: 212 },
      { x: 210, y: 210 },
      { x: 260, y: 212 },
      { x: 292, y: 210 },
    ],
  },
  'nova-safra': {
    house: { x: 80, y: 158 },
    houseScale: 0.82,
    houseFinished: false,
    shed: { x: 298, y: 168 },
    shedScale: 0.66,
    field: { x0: 150, x1: 226, y: 194 },
    cropSymbol: 'crop-touceira',
    cropColsMax: 4,
    cropRowsMax: 1,
    reservoir: { x: 38, y: 194 },
    reservoirScale: 0.62,
    roadFrom: { x: 400, y: 212 },
    treeSpots: [
      { x: 24, y: 152 },
      { x: 376, y: 150 },
    ],
    soilSpots: [
      { x: 148, y: 202 },
      { x: 168, y: 208 },
      { x: 200, y: 204 },
      { x: 224, y: 210 },
      { x: 240, y: 200 },
      { x: 130, y: 210 },
    ],
  },
  'planalto-familiar': {
    house: { x: 74, y: 150 },
    houseScale: 1,
    houseFinished: true,
    shed: { x: 246, y: 158 },
    shedScale: 0.9,
    field: { x0: 296, x1: 358, y: 190 },
    cropSymbol: 'crop-touceira',
    cropColsMax: 3,
    cropRowsMax: 1,
    reservoir: { x: 370, y: 190 },
    reservoirScale: 0.7,
    roadFrom: { x: 0, y: 210 },
    treeSpots: [
      { x: 20, y: 148 },
      { x: 380, y: 152 },
      { x: 200, y: 146 },
    ],
    soilSpots: [
      { x: 130, y: 208 },
      { x: 160, y: 206 },
      { x: 108, y: 212 },
    ],
  },
};

/** Descrição textual por faixa: alimenta o `aria-label`, único canal para leitor de tela. */
function descreverProducao(v: number): string {
  if (v < 34) return 'plantação inicial, com poucas fileiras';
  if (v < 67) return 'plantação em desenvolvimento';
  return 'plantação desenvolvida e densa';
}

function descreverTecnologia(v: number): string {
  if (v < 20) return 'sem equipamento visível';
  if (v < 40) return 'com irrigação instalada';
  if (v < 65) return 'com irrigação e painel solar';
  if (v < 90) return 'com irrigação, painel solar e antena de sinal';
  return 'com estrutura completa: irrigação, painel solar, antena e estufa';
}

function descreverSustentabilidade(v: number): string {
  if (v < 35) return 'pouca vegetação nativa, solo exposto e reservatório baixo';
  if (v < 67) return 'vegetação nativa moderada e reservatório em nível médio';
  return 'vegetação nativa preservada, solo coberto e reservatório cheio';
}

function construirAriaLabel(propertyKey: string, production: number, technology: number, sustainability: number): string {
  const nome = PROPERTY_BY_KEY[propertyKey]?.name ?? 'Propriedade';
  return `Croqui de ${nome}: ${descreverProducao(production)}, ${descreverTecnologia(technology)}, ${descreverSustentabilidade(sustainability)}.`;
}

export function PropertyScene({
  propertyKey,
  production,
  technology,
  sustainability,
  className,
  compact,
}: {
  propertyKey: string;
  production: number;
  technology: number;
  sustainability: number;
  className?: string;
  compact?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const p = clamp(production, 0, 100);
  const t = clamp(technology, 0, 100);
  const s = clamp(sustainability, 0, 100);

  const layout = LAYOUTS[propertyKey as PropertyKey] ?? LAYOUTS['sitio-horizonte'];
  const ariaLabel = construirAriaLabel(propertyKey, p, t, s);

  // Lavoura: mais colunas, mais fileiras e traço maior conforme a produção sobe.
  const cropCols = clamp(2 + Math.floor(p / 16), 2, compact ? Math.min(4, layout.cropColsMax) : layout.cropColsMax);
  const cropRows = layout.cropRowsMax === 1
    ? 1
    : clamp(1 + Math.floor(p / 40), 1, compact ? 1 : layout.cropRowsMax);
  const cropScale = 0.68 + (p / 100) * 0.62;
  // O lápis pressiona mais forte quando a lavoura está boa: opacidade é a pressão do traço.
  const cropOpacity = round2(0.45 + (p / 100) * 0.55);

  // Mata nativa: quanto mais sustentável, mais copas desenhadas.
  const treeCount = clamp(Math.round((s / 100) * layout.treeSpots.length), 0, layout.treeSpots.length);
  const treesVisiveis = layout.treeSpots.slice(0, treeCount);

  // Solo: exposto quando a sustentabilidade é baixa, coberto quando é alta, neutro na faixa do meio.
  const soloExposto = s < 35;
  const soloCoberto = s >= 65;
  const soilCount = soloExposto
    ? clamp(6 - Math.round(s / 8), 2, layout.soilSpots.length)
    : soloCoberto
      ? clamp(Math.round(((s - 65) / 35) * layout.soilSpots.length), 2, layout.soilSpots.length)
      : 0;
  const soloVisivel = layout.soilSpots.slice(0, soilCount);

  // Reservatório: a lâmina de água sobe com a sustentabilidade; a ondulação só aparece com água suficiente.
  const basinW = round2(46 * layout.reservoirScale);
  const basinH = round2(20 * layout.reservoirScale);
  const waterLevel = 0.28 + (s / 100) * 0.62;
  const waterH = round2(basinH * waterLevel);
  const mostraOnda = s >= 30;

  // Equipamentos: cada patamar de tecnologia acrescenta um item, nunca remove o anterior.
  const temIrrigacao = t >= 20;
  const temSolar = t >= 40;
  const temSensor = t >= 65;
  const temAntena = t >= 78;
  const temEstufa = t >= 92;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      focusable="false"
      viewBox={`0 ${VIEW_Y} ${VIEW_W} ${VIEW_VISIBLE_H}`}
      preserveAspectRatio="xMidYMid slice"
      /*
       * O bloco cheio usa a proporção exata do recorte, então nada é cortado.
       * A faixa compacta é mais larga de propósito: o `slice` come um pouco de
       * topo e de rodapé, e a casa, a lavoura e o reservatório, que ficam no
       * centro do quadro, continuam inteiros.
       */
      className={`block w-full ${compact ? 'aspect-[400/82]' : 'aspect-[400/114]'} ${className ?? ''}`}
    >
      {/* Duas animações no total: a copa respirando e a água ondulando. Desligadas com movimento reduzido. */}
      <style>{`
        .sfr-copa { animation: sfr-respira 5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
        .sfr-onda { animation: sfr-ondula 3.2s ease-in-out infinite alternate; }
        @keyframes sfr-respira { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        @keyframes sfr-ondula { from { opacity: 0.4; transform: translateX(-2px); } to { opacity: 0.85; transform: translateX(2px); } }
        @media (prefers-reduced-motion: reduce) {
          .sfr-copa, .sfr-onda { animation: none; }
        }
      `}</style>

      <defs>
        {/* Hachura do talhão: o jeito de dar tom sem chapar cor, igual desenho a bico de pena. */}
        <pattern id={`${uid}-hachura`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={TINTA} strokeWidth="0.4" opacity="0.28" />
        </pattern>

        {/* Lâmina de água: linhas horizontais, como se anota nível em croqui. */}
        <pattern id={`${uid}-agua`} width="4" height="3" patternUnits="userSpaceOnUse">
          <line x1="0" y1="1.5" x2="4" y2="1.5" stroke={LAPIS_AGUA} strokeWidth="1.1" opacity="0.75" />
        </pattern>

        {/* Hachura cruzada, mais densa: usada no telhado e no galpão. */}
        <pattern id={`${uid}-cruzada`} width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 4 L4 0" stroke={TINTA} strokeWidth="0.45" opacity="0.55" />
          <path d="M0 0 L4 4" stroke={TINTA} strokeWidth="0.45" opacity="0.3" />
        </pattern>

        {/*
          Árvore de cerrado: copa larga e baixa, tronco curto e torto, galho
          aparente. Não é o pinheirinho genérico de ilustração: o cerrado tem
          essa silhueta retorcida, e é ela que localiza o croqui no Planalto.
        */}
        <symbol id={`${uid}-arvore`} viewBox="0 0 26 30">
          <path
            d="M13 30 L12.4 22 Q11.8 19 9 17 M12.4 22 Q13.6 19.5 16.5 17.5"
            stroke={TINTA}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M13 3 C19 3 24 6.5 24 11 C24 15.5 19 18.5 13 18.5 C7 18.5 2 15.5 2 11 C2 6.5 7 3 13 3 Z"
            fill={LAPIS_LAVOURA}
            fillOpacity="0.16"
            stroke={TINTA}
            strokeWidth="1.2"
          />
          <path
            d="M6 10 q3.5 -3 6.5 0 M13 14 q3.5 -3 6.5 0 M15 7 q3 -2.5 5.5 0"
            stroke={TINTA}
            strokeWidth="0.7"
            fill="none"
            opacity="0.55"
          />
        </symbol>

        {/* Touceira: cultura em canteiro, morango denso ou horta agroecológica. */}
        <symbol id={`${uid}-crop-touceira`} viewBox="0 0 12 12">
          <path d="M6 11 L6 5 M6 7 L2.5 4 M6 7 L9.5 4 M6 9 L3.5 7 M6 9 L8.5 7" fill="none" strokeWidth="1.1" strokeLinecap="round" />
        </symbol>

        {/* Túnel baixo: arco de plástico sobre a fileira de morango. */}
        <symbol id={`${uid}-crop-tunel`} viewBox="0 0 16 10">
          <path d="M0 10 Q8 -2 16 10" fill="none" strokeWidth="1.3" />
          <path d="M4 10 Q8 3 12 10" fill="none" strokeWidth="0.7" opacity="0.65" />
        </symbol>

        {/* Lâmina de grão: talo alto e fino, área maior de lavoura. */}
        <symbol id={`${uid}-crop-lamina`} viewBox="0 0 8 20">
          <path d="M4 20 L2 4 M4 20 L6 5 M4 20 L4 2" fill="none" strokeWidth="1.1" strokeLinecap="round" />
        </symbol>

        {/* Solo exposto: rachadura, não mancha. */}
        <symbol id={`${uid}-solo-exposto`} viewBox="0 0 12 6">
          <path d="M0 3 L3 2 L6 4 L9 2.5 L12 3.5" fill="none" stroke={TINTA_FRACA} strokeWidth="0.9" strokeLinecap="round" />
        </symbol>

        {/* Solo coberto: palhada rasteira em traço curto. */}
        <symbol id={`${uid}-solo-coberto`} viewBox="0 0 14 4">
          <path d="M1 3 L3 1 M5 3.5 L7 1.5 M9 3 L11 1 M12 3.5 L13.5 2" fill="none" stroke={LAPIS_LAVOURA} strokeWidth="0.9" strokeLinecap="round" />
        </symbol>

        {/* Gota de irrigação, repetida ao longo da linha de gotejo. */}
        <symbol id={`${uid}-gota`} viewBox="0 0 6 6">
          <path d="M3 0.6 C4.6 2.4 5 3.2 5 4 A2 2 0 0 1 1 4 C1 3.2 1.4 2.4 3 0.6 Z" fill={LAPIS_MAQUINA} />
        </symbol>
      </defs>

      {/* A folha e o talhão: papel limpo em cima, hachura de terra embaixo. */}
      <rect x="0" y="0" width={VIEW_W} height={HORIZON_Y} fill={PAPEL} />
      <rect x="0" y={HORIZON_Y} width={VIEW_W} height={VIEW_H - HORIZON_Y} fill={PAPEL} />
      <rect x="0" y={HORIZON_Y} width={VIEW_W} height={VIEW_H - HORIZON_Y} fill={`url(#${uid}-hachura)`} />
      {/*
        Horizonte com dois traços de espessura diferente: é assim que se marca
        limite de terreno em croqui, e não com uma régua uniforme de 1px.
      */}
      <line x1="0" y1={HORIZON_Y} x2={VIEW_W} y2={HORIZON_Y} stroke={TINTA} strokeWidth="1.1" />
      <line x1="0" y1={HORIZON_Y + 2.5} x2={VIEW_W} y2={HORIZON_Y + 2.5} stroke={TINTA} strokeWidth="0.4" opacity="0.4" />

      {/*
        A porteira e o começo da carreira de terra.
        
        A estrada inteira, atravessando o quadro na diagonal até a casa, lia
        como vinco de papel e não como caminho. O que importa aqui é o PONTO DE
        ENTRADA: é da porteira que chegam o vendedor de irrigação, o técnico da
        assistência e o comprador. Ela ocupa um canto e diz a mesma coisa.
      */}
      {(() => {
        // A porteira encosta na borda por onde a estrada entrava, virada para dentro.
        const paraDireita = layout.roadFrom.x < VIEW_W / 2;
        const x = paraDireita ? 16 : VIEW_W - 16;
        const y = layout.roadFrom.y;
        const dentro = paraDireita ? 1 : -1;

        return (
          <g stroke={TINTA} strokeWidth="1.2" fill="none">
            {/* Dois mourões e três travessas: a porteira de fazenda. */}
            <line x1={x} y1={y} x2={x} y2={y - 20} />
            <line x1={x + dentro * 22} y1={y + 2} x2={x + dentro * 22} y2={y - 18} />
            <line x1={x} y1={y - 16} x2={x + dentro * 22} y2={y - 14} strokeWidth="0.9" />
            <line x1={x} y1={y - 10} x2={x + dentro * 22} y2={y - 8} strokeWidth="0.9" />
            <line x1={x} y1={y - 4} x2={x + dentro * 22} y2={y - 2} strokeWidth="0.9" />
            {/* A carreira sumindo terra adentro, aberta na hachura. */}
            <path
              d={`M${x + dentro * 24} ${y + 1} q ${dentro * 30} -6 ${dentro * 54} -9`}
              stroke={TINTA_FRACA}
              strokeWidth="0.8"
              strokeDasharray="6 4"
            />
          </g>
        );
      })()}

      {/* Reservatório: bacia a tinta, lâmina de água a lápis. */}
      <g transform={`translate(${layout.reservoir.x - basinW / 2}, ${layout.reservoir.y - basinH})`}>
        <rect x="0" y="0" width={basinW} height={basinH} fill="none" stroke={TINTA} strokeWidth="1.3" />
        <rect
          x="1.5"
          y={basinH - waterH - 1.5}
          width={basinW - 3}
          height={Math.max(waterH - 1.5, 1)}
          fill={`url(#${uid}-agua)`}
          /* Água baixa desenha mais fraco, além de mais rasa: dois sinais, não um. */
          opacity={s < 35 ? 0.5 : 1}
        />
        {mostraOnda && (
          <path
            className="sfr-onda"
            d={`M4 ${basinH - waterH + 2} Q ${basinW / 2} ${basinH - waterH - 1} ${basinW - 4} ${basinH - waterH + 2}`}
            fill="none"
            stroke={LAPIS_AGUA}
            strokeWidth="1"
            strokeLinecap="round"
          />
        )}
      </g>

      {/* Casa: telhado hachurado, parede em traço. Sem janela quando a estrutura ainda está incompleta. */}
      <g transform={`translate(${layout.house.x}, ${layout.house.y}) scale(${layout.houseScale})`}>
        <polygon points="-20,-6 0,-24 20,-6" fill={`url(#${uid}-cruzada)`} stroke={TINTA} strokeWidth="1.2" />
        <rect x={-16} y={-6} width={32} height={22} fill={PAPEL} stroke={TINTA} strokeWidth="1.2" />
        {!layout.houseFinished && (
          <g stroke={TINTA_FRACA} strokeWidth="0.6">
            <line x1={-16} y1={0} x2={16} y2={0} />
            <line x1={-16} y1={7} x2={16} y2={7} />
          </g>
        )}
        <rect x={-4} y={4} width={8} height={12} fill="none" stroke={TINTA} strokeWidth="1" />
        {layout.houseFinished && <rect x={7} y={0} width={6} height={6} fill="none" stroke={TINTA} strokeWidth="0.9" />}
      </g>

      {/* Galpão: telhado em duas águas, hachura mais densa que a da casa. */}
      <g transform={`translate(${layout.shed.x}, ${layout.shed.y}) scale(${layout.shedScale})`}>
        <polygon points="-24,-4 0,-18 24,-4" fill={`url(#${uid}-cruzada)`} stroke={TINTA} strokeWidth="1.2" />
        <rect x={-20} y={-4} width={40} height={20} fill={PAPEL} stroke={TINTA} strokeWidth="1.2" />
        <line x1={-20} y1={4} x2={20} y2={4} stroke={TINTA_FRACA} strokeWidth="0.6" />
        <rect x={-4} y={6} width={8} height={10} fill="none" stroke={TINTA} strokeWidth="1" />
      </g>

      {/* Lavoura: repetição do símbolo da propriedade, densidade e altura seguem a produção. */}
      <g stroke={LAPIS_LAVOURA} fill="none" opacity={cropOpacity}>
        {Array.from({ length: cropRows }).map((_, row) =>
          Array.from({ length: cropCols }).map((_, col) => {
            const seed = row * 31 + col;
            const stepX = (layout.field.x1 - layout.field.x0) / cropCols;
            const x = round2(layout.field.x0 + stepX * (col + 0.5) + jitter(seed, 2.4));
            const y = round2(layout.field.y - row * 10 + jitter(seed + 5, 1.6));
            const size = round2(10 * cropScale);
            return (
              <use
                key={`${row}-${col}`}
                href={`#${uid}-${layout.cropSymbol}`}
                x={x - size / 2}
                y={y - size}
                width={size}
                height={size}
              />
            );
          }),
        )}
      </g>

      {/* Cota do talhão: a medida anotada por cima do desenho, como em croqui de campo. */}
      <g stroke={TINTA_FRACA} strokeWidth="0.6" fill="none">
        <line x1={layout.field.x0} y1={layout.field.y + 11} x2={layout.field.x1} y2={layout.field.y + 11} />
        <line x1={layout.field.x0} y1={layout.field.y + 8} x2={layout.field.x0} y2={layout.field.y + 14} />
        <line x1={layout.field.x1} y1={layout.field.y + 8} x2={layout.field.x1} y2={layout.field.y + 14} />
      </g>

      {/* Identidade fixa por propriedade: o elemento que diz de que sítio é este croqui. */}
      {propertyKey === 'sitio-horizonte' && (
        <g stroke={TINTA_FRACA} strokeWidth="0.8" fill="none">
          <rect x={layout.field.x0 - 8} y={layout.field.y - 22} width={layout.field.x1 - layout.field.x0 + 16} height="26" />
        </g>
      )}

      {propertyKey === 'boa-esperanca' && (
        <g stroke={TINTA} strokeWidth="1.2" fill="none">
          <line x1={layout.field.x0 - 6} y1={layout.field.y} x2={layout.field.x0 - 6} y2={layout.field.y - 10} />
          <line x1={layout.field.x1 + 6} y1={layout.field.y} x2={layout.field.x1 + 6} y2={layout.field.y - 10} />
          <line x1={layout.field.x0 - 6} y1={layout.field.y - 10} x2={layout.field.x1 + 6} y2={layout.field.y - 10} strokeDasharray="3 3" />
        </g>
      )}

      {propertyKey === 'riacho-verde' && (
        <g transform={`translate(${(layout.field.x0 + layout.field.x1) / 2 + 30}, ${layout.field.y + 8})`} fill="none" stroke={TINTA} strokeWidth="1.1">
          <rect x={-16} y={-10} width="26" height="10" fill={PAPEL} />
          <rect x={-10} y={-18} width="12" height="9" fill={PAPEL} />
          <circle cx={-11} cy={0} r="3.4" fill={PAPEL} />
          <circle cx={6} cy={0} r="3.4" fill={PAPEL} />
          <line x1={10} y1={-10} x2={16} y2={-16} />
        </g>
      )}

      {propertyKey === 'cerrado-vivo' && (
        <g fill="none" stroke={LAPIS_AGUA} strokeWidth="1.2">
          <path d={`M${layout.reservoir.x + 4} ${layout.reservoir.y - basinH - 10} q4 6 0 10`} />
          <line x1={layout.reservoir.x + 4} y1={layout.reservoir.y - basinH} x2={layout.reservoir.x + 4} y2={layout.reservoir.y - basinH - 10} />
        </g>
      )}

      {propertyKey === 'nova-safra' && (
        <g transform={`translate(${layout.field.x1 + 34}, ${layout.field.y - 4})`} fill="none" stroke={TINTA} strokeWidth="1.1">
          <path d="M-14 0 L-14 -14 L14 -14 L14 0" stroke={TINTA_FRACA} strokeDasharray="3 2" />
          <polygon points="-8,-14 0,-22 8,-14" fill={`url(#${uid}-cruzada)`} />
          <rect x={-8} y={-14} width="16" height="12" fill={PAPEL} />
          <path d="M-7 4 q3 -3 6 0 M2 5 q3 -3 6 0" stroke={TINTA_FRACA} strokeWidth="0.9" />
        </g>
      )}

      {propertyKey === 'planalto-familiar' && (
        <g fill="none" stroke={TINTA} strokeWidth="1.2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={98 + i * 14} y1={198} x2={98 + i * 14} y2={182} />
          ))}
          <line x1="98" y1="188" x2="168" y2="188" />
          <ellipse cx="126" cy="200" rx="12" ry="7" fill={PAPEL} />
          <ellipse cx="152" cy="202" rx="10" ry="6" fill={PAPEL} />
          <rect x={230} y={166} width="14" height="16" fill={PAPEL} stroke={LAPIS_MAQUINA} />
          <line x1="230" y1="172" x2="244" y2="172" stroke={LAPIS_MAQUINA} strokeWidth="0.8" />
        </g>
      )}

      {/* Mata nativa: o número de copas cresce com a sustentabilidade. */}
      <g className="sfr-copa">
        {treesVisiveis.map((spot, i) => (
          <use key={i} href={`#${uid}-arvore`} x={spot.x - 13} y={spot.y - 29} width="26" height="30" />
        ))}
      </g>

      {/* Cobertura de solo: rachadura ou palhada, nunca as duas ao mesmo tempo. */}
      <g>
        {soloVisivel.map((spot, i) => (
          <use
            key={i}
            href={soloExposto ? `#${uid}-solo-exposto` : `#${uid}-solo-coberto`}
            x={spot.x - 7}
            y={spot.y - 3}
            width="14"
            height="6"
          />
        ))}
      </g>

      {/* Equipamentos: cada patamar de tecnologia soma um item, nada é removido ao subir. */}
      {temIrrigacao && (
        <g stroke={LAPIS_MAQUINA} strokeWidth="0.9" fill="none">
          <line x1={layout.field.x0} y1={layout.field.y + 6} x2={layout.field.x1} y2={layout.field.y + 6} strokeDasharray="5 2" />
          {[0.15, 0.4, 0.65, 0.9].map((f, i) => (
            <use
              key={i}
              href={`#${uid}-gota`}
              x={layout.field.x0 + (layout.field.x1 - layout.field.x0) * f - 3}
              y={layout.field.y + 3}
              width="6"
              height="6"
            />
          ))}
        </g>
      )}

      {temSolar && (
        <g transform={`translate(${layout.shed.x - 10}, ${layout.shed.y - 26})`} fill="none" stroke={LAPIS_MAQUINA} strokeWidth="1">
          <rect x="0" y="0" width="20" height="10" fill={PAPEL} />
          <line x1="0" y1="5" x2="20" y2="5" strokeWidth="0.6" />
          <line x1="7" y1="0" x2="7" y2="10" strokeWidth="0.6" />
          <line x1="14" y1="0" x2="14" y2="10" strokeWidth="0.6" />
        </g>
      )}

      {temSensor && (
        <g stroke={LAPIS_MAQUINA} strokeWidth="1.2" fill="none">
          <line x1={layout.field.x1 + 12} y1={layout.field.y + 8} x2={layout.field.x1 + 12} y2={layout.field.y - 12} />
          <circle cx={layout.field.x1 + 12} cy={layout.field.y - 14} r="2.6" fill={LAPIS_MAQUINA} stroke="none" />
        </g>
      )}

      {temAntena && (
        <g stroke={TINTA} strokeWidth="1" fill="none">
          <line x1={layout.house.x + 16} y1={layout.house.y - 24} x2={layout.house.x + 16} y2={layout.house.y - 40} />
          <line x1={layout.house.x + 16} y1={layout.house.y - 36} x2={layout.house.x + 22} y2={layout.house.y - 40} />
          <line x1={layout.house.x + 16} y1={layout.house.y - 32} x2={layout.house.x + 21} y2={layout.house.y - 35} />
        </g>
      )}

      {temEstufa && (
        <g transform={`translate(${layout.shed.x + 34}, ${layout.shed.y - 2})`} fill="none" stroke={TINTA} strokeWidth="1">
          <rect x="0" y="-14" width="30" height="14" fill={PAPEL} />
          <line x1="0" y1="-14" x2="30" y2="0" strokeWidth="0.5" opacity="0.6" />
          <line x1="10" y1="-14" x2="30" y2="-6" strokeWidth="0.5" opacity="0.6" />
          <line x1="0" y1="-6" x2="20" y2="0" strokeWidth="0.5" opacity="0.6" />
        </g>
      )}
    </svg>
  );
}
