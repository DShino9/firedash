// カレンダー（要件 5）。壁掛けカレンダーの月表示と、週表示。
//
// いまの中身は仮。本番は Cloudflare の Worker が Google カレンダー（複数）を
// 束ねた JSON を配り、ここはそれを描くだけ（端末では Google のログインを通さない）。
// 配り口が決まったら SRC に入れる。形は下の karidata() と同じ。
const SRC = '/ban/calendar.json';      // 入口の下にいるときだけ叩く
const LIST = '/ban/calendars.json';    // どのカレンダーがあるか（入り切りの一覧）
const DOW = ['日','月','火','水','木','金','土'];
const HOL = 'https://holidays-jp.github.io/api/v1/';   // 鍵不要・CORS 可

function underGate(){
  const h = location.hostname;
  if (/(^|\.)github\.io$/.test(h)) return false;
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false;
  return location.protocol !== 'file:';
}
function ymd(d){
  const p = function(n){ return (n<10?'0':'') + n; };
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
}
function sameDay(a,b){ return ymd(a) === ymd(b); }

// 仮の中身。月表示の見え方を確かめられるよう、ひと月ぶん撒いてある。
function karidata(){
  const now = new Date();
  const mk = function(day, h, m, len, cal, title, allday){
    const s = new Date(now.getFullYear(), now.getMonth(), day, h, m);
    const e = new Date(s.getTime() + (len||60)*60000);
    return { cal:cal, title:title, allday:!!allday,
             start:s.toISOString(), end:e.toISOString() };
  };
  const t = now.getDate();
  return { kari:true, cals:[
      {id:'main', name:'予定', color:'#6ea8fe'},
      {id:'fam',  name:'家',   color:'#5fbf7f'},
      {id:'work', name:'仕事', color:'#e5a34a'}
    ], events:[
      mk(Math.max(1,t-6), 19, 0, 120, 'fam',  '（仮）夕飯の約束'),
      mk(Math.max(1,t-3), 10, 0,  60, 'work', '（仮）定例'),
      mk(t,   10, 0,  60, 'main', '（仮）打ち合わせ'),
      mk(t,   15, 30, 60, 'fam',  '（仮）買い物'),
      mk(t,   21, 0,  30, 'main', '（仮）耳読の様子を見る'),
      mk(t+1, 0,  0,   0, 'fam',  '（仮）ごみの日', true),
      mk(t+1, 14, 0,  60, 'main', '（仮）歯医者'),
      mk(t+3, 9,  30, 90, 'work', '（仮）打ち合わせ（長め）'),
      mk(t+5, 0,  0,   0, 'main', '（仮）締め切り', true),
      mk(t+8, 13, 0,  60, 'fam',  '（仮）散髪')
    ] };
}

