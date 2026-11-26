"""Open Moovit line detail for 184 Tnufa with precise taps."""
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
            "x1": x1,
            "y1": y1,
            "x2": x2,
            "y2": y2,
            "text": text.group(1) if text else "",
            "desc": desc.group(1) if desc else "",
            "id": rid.group(1) if rid else "",
            "clickable": 'clickable="true"' in tag,
            "class": (re.search(r'class="([^"]*)"', tag) or ["", ""])[1],
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


def main():
    # Hide keyboard
    sh("shell", "input", "keyevent", "KEYCODE_BACK")
    time.sleep(0.6)

    xml = dump()
    # Find Oranit text node, then nearest clickable ancestor-like node covering it
    label = next((n for n in nodes(xml) if "אורנית" in n["text"] or "אורנית" in n["desc"]), None)
    if not label:
        print("label missing")
        shot("_tmp_no_label.png")
        return
    print("label", label["y1"], label["y2"], label["text"] or label["desc"])

    # Prefer clickable node that vertically contains the label center
    cy = label["y"]
    cands = [
        n
        for n in nodes(xml)
        if n["clickable"] and n["y1"] <= cy <= n["y2"] and n["x2"] - n["x1"] > 400
    ]
    cands.sort(key=lambda n: (n["y2"] - n["y1"]))  # smallest enclosing
    print("enclosing", [(c["y1"], c["y2"], c["id"], c["class"].split(".")[-1]) for c in cands[:5]])
    target = cands[0] if cands else label
    tap(target["x"], target["y"])
    time.sleep(3.5)
    shot("_tmp_opened_line.png")
    xml = dump()
    focus = sh("shell", "dumpsys", "window").decode("utf-8", "replace")
    m = re.search(r"mCurrentFocus=([^\n]+)", focus)
    print("focus", m.group(1) if m else "?")

    interesting = []
    for n in nodes(xml):
        blob = f"{n['text']} {n['desc']} {n['id']}"
        if any(
            k in blob.lower()
            for k in (
                "change direction",
                "where do you want",
                "stops",
                "schedule",
                "line_direction",
                "page_handle",
                "directions_bar",
                "trip_on_map",
            )
        ) or (n["text"] and n["y1"] < 900):
            interesting.append(n)
    for n in interesting[:60]:
        print(
            f"{n['y1']:4d}-{n['y2']:4d} click={n['clickable']} "
            f"{n['id'].split('/')[-1][:28]:28s} {n['text'][:40]!r} {n['desc'][:40]!r}"
        )

    # Try change direction
    ch = next(
        (
            n
            for n in nodes(xml)
            if "change direction" in (n["text"] + n["desc"]).lower()
            or n["id"].endswith("page_handle")
            or n["id"].endswith("line_direction")
        ),
        None,
    )
    if ch:
        print("CHANGE", ch["id"], ch["text"], ch["desc"])
        tap(ch["x"], ch["y"])
        time.sleep(2)
        shot("_tmp_changed_dir.png")

    # Tap mid stop — look for list items with stop-ish classes
    xml = dump()
    stops = [
        n
        for n in nodes(xml)
        if n["clickable"]
        and 800 < n["y1"] < 1900
        and (n["y2"] - n["y1"]) > 60
        and (n["x2"] - n["x1"]) > 500
    ]
    print("possible stops", len(stops))
    for s in stops[:10]:
        print(s["y1"], s["y2"], s["id"], s["text"][:40], s["class"].split(".")[-1])
    if len(stops) >= 3:
        tap(stops[2]["x"], stops[2]["y"])
        time.sleep(2)
        shot("_tmp_picked_stop.png")
        xml = dump()
        for n in nodes(xml):
            if n["text"] and ("want" in n["text"].lower() or "go" in n["text"].lower() or n["y1"] < 500):
                print("hdr", n["text"])
        # pick later stop as destination
        stops2 = [
            n
            for n in nodes(xml)
            if n["clickable"] and 800 < n["y1"] < 1900 and (n["y2"] - n["y1"]) > 60
        ]
        if len(stops2) >= 5:
            tap(stops2[-2]["x"], stops2[-2]["y"])
            time.sleep(3)
            shot("_tmp_picked_dest.png")
            xml = dump()
            print("DEST TEXTS:")
            for n in nodes(xml):
                if n["text"]:
                    print(f"  {n['y1']:4d} {n['text'][:70]}")


if __name__ == "__main__":
    main()
