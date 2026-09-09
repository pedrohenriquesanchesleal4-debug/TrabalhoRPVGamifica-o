import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Manrope, Space_Grotesk } from 'next/font/google';
import './globals.css';

/*
  Três famílias, três funções. Nenhuma repete as duas direções visuais
  rejeitadas, e nenhuma é a fonte padrão de projeto gerado por IA.

  Space Grotesk é geométrica com personalidade de instrumento de campo: onde
  uma serifada falaria "reportagem", ela fala "painel". Carrega só título.

  Manrope é humanista de x-height alta: lê bem em 0.875rem na tela de celular,
  que é onde 30 dos 31 usuários de uma partida estão.

  JetBrains Mono carrega todo número, com tabular ligado e ligadura desligada.

  Só os pesos usados, subconjunto latino, autoexpedidas no build pelo
  next/font: nenhuma requisição a servidor de fonte em tempo de execução, o
  que importa numa sala de aula com rede ruim e 30 celulares.
*/

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
  variable: '--font-grotesk',
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
  themeColor: '#eef6f4',
  width: 'device-width',
  initialScale: 1,
  // O aluno joga no celular com uma mão: zoom liberado é acessibilidade.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${grotesk.variable} ${manrope.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
