import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const check = (label, ok, detail = '') =>
  console.log(`  ${ok ? 'ok' : 'FALHA'}  ${label}${detail ? ` · ${detail}` : ''}`);

const b = await chromium.launch({ headless: true });

// 1. Professor cria partida MODO OFICINA
console.log('1. Cria oficina em /admin');
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
check('gameId capturado', Boolean(gameId), gameId);

// 2. Backend ainda expõe a partida antes da exclusão
const antes = await fetch(`${BASE}/api/oficina/${gameId}/projecao`).then((r) => r.status);
check('partida visível antes de excluir', antes === 200, `status ${antes}`);

// 3. Exclui a oficina pela UI
console.log('2. Exclui a oficina');
await hostPage.getByRole('button', { name: /excluir partida/i }).first().click();
await hostPage.getByText(/não dá para desfazer/i).first().waitFor({ timeout: 10000 });
await hostPage.getByRole('button', { name: /sim, excluir/i }).click();
try {
  await hostPage.getByText(/criar uma nova partida/i).first().waitFor({ timeout: 20000 });
  check('voltou para a tela de criação', true);
} catch {
  const corpo = await hostPage.innerText('body').then((t) => t.slice(0, 220).replace(/\n+/g, ' '));
  check('voltou para a tela de criação', false, corpo);
}

// 4. Backend reflete a exclusão
console.log('3. Backend reflete a exclusão');
const depois = await fetch(`${BASE}/api/oficina/${gameId}/projecao`).then((r) => r.status);
check('partida some do backend após excluir', depois === 404, `status ${depois}`);

await host.close();

// 5. Mesmo fluxo no modo Diagnóstico (ControlPanel)
console.log('\n4. Exclui partida no modo Diagnóstico');
const host2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
const hostPage2 = await host2.newPage();
await hostPage2.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await hostPage2.getByRole('button', { name: /criar partida/i }).first().click();
await hostPage2.getByText(/código/i).first().waitFor({ timeout: 30000 });
const code2 = await hostPage2.locator('[data-testid="game-code"]').innerText().catch(() => '');
check('partida diagnóstico criada', /^[ABCDEFGHJKLMNPQRTUVWXYZ2346789]{5}$/.test(code2.trim()), code2.trim());
await hostPage2.getByRole('button', { name: /excluir partida/i }).first().click();
await hostPage2.getByText(/não dá para desfazer/i).first().waitFor({ timeout: 10000 }).catch(() => {});
await hostPage2.getByRole('button', { name: /sim, excluir/i }).click();
await hostPage2.getByText(/criar uma nova partida/i).first().waitFor({ timeout: 20000 });
check('diagnóstico: voltou para a tela de criação', true);

await b.close();
console.log('\nPROBE EXCLUIR FINALIZADO.');