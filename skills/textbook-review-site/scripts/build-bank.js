#!/usr/bin/env node
/**
 * build-bank.js — 把一份 JSON 题库规格编译成中英双语的 JS 数据文件。
 *
 * 用法:
 *   node build-bank.js <spec.json> [--out-dir <site-root>]
 *
 * spec.json 结构见 references/site-architecture.md 的「内容层数据模型」。
 * 字段可以是字符串，也可以是 {zh, en} 对象（按语言取；字符串两版共用）。
 * ans 支持 {zh, en}：答案里常带「即」「厘米/秒」这类中文措辞，
 * 不分语言会把中文泄漏到英文版。q / steps / src / type / note 同理。
 * 生成的文件为纯 UTF-8（无 BOM）、LF 换行，直接被 <script src> 引入。
 * 不依赖任何第三方包。
 */
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { spec: null, outDir: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out-dir') { args.outDir = argv[++i]; }
    else if (!args.spec) { args.spec = argv[i]; }
  }
  return args;
}

/** JSON.stringify 之后再收掉转义斜杠的行尾续行反斜杠问题，保持输出可读 */
function js(value) {
  return JSON.stringify(value, null, 0);
}

function pick(obj, lang, fallback) {
  if (obj === undefined || obj === null) return fallback;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const v = obj[lang];
    return v === undefined ? fallback : v;
  }
  return fallback;
}

function renderItem(item, lang) {
  const lines = [];
  lines.push('  {');
  lines.push(`    sec: ${js(item.sec)}, num: ${item.num}, page: ${item.page}, type: ${js(pick(item.type, lang, ''))},`);
  lines.push(`    q: ${js(pick(item.q, lang, ''))},`);
  if (item.ans !== undefined) lines.push(`    ans: ${js(pick(item.ans, lang, ''))},`);
  const steps = pick(item.steps, lang, []);
  if (Array.isArray(steps) && steps.length) {
    lines.push(`    steps: [${steps.map(js).join(', ')}],`);
  }
  if (Array.isArray(item.official) && item.official.length) {
    lines.push(`    official: [${item.official.map(js).join(', ')}],`);
  }
  const src = pick(item.src, lang, undefined);
  if (src !== undefined) lines.push(`    src: ${js(src)},`);
  const note = pick(item.note, lang, undefined);
  if (note !== undefined) lines.push(`    note: ${js(note)},`);
  lines.push('  },');
  return lines.join('\n');
}

function renderFile(spec, lang) {
  const head = pick(spec.header, lang, '');
  const out = [];
  out.push('/* ============================================================');
  out.push(head);
  out.push('   ============================================================ */');
  out.push(`const ${spec.varName} = [`);
  for (const item of spec.items || []) out.push(renderItem(item, lang));
  out.push('];');
  return out.join('\n') + '\n';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.spec || !fs.existsSync(args.spec)) {
    console.error('usage: node build-bank.js <spec.json> [--out-dir <site-root>]');
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(args.spec, 'utf8'));
  if (!spec.varName) throw new Error('spec.varName is required');

  const targets = [
    { lang: 'zh', rel: spec.outZh },
    { lang: 'en', rel: spec.outEn },
  ].filter(t => t.rel);

  for (const t of targets) {
    const dest = path.resolve(args.outDir, t.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, renderFile(spec, t.lang), { encoding: 'utf8' });
    console.log(`wrote ${dest} (${fs.statSync(dest).size} bytes)`);
  }
  console.log(`items: ${(spec.items || []).length}`);
}

main();
