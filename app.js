// 壁の盤 — 盤の骨。型を選び、枠に窓を割り当てる。
// リモコン（十字キー・決定・戻る）と指の両方で同じことができること。
// Fire OS の WebView は版が古いことがある。`?.` と `??` は使わない。

import clock    from './panels/clock.js';
import calendar from './panels/calendar.js';
import youtube  from './panels/youtube.js';
import mimi     from './panels/mimi.js';

const PANELS = [clock, calendar, youtube, mimi];
const byId = {};
PANELS.forEach(function(p){ byId[p.id] = p; });

// 型。n は枠の数。
const LAYOUTS = [
  { id:'l-1',     n:1, label:'1枚',        key:'1' },
  { id:'l-2yoko', n:2, label:'2枚 左右',   key:'2' },
  { id:'l-2tate', n:2, label:'2枚 上下',   key:'3' },
  { id:'l-3',     n:3, label:'3枚',        key:'4' },
  { id:'l-4',     n:4, label:'4枚',        key:'5' }
];
const L = {};
LAYOUTS.forEach(function(l){ L[l.id] = l; });

const KEY = 'firedash-v1';   // 端末に残す控え。接頭辞は必ず firedash-（他アプリの控えを巻き込まない）

// ---- 控え ------------------------------------------------------------
const DEF = {
  layout:'l-4',
  slots:{
    'l-1':['clock'],
    'l-2yoko':['calendar','mimi'],
    'l-2tate':['clock','calendar'],
    'l-3':['youtube','clock','mimi'],
    'l-4':['clock','calendar','youtube','mimi']
  },
  cfg:{ scale:1, edge:0, lat:35.6812, lon:139.7671, place:'東京', mac:'', mute:false }
};

let state = load();

function load(){
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e){ s = null; }
  if (!s) return JSON.parse(JSON.stringify(DEF));
  // 足りないものは既定で埋める（版が上がっても壊れないように）
  if (!s.cfg) s.cfg = {};
  Object.keys(DEF.cfg).forEach(function(k){
    if (s.cfg[k] === undefined) s.cfg[k] = DEF.cfg[k];
  });
  if (!s.slots) s.slots = {};
  Object.keys(DEF.slots).forEach(function(k){
    if (!Array.isArray(s.slots[k])) s.slots[k] = DEF.slots[k].slice();
  });
  if (!L[s.layout]) s.layout = DEF.layout;
  return s;
}
function save(){
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch(e){ note('控えを残せませんでした'); }
}

// ---- 言づて ----------------------------------------------------------
const noteEl = document.getElementById('note');
let noteT = 0;
function note(msg){
  noteEl.textContent = msg;
  noteEl.classList.add('on');
  clearTimeout(noteT);
  noteT = setTimeout(function(){ noteEl.classList.remove('on'); }, 2600);
}

// ---- いまの姿 --------------------------------------------------------
let mode = 'board';      // board / inside / pick / cfg
let focusEl = null;      // いま焦点のある要素
let zoom = -1;           // 一時的に1枚にしている枠。-1 で無し
let live = [];           // 生きている窓（枠ごと）
let pickFor = 0;         // 窓えらびの対象の枠
const ctx = {
  note: note,
  cfg: state.cfg,
  save: save
};

const bar   = document.getElementById('bar');
const board = document.getElementById('board');
const help  = document.getElementById('help');
const pick  = document.getElementById('pick');
const cfgEl = document.getElementById('cfg');

function slotCount(){ return zoom >= 0 ? 1 : L[state.layout].n; }
function slotsOf(){ return state.slots[state.layout]; }
function panelAt(i){
  const ids = slotsOf();
  const id = zoom >= 0 ? ids[zoom] : ids[i];
  return id ? byId[id] : null;
}

// ---- 見た目を作る ----------------------------------------------------
function applyCfg(){
  document.documentElement.style.setProperty('--scale', state.cfg.scale);
  document.documentElement.style.setProperty('--edge', state.cfg.edge + 'px');
}

function drawBar(){
  let h = '<span class="ttl">かたち</span>';
  LAYOUTS.forEach(function(l){
    const on = (zoom < 0 && state.layout === l.id) ? ' on' : '';
    h += '<button class="tab' + on + '" data-nav data-act="layout" data-id="' + l.id + '">' +
         '<span class="n">' + l.key + '</span>' + l.label + '</button>';
  });
  h += '<span class="sp"></span>';
  h += '<button class="tab" data-nav data-act="swap">窓を替える</button>';
  h += '<button class="tab' + (zoom >= 0 ? ' on' : '') + '" data-nav data-act="zoom">' +
       (zoom >= 0 ? 'もどす' : '大きく') + '</button>';
  h += '<span class="now" id="barnow"></span>';
  h += '<button class="tab" data-nav data-act="cfg">⚙ 設定</button>';
  bar.innerHTML = h;
}

