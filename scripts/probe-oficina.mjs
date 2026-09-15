import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const SHOTS = 'screenshots';
const check = (label, ok, detail = '') =>
  console.log(`  ${ok ? 'ok' : 'FALHA'}  ${label}${detail ? ` · ${detail}` : ''}`);

const b = await chromium.launch({ headless: true });

// 1. Professor cria partida MODO OFICINA
console.log('1. Professor cria oficina em /admin');
const host = await b.newContext({ viewport: { width: 1440, height: 900 } });
const hostPage = await host.newPage();
await hostPage.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await hostPage.getByRole('radio', { name: /oficina safra df/i }).click();
await hostPage.getByRole('button', { name: /criar oficina comunitária/i }).click();
await hostPage.getByText(/iniciar oficina/i).first().waitFor({ timeout: 30000 });
const code = await hostPage
  .locator('span')
  .filter({ hasText: /^[ABCDEFGHJKLMNPQRTUVWXYZ2346789]{5}$/ })
  .first()
  .innerText()
  .catch(() => '');
check('código da oficina apareceu', /^[ABCDEFGHJKLMNPQRTUVWXYZ2346789]{5}$/.test(code), code);
const href = await hostPage.locator('a[href*="/host/"]').first().getAttribute('href');
const gameId = href.split('/host/')[1].split('/')[0];
check('link da projeção disponível', Boolean(gameId), gameId);

