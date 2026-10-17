// Run during image build: prove Chromium launches and software WebGL2 works.
const assert = require('node:assert/strict');
const { chromium } = require('/opt/carthage-browser/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: [
    '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  ] });
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (!gl) return null;
      gl.clearColor(1, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const pixel = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [...pixel];
    });
    assert.deepEqual(result, [255, 0, 0, 255], 'Chromium must support working WebGL2');
    console.log(`Browser build check passed: Chromium ${browser.version()}, WebGL2/SwiftShader`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
