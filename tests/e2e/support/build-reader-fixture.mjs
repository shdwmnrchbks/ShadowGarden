import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../.generated');
const OUT_FILE = path.join(OUT_DIR, 'reader-fixture.epub');

const paragraphs = (prefix, count = 42) => Array.from({ length: count }, (_, index) =>
  `<p>${prefix} paragraph ${index + 1}. Moonlight crosses the glass garden while the archive records a stable reading position for deterministic browser testing. This deliberately repeated prose makes the chapter long enough to span several device pages without relying on production content.</p>`
).join('\n');

const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:shadow-garden:e2e-reader</dc:identifier>
    <dc:title>Moonlit Reader Fixture</dc:title>
    <dc:creator>Shadow Garden E2E</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2026-08-26T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="styles.css" media-type="text/css"/>
    <item id="chapter-1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-2" href="chapter-2.xhtml" media-type="application/xhtml+xml"/>
    <item id="split-chapter-a" href="split-chapter-a.xhtml" media-type="application/xhtml+xml"/>
    <item id="split-chapter-b" href="split-chapter-b.xhtml" media-type="application/xhtml+xml"/>
    <item id="visual-only" href="visual-only.xhtml" media-type="application/xhtml+xml"/>
    <item id="wide-visual" href="wide-visual.xhtml" media-type="application/xhtml+xml"/>
    <item id="legacy-structure" href="legacy-structure.xhtml" media-type="application/xhtml+xml"/>
    <item id="large-chapter" href="large-chapter.xhtml" media-type="application/xhtml+xml"/>
    <item id="illustration" href="images/illustration.svg" media-type="image/svg+xml"/>
    <item id="fullbleed-dark" href="images/fullbleed-dark.svg" media-type="image/svg+xml"/>
    <item id="tall-strip" href="images/tall-strip.svg" media-type="image/svg+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter-1"/>
    <itemref idref="chapter-2"/>
    <itemref idref="split-chapter-a"/>
    <itemref idref="split-chapter-b"/>
    <itemref idref="visual-only"/>
    <itemref idref="wide-visual"/>
    <itemref idref="legacy-structure"/>
    <itemref idref="large-chapter"/>
  </spine>
