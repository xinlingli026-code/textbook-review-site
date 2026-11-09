# PDF 提取实战手册

教材类 PDF 有三种形态，处理路径完全不同。**先判定形态，再动手**，否则会在错误的路径上浪费大量时间。

## 1. 形态判定

用 PyMuPDF 逐页取文本长度：

```python
import pymupdf
doc = pymupdf.open(PATH)
for i in (0, 50, 120, 200):
    if i < doc.page_count:
        print(i + 1, len(doc[i].get_text().strip()), len(doc[i].get_images()))
```

| 观察 | 形态 | 路径 |
|---|---|---|
| `textlen > 0`，英文散文正常、公式符号错乱 | 文字层编码映射被破坏 | 散文可用，**公式必须走图像** |
| `textlen == 0`，每页一张大图 | 扫描件 | 全走「渲染 → OCR 定位 → 视觉转写」 |
| `textlen > 0` 且公式正常 | 电子版 | 直接抽文本即可 |

三种形态在同一次任务里可能同时出现（教材是电子版、详解手册是扫描件）。

## 2. 页码映射

印刷页码与 PDF 物理页通常差一个固定偏移（前置封面/目录/前言页数）。

- 抽页眉或页脚找印刷页码：`page.get_text()` 里的孤立数字，或渲染页眉条带后 OCR。
- 目录页常直接给出「节标题 → 印刷页」，用它锁定小节起始页。
- 偏移确定后，**必须裁一张图肉眼验证**（渲染该页、只看目标区域），
  避免整节错位 1–2 页还浑然不觉。

**每个文件单独测偏移**：同一套书的教材与详解手册偏移往往不同
（实测某版 Stewart：教材 印刷页 = PDF 页 − 32，详解手册 = PDF 页 − 11）。
把某一本书的偏移当成通用常数会让整章错位二十多页。

## 2.1 顺带核对用户给的前提

用户口述的节号、节标题、页码范围经常与教材不一致（同一本 Stewart 里
逆三角函数求导在 3.5 内，3.8 却是指数增长与衰减）。
先用目录页/页眉确认教材实际的编排，再决定按用户说法做还是按教材做；
不一致时按教材执行，并在交付里点明差异。

## 3. 渲染成图

```python
page = doc[pno - 1]
pix = page.get_pixmap(matrix=pymupdf.Matrix(2.4, 2.4))   # 整页
pix.save(out_png)
# 或裁剪目标区域，放大到能看清公式
r = page.rect
clip = pymupdf.Rect(r.width * x0, r.height * y0, r.width * x1, r.height * y1)
page.get_pixmap(matrix=pymupdf.Matrix(5.0, 5.0), clip=clip).save(out_png)
```

- 整页图适合让视觉模型批量读多题；裁剪图适合核对单个可疑公式。
- 放大倍数 2.4 足够读印刷体公式，5.0 以上适合核对上下标与分式。

## 4. 扫描件的两段式 OCR

**第一段：本地 OCR 定位章节。** rapidocr 跑页眉条带（页面上方 120pt），几十页几十秒，
产出「第几页属于哪一节」的映射。视觉模型逐页找章节太慢，先用便宜的手段缩小范围。

**第二段：视觉模型转写目标内容。** 只让它转写指定题号：

```
This is a scanned page of the official Student Solutions Manual. Transcribe the FULL
worked solution for exercise number(s) 27,35 that appear on this page. Give the starting
equation, every algebraic step, and the final answer, in LaTeX. If none of the listed
exercise numbers appear on this page, reply with exactly: NONE.
```

要点：
- **一批 2–3 页**，一次 6 页以上会 `UND_ERR_HEADERS_TIMEOUT`。
- 提示里写「不在这页就回 NONE」，可避免模型把邻页的题号张冠李戴。
- 模型偶尔会把第 3 题的续页当成第 1 题，**核对每题编号与题干是否对得上**，
  对不上就回原图重读那几页。

## 5. 视觉调用

```powershell
# 1) 本地 PNG → 临时公网 URL（视觉工具只吃 URL）
mcode-tools upload-temp-url "<abs>\p123.png" --mime-type image/png
# 2) 参数写 JSON 文件再调用，避免命令行转义
mcode-tools connector call connector__matrix__describe_images --args-file "<abs>\args.json"
```

`args.json` 结构：

```json
{"image_info":[{"url":"<temp_url>","mime_type":"image/png","prompt":"..."}]}
```

## 6. 公式转写后的清洗

视觉模型输出常带 Markdown 与展示块，站点只支持行内 `$...$`：

- `$$...$$` → `$...$`；`\[ \]` → `$...$`；去掉 `**`、`\medskip`、`---`。
- Unicode 撇号 `′` → `'`；全角括号 → 半角。
- 行内分式建议加 `\displaystyle`，否则行高会被压扁。

## 7. 官方解答的正确用法

官方解答的价值不在「答案」，而在**它能反推题干原文**：

- 解答第一步的求导式 = 题目的隐函数方程（例：解答写 `x²·2yy′ + y²·2x + x·y′ + y = 0`
  就说明题目是 `x²y² + xy = 2`，而不是文本层误读的 `x² + y² + xy = 2`）。
- 解答最后一步 = 你的推导校验。

发现手册自身前后不一致（求导式与最后代入的方程对不上）时：
**以教材题干 + 你的推导为准**，站内加「核对」提示，不要照抄手册的错误答案。

## 8. 已知的坑（真实案例）

| 现象 | 真相 |
|---|---|
| 文本层把 `x² + y² + xy` 读成 `x²y² + xy` | 字符重排；两种读法都「通顺」，必须用图像或官方解答定性 |
| 文本层把 `−`（减号）映射成 `=` | 任何算式都要视觉复核，答案算错就是这里来的 |
| 详解手册某题没收录解答 | 该题只能自推导，站内注明来源缺失 |
| 手册解答与教材题干冲突 | 手册可能有印刷错误；以教材为准 |
