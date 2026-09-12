// YouTube。いまは仮の並び。
// 本番は ①一覧（チャンネルRSS か登録チャンネル。要件の未決事項）
//        ②枠の中で埋め込み再生。弾かれたら公式アプリへ渡す（要件 6）
const KARI = [
  { id:'', title:'（仮）動画のならび1', ch:'チャンネル名', len:'12:04' },
  { id:'', title:'（仮）動画のならび2', ch:'チャンネル名', len:'8:41' },
  { id:'', title:'（仮）動画のならび3', ch:'チャンネル名', len:'24:19' },
  { id:'', title:'（仮）動画のならび4', ch:'チャンネル名', len:'5:02' },
  { id:'', title:'（仮）動画のならび5', ch:'チャンネル名', len:'46:30' },
  { id:'', title:'（仮）動画のならび6', ch:'チャンネル名', len:'3:18' }
];

export default {
  id:'youtube', name:'YouTube', icon:'▶️',
  hint:'新着のならび。枠の中で再生',
  create(ctx){
    const el = document.createElement('div');
    el.className = 'p-yt';
    if (!document.getElementById('p-yt-css')){
      const st = document.createElement('style'); st.id = 'p-yt-css';
      st.textContent =
        '.p-yt{height:100%;overflow:auto;padding:.6em .7em;scrollbar-width:none}' +
        '.p-yt::-webkit-scrollbar{display:none}' +
        '.p-yt .list{display:grid;gap:.55em;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}' +
        '.p-yt .it{border:2px solid transparent;border-radius:10px;padding:.25em;text-align:left;width:100%}' +
        '.p-yt .it.sel{border-color:var(--accent);background:#152036}' +
        '.p-yt .th{aspect-ratio:16/9;background:#0c0c10;border:1px solid var(--line);border-radius:7px;' +
        'display:flex;align-items:center;justify-content:center;color:var(--dim2);font-size:.75em;' +
        'position:relative;overflow:hidden}' +
        '.p-yt .th .len{position:absolute;right:.3em;bottom:.25em;background:rgba(0,0,0,.8);' +
        'border-radius:4px;padding:0 .3em;font-size:.9em;color:var(--fg)}' +
        '.p-yt .ti{display:block;font-size:.82em;margin-top:.3em;line-height:1.3;max-height:2.6em;' +
        'overflow:hidden}' +
        '.p-yt .ch{display:block;font-size:.72em;color:var(--dim2);margin-top:.15em;' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.p-yt .th{display:flex}' +
        '.p-yt .kari{color:var(--warn);font-size:.72em;margin-top:.8em;' +
        'border-top:1px dashed var(--line);padding-top:.55em}';
      document.head.appendChild(st);
    }

    let sel = 0;
    const items = KARI;

    function paint(){
      let h = '<div class="list">';
      items.forEach(function(v, i){
        h += '<button class="it' + (i === sel ? ' sel' : '') + '" data-i="' + i + '">' +
             '<span class="th">▶<span class="len">' + v.len + '</span></span>' +
             '<span class="ti">' + v.title + '</span>' +
             '<span class="ch">' + v.ch + '</span></button>';
      });
      h += '</div><div class="kari">仮の並びです。一覧の出どころと枠内再生はこれから（要件 6）</div>';
      el.innerHTML = h;
      el.querySelectorAll('.it').forEach(function(b){
        b.addEventListener('click', function(){ sel = +b.dataset.i; paint(); play(); });
      });
    }

    function play(){
      ctx.note('まだ繋いでいません（要件 6：枠内再生 → 駄目なら公式アプリ）');
    }

    function cols(){
      const list = el.querySelector('.list');
      if (!list) return 1;
      const w = list.clientWidth;
      return Math.max(1, Math.floor(w / 150));
    }

    paint();

    return {
      el: el,
      onKey(e){
        const c = cols();
        let n = sel;
        if (e.key === 'ArrowRight') n = sel + 1;
        else if (e.key === 'ArrowLeft') n = sel - 1;
        else if (e.key === 'ArrowDown') n = sel + c;
        else if (e.key === 'ArrowUp') n = sel - c;
        else if (e.key === 'Enter' || e.key === ' '){ play(); return true; }
        else return false;
        if (n < 0 || n >= items.length) return false;   // 端では盤にもどす
        sel = n; paint();
        const cur = el.querySelector('.it.sel');
        if (cur && cur.scrollIntoView) cur.scrollIntoView({ block:'nearest' });
        return true;
      },
      refresh(){ paint(); }
    };
  }
};