function drawHelp(){
  const t = {
    board : '<b>十字</b>えらぶ（上で帯へ）　<b>決定</b>中に入る　'
          + '<span style="color:var(--dim2)">帯：かたち・窓を替える・大きく・設定</span>',
    inside: '<b>十字/決定</b>窓の中を操作　<b>戻る</b>盤にもどる',
    pick  : '<b>十字</b>えらぶ　<b>決定</b>この枠に入れる　<b>戻る</b>やめる',
    cfg   : '<b>十字</b>えらぶ　<b>左右</b>変える　<b>戻る</b>とじる'
  };
  help.innerHTML = t[mode] || '';
}

// 盤の枠は、**一度作ったら動かさない。**
// DOM から外したり付け直したりすると iframe が読み直され、BGM が鳴り止む
// （2026-09-12 に実際そうなった）。かたちを変えるときは、置き場所（grid の
// 行と列）だけを書き換え、使わない枠は隠す。
const CELLS = {
  'l-1':     [{c:'1', r:'1'}],
  'l-2yoko': [{c:'1', r:'1'}, {c:'2', r:'1'}],
  'l-2tate': [{c:'1', r:'1'}, {c:'1', r:'2'}],
  'l-3':     [{c:'1', r:'1 / 3'}, {c:'2', r:'1'}, {c:'2', r:'2'}],
  'l-4':     [{c:'1', r:'1'}, {c:'2', r:'1'}, {c:'1', r:'2'}, {c:'2', r:'2'}]
};
let POOL = [];      // { el, inst, pid } 一度作った枠。使い回す

function slotEl(i){
  for (let k=0;k<POOL.length;k++){
    if (!POOL[k].el.classList.contains('hide') && +POOL[k].el.dataset.i === i) return POOL[k].el;
  }
  return null;
}

function makeSlot(pid){
  const p = pid ? byId[pid] : null;
  const el = document.createElement('div');
  el.className = 'slot' + (p ? '' : ' empty');
  el.dataset.nav = '';
  el.dataset.act = 'slot';
  el.tabIndex = -1;
  const head = document.createElement('div');
  head.className = 'head';
  head.innerHTML = '<span class="ic">' + (p ? p.icon : '➕') + '</span>' +
    '<span class="nm">' + (p ? p.name : '空き') + '</span>' +
    '<span class="sw">替える ▾</span>';
  el.appendChild(head);
  const body = document.createElement('div');
  body.className = 'body';
  el.appendChild(body);
  let inst = null;
  if (p){
    inst = p.create(ctx);
    inst._pid = p.id;
    body.appendChild(inst.el);
  } else {
    body.innerHTML = '<div>窓がありません</div>' +
      '<div style="font-size:.8em;color:var(--dim2)">決定 → 窓をえらぶ</div>';
  }
  board.appendChild(el);            // **付けるのはここ一回だけ**
  return { el: el, inst: inst, pid: pid || null };
}

function drawBoard(){
  const n = slotCount();
  const want = [];
  for (let i=0;i<n;i++){ const p = panelAt(i); want.push(p ? p.id : null); }

  const cells = CELLS[zoom >= 0 ? 'l-1' : state.layout];
  board.className = 'l-' + (zoom >= 0 ? '1' : L[state.layout].id.replace(/^l-/,''));

  const taken = [];
  live = [];
  for (let i=0;i<n;i++){
    let e = null;
    for (let k=0;k<POOL.length;k++){
      if (taken.indexOf(k) < 0 && POOL[k].pid === want[i]){ e = POOL[k]; taken.push(k); break; }
    }
    if (!e){ e = makeSlot(want[i]); POOL.push(e); taken.push(POOL.length - 1); }
    e.el.classList.remove('hide');
    e.el.dataset.i = i;
    e.el.style.gridColumn = cells[i].c;
    e.el.style.gridRow = cells[i].r;
    live.push(e.inst);
  }
  // 使わなかった枠は片づける（窓を外したのだから、鳴っていたものは止まってよい）
  const keepEls = [];
  POOL = POOL.filter(function(e, k){
    if (taken.indexOf(k) >= 0){ keepEls.push(e.el); return true; }
    if (e.inst && e.inst.destroy) e.inst.destroy();
    if (e.el.parentNode) e.el.parentNode.removeChild(e.el);
    return false;
  });
  live.forEach(function(inst){ if (inst && inst.resize) inst.resize(); });
  watchSizes();
  drawBar();
  const keep = focusEl && focusEl.dataset && focusEl.dataset.act === 'slot' ? +focusEl.dataset.i : 0;
  setFocus(slotEl(Math.min(keep, n-1)));
}

