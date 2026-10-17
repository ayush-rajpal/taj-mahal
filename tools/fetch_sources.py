"""Download the real-world material this world is built from.

    python tools/fetch_sources.py knowledge     # Wikipedia + Wikivoyage articles -> knowledge/sources/
    python tools/fetch_sources.py textures      # CC0 photo-scanned materials from ambientCG -> assets/textures/
    python tools/fetch_sources.py search "q"    # list Wikimedia Commons photos (with licences) for a query
    python tools/fetch_sources.py photos        # download the photos listed in assets/photos.json
    python tools/fetch_sources.py passages      # cut the articles into passages the guide searches offline

Everything downloaded is openly licensed; the licence and author of each item are written next to it
(knowledge/sources.json, assets/credits.json) and summarised in assets/CREDITS.md.
"""

from __future__ import annotations

import io
import json
import re
import sys
import time
import zipfile
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "TajMahalWorld/0.1 (MGT 409 student project; github.com/ayush-rajpal)"}
S = requests.Session()
S.headers.update(UA)

WIKIPEDIA = [
    "Taj Mahal", "Mumtaz Mahal", "Shah Jahan", "Mughal architecture", "Charbagh", "Pietra dura",
    "Mehtab Bagh", "Ustad Ahmad Lahori", "Makrana", "Agra", "Yamuna", "Agra Fort",
    "Tomb of I'timād-ud-Daulah", "Humayun's Tomb", "Bibi Ka Maqbara", "Mughal Empire", "Aurangzeb",
    "Jahangir", "Taj Trapezium Zone", "Jali", "Chhatri", "Iwan", "Minaret", "Onion dome",
    "Mughal gardens", "Gauhar Ara Begum", "Jahanara Begum", "New 7 Wonders of the World",
    "Taj Mahotsav", "Tajganj", "Persian gardens", "Dara Shikoh", "Islamic calligraphy",
]
WIKIVOYAGE = ["Agra"]

# ambientCG asset ids (all CC0): white veined marble, fine stone grain (tinted to red sandstone),
# red slab paving, lawn grass, dusty ground.
AMBIENTCG = ["Marble012", "Concrete012", "PavingStones135", "Grass004", "Ground037"]


def slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")


def get(url: str, **kw) -> requests.Response:
    """GET with polite backoff: Wikimedia answers 429 when we go too fast."""
    for attempt in range(6):
        r = S.get(url, timeout=kw.pop("timeout", 60), **kw)
        if r.status_code != 429:
            r.raise_for_status()
            return r
        wait = int(r.headers.get("Retry-After", 0) or 0) or 5 * 2**attempt
        print(f"  (rate limited, waiting {wait}s)")
        time.sleep(wait)
    r.raise_for_status()
    return r


def fetch_extract(api: str, title: str) -> tuple[str, str]:
    r = get(api, params={"action": "query", "prop": "extracts|info", "explaintext": 1, "inprop": "url",
                         "redirects": 1, "titles": title, "format": "json", "formatversion": 2})
    page = r.json()["query"]["pages"][0]
    if page.get("missing"):
        raise LookupError(title)
    return page["extract"], page["fullurl"]


