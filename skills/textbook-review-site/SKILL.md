---
name: textbook-review-site
description: |
  Build or extend a bilingual (中文/English) static revision-study site from a copyrighted
  textbook PDF, lecture notes and an official solutions manual: extract exercise statements,
  derive and cross-check answers, wire a KaTeX-rendered content layer, verify the rendered
  DOM, and publish to GitHub Pages plus a public mirror. Load this skill when the user says
  things like "搭建复习网站", "把习题加进网站", "补作业题", "新增笔记", "加一个章节专题",
  "发布到 GitHub Pages", or hands over a textbook / solutions-manual PDF for a study site.
  Do NOT use it for plain PDF reading or Q&A (use the pdf skill), for a non-study website,
  or for redeploying an unchanged site (use deploy-website).
---

# Textbook Review Site

把「教材 PDF + 课堂笔记 + 官方详解」变成一个可发布的中英双语复习站。核心难点不是写页面，
而是**在不编造内容的前提下把第三方 PDF 里的题干与答案可靠地取出来**：文字层可能被加密映射
破坏，扫描件没有文字层，官方解答本身可能有笔误。

## Inputs to collect

- **三份材料**：课堂笔记（题目范围/题号来源）、教材 PDF、官方详解手册 PDF（可选但价值高）。
- **本轮范围**：新增/补全哪几节、哪些题号。范围决定工作量，先问清楚再动手。
- **双语**：默认中文 + 英文两版，内容层分离、交互层共用。
- **版权边界（必须问）**：官方详解要不要收录进公开仓库？收录 = 第三方版权内容公开分发，
  需要用户明确选择，并同步写 DISCLAIMER、逐题标注手册页码。
- **发布目标**：只更新本地/仓库，还是同时更新 GitHub Pages 与独立公开站点。

材料齐了、范围和版权边界定了，就不要再来回追问；直接按下面的流程走完。

## Procedure

1. **盘点每份 PDF 的文字层**（决定后面所有成本）
   先用 `read` 工具带 `pages` 参数按页读 PDF：能读出文字说明有文本层，直接拿到章节骨架、
   题号清单、页眉页码，零成本。读出空页说明是扫描件。
   扫描件再上 PyMuPDF 逐页取 `get_text()` 复核：长度为 0 = 扫描件；长度正常但数学符号错乱
   = 字体编码映射被破坏。两种情况的处理路径完全不同，详见 `references/pdf-extraction.md`。
   原因：默认 PDF 都能直接抽文本而跳过这一步，是本题最常见的翻车点。

2. **建立印刷页 ↔ PDF 物理页映射，并核对用户给的前提**
   习题册常带前置页，偏移固定（例：印刷页 = PDF 页 − 11）。抽页眉/页脚或用目录页核对一次，
   再用一张裁图肉眼验证，避免整章错位。
   同时核对「用户说的节号 / 节标题 / 页码范围」是否与教材一致：不同版次的小节编排会变
   （例如同一本 Stewart 里逆三角函数求导在 3.5 内，3.8 却是指数增长与衰减）。
   前提与教材冲突时按教材走，并在交付里点明差异，不要默默按用户的说法做。

3. **题干一律以页面图像为准**
   文字层里的数学符号（=、−、+、√、括号）经常被替换成别的字符，读出来的句子看着通顺但公式是错的。
   把习题页渲染成 PNG，用视觉模型（`mcode-tools` 的 `describe_images`）转写指定题号，
   每次只问 2–3 页、只点名需要的题号。
   原因：错读的题干会连带把答案、官方解答对照一起带偏。

4. **先自己推导，再按需与官方解答对照**
   每题产出：题干（中/英）、答案、自行推导的分步解法；**只有当用户要求收录官方解答时**，
   再补「官方解答转写 + 手册页码」。
   交叉验证只在两种情况做：官方解答已经拿到手，或你自己对答案没把握。
   原因：详解手册是扫描件，定位 + 转写一节的成本接近重新做一遍题；
   用户只要题干与解法时，去翻手册是纯浪费，而用户要收录时，来源页码又不能省。
   验证读法：官方解答的**第一步求导式**能反推题干原文，**最后一步**能校验你的推导；
   手册与教材题干自相矛盾时（把 x²+y² 写成 x²y² 一类），以教材为准并加「核对」提示。

5. **切分内容层并接入交互层**
   按来源分文件（`ch3.js` / `ch3b.js` / `ch3c.js` …），每节一个文件；一个共享的 `app.js`
   负责双语字典、数据合并、专题切换、渲染与进度存储。新增节只加数据文件 + 一行合并语句 +
   两个入口页的 `<script>`，不要把新节写进 `app.js`。
   数据字段与文件布局见 `references/site-architecture.md`；批量写题库时用
   `scripts/build-bank.js` 从一份 JSON 规格生成中英两个数据文件（转义由脚本处理，避免手写
   LaTeX 反斜杠出错）。
   加 `<script>` 前先确认目标文件确实存在于**那个语言目录**下：两个语言目录的文件集不一定相同
   （英文侧可能多出一个内容层），引用一个不存在的文件只会得到 404，页面照常渲染、指标照常达标，
   不会自己暴露。
   并行分工时每个任务要用**各自独立的子目录**：共享一个目录时，别的任务会中途改写/删掉你的
   产物，自检会随机报「文件不存在」这种假故障。

