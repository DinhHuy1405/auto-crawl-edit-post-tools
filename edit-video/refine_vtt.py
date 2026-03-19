#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
clean_subtitles_fixed.py
────────────────────────
• Quét đệ quy thư mục TARGET_FOLDER.
• Làm sạch mọi file .vtt/.srt tại chỗ (không đổi đuôi).
• Ghim dòng  NOTE downloaded_date: YYYY-MM-DD  ở đầu file.

👉  Chỉ cần:  python clean_subtitles_fixed.py
"""

import os, re, glob

# ======== CHỈ SỬA 2 DÒNG NÀY ========
TARGET_FOLDER = "/Users/nguyendinhhuy/Documents/Edit Video/Thời Sự/2025-06-19"
TARGET_DATE   = "2025-06-19"
# ====================================


def clean_content(text: str) -> str:
    """Xoá tag, time-code, dòng trống…"""
    text = re.sub(r'<c>.*?</c>', '', text, flags=re.S)
    text = re.sub(r'<\d{2}:\d{2}:\d{2}\.\d+>', '', text)
    text = re.sub(r'\[\w+\]', '', text)
    text = re.sub(r'\d{2}:\d{2}:\d{2}\.\d+\s*-->\s*\d{2}:\d{2}:\d{2}\.\d+.*', '', text)
    text = re.sub(r'align:start position:0%', '', text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines)


def process_sub_file(path: str) -> None:
    """Làm sạch & ghim ngày vào đúng file gốc."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
        cleaned_body = clean_content(raw)
        note_line = f"NOTE downloaded_date: {TARGET_DATE}"
        new_content = f"{note_line}\n\n{cleaned_body}"
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"✓ Đã clean: {path}")
    except Exception as e:
        print(f"✗ Lỗi với {path}: {e}")


def batch_clean(folder: str) -> None:
    """Tìm mọi .vtt & .srt trong folder (đệ quy) rồi xử lý."""
    subs = glob.glob(os.path.join(folder, "**", "*.vtt"), recursive=True) + \
           glob.glob(os.path.join(folder, "**", "*.srt"), recursive=True)

    if not subs:
        print("Không tìm thấy phụ đề nào.")
        return

    print(f"Đang xử lý {len(subs)} file phụ đề …")
    for fp in subs:
        process_sub_file(fp)


if __name__ == "__main__":
    if not os.path.isdir(TARGET_FOLDER):
        print(f"Thư mục không tồn tại: {TARGET_FOLDER}")
    else:
        batch_clean(TARGET_FOLDER)
