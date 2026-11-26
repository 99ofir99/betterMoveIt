"""Moovit: Lines -> search 184 Tnufa -> open -> change direction / pick stops."""
import re
import subprocess
import time
from pathlib import Path

ADB = Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe"
DEV = ["-s", "emulator-5554"]
OUT = Path(r"C:\Users\ofir\OneDrive\Documents\betterMoveIt")


def sh(*args, timeout=60):
    return subprocess.run([str(ADB), *DEV, *args], capture_output=True, timeout=timeout)


def dump():
    sh("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    sh("pull", "/sdcard/ui.xml", str(OUT / "_tmp_moovit_ui.xml"))
    return (OUT / "_tmp_moovit_ui.xml").read_text(encoding="utf-8", errors="replace")


def nodes(xml):
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
            "y1": y1,
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


def find(xml, pred):
    for n in nodes(xml):
        if pred(n):
            return n
    return None


def main():
    xml = dump()
    # Dismiss GOT IT if any
    got = find(xml, lambda n: n["text"].upper() in ("GOT IT", "GOT IT!"))
    if got:
        tap(got["x"], got["y"])
        time.sleep(0.8)
        xml = dump()

    lines = find(xml, lambda n: "Lines tab" in n["desc"])
    if lines:
        tap(lines["x"], lines["y"])
        time.sleep(1.5)

    xml = dump()
    search = find(xml, lambda n: n["text"] == "Search for a line" or n["id"].endswith("search_proxy"))
    if search:
        tap(search["x"], search["y"])
        time.sleep(0.8)
    # type
    sh("shell", "input", "text", "184")
    time.sleep(2.0)
    shot("_tmp_flow_search.png")
    xml = dump()

    # Tap by content-desc containing Oranit
    row = find(xml, lambda n: "אורנית" in n["desc"] or "אורנית" in n["text"])
    if not row:
        # fallback: 3rd ↔ row
        rows = [n for n in nodes(xml) if "↔" in n["desc"] or "↔" in n["text"]]
        print("rows", [(r["y1"], r["desc"] or r["text"]) for r in rows])
        row = rows[2] if len(rows) >= 3 else (rows[-1] if rows else None)
    if not row:
        print("no row")
        return
    print("open", row["desc"] or row["text"], row["y1"])
    tap(row["x"], row["y"])
    time.sleep(3.0)
    shot("_tmp_flow_detail.png")
    xml = dump()
    print("--- DETAIL ---")
    for n in nodes(xml):
        if n["text"] or ("Change" in n["desc"]) or n["id"].endswith(("line_direction", "line_direction_desc", "page_handle", "directions_bar")):
            if n["y1"] < 2100:
                print(f"{n['y1']:4d} click={n['clickable']} id={n['id'].split('/')[-1]:28s} text={n['text'][:50]!r} desc={n['desc'][:50]!r}")

    # Change direction
    ch = find(xml, lambda n: "change direction" in (n["text"] + n["desc"]).lower() or n["id"].endswith("page_handle") or n["id"].endswith("line_direction_desc"))
    if ch:
        print("change dir ctrl", ch)
        tap(ch["x"], ch["y"])
        time.sleep(2)
        shot("_tmp_flow_dir_swapped.png")
        xml = dump()

    # Tap a stop roughly mid-list
    stop_nodes = [
        n
        for n in nodes(xml)
        if n["clickable"] and 700 < n["y1"] < 1700 and ("stop" in n["id"] or n["text"])
    ]
    print("stops", len(stop_nodes), [(s["y1"], s["text"][:40], s["id"].split('/')[-1]) for s in stop_nodes[:8]])
    if stop_nodes:
        s0 = stop_nodes[2] if len(stop_nodes) > 2 else stop_nodes[0]
        tap(s0["x"], s0["y"])
        time.sleep(2)
        shot("_tmp_flow_stop1.png")
        xml = dump()
        print("--- AFTER STOP1 ---")
        for n in nodes(xml):
            if n["text"]:
                print(f"  {n['y1']:4d} {n['text'][:60]}")

        # If where do you want appears, tap another stop
        if any("want to go" in n["text"].lower() for n in nodes(xml)):
            stop_nodes2 = [n for n in nodes(xml) if n["clickable"] and 700 < n["y1"] < 1700]
            if len(stop_nodes2) > 4:
                s1 = stop_nodes2[-2]
                print("dest", s1)
                tap(s1["x"], s1["y"])
                time.sleep(2.5)
                shot("_tmp_flow_onboard.png")
                xml = dump()
                print("--- AFTER DEST ---")
                for n in nodes(xml):
                    if n["text"]:
                        print(f"  {n['y1']:4d} {n['text'][:70]}")


if __name__ == "__main__":
    main()
