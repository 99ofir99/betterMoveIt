"""Open a Moovit line detail and capture stop / ride UX."""
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
        clickable = 'clickable="true"' in tag
        yield {
            "x": (x1 + x2) // 2,
            "y": (y1 + y2) // 2,
            "y1": y1,
            "text": text.group(1) if text else "",
            "desc": desc.group(1) if desc else "",
            "id": rid.group(1) if rid else "",
            "clickable": clickable,
            "tag": tag[:220],
        }


def tap(x, y):
    adb("shell", "input", "tap", str(x), str(y))
    print(f"tap {x},{y}")


def shot(name: str):
    adb("shell", "screencap", "-p", "/sdcard/moovit_screen.png")
    dest = OUT / name
    adb("pull", "/sdcard/moovit_screen.png", str(dest))
    from PIL import Image

    im = Image.open(dest)
    sm = im.resize((im.width // 3, im.height // 3))
    sm_path = dest.with_name(dest.stem + "_sm.png")
    sm.save(sm_path)
    print("saved", sm_path.name)


def dismiss_overlays(xml: str):
    for n in nodes(xml):
        t = (n["text"] or "").lower()
        if t in ("got it", "got it!", "try now", "close", "not now"):
            if t == "try now":
                continue
            tap(n["x"], n["y"])
            time.sleep(0.8)
            return True
    return False


def main():
    xml = dump()
    dismiss_overlays(xml)
    xml = dump()

    # Ensure on lines / search
    line_tab = next((n for n in nodes(xml) if "Lines tab" in n["desc"]), None)
    if line_tab:
        tap(line_tab["x"], line_tab["y"])
        time.sleep(1)

    xml = dump()
    search = next((n for n in nodes(xml) if n["id"].endswith("search_proxy") or n["text"] == "Search for a line"), None)
    if search:
        tap(search["x"], search["y"])
        time.sleep(0.7)

    # Clear and type 184
    adb("shell", "input", "keyevent", "KEYCODE_MOVE_END")
    for _ in range(8):
        adb("shell", "input", "keyevent", "KEYCODE_DEL")
    adb("shell", "input", "text", "184")
    time.sleep(1.8)
    shot("_tmp_moovit_search184.png")

    xml = dump()
    # Prefer Tnufa / Oranit / Petah Tikva row — y below search area
    candidates = [
        n
        for n in nodes(xml)
        if n["clickable"]
        and n["y1"] > 400
        and (
            "184" in n["text"]
            or "אורנית" in n["text"]
            or "פתח" in n["text"]
            or "Tnufa" in n["text"]
            or "line" in n["desc"].lower()
        )
    ]
    print("candidates", len(candidates))
    for c in candidates[:8]:
        print(c["y1"], c["text"][:40], c["desc"][:60], c["id"])

    # Also look for list item containers
    list_items = [
        n
        for n in nodes(xml)
        if n["clickable"] and n["y1"] > 550 and ("line" in n["id"] or "item" in n["id"] or n["id"].endswith("container"))
    ]
    print("list_items", [(i["y1"], i["id"], i["text"][:30]) for i in list_items[:10]])

    target = None
    # Prefer third visual result around y~900-1100 for Petah Tikva 184
    for n in nodes(xml):
        if n["clickable"] and 850 <= n["y1"] <= 1200 and ("container" in n["id"] or "root" in n["id"] or n["text"]):
            target = n
            break
    if not target and candidates:
        target = candidates[-1]
    if not target and list_items:
        target = list_items[-1] if len(list_items) > 2 else list_items[0]

    if not target:
        # Hard tap approximate third result from previous screenshot (~y 980)
        tap(540, 980)
    else:
        print("opening", target["y1"], target["id"], target["text"][:50])
        tap(target["x"], target["y"])

    time.sleep(2.5)
    shot("_tmp_moovit_line_open.png")
    xml = dump()
    # Print interesting texts
    texts = [n["text"] for n in nodes(xml) if n["text"]]
    print("TEXTS:", texts[:40])
    descs = [n["desc"] for n in nodes(xml) if n["desc"] and "tab" not in n["desc"].lower()]
    print("DESCS:", descs[:20])

    # Look for direction swap / change direction buttons
    for n in nodes(xml):
        blob = (n["text"] + " " + n["desc"] + " " + n["id"]).lower()
        if any(k in blob for k in ("direction", "swap", "reverse", "change", "flip", "switch", "החלף", "כיוון")):
            print("DIR CTRL", n["x"], n["y"], n["text"], n["desc"], n["id"])


if __name__ == "__main__":
    main()
