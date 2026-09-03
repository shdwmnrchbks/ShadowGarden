import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../.generated');

await fs.mkdir(OUT_DIR, { recursive: true });

const imperfect = new JSZip();
imperfect.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
imperfect.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
/* Intentionally common-but-imperfect EPUB: no navigation document and no dc:title.
   The reading order and chapter are still valid, so Shadow Garden should open it with
   its existing empty-Contents/Untitled fallbacks instead of treating metadata as fatal. */
imperfect.file('OPS/package.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:shadow-garden:e2e-imperfect</dc:identifier>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2026-09-03T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="chapter"/></spine>
</package>`);
imperfect.file('OPS/chapter.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><body>
<h1>Readable Imperfect Chapter</h1>
<p>This intentionally imperfect EPUB has a valid reading order but omits optional Reader conveniences.</p>
<p>Shadow Garden should render this passage instead of failing because navigation or title metadata is unavailable.</p>
</body></html>`);
const imperfectBytes = await imperfect.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
await fs.writeFile(path.join(OUT_DIR, 'reader-imperfect.epub'), imperfectBytes);

/* Deliberately not a ZIP/EPUB. This fixture proves that parser failures remain contained in
   Reader chrome and never echo raw JSZip/EPUB.js parser text into the visible error surface. */
await fs.writeFile(path.join(OUT_DIR, 'reader-corrupt.epub'), Buffer.from('shadow-garden-corrupt-epub-fixture\n', 'utf8'));

console.log(`Generated Reader resilience EPUBs (${imperfectBytes.length} byte imperfect fixture + corrupt sentinel)`);
