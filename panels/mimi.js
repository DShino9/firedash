// 耳読の処理状況（要件 7）。
//
// 出すもの：**いま作っている本（Mac と助っ人で同時に走る）**・裏の作業・次に作る本・
// 残りの冊数と時間（種別ごと）・機器の様子（声の器・負荷・空き・助っ人）・
// 直近の出来事・この24時間でできた冊数。
// 枠が小さいときは上から順に落とす（resize で density を決める）。
//
// 取り方は2通り。速い順に試す。
//  ① Mac 直（設定の「Mac のあて先」）… 家の中だけ。**盤が https の間はブラウザが塞ぐ**
//     （混在内容）。APK で包めば効く。塞がれる組み合わせでは試さない。
//  ② 入口（ds9）の控え … /ban/status.json。Mac が置きにきたもの。札の内側。
const GATE = '/ban/status.json';

function underGate(){
  const h = location.hostname;
  if (/(^|\.)github\.io$/.test(h)) return false;
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false;
  return location.protocol !== 'file:';
}
function macUrl(cfg){
  let m = (cfg.mac || '').trim();
  if (!m) return '';
  if (!/^https?:\/\//.test(m)) m = 'http://' + m;
  if (!/:\d+$/.test(m.replace(/^https?:\/\//,''))) m += ':8770';
  return m.replace(/\/+$/,'') + '/api/ban';
}
function macBlocked(u){
  return location.protocol === 'https:' && u.indexOf('http://') === 0;
}
function ago(sec){
  if (!sec) return '';
  const d = Math.max(0, Math.round(Date.now()/1000 - sec));
  if (d < 90) return '';
  if (d < 3600) return Math.round(d/60) + '分前の分';
  return Math.round(d/3600) + '時間前の分';
}

export default {
  id:'mimi', name:'耳読の処理状況', icon:'📖',
  hint:'作っている本・残りの冊数と時間・機器の様子',
  create(ctx){
    const el = document.createElement('div');
    el.className = 'p-mimi';
    if (!document.getElementById('p-mimi-css')){
      const st = document.createElement('style'); st.id = 'p-mimi-css';
      st.textContent = [
        '.p-mimi{height:100%;overflow:hidden;padding:.6em .8em;display:flex;flex-direction:column;',
        'gap:.45em;font-size:var(--mz,14px)}',
        /* 上＝作っている本、中＝溢れてよいもの、下＝必ず見せるもの */
        '.p-mimi .top{flex:none;display:flex;flex-direction:column;gap:.45em}',
        '.p-mimi .mid{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:.2em}',
        '.p-mimi .bot{flex:none;display:flex;flex-direction:column;gap:.35em}',
        /* いま作っている本 */
        '.p-mimi .bk{display:flex;flex-direction:column;gap:.18em}',
        '.p-mimi .bk .t{display:flex;align-items:baseline;gap:.4em}',
        '.p-mimi .bk .t b{font-weight:600;font-size:1.02em;min-width:0;overflow:hidden;',
        'text-overflow:ellipsis;white-space:nowrap}',
        '.p-mimi .bk .t .w{flex:none;font-size:.68em;color:var(--dim2);border:1px solid var(--line);',
        'border-radius:5px;padding:0 .35em}',
        '.p-mimi .bk .t .w.gpu{color:var(--ok);border-color:#2c4a37}',
        '.p-mimi .bk .s{font-size:.76em;color:var(--dim);font-variant-numeric:tabular-nums;',
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.p-mimi .bar{height:.42em;border-radius:.21em;background:#0c0c10;',
        'border:1px solid var(--line);overflow:hidden}',
        '.p-mimi .bar i{display:block;height:100%;background:var(--ok);transition:width .4s}',
        '.p-mimi .busy{color:var(--warn);font-size:.76em;overflow:hidden;text-overflow:ellipsis;',
        'white-space:nowrap}',
        /* 帯（見出し付きの並び） */
        '.p-mimi .sec{font-size:.68em;color:var(--dim2);letter-spacing:.08em;',
        'display:flex;align-items:center;gap:.5em;margin-top:.1em}',
        '.p-mimi .sec::after{content:"";flex:1;height:1px;background:var(--line)}',
        '.p-mimi .row{font-size:.76em;color:var(--dim);display:flex;gap:.45em;',
        'overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
        '.p-mimi .row .k{flex:none;color:var(--dim2);font-size:.9em}',
        '.p-mimi .row .n{flex:none;font-variant-numeric:tabular-nums;color:var(--fg)}',
        /* 数字の帯 */
        '.p-mimi .nums{display:flex;gap:1em;padding-top:.35em;',
        'border-top:1px solid var(--line)}',
        '.p-mimi .nums div{display:flex;flex-direction:column;min-width:0}',
        '.p-mimi .nums b{font-size:1.2em;font-weight:500;font-variant-numeric:tabular-nums;',
        'white-space:nowrap}',
        '.p-mimi .nums span{color:var(--dim2);font-size:.68em;white-space:nowrap}',
        /* 機器 */
        '.p-mimi .hw{display:flex;flex-wrap:wrap;gap:.35em;font-size:.7em}',
        '.p-mimi .hw span{border:1px solid var(--line);border-radius:6px;padding:.05em .4em;',
        'color:var(--dim)}',
        '.p-mimi .hw span.ok{color:var(--ok);border-color:#2c4a37}',
        '.p-mimi .hw span.warn{color:var(--warn);border-color:#4a3c22}',
        '.p-mimi .old{color:var(--dim2);font-size:.68em}',
        '.p-mimi .dead{color:var(--dim2);font-size:.9em;margin:auto;text-align:center;line-height:1.7}',
        '.p-mimi .dead b{display:block;color:var(--dim);font-weight:500;font-size:1.1em}'
      ].join('');
      document.head.appendChild(st);
    }

    let d = null, why = '', from = '', size = 'md';

    function esc(s){
      return String(s == null ? '' : s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function book(b){
      const pct = b.pct || 0;
      return '<div class="bk"><div class="t"><b>' + esc(b.title) + '</b>' +
        '<span class="w' + (b.where !== 'このMac' ? ' gpu' : '') + '">' + esc(b.where) + '</span></div>' +
        '<div class="s">' +
        (b.chapters ? b.chapter + ' / ' + b.chapters + ' ' + esc(b.unit) + '　' : '') +
        esc(b.phase) + (b.label ? '　' + esc(b.label) : '') +
        '　残り ' + esc(b.left) + '</div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
    }

    function paint(){
      if (!d){
        el.innerHTML = '<div class="dead"><b>耳読に届きません</b>' +
          (why ? '<span>' + why + '</span>' : '') + '</div>';
        return;
      }
      const big = size === 'lg', mid = size !== 'sm';
      const cur = d.now || [];
      let h = '<div class="top">';

      if (cur.length){
        cur.slice(0, big ? 3 : (mid ? 2 : 1)).forEach(function(b){ h += book(b); });
        if (cur.length > (big ? 3 : (mid ? 2 : 1))){
          h += '<div class="row"><span class="k">ほか</span>' +
               '<span class="n">' + (cur.length - (big ? 3 : (mid ? 2 : 1))) + '</span>冊を同時に</div>';
        }
      } else {
        h += '<div class="bk"><div class="t"><b>作っている本はありません</b></div></div>';
      }
      if (d.busy) h += '<div class="busy">裏の作業：' + esc(d.busy) + '</div>';
      h += '</div><div class="mid">';

      // 残り（冊数と時間）は、次に作る本より先に出す
      if (mid && (d.kinds || []).length){
        h += '<div class="sec">残り</div>';
        (d.kinds || []).forEach(function(k){
          h += '<div class="row"><span class="k">' + esc(k.kind) + '</span>' +
               '<span class="n">' + k.n + '</span>冊　<span class="n">' + esc(k.left) + '</span></div>';
        });
      }
      if (mid && (d.next || []).length){
        h += '<div class="sec">次に作る</div>';
        // 小さい枠では1件だけ（途中で切れた行が出ないように）
        (d.next || []).slice(0, big ? 3 : 1).forEach(function(n){
          h += '<div class="row"><span class="k">' + esc(n.kind) + '</span>' + esc(n.title) + '</div>';
        });
      }
      if (big && (d.held || []).length){
        h += '<div class="sec">止まっている</div>';
        (d.held || []).forEach(function(t){ h += '<div class="row">' + esc(t) + '</div>'; });
      }
      if (big && (d.log || []).length){
        h += '<div class="sec">直近の出来事</div>';
        (d.log || []).slice(0, 2).forEach(function(t){
          h += '<div class="row">' + esc(t) + '</div>';
        });
      }

      h += '</div><div class="bot">';
      const hw = d.hw || {};
      {
        h += '<div class="hw">';
        h += '<span class="' + (hw.engine ? 'ok' : 'warn') + '">声の器 ' +
             (hw.engine ? (hw.threads || '') + '本' : '止') + '</span>';
        (hw.helpers || []).forEach(function(x){
          h += '<span class="' + (x.alive ? 'ok' : 'warn') + '">助っ人 ' + esc(x.host) +
               (x.gpu ? ' GPU' : '') + '</span>';
        });
        if (hw.load) h += '<span>負荷 ' + hw.load + ' / ' + (hw.cores || '?') + '</span>';
        if (hw.freeGb) h += '<span class="' + (hw.freeGb < 3 ? 'warn' : '') + '">空き ' +
                            hw.freeGb + 'GB</span>';
        if (d.done24 && d.done24.n) h += '<span>24hで ' + d.done24.n + '冊</span>';
        if (d.shelf) h += '<span>棚 ' + d.shelf + '冊</span>';
        h += '</div>';
      }

      h += '<div class="nums">' +
           '<div><b>' + d.queue + '</b><span>待ち</span></div>' +
           '<div><b>' + (d.heldN != null ? d.heldN : 0) + '</b><span>保留</span></div>' +
           '<div><b>' + esc(d.allLeft) + '</b><span>揃うのは</span></div>' +
           '<div><b>' + d.rate + '%</b><span>稼働(' + (d.rateDays || 7) + '日)</span></div>' +
           '</div>';

      const old = ago(d.at);
      if (old || from === 'gate'){
        h += '<div class="old">' + (old ? old + '　' : '') +
             (from === 'mac' ? 'Mac から直に' : '入口の控えから') + '</div>';
      }
      el.innerHTML = h + '</div>';
    }

    function get(url, ms){
      let ctl = null, t = 0;
      if (typeof AbortController !== 'undefined'){
        ctl = new AbortController();
        t = setTimeout(function(){ ctl.abort(); }, ms);
      }
      const opt = { cache:'no-store' };
      if (ctl) opt.signal = ctl.signal;
      return fetch(url, opt).then(function(r){
        if (t) clearTimeout(t);
        if (!r.ok) throw new Error(r.status);
        return r.json();
      });
    }

    function pull(){
      const mac = macUrl(ctx.cfg);
      const tries = [];
      if (mac && !macBlocked(mac)) tries.push(['mac', mac]);
      if (underGate()) tries.push(['gate', GATE]);
      if (!tries.length){
        d = null;
        why = mac ? 'この盤は https で配られているので、http の Mac には届きません（APK で包めば直に読めます）'
                  : '設定で「Mac のあて先」を入れるか、入口（ds9）ごしに開いてください';
        paint(); return;
      }
      (function go(i){
        if (i >= tries.length){
          d = null;
          why = 'Mac が寝ているか、まだ控えが置かれていません';
          paint(); return;
        }
        get(tries[i][1], 4000).then(function(j){
          d = j; from = tries[i][0]; why = ''; paint();
        }).catch(function(){ go(i+1); });
      })(0);
    }

    pull();
    let last = Date.now();

    return {
      el: el,
      tick(){
        const span = (from === 'mac') ? 20000 : 60000;
        if (Date.now() - last > span){ last = Date.now(); pull(); }
      },
      refresh(){ last = Date.now(); pull(); },
      resize(){
        const w = el.clientWidth, hgt = el.clientHeight;
        if (!w || !hgt) return;
        el.style.setProperty('--mz', Math.max(11, Math.min(w / 30, hgt / 24)) + 'px');
        size = (hgt > 560 && w > 520) ? 'lg' : (hgt > 300 ? 'md' : 'sm');
        paint();
      }
    };
  }
};
