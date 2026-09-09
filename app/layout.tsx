import type { Metadata, Viewport } from 'next';
import { Fraunces, Public_Sans, Space_Mono } from 'next/font/google';
import './globals.css';

/*
  Três famílias, três funções, nenhuma delas a fonte padrão de projeto gerado
  por IA.

  Fraunces tem eixo ótico variável e peso até 900: é a manchete do boletim, e
  aqui ela é usada em escala grande de verdade (até 140px na projeção), não
  como título discreto de card.

  Public Sans é a grotesca de relatório institucional: rótulo, corpo, botão.

  Space Mono carrega todo número: indicador, cifra, cronômetro, código de
  partida. Monoespaçada tabular é o que impede a coluna de dançar quando o
  realtime atualiza o valor.

  Todas autoexpedidas no build pelo next/font: nenhuma requisição a servidor
  de fonte em tempo de execução, o que importa numa sala com rede ruim.
*/

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'WONK'],
  variable: '--font-fraunces',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-public',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-space',
});

export const metadata: Metadata = {
  title: 'SAFRA DF · Decisões que Alimentam',
  description:
    'Jogo multiplayer sobre agricultura familiar no Distrito Federal: cada equipe administra uma propriedade e decide sob orçamento limitado.',
  applicationName: 'SAFRA DF',
};

export const viewport: Viewport = {
  themeColor: '#f7f2e6',
  width: 'device-width',
  initialScale: 1,
  // O aluno joga no celular com uma mão: zoom liberado é acessibilidade.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${fraunces.variable} ${publicSans.variable} ${spaceMono.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
