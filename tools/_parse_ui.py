"""Parse uiautomator dump and print clickable-ish nodes."""
import re
import sys
from pathlib import Path

xml = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
for m in re.finditer(r"<node [^>]+>", xml):
    tag = m.group(0)
    text = re.search(r'text="([^"]*)"', tag)
    desc = re.search(r'content-desc="([^"]*)"', tag)
    bm = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    rid = re.search(r'resource-id="([^"]*)"', tag)
    t = text.group(1) if text else ""
    d = desc.group(1) if desc else ""
    if not (t or d):
        continue
    if not bm:
        continue
    x1, y1, x2, y2 = map(int, bm.groups())
    click = 'clickable="true"' in tag
    print(
        f"{(x1 + x2) // 2:4d},{(y1 + y2) // 2:4d} click={click} "
        f"id={(rid.group(1) if rid else '')!r} text={t!r} desc={d!r}"
    )
