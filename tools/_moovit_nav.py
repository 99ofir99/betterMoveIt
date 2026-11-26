"""Navigate Moovit emulator to Lines and capture line detail UX."""
import re
import subprocess
import time
from pathlib import Path

ADB = r"%s\Android\Sdk\platform-tools\adb.exe" % __import__("os").environ["LOCALAPPDATA"]
DEVICE = "emulator-5554"
OUT = Path(r"C:\Users\ofir\OneDrive\Documents\betterMoveIt")


def adb(*args: str) -> str:
    r = subprocess.run([ADB, "-s", DEVICE, *args], capture_output=True)
    return (r.stdout or b"").decode("utf-8", errors="replace")


def dump_ui() -> str:
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    adb("pull", "/sdcard/ui.xml", str(OUT / "_tmp_moovit_ui.xml"))
    return (OUT / "_tmp_moovit_ui.xml").read_text(encoding="utf-8", errors="replace")


def find_bounds(xml: str, needle: str):
    # Find node whose content-desc or text contains needle
    for m in re.finditer(r'<node [^>]+>', xml):
        tag = m.group(0)
        if needle.lower() not in tag.lower():
            continue
        bm = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
        if bm:
            x1, y1, x2, y2 = map(int, bm.groups())
            return (x1 + x2) // 2, (y1 + y2) // 2, tag[:180]
    return None


def tap(x: int, y: int):
    adb("shell", "input", "tap", str(x), str(y))


def shot(name: str):
    adb("shell", "screencap", "-p", "/sdcard/moovit_screen.png")
    dest = OUT / name
    adb("pull", "/sdcard/moovit_screen.png", str(dest))
    from PIL import Image

    im = Image.open(dest)
    sm = im.resize((im.width // 3, im.height // 3))
    sm_path = dest.with_name(dest.stem + "_sm.png")
    sm.save(sm_path)
    print("saved", sm_path)


def main():
    xml = dump_ui()
    hit = find_bounds(xml, "Lines tab")
    print("Lines tab:", hit)
    if not hit:
        print("focus:", adb("shell", "dumpsys", "window").split("mCurrentFocus=")[1][:120])
        return
    tap(hit[0], hit[1])
    time.sleep(1.5)
    xml = dump_ui()
    # Look for search field / first line
    for label in ("Search for a line", "Search", "Favourites", "All", "Bus"):
        print(label, find_bounds(xml, label))
    shot("_tmp_moovit_lines.png")
    # Tap search if present
    search = find_bounds(xml, "Search for a line") or find_bounds(xml, "Search")
    if search:
        tap(search[0], search[1])
        time.sleep(0.8)
        adb("shell", "input", "text", "184")
        time.sleep(1.5)
        shot("_tmp_moovit_lines_search.png")
        xml = dump_ui()
        # tap first result that looks like a line
        for needle in ("184", "Bus"):
            hit2 = find_bounds(xml, needle)
            print("result", needle, hit2)
            if hit2 and "tab" not in (hit2[2] or "").lower():
                tap(hit2[0], hit2[1])
                time.sleep(2)
                shot("_tmp_moovit_line_detail.png")
                break


if __name__ == "__main__":
    main()
