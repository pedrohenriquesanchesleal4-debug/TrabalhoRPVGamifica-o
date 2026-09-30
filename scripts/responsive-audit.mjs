/**
 * Auditoria de responsividade direcionada nas viewports alvo.
 * Mede: transbordo horizontal, altura efetiva, alvos de toque, safe-area, orientação, densidade.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = 'http://localhost:3000';
const SHOTS = 'screenshots/audit';
const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 640, deviceScaleFactor: 3 },
  { name: 'mobile-390', width: 390, height: 844, deviceScaleFactor: 3 },
  { name: 'tablet-768', width: 768, height: 1024, deviceScaleFactor: 2 },
];

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768,
      deviceScaleFactor: vp.deviceScaleFactor,
    });
    const page = await context.newPage();

    // Coleta erros de console
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !/failed to load resource|eval\(\)/i.test(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });

    // ---- 1. /entrar (primeira tela do aluno) ----
    console.log('  Testando /entrar...');
    await page.goto(`${BASE}/entrar`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    const entrarMetrics = await measurePage(page, 'entrar');
    results.push({ page: '/entrar', viewport: vp.name, ...entrarMetrics });
    await page.screenshot({ path: `${SHOTS}/entrar-${vp.name}.png`, fullPage: true });

    // ---- 2. /jogar (precisa de partida real - vamos medir o que der) ----
    // Não dá para testar sem Supabase real, mas podemos ver o estado vazio
    console.log('  Testando /jogar (estado vazio)...');
    await page.goto(`${BASE}/jogar`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    const jogarMetrics = await measurePage(page, 'jogar');
    results.push({ page: '/jogar', viewport: vp.name, ...jogarMetrics });
    await page.screenshot({ path: `${SHOTS}/jogar-${vp.name}.png`, fullPage: true });

    // ---- 3. / (home) - tem OpeningSequence / CerradoLandscape ----
    console.log('  Testando / (home)...');
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    const homeMetrics = await measurePage(page, 'home');
    results.push({ page: '/', viewport: vp.name, ...homeMetrics });
    await page.screenshot({ path: `${SHOTS}/home-${vp.name}.png`, fullPage: true });

    await context.close();

    if (consoleErrors.length) {
      console.log(`  Console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
    }
  }

  await browser.close();

  // Relatório
  console.log('\n' + '='.repeat(60));
  console.log('RELATÓRIO DE RESPONSIVIDADE');
  console.log('='.repeat(60));

  for (const r of results) {
    console.log(`\n${r.page} @ ${r.viewport}:`);
    console.log(`  Scroll width: ${r.scrollWidth}px (viewport: ${r.viewportWidth}px) ${r.scrollWidth > r.viewportWidth ? '⚠ TRANSBORDO' : 'OK'}`);
    console.log(`  Body height: ${r.bodyHeight}px (viewport: ${r.viewportHeight}px)`);
    console.log(`  Touch targets < 44px: ${r.smallTouchTargets.length}`);
    if (r.smallTouchTargets.length) {
      for (const t of r.smallTouchTargets.slice(0, 5)) {
        console.log(`    - ${t.selector}: ${t.width}x${t.height}px`);
      }
    }
    console.log(`  Safe-area bottom padding: ${r.safeAreaBottom}px`);
    console.log(`  Fixed elements near edges: ${r.fixedNearEdges.length}`);
    for (const f of r.fixedNearEdges.slice(0, 3)) {
      console.log(`    - ${f.selector}: bottom=${f.bottom}px right=${f.right}px`);
    }
  }

  // Salva JSON
  await import('node:fs/promises').then(fs => fs.writeFile(`${SHOTS}/audit-results.json`, JSON.stringify(results, null, 2)));
  console.log(`\nDetalhes salvos em ${SHOTS}/audit-results.json`);
}

async function measurePage(page, pageName) {
  const viewport = page.viewportSize();

  // 1. Transbordo horizontal
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

  // 2. Altura do body vs viewport
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);

  // 3. Alvos de toque < 44px (elementos clicáveis: button, a[href], [role=button], input, select, textarea)
  const smallTouchTargets = await page.evaluate(() => {
    const clickableSelector = 'button:not([disabled]), a[href], [role="button"]:not([aria-disabled="true"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
    const elements = Array.from(document.querySelectorAll(clickableSelector));
    return elements
      .map(el => {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        const isDecorative = el.hasAttribute('aria-hidden') && el.getAttribute('aria-hidden') === 'true';
        // Ignora elementos puramente decorativos
        if (isDecorative) return null;
        // Ignora elementos com display:none ou visibility:hidden
        if (styles.display === 'none' || styles.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return null;
        const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
        return {
          selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls.split(' ')[0] : ''),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          minDimension: Math.round(Math.min(rect.width, rect.height)),
          tagName: el.tagName,
          classes: cls,
        };
      })
      .filter(t => t && t.minDimension < 44)
      .sort((a, b) => a.minDimension - b.minDimension);
  });

  // 4. Safe-area inset bottom (padding efetivo no body)
  const safeAreaBottom = await page.evaluate(() => {
    const style = window.getComputedStyle(document.body);
    return parseFloat(style.paddingBottom) || 0;
  });

  // 5. Elementos fixos/absolutos próximos às bordas (notch/barra de gestos)
  const fixedNearEdges = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    return elements
      .filter(el => {
        const styles = window.getComputedStyle(el);
        return styles.position === 'fixed' || styles.position === 'absolute' || styles.position === 'sticky';
      })
      .map(el => {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
        return {
          selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls.split(' ')[0] : ''),
          position: styles.position,
          top: Math.round(rect.top),
          bottom: Math.round(viewport.height - rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(viewport.width - rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter(el => el.bottom < 20 || el.top < 20 || el.left < 10 || el.right < 10)
      .sort((a, b) => a.bottom - b.bottom);
  });

  // 6. Para PropertyScene/CerradoLandscape: medir SVG rendered size
  let svgMetrics = {};
  if (pageName === 'home' || pageName === 'jogar') {
    svgMetrics = await page.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll('svg[viewBox]'));
      return svgs.map(svg => {
        const rect = svg.getBoundingClientRect();
        const vb = svg.getAttribute('viewBox')?.split(' ').map(Number) || [];
        return {
          renderedWidth: Math.round(rect.width),
          renderedHeight: Math.round(rect.height),
          viewBox: vb.join(' '),
          preserveAspectRatio: svg.getAttribute('preserveAspectRatio'),
        };
      });
    });
  }

  return {
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    scrollWidth,
    clientWidth,
    bodyHeight,
    viewportHeight,
    smallTouchTargets,
    safeAreaBottom,
    fixedNearEdges,
    svgMetrics,
  };
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});