// 枠の大きさが変わったら窓に知らせる（型を切り替えたとき・TV の縁を変えたとき）
let RO = null;
function watchSizes(){
  if (typeof ResizeObserver === 'undefined') return;
  if (RO) RO.disconnect();
  RO = new ResizeObserver(function(ents){
    ents.forEach(function(en){
      const i = +en.target.dataset.i;
      if (live[i] && live[i].resize) live[i].resize();
    });
  });
  Array.prototype.forEach.call(board.querySelectorAll('.slot:not(.hide)'),
    function(slot){ RO.observe(slot); });
}

// ---- 焦点 ------------------------------------------------------------
function focusables(){
  let root = document;
  if (mode === 'pick') root = pick;
  else if (mode === 'cfg') root = cfgEl;
  return Array.prototype.slice.call(root.querySelectorAll('[data-nav]'))
    .filter(function(el){ return el.offsetParent !== null; });
}
let lastSlot = 0;      // 帯の「窓を替える」「大きく」が効く先
function setFocus(el){
  if (!el) return;
  if (focusEl) focusEl.classList.remove('focus');
  focusEl = el;
  focusEl.classList.add('focus');
  if (el.dataset && el.dataset.act === 'slot') lastSlot = +el.dataset.i;
}
function nav(dir){
  const els = focusables();
  if (!els.length) return;
  if (!focusEl || els.indexOf(focusEl) < 0){ setFocus(els[0]); return; }
  const r0 = focusEl.getBoundingClientRect();
  const horiz = (dir === 'left' || dir === 'right');
  // その向きに、どれだけ離れているか（辺どうしの距離）と、横にどれだけずれているか
  let over = null, overS = Infinity;   // 帯が重なっているもの（こちらを優先）
  let off  = null, offS  = Infinity;   // 重なっていないもの
  els.forEach(function(el){
    if (el === focusEl) return;
    const r = el.getBoundingClientRect();
    let along, a0, a1, b0, b1;
    // 向きごとに「進む距離」と「帯の重なり」を取る
    if (horiz){
      along = (dir === 'right') ? (r.left - r0.right) : (r0.left - r.right);
      a0 = r0.top; a1 = r0.bottom; b0 = r.top; b1 = r.bottom;
    } else {
      along = (dir === 'down') ? (r.top - r0.bottom) : (r0.top - r.bottom);
      a0 = r0.left; a1 = r0.right; b0 = r.left; b1 = r.right;
    }
    if (along < -2) return;                       // その向きに無い（重なっている）
    if (along < 0) along = 0;
    const lap = Math.min(a1, b1) - Math.max(a0, b0);   // 帯の重なり
    const c0 = (a0 + a1) / 2, c1 = (b0 + b1) / 2;
    const across = Math.abs(c1 - c0);
    if (lap > 4){
      const sc = along + across * 0.08;
      if (sc < overS){ overS = sc; over = el; }
    } else {
      const sc = along + across * 4;
      if (sc < offS){ offS = sc; off = el; }
    }
  });
  const best = over || off;
  if (best) setFocus(best);
}

// ---- 中に入る／出る --------------------------------------------------
function enterInside(i){
  const inst = live[i];
  if (!inst){ openPick(i); return; }
  mode = 'inside';
  const el = slotEl(i);
  if (el) el.classList.add('inside');
  if (inst.enter) inst.enter();
  drawHelp();
}
function leaveInside(){
  for (let i=0;i<live.length;i++){
    const el = slotEl(i);
    if (el) el.classList.remove('inside');
    if (live[i] && live[i].leave) live[i].leave();
  }
  mode = 'board';
  drawHelp();
}
function insideIndex(){
  if (mode !== 'inside' || !focusEl || focusEl.dataset.act !== 'slot') return -1;
  return +focusEl.dataset.i;
}

