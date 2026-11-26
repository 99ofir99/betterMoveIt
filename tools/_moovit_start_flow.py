"""From open Moovit line detail: change direction, pick stop, Start journey."""
import re
import subprocess
import time
from pathlib import Path

ADB = str(Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe")
DEV = ["-s", "emulator-5554"]
OUT = Path(r"C:\Users\ofir\OneDrive\Documents\betterMoveIt")


def sh(*a, timeout=90):
    r = subprocess.run([ADB, *DEV, *a], capture_output=True, timeout=timeout)
    return r.stdout


def dump():
    sh("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    sh("pull", "/sdcard/ui.xml", str(OUT / "_tmp_moovit_ui.xml"))
    return (OUT / "_tmp_moovit_ui.xml").read_text(encoding="utf-8", errors="replace")


def nodes(xml):
    for m in re.finditer(r"<node [^>]+/?>", xml):
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
            "y1": y1,
            "y2": y2,
            "text": text.group(1) if text else "",
            "desc": desc.group(1) if desc else "",
            "id": rid.group(1) if rid else "",
            "clickable": 'clickable="true"' in tag,
        }


def tap(x, y):
    sh("shell", "input", "tap", str(x), str(y))
    print("tap", x, y)


def shot(name):
    sh("shell", "screencap", "-p", "/sdcard/m.png")
    dest = OUT / name
    sh("pull", "/sdcard/m.png", str(dest))
    from PIL import Image

    im = Image.open(dest)
    im.resize((im.width // 3, im.height // 3)).save(dest.with_name(dest.stem + "_sm.png"))
    print("saved", name)


def find_text(xml, *needles, clickable_only=False):
    for n in nodes(xml):
        blob = (n["text"] + " " + n["desc"]).lower()
        if clickable_only and not n["clickable"]:
            continue
        if any(nd.lower() in blob for nd in needles):
            return n
    return None


def main():
    xml = dump()
    shot("_tmp_line_now.png")

    # Change direction
    ch = find_text(xml, "Change direction", "line_change_direction")
    if not ch:
        ch = next((n for n in nodes(xml) if n["id"].endswith("page_handle") or n["id"].endswith("line_direction_desc")), None)
    if ch:
        print("change", ch)
        # page_handle may be better
        handle = next((n for n in nodes(xml) if n["id"].endswith("page_handle")), ch)
        tap(handle["x"], handle["y"])
        time.sleep(2)
        shot("_tmp_after_change_dir.png")
        xml = dump()
        for n in nodes(xml):
            if n["id"].endswith("line_direction") or "←" in n["text"] or "→" in n["text"]:
                print("DIR", n["text"])

    # Tap a later stop (not first)
    stops = [
        n
        for n in nodes(xml)
        if n["clickable"] and 1100 < n["y1"] < 1900 and (n["y2"] - n["y1"]) >= 70
    ]
    print("stops", [(s["y1"], s["text"][:40], s["id"].split("/")[-1]) for s in stops[:12]])
    if stops:
        # pick ~3rd
        s = stops[min(2, len(stops) - 1)]
        print("picking stop", s)
        tap(s["x"], s["y"])
        time.sleep(1.5)
        shot("_tmp_stop_expanded.png")
        xml = dump()

    # Tap Start
    start = find_text(xml, "Start", clickable_only=True)
    if start:
        print("START btn", start)
        tap(start["x"], start["y"])
        time.sleep(2.5)
        shot("_tmp_after_start.png")
        xml = dump()
        print("--- AFTER START ---")
        for n in nodes(xml):
            if n["text"]:
                print(f"{n['y1']:4d} {n['text'][:80]}")

        # If where do you want / pick destination, pick a later stop
        if any("want to go" in n["text"].lower() for n in nodes(xml)) or any(
            "destination" in n["text"].lower() for n in nodes(xml)
        ):
            dests = [
                n
                for n in nodes(xml)
                if n["clickable"] and 900 < n["y1"] < 2000 and (n["y2"] - n["y1"]) >= 70
            ]
            if dests:
                d = dests[min(4, len(dests) - 1)]
                print("dest", d["y1"], d["text"])
                tap(d["x"], d["y"])
                time.sleep(3)
                shot("_tmp_onboard_like.png")
                xml = dump()
                print("--- ONBOARD ---")
                for n in nodes(xml):
                    if n["text"]:
                        print(f"{n['y1']:4d} {n['text'][:80]}")


if __name__ == "__main__":
    main()
