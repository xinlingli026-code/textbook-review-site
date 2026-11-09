# textbook-review-site

把「教材 PDF + 课堂笔记 + 官方详解手册」变成一个**可发布的中英双语复习站**的完整方法与工具集。

真正的难点不是写页面，而是**在不编造内容的前提下把第三方 PDF 里的题干与答案可靠地取出来**：
文字层可能被加密映射破坏、扫描件没有文字层、官方解答本身可能有笔误、节号在不同版次会挪位。

本仓库把这套流程固化成了一个 Mavis Skill（`skills/textbook-review-site/`），外加四个可直接运行的脚本。

## 这个 Skill 做什么

| 步骤 | 关键动作 |
|---|---|
| 1 | 盘点每份 PDF 的文字层，区分「有文本层 / 映射被破坏 / 纯扫描件」三种形态 |
| 2 | 建立印刷页 ↔ PDF 物理页映射，**并核对用户给的节号与页码是否属实** |
| 3 | 题干一律以页面图像为准（视觉转写），文字层的数学符号不可信 |
| 4 | 先自己推导；**只有用户要求收录官方解答时**才去翻详解手册 |
| 5 | 内容层按来源分文件，交互层 `app.js` 只做合并与渲染 |
| 6 | KaTeX CDN + 离线降级 + `esc()` 转义 |
| 7 | 无头浏览器导出 DOM 做指标校验（含跨专题串味检查） |
| 8 | 提交推送即部署 GitHub Pages；独立公开站点需用户明确选择后发布 |
| 9 | 用脚本重算 README 计数，同步 DISCLAIMER 的版权例外条款 |

## 安装

把 `skills/textbook-review-site/` 整个目录放进 Mavis 的 skills 目录即可：

- Agent 级（跨项目通用，推荐）：`<dataDir>/agents/<agent>/skills/textbook-review-site/`
- 项目级：`<repo>/.mavis/skills/textbook-review-site/`

装完用官方 lint 校验一遍：

```powershell
node "<skill-creator>/scripts/lint-skill.js" "<path-to>/textbook-review-site/"
```

## 脚本

四个脚本零第三方依赖（Node）或只依赖 PyMuPDF / rapidocr（Python），各自可单独使用：

| 脚本 | 作用 |
|---|---|
| `scripts/build-bank.js` | 一份 JSON 规格 → 中英两个内容层 JS 数据文件（转义由脚本处理，避免手写 LaTeX 反斜杠出错） |
| `scripts/verify-dom.js` | 统计 DOM 指标（KaTeX 数、`.math-raw` 降级数、题卡、考纲卡、官方解答块、公式条目），`--expect` 可作断言 |
| `scripts/render_pages.py` | PDF 整页 / 裁剪区域渲染成 PNG（PyMuPDF） |
| `scripts/ocr_headers.py` | 扫描件页眉 OCR，用来定位章节与页码（rapidocr） |

```powershell
# 校验渲染结果（math-raw 必须为 0）
node scripts/verify-dom.js dump.html --expect katex=1325 --expect math-raw=0

# 渲染习题页并裁出右栏
python scripts/render_pages.py book.pdf --pages 249 --out pages --crop 0.55,0.03,1.0,0.15 --zoom 5.0
```

## 依赖

- **Node.js**：跑 `build-bank.js` / `verify-dom.js`，零第三方包。
- **Python 3.10+**：`python -m pip install pymupdf rapidocr-onnxruntime`。
  PyMuPDF 报 `DLL load failed` 是缺 `msvcp140.dll`，装 `Microsoft.VCRedist.2015+.x64` 即可。

Windows 注意事项（PowerShell BOM、`python` 而非 `python3`、Edge headless 日志走 stderr 等）都写在 `SKILL.md` 的
「Windows (win32) platform notes」段落里。

## 内容与版权

本仓库只有方法、脚本与文档，**不含任何教材原文或官方详解转写**。用它生成的站点若收录官方解答，
属于第三方版权内容的公开分发，需要在站点 `DISCLAIMER.md` 里写明来源、逐题标注页码，并承诺可按要求移除。

## License

MIT