// ---- 窓えらび --------------------------------------------------------
function openPick(i){
  pickFor = zoom >= 0 ? zoom : i;
  const cur = slotsOf()[pickFor];
  let h = '<h2>' + (pickFor+1) + 'つめの枠に入れる窓</h2><div class="grid">';
  PANELS.forEach(function(p){
    h += '<button class="pit' + (p.id === cur ? ' cur' : '') + '" data-nav data-act="put" data-id="' + p.id + '">' +
         '<span class="ic">' + p.icon + '</span><span class="nm">' + p.name + '</span>' +
         '<span class="hint">' + p.hint + '</span></button>';
  });
  h += '<button class="pit' + (cur ? '' : ' cur') + '" data-nav data-act="put" data-id="">' +
       '<span class="ic">␀</span><span class="nm">空き</span><span class="hint">何も出さない</span></button>';
  h += '</div><div class="note">同じ窓を2つの枠に入れることもできます</div>';
  pick.innerHTML = h;
  pick.classList.remove('hide');
  mode = 'pick';
  const items = pick.querySelectorAll('[data-nav]');
  let start = items[0];
  for (let k=0;k<items.length;k++){ if (items[k].classList.contains('cur')) start = items[k]; }
  setFocus(start);
  drawHelp();
}
function closePick(){
  pick.classList.add('hide');
  pick.innerHTML = '';
  mode = 'board';
  focusEl = null;
  setFocus(slotEl(Math.min(pickFor, slotCount()-1)));
  drawHelp();
}
function put(id){
  const ids = slotsOf();
  ids[pickFor] = id || null;
  save();
  closePick();
  drawBoard();
  setFocus(slotEl(Math.min(pickFor, slotCount()-1)));
}

// ---- 設定 ------------------------------------------------------------
const CFGROWS = [
  { k:'scale', t:'文字の大きさ', d:'遠くから見るなら大きく。TV は 1.3 くらいから',
    kind:'num', min:.8, max:2, step:.05, fmt:function(v){ return Math.round(v*100) + '%'; } },
  { k:'edge',  t:'TV の縁', d:'画面の端が切れる TV では内側に寄せる',
    kind:'num', min:0, max:80, step:4, fmt:function(v){ return v + 'px'; } },
  { k:'place', t:'天気の場所', d:'表示だけに使う名前', kind:'text' },
  { k:'lat',   t:'緯度', d:'天気を引く座標', kind:'text' },
  { k:'lon',   t:'経度', d:'天気を引く座標', kind:'text' },
  // 自宅のあて先は公開リポジトリに書かない。端末の中にだけ置く。
  { k:'mac',   t:'Mac のあて先', d:'例：mac.local（家の中で耳読を直に読む。空でも入口の控えは出る）',
    kind:'text' }
];
function openCfg(){
  let h = '<div class="in"><h2>設定</h2>';
  CFGROWS.forEach(function(r){
    const v = state.cfg[r.k];
    h += '<div class="row" data-nav data-act="cfgrow" data-k="' + r.k + '">' +
         '<span class="lb"><b>' + r.t + '</b><span>' + r.d + '</span></span>';
    if (r.kind === 'num') h += '<span class="val">' + r.fmt(v) + '</span>';
    else h += '<input type="text" value="' + v + '" data-k="' + r.k + '">';
    h += '</div>';
  });
  h += '<div class="row" data-nav data-act="reset"><span class="lb"><b>並びを初期に戻す</b>' +
       '<span>かたちと窓の割り当てだけ戻す</span></span></div>';
  h += '<div class="row" data-nav data-act="cfgclose"><span class="lb"><b>とじる</b></span></div>';
  h += '</div>';
  cfgEl.innerHTML = h;
  cfgEl.classList.remove('hide');
  mode = 'cfg';
  focusEl = null;
  setFocus(cfgEl.querySelector('[data-nav]'));
  drawHelp();
  cfgEl.querySelectorAll('input[data-k]').forEach(function(inp){
    inp.addEventListener('change', function(){
      const k = inp.dataset.k;
      if (k === 'lat' || k === 'lon'){
        const n = parseFloat(inp.value);
        if (isNaN(n)){ note('数字で入れてください'); inp.value = state.cfg[k]; return; }
        state.cfg[k] = n;
      } else state.cfg[k] = inp.value;
      save();
      refreshPanels();
    });
  });
}
function closeCfg(){
  cfgEl.classList.add('hide'); cfgEl.innerHTML = '';
  mode = 'board'; focusEl = null;
  setFocus(slotEl(0));
  drawHelp();
}
function cfgStep(k, dir){
  const r = CFGROWS.filter(function(x){ return x.k === k; })[0];
  if (!r || r.kind !== 'num') return;
  let v = state.cfg[k] + dir * r.step;
  v = Math.max(r.min, Math.min(r.max, Math.round(v / r.step) * r.step));
  state.cfg[k] = Math.round(v * 100) / 100;
  save(); applyCfg();
  const row = cfgEl.querySelector('[data-k="' + k + '"]');
  if (row && row.querySelector('.val')) row.querySelector('.val').textContent = r.fmt(state.cfg[k]);
}
function refreshPanels(){
  live.forEach(function(inst){ if (inst && inst.refresh) inst.refresh(); });
}

