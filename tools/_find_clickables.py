import re
from pathlib import Path

xml = Path(r"C:\Users\ofir\OneDrive\Documents\betterMoveIt\_tmp_moovit_ui.xml").read_text(
    encoding="utf-8"
)
for m in re.finditer(r"<node [^>]+>", xml):
    tag = m.group(0)
    if 'clickable="true"' not in tag:
        continue
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    if not b:
        continue
    x1, y1, x2, y2 = map(int, b.groups())
    if y1 < 1800:
        continue
    t = re.search(r'text="([^"]*)"', tag)
    d = re.search(r'content-desc="([^"]*)"', tag)
    c = re.search(r'class="([^"]*)"', tag)
    label = (t.group(1) if t else "") or (d.group(1) if d else "")
    print(y1, y2, (x1 + x2) // 2, (y1 + y2) // 2, c.group(1) if c else "", label)
