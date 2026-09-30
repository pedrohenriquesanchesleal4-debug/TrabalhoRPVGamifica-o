/**
 * Auditoria direcionada dos componentes críticos no fluxo real de jogo.
 * Usa o mesmo fluxo do browser-check para criar partida real e medir.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = 'http://localhost:3000';
const SHOTS = 'screenshots/audit-game';
const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 640, deviceScaleFactor: 3 },
  { name: 'mobile-390', width: 390, height: 844, deviceScaleFactor: 3 },
];

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // Cria uma partida real primeiro (como no browser-check)
  console.log('Criando partida real...');
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hostPage = await hostContext.newPage();
  await hostPage.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await hostPage.getByRole('button', { name: /criar partida/i }).first().click();
  const codeLocator = hostPage.getByTestId('game-code');
  await codeLocator.waitFor({ timeout: 30000 });
  const code = (await codeLocator.innerText()).replace(/\s+/g, '').toUpperCase();
  console.log(`Código: ${code}`);

  const gameId = (await hostPage.locator('a[href*="/host/"]').first().getAttribute('href'))?.split('/host/')[1]?.split('/')[0];
  console.log(`Game ID: ${gameId}`);

  // Entra 2 alunos para ter uma equipe com 2 pessoas
  const students = [];
  for (const name of ['Ana', 'Bruno']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
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
    await nameField.pressSequentially(name, { delay: 15 });
    await page.getByRole('button', { name: /^entrar$/i }).first().click();
    await page.getByText(/sua propriedade|sua função|aguardando o professor/i).first().waitFor({ timeout: 40000 });
    students.push({ name, page, context });
  }

  console.log('Alunos entrados. Iniciando rodada...');
  await hostPage.getByRole('button', { name: /iniciar rodada/i }).first().click();

  // Pula abertura se aparecer
  const skip = students[0].page.getByRole('button', { name: /pular|seguir para a partida/i });
  await skip.first().waitFor({ timeout: 12000 }).catch(() => {});
  await skip.first().click().catch(() => {});

  // Espera opções aparecerem
  const optionButtons = students[0].page.locator('button[aria-pressed]');
  await optionButtons.first().waitFor({ timeout: 45000 });

  console.log('Rodada aberta. Medindo componentes...');

  // Agora mede em cada viewport
  for (const vp of VIEWPORTS) {
    console.log(`\n=== Medindo @ ${vp.name} (${vp.width}x${vp.height}) ===`);
    
    // Reusa a página do primeiro aluno, mas redimensiona
    const page = students[0].page;
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);

    const metrics = await measureGameComponents(page, vp);
    console.log(`  EventCard: narrativeHeight=${metrics.eventCard.narrativeHeight}px, optionsCount=${metrics.eventCard.optionsCount}`);
    console.log(`  Decision button: ${metrics.decisionButton.width}x${metrics.decisionButton.height}px, bottom=${metrics.decisionButton.distanceFromBottom}px from bottom`);
    console.log(`  Timer: ${metrics.timer.width}x${metrics.timer.height}px, visible=${metrics.timer.visible}`);
    console.log(`  PropertyScene SVG: ${metrics.propertyScene.width}x${metrics.propertyScene.height}px`);
    console.log(`  CerradoLandscape SVG: ${metrics.cerradoLandscape.width}x${metrics.cerradoLandscape.height}px`);
    console.log(`  OpeningSequence (if present): ${metrics.openingSequence.present ? 'yes' : 'no'}`);
    console.log(`  Horizontal overflow: ${metrics.overflow ? 'YES ⚠' : 'no'}`);
    console.log(`  Safe-area bottom: ${metrics.safeAreaBottom}px`);

    await page.screenshot({ path: `${SHOTS}/game-${vp.name}.png`, fullPage: true });
  }

  // Testa OpeningSequence em viewport menor (recarrega a página para disparar abertura)
  console.log('\n=== Testando OpeningSequence @ mobile-360 ===');
  const openingContext = await browser.newContext({
    viewport: { width: 360, height: 640 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const openingPage = await openingContext.newPage();
  await openingPage.goto(`${BASE}/entrar`, { waitUntil: 'domcontentloaded' });
  const codeField = openingPage.getByLabel(/código/i);
  await codeField.click();
  await codeField.pressSequentially(code, { delay: 25 });
  await openingPage.getByRole('button', { name: /entrar na fazenda/i }).click();
  await openingPage.getByText(/qual propriedade sua equipe vai tocar/i).first().waitFor({ timeout: 20000 });
  await openingPage.getByRole('radio', { name: /sítio|cerrado|esperança|riacho|safra|planalto/i }).first().click();
  await openingPage.getByRole('radiogroup', { name: /função na propriedade/i }).locator('button[role="radio"]:not([disabled])').first().click();
  await openingPage.getByRole('button', { name: /entrar na propriedade/i }).click();
  const nameField = openingPage.getByLabel(/nome/i);
  await nameField.click();
  await nameField.pressSequentially('Carlos', { delay: 15 });
  await openingPage.getByRole('button', { name: /^entrar$/i }).first().click();
  await openingPage.getByText(/sua propriedade|sua função|aguardando o professor/i).first().waitFor({ timeout: 40000 });
  
  // Aguarda abertura aparecer (localStorage key não existe para este jogador novo)
  const openingSkip = openingPage.getByRole('button', { name: /pular|seguir para a partida/i });
  const openingShowed = await openingSkip.first().waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
  
  if (openingShowed) {
    await openingPage.waitForTimeout(300);
    const openingMetrics = await measureOpeningSequence(openingPage);
    console.log(`  OpeningSequence: fullScreen=${openingMetrics.fullScreen}, skipButton=${openingMetrics.skipButton.width}x${openingMetrics.skipButton.height}px`);
    console.log(`  Layers visible: ${openingMetrics.layersVisible}`);
    await openingPage.screenshot({ path: `${SHOTS}/opening-360.png`, fullPage: true });
  } else {
    console.log('  OpeningSequence não apareceu (já visto ou erro)');
  }

  await openingContext.close();

  // Limpa
  for (const s of students) await s.context.close();
  await hostContext.close();
  await browser.close();

  console.log('\n✅ Auditoria de componentes de jogo concluída');
}

async function measureGameComponents(page, vp) {
  // Mede EventCard
  const eventCard = await page.evaluate(() => {
    const cards = document.querySelectorAll('.degrau.terraco');
    // O EventCard é o primeiro .degrau.terraco que tem botões com aria-pressed
    let card = null;
    let narrative = null;
    for (const c of cards) {
      if (c.querySelector('button[aria-pressed]')) {
        card = c;
        narrative = c.querySelector('p.text-base, h2 + p');
        break;
      }
    }
    const options = document.querySelectorAll('button[aria-pressed]');
    const confirmBtn = document.querySelector('button.degrau.mirante[type="button"]');
    
    return {
      narrativeHeight: narrative ? Math.round(narrative.getBoundingClientRect().height) : 0,
      optionsCount: options.length,
      cardHeight: card ? Math.round(card.getBoundingClientRect().height) : 0,
    };
  });

  // Mede botão de decisão
  const decisionButton = await page.evaluate(() => {
    const btn = document.querySelector('button.degrau.mirante[type="button"]');
    if (!btn) return { width: 0, height: 0, distanceFromBottom: 0 };
    const rect = btn.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      distanceFromBottom: Math.round(window.innerHeight - rect.bottom),
    };
  });

  // Mede timer
  const timer = await page.evaluate(() => {
    const timerEl = document.querySelector('[role="timer"]');
    if (!timerEl) return { width: 0, height: 0, visible: false };
    const rect = timerEl.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      visible: rect.width > 0 && rect.height > 0,
    };
  });

  // Mede PropertyScene SVG
  const propertyScene = await page.evaluate(() => {
    const svg = document.querySelector('svg[viewBox="0 0 200 200"]') || document.querySelector('svg[viewBox*="200"]');
    if (!svg) return { width: 0, height: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      viewBox: svg.getAttribute('viewBox'),
      preserveAspectRatio: svg.getAttribute('preserveAspectRatio'),
    };
  });

  // Mede CerradoLandscape SVG
  const cerradoLandscape = await page.evaluate(() => {
    const svg = document.querySelector('svg[viewBox*="1440"]');
    if (!svg) return { width: 0, height: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      viewBox: svg.getAttribute('viewBox'),
      preserveAspectRatio: svg.getAttribute('preserveAspectRatio'),
    };
  });

  // OpeningSequence
  const openingSequence = await page.evaluate(() => {
    const overlay = document.querySelector('.fixed.inset-0.z-50') || document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!overlay) return { present: false };
    const rect = overlay.getBoundingClientRect();
    return {
      present: true,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });

  // Overflow horizontal
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });

  // Safe-area
  const safeAreaBottom = await page.evaluate(() => {
    const style = window.getComputedStyle(document.body);
    return parseFloat(style.paddingBottom) || 0;
  });

  return {
    eventCard,
    decisionButton,
    timer,
    propertyScene,
    cerradoLandscape,
    openingSequence,
    overflow,
    safeAreaBottom,
  };
}

async function measureOpeningSequence(page) {
  const metrics = await page.evaluate(() => {
    const overlay = document.querySelector('.fixed.inset-0.z-50') || document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!overlay) return { fullScreen: false };
    const rect = overlay.getBoundingClientRect();
    const layers = overlay.querySelectorAll('p');
    const skipBtn = overlay.querySelector('button');
    return {
      fullScreen: rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.95,
      layersVisible: layers.length,
      skipButton: skipBtn ? {
        width: Math.round(skipBtn.getBoundingClientRect().width),
        height: Math.round(skipBtn.getBoundingClientRect().height),
      } : { width: 0, height: 0 },
    };
  });
  return metrics;
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});