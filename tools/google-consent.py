#!/usr/bin/env python3
"""壁の盤のカレンダー — Google の同意を、この Mac で1回だけ通す。

**シークレットを人にも Claude にも打たせない。**
Google Cloud の「クライアント」画面から落とせる JSON をそのまま読む。
落とした鍵は画面にも記録にも出さない（入口の Secret へ渡すだけ）。

つかいかた
    python3 google-consent.py consent            同意を通し、カレンダー一覧を出す
    python3 google-consent.py put 1,3            選んだものを入口（ds9）に預ける
    python3 google-consent.py put all

JSON の落とし方（クリック2回）
    https://console.cloud.google.com/auth/clients?project=kabe-no-ban
    → クライアントの行の ⬇（JSON をダウンロード）
"""
import glob
import http.server
import json
import os
import pathlib
import subprocess
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

PORT = 8798
REDIRECT = f"http://127.0.0.1:{PORT}/"
SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
HERE = pathlib.Path(__file__).resolve().parent
GATE = HERE.parent.parent / "dougudana-v2" / "gate"
STATE = HERE / ".consent-state.json"        # 600。git には入れない
got = {}


def newest_json():
    """落としてきた client_secret*.json のうち、いちばん新しいもの。"""
    # 落とし先は人それぞれ。よくある3つを見る（デスクトップに落ちていた実例あり）
    pats = []
    for folder in ("Downloads", "Desktop", "Documents"):
        pats.append(str(pathlib.Path.home() / folder / "client_secret*.json"))
        pats.append(str(pathlib.Path.home() / folder / "*apps.googleusercontent.com*.json"))
    hits = []
    for p in pats:
        hits += glob.glob(p)
    if not hits:
        return None
    return max(hits, key=os.path.getmtime)


def creds(path=None):
    p = path or newest_json()
    if not p or not os.path.exists(p):
        print("クライアントの JSON が見つかりません。\n"
              "  https://console.cloud.google.com/auth/clients?project=kabe-no-ban\n"
              "  → クライアントの行の ⬇ で JSON を落としてください（ダウンロードのままでよい）")
        raise SystemExit(1)
    d = json.loads(pathlib.Path(p).read_text(encoding="utf-8"))
    c = d.get("installed") or d.get("web") or {}
    if not c.get("client_id") or not c.get("client_secret"):
        print(f"{p} に client_id / client_secret がありません。")
        raise SystemExit(1)
    print(f"鍵の出どころ: {p}")
    return c["client_id"], c["client_secret"]


class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        got.update({k: v[0] for k, v in q.items()})
        self.send_response(200)
        self.send_header("content-type", "text/html; charset=utf-8")
        self.end_headers()
        ok = "code" in got
        self.wfile.write(
            ("<meta charset=utf-8><body style='font:16px/1.8 sans-serif;padding:3em'>"
             + ("<h2>受け取りました</h2><p>この窓は閉じてよいです。</p>"
                if ok else "<h2>断られました</h2>")
             + "</body>").encode("utf-8"))

    def log_message(self, *a):
        pass


def post(url, data):
    """転んだら Google の言い分をそのまま見せる（401 だけでは何も分からない）。"""
    req = urllib.request.Request(
        url, data=urllib.parse.urlencode(data).encode(), method="POST",
        headers={"content-type": "application/x-www-form-urlencoded",
                 "user-agent": "firedash-consent/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:400]
        print(f"\nGoogle に断られました（{e.code}）\n  {detail}")
        raise SystemExit(1)


def get(url, tok):
    req = urllib.request.Request(url, headers={"authorization": "Bearer " + tok,
                                               "user-agent": "firedash-consent/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def save(d):
    STATE.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    os.chmod(STATE, 0o600)


def consent(argv):
    path = argv[0] if argv else None
    cid, csec = creds(path)
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": cid, "redirect_uri": REDIRECT, "response_type": "code",
        "scope": SCOPE, "access_type": "offline", "prompt": "consent"})
    srv = http.server.HTTPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=srv.handle_request, daemon=True).start()
    print("\nブラウザが開きます。**続行 → 許可** を押してください。")
    print(url, flush=True)
    webbrowser.open(url)
    ev = threading.Event()
    for _ in range(600):
        if got:
            break
        ev.wait(0.5)
    if "code" not in got:
        print("同意が取れませんでした（" + str(got)[:120] + "）")
        return 1
    tk = post("https://oauth2.googleapis.com/token", {
        "client_id": cid, "client_secret": csec, "code": got["code"],
        "grant_type": "authorization_code", "redirect_uri": REDIRECT})
    if "refresh_token" not in tk:
        print("refresh_token が返りませんでした。Google アカウントの"
              "「サードパーティ製アプリ」からこのアプリを外して、やり直してください。")
        return 1
    cl = get("https://www.googleapis.com/calendar/v3/users/me/calendarList"
             "?maxResults=250", tk["access_token"])
    items = cl.get("items", [])
    save({"src": path or newest_json(), "refresh": tk["refresh_token"],
          "ids": [c["id"] for c in items]})
    print("\n同意が通りました。盤に出せるカレンダー：")
    for i, c in enumerate(items, 1):
        mark = "主" if c.get("primary") else " "
        print(f" {i:2d}{mark} {c.get('summaryOverride') or c.get('summary')}")
    print("\n次：python3 google-consent.py put 1,3    （または put all）")
    return 0


def secret(name, value):
    p = subprocess.run(["npx", "wrangler@4", "secret", "put", name],
                       cwd=str(GATE), input=value, text=True, capture_output=True)
    ok = p.returncode == 0
    print(f"  {name}: {'預けました' if ok else '失敗 ' + p.stderr.strip()[:160]}")
    return ok


def put(argv):
    if not STATE.exists():
        print("先に consent を通してください。")
        return 1
    st = json.loads(STATE.read_text(encoding="utf-8"))
    cid, csec = creds(st.get("src"))
    sel = (argv[0] if argv else "all").lower()
    if sel in ("all", "a"):
        ids = st["ids"]
    else:
        want = [int(x) for x in sel.replace(",", " ").split() if x.isdigit()]
        ids = [st["ids"][i-1] for i in want if 1 <= i <= len(st["ids"])]
    if not ids:
        print("1つも選ばれていません。")
        return 1
    print(f"{len(ids)} 件を入口（ds9）に預けます")
    ok = (secret("GCAL_ID", cid) and secret("GCAL_SECRET", csec)
          and secret("GCAL_REFRESH", st["refresh"]) and secret("GCAL_IDS", ",".join(ids)))
    if not ok:
        print("預けられませんでした。wrangler にログインしているか確かめてください。")
        return 1
    print("\n入口を配り直します…")
    d = subprocess.run(["npx", "wrangler@4", "deploy"], cwd=str(GATE),
                       capture_output=True, text=True)
    print("  " + (d.stdout.strip().splitlines() or ["(出力なし)"])[-1]
          if d.returncode == 0 else "  配り直しに失敗: " + d.stderr.strip()[:200])
    print("できました。盤のカレンダーに本物の予定が出ます（控えが5分もつので最大5分）")
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "consent"
    rest = sys.argv[2:]
    if cmd == "consent":
        sys.exit(consent(rest))
    if cmd == "put":
        sys.exit(put(rest))
    print(__doc__)
    sys.exit(1)
