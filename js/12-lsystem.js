/* ═══════════════════════════════════════════════════
   v19.0: L-SYSTEM ENGINE  (Lindenmayer System)
   フラクタル文法 — フレーズの自己増殖と有機的成長
   ─────────────────────────────────────────────────
   理論: Aristid Lindenmayer (1968)
     "Mathematical models for cellular interactions
      in development" Journal of Theoretical Biology

   文字列書換えアルゴリズム:
     Axiom "A", Rules {A→AB, B→A}:
     Gen0: A
     Gen1: AB
     Gen2: ABA
     Gen3: ABAAB
     Gen4: ABAABABA  (フィボナッチ長)

   シンボル → 音楽マッピング:
     A  : +step 上昇 (short)    B  : -step 下降 (short)
     C  : +4st 長3度上昇        D  : 休符 (rest)
     E  : 音保持 ×2長さ         F  : +7st 完全5度上昇
     G  : -7st 完全5度下降       H  : -4st 長3度下降
     [  : スタックpush (分岐)    ]  : スタックpop (回帰)
     +  : vel +10               -  : vel -10

   Growth Modes:
     linear  : 均等音価で全展開
     fractal : 後半ほど音価を短縮 (密度が倍加)
     bloom   : 後半ほど音価が伸長 (クライマックス型)
═══════════════════════════════════════════════════ */
const LSEngine = (() => {
  'use strict';

  /* ── プリセット ─────────────────────────────── */
  const PRESETS = [
    { name:'Fibonacci', axiom:'A',   rules:{A:'AB',B:'A'},          gen:5, desc:'A→AB B→A — フィボナッチ数列' },
    { name:'Dragon',    axiom:'A',   rules:{A:'AB',B:'CA',C:'CB'},  gen:4, desc:'A→AB B→CA — ドラゴン曲線' },
    { name:'Cantor',    axiom:'A',   rules:{A:'ADA',D:'DDD'},        gen:4, desc:'A→ADA D→DDD — カントール集合' },
    { name:'Bloom',     axiom:'A',   rules:{A:'A[B]A',B:'BB'},       gen:4, desc:'A→A[B]A — 分岐成長' },
    { name:'Pentatonic',axiom:'A',   rules:{A:'ACABD',B:'BA',D:'DA'},gen:3, desc:'A→ACABD — 五音旋律的' },
    { name:'Echo',      axiom:'A',   rules:{A:'ABBA',B:'BCB',C:'C'},gen:3, desc:'A→ABBA — エコー反響構造' },
    { name:'Vine',      axiom:'A',   rules:{A:'AB[C]A',B:'B',C:'CA'},gen:4, desc:'A→AB[C]A — つる状分岐' },
    { name:'Koch',      axiom:'A',   rules:{A:'ABAC',C:'CB'},         gen:3, desc:'A→ABAC — コッホ曲線型' },
  ];

  /* ── 内部状態 ────────────────────────────────── */
  const STATE = {
    enabled: false,
    axiom: 'A',
    rules: { A:'AB', B:'A' },
    generations: 4,
    octave: 4,
    stepSt: 2,         // A/B の上下幅（半音）
    gateRatio: 0.80,
    velBase: 72,
    growthMode: 'linear',   // 'linear'|'fractal'|'bloom'
    presetName: 'Fibonacci',
    lstring: '',            // 最後に展開された L 文字列
  };

  /* ─────────────────────────────────────────────
     expand: L 文字列を generations 世代展開する
  ───────────────────────────────────────────── */
  function expand(axiom, rules, gen) {
    let s = (axiom || 'A').toUpperCase();
    for (let g = 0; g < Math.min(gen, 8); g++) {
      let next = '';
      for (const ch of s) {
        next += (rules[ch] !== undefined) ? rules[ch] : ch;
        if (next.length > 8192) { next = next.slice(0, 8192); break; }
      }
      s = next;
    }
    return s;
  }

  /* ─────────────────────────────────────────────
     toNoteEvents: L 文字列 → 音符イベント列
     rootMidi: MIDI ルートノート番号
     scaleIv:  スケールインターバル配列
     params:   { stepSt, gateRatio, velBase, growthMode, ppq, bars }
     returns:  [{ pitch, dur, velDelta, rest }]
  ───────────────────────────────────────────── */
  function toNoteEvents(lstring, rootMidi, scaleIv, params) {
    const { stepSt=2, gateRatio=0.80, velBase=72,
            growthMode='linear', ppq=480, bars=16 } = params;

    const totalTicks = ppq * 4 * bars;
    const symbols = [...lstring].filter(ch => 'ABCDEFGHabcdefgh[]+-'.includes(ch));
    if (!symbols.length) return [];

    // 有効音符シンボルのみ抽出（位置計算に使う）
    const noteSyms = symbols.filter(ch => 'ABCDEFGHabcdefgh'.includes(ch));
    const noteCount = noteSyms.length || 1;

    /* base duration: 全音符を bars 小節に収める */
    const baseDur = Math.max(ppq / 4, Math.round(totalTicks / noteCount));

    const events = [];
    const stack  = [];   // [ { pitch, velDelta } ]
    let pitch    = rootMidi + (STATE.octave - 3) * 12;
    pitch = Math.max(24, Math.min(108, pitch));
    let velDelta = 0;
    let noteIdx  = 0;

    for (const ch of symbols) {
      const frac  = noteCount > 1 ? noteIdx / (noteCount - 1) : 0; // 0-1 位置
      /* growthMode による音価変調 */
      let dur = baseDur;
      if (growthMode === 'fractal') {
        // 後半ほど音価が半分に縮む (フラクタル密度増加)
        dur = Math.round(baseDur * Math.max(0.25, 1 - frac * 0.75));
      } else if (growthMode === 'bloom') {
        // 後半ほど音価が伸びる (クライマックス型)
        dur = Math.round(baseDur * (0.4 + frac * 1.2));
      }
      dur = Math.max(ppq / 8, dur);

      switch (ch.toUpperCase()) {
        case 'A':
          pitch = clamp(pitch + stepSt);
          events.push({ pitch, dur, velDelta, rest:false });
          noteIdx++;
          break;
        case 'B':
          pitch = clamp(pitch - stepSt);
          events.push({ pitch, dur, velDelta, rest:false });
          noteIdx++;
          break;
        case 'C':
          pitch = clamp(pitch + 4);   // 長3度上
          events.push({ pitch, dur, velDelta, rest:false });
          noteIdx++;
          break;
        case 'H':
          pitch = clamp(pitch - 4);   // 長3度下
          events.push({ pitch, dur, velDelta, rest:false });
          noteIdx++;
          break;
        case 'D':
          events.push({ pitch, dur, velDelta, rest:true });
          noteIdx++;
          break;
        case 'E':
          // 保持（sustained: 音価2倍）
          events.push({ pitch, dur: dur * 2, velDelta, rest:false });
          noteIdx++;
          break;
        case 'F':
          pitch = clamp(pitch + 7);   // 完全5度上
          events.push({ pitch, dur, velDelta, rest:false });
          noteIdx++;
          break;
        case 'G':
          pitch = clamp(pitch - 7);   // 完全5度下
          events.push({ pitch, dur, velDelta, rest:false });
          noteIdx++;
          break;
        case '[':
          stack.push({ pitch, velDelta });
          break;
        case ']':
          if (stack.length > 0) {
            const s = stack.pop();
            pitch    = s.pitch;
            velDelta = s.velDelta;
          }
          break;
        case '+':
          velDelta = Math.min(velDelta + 10, 40);
          break;
        case '-':
          velDelta = Math.max(velDelta - 10, -40);
          break;
      }
    }
    return events;
  }

  function clamp(n) { return Math.max(24, Math.min(108, n)); }

  /* ─────────────────────────────────────────────
     makeLSTrack: MIDI トラックバイト列を生成
     ch10 (0x09) に出力 — 他レイヤーと独立
  ───────────────────────────────────────────── */
  function makeLSTrack(rootMidi, scaleIv, p, prg) {
    const { ppq, bars, tensionCurve, humanize=35, lorenz=null } = p;
    if (!STATE.lstring) return [];

    const events = toNoteEvents(STATE.lstring, rootMidi, scaleIv, {
      stepSt:    STATE.stepSt,
      gateRatio: STATE.gateRatio,
      velBase:   STATE.velBase,
      growthMode:STATE.growthMode,
      ppq, bars,
    });
    if (!events.length) return [];

    const total = ppq * 4 * bars;
    const hum   = humanize / 100;
    const CH    = 0x0A;  // MIDI ch 11 (1-indexed) / 0-indexed: 10
    const ae    = [];
    let pos     = 0;

    for (const ev of events) {
      if (pos >= total) break;
      const remain = total - pos;
      const dur    = Math.min(ev.dur, remain);
      if (dur <= 0) break;

      const t = typeof getTension === 'function' ? getTension(pos, ppq, tensionCurve) : 0.5;
      if (lorenz) lorenz.step();
      const ln    = lorenz ? lorenz.normalized() : { x:64 };
      const lVS   = Math.round((ln.x - 64) / 64 * 12);
      const jitter= Math.round((rng() - 0.5) * hum * 20);

      if (!ev.rest) {
        const vel = Math.max(1, Math.min(127,
          Math.round((STATE.velBase + ev.velDelta + lVS + jitter) * (0.7 + t * 0.6))
        ));
        const gt = Math.max(1, Math.min(dur - 1, Math.round(dur * STATE.gateRatio)));
        ae.push({ pos,      v:[0x90|CH, ev.pitch, vel] });
        ae.push({ pos:pos+gt, v:[0x80|CH, ev.pitch, 0] });
      }
      pos += dur;
    }

    return typeof safeAbsToTrack === 'function'
      ? safeAbsToTrack(ae, [
          typeof tname==='function' ? tname('L-System') : [],
          typeof pc==='function'    ? pc(CH, prg.lead||73) : [],
        ])
      : [];
  }

  /* ─────────────────────────────────────────────
     recompute: axiom + rules → lstring を展開してUIを更新
  ───────────────────────────────────────────── */
  function recompute() {
    const lstr = expand(STATE.axiom, STATE.rules, STATE.generations);
    STATE.lstring = lstr;

    /* L-string プレビュー */
    const dispEl = document.getElementById('lsLstring');
    if (dispEl) {
      dispEl.textContent = lstr.length > 220
        ? lstr.slice(0, 220) + '…(' + lstr.length + ' sym)'
        : (lstr || '—');
    }

    /* シンボル数表示 */
    const lenEl = document.getElementById('lsSeqLen');
    if (lenEl) lenEl.textContent = lstr.length + ' symbols';

    /* 統計情報 */
    const infoEl = document.getElementById('lsInfo');
    if (infoEl) {
      const noteCount  = [...lstr].filter(ch => /[ABCDEFGH]/i.test(ch)).length;
      const restCount  = [...lstr].filter(ch => ch.toUpperCase() === 'D').length;
      const branchCount= [...lstr].filter(ch => ch === '[').length;
      const uniqueSym  = [...new Set([...lstr].filter(ch => /[A-H]/i.test(ch)))].sort();
      infoEl.innerHTML =
        `シンボル: <b style="color:#aaa">${lstr.length}</b> | ` +
        `音符: <b style="color:#aaa">${noteCount}</b> | ` +
        `休符: <b style="color:#aaa">${restCount}</b> | ` +
        `ブランチ: <b style="color:#aaa">${branchCount}</b><br>` +
        `出現シンボル: <b style="color:#aaa">${uniqueSym.join(' ') || '—'}</b> | ` +
        `Mode: <b style="color:#aaa">${STATE.growthMode}</b>`;
    }

    drawViz(lstr);
  }

  /* ─────────────────────────────────────────────
     drawViz: フレーズツリーをキャンバスに描画
     x軸 = 時間(シンボル位置), y軸 = ピッチ
     ブランチ [ ] はツリー分岐として描画
  ───────────────────────────────────────────── */
  function drawViz(lstr) {
    const cv = document.getElementById('lsViz');
    if (!cv) return;
    const W = cv.offsetWidth || 400, H = 150;
    const dpr = window.devicePixelRatio || 1;
    cv.width  = W * dpr;
    cv.height = H * dpr;
    cv.style.width  = W + 'px';
    cv.style.height = H + 'px';
    const cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);

    if (!lstr) return;

    /* パス構築 ─────────────────────────────── */
    const symbols = [...lstr].filter(ch => 'ABCDEFGHabcdefgh[]'.includes(ch));
    const noteSyms = symbols.filter(ch => /[ABCDEFGHabcdefgh]/.test(ch));
    const total = noteSyms.length;
    if (total < 2) return;

    const step = STATE.stepSt;
    const midY = H * 0.5;
    const yScale = 2.0;
    const xScale = (W - 20) / Math.max(1, total - 1);

    const stack = [];
    const paths = [[]]; // 描画パス配列 [[ {x,y,rest}, ... ], ...]
    let curPath = paths[0];
    let pitch   = 60;
    let xIdx    = 0;

    for (const ch of symbols) {
      const x = 10 + xIdx * xScale;
      let moved = false;

      switch (ch.toUpperCase()) {
        case 'A': pitch = Math.max(24, Math.min(108, pitch + step)); moved=true; break;
        case 'B': pitch = Math.max(24, Math.min(108, pitch - step)); moved=true; break;
        case 'C': pitch = Math.max(24, Math.min(108, pitch + 4));   moved=true; break;
        case 'H': pitch = Math.max(24, Math.min(108, pitch - 4));   moved=true; break;
        case 'E': moved=true; break;
        case 'F': pitch = Math.max(24, Math.min(108, pitch + 7));   moved=true; break;
        case 'G': pitch = Math.max(24, Math.min(108, pitch - 7));   moved=true; break;
        case 'D': moved=true; break;  // rest
        case '[':
          stack.push({ pitch, pathIdx: paths.length - 1, curPath: [...curPath] });
          break;
        case ']':
          if (stack.length > 0) {
            const s = stack.pop();
            pitch = s.pitch;
            // 新パス（ブランチ復帰）を追加
            paths.push([...s.curPath]);
            curPath = paths[paths.length - 1];
          }
          break;
      }
      if (moved) {
        const y = midY - (pitch - 60) * yScale;
        curPath.push({ x, y, rest: ch.toUpperCase() === 'D' });
        xIdx++;
      }
    }

    /* 背景グリッド */
    cx.strokeStyle = 'rgba(192,132,252,0.06)';
    cx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (H / 4) * i;
      cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke();
    }
    /* センターライン */
    cx.strokeStyle = 'rgba(192,132,252,0.18)';
    cx.setLineDash([4, 6]);
    cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(0, midY); cx.lineTo(W, midY); cx.stroke();
    cx.setLineDash([]);

    /* パスを描画（メインパスを最後に重ねて最明るく） */
    const sorted = [...paths.entries()].sort(([ia], [ib]) => ia === 0 ? 1 : -1);
    for (const [pi, path] of sorted) {
      if (path.length < 2) continue;
      const isMain = pi === 0;
      const hue    = (270 + pi * 35) % 360;
      const alpha  = isMain ? 0.90 : 0.38;
      cx.strokeStyle = `hsla(${hue},75%,72%,${alpha})`;
      cx.lineWidth   = isMain ? 1.8 : 1.0;
      cx.shadowColor = `hsla(${hue},75%,72%,${isMain ? 0.35 : 0.1})`;
      cx.shadowBlur  = isMain ? 8 : 2;
      cx.beginPath();
      path.forEach((pt, i) => i === 0 ? cx.moveTo(pt.x, pt.y) : cx.lineTo(pt.x, pt.y));
      cx.stroke();
      cx.shadowBlur = 0;
    }

    /* 音符ドット（間引き描画） */
    const main = paths[0];
    const dStep = Math.max(1, Math.floor(main.length / 100));
    main.forEach((pt, i) => {
      if (i % dStep !== 0) return;
      const t = i / main.length;
      cx.fillStyle = pt.rest
        ? 'rgba(192,132,252,0.15)'
        : `hsla(270,70%,75%,${0.4 + t * 0.6})`;
      const r = pt.rest ? 1.5 : (t < 0.5 ? 2.5 : 2.0);
      cx.beginPath();
      cx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      cx.fill();
    });
  }

  /* ─────────────────────────────────────────────
     UI ビルダー
  ───────────────────────────────────────────── */
  function buildRulesUI() {
    const el = document.getElementById('lsRules');
    if (!el) return;
    el.innerHTML = '';
    Object.entries(STATE.rules).forEach(([sym, rep]) => {
      const row = document.createElement('div');
      row.className = 'ls-rule-row';
      row.innerHTML = `
        <input class="ls-sym-inp" type="text" value="${sym}" maxlength="1" data-sym="${sym}">
        <span class="ls-arrow">→</span>
        <input class="ls-rep-inp" type="text" value="${rep}" maxlength="32" data-rep="${sym}" placeholder="置換文字列">
        <button class="ls-del-btn" data-del="${sym}">✕</button>`;
      el.appendChild(row);
    });
    // symbol edit
    el.querySelectorAll('.ls-sym-inp').forEach(inp => {
      inp.addEventListener('change', () => {
        const oldSym = inp.dataset.sym;
        const newSym = inp.value.toUpperCase().replace(/[^A-H\[\]\+\-]/g,'').slice(0,1);
        if (!newSym || newSym === oldSym) { inp.value = oldSym; return; }
        if (STATE.rules[newSym] !== undefined) { inp.value = oldSym; return; } // 重複不可
        STATE.rules[newSym] = STATE.rules[oldSym];
        delete STATE.rules[oldSym];
        buildRulesUI();
        recompute();
      });
    });
    // replacement edit
    el.querySelectorAll('.ls-rep-inp').forEach(inp => {
      inp.addEventListener('input', () => {
        const sym = inp.dataset.rep;
        STATE.rules[sym] = inp.value.toUpperCase().replace(/[^A-H\[\]\+\-]/g,'');
        recompute();
      });
    });
    // delete
    el.querySelectorAll('.ls-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        delete STATE.rules[btn.dataset.del];
        buildRulesUI();
        recompute();
      });
    });
  }

  const SYM_DEFS = [
    { sym:'A', desc:'上昇 +step\n(short note)' },
    { sym:'B', desc:'下降 −step\n(short note)' },
    { sym:'C', desc:'長3度 上昇\n+4 semitones' },
    { sym:'H', desc:'長3度 下降\n−4 semitones' },
    { sym:'D', desc:'休符\n(silence)' },
    { sym:'E', desc:'音保持\n(×2 duration)' },
    { sym:'F', desc:'5度 上昇\n+7 semitones' },
    { sym:'G', desc:'5度 下降\n−7 semitones' },
    { sym:'[', desc:'ブランチ開始\n(push pitch)' },
    { sym:']', desc:'ブランチ終了\n(pop/return)' },
    { sym:'+', desc:'ベロシティ +10\n(vol swell)' },
    { sym:'-', desc:'ベロシティ −10\n(vol fade)' },
  ];

  function buildSymLegend() {
    const el = document.getElementById('lsSymLegend');
    if (!el) return;
    el.innerHTML = SYM_DEFS.map(d =>
      `<div class="ls-sym-card">
        <div class="sc-sym">${d.sym}</div>
        <div class="sc-desc">${d.desc.replace('\n','<br>')}</div>
      </div>`
    ).join('');
  }

  function buildPresetsUI() {
    const el = document.getElementById('lsPresets');
    if (!el) return;
    el.innerHTML = '';
    PRESETS.forEach(pr => {
      const btn = document.createElement('button');
      btn.className = 'ls-pre-btn' + (pr.name === STATE.presetName ? ' on' : '');
      btn.textContent = pr.name;
      btn.title = pr.desc;
      btn.addEventListener('click', () => {
        STATE.axiom      = pr.axiom;
        STATE.rules      = { ...pr.rules };
        STATE.generations= pr.gen;
        STATE.presetName = pr.name;
        const ax = document.getElementById('lsAxiom');
        const gn = document.getElementById('lsGen');
        const gnV= document.getElementById('lsGenV');
        if (ax)  ax.value  = pr.axiom;
        if (gn)  gn.value  = pr.gen;
        if (gnV) gnV.textContent = pr.gen + ' gen';
        buildRulesUI();
        buildPresetsUI();
        recompute();
      });
      el.appendChild(btn);
    });
  }

  function buildUI() {
    buildPresetsUI();
    buildRulesUI();
    buildSymLegend();
    recompute();
  }

  return { PRESETS, STATE, expand, toNoteEvents, makeLSTrack, buildUI, buildRulesUI, buildPresetsUI, recompute, drawViz };
})();
