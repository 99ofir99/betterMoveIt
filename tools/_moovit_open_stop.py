"""Open Moovit Stations tab and enter a nearby stop for design reference."""
import re
import subprocess
import time
from pathlib import Path

ADB = str(Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe")
DEV = ["-s", "emulator-5554"]
OUT = Path(r"C:\Users\ofir\OneDrive\Documents\betterMoveIt")


def sh(*a, timeout=90):
    return subprocess.run([ADB, *DEV, *a], capture_output=True, timeout=timeout)


def dump():
    sh("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    sh("pull", "/sdcard/ui.xml", str(OUT / "_tmp_moovit_ui.xml"))
    return (OUT / "_tmp_moovit_ui.xml").read_text(encoding="utf-8", errors="replace")


def nodes(xml: str):
    for m in re.finditer(r"<node [^>]+>", xml):
        tag = m.group(0)
        text = re.search(r'text="([^"]*)"', tag)
        desc = re.search(r'content-desc="([^"]*)"', tag)
        click = 'clickable="true"' in tag
        bounds = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
        if not bounds:
            continue
        x1, y1, x2, y2 = map(int, bounds.groups())
        yield {
            "text": text.group(1) if text else "",
            "desc": desc.group(1) if desc else "",
            "click": click,
            "cx": (x1 + x2) // 2,
            "cy": (y1 + y2) // 2,
            "y1": y1,
            "y2": y2,
        }


def tap(x, y, wait=1.2):
    sh("shell", "input", "tap", str(x), str(y))
    time.sleep(wait)


def shot(name: str):
    sh("shell", "screencap", "-p", "/sdcard/moovit_now.png")
    sh("pull", "/sdcard/moovit_now.png", str(OUT / name))


def find(xml, *needles, clickable=False):
    for n in nodes(xml):
        label = f"{n['text']} {n['desc']}".lower()
        if clickable and not n["click"]:
            continue
        if any(s.lower() in label for s in needles):
            return n
    return None


def main():
    # Ensure Moovit is foreground
    sh("shell", "monkey", "-p", "com.tranzmate", "-c", "android.intent.category.LAUNCHER", "1")
    time.sleep(2.5)

    xml = dump()
    # Dismiss keyboard / clear search if present
    clear = find(xml, "clear query", "navigate up", clickable=True)
    if clear and "clear" in f"{clear['text']} {clear['desc']}".lower():
        tap(clear["cx"], clear["cy"], 0.8)
        xml = dump()
    back = find(xml, "navigate up", clickable=True)
    if back:
        tap(back["cx"], back["cy"], 1.0)
        xml = dump()

    # Bottom nav: Stations
    stations = find(xml, "stations", "stations tab", clickable=True)
    if not stations:
        # Try Hebrew or resource-less labels near bottom
        bottom = [n for n in nodes(xml) if n["cy"] > 2000 and n["click"]]
        print("BOTTOM CLICKABLES:")
        for n in bottom:
            print(n)
        # Moovit nav order often: Directions, Stations, Lines, Favourites, More
        # Screen is usually 1080x2340 — Stations is second tab ~ center-left
        tap(324, 2270, 1.5)
        xml = dump()
    else:
        tap(stations["cx"], stations["cy"], 1.5)
        xml = dump()

    shot("_tmp_moovit_stations.png")
    print("--- STATIONS TAB ---")
    for n in nodes(xml):
        if n["text"] or (n["desc"] and len(n["desc"]) < 80):
            print(f"{n['text'] or n['desc']!r} [{n['cx']},{n['cy']}] click={n['click']}")

    # Tap first stop-looking clickable row below header
    candidates = [
        n
        for n in nodes(xml)
        if n["click"] and 400 < n["cy"] < 1900 and (n["text"] or n["desc"])
        and "station" not in f"{n['text']} {n['desc']}".lower()
        and "search" not in f"{n['text']} {n['desc']}".lower()
        and "tab" not in f"{n['text']} {n['desc']}".lower()
    ]
    # Prefer rows with stop-like names (Hebrew/English place names)
    pick = None
    for n in candidates:
        label = n["text"] or n["desc"]
        if len(label) >= 3 and not label.isdigit():
            pick = n
            break
    if not pick and candidates:
        pick = candidates[0]

    if pick:
        print(f"OPENING STOP: {pick}")
        tap(pick["cx"], pick["cy"], 2.5)
        xml = dump()
        shot("_tmp_moovit_stop_detail.png")
        print("--- STOP DETAIL ---")
        for n in nodes(xml):
            if n["text"] or (n["desc"] and len(n["desc"]) < 100):
                print(f"{n['text'] or n['desc']!r} [{n['cx']},{n['cy']}] click={n['click']}")
    else:
        print("No stop candidate found")


if __name__ == "__main__":
    main()