</package>`);
zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head><title>Contents</title></head><body>
<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>
<li><a href="chapter-1.xhtml">Chapter One</a></li>
<li><a href="chapter-2.xhtml">Chapter Two</a></li>
<li><a href="split-chapter-a.xhtml">Split Chapter</a><ol><li><a href="split-chapter-b.xhtml">Page 2</a></li></ol></li>
<li><a href="visual-only.xhtml">Visual Plate</a></li>
<li><a href="wide-visual.xhtml">Wide Visual</a></li>
<li><a href="legacy-structure.xhtml">Legacy Structure</a></li>
<li><a href="large-chapter.xhtml">Large Chapter</a></li>
</ol></nav></body></html>`);
zip.file('OEBPS/styles.css', `html{font-family:serif} body{line-height:1.55;margin:0 6%} h1{margin:1.5em 0 .8em} p{margin:.8em 0} figure{margin:2em auto;text-align:center} img{max-width:70%;height:auto}.visual-page{min-height:90vh;display:grid;place-items:center}.oversized-visual{width:120vw;margin-left:0;margin-right:0}.oversized-visual img{width:1200px;max-width:none}.oversized-div{width:140vw;padding-left:40px}.oversized-div img{width:1600px;max-width:none;display:block}.min-width-canvas{min-width:900px}.min-width-canvas img{width:100%;max-width:none;display:block}.fullbleed-dark{width:100vw;padding:0}.fullbleed-dark img{width:100%;height:auto;display:block;background:#050507}.abs-canvas{position:absolute;width:120vw;padding:0;margin:0}.abs-canvas img{width:100%;max-width:none;display:block}.tall-strip{margin:2em 0;padding:0}.tall-strip img{width:100%;height:auto;display:block}`);
zip.file('OEBPS/chapter-1.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Chapter One</title><link rel="stylesheet" href="styles.css"/></head><body>
<h1>Chapter One</h1>
<figure><img src="images/illustration.svg" alt="A moonlit geometric garden used to test image focus"/><figcaption>Moonlit test illustration</figcaption></figure>
${paragraphs('First chapter')}
</body></html>`);
zip.file('OEBPS/chapter-2.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Chapter Two</title><link rel="stylesheet" href="styles.css"/></head><body>
<h1>Chapter Two</h1>
${paragraphs('Second chapter')}
</body></html>`);
zip.file('OEBPS/split-chapter-a.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Split Chapter</title><link rel="stylesheet" href="styles.css"/></head><body>
<h1>Split Chapter</h1>
${paragraphs('Split chapter first XHTML', 8)}
</body></html>`);
zip.file('OEBPS/split-chapter-b.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Split Chapter continuation</title><link rel="stylesheet" href="styles.css"/></head><body>
${paragraphs('Split chapter second XHTML', 12)}
</body></html>`);
zip.file('OEBPS/visual-only.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Visual Plate</title><link rel="stylesheet" href="styles.css"/></head><body class="visual-page">
<figure><img src="images/illustration.svg" alt="A full-page moonlit geometric garden"/><figcaption>Visual-only fixture page</figcaption></figure>
</body></html>`);
zip.file('OEBPS/wide-visual.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Wide Visual</title><link rel="stylesheet" href="styles.css"/></head><body>
<h1>Wide Visual</h1>
<figure class="oversized-visual"><img src="images/illustration.svg" alt="An intentionally oversized image wrapper used to verify Continuous Reader containment"/><figcaption>Oversized publication wrapper fixture</figcaption></figure>
<div class="oversized-div"><img src="images/illustration.svg" alt="An oversized bare publication wrapper without figure semantics used to verify Continuous Reader containment"/></div>
<section class="min-width-canvas"><img src="images/illustration.svg" alt="A publication canvas forced wider than the viewport through min-width, which overrides max-width containment"/></section>
<div class="fullbleed-dark"><img src="images/fullbleed-dark.svg" alt="A dark full-bleed cover image whose right half cannot be detected by luminance scans"/></div>
<figure class="tall-strip"><img src="images/tall-strip.svg" alt="A vertically long strip exceeding the viewport height used to verify desktop Continuous vertical containment"/></figure>
<div style="position:relative"><section class="abs-canvas" style="left:0;top:0"><img src="images/illustration.svg" alt="An absolutely positioned publication canvas anchoring against the full-width initial containing block"/></section></div>
${paragraphs('Wide visual continuation', 4)}
</body></html>`);
zip.file('OEBPS/legacy-structure.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><body>
<div><b>Legacy Structure</b><br/><span>Readable legacy EPUB content intentionally omits a normal head and semantic chapter wrapper.</span></div>
<div>${paragraphs('Legacy structure', 8)}</div>
</body></html>`);
zip.file('OEBPS/large-chapter.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Large Chapter</title><link rel="stylesheet" href="styles.css"/></head><body>
<h1>Large Chapter</h1>
${paragraphs('Large chapter', 160)}
</body></html>`);
zip.file('OEBPS/images/illustration.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" role="img" aria-labelledby="title"><title id="title">Moonlit geometric garden</title><rect width="600" height="800" fill="#111713"/><circle cx="300" cy="235" r="120" fill="#c9d6cc"/><path d="M80 650 L300 330 L520 650 Z" fill="#31483a"/><path d="M120 690 H480" stroke="#a8bcae" stroke-width="18"/></svg>`);
zip.file('OEBPS/images/fullbleed-dark.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1400" role="img" aria-labelledby="fbdtitle"><title id="fbdtitle">Dark full-bleed cover</title><rect width="1080" height="1400" fill="#050507"/><rect x="60" y="60" width="300" height="90" rx="12" fill="#2a2a31"/><text x="410" y="720" font-family="sans-serif" font-size="52" fill="#8d8d99">DARK PLATE RIGHT HALF LOW LUMINANCE</text><rect x="0" y="1380" width="1080" height="20" fill="#17171c"/></svg>`);
zip.file('OEBPS/images/tall-strip.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 4200" role="img" aria-labelledby="tstitle"><title id="tstitle">Vertically long strip</title><rect width="800" height="4200" fill="#101418"/><rect y="2090" width="800" height="20" fill="#e05555"/><text x="90" y="4100" font-family="sans-serif" font-size="60" fill="#d8dee6">BOTTOM MARKER - if you can read this the tall strip survived vertical containment</text></svg>`);

await fs.mkdir(OUT_DIR, { recursive: true });
const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
await fs.writeFile(OUT_FILE, bytes);
console.log(`Generated Reader E2E EPUB: ${path.relative(process.cwd(), OUT_FILE)} (${bytes.length} bytes)`);