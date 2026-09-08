/**
 * Verificação no navegador de verdade.
 *
 * O teste de fumaça (`npm run smoke`) prova que a API e o banco estão certos.
 * Este script prova a outra metade: que as telas RENDERIZAM com dados reais,
 * que o aluno consegue decidir clicando e que o professor vê a decisão chegar.
 *
 * Abre três abas ao mesmo tempo: o painel do professor, a projeção e o celular
 * de um aluno (viewport de telefone). Joga uma rodada de ponta a ponta pela
 * interface, sem tocar na API diretamente, e grava capturas de tela.
 *
 * Uso:
 *   npm run dev                          (em outro terminal)
 *   npm run browser-check
 *   npm run browser-check -- --headed    (para assistir acontecendo)
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const args = new Set(process.argv.slice(2));
const HEADED = args.has('--headed');
const BASE = 'http://localhost:3000';
const SHOTS = 'screenshots';

let failures = 0;

function check(label, condition, detail = '') {
  console.log(`  ${condition ? 'ok  ' : 'FALHA'} ${label}${detail ? ` · ${detail}` : ''}`);
  if (!condition) failures += 1;
  return condition;
}

async function main() {
  await mkdir(SHOTS, { recursive: true });

  const browser = await chromium.launch({ headless: !HEADED });
  const errors = [];

  // Qualquer exceção no cliente ou erro de console vira falha: tela branca no
  // meio da aula é o pior defeito possível neste projeto.
  const watch = (page, label) => {
    page.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${label} (console): ${message.text()}`);
    });
  };

  console.log('SAFRA DF · verificação no navegador');

  // -----------------------------------------------------------------------
  console.log('\n1. Professor cria a partida em /admin');
  const host = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hostPage = await host.newPage();
  watch(hostPage, 'admin');

  await hostPage.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await hostPage.getByRole('button', { name: /criar partida/i }).first().click();

  const codeLocator = hostPage.getByTestId('game-code');
  await codeLocator.waitFor({ timeout: 30000 });

  // O código é exibido com espaçamento de letra para leitura a distância, então
  // o texto renderizado pode trazer espaço entre os caracteres.
  const code = (await codeLocator.innerText()).replace(/\s+/g, '').toUpperCase();
  check(
    'código da partida apareceu na tela',
    /^[ABCDEFGHJKLMNPQRTUVWXYZ2346789]{5}$/.test(code),
    code || 'não encontrado',
  );
  await hostPage.screenshot({ path: `${SHOTS}/1-admin-lobby.png`, fullPage: true });

  const url = hostPage.url();
  const gameId =
    (await hostPage.locator('a[href*="/host/"]').first().getAttribute('href'))?.split('/host/')[1]?.split('/')[0] ??
    url.split('/host/')[1]?.split('/')[0] ??
    null;
  check('link da projeção disponível ao professor', Boolean(gameId), gameId ?? 'não encontrado');

  // -----------------------------------------------------------------------
  console.log('\n2. Cinco alunos entram pelo celular');
  const students = [];
  /*
   * Doze alunos, não cinco.
   *
   * A distribuição preenche a equipe mais vazia, então com 6 equipes e 5 alunos
   * cada um ficaria sozinho no seu grupo e não haveria colega para provar a
   * propagação por realtime dentro da equipe. Com 12, cada equipe tem dois.
   */
  const roster = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio',
                  'Gabi', 'Hugo', 'Ivo', 'Joana', 'Kaio', 'Lia'];

  for (const name of roster) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    const page = await context.newPage();
    watch(page, `aluno ${name}`);

    process.stdout.write(`    ${name} ... `);

    await page.goto(`${BASE}/entrar`, { waitUntil: 'domcontentloaded' });
    /*
     * Digita caractere por caractere, em vez de `fill`.
     *
     * O campo de código é controlado e filtra a entrada, então preencher de
     * uma vez pode disparar o submit antes do React registrar o valor: o
     * formulário then reclama de "código com menos de 4 caracteres" com o campo
     * visualmente preenchido. Digitar reproduz o aluno de verdade e elimina a
     * corrida.
     */
    const codeField = page.getByLabel(/código/i);
    await codeField.click();
    await codeField.pressSequentially(code, { delay: 25 });
    await page.waitForFunction(
      (expected) => {
        const input = document.querySelector('input');
        return input instanceof HTMLInputElement && input.value.toUpperCase() === expected;
      },
      code,
      { timeout: 10000 },
    );

    const nameField = page.getByLabel(/nome/i);
    await nameField.click();
    await nameField.pressSequentially(name, { delay: 15 });

    await page.getByRole('button', { name: /^entrar$/i }).first().click();
    // Espera por CONTEÚDO da tela de jogo, não por evento de navegação:
    // a transição é client-side e não dispara load, e o que importa mesmo é
    // que o aluno esteja vendo a propriedade dele.
    await page
      .getByText(/sua propriedade|sua função|aguardando o professor/i)
      .first()
      .waitFor({ timeout: 40000 })
      .catch(async (error) => {
        console.log('FALHOU');
        console.log(`      caminho: ${await page.evaluate(() => window.location.pathname)}`);
        console.log(
          `      tela: ${(await page.innerText('body')).slice(0, 300).replace(/\n+/g, ' | ')}`,
        );
        throw error;
      });

    const propertyName = await page
      .locator('h1, h2')
      .first()
      .innerText()
      .catch(() => '');

    console.log(`entrou (${propertyName.trim() || 'equipe'})`);
    students.push({ name, page, context, propertyName: propertyName.trim() });
  }

  const first = students[0];
  await first.page.waitForFunction(
    () => !document.body.innerText.toLowerCase().includes('carregando'),
    { timeout: 30000 },
  );

  const lobbyText = await first.page.innerText('body');
  check('aluno vê o nome da propriedade da equipe', /sítio|cerrado|esperança|riacho|safra|planalto/i.test(lobbyText));
  check('aluno vê a própria função', /produtor|financeiro|tecnologia|comercialização|políticas/i.test(lobbyText));
  check('aluno vê o orçamento inicial', /80\.000|80000/.test(lobbyText));
  await first.page.screenshot({ path: `${SHOTS}/2-aluno-lobby.png`, fullPage: true });

  // -----------------------------------------------------------------------
  console.log('\n3. Professor abre a rodada 1');
  await hostPage.getByRole('button', { name: /iniciar rodada/i }).first().click();

  // A abertura aparece uma vez: se estiver na tela, pula para chegar na carta.
  const skip = first.page.getByRole('button', { name: /pular|seguir para a partida/i });
  const openingShowed = await skip
    .first()
    .waitFor({ timeout: 12000 })
    .then(() => true)
    .catch(() => false);

  if (openingShowed) {
    await first.page.screenshot({ path: `${SHOTS}/3-abertura.png` });
    await skip.first().click();
  }
  check('abertura da rodada 1 apareceu', openingShowed);

  /*
   * A prova de que o realtime chega ao NAVEGADOR: sem recarregar nada, os
   * botões de opção precisam aparecer sozinhos depois que o professor abriu a
   * rodada. Por isso a espera é pelo elemento de opção (`aria-pressed`), e não
   * por texto genérico que o lobby também tem.
   */
  const optionButtons = first.page.locator('button[aria-pressed]');
  const gotOptions = await optionButtons
    .first()
    .waitFor({ timeout: 45000 })
    .then(() => true)
    .catch(() => false);

  check('opções apareceram sozinhas, por realtime, sem recarregar', gotOptions);

  const eventText = await first.page.innerText('body');
  check('carta de evento renderizou com narrativa', eventText.length > 600);
  check('opções com custo em reais aparecem', /R\$/.test(eventText));
  check(
    'dica exclusiva da função aparece',
    /só você|apenas você|sua função|informação/i.test(eventText),
    'texto de informação por função',
  );

  const timerText = await first.page.locator('[role="timer"]').first().innerText();
  check('cronômetro contando', /\d:\d\d/.test(timerText) && !timerText.includes('--:--'), timerText.replace(/\n/g, ' '));
  await first.page.screenshot({ path: `${SHOTS}/4-aluno-evento.png`, fullPage: true });

  // -----------------------------------------------------------------------
  console.log('\n4. A equipe decide pela interface');
  const optionCount = await optionButtons.count();
  check('3 a 5 opções oferecidas', optionCount >= 3 && optionCount <= 5, `${optionCount} opções`);

  const enabled = optionButtons.filter({ hasNot: first.page.locator('[disabled]') });
  await optionButtons.first().click();

  const confirm = first.page.getByRole('button', { name: /confirmar/i });
  const needsConfirm = await confirm
    .first()
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check('confirmação em dois toques exigida', needsConfirm, `${await enabled.count()} opções disponíveis`);

  await confirm.first().click();

  // A tela de decisão registrada é o que prova que a confirmação foi aceita
  // pelo servidor e que a equipe não pode mais trocar de escolha.
  const locked = await first.page
    .getByText(/decisão registrada|não é possível mudar/i)
    .first()
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false);

  check('tela mostra decisão registrada e travada', locked);

  const stillHasOptions = await first.page.locator('button[aria-pressed]').count();
  check('opções saíram da tela depois de confirmar', stillHasOptions === 0, `${stillHasOptions} restantes`);
  await first.page.screenshot({ path: `${SHOTS}/5-aluno-decidiu.png`, fullPage: true });

  // Colega da mesma equipe vê o estado mudar por realtime, sem recarregar.
  const teammate = students.find(
    (student) => student !== first && student.propertyName === first.propertyName,
  );
  check('existe colega na mesma equipe para testar a propagação', Boolean(teammate),
    teammate ? `${teammate.name} em ${teammate.propertyName}` : 'nenhum');
  const sawUpdate = await teammate.page
    .waitForFunction(() => /decidiu|aguard|equipe escolheu/i.test(document.body.innerText), {
      timeout: 30000,
    })
    .then(() => true)
    .catch(() => false);
  check('colega recebeu a atualização por realtime, sem recarregar', sawUpdate);

  // -----------------------------------------------------------------------
  console.log('\n5. Projeção mostra a turma');
  const projection = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const projectionPage = await projection.newPage();
  watch(projectionPage, 'projeção');

  await projectionPage.goto(`${BASE}/host/${gameId}`, { waitUntil: 'networkidle' });
  await projectionPage.waitForFunction(
    () => /sítio|cerrado|esperança|riacho|safra|planalto/i.test(document.body.innerText),
    { timeout: 30000 },
  );

  const projectionText = await projectionPage.innerText('body');
  check('projeção lista as 6 equipes', (projectionText.match(/sítio|cerrado|esperança|riacho|nova safra|planalto/gi) ?? []).length >= 6);
  check('projeção não mostra qual opção a equipe escolheu na rodada aberta',
    !/comprar à vista|financiar em parcelas|adiar a decisão/i.test(projectionText));
  await projectionPage.screenshot({ path: `${SHOTS}/6-projecao.png`, fullPage: true });

  // -----------------------------------------------------------------------
  console.log('\n6. Professor resolve a rodada e o aluno vê a consequência');
  await hostPage.getByRole('button', { name: /resolver rodada/i }).first().click();

  const sawResult = await first.page
    .waitForFunction(
      () => /consequ|resultado|aconteceu|escolheu|▲|▼/i.test(document.body.innerText),
      { timeout: 40000 },
    )
    .then(() => true)
    .catch(() => false);

  check('aluno recebeu a tela de consequência por realtime', sawResult);
  await first.page.screenshot({ path: `${SHOTS}/7-aluno-consequencia.png`, fullPage: true });
  await hostPage.screenshot({ path: `${SHOTS}/8-admin-resolvido.png`, fullPage: true });

  // -----------------------------------------------------------------------
  console.log('\n7. Diagnóstico da turma');
  const diagnostic = await projection.newPage();
  watch(diagnostic, 'diagnóstico');
  await diagnostic.goto(`${BASE}/host/${gameId}/diagnostico`, { waitUntil: 'networkidle' });
  await diagnostic.waitForFunction(
    () => /tecnologia|capacita|política/i.test(document.body.innerText),
    { timeout: 30000 },
  );
  const diagnosticText = await diagnostic.innerText('body');
  check('diagnóstico mostra contagem por equipe', /\d\s*de\s*6|\d\/6/.test(diagnosticText));
  check(
    'diagnóstico não emite veredito sobre as equipes',
    !/resposta certa|escolha correta|parab(é|e)ns|voc(ê|e) errou|equipe errou|incorret/i.test(
      diagnosticText,
    ),
  );
  await diagnostic.screenshot({ path: `${SHOTS}/9-diagnostico.png`, fullPage: true });

  // -----------------------------------------------------------------------
  console.log('\n8. Erros de cliente');
  const relevant = errors.filter(
    (message) =>
      !/favicon|Download the React DevTools|preload|hydration text content/i.test(message),
  );
  check('nenhum erro de JavaScript nas telas', relevant.length === 0, relevant.slice(0, 3).join(' | '));

  await browser.close();

  console.log('\n' + '='.repeat(52));
  console.log(failures === 0
    ? `TUDO PASSOU. Capturas de tela em ./${SHOTS}/`
    : `${failures} verificações falharam.`);
  console.log('='.repeat(52));

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nERRO na verificação:', error.message);
  process.exit(1);
});
