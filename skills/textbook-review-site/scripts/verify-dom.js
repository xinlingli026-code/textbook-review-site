#!/usr/bin/env node
/**
 * verify-dom.js — 统计无头浏览器导出的 DOM，核对复习站的渲染结果。
 *
 * 用法:
 *   node verify-dom.js <dom.html> [更多 dom.html ...] [--expect key=value ...]
 *
 * 指标: katex(公式数) / mathRaw(降级数) / pSolution(题卡) / scopeCard(考纲卡)
 *       / pOfficial(官方解答块) / pSrc(出处行) / formulaRow(公式表条目) / chip(筛选按钮)
 * 退出码: 0 = 全部通过；1 = 有指标未达预期或出现 math-raw 降级。
 *
 * 注意: 记忆卡是单卡轮播，DOM 里数不到；需要真实计数就在 Node 里加载站点的数据文件统计。
 * 中英两版要分别导出 DOM 再各跑一次，数字应当一致（不一致 = 双语数据漂移）。
 */
const fs = require('fs');

function count(html, pattern) {
  const m = html.match(pattern);
  return m ? m.length : 0;
}

function metrics(html) {
  return {
    katex: count(html, /class="katex"/g),
    mathRaw: count(html, /math-raw/g),
    pSolution: count(html, /class="p-solution"/g),
    pCard: count(html, /class="p-card"/g),
    pOfficial: count(html, /class="p-official"/g),
    pSrc: count(html, /class="p-src"/g),
    scopeCard: count(html, /class="scope-card"/g),
    // 注意：sh-item 是「公式速查表」的每一行，不是记忆卡；记忆卡是单卡轮播，DOM 里数不到
    formulaRow: count(html, /class="sh-item"/g),
    pitfall: count(html, /class="pit"/g),
    chip: count(html, /class="chip"/g),
  };
}

function main() {
  const argv = process.argv.slice(2);
  const files = [];
  const expect = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--expect') {
      const kv = argv[++i] || '';
      const idx = kv.indexOf('=');
      if (idx > 0) expect[kv.slice(0, idx)] = kv.slice(idx + 1);
    } else files.push(argv[i]);
  }
  if (!files.length) {
    console.error('usage: node verify-dom.js <dom.html> [...] [--expect key=value ...]');
    process.exit(1);
  }

  let failed = false;
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`MISSING ${f}`);
      failed = true;
      continue;
    }
    const html = fs.readFileSync(f, 'utf8');
    const m = metrics(html);
    console.log(`\n== ${f} (${html.length} bytes)`);
    for (const [k, v] of Object.entries(m)) console.log(`   ${k.padEnd(12)} ${v}`);
    if (m.mathRaw > 0) {
      console.log(`   !! math-raw 降级 ${m.mathRaw} 处：KaTeX 未加载或公式写法有误`);
      failed = true;
    }
    for (const [k, want] of Object.entries(expect)) {
      if (!(k in m)) continue;
      const got = String(m[k]);
      const ok = want === got;
      console.log(`   ${ok ? 'ok ' : 'XX '} expect ${k}=${want} (got ${got})`);
      if (!ok) failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
