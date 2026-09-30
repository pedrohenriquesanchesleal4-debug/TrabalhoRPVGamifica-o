import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ 
  viewport: { width: 320, height: 568 }, 
  isMobile: true, 
  hasTouch: true, 
  deviceScaleFactor: 2 
});
const page = await context.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const metrics = await page.evaluate(() => {
  const psSvg = document.querySelector('svg[viewBox="0 0 200 200"]');
  let ps = { w: 0, h: 0 };
  if (psSvg) { const r = psSvg.getBoundingClientRect(); ps = { w: Math.round(r.width), h: Math.round(r.height) }; }
  const links = Array.from(document.querySelectorAll('a[href]')).map(a => {
    const r = a.getBoundingClientRect();
    return { text: a.innerText.slice(0,30), w: Math.round(r.width), h: Math.round(r.height) };
  });
  return { ps, links };
});
console.log('PropertyScene at 320px:', metrics.ps);
console.log('Links < 44px height:', metrics.links.filter(l => l.h < 44));
await browser.close();