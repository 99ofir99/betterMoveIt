import re, subprocess, time
from pathlib import Path

ADB = str(Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe")
DEV = ["-s", "emulator-5554"]
OUT = Path(r"C:\Users\ofir\OneDrive\Documents\betterMoveIt")

def sh(*a):
    return subprocess.run([ADB, *DEV, *a], capture_output=True).stdout

def dump():
    sh("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    sh("pull", "/sdcard/ui.xml", str(OUT / "_tmp_moovit_ui.xml"))
    return (OUT / "_tmp_moovit_ui.xml").read_text(encoding="utf-8", errors="replace")

def nodes(xml):
    for m in re.finditer(r"<node [^>]+/?>", xml):
        tag = m.group(0)
        bm = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
        if not bm: continue
        x1,y1,x2,y2=map(int,bm.groups())
        text = re.search(r'text="([^"]*)"', tag)
        desc = re.search(r'content-desc="([^"]*)"', tag)
        rid = re.search(r'resource-id="([^"]*)"', tag)
        yield {
            "x":(x1+x2)//2,"y":(y1+y2)//2,"y1":y1,"y2":y2,"x1":x1,"x2":x2,
            "text": text.group(1) if text else "",
            "desc": desc.group(1) if desc else "",
            "id": rid.group(1) if rid else "",
            "clickable": 'clickable="true"' in tag,
        }

xml = dump()
for n in nodes(xml):
    if n["text"] or "start" in n["id"].lower() or "start" in n["desc"].lower() or n["y1"]>2000:
        print(f"{n['y1']:4d}-{n['y2']:4d} x={n['x1']}-{n['x2']} click={n['clickable']} text={n['text']!r} desc={n['desc'][:50]!r} id={n['id'].split('/')[-1]}")

# Tap Start by text
start = next((n for n in nodes(xml) if n["text"]=="Start" or "Start" in n["desc"]), None)
print("START", start)
if start:
    sh("shell", "input", "tap", str(start["x"]), str(start["y"]))
    time.sleep(2.5)
    sh("shell", "screencap", "-p", "/sdcard/m.png")
    sh("pull", "/sdcard/m.png", str(OUT/"_tmp_start_result.png"))
    from PIL import Image
    im=Image.open(OUT/"_tmp_start_result.png")
    im.resize((im.width//3,im.height//3)).save(OUT/"_tmp_start_result_sm.png")
    xml=dump()
    print("AFTER")
    for n in nodes(xml):
        if n["text"]:
            print(f"  {n['y1']:4d} {n['text'][:80]}")
