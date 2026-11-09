# 复习站架构与交付约定

## 目录布局

```
repo/
├── index.html          中文入口
├── index-en.html      英文入口
├── assets/
│   ├── app.js         交互层：双语字典、数据合并、专题切换、渲染、进度
│   ├── style.css      全部样式
│   ├── data.js        Chapter 2 内容层
│   ├── problems.js    Chapter 2 课堂例题
│   ├── hw.js          Chapter 2 教材作业题库
│   ├── ch3.js         Chapter 3 内容层 A（3.1–3.5）
│   ├── ch3b.js        Chapter 3 内容层 B（3.6–3.8）
│   ├── ch3c.js        Chapter 3 内容层 C（3.9–3.11）
│   └── en/            英文内容层，文件名一一对应
├── LICENSE            纯 MIT 文本
├── DISCLAIMER.md      第三方版权与免责声明
├── SECURITY.md / CONTRIBUTING.md / README.md
```

新增一节内容 = 新增一个数据文件 + `app.js` 一行合并 + 两个入口页各一个 `<script>`。
不要把新节的数据直接塞进 `app.js`，那会让交互层与内容层重新耦合。

### 入口页引用与文件对等

两个入口页各自引用**本语言目录**下的文件，`assets/` 与 `assets/en/` 的文件集不一定相同
（例如英文侧多一个 `hw2.js`，中文侧没有）。所以：

- 加 `<script src="assets/xxx.js">` 之前先确认该文件在本语言目录里真的存在。引用缺失文件只会
  产生一个 404，页面照常渲染、DOM 指标照常达标，只有看控制台或网络面板才会发现。
- 合并新节前顺手比对两侧的文件清单。某一侧多出的内容层意味着另一侧在少内容
  （这正是首页「指定作业题」中英数字对不上的常见来源）。
- 校验用的临时文件（DOM dump、KaTeX 测试页）写到仓库目录之外，仓库根目录只留交付物。

## 内容层数据模型

```js
const HW3D = [
  { sec: '3.5', num: 27, page: 215, type: '隐函数求导',
    q: '求曲线 $x^2-xy-y^2=1$ 在点 $(2,1)$ 处的切线方程。',   // 中文版
    ans: '$y=\\dfrac{3}{4}x-\\dfrac{1}{2}$',
    steps: ['求导：$2x-(xy\'+y)-2y\,y\'=0$，即 $(x+2y)y\'=2x-y$'],
    official: ['$x^2-xy-y^2=1 \\implies 2x-(xy\'+y)-2yy\'=0$'],  // 官方解答转写（可选）
    src: '官方详解 p.113',                                        // 出处页码
    note: '与课堂笔记答案不一致，请以书为准' },                    // 可选核对提示
];
```

英文版同名文件里 `q`/`steps`/`type` 换成英文，不保留 `en` 字段。
中英共用同一套字段名，渲染函数不用分支。

其他常用结构：

- `SECTIONS`：小节元信息（id、名称、作业题号列表），`hw` 数组决定考纲地图里的题号列。
- `SCOPE_CARDS`：每个小节一张考纲卡（描述、权重、标签、作业页码）。
- `CONCEPTS` / `FLASHCARDS` / `PITFALLS` / `SHEET`：概念块、记忆卡、易错点、公式表列。
- `PROBLEMS`：课堂例题；`HW_PROBLEMS`：教材作业题。

## 双语与进度

- 双语字典集中在 `app.js` 的 `T{}`，`T.xxx` 同名 key 在中英两版里含义一致。
- 页面语言用 `<html data-lang="zh|en">` 表达，避免为了语言加 `unsafe-inline`。
- 学习进度写 `localStorage`，键名带版本号（如 `calc2_review_progress_v1`）；
  专题选择另用一个键（如 `calc_review_chapter_v1`），中英两版共用同一份进度。

## 专题切换

顶部切换器在所有面板生效：考纲地图、概念、记忆卡、作业题、例题、自测、易错点、公式表、进度环。
`?ch=2` / `?ch=3` 支持直达链接；切换时重绘的列表要避免重复绑定事件（用一个 `bindOnce` 包装）。

## 渲染与安全

- KaTeX 从 CDN 加载并配 SRI；CSP 只放行 jsDelivr 与 Google Fonts。
- 所有注入页面的数据文本先 `esc()`。
- 离线时 KaTeX 不在 → 公式降级为等宽原式 `.math-raw`，可读性不能塌。
- 官方解答这类长 LaTeX 建议包一层独立容器（浅色底 + 出处小字），与自写解法视觉区分。

### 货币符号 `$` 会与数学定界符配对

