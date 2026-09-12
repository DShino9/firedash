// 耳読の処理状況。いまは仮の中身。
// 本番は 家の中は Mac 直（http://<Mac>:8770/api/queue）、届かなければ Cloudflare の控え（要件 7）。
const MAC = null;    // 例：'http://mac.local:8770'
const CLOUD = null;  // 例：'https://frosty-bird-8f19.d-shino.workers.dev/api/queue'

function karidata(){
  return { kari:true, from:'仮',
    now:{ title:'（仮）ユング自伝', chapter:12, chapters:40, left:'2時間14分' },
    busy:'（仮）作成後の再検査をしています',
    queue:7, held:1, allLeft:'（仮）38時間', rate:24 };
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
        '.p-mimi .bar i{display:block;height:100%;background:var(--ok)}' +
        '.p-mimi .busy{color:var(--warn);font-size:.8em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.p-mimi .nums{display:flex;gap:1.1em;margin-top:auto;padding-top:.4em;' +
        'border-top:1px solid var(--line)}' +
        '.p-mimi .nums div{display:flex;flex-direction:column}' +
        '.p-mimi .nums b{font-size:1.25em;font-weight:500;font-variant-numeric:tabular-nums}' +
        '.p-mimi .nums span{color:var(--dim2);font-size:.72em}' +
        '.p-mimi .kari{color:var(--warn);font-size:.72em}' +
        '.p-mimi .dead{color:var(--dim2);font-size:.85em;margin:auto;text-align:center}';
      document.head.appendChild(st);
    }

    let d = karidata();

    function paint(){
      if (!d){
        el.innerHTML = '<div class="dead">耳読に届きません<br><span style="font-size:.85em">Mac が寝ているか、外にいます</span></div>';
        return;
      }
      const pct = d.now ? Math.round(d.now.chapter / d.now.chapters * 100) : 0;
      let h = '';
      if (d.now){
        h += '<div class="ttl">' + d.now.title + '</div>' +
             '<div class="sub">' + d.now.chapter + ' / ' + d.now.chapters + ' 章　残り ' + d.now.left + '</div>' +
             '<div class="bar"><i style="width:' + pct + '%"></i></div>';
      } else {
        h += '<div class="ttl">作っている本はありません</div>';
      }
      if (d.busy) h += '<div class="busy">裏の作業：' + d.busy + '</div>';
      h += '<div class="nums">' +
           '<div><b>' + d.queue + '</b><span>待ち</span></div>' +
           '<div><b>' + d.held + '</b><span>保留</span></div>' +
           '<div><b>' + d.allLeft + '</b><span>全部揃うのは</span></div>' +
           '<div><b>' + d.rate + '%</b><span>稼働（24h）</span></div>' +
           '</div>';
      if (d.kari) h += '<div class="kari">仮の中身です。耳読にはまだ繋いでいません（要件 7）</div>';
      el.innerHTML = h;
    }

    function pull(){
      const tries = [];
      if (MAC) tries.push(MAC + '/api/queue');
      if (CLOUD) tries.push(CLOUD);
      if (!tries.length){ d = karidata(); paint(); return; }
      (function go(i){
        if (i >= tries.length){ d = null; paint(); return; }
        fetch(tries[i], { cache:'no-store' })
          .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function(j){ d = j; paint(); })
          .catch(function(){ go(i+1); });
      })(0);
    }

    pull();
    let last = Date.now();

    return {
      el: el,
      tick(){ if (Date.now() - last > 20*1000){ last = Date.now(); pull(); } },
      refresh(){ pull(); }
    };
  }
};
