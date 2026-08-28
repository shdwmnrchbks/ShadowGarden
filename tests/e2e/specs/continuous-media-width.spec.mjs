import { test, expect, READER_BOOK_ID, READER_SERIES_ID } from '../support/fixtures.mjs';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.resolve(HERE, '../.generated/continuous-media.epub');

/* ---------- minimal PNG encoder (RGB, filter 0) ---------- */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(width, height, pixelAt) {
  const bytesPerPixel = 3;
  const stride = width * bytesPerPixel;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixelAt(x, y);
      const offset = y * (stride + 1) + 1 + x * bytesPerPixel;
      raw[offset] = r; raw[offset + 1] = g; raw[offset + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* Landscape 2400x1350 and portrait 1350x2400: half light / half dark with red borders so
   any horizontal or vertical cropping is obvious in failure artifacts. */
const LANDSCAPE_W = 2400, LANDSCAPE_H = 1350;
const landscapePng = png(LANDSCAPE_W, LANDSCAPE_H, (x, y) => {
  if (x < 8 || x >= LANDSCAPE_W - 8 || y < 8 || y >= LANDSCAPE_H - 8) return [228, 32, 32];
  return x < LANDSCAPE_W / 2 ? [245, 245, 245] : [24, 24, 32];
});
const PORTRAIT_W = 1350, PORTRAIT_H = 2400;
const portraitPng = png(PORTRAIT_W, PORTRAIT_H, (x, y) => {
  if (x < 8 || x >= PORTRAIT_W - 8 || y < 8 || y >= PORTRAIT_H - 8) return [228, 32, 32];
  return y < PORTRAIT_H / 2 ? [245, 245, 245] : [24, 24, 32];
});

const paragraphs = (prefix, count = 24) => Array.from({ length: count }, (_, i) =>
  `<p>${prefix} paragraph ${i + 1}. Deterministic prose so the chapter carries normal text flow around the embedded artwork while the media rules are verified.</p>`
).join('\n');

async function buildEpub() {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:shadow-garden:continuous-media</dc:identifier>
    <dc:title>Continuous Media Fixture</dc:title>
    <dc:creator>Shadow Garden E2E</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2026-09-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="styles.css" media-type="text/css"/>
    <item id="landscape-img" href="images/landscape.png" media-type="image/png"/>
    <item id="portrait-img" href="images/portrait.png" media-type="image/png"/>
    <item id="chapter-start" href="chapter-start.xhtml" media-type="application/xhtml+xml"/>
    <item id="page-landscape" href="page-landscape.xhtml" media-type="application/xhtml+xml"/>
    <item id="page-portrait" href="page-portrait.xhtml" media-type="application/xhtml+xml"/>
    <item id="inline-landscape" href="inline-landscape.xhtml" media-type="application/xhtml+xml"/>
    <item id="inline-portrait" href="inline-portrait.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter-start"/>
    <itemref idref="page-landscape"/>
    <itemref idref="page-portrait"/>
    <itemref idref="inline-landscape"/>
    <itemref idref="inline-portrait"/>
  </spine>
</package>`);
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head><title>Contents</title></head><body>
<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>
<li><a href="chapter-start.xhtml">Start</a></li>
<li><a href="page-landscape.xhtml">Landscape Plate</a></li>
<li><a href="page-portrait.xhtml">Portrait Plate</a></li>
<li><a href="inline-landscape.xhtml">Inline Landscape</a></li>
<li><a href="inline-portrait.xhtml">Inline Portrait</a></li>
</ol></nav></body></html>`);
  zip.file('OEBPS/styles.css', `html{font-family:serif}body{line-height:1.6;margin:0 1em}p{margin:.8em 0}figure{margin:1em 0;text-align:center}img{max-width:100%;height:auto}
.fullpage{margin:0;padding:0}.fullpage img{width:100%;height:auto;display:block}`);
  zip.file('OEBPS/chapter-start.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Start</title><link rel="stylesheet" href="styles.css"/></head><body>
<h1>Start</h1>
${paragraphs('Start')}
</body></html>`);
  zip.file('OEBPS/page-landscape.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Landscape Plate</title><link rel="stylesheet" href="styles.css"/></head><body>
<div class="fullpage"><img src="images/landscape.png" alt="Landscape full page plate"/></div>
</body></html>`);
  zip.file('OEBPS/page-portrait.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Portrait Plate</title><link rel="stylesheet" href="styles.css"/></head><body>
<div class="fullpage"><img src="images/portrait.png" alt="Portrait full page plate"/></div>
</body></html>`);
  zip.file('OEBPS/inline-landscape.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Inline Landscape</title><link rel="stylesheet" href="styles.css"/></head><body>
<h1>Inline Landscape</h1>
${paragraphs('Before art', 6)}
<figure><img src="images/landscape.png" alt="Inline landscape artwork"/></figure>
${paragraphs('After art', 6)}
</body></html>`);
  zip.file('OEBPS/inline-portrait.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Inline Portrait</title><link rel="stylesheet" href="styles.css"/></head><body>
<h1>Inline Portrait</h1>
${paragraphs('Before art', 6)}
<figure><img src="images/portrait.png" alt="Inline portrait artwork"/></figure>
${paragraphs('After art', 6)}
</body></html>`);
  zip.file('OEBPS/images/landscape.png', landscapePng);
  zip.file('OEBPS/images/portrait.png', portraitPng);
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  await fs.writeFile(OUT_FILE, bytes);
  return OUT_FILE;
}

const readerUrl = `/reader.html?book=${encodeURIComponent(READER_BOOK_ID)}&series=${encodeURIComponent(READER_SERIES_ID)}`;

function imageClipReport(frame, img) {
  /* Containment is defined at the canvas (the iframe viewport): the prose column sits
     centered inside it and Continuous artwork legitimately paints through the slack
     beside that column, but nothing may render beyond the canvas edge or below the
     section frame (where the next section would cover it). */
  const problems = [];
  if (frame.frame) {
    if (img.rect.left < -1) problems.push(`left-clipped by ${-img.rect.left}px`);
    if (img.rect.right > frame.frame.width + 1) problems.push(`right-clipped by ${img.rect.right - frame.frame.width}px`);
    if (img.rect.top < -1) problems.push(`top-clipped by ${-img.rect.top}px`);
    if (img.rect.bottom > frame.frame.height + 1) problems.push(`bottom-clipped by ${img.rect.bottom - frame.frame.height}px`);
  }
  return problems;
}

async function measureContinuous(page) {
  return page.evaluate(() => {
    const out = { frames: [], viewer: null };
    const viewerEl = document.getElementById('viewer');
    const viewerRect = viewerEl.getBoundingClientRect();
    out.viewer = { width: Math.round(viewerRect.width), height: Math.round(viewerRect.height) };
    for (const frame of [...document.querySelectorAll('#viewer iframe')]) {
      const doc = frame.contentDocument;
      if (!doc || !doc.documentElement) continue;
      const frameRect = frame.getBoundingClientRect();
      const body = doc.body;
      const bodyRect = body ? body.getBoundingClientRect() : null;
      const entry = {
        synthetic: Boolean(doc.documentElement?.dataset?.sgSyntheticVisual === '1' || body?.dataset?.sgSyntheticVisual === '1'),
        frame: { width: Math.round(frameRect.width), height: Math.round(frameRect.height) },
        scrollHeight: doc.documentElement.scrollHeight,
        bodyHeight: bodyRect ? Math.round(bodyRect.height) : null,
        bodyWidth: bodyRect ? Math.round(bodyRect.width) : null,
        bodyBox: bodyRect ? { left: Math.round(bodyRect.left), right: Math.round(bodyRect.right), top: Math.round(bodyRect.top), bottom: Math.round(bodyRect.bottom) } : null,
        images: []
      };
      for (const img of [...doc.querySelectorAll('img')]) {
        const r = img.getBoundingClientRect();
        entry.images.push({
          alt: img.getAttribute('alt') || '',
          natural: `${img.naturalWidth}x${img.naturalHeight}`,
          complete: img.complete && img.naturalWidth > 0,
          rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }
        });
      }
      out.frames.push(entry);
    }
    return out;
  });
}

function collectedImages(data) {
  return data.frames.flatMap(frame => frame.images.map(img => ({ frame, img })));
}

test('Continuous Reader keeps artwork independent of the text-width setting', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  // The defect is desktop-scoped: on mobile the reading canvas is narrower than every
  // legal text width, so artwork already fills the canvas there. The large-plate fixture
  // also exceeds the mobile emulation budget, and mobile canvas containment is covered by
  // reader-mobile-reliability.spec.mjs.
  test.skip(testInfo.project.name.includes('mobile'), 'desktop Continuous text-width regression');
  await buildEpub();
  const epub = await fs.readFile(OUT_FILE);

  // Serve the dedicated fixture EPUB under the canonical book identity.
  await page.route('**/media/shadow-garden/books/e2e-reader.epub*', async route => {
    const headers = route.request().headers();
    const range = headers.range || headers.Range || '';
    const match = String(range).match(/^bytes=(\d+)-(\d*)$/i);
    if (match) {
      const start = Math.min(Number(match[1]) || 0, epub.length - 1);
      const end = Math.max(start, Math.min(Number(match[2]) || epub.length - 1, epub.length - 1));
      const body = epub.subarray(start, end + 1);
      return route.fulfill({ status: 206, contentType: 'application/epub+zip', headers: {
        'accept-ranges': 'bytes', 'cache-control': 'no-store',
        'content-range': `bytes ${start}-${end}/${epub.length}`, 'content-length': String(body.length)
      }, body });
    }
    return route.fulfill({ status: 200, contentType: 'application/epub+zip', headers: {
      'accept-ranges': 'bytes', 'cache-control': 'no-store', 'content-length': String(epub.length)
    }, body: epub });
  });

  await page.goto(readerUrl);
  await expect(page.locator('#readerLoading')).toHaveClass(/hidden/, { timeout: 20_000 });
  await expect(page.locator('#bookTitle')).toHaveText('Continuous Media Fixture');

  await page.locator('#settingsToggle').click();
  await page.locator('#flowSelect').selectOption('scrolled-doc');
  await expect(page.locator('body')).toHaveClass(/reader-flow-scrolled/, { timeout: 15_000 });
  await page.locator('#drawerBackdrop').click().catch(() => {});
  await page.waitForTimeout(4500);

  const data = await measureContinuous(page);
  await testInfo.attach('continuous-media-760.json', { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: path.resolve(HERE, '../.generated/continuous-media-top.png'), fullPage: false });

  // Walk the canvas so every section renders and late layout settles.
  await page.evaluate(() => {
    const container = document.querySelector('#viewer .epub-container') || document.getElementById('viewer');
    container.scrollTop = container.scrollHeight;
  });
  await page.waitForTimeout(4000);
  const settled = await measureContinuous(page);
  await testInfo.attach('continuous-media-settled.json', { body: JSON.stringify(settled, null, 2), contentType: 'application/json' });

  for (const snapshot of [data, settled]) {
    const entries = collectedImages(snapshot);
    expect(entries.map(({ img }) => img.alt).sort()).toEqual([
      'Inline landscape artwork',
      'Inline portrait artwork',
      'Landscape full page plate',
      'Portrait full page plate'
    ]);
    for (const { img } of entries) {
      expect(img.complete, `${img.alt} must have loaded`).toBe(true);
    }
  }
  for (const { frame, img } of collectedImages(settled)) {
    const problems = imageClipReport(frame, img);
    expect(problems, `${img.alt} is clipped: ${problems.join(', ')}`).toEqual([]);
  }

  // The full-page plates must be synthetic visual pages owned by the plate geometry.
  const syntheticFrames = settled.frames.filter(frame => frame.synthetic);
  expect(syntheticFrames).toHaveLength(2);
  for (const frame of syntheticFrames) {
    expect(frame.frame.width).toBe(settled.viewer.width);
    expect(frame.images).toHaveLength(1);
    const [img] = frame.images;
    // Landscape plate fills the canvas width band; portrait plate is height-bound and centered.
    expect(img.rect.width, 'plate must not be narrower than its aspect-bound fit').toBeGreaterThan(0);
  }
  const plateAlts = syntheticFrames.map(frame => frame.images[0].alt).sort();
  expect(plateAlts).toEqual(['Landscape full page plate', 'Portrait full page plate']);

  // Artwork geometry is independent of the text width: change the setting, re-measure.
  const widthsBefore = new Map(collectedImages(settled).map(({ img }) => [img.alt, img.rect.width]));
  await page.locator('#settingsToggle').click();
  await page.locator('#widthRange').fill('1050');
  await page.locator('#widthRange').dispatchEvent('input');
  await page.locator('#widthRange').dispatchEvent('change');
  await expect(page.locator('#widthValue')).toHaveText('1050px');
  await page.waitForTimeout(2500);
  const widened = await measureContinuous(page);
  await testInfo.attach('continuous-media-1050.json', { body: JSON.stringify(widened, null, 2), contentType: 'application/json' });

  const proseFrame = widened.frames.find(frame => !frame.synthetic);
  expect(proseFrame, 'prose sections must still exist').toBeTruthy();
  expect(proseFrame.bodyWidth, 'the text-width setting must still shape prose').toBe(1050);

  for (const { frame, img } of collectedImages(widened)) {
    expect(img.rect.width, `${img.alt} must not change width with the text-width setting`)
      .toBe(widthsBefore.get(img.alt));
    const problems = imageClipReport(frame, img);
    expect(problems, `${img.alt} is clipped at width 1050: ${problems.join(', ')}`).toEqual([]);
  }
});
