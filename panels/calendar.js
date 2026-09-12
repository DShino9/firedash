// カレンダー。いまは仮の中身。
// 本番は Cloudflare の Worker が Google カレンダー（複数）を束ねた JSON を配り、ここはそれを描くだけ。
// → 端末では Google のログインを通さない（要件 5）。
const SRC = null;   // 本番の配り口。決まったらここに URL を入れる
const DOW = ['日','月','火','水','木','金','土'];

// 仮の中身。形だけ本番と同じにしてある。
function karidata(){
  const t = new Date(); t.setHours(0,0,0,0);
  const d = function(day, h, m){ const x = new Date(t); x.setDate(x.getDate()+day); x.setHours(h,m); return x.toISOString(); };
  return { kari:true, cals:[
      {id:'main', name:'予定', color:'#6ea8fe'},
      {id:'fam',  name:'家',   color:'#5fbf7f'}
    ], events:[
      {cal:'main', title:'（仮）打ち合わせ',     start:d(0,10,0),  end:d(0,11,0)},
      {cal:'fam',  title:'（仮）買い物',         start:d(0,15,30), end:d(0,16,30)},
      {cal:'main', title:'（仮）耳読の様子を見る', start:d(0,21,0),  end:d(0,21,30)},
      {cal:'fam',  title:'（仮）ごみの日',        allday:true,      start:d(1,0,0)},
      {cal:'main', title:'（仮）歯医者',          start:d(1,14,0),  end:d(1,15,0)}
    ] };
}

export default {
  id:'calendar', name:'カレンダー', icon:'📅',
  hint:'今日と明日の予定。複数カレンダー',
  create(ctx){
    const el = document.createElement('div');
    el.className = 'p-cal';
    if (!document.getElementById('p-cal-css')){
      const st = document.createElement('style'); st.id = 'p-cal-css';
      st.textContent =
        '.p-cal{height:100%;overflow:auto;padding:.7em .9em;scrollbar-width:none}' +
        '.p-cal::-webkit-scrollbar{display:none}' +
        '.p-cal .day{color:var(--dim2);font-size:.78em;letter-spacing:.08em;margin:.2em 0 .45em;' +
        'display:flex;align-items:center;gap:.6em}' +
        '.p-cal .day::after{content:"";flex:1;height:1px;background:var(--line)}' +
        '.p-cal .ev{display:flex;gap:.6em;align-items:baseline;padding:.34em 0}' +
        '.p-cal .ev .tm{font-variant-numeric:tabular-nums;color:var(--dim);font-size:.82em;' +
        'min-width:4.2em;flex:none}' +
        '.p-cal .ev .dot{width:.45em;height:.45em;border-radius:50%;flex:none;align-self:center}' +
        '.p-cal .ev .ti{flex:1;min-width:0;font-size:.92em;overflow:hidden;text-overflow:ellipsis;' +
        'white-space:nowrap}' +
        '.p-cal .none{color:var(--dim2);font-size:.85em;padding:.3em 0}' +
        '.p-cal .kari{color:var(--warn);font-size:.72em;margin-top:.9em;border-top:1px dashed var(--line);' +
        'padding-top:.6em}';
      document.head.appendChild(st);
    }

    let data = karidata();

    function paint(){
      const cols = {};
      data.cals.forEach(function(c){ cols[c.id] = c.color; });
      const now = new Date(); now.setHours(0,0,0,0);
      let h = '';
      for (let k=0;k<2;k++){
        const d0 = new Date(now); d0.setDate(d0.getDate()+k);
        const d1 = new Date(d0);  d1.setDate(d1.getDate()+1);
        const lbl = (k === 0 ? '今日' : '明日') + '　' +
          (d0.getMonth()+1) + '/' + d0.getDate() + '（' + DOW[d0.getDay()] + '）';
        h += '<div class="day">' + lbl + '</div>';
        const list = data.events.filter(function(e){
          const s = new Date(e.start);
          return s >= d0 && s < d1;
        }).sort(function(a,b){ return new Date(a.start) - new Date(b.start); });
        if (!list.length) h += '<div class="none">予定なし</div>';
        list.forEach(function(e){
          const s = new Date(e.start);
          const p = function(n){ return (n<10?'0':'') + n; };
          const tm = e.allday ? '終日' : p(s.getHours()) + ':' + p(s.getMinutes());
          h += '<div class="ev"><span class="tm">' + tm + '</span>' +
               '<span class="dot" style="background:' + (cols[e.cal] || '#888') + '"></span>' +
               '<span class="ti">' + e.title + '</span></div>';
        });
      }
      if (data.kari) h += '<div class="kari">仮の中身です。Google カレンダーはまだ繋いでいません（要件 5）</div>';
      el.innerHTML = h;
    }

    function pull(){
      if (!SRC){ data = karidata(); paint(); return; }
      fetch(SRC).then(function(r){ return r.json(); }).then(function(j){
        data = j; paint();
      }).catch(function(e){ ctx.note('予定が取れません：' + e.message); });
    }

    pull();
    let last = Date.now();

    return {
      el: el,
      tick(){ if (Date.now() - last > 5*60*1000){ last = Date.now(); pull(); } },
      refresh(){ pull(); },
      onKey(e){
        if (e.key === 'ArrowDown' && el.scrollTop + el.clientHeight < el.scrollHeight - 2){
          el.scrollTop += el.clientHeight * .6; return true;
        }
        if (e.key === 'ArrowUp' && el.scrollTop > 0){
          el.scrollTop -= el.clientHeight * .6; return true;
        }
        return false;
      }
    };
  }
};
