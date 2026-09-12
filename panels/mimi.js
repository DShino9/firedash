// 耳読の処理状況（要件 7）。
//
// 取り方は2通り。速い順に試す。
//  ① Mac 直（設定の「Mac のあて先」）… 家の中だけ。20秒ごとに最新が出る。
//     **ただし盤が https で配られている間は、ブラウザが http の Mac を塞ぐ**
//     （混在内容）。APK（WebView）で包めばこちらが使える。塞がれる組み合わせの
//     ときは試さない（毎回失敗するだけなので）。
//  ② 入口（ds9）の控え … /ban/status.json。Mac が置きにきたもの。札の内側。
//     どこからでも読めるが、置くのは「変わった時だけ・作っている間は5分」。
//     入口の KV は1日1000回で止まるため（実際に止めた事がある）。
const GATE = '/ban/status.json';

function underGate(){
  // 入口（ds9）の下にいるか。github.io に直で置いた時と、手元の確認用の
  // サーバーでは控えが無いので叩きにいかない（毎回 404 になるだけ）。
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
// https の盤から http の Mac は読めない（ブラウザが塞ぐ）
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
  hint:'いま作っている本・待ち行列・残り時間',
  create(ctx){
    const el = document.createElement('div');
    el.className = 'p-mimi';
    if (!document.getElementById('p-mimi-css')){
      const st = document.createElement('style'); st.id = 'p-mimi-css';
      st.textContent =
        '.p-mimi{height:100%;overflow:hidden;padding:.8em .95em;display:flex;flex-direction:column;gap:.55em}' +
        '.p-mimi .ttl{font-size:1.02em;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.p-mimi .sub{color:var(--dim);font-size:.8em;font-variant-numeric:tabular-nums}' +
        '.p-mimi .bar{height:.5em;border-radius:.25em;background:#0c0c10;border:1px solid var(--line);' +
        'overflow:hidden}' +
        '.p-mimi .bar i{display:block;height:100%;background:var(--ok);transition:width .4s}' +
        '.p-mimi .busy{color:var(--warn);font-size:.8em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.p-mimi .nums{display:flex;gap:1.1em;margin-top:auto;padding-top:.4em;' +
        'border-top:1px solid var(--line)}' +
        '.p-mimi .nums div{display:flex;flex-direction:column}' +
        '.p-mimi .nums b{font-size:1.25em;font-weight:500;font-variant-numeric:tabular-nums}' +
        '.p-mimi .nums span{color:var(--dim2);font-size:.72em}' +
        '.p-mimi .old{color:var(--dim2);font-size:.72em}' +
        '.p-mimi .dead{color:var(--dim2);font-size:.9em;margin:auto;text-align:center;line-height:1.7}' +
        '.p-mimi .dead b{display:block;color:var(--dim);font-weight:500;font-size:1.1em}';
      document.head.appendChild(st);
    }

    let d = null, why = '', from = '';

    function paint(){
      if (!d){
        el.innerHTML = '<div class="dead"><b>耳読に届きません</b>' +
          (why ? '<span>' + why + '</span>' : '') + '</div>';
        return;
      }
      const n = d.now;
      const pct = (n && n.chapters) ? Math.round(n.chapter / n.chapters * 100) : 0;
      let h = '';
      if (n){
        h += '<div class="ttl">' + esc(n.title) + '</div>' +
             '<div class="sub">' + n.chapter + ' / ' + n.chapters + ' ' + esc(n.unit || '章') +
             (n.phase ? '　' + esc(n.phase) : '') +
             '　残り ' + esc(n.left || '—') + '</div>' +
             '<div class="bar"><i style="width:' + pct + '%"></i></div>';
      } else {
        h += '<div class="ttl">作っている本はありません</div>' +
             '<div class="sub">' + (d.engine ? '声の器は起きています' : '声の器は止まっています') + '</div>';
      }
      if (d.busy) h += '<div class="busy">裏の作業：' + esc(d.busy) + '</div>';
      h += '<div class="nums">' +
           '<div><b>' + d.queue + '</b><span>待ち</span></div>' +
           '<div><b>' + d.held + '</b><span>保留</span></div>' +
           '<div><b>' + esc(d.allLeft) + '</b><span>全部揃うのは</span></div>' +
           '<div><b>' + d.rate + '%</b><span>稼働（24h）</span></div>' +
           '</div>';
      const old = ago(d.at);
      if (old || from === 'gate'){
        h += '<div class="old">' + (old ? old + '　' : '') +
             (from === 'mac' ? 'Mac から直に' : '入口の控えから') + '</div>';
      }
      el.innerHTML = h;
    }
    function esc(s){
      return String(s == null ? '' : s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function get(url, ms){
      // AbortController は Fire OS の WebView にもある。無ければ待つだけ。
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
        // Mac 直なら 20秒、控えなら 60秒。控えは5分ごとにしか変わらない
        const span = (from === 'mac') ? 20000 : 60000;
        if (Date.now() - last > span){ last = Date.now(); pull(); }
      },
      refresh(){ last = Date.now(); pull(); }
    };
  }
};
