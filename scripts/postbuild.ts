/** postbuild: 404.html fallback (scaffold rule; hash routes don't need it) and a one-line <title> check for the launcher. */
import fs from 'node:fs';
const dist = process.argv[2] ?? 'dist';
const html = fs.readFileSync(`${dist}/index.html`, 'utf8');
fs.writeFileSync(`${dist}/404.html`, html);
const t = html.match(/<title>(.*)<\/title>/);
if (!t) {
  console.error('postbuild: <title> must stay on one line (the ▶ launcher reads it)');
  process.exit(1);
}
console.log(`postbuild: 404.html written; title "${t[1]}"`);
