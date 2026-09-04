import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../.generated');
const OUT_FILE = path.join(OUT_DIR, 'reader-audit-large.epub');
const CHAPTER_COUNT = 18;
const PARAGRAPHS_PER_CHAPTER = 72;
const PADDING_BYTES = 6 * 1024 * 1024;

function chapterParagraphs(chapter) {
  return Array.from({ length: PARAGRAPHS_PER_CHAPTER }, (_, index) => {
    const marker = String((chapter * 977 + index * 131) % 10007).padStart(5, '0');
    return `<p id="c${chapter}-p${index + 1}">Audit chapter ${chapter}, passage ${index + 1}. Marker ${marker}. The moonlit archive preserves a stable semantic block while Shadow Garden exercises repeated flow changes, page mapping, lifecycle recovery, and continuous reading over a realistically large protected volume.</p>`;
  }).join('\n');
}

const manifest = Array.from({ length: CHAPTER_COUNT }, (_, index) => {
  const chapter = index + 1;
  return `<item id="chapter-${chapter}" href="chapter-${chapter}.xhtml" media-type="application/xhtml+xml"/>`;
}).join('\n    ');
const spine = Array.from({ length: CHAPTER_COUNT }, (_, index) => `<itemref idref="chapter-${index + 1}"/>`).join('\n    ');
const nav = Array.from({ length: CHAPTER_COUNT }, (_, index) => {
  const chapter = index + 1;
  return `<li><a href="chapter-${chapter}.xhtml">Audit Chapter ${chapter}</a></li>`;
}).join('\n');

const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:shadow-garden:v2.11-reader-audit</dc:identifier>
    <dc:title>Shadow Garden Reader Audit — Large Volume</dc:title>
    <dc:creator>Shadow Garden Engineering Audit</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2026-09-04T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="styles.css" media-type="text/css"/>
    ${manifest}
    <item id="audit-payload" href="assets/audit-payload.bin" media-type="application/octet-stream"/>
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`);
zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head><title>Contents</title></head><body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${nav}</ol></nav></body></html>`);
zip.file('OEBPS/styles.css', 'html{font-family:serif}body{line-height:1.58;margin:0 7%}h1{margin:1.4em 0 .8em}p{margin:.82em 0}');

for (let chapter = 1; chapter <= CHAPTER_COUNT; chapter += 1) {
  zip.file(`OEBPS/chapter-${chapter}.xhtml`, `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Audit Chapter ${chapter}</title><link rel="stylesheet" href="styles.css"/></head><body>
<h1>Audit Chapter ${chapter}</h1>
${chapterParagraphs(chapter)}
</body></html>`);
}

// Keep this entry uncompressed so the audit exercises multi-megabyte EPUB transfer/archive
// handling without creating millions of DOM nodes or relying on copyrighted publication data.
zip.file('OEBPS/assets/audit-payload.bin', Buffer.alloc(PADDING_BYTES, 0x53), { compression: 'STORE' });

await fs.mkdir(OUT_DIR, { recursive: true });
const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
await fs.writeFile(OUT_FILE, bytes);
console.log(`Generated Reader v2.11 audit EPUB: ${path.relative(process.cwd(), OUT_FILE)} (${bytes.length} bytes, ${CHAPTER_COUNT} chapters)`);
