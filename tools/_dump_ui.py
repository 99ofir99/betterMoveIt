"""Dump current emulator UI texts."""
import re
import subprocess
from pathlib import Path

ADB = str(Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe")
DEV = ["-s", "emulator-5554"]
OUT = Path(r"C:\Users\ofir\OneDrive\Documents\betterMoveIt")


def sh(*a, timeout=60):
    return subprocess.run([ADB, *DEV, *a], capture_output=True, timeout=timeout)


def dump():
    sh("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    sh("pull", "/sdcard/ui.xml", str(OUT / "_tmp_moovit_ui.xml"))
    return (OUT / "_tmp_moovit_ui.xml").read_text(encoding="utf-8", errors="replace")


def main():
    xml = dump()
    for m in re.finditer(r"<node [^>]+>", xml):
        tag = m.group(0)
        text = re.search(r'text="([^"]*)"', tag)
        desc = re.search(r'content-desc="([^"]*)"', tag)
        bounds = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
        t = text.group(1) if text else ""
        d = desc.group(1) if desc else ""
        label = t or d
        if not label or len(label) > 100:
            continue
        b = ""
        if bounds:
            x1, y1, x2, y2 = map(int, bounds.groups())
            b = f" [{(x1+x2)//2},{(y1+y2)//2}]"
        print(f"{label!r}{b}")


if __name__ == "__main__":
    main()
