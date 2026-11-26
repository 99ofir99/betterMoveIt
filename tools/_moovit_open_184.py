"""Tap the Tnufa 184 result and explore line detail / ride-from-stop UX."""
import re
import subprocess
import time
from pathlib import Path

ADB = Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe"
DEVICE = "emulator-5554"
OUT = Path(r"C:\Users\ofir\OneDrive\Documents\betterMoveIt")


def adb(*args: str) -> bytes:
    return subprocess.run([str(ADB), "-s", DEVICE, *args], capture_output=True).stdout


def dump() -> str:
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    adb("pull", "/sdcard/ui.xml", str(OUT / "_tmp_moovit_ui.xml"))
    return (OUT / "_tmp_moovit_ui.xml").read_text(encoding="utf-8", errors="replace")


def nodes(xml: str):
    for m in re.finditer(r"<node [^>]+>", xml):
        tag = m.group(0)
        bm = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
        if not bm:
            continue
        x1, y1, x2, y2 = map(int, bm.groups())
        text = re.search(r'text="([^"]*)"', tag)
        desc = re.search(r'content-desc="([^"]*)"', tag)
        rid = re.search(r'resource-id="([^"]*)"', tag)
        yield {
            "x": (x1 + x2) // 2,
            "y": (y1 + y2) // 2,
            "bounds": (x1, y1, x2, y2),
            "text": text.group(1) if text else "",
            "desc": desc.group(1) if desc else "",
            "id": rid.group(1) if rid else "",
            "clickable": 'clickable="true"' in tag,
        }


def tap(x, y):
    adb("shell", "input", "tap", str(x), str(y))
    print("tap", x, y)


def shot(name: str):
    adb("shell", "screencap", "-p", "/sdcard/moovit_screen.png")
    dest = OUT / name
    adb("pull", "/sdcard/moovit_screen.png", str(dest))
    from PIL import Image

    im = Image.open(dest)
    im.resize((im.width // 3, im.height // 3)).save(dest.with_name(dest.stem + "_sm.png"))
    print("saved", name)


def main():
    xml = dump()
    # Tap Oranit / Petah Tikva result via content-desc
    target = next((n for n in nodes(xml) if "אורנית" in n["desc"] or "אורנית" in n["text"]), None)
    if not target:
        print("no oranit row; dumping texts")
        for n in nodes(xml):
            if n["text"] or ("↔" in n["desc"]):
                print(n["bounds"], n["text"], n["desc"][:80], n["clickable"])
        return
    print("found", target)
    tap(target["x"], target["y"])
    time.sleep(2.5)
    shot("_tmp_moovit_line_detail2.png")
    xml = dump()
    for n in nodes(xml):
        if n["text"] or (n["desc"] and "tab" not in n["desc"].lower()):
            if n["y"] < 2200:
                print(f"{n['bounds']} click={n['clickable']} text={n['text']!r} desc={n['desc'][:70]!r} id={n['id']}")

    # Look for swap / direction
    for n in nodes(xml):
        blob = f"{n['text']} {n['desc']} {n['id']}".lower()
        if any(k in blob for k in ("direction", "swap", "reverse", "flip", "switch", "change destination", "כיוון", "החלף", "יעד")):
            print("CTRL", n)

    # Tap a mid stop if list visible
    stops = [n for n in nodes(xml) if n["clickable"] and n["y"] > 700 and n["y"] < 1800 and (n["text"] or "stop" in n["id"])]
    print("stop-ish", len(stops))
    if stops:
        mid = stops[len(stops) // 2]
        print("tapping stop", mid)
        tap(mid["x"], mid["y"])
        time.sleep(2)
        shot("_tmp_moovit_stop_from_line.png")
        xml = dump()
        texts = [n["text"] for n in nodes(xml) if n["text"]]
        print("AFTER STOP TEXTS", texts[:50])


if __name__ == "__main__":
    main()