// ---- 大きく（一時的に1枚） -------------------------------------------
function toggleZoom(){
  if (zoom >= 0){ zoom = -1; drawBoard(); return; }
  zoom = Math.min(lastSlot, slotCount()-1);
  drawBoard();
}

// ---- キー ------------------------------------------------------------
const DIRS = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };
document.addEventListener('keydown', function(e){
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' && e.key !== 'Escape' && e.key !== 'Enter') return;

  // 中に入っているときは、まず窓に渡す
  if (mode === 'inside'){
    const i = insideIndex();
    const inst = i >= 0 ? live[i] : null;
    // 窓に先に渡す。流している YouTube の「戻る」は棚へ戻るためのもので、
    // 盤が先に取ると枠から出てしまう（窓が true を返したら盤は動かない）。
    if (inst && inst.onKey && inst.onKey(e)){ e.preventDefault(); return; }
    if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack'){
      e.preventDefault(); leaveInside(); return;
    }
    if (DIRS[e.key]){ e.preventDefault(); leaveInside(); nav(DIRS[e.key]); return; }
    // それ以外（1〜5・W・F）は盤の決まりへ落とす。**窓の中にいても
    // かたちは替えられること。**BGM を鳴らしたまま盤を組み替えたい。
  }

  if (DIRS[e.key]){
    e.preventDefault();
    if (mode === 'cfg' && focusEl && focusEl.dataset.act === 'cfgrow' &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')){
      cfgStep(focusEl.dataset.k, e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    nav(DIRS[e.key]);
    return;
  }

  if (e.key === 'Enter' || e.key === ' '){
    e.preventDefault();
    if (focusEl) act(focusEl);
    return;
  }
  if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack'){
    e.preventDefault();
    if (mode === 'pick') closePick();
    else if (mode === 'cfg') closeCfg();
    else if (zoom >= 0) toggleZoom();
    return;
  }
  if (mode !== 'board' && mode !== 'inside') return;

  const k = e.key.toLowerCase();
  if (k === 'w'){ e.preventDefault();
    if (focusEl && focusEl.dataset.act === 'slot') openPick(+focusEl.dataset.i);
    return; }
  if (k === 'f'){ e.preventDefault(); toggleZoom(); return; }
  const hit = LAYOUTS.filter(function(l){ return l.key === e.key; })[0];
  if (hit){ e.preventDefault(); setLayout(hit.id); }
});

function setLayout(id){
  if (mode === 'inside') leaveInside();   // 鳴っているものはそのまま
  zoom = -1;
  state.layout = id;
  save();
  drawBoard();
  note(L[id].label);
}

// ---- 指 --------------------------------------------------------------
document.addEventListener('click', function(e){
  const t = e.target;
  const sw = t.closest ? t.closest('.sw') : null;
  if (sw){
    const slot = sw.closest('.slot');
    if (slot){ setFocus(slot); openPick(+slot.dataset.i); }
    return;
  }
  const el = t.closest ? t.closest('[data-nav]') : null;
  if (!el) return;
  setFocus(el);
  act(el);
});

function act(el){
  const a = el.dataset.act;
  if (a === 'layout') setLayout(el.dataset.id);
  else if (a === 'cfg') openCfg();
  else if (a === 'swap') openPick(Math.min(lastSlot, slotCount()-1));
  else if (a === 'zoom'){
    if (zoom >= 0){ zoom = -1; drawBoard(); }
    else { zoom = Math.min(lastSlot, slotCount()-1); drawBoard(); }
  }
  else if (a === 'slot') enterInside(+el.dataset.i);
  else if (a === 'put') put(el.dataset.id);
  else if (a === 'cfgclose') closeCfg();
  else if (a === 'reset'){
    state.layout = DEF.layout;
    state.slots = JSON.parse(JSON.stringify(DEF.slots));
    save(); closeCfg(); drawBoard(); note('並びを戻しました');
  }
}

// ---- 時計（帯の右） --------------------------------------------------
function tickBar(){
  const el = document.getElementById('barnow');
  if (el){
    const d = new Date();
    const p = function(n){ return (n<10?'0':'') + n; };
    el.textContent = d.getMonth()+1 + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  live.forEach(function(inst){ if (inst && inst.tick) inst.tick(); });
}

// ---- 始める ----------------------------------------------------------
applyCfg();
drawBoard();
drawHelp();
tickBar();
setInterval(tickBar, 1000);
window.addEventListener('resize', function(){
  live.forEach(function(inst){ if (inst && inst.resize) inst.resize(); });
});