6. **渲染层三件套**
   KaTeX CDN 渲染 `$...$`、离线时降级为 `.math-raw` 原式、所有来自数据的文本经 `esc()` 转义。
   新增数据字段若要显示在页面上，先在 `renderXxx()` 里补渲染分支并加对应 CSS 类。
   题干里的**金额**要写成 `$\text{\$}1000$`：裸 `$` 会和后面的 `$` 配对，把整段中文排成公式。
   详见 `references/site-architecture.md` 的「货币符号 `$`」段落。

7. **无头浏览器做渲染校验（不要只靠肉眼看截图）**
   Edge headless `--dump-dom` 导出 DOM，统计：KaTeX 公式数、`.math-raw` 降级数（必须为 0）、
   题卡数、专题卡数、官方解答块数。每个「语言 × 专题」组合都跑一遍。
   同时检查**跨专题串味**：在 Ch2 视图里搜 Ch3 的小节号，命中的多半是 `93.9` 这类数值巧合，
   要看上下文确认而不是看到命中就判失败。
   `scripts/verify-dom.js` 把这套统计做成了脚本。
   指标达标不等于没有资源错误：顺手确认控制台无 404 / JS 报错（每个新增的 `<script>`、CSS 类
   都要对得上真实文件）。校验用的临时产物（导出的 DOM、KaTeX 测试页）写到仓库目录之外的临时
   目录，不要留在仓库根目录——`git add -A` 会把它们一起提交。

8. **提交并发布**
   Git 提交后推送即部署（Pages 用 legacy 分支从 main 根目录构建，无需 workflow）。
   独立公开站点更新前必须先声明「该站点任何人可访问」并让用户在「原地更新」与「新建站点」之间
   明确选择；发布后 CDN 有 1–2 分钟传播延迟，测不通时退避重试而不是反复重发。

9. **同步版权声明与计数**
   README 里的考点/概念块/记忆卡/作业题/易错点/公式列数必须与实际渲染结果一致，收录官方解答时，
   DISCLAIMER 要写明「该部分仍属第三方版权、不在 MIT 范围内、逐题标注页码、可按要求移除」。
   数字一律用脚本统计后填，不要手算；公式表的「列数」与「式子条数」是两回事，缺一个就会在
   README 里留下错数。中文与英文两侧填的是同一组数字。

## Output contract

- 新增/更新的数据文件（双语各一份）+ `app.js` 中的合并与渲染改动 + 两个入口页的 `<script>` 引用。
- 每道题交付：题干（中/英）、答案、分步解法、官方解答转写（若收录）与出处页码；
  无法确定的项标「核对」并说明缺什么，不要用「大概是」填空。
- 一次成功的交付包含：DOM 指标报告（各语言 × 各专题）、Git 提交 hash、两个线上地址的实测 HTTP 状态。

## Failure handling

- **文字层抽取的数学符号不可信** → 改走页面图像 + 视觉转写，不要试图「猜」映射表。
  已验证的映射只对当本书当个版本成立，直接照搬会让另一本书全错。
- **视觉批量调用超时**（`UND_ERR_HEADERS_TIMEOUT`）→ 拆成 2–3 页一批重试，不要一次塞 6 页以上。
- **官方解答缺失** → 保留自推导解法并注明「官方手册未收录此题」，不要静默跳过。
- **教材与课堂笔记范围冲突**（例如教材有 3.8 而笔记把它并进 3.5）→ 以课堂笔记为准，
  站内在范围说明里写清差异，问用户是否单列。
- **发布后站点测不通** → 先分清是 CDN 传播（退避重试）还是真故障（换 DNS/直连 IP 诊断）。

## Windows (win32) platform notes

- PDF 渲染/OCR 用 Python：`python`（不是 `python3`），装包用 `python -m pip install pymupdf rapidocr-onnxruntime`。
  PyMuPDF 报 `DLL load failed` 时缺 `msvcp140.dll`，先装 `Microsoft.VCRedist.2015+.x64`。
- **不要**把 Python 脚本用管道喂给 `python -`：PowerShell 会带 BOM，直接 `SyntaxError`。
  用 Write 工具落成 `.py` 文件再执行。
- 视觉调用用 `mcode-tools upload-temp-url` 先传本地 PNG，再 `mcode-tools connector call
  connector__matrix__describe_images --args-file <json>`；参数写进 JSON 文件，避免命令行转义地狱。
- 递归复制/删除会被安全策略拦截：逐文件 `[System.IO.File]::Copy`，删除用 `rm -- "<path>"`。
- 重新生成 zip 前先 `rm --` 旧的，`ZipFile.Open(..., 'Create')` 不会覆盖已存在的文件。
- 无头浏览器把日志写到 stderr：调用时加 `2>&1` 并把 `$ErrorActionPreference` 设为 `Continue`，
  否则一次无害的 Edge 警告就会让整条命令失败。

## Examples

- 输入：教材第 3.5–3.7 节的习题页 + 详解手册扫描件，用户要「补作业题」
- 输出：`assets/ch3d.js` + `assets/en/ch3d.js`（28 题，含官方解答块），`app.js` 增加
  「官方详解解答」渲染分支与 CSS，DOM 指标：KaTeX 1325、`.math-raw` 0、题卡 115、官方解答块 28。
