// YouTube の窓（要件 6）＝ **BGM の棚**。
// 押すと枠の中で流れ続ける。弾かれたら公式アプリへ渡す。
//
// 並びの正本は playlists.json（1件足すだけで増える）。端末ごとの追加は
// 設定ではなくここに足す方針＝どの端末でも同じ棚が出る。
//
// 動かし方は postMessage だけで済ませる（iframe_api の読み込みが要らない。
// Fire OS の古い WebView で、外の script が落ちても棚は死なない）。
const ORIGIN = 'https://www.youtube.com';

export default {
  id:'youtube', name:'YouTube', icon:'▶️',
  hint:'BGM の棚。押すと枠の中で流れ続ける',
  create(ctx){
    const el = document.createElement('div');
    el.className = 'p-yt';
    if (!document.getElementById('p-yt-css')){
      const st = document.createElement('style'); st.id = 'p-yt-css';
      st.textContent =
        '.p-yt{height:100%;position:relative;overflow:hidden}' +
        '.p-yt .list.over{position:absolute;inset:0;background:rgba(11,11,15,.93);z-index:2}' +
        '.p-yt .list{height:100%;overflow:auto;padding:.6em .7em;scrollbar-width:none;' +
        'display:grid;gap:.6em;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));' +
        'align-content:start}' +
        '.p-yt .list::-webkit-scrollbar{display:none}' +
        '.p-yt .it{border:2px solid transparent;border-radius:11px;padding:.25em;text-align:left;' +
        'width:100%;background:none}' +
        '.p-yt .it.sel{border-color:var(--accent);background:#152036}' +
        '.p-yt .th{display:block;position:relative;aspect-ratio:16/9;background:#0c0c10;' +
        'border:1px solid var(--line);border-radius:8px;overflow:hidden}' +
        '.p-yt .th img{width:100%;height:100%;object-fit:cover;display:block}' +
        '.p-yt .th .g{position:absolute;left:.3em;bottom:.3em;background:rgba(0,0,0,.82);' +
        'border-radius:5px;padding:.05em .4em;font-size:.72em}' +
        '.p-yt .ti{display:block;font-size:.8em;margin-top:.3em;line-height:1.3;max-height:2.6em;' +
        'overflow:hidden}' +
        '.p-yt .by{display:block;font-size:.71em;color:var(--dim2);overflow:hidden;' +
        'text-overflow:ellipsis;white-space:nowrap}' +
        '.p-yt .play{position:absolute;inset:0;background:#000;display:flex;flex-direction:column}' +
        '.p-yt .play.hide{display:none !important}' +
        '.p-yt .play iframe{flex:1;width:100%;height:100%;border:0;display:block}' +
        '.p-yt .play .foot{flex:none;display:flex;align-items:center;gap:.6em;padding:.3em .6em;' +
        'background:#0c0c10;border-top:1px solid var(--line);font-size:.76em;color:var(--dim)}' +
        '.p-yt .play .foot .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;' +
        'white-space:nowrap}' +
        '.p-yt .fail{position:absolute;inset:0;display:flex;flex-direction:column;gap:.8em;' +
        'align-items:center;justify-content:center;text-align:center;padding:1em;' +
        'background:var(--bg2);font-size:.9em}' +
        '.p-yt .fail .b{padding:.5em 1.1em;border-radius:10px;border:2px solid var(--accent);' +
        'color:var(--accent)}' +
        '.p-yt .fail span{color:var(--dim2);font-size:.82em;line-height:1.6}';
      document.head.appendChild(st);
    }

    let lists = [], sel = 0, playing = null, frame = null, alive = false, watch = 0;
    let shelf = true;                 // 棚を出しているか（器の上に重ねる）
    let vol = (ctx.cfg.vol == null) ? 100 : ctx.cfg.vol;
    el.innerHTML = '<div class="play hide"></div><div class="list"></div>';
    const playBox = el.querySelector('.play');
    const listBox = el.querySelector('.list');

    function esc(s){
      return String(s == null ? '' : s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function drawList(){
      if (!lists.length){
        listBox.innerHTML = '<div class="fail"><span>BGM の棚が読めませんでした</span></div>';
        return;
      }
      let h = '';
      lists.forEach(function(v, i){
        h += '<button class="it' + (i === sel ? ' sel' : '') + '" data-i="' + i + '">' +
             '<span class="th">' +
             (v.thumb ? '<img src="' + esc(v.thumb) + '" alt="" loading="lazy">' : '') +
             '<span class="g">' + esc(v.genre) + '</span></span>' +
             '<span class="ti">' + esc(v.name) + '</span>' +
             '<span class="by">' + esc(v.by) + '</span></button>';
      });
      listBox.innerHTML = h;
      listBox.classList.toggle('over', !!playing);
      listBox.classList.toggle('hide', !shelf);
      listBox.querySelectorAll('.it').forEach(function(b){
        b.addEventListener('click', function(){ sel = +b.dataset.i; play(lists[sel]); });
      });
    }

    function play(v){
      if (!v) return;
      playing = v; alive = false; shelf = false;
      const mute = ctx.cfg.mute ? 1 : 0;
      const src = ORIGIN + '/embed/videoseries?list=' + encodeURIComponent(v.id) +
        '&autoplay=1&mute=' + mute + '&enablejsapi=1&playsinline=1&rel=0&iv_load_policy=3' +
        '&origin=' + encodeURIComponent(location.origin);
      playBox.classList.remove('hide');
      playBox.innerHTML = '<iframe allow="autoplay; encrypted-media" ' +
        'allowfullscreen src="' + esc(src) + '"></iframe>' +
        '<div class="foot"><span class="nm">' + esc(v.name) + '</span>' +
        '<span class="tip"></span></div>';
      listBox.classList.add('hide');
      frame = playBox.querySelector('iframe');
      tip();
      toggle.on = true;          // 流れている状態から始まる（最初の決定は「とめる」）
      // 器が生きているか確かめる。返事が無ければ弾かれたとみなす。
      clearTimeout(watch);
      watch = setTimeout(function(){ if (!alive) failed(); }, 9000);
      setTimeout(function(){ post('listening'); }, 1200);
    }

    function failed(){
      playBox.innerHTML = '<div class="fail"><b>枠の中では流せませんでした</b>' +
        '<span>この棚は埋め込みを断っているようです。<br>公式アプリなら流せます。</span>' +
        '<button class="b" data-act="app">公式アプリで開く</button>' +
        '<span>戻る で棚にもどります</span></div>';
      const b = el.querySelector('[data-act="app"]');
      if (b) b.addEventListener('click', toApp);
    }

    function toApp(){
      if (!playing) return;
      // Fire の YouTube アプリへ渡す。開けなければ普通の住所で開く。
      const u = 'https://www.youtube.com/playlist?list=' + encodeURIComponent(playing.id);
      try { location.href = 'vnd.youtube://www.youtube.com/playlist?list=' + playing.id; }
      catch(e){ /* 器が知らない道。下で開く */ }
      setTimeout(function(){ window.open(u, '_blank'); }, 700);
    }

    function tip(){
      const t = playBox.querySelector('.tip');
      if (t) t.textContent = '決定 とめる／ながす　左右 曲送り　上下 音量' + vol +
        '　戻る 棚へ（鳴ったまま）';
    }

    function showShelf(){
      shelf = true;
      drawList();                       // 器は消さない。棚を上に重ねるだけ
    }

    function post(kind, func, args){
      if (!frame || !frame.contentWindow) return;
      const msg = (kind === 'listening')
        ? { event:'listening', id:1, channel:'widget' }
        : { event:'command', func:func, args: args || [] };
      try { frame.contentWindow.postMessage(JSON.stringify(msg), ORIGIN); } catch(e){}
    }

    function onMsg(e){
      if (e.origin !== ORIGIN || !frame) return;
      alive = true;               // 返事があった＝器は生きている
      clearTimeout(watch);
      try {
        const d = JSON.parse(e.data);
        const info = d && d.info;
        if (info && info.videoData && info.videoData.title){
          const nm = el.querySelector('.foot .nm');
          if (nm) nm.textContent = info.videoData.title;
        }
      } catch(err){}
    }
    window.addEventListener('message', onMsg);

    function stop(){
      clearTimeout(watch);
      playing = null; frame = null; alive = false; shelf = true;
      playBox.classList.add('hide'); playBox.innerHTML = '';
      drawList();
    }

    function cols(){
      return Math.max(1, Math.floor(listBox.clientWidth / 150));
    }

    // 棚を読む。index.html と同じ所に置いてある。
    fetch('./playlists.json', { cache:'no-cache' })
      .then(function(r){ return r.json(); })
      .then(function(j){ lists = j.lists || []; drawList(); })
      .catch(function(){ drawList(); });
    drawList();

    return {
      el: el,
      onKey(e){
        // 器が動いていて、棚を重ねていないとき＝「流している画面」
        if (playing && !shelf){
          if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack'){
            showShelf(); return true;          // 棚へ。**鳴ったまま**
          }
          if (e.key === 'Enter' || e.key === ' '){ toggle(); return true; }
          if (e.key === 'ArrowRight'){ post('cmd','nextVideo'); return true; }
          if (e.key === 'ArrowLeft'){ post('cmd','previousVideo'); return true; }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){
            vol = Math.max(0, Math.min(100, vol + (e.key === 'ArrowUp' ? 10 : -10)));
            ctx.cfg.vol = vol; ctx.save();
            post('cmd', 'setVolume', [vol]);
            post('cmd', vol === 0 ? 'mute' : 'unMute');
            tip(); return true;
          }
          return false;                        // 1〜5 などは盤へ渡す
        }
        const c = cols();
        let n = sel;
        if (e.key === 'ArrowRight') n = sel + 1;
        else if (e.key === 'ArrowLeft') n = sel - 1;
        else if (e.key === 'ArrowDown') n = sel + c;
        else if (e.key === 'ArrowUp') n = sel - c;
        else if (e.key === 'Enter' || e.key === ' '){ play(lists[sel]); return true; }
        else return false;   // 戻る＝枠から出る（鳴っていてもそのまま鳴り続ける）
        if (n < 0 || n >= lists.length) return false;   // 端では盤にもどす
        sel = n; drawList();
        const cur = el.querySelector('.it.sel');
        if (cur && cur.scrollIntoView) cur.scrollIntoView({ block:'nearest' });
        return true;
      },
      leave(){ /* 枠から出ても流し続ける（BGM なので止めない） */ },
      destroy(){
        clearTimeout(watch);
        window.removeEventListener('message', onMsg);
      }
    };

    // 「とめる／ながす」は器の状態を持たないので、押すたびに入れ替える
    function toggle(){
      toggle.on = !toggle.on;
      post('cmd', toggle.on ? 'playVideo' : 'pauseVideo');
    }
  }
};
