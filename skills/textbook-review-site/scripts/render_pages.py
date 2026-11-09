#!/usr/bin/env python
"""render_pages.py — 把 PDF 页面（或裁剪区域）渲染成 PNG，供视觉模型读公式。

用法:
    python render_pages.py <pdf> --pages 267,268 --out <dir> [--zoom 2.4]
    python render_pages.py <pdf> --pages 249 --out <dir> --crop 0.55,0.03,1.0,0.15 --zoom 5.0

--crop 接受相对页宽/页高的比例 (x0,y0,x1,y1)，用来只看某道题所在的区域。
本脚本只依赖 PyMuPDF；输出 UTF-8 PNG。
"""
import os
import sys

import pymupdf

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    pdf = sys.argv[1]
    args = sys.argv[2:]
    pages = None
    out = "."
    zoom = 2.4
    crop = None
    i = 0
    while i < len(args):
        if args[i] == "--pages":
            i += 1
            pages = [int(x) for x in args[i].split(",")]
        elif args[i] == "--out":
            i += 1
            out = args[i]
        elif args[i] == "--zoom":
            i += 1
            zoom = float(args[i])
        elif args[i] == "--crop":
            i += 1
            crop = [float(x) for x in args[i].split(",")]
        else:
            print("unknown arg:", args[i])
            sys.exit(1)
        i += 1
    if not pages:
        print("--pages is required")
        sys.exit(1)

    os.makedirs(out, exist_ok=True)
    doc = pymupdf.open(pdf)
    for pno in pages:
        if pno < 1 or pno > doc.page_count:
            print("skip page", pno, "(out of range, total %d)" % doc.page_count)
            continue
        page = doc[pno - 1]
        r = page.rect
        if crop:
            clip = pymupdf.Rect(r.width * crop[0], r.height * crop[1],
                                r.width * crop[2], r.height * crop[3])
        else:
            clip = r
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip)
        dest = os.path.join(out, "p%03d.png" % pno)
        pix.save(dest)
        print(dest, pix.width, "x", pix.height)


if __name__ == "__main__":
    main()