export default {
  id:'calendar', name:'カレンダー', icon:'📅',
  hint:'壁掛けの月表示と週表示',
  create(ctx){
    const el = document.createElement('div');
    el.className = 'p-cal';
    if (!document.getElementById('p-cal-css')){
      const st = document.createElement('style'); st.id = 'p-cal-css';
      st.textContent = [
        '.p-cal{height:100%;display:flex;flex-direction:column;font-size:var(--cz,14px)}',
        '.p-cal .hd{flex:none;display:flex;align-items:baseline;gap:.6em;padding:.45em .7em .3em}',
        '.p-cal .hd b{font-size:1.5em;font-weight:500;letter-spacing:.01em}',
        '.p-cal .hd .sub{color:var(--dim2);font-size:.82em}',
        '.p-cal .hd .sp{flex:1}',
        '.p-cal .hd .md{color:var(--dim2);font-size:.78em;border:1px solid var(--line);',
        'border-radius:6px;padding:.05em .5em}',
        '.p-cal .dows{flex:none;display:grid;grid-template-columns:repeat(7,1fr);',
        'border-bottom:1px solid var(--line)}',
        '.p-cal .dows span{text-align:center;font-size:.78em;color:var(--dim2);padding:.15em 0}',
        '.p-cal .dows span.sun{color:#e06c75}.p-cal .dows span.sat{color:#6ea8fe}',
        '.p-cal .grid{flex:1;min-height:0;display:grid;grid-template-columns:repeat(7,1fr)}',
        '.p-cal .cell{border-right:1px solid var(--line);border-bottom:1px solid var(--line);',
        'padding:.15em .25em;min-width:0;overflow:hidden;display:flex;flex-direction:column;gap:.1em}',
        '.p-cal .cell:nth-child(7n){border-right:0}',
        '.p-cal .cell .d{font-size:.92em;font-variant-numeric:tabular-nums;line-height:1.1}',
        '.p-cal .cell.sun .d{color:#e06c75}.p-cal .cell.sat .d{color:#6ea8fe}',
        '.p-cal .cell.hol .d{color:#e06c75}',
        '.p-cal .cell.out{opacity:.32}',
        '.p-cal .cell.today{background:#16213a}',
        '.p-cal .cell.today .d{color:var(--accent);font-weight:600}',
        '.p-cal .cell .hn{font-size:.66em;color:#e06c75;line-height:1.15;',
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.p-cal .ev{display:flex;align-items:center;gap:.25em;font-size:.72em;line-height:1.25;',
        'overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
        '.p-cal .ev i{width:.42em;height:.42em;border-radius:50%;flex:none}',
        '.p-cal .ev.bar{border-radius:3px;padding:0 .25em;color:#0b0b0f;font-weight:600}',
        '.p-cal .more{font-size:.66em;color:var(--dim2)}',
        '.p-cal .dots{display:flex;gap:.16em;flex-wrap:wrap}',
        '.p-cal .dots i{width:.36em;height:.36em;border-radius:50%}',
        /* 週表示 */
        '.p-cal .week{flex:1;min-height:0;display:grid;grid-template-columns:repeat(7,1fr)}',
        '.p-cal .wc{border-right:1px solid var(--line);padding:.3em .35em;min-width:0;',
        'display:flex;flex-direction:column;gap:.22em;overflow:hidden}',
        '.p-cal .wc:last-child{border-right:0}',
        '.p-cal .wc.today{background:#16213a}',
        '.p-cal .wc .wh{font-size:.8em;color:var(--dim2);display:flex;align-items:baseline;gap:.3em;',
        'border-bottom:1px solid var(--line);padding-bottom:.2em;margin-bottom:.1em}',
        '.p-cal .wc .wh b{font-size:1.35em;font-weight:500;color:var(--fg);',
        'font-variant-numeric:tabular-nums}',
        '.p-cal .wc.sun .wh b{color:#e06c75}.p-cal .wc.sat .wh b{color:#6ea8fe}',
        '.p-cal .wc.today .wh b{color:var(--accent)}',
        /* 題を横に並べると 7列では必ず切れる。時刻を上、題を下の2段にする */
        '.p-cal .we{font-size:.78em;line-height:1.3;display:flex;flex-direction:column;',
        'gap:.05em;border-left:2px solid var(--line);padding-left:.35em}',
        '.p-cal .we .tm{color:var(--dim);font-variant-numeric:tabular-nums;font-size:.9em;',
        'display:flex;align-items:center;gap:.3em}',
        '.p-cal .we .tm i{width:.4em;height:.4em;border-radius:50%;flex:none}',
        '.p-cal .we .ti{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;',
        '-webkit-box-orient:vertical;word-break:break-all}',
        '.p-cal .picks{flex:1;min-height:0;overflow:auto;padding:.3em .5em;scrollbar-width:none}',
        '.p-cal .picks::-webkit-scrollbar{display:none}',
        '.p-cal .pk{display:flex;align-items:center;gap:.5em;padding:.3em .5em;border-radius:8px;',
        'font-size:.9em;border:2px solid transparent}',
        '.p-cal .pk.sel{border-color:var(--accent);background:#152036}',
        '.p-cal .pk .bx{color:var(--accent);width:1em}',
        '.p-cal .pk i{width:.55em;height:.55em;border-radius:50%;flex:none}',
        '.p-cal .pk .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.p-cal .foot{flex:none;display:flex;gap:.8em;align-items:center;padding:.2em .7em;',
        'border-top:1px solid var(--line);font-size:.7em;color:var(--dim2)}',
        '.p-cal .foot .kari{color:var(--warn)}'
      ].join('');
      document.head.appendChild(st);
    }

    let data = karidata();
    let all = [];                    // 持っているカレンダー全部（入り切りの一覧）
    let on = null;                   // 出しているものの id。null なら入口の既定
    let pick = 0;                    // 入り切りの一覧で選んでいる行
    let view = 'month';
    let cur = new Date();            // 見ている月／週の起点
    let hols = {};
    let touched = 0;                 // 最後に動かした時刻（放っておくと今日へ戻る）

    function esc(s){
      return String(s == null ? '' : s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function colorOf(id){
      const c = (data.cals || []).filter(function(x){ return x.id === id; })[0];
      return c ? c.color : '#8b8b99';
    }
    function evOf(day){
      const k = ymd(day);
      return (data.events || []).filter(function(e){
        return ymd(new Date(e.start)) === k;
      }).sort(function(a,b){
        if (a.allday !== b.allday) return a.allday ? -1 : 1;
        return new Date(a.start) - new Date(b.start);
      });
    }
    function hhmm(d){
      const p = function(n){ return (n<10?'0':'') + n; };
      return p(d.getHours()) + ':' + p(d.getMinutes());
    }

    // ---- 祝日（鍵不要・年ごとに1回だけ取り、端末に控える）
    function loadHol(year){
      const key = 'firedash-hol-' + year;
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){}
      if (cached && cached.at && Date.now() - cached.at < 30*86400000){
        Object.assign(hols, cached.d); paint(); return;
      }
      fetch(HOL + year + '/date.json', { cache:'no-cache' })
        .then(function(r){ return r.json(); })
        .then(function(j){
          Object.assign(hols, j);
          try { localStorage.setItem(key, JSON.stringify({ at:Date.now(), d:j })); } catch(e){}
          paint();
        }).catch(function(){ /* 祝日が無くても暦は出る */ });
    }

    // ---- 月表示
    function paintMonth(){
      const y = cur.getFullYear(), m = cur.getMonth();
      const first = new Date(y, m, 1);
      const start = new Date(y, m, 1 - first.getDay());
      const weeks = Math.ceil((first.getDay() + new Date(y, m+1, 0).getDate()) / 7);
      const today = new Date();
      const small = el.clientHeight / Math.max(weeks,1) < 58;     // 枠が低いときは点だけ

      let h = '<div class="hd"><b>' + y + '年' + (m+1) + '月</b>' +
        '<span class="sub">' + (sameDay(first, new Date(today.getFullYear(), today.getMonth(), 1))
          ? '今月' : '') + '</span><span class="sp"></span>' +
        '<span class="md">月</span></div>';
      h += '<div class="dows">';
      for (let i=0;i<7;i++){
        h += '<span class="' + (i===0?'sun':(i===6?'sat':'')) + '">' + DOW[i] + '</span>';
      }
      h += '</div><div class="grid" style="grid-template-rows:repeat(' + weeks + ',1fr)">';
      const d = new Date(start);
      for (let k=0;k<weeks*7;k++){
        const inMonth = d.getMonth() === m;
        const key = ymd(d);
        const hol = hols[key];
        const cls = ['cell'];
        if (!inMonth) cls.push('out');
        if (d.getDay() === 0) cls.push('sun');
        if (d.getDay() === 6) cls.push('sat');
        if (hol) cls.push('hol');
        if (sameDay(d, today)) cls.push('today');
        h += '<div class="' + cls.join(' ') + '"><span class="d">' + d.getDate() + '</span>';
        if (hol && !small) h += '<span class="hn">' + esc(hol) + '</span>';
        const evs = evOf(d);
        if (small){
          if (evs.length){
            h += '<span class="dots">';
            evs.slice(0,6).forEach(function(e){
              h += '<i style="background:' + colorOf(e.cal) + '"></i>';
            });
            h += '</span>';
          }
        } else {
          const room = hol ? 2 : 3;
          evs.slice(0, room).forEach(function(e){
            if (e.allday){
              h += '<span class="ev bar" style="background:' + colorOf(e.cal) + '">' +
                   esc(e.title) + '</span>';
            } else {
              h += '<span class="ev"><i style="background:' + colorOf(e.cal) + '"></i>' +
                   hhmm(new Date(e.start)) + ' ' + esc(e.title) + '</span>';
            }
          });
          if (evs.length > room) h += '<span class="more">ほか' + (evs.length - room) + '件</span>';
        }
        h += '</div>';
        d.setDate(d.getDate() + 1);
      }
      h += '</div>';
      el.innerHTML = h + foot();
    }

    // ---- 週表示
    function paintWeek(){
      const start = new Date(cur);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start); end.setDate(end.getDate() + 6);
      const today = new Date();
      let h = '<div class="hd"><b>' + (start.getMonth()+1) + '/' + start.getDate() +
        ' 〜 ' + (end.getMonth()+1) + '/' + end.getDate() + '</b>' +
        '<span class="sub">' + start.getFullYear() + '年</span>' +
        '<span class="sp"></span><span class="md">週</span></div><div class="week">';
      const d = new Date(start);
      for (let i=0;i<7;i++){
        const key = ymd(d);
        const hol = hols[key];
        const cls = ['wc'];
        if (d.getDay() === 0) cls.push('sun');
        if (d.getDay() === 6) cls.push('sat');
        if (sameDay(d, today)) cls.push('today');
        h += '<div class="' + cls.join(' ') + '"><div class="wh"><b>' + d.getDate() + '</b>' +
             DOW[d.getDay()] + (hol ? '<span style="color:#e06c75">' + esc(hol) + '</span>' : '') +
             '</div>';
        const evs = evOf(d);
        if (!evs.length) h += '<div class="we" style="color:var(--dim2)">—</div>';
        evs.forEach(function(e){
          h += '<div class="we" style="border-left-color:' + colorOf(e.cal) + '">' +
               '<span class="tm">' + (e.allday ? '終日' : hhmm(new Date(e.start))) + '</span>' +
               '<span class="ti">' + esc(e.title) + '</span></div>';
        });
        h += '</div>';
        d.setDate(d.getDate() + 1);
      }
      el.innerHTML = h + '</div>' + foot();
    }

    function foot(){
      const tips = view === 'pick' ? '上下 えらぶ　決定 入り切り　戻る 暦へ'
                                   : '左右 前後　決定 月→週→選ぶ　上下 盤へ';
      return '<div class="foot"><span>' + tips + '</span>' +
        (data.kari ? '<span class="kari">仮の中身（Google はまだ繋いでいません）</span>' : '') +
        '</div>';
    }

    function paint(){
      if (view === 'pick') paintPick();
      else if (view === 'week') paintWeek();
      else paintMonth();
    }

    function pull(){
      if (!underGate()){ data = karidata(); paint(); return; }
      const q = (on && on.length) ? ('?cals=' + encodeURIComponent(on.join(','))) : '';
      fetch(SRC + q, { cache:'no-store' })
        .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(j){ data = j; paint(); })
        .catch(function(){ data = karidata(); paint(); });
    }

    // 持っているカレンダーの一覧。入り切りはここから選ぶ。
    function pullList(){
      if (!underGate()) return;
      fetch(LIST, { cache:'no-cache' })
        .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function(j){
          all = j.cals || [];
          if (!on){
            // はじめては入口の既定（自分＋家族）。以後は端末の控えに従う。
            const saved = ctx.cfg.cals;
            on = (saved && saved.length) ? saved.slice() : (j.on || []).slice();
          }
          paint();
        }).catch(function(){});
    }

    function toggle(i){
      const c = all[i];
      if (!c || !on) return;
      const k = on.indexOf(c.id);
      if (k >= 0){ if (on.length <= 1) { ctx.note('最後の1つは消せません'); return; } on.splice(k,1); }
      else on.push(c.id);
      ctx.cfg.cals = on.slice();
      ctx.save();
      paint();
      pull();
    }

    // 入り切りの画面
    function paintPick(){
      let h = '<div class="hd"><b>出すカレンダー</b>' +
        '<span class="sub">決定で入り切り</span><span class="sp"></span>' +
        '<span class="md">選ぶ</span></div><div class="picks">';
      if (!all.length){
        h += '<div class="pk">まだ読めていません（入口ごしに開くと出ます）</div>';
      }
      all.forEach(function(c, i){
        const yes = on && on.indexOf(c.id) >= 0;
        h += '<div class="pk' + (i === pick ? ' sel' : '') + '">' +
             '<span class="bx">' + (yes ? '■' : '□') + '</span>' +
             '<i style="background:' + c.color + '"></i>' +
             '<span class="nm">' + esc(c.name) + '</span></div>';
      });
      h += '</div>' + foot();
      el.innerHTML = h;
      const cur = el.querySelector('.pk.sel');
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block:'nearest' });
    }

    function move(n){
      touched = Date.now();
      if (view === 'week') cur.setDate(cur.getDate() + 7*n);
      else cur.setMonth(cur.getMonth() + n, 1);
      paint();
    }

    loadHol(new Date().getFullYear());
    pullList();
    pull();
    let last = Date.now();

    return {
      el: el,
      tick(){
        if (Date.now() - last > 5*60*1000){ last = Date.now(); pull(); }
        // 放っておいたら今日の月へ戻る（壁に掛ける画面なので）
        if (touched && Date.now() - touched > 3*60*1000){
          touched = 0; cur = new Date(); paint();
        }
      },
      refresh(){ pullList(); pull(); },
      resize(){
        const w = el.clientWidth, hgt = el.clientHeight;
        if (!w || !hgt) return;
        // 枠の大きさに合わせて字を伸び縮みさせる（遠くから見る画面）
        const z = Math.max(10, Math.min(w / 34, hgt / 22));
        el.style.setProperty('--cz', z + 'px');
        paint();
      },
      onKey(e){
        // **リモコンには文字キーが無い。** 十字・決定・戻るだけで全部に届くこと。
        if (view === 'pick'){
          if (e.key === 'ArrowDown'){ pick = Math.min(pick+1, Math.max(all.length-1,0)); paintPick(); return true; }
          if (e.key === 'ArrowUp'){ pick = Math.max(pick-1, 0); paintPick(); return true; }
          if (e.key === 'Enter' || e.key === ' '){ toggle(pick); return true; }
          if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack'){
            view = 'month'; paint(); return true;
          }
          return true;                       // 選んでいる間は盤に取られない
        }
        if (e.key === 'ArrowRight'){ move(1); return true; }
        if (e.key === 'ArrowLeft'){ move(-1); return true; }
        if (e.key === 'Enter' || e.key === ' '){
          view = (view === 'month') ? 'week' : (view === 'week' ? 'pick' : 'month');
          touched = Date.now(); paint(); return true;
        }
        if (e.key === 't' || e.key === 'T'){          // 鍵盤のときだけの近道
          cur = new Date(); touched = 0; paint(); return true;
        }
        if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack'){
          cur = new Date(); touched = 0; paint();     // 出るときは今日に戻しておく
          return false;                                // 枠から出るのは盤にまかせる
        }
        return false;          // 上下は盤へ返す（枠から出るため）
      }
    };
  }
};
