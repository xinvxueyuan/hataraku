"""Rebuild the embedded OG font subset.

The repo embeds the font as base64 in apps/web/src/app/api/og/og-font.ts so the route renders
without network access and without a traced sidecar file. Regenerate it with:

    python -m pip install fonttools
    python artifacts/h28/make-font.py

The source is Noto Sans SC Regular (SIL OFL):
https://github.com/googlefonts/noto-cjk/blob/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf
"""
import pathlib
import subprocess
import tempfile

REPO = pathlib.Path(__file__).resolve().parents[2]
FONT_DIR = REPO / "apps" / "web" / "src" / "app" / "api" / "og"
SUBSET = FONT_DIR / "NotoSansSC-Og.otf"
TARGET = FONT_DIR / "og-font.ts"
# Download the upstream font first (SIL OFL), e.g.:
#   curl -L -o "$TEMP/NotoSansSC-Regular.otf" https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf
SOURCE = pathlib.Path(tempfile.gettempdir()) / "NotoSansSC-Regular.otf"

chars = set()
for high in range(0xB0, 0xF8):
    for low in range(0xA1, 0xFF):
        try:
            chars.add(bytes([high, low]).decode("gb2312"))
        except UnicodeDecodeError:
            pass
chars.update(chr(code) for code in range(0x20, 0x7F))
chars.update("　、。《》「」『』…—·“”‘’！？：；（）【】〈〉～￥％＋－×÷＝")
chars.update("夜行栈微文项目工具箱更新日志首页文章归档分类相册关于搜索文档")

with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as handle:
    handle.write("".join(sorted(chars)))
    charset_path = handle.name

subprocess.run(
    [
        "python", "-m", "fontTools.subset", str(SOURCE),
        f"--text-file={charset_path}",
        f"--output-file={SUBSET}",
        "--layout-features=*",
        "--no-hinting",
        "--desubroutinize",
    ],
    check=True,
)

import base64

font = SUBSET.read_bytes()
encoded = base64.b64encode(font).decode("ascii")
chunks = [encoded[index : index + 120] for index in range(0, len(encoded), 120)]
body = "\n".join(f'  "{chunk}",' for chunk in chunks)
TARGET.write_text(
    'import { Buffer } from "node:buffer";\n\n'
    "const FONT_BASE64 = [\n" + body + '\n].join("");\n\n'
    "export const OG_FONT = Buffer.from(FONT_BASE64, \"base64\");\n",
    encoding="utf-8",
)
print(f"font {len(font)} bytes, module {len(encoded)} base64 chars")