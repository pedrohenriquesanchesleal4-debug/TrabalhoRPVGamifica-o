import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Manrope, Oswald } from 'next/font/google';
import './globals.css';

/*
  Três famílias, três funções. Direção V5 "Painel de Silo": a propriedade
  rural é central de controle industrial, não terraço nem jornal de safra.

  Oswald é condensada de placa de máquina: onde Newsreader (V4) falava
  "manchete lida à luz de lampião", Oswald fala "rótulo gravado em chapa de
  equipamento". Não é Space Grotesk (V3, geométrica larga) nem nenhuma
  serifada das três direções anteriores. Carrega título (`h1`/`h2`/`h3`,
  `.relevo-*`), sempre em caixa alta (ver `text-transform: uppercase` em
  `globals.css`): é o "rótulo de painel", não prosa editorial.

  Manrope é humanista de x-height alta: lê bem em 0.875rem na tela de celular,
  que é onde 30 dos 31 usuários de uma partida estão. Segue de V3/V4: nunca
  foi o problema, só o resto do sistema em volta dela.

  JetBrains Mono carrega todo número e rótulo técnico, com tabular ligado e
  ligadura desligada: já era o instrumento certo para "etiqueta de
  equipamento" antes mesmo da mudança de direção.

  Só os pesos usados, subconjunto latino, autoexpedidas no build pelo
  next/font: nenhuma requisição a servidor de fonte em tempo de execução, o
  que importa numa sala de aula com rede ruim e 30 celulares.
*/

const industrial = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-industrial',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-manrope',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'SAFRA DF · Decisões que Alimentam',
  description:
    'Jogo multiplayer sobre agricultura familiar no Distrito Federal: cada equipe administra uma propriedade e decide sob orçamento limitado.',
  applicationName: 'SAFRA DF',
};

export const viewport: Viewport = {
  // Breu de terra-noite da V6 (amanhecer do Cerrado).
  themeColor: '#0d0f0b',
  width: 'device-width',
  initialScale: 1,
  // O aluno joga no celular com uma mão: zoom liberado é acessibilidade.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${industrial.variable} ${manrope.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {/*
          Tema antes do primeiro paint: lê `localStorage[safra-tema]` e aplica
          `data-tema` no <html> já no HTML servido, sem FOUC. Aplicar no escopo
          do try — um navegador com storage bloqueado não pode quebrar a página.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('safra-tema');if(t==='claro'){document.documentElement.setAttribute('data-tema','claro');}}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
