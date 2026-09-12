// 時計と天気。天気は Open-Meteo（鍵不要・CORS 可）。
const WMO = {
  0:['☀️','晴れ'], 1:['🌤','おおむね晴れ'], 2:['⛅️','ところにより曇り'], 3:['☁️','曇り'],
  45:['🌫','霧'], 48:['🌫','霧（着氷）'],
  51:['🌦','霧雨'], 53:['🌦','霧雨'], 55:['🌦','霧雨（強）'],
  61:['🌧','雨'], 63:['🌧','雨'], 65:['🌧','強い雨'],
  66:['🌧','着氷性の雨'], 67:['🌧','着氷性の雨'],
  71:['🌨','雪'], 73:['🌨','雪'], 75:['🌨','強い雪'], 77:['🌨','霧雪'],
  80:['🌦','にわか雨'], 81:['🌦','にわか雨'], 82:['⛈','激しいにわか雨'],
  85:['🌨','にわか雪'], 86:['🌨','にわか雪'],
  95:['⛈','雷雨'], 96:['⛈','雷雨（雹）'], 99:['⛈','雷雨（雹）']
};
const DOW = ['日','月','火','水','木','金','土'];

export default {
  id:'clock', name:'時計と天気', icon:'🕐',
  hint:'大きな時計と今日の気温・雨',
  create(ctx){
    const el = document.createElement('div');
    el.className = 'p-clock';
    el.innerHTML =
      '<div class="t"></div>' +
      '<div class="d"></div>' +
      '<div class="w"><span class="wi">…</span><span class="wt">天気をききに行っています</span></div>';
    if (!document.getElementById('p-clock-css')){
      const st = document.createElement('style');
      st.id = 'p-clock-css';
      st.textContent =
        '.p-clock{height:100%;display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;gap:.1em;font-variant-numeric:tabular-nums}' +
        '.p-clock .t{font-size:var(--cs,4em);font-weight:200;letter-spacing:-.02em;line-height:1}' +
        '.p-clock .t small{font-size:.42em;color:var(--dim);margin-left:.2em;font-weight:400}' +
        '.p-clock .d{color:var(--dim);font-size:calc(var(--cs,4em) * .17)}' +
        '.p-clock .w{display:flex;align-items:center;gap:.4em;margin-top:.5em;' +
        'font-size:calc(var(--cs,4em) * .17);color:var(--fg)}' +
        '.p-clock .w .wi{font-size:1.5em}' +
        '.p-clock .w .sub{color:var(--dim2);font-size:.85em}';
      document.head.appendChild(st);
    }

    let wx = null, wxAt = 0, wxErr = '';

    function paint(){
      const d = new Date();
      const p = function(n){ return (n<10?'0':'') + n; };
      el.querySelector('.t').innerHTML = p(d.getHours()) + ':' + p(d.getMinutes()) +
        '<small>' + p(d.getSeconds()) + '</small>';
      el.querySelector('.d').textContent =
        d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日（' + DOW[d.getDay()] + '）';
      const wiEl = el.querySelector('.wi'), wtEl = el.querySelector('.wt');
      if (wx){
        const c = WMO[wx.code] || ['·', '—'];
        wiEl.textContent = c[0];
        wtEl.innerHTML = Math.round(wx.temp) + '℃ ' + c[1] +
          '<span class="sub">　' + ctx.cfg.place + '　' +
          Math.round(wx.min) + '〜' + Math.round(wx.max) + '℃　雨 ' + wx.pop + '%</span>';
      } else if (wxErr){
        wiEl.textContent = '·';
        wtEl.innerHTML = '<span class="sub">天気が取れません（' + wxErr + '）</span>';
      }
    }

    function fetchWx(){
      wxAt = Date.now();
      const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + ctx.cfg.lat +
        '&longitude=' + ctx.cfg.lon +
        '&current=temperature_2m,weather_code' +
        '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
        '&timezone=Asia%2FTokyo&forecast_days=1';
      fetch(u).then(function(r){
        if (!r.ok) throw new Error(r.status);
        return r.json();
      }).then(function(j){
        wx = {
          temp: j.current.temperature_2m,
          code: j.current.weather_code,
          max: j.daily.temperature_2m_max[0],
          min: j.daily.temperature_2m_min[0],
          pop: j.daily.precipitation_probability_max[0]
        };
        wxErr = '';
        paint();
      }).catch(function(e){
        wxErr = String(e.message || e);
        paint();
      });
    }

    fetchWx();
    paint();

    return {
      el: el,
      tick(){
        paint();
        if (Date.now() - wxAt > 10*60*1000) fetchWx();   // 10分ごと
      },
      refresh(){ wx = null; fetchWx(); },
      resize(){
        const w = el.clientWidth, h = el.clientHeight;
        if (!w || !h) return;
        // 枠に収まる字の大きさ。横は 4.2 文字ぶん、縦は 2.6 行ぶんで見当をつける
        const s = Math.max(28, Math.min(w / 4.6, h / 2.9));
        el.style.setProperty('--cs', s + 'px');
      }
    };
  }
};
