#!/usr/bin/env python3
"""壁の盤のカレンダー — Google の同意を、この Mac で1回だけ通す。

**なぜここで通すか**：Fire TV のリモコンで Google のログインは通せない。
同意はここで1回だけ通し、`refresh_token` を入口（ds9）の Secret に預ける。
以後は入口が入場券を取り直すので、端末は何もしない。

先にやること（ご本人・ブラウザで10分）
 1. https://console.cloud.google.com/ でプロジェクトを作る
 2. 「API とサービス」→ ライブラリ → **Google Calendar API** を有効化
 3. OAuth 同意画面 → 外部 → テスト → テストユーザーに自分を入れる
 4. 認証情報 → OAuth クライアント ID → **デスクトップ アプリ**
    （※ウェブアプリではない。戻り先の登録が要らない）
 5. クライアント ID とシークレットを控える

そのあと：
    python3 firedash/tools/google-consent.py

やること：同意を通す → カレンダー一覧を見せて選ばせる → 入口の Secret に預ける。
"""
import http.server
import json
import subprocess
import sys
import threading
import urllib.parse
import urllib.request
import webbrowser

PORT = 8798
REDIRECT = f"http://127.0.0.1:{PORT}/"
SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
GATE = "/Users/daisukeshinohara/claude code/dougudana-v2/gate"

got = {}


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
             + ("<h2>受け取りました</h2><p>ターミナルに戻ってください。</p>"
                if ok else "<h2>断られました</h2><p>ターミナルに戻ってください。</p>")
             + "</body>").encode("utf-8"))

    def log_message(self, *a):
        pass


def post(url, data):
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"content-type":
                                          "application/x-www-form-urlencoded",
                                          "user-agent": "firedash-consent/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def get(url, tok):
    req = urllib.request.Request(url, headers={"authorization": "Bearer " + tok,
                                               "user-agent": "firedash-consent/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def secret(name, value):
    """入口（ds9）の Secret に預ける。値は画面にも履歴にも残さない。"""
    p = subprocess.run(["npx", "wrangler@4", "secret", "put", name],
                       cwd=GATE, input=value, text=True, capture_output=True)
    ok = p.returncode == 0
    print(f"  {name}: {'預けました' if ok else '失敗 ' + p.stderr.strip()[:120]}")
    return ok


def main():
    print(__doc__.split("先にやること")[0].strip())
    cid = input("クライアント ID: ").strip()
    csec = input("クライアント シークレット: ").strip()
    if not cid or not csec:
        print("両方要ります。やめます。")
        return 1

    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": cid, "redirect_uri": REDIRECT, "response_type": "code",
        "scope": SCOPE, "access_type": "offline", "prompt": "consent",
    })
    srv = http.server.HTTPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=srv.handle_request, daemon=True).start()
    print("\nブラウザで同意してください（「確認されていないアプリ」の警告は、"
          "自分で作ったものなので詳細→続行で通ります）")
    print(url)
    webbrowser.open(url)
    for _ in range(600):
        if got:
            break
        threading.Event().wait(0.5)
    if "code" not in got:
        print("同意が取れませんでした。")
        return 1

    tk = post("https://oauth2.googleapis.com/token", {
        "client_id": cid, "client_secret": csec, "code": got["code"],
        "grant_type": "authorization_code", "redirect_uri": REDIRECT})
    if "refresh_token" not in tk:
        print("refresh_token が返りませんでした。"
              "Google のアカウント設定でこのアプリの許可を外してから、やり直してください。")
        return 1

    cl = get("https://www.googleapis.com/calendar/v3/users/me/calendarList"
             "?maxResults=250", tk["access_token"])
    items = cl.get("items", [])
    print("\n盤に出すカレンダーを選んでください（番号を空白かカンマで。全部なら a）")
    for i, c in enumerate(items, 1):
        mark = "主" if c.get("primary") else " "
        print(f" {i:2d}{mark} {c.get('summaryOverride') or c.get('summary')}")
    sel = input("番号: ").strip().lower()
    if sel in ("a", "all", ""):
        ids = [c["id"] for c in items]
    else:
        want = [int(x) for x in sel.replace(",", " ").split() if x.isdigit()]
        ids = [items[i-1]["id"] for i in want if 1 <= i <= len(items)]
    if not ids:
        print("1つも選ばれていません。やめます。")
        return 1

    print("\n入口（ds9）に預けます")
    ok = secret("GCAL_ID", cid) and secret("GCAL_SECRET", csec) \
        and secret("GCAL_REFRESH", tk["refresh_token"]) \
        and secret("GCAL_IDS", ",".join(ids))
    if not ok:
        print("預けられませんでした。wrangler にログインしているか確かめてください。")
        return 1
    print("\nできました。入口を配り直します：")
    print(f"  cd '{GATE}' && npx wrangler@4 deploy")
    print("そのあと盤のカレンダーに本物の予定が出ます"
          "（入口の中で5分だけ控えるので、出るまで最大5分）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
