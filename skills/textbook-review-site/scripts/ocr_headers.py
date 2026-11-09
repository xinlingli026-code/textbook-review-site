#!/usr/bin/env python
"""ocr_headers.py — 扫描件定位章节：OCR 每页页眉，打印「第几页 → 页眉文字」。

用法:
    python ocr_headers.py <pdf> --from 1 --to 40 [--band 120]

先用它把「哪一页属于哪一节」摸出来，再只让视觉模型转写真正需要的几页。
需要 rapidocr-onnxruntime：python -m pip install rapidocr-onnxruntime
"""
import os
import sys

import pymupdf
from rapidocr_onnxruntime import RapidOCR

# Windows 控制台默认 GBK，OCR 结果里的符号会编码失败
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
    start, end, band = 1, None, 120
    i = 0
    while i < len(args):
        if args[i] == "--from":
            i += 1
            start = int(args[i])
        elif args[i] == "--to":
            i += 1
            end = int(args[i])
        elif args[i] == "--band":
            i += 1
            band = int(args[i])
        else:
            print("unknown arg:", args[i])
            sys.exit(1)
        i += 1

    doc = pymupdf.open(pdf)
    end = min(end or doc.page_count, doc.page_count)
    ocr = RapidOCR()
    tmp = os.path.join(os.environ.get("TEMP", "."), "ocr_band.png")
    for pno in range(start, end + 1):
        page = doc[pno - 1]
        r = page.rect
        clip = pymupdf.Rect(0, 0, r.width, min(r.height, band))
        pix = page.get_pixmap(matrix=pymupdf.Matrix(2.4, 2.4), clip=clip)
        pix.save(tmp)
        res, _ = ocr(tmp)
        head = " | ".join(x[1] for x in res) if res else ""
        print(pno, head[:150])


if __name__ == "__main__":
    main()