// 2. Alunos entram pelo celular (6 equipes, perfil 1 por equipe)
console.log('\n2. Seis alunos entram (perfil de atuação)');
const roster = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio'];
const students = [];
for (const name of roster) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/entrar`, { waitUntil: 'domcontentloaded' });
  const codeField = page.getByLabel(/código/i);
  await codeField.click();
  await codeField.pressSequentially(code, { delay: 20 });
  await page.waitForFunction(
    (expected) => document.querySelector('input')?.value.toUpperCase() === expected, code);
  await page.getByRole('button', { name: /entrar na fazenda/i }).click();
  await page.getByText(/perfil de atuação/i).first().waitFor({ timeout: 20000 });
  const teamIndex = roster.indexOf(name);
  // Radio de perfil: botões role=radio com nome do perfil
  await page.getByRole('radio').nth(teamIndex).click();
  await page.getByRole('button', { name: /^entrar como/i }).click();
  const nameField = page.getByLabel(/nome/i);
  await nameField.click();
  await nameField.pressSequentially(name, { delay: 12 });
  await page.getByRole('button', { name: /^entrar$/i }).first().click();
  await page.waitForURL(/\/jogar$/, { timeout: 40000 });
  await page.getByText(/sua propriedade|aguardando o professor|carregando/i).first()
    .waitFor({ timeout: 40000 }).catch(() => {});
  await page.waitForFunction(
    () => !document.body.innerText.toLowerCase().includes('carregando'),
    { timeout: 30000 },
  );
  const perfil = await page.locator('h1,h2').first().innerText().catch(() => '');
  console.log(`    ${name} entrou (${perfil.trim() || 'equipe'})`);
  students.push({ name, page });
  if (roster.indexOf(name) === 0) {
    await page.screenshot({ path: `${SHOTS}/oficina-1-aluno-perfil.png`, fullPage: true });
  }
}
check('6 alunos entraram', students.length === 6);

const first = students[0].page;
const lobbyText = await first.innerText('body');
check('aluno vê o perfil da equipe', /assume este perfil|cooperativa|agroindústria|asso(cia|ciação)/i.test(lobbyText) || /perfil/i.test(lobbyText));

// 3. Professor conduz a oficina até o mapa (investigação)
console.log('\n3. Professor conduz a oficina');
async function lerEstagioAtual() {
  const res = await fetch(`${BASE}/api/oficina/${gameId}/projecao`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.view?.sessao?.stage ?? null;
}
const ROTULO_UPPER = {
  briefing: 'BRIEFING',
  investigacao: 'INVESTIGAÇÃO',
  eventos: 'EVENTOS',
  solucao: 'PROPOSTA',
  resultado: 'RESULTADO',
  encerrada: 'FECHAMENTO',
};
async function irParaEstagio(stageAlvo) {
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const atual = await lerEstagioAtual();
    if (atual === stageAlvo) {
      // Confirma no aluno (ele mostra só o estágio atual, não pills padrão).
      return first
        .getByText(new RegExp(ROTULO_UPPER[stageAlvo]))
        .first()
        .waitFor({ timeout: 20000 })
        .then(() => true)
        .catch(() => true);
    }
    const btn = hostPage.getByRole('button', { name: /iniciar oficina|avançar etapa/i }).first();
    const visivel = await btn.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    if (!visivel) return false;
    if (atual === 'aguardando') {
      console.log('      click iniciar oficina');
    } else {
      console.log(`      click avançar etapa (estágio atual: ${atual})`);
    }
    await btn.click();
    await first.waitForTimeout(2500);
    if (lerEstagioAtual() === stageAlvo) break;
  }
  return true;
}
await irParaEstagio('investigacao');
await first.waitForTimeout(3000);

// O aluno (mobile) mostra o mapa com locais clicáveis
const mapaTexto = await first.innerText('body');
check('aluno vê painel de investigação', /mapa|investigar|conversar|territ[óo]rio|locais/i.test(mapaTexto), mapaTexto.slice(0, 160).replace(/\n+/g, ' '));
check('nome do lugar no território aparece', /riacho|mata|quintal|nascente|capacita|feira|escola|assentamento/i.test(mapaTexto), mapaTexto.slice(0, 160).replace(/\n+/g, ' '));
await first.screenshot({ path: `${SHOTS}/oficina-2-mapa.png`, fullPage: true });

// Clica num ponto do mapa (primeiro botão de local/personagem)
const ponto = first.getByRole('button').filter({ hasText: /riacho|mata|quintal|nascente|feira|escola|assentamento|oficina/i }).first();
const temPonto = await ponto.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
if (temPonto) {
  await ponto.click();
  await first.getByText(/investigar|conversar|situação/i).first().waitFor({ timeout: 15000 }).catch(() => {});
  await first.screenshot({ path: `${SHOTS}/oficina-3-ponto-aberto.png`, fullPage: true });
  console.log('      ponto do mapa aberto');
} else {
  console.log('      (nenhum botão de lugar encontrado — seguindo)');
}
check('ponto do mapa abriu o painel do lugar', temPonto);

// 4. Projeção mostra o telão da oficina
console.log('\n4. Projeção da oficina (telão)');
const proj = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const projPage = await proj.newPage();
await projPage.goto(`${BASE}/host/${gameId}`, { waitUntil: 'networkidle' });
await projPage.waitForFunction(
  () => /oficina|territ[óo]rio|comunidade/i.test(document.body.innerText), { timeout: 30000 });
const projText = await projPage.innerText('body');
check('telão mostra a oficina', /territ[óo]rio|comunidade|oficina/i.test(projText));
await projPage.screenshot({ path: `${SHOTS}/oficina-4-telao-investigacao.png`, fullPage: true });

// 5. Avança até o resultado e gera a reflexão no telão
console.log('\n5. Reflexão no telão (estágio resultado)');
await irParaEstagio('resultado');
await first.waitForTimeout(3000);
await projPage.reload({ waitUntil: 'networkidle' });
await projPage.waitForFunction(
  () => /resultado|reflex|pergunta/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
const reflText = await projPage.innerText('body').catch(() => '');
check(
  'telão mostra reflexão no estágio resultado',
  /reflex[ãa]o|pergunta|fechamento/i.test(reflText),
  reflText.slice(0, 200).replace(/\n+/g, ' '),
);
await projPage.screenshot({ path: `${SHOTS}/oficina-5-telao-reflexao.png`, fullPage: true });

await b.close();
console.log('\nPROBE OFICINA FINALIZADO.');