/**
 * Auditoria direcionada - mede decisão completa (seleção + confirmação)
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = 'http://localhost:3000';
const SHOTS = 'screenshots/audit-game';

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // Cria partida
  console.log('Criando partida...');
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hostPage = await hostContext.newPage();
  await hostPage.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await hostPage.getByRole('button', { name: /criar partida/i }).first().click();
  const codeLocator = hostPage.getByTestId('game-code');
  await codeLocator.waitFor({ timeout: 30000 });
  const code = (await codeLocator.innerText()).replace(/\s+/g, '').toUpperCase();
  console.log(`Código: ${code}`);

  // Entra 1 aluno
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/entrar`, { waitUntil: 'domcontentloaded' });
  const codeField = page.getByLabel(/código/i);
  await codeField.click();
  await codeField.pressSequentially(code, { delay: 25 });
  await page.getByRole('button', { name: /entrar na fazenda/i }).click();
  await page.getByText(/qual propriedade sua equipe vai tocar/i).first().waitFor({ timeout: 20000 });
  await page.getByRole('radio', { name: /sítio|cerrado|esperança|riacho|safra|planalto/i }).first().click();
  await page.getByRole('radiogroup', { name: /função na propriedade/i }).locator('button[role="radio"]:not([disabled])').first().click();
  await page.getByRole('button', { name: /entrar na propriedade/i }).click();
  const nameField = page.getByLabel(/nome/i);
  await nameField.click();
  await nameField.pressSequentially('Ana', { delay: 15 });
  await page.getByRole('button', { name: /^entrar$/i }).first().click();
  await page.getByText(/sua propriedade|sua função|aguardando o professor/i).first().waitFor({ timeout: 40000 });

  console.log('Aluno entrou. Iniciando rodada...');
  await hostPage.getByRole('button', { name: /iniciar rodada/i }).first().click();

  // Pula abertura
  const skip = page.getByRole('button', { name: /pular|seguir para a partida/i });
  await skip.first().waitFor({ timeout: 12000 }).catch(() => {});
  await skip.first().click().catch(() => {});

  // Espera opções
  const optionButtons = page.locator('button[aria-pressed]');
  await optionButtons.first().waitFor({ timeout: 45000 });

  console.log('=== Estado INICIAL (opções visíveis, nada selecionado) ===');
  await measureState(page, 'inicial');

  console.log('=== Selecionando primeira opção ===');
  await optionButtons.first().click();
  await page.waitForTimeout(300);
  await measureState(page, 'apos-selecao');

  console.log('=== Confirmando decisão ===');
  const confirmBtn = page.getByRole('button', { name: /confirmar decisão/i });
  await confirmBtn.first().waitFor({ timeout: 10000 });
  await measureState(page, 'confirmacao-visivel');

  // Screenshot final
  await page.screenshot({ path: `${SHOTS}/decisao-completa-360.png`, fullPage: true });

  // Testa em 390x844
  console.log('\n=== Redimensionando para 390x844 ===');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await measureState(page, '390x844');
  await page.screenshot({ path: `${SHOTS}/decisao-completa-390.png`, fullPage: true });

  await context.close();
  await hostContext.close();
  await browser.close();
  console.log('\n✅ Concluído');
}

async function measureState(page, label) {
  const metrics = await page.evaluate(() => {
    // EventCard narrative
    const narrative = document.querySelector('.degrau.terraco p.text-base, .degrau.terraco h2 + p');
    const narrativeHeight = narrative ? Math.round(narrative.getBoundingClientRect().height) : 0;
    
    // Opções
    const options = document.querySelectorAll('button[aria-pressed]');
    const optionsCount = options.length;
    let optionHeight = 0;
    if (options[0]) {
      optionHeight = Math.round(options[0].getBoundingClientRect().height);
    }

    // Botão confirmar
    const confirmBtn = document.querySelector('button.degrau.mirante[type="button"]');
    let confirmWidth = 0, confirmHeight = 0, confirmBottom = 0;
    if (confirmBtn) {
      const rect = confirmBtn.getBoundingClientRect();
      confirmWidth = Math.round(rect.width);
      confirmHeight = Math.round(rect.height);
      confirmBottom = Math.round(window.innerHeight - rect.bottom);
    }

    // Timer
    const timerEl = document.querySelector('[role="timer"]');
    let timerWidth = 0, timerHeight = 0;
    if (timerEl) {
      const rect = timerEl.getBoundingClientRect();
      timerWidth = Math.round(rect.width);
      timerHeight = Math.round(rect.height);
    }

    // PropertyScene
    const psSvg = document.querySelector('svg[viewBox="0 0 200 200"]');
    let psWidth = 0, psHeight = 0;
    if (psSvg) {
      const rect = psSvg.getBoundingClientRect();
      psWidth = Math.round(rect.width);
      psHeight = Math.round(rect.height);
    }

    // CerradoLandscape
    const clSvg = document.querySelector('svg[viewBox*="1440"]');
    let clWidth = 0, clHeight = 0;
    if (clSvg) {
      const rect = clSvg.getBoundingClientRect();
      clWidth = Math.round(rect.width);
      clHeight = Math.round(rect.height);
    }

    // Overflow
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;

    // Safe-area
    const safeAreaBottom = parseFloat(window.getComputedStyle(document.body).paddingBottom) || 0;

    // Viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    return {
      narrativeHeight,
      optionsCount,
      optionHeight,
      confirmWidth,
      confirmHeight,
      confirmBottom,
      timerWidth,
      timerHeight,
      psWidth,
      psHeight,
      clWidth,
      clHeight,
      overflow,
      safeAreaBottom,
      vw,
      vh,
    };
  });

  console.log(`  [${label}] viewport: ${metrics.vw}x${metrics.vh}`);
  console.log(`  [${label}] EventCard: narrative=${metrics.narrativeHeight}px, options=${metrics.optionsCount} (h=${metrics.optionHeight}px)`);
  console.log(`  [${label}] Confirmar: ${metrics.confirmWidth}x${metrics.confirmHeight}px, bottom=${metrics.confirmBottom}px`);
  console.log(`  [${label}] Timer: ${metrics.timerWidth}x${metrics.timerHeight}px`);
  console.log(`  [${label}] PropertyScene: ${metrics.psWidth}x${metrics.psHeight}px`);
  console.log(`  [${label}] CerradoLandscape: ${metrics.clWidth}x${metrics.clHeight}px`);
  console.log(`  [${label}] Overflow: ${metrics.overflow ? 'YES ⚠' : 'no'}`);
  console.log(`  [${label}] Safe-area bottom: ${metrics.safeAreaBottom}px`);

  return metrics;
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});