def knowledge() -> None:
    out = ROOT / "knowledge" / "sources"
    out.mkdir(parents=True, exist_ok=True)
    meta = []
    for site, api, titles in [("Wikipedia", "https://en.wikipedia.org/w/api.php", WIKIPEDIA),
                              ("Wikivoyage", "https://en.wikivoyage.org/w/api.php", WIKIVOYAGE)]:
        for t in titles:
            name = f"{site.lower()}_{slug(t)}.txt"
            path = out / name
            if path.exists():  # already downloaded on an earlier run
                head, _, text = path.read_text(encoding="utf-8").partition("\n\n")
                url = re.search(r"Source: (\S+)", head).group(1)
            else:
                try:
                    text, url = fetch_extract(api, t)
                except Exception as e:  # keep going; a missing article just isn't in the guidebook
                    print(f"  skip {site}: {t} ({e})")
                    continue
                path.write_text(f"# {t}\nSource: {url} ({site}, CC BY-SA 4.0)\n\n{text}", encoding="utf-8")
                print(f"  {site}: {t} ({len(text):,} chars)")
                time.sleep(1.5)
            meta.append({"file": name, "title": t, "site": site, "url": url, "license": "CC BY-SA 4.0",
                         "chars": len(text)})
    (ROOT / "knowledge" / "sources.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"{len(meta)} articles, {sum(m['chars'] for m in meta):,} characters")


def textures() -> None:
    out = ROOT / "assets" / "textures"
    out.mkdir(parents=True, exist_ok=True)
    credits = []
    for aid in AMBIENTCG:
        url = f"https://ambientcg.com/get?file={aid}_2K-JPG.zip"
        r = S.get(url, timeout=120)
        if r.status_code != 200 or not r.content.startswith(b"PK"):
            print(f"  skip {aid} ({r.status_code})")
            continue
        d = out / aid
        d.mkdir(exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            for n in z.namelist():
                if re.search(r"_(Color|Roughness|NormalGL|AmbientOcclusion)\.jpg$", n):
                    (d / Path(n).name).write_bytes(z.read(n))
        credits.append({"id": aid, "source": f"https://ambientcg.com/view?id={aid}", "license": "CC0 1.0",
                        "author": "ambientCG (Lennart Demes)"})
        print(f"  {aid}: {sorted(p.name for p in d.iterdir())}")
    _merge_credits("textures", credits)


def _commons(params: dict) -> list[dict]:
    base = {"action": "query", "format": "json", "formatversion": 2, "prop": "imageinfo",
            "iiprop": "url|size|extmetadata|mime", "iiurlwidth": 2048}
    r = get("https://commons.wikimedia.org/w/api.php", params={**base, **params})
    pages = r.json().get("query", {}).get("pages", [])
    rows = []
    for p in pages:
        ii = (p.get("imageinfo") or [{}])[0]
        em = ii.get("extmetadata", {})
        val = lambda k: re.sub(r"<[^>]+>", "", em.get(k, {}).get("value", "")).strip()
        rows.append({"title": p["title"], "w": ii.get("width"), "h": ii.get("height"), "mime": ii.get("mime"),
                     "license": val("LicenseShortName"), "artist": val("Artist")[:80],
                     "desc": val("ImageDescription")[:160], "url": ii.get("url"), "thumb": ii.get("thumburl"),
                     "page": ii.get("descriptionurl")})
    return rows


OPEN = re.compile(r"^(CC0|CC BY(-SA)? [0-9.]+|Public domain|PD|CC-BY|CC BY|Attribution)", re.I)


def search(q: str, n: int = 30) -> None:
    rows = _commons({"generator": "search", "gsrsearch": f"{q} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": n})
    for r in rows:
        if r["mime"] != "image/jpeg" or not OPEN.match(r["license"] or ""):
            continue
        print(f"{r['w']}x{r['h']}\t{r['license']}\t{r['title']}\t| {r['desc'][:90]}")


def photos() -> None:
    """Download every photo listed in assets/photos.json: [{"key": ..., "title": "File:..."}]."""
    wanted = json.loads((ROOT / "assets" / "photos.json").read_text(encoding="utf-8"))
    out = ROOT / "assets" / "photos"
    out.mkdir(parents=True, exist_ok=True)
    credits = []
    for w in wanted:
        rows = _commons({"titles": w["title"]})
        if not rows or not rows[0]["url"]:
            print(f"  missing {w['title']}")
            continue
        r = rows[0]
        src = r["thumb"] if (r["w"] or 0) > 2048 else r["url"]
        img = get(src, timeout=120)
        ext = ".png" if src.lower().endswith(".png") else ".jpg"
        (out / f"{w['key']}{ext}").write_bytes(img.content)
        credits.append({"key": w["key"], "title": r["title"], "page": r["page"], "license": r["license"],
                        "author": r["artist"], "description": r["desc"]})
        print(f"  {w['key']}: {r['title']} ({r['license']}, {len(img.content)//1024} KB)")
        time.sleep(0.3)
    _merge_credits("photos", credits)


def passages() -> None:
    """Cut the saved articles into short passages the guide can search in the browser:
    public/guidebook/passages.json. Articles about the Taj and the people behind it weigh more than
    general ones (minarets, the Mughal Empire), so a Taj answer wins when both match."""
    meta = json.loads((ROOT / "knowledge" / "sources.json").read_text(encoding="utf-8"))
    core = {"Taj Mahal", "Mumtaz Mahal", "Shah Jahan", "Mehtab Bagh", "Ustad Ahmad Lahori", "Makrana", "Taj Trapezium Zone",
            "Taj Mahotsav", "Gauhar Ara Begum", "Agra Fort", "Charbagh", "Pietra dura"}
    general = {"Mughal Empire", "Aurangzeb", "Jahangir", "Yamuna", "Persian gardens", "Islamic calligraphy", "Minaret", "Iwan",
               "Onion dome", "Chhatri", "Agra"}
    skip = {"References", "See also", "Notes", "Further reading", "External links", "Citations", "Sources", "General sources",
            "Bibliography", "Gallery", "In popular culture", "Popular culture", "Footnotes"}
    articles, out = [], []
    for m in meta:
        body = (ROOT / "knowledge" / "sources" / m["file"]).read_text(encoding="utf-8").split("\n\n", 1)[-1]
        weight = 1.3 if m["title"] in core else 0.75 if m["title"] in general else 1.0
        articles.append({"title": m["title"], "url": m["url"], "site": m["site"], "w": weight})
        a = len(articles) - 1
        section, buf = "", ""
        for para in re.split(r"\n\s*\n|\n(?===)", body):
            para = para.strip()
            h = re.match(r"^=+\s*(.+?)\s*=+$", para)
            if h:
                if buf:
                    out.append({"a": a, "s": section, "t": buf})
                section, buf = h.group(1), ""
                continue
            if not para or section in skip or len(para) < 60:
                continue
            buf = f"{buf} {para}" if buf else para
            if len(buf) > 650:
                out.append({"a": a, "s": section, "t": buf[:1400]})
                buf = ""
        if buf and section not in skip:
            out.append({"a": a, "s": section, "t": buf[:1400]})
    path = ROOT / "public" / "guidebook" / "passages.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"articles": articles, "passages": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(out)} passages from {len(articles)} articles -> {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


def _merge_credits(kind: str, items: list[dict]) -> None:
    path = ROOT / "assets" / "credits.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    data[kind] = items
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    lines = ["# Credits", "", "Real-world material used to build this world. All of it is openly licensed.", ""]
    if data.get("textures"):
        lines += ["## Photo-scanned materials (ambientCG, CC0)", ""]
        lines += [f"- [{t['id']}]({t['source']}) by {t['author']}, {t['license']}" for t in data["textures"]]
        lines.append("")
    if data.get("photos"):
        lines += ["## Photographs (Wikimedia Commons)", ""]
        lines += [f"- `{p['key']}`: [{p['title']}]({p['page']}) by {p['author'] or 'unknown'}, {p['license']}"
                  for p in data["photos"]]
        lines.append("")
    lines += ["## Text", "", "The guide's knowledge comes from Wikipedia and Wikivoyage articles (CC BY-SA 4.0), "
              "listed with links in `knowledge/sources.json`.", ""]
    (ROOT / "assets" / "CREDITS.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # titles like I'timād-ud-Daulah
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "knowledge":
        knowledge()
    elif cmd == "textures":
        textures()
    elif cmd == "search":
        search(" ".join(sys.argv[2:]))
    elif cmd == "photos":
        photos()
    elif cmd == "passages":
        passages()
    else:
        print(__doc__)
