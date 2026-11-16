// Builds amberwild/index.html (and, with an output path, a body-only page for publishing) from src/.
import fs from 'node:fs';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname), src = path.join(dir, 'src');
const page = fs.readFileSync(path.join(src, 'page.html'), 'utf8');
const js = fs.readdirSync(src).filter(f => f.endsWith('.js')).sort().map(f => `// ===== ${f} =====\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
const bodyOnly = `${page}\n<script type="module">\n${js}\n</script>\n`;
const i = page.indexOf('<!--body-->');
const full = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n${page.slice(0, i)}</head>\n<body>\n${page.slice(i)}\n<script type="module">\n${js}\n</script>\n</body>\n</html>\n`;
fs.writeFileSync(path.join(dir, 'index.html'), full);
if (process.env.CHECK) fs.writeFileSync(path.join(dir, '.check.mjs'), js);
if (process.argv[2]) fs.writeFileSync(process.argv[2], bodyOnly);
console.log('built', full.length, 'bytes');