站点用 `$…$` 写公式，所以题干里的**金额**（`$1000`、`$1197.22`）会被当成开定界符，
与后面某个 `$` 配对，把整段中文当公式排。实测症状：中文出现在 `cjk_fallback` 里、
被排成斜体数学字，金额前的 `$` 消失。

正确写法：`$\text{\$}1000$`（渲染结果就是字面量 `$1000`）。
`\textdollar` 在 KaTeX 0.16.9 **不被支持**，会渲染成红色错误文本，不要用。

检测（导出 DOM 后跑一遍，应为 0）：KaTeX 会把每个公式的原始 TeX 放在
`<annotation encoding="application/x-tex">` 里；把 `\text{...}` 段去掉后若仍有中文，
就是误配对。

```js
const bad = [...html.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)]
  .filter(m => /[一-鿿]/.test(m[1].replace(/\\text\{[^{}]*\}/g, '')));
console.log('accidental CJK formulas =', bad.length);
```

另外注意 JS 源码里的转义层数：源码里写 `\\text{\\$}` 才在运行时得到 `\text{\$}`；
少一个反斜杠就会退化成裸 `$`。

## 校验指标

每个「语言 × 专题」跑一次无头导出，至少核对：

| 指标 | 期望 |
|---|---|
| `class="katex"` | > 0（公式渲染成功） |
| `math-raw` | **0**（无降级） |
| `class="p-solution"` | = 该专题题卡总数（中文版与英文版一致） |
| `class="scope-card"` | = 该专题考纲卡数 |
| `class="p-official"` | **容器数** ≥ 官方内容数（只有出处行时也会渲染空壳容器） |
| `<div class="lbl">` | = 真正带官方解答内容的题数 |
| `class="sh-item"` | = 公式表条目数（**不是记忆卡**，记忆卡是单卡轮播，DOM 里数不到） |
| 跨专题串味 | Ch2 视图不应出现 Ch3 小节标题（数值巧合要人工看上下文） |

`scripts/verify-dom.js` 一次算完这些。

### 中英双语的漂移检查

中英两版各导出一次 DOM，指标必须一一相等。最容易漏的是 **scope card 里的 `hw` 数组**：
中文版补了题号而英文版留着空数组时，页面不报错，但两版首页的「指定作业题」总数会差一截。
排查办法：在 Node 里加载两边的数据文件，对比 `SECTIONS[].hw` 与各数组长度。
README 里的数字同理——公式表的「列数」与「式子条数」是两回事，别混用。

### README 计数清单

加完内容后，把这些数字**用脚本重算**再填进 README，中英两侧填同一组值：

| README 项 | 来源 |
|---|---|
| 考点 / 小节数 | `SECTIONS` 里属于该章的条目数 |
| 概念块 | `CONCEPTS` 条目数 |
| 记忆卡 | `FLASHCARDS` 条目数 |
| 教材作业题 | `HW_PROBLEMS` 条目数 |
| 课堂例题 | `PROBLEMS` 条目数 |
| 易错点 | `PITFALLS` 条目数 |
| 公式速查表 | `SHEET` 的**列数**；另注每列**式子条数** |
| 官方解答转写题数 | `HW_PROBLEMS` 中带 `official` 字段的条目数 |

漏改或手算就会留下与页面不符的数字；这类错数在公开站点上比功能缺失更伤可信度。

## 发布

- GitHub Pages 用 legacy 分支从 main 根目录构建：**push 即部署**，不需要 Actions workflow。
- 仓库 LICENSE 必须是纯净 MIT 文本（GitHub 靠它识别许可），第三方声明放 DISCLAIMER.md。
- 独立公开站点：发布前说明「任何人可访问」并让用户在原地更新 / 新建站点之间明确选择；
  原地更新沿用原网址，替换线上内容。
- 站点更新后 CDN 传播通常需要 1–2 分钟，测不通时退避重试。
- 交付 zip 时排除 `.git`，且先删旧 zip 再生成（`ZipFile.Open(..., 'Create')` 不覆盖已存在文件）。

常用命令：

```powershell
# 提交推送（main 即部署源）
git -C $repo add -A
git -C $repo -c core.autocrlf=false commit -m "..."
git -C $repo push origin main

# 查看 Pages 构建状态与仓库许可识别
gh api repos/<owner>/<repo>/pages
gh repo view <owner>/<repo> --json visibility,licenseInfo
```

注意 `git push` 在 PowerShell 里会把进度信息写到 stderr，看起来像报错；
配合 `2>&1` 与 `$ErrorActionPreference = 'Continue'` 使用，不要因此判定失败。
