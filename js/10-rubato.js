/* ═══════════════════════════════════════════════════
   v12.2+: RUBATO ENGINE (Temporal Distortion)
   Bouncing Ball Rubato — Physical Non-linear Timing
   ─────────────────────────────────────────────────
   UIや既存変数に一切依存しない純粋ロジックモジュール。
   ソース: rubato-engine.html (Temporal Distortion Engine v1.0)

   物理モデル:
     tₙ = t₀ × eⁿ
     ΔT(n) = PPQ × (BPM/60) × tₙ
     e = 反発係数 (0 < e < 1): 小さいほど急速に減衰

   使い方:
     // タイミング列を計算
     const result = RubatoEngine.compute({
       e: 0.80,          // 反発係数 (default 0.80)
       bpm: 120,          // テンポ (default 120)
       notes: 12,         // ノート数 (default 12)
       t0: 1.0,           // 初期間隔 × 拍 (default 1.0)
       dir: 'forward',    // 'forward'|'reverse'|'bounce'
       ppq: 480           // PPQ (default 480)
     });
     result.intervals_ms   // → [500, 400, 320, ...] ms
     result.intervals_ppq  // → [480, 384, 307, ...] ticks
     result.cumulative_ms  // → [0, 500, 900, ...] 累積位置
     result.cumulative_ppq // → [0, 480, 864, ...] 累積tick
     result.totalMs        // → 総再生時間 ms
     result.totalPpq       // → 総tick数
     result.ratio          // → 先頭/末尾の圧縮比

     // MIDI delta tick 配列として直接取得
     const deltas = RubatoEngine.deltaTicks({e:0.85, notes:8, ppq:480});
     // → [480, 408, 347, 295, 250, 213, 181, 154]

     // プリセット
     const p = RubatoEngine.preset('gentle_accel');
     const result2 = RubatoEngine.compute(p);

     // アフォーダンス分析
     RubatoEngine.analyze(result);
     // → {avgMs, minMs, maxMs, stdDev, isAccel, tempoRange}
═══════════════════════════════════════════════════ */
const RubatoEngine=(()=>{
  'use strict';

  /** プリセットパラメータ */
  const PRESETS={
    gentle_accel:   {e:0.92, notes:12, t0:1.0,  dir:'forward',  name:'Gentle Accelerando'},
    aggressive_accel:{e:0.70, notes:16, t0:1.5,  dir:'forward',  name:'Aggressive Accelerando'},
    gentle_rit:     {e:0.92, notes:12, t0:0.3,  dir:'reverse',  name:'Gentle Ritardando'},
    aggressive_rit: {e:0.70, notes:16, t0:0.25, dir:'reverse',  name:'Aggressive Ritardando'},
    bounce_natural: {e:0.80, notes:16, t0:1.0,  dir:'bounce',   name:'Natural Bounce'},
    bounce_tight:   {e:0.65, notes:24, t0:0.75, dir:'bounce',   name:'Tight Bounce'},
    subtle_push:    {e:0.96, notes:8,  t0:1.0,  dir:'forward',  name:'Subtle Push'},
    dramatic_brake: {e:0.60, notes:10, t0:0.2,  dir:'reverse',  name:'Dramatic Brake'},
    pendulum:       {e:0.88, notes:20, t0:1.2,  dir:'bounce',   name:'Pendulum Feel'},
    micro_rubato:   {e:0.94, notes:6,  t0:0.5,  dir:'forward',  name:'Micro Rubato'}
  };

  /**
   * ルバートタイミング列を計算
   *
   * @param {Object} [opts]
   * @param {number} [opts.e=0.80]      反発係数 (0.01-0.99)
   * @param {number} [opts.bpm=120]     テンポ
   * @param {number} [opts.notes=12]    ノート数
   * @param {number} [opts.t0=1.0]      初期間隔(拍の倍率)
   * @param {string} [opts.dir='forward']  'forward'|'reverse'|'bounce'
   * @param {number} [opts.ppq=480]     PPQ解像度
   * @returns {Object}
   */
  function compute(opts){
    const o=opts||{};
    const e=Math.max(0.01,Math.min(0.99,o.e!=null?o.e:0.80));
    const bpm=o.bpm||120;
    const notes=o.notes||12;
    const t0=o.t0!=null?o.t0:1.0;
    const dir=o.dir||'forward';
    const ppq=o.ppq||480;

    const beatMs=60000/bpm;

    let intervals_ms=[];
    let intervals_ppq=[];

    /* tₙ = t₀ × eⁿ */
    for(let n=0;n<notes;n++){
      const tn=t0*Math.pow(e,n);
      intervals_ms.push(tn*beatMs);
      intervals_ppq.push(Math.round(tn*ppq));
    }

    /* direction 変換 */
    if(dir==='reverse'){
      intervals_ms.reverse();
      intervals_ppq.reverse();
    }else if(dir==='bounce'){
      const msHalf=[...intervals_ms];
      const ppqHalf=[...intervals_ppq];
      intervals_ms=[...msHalf,...[...msHalf].reverse()];
      intervals_ppq=[...ppqHalf,...[...ppqHalf].reverse()];
    }

    /* 累積配列 */
    const cumulative_ms=[];
    const cumulative_ppq=[];
    let cumMs=0,cumPpq=0;
    for(let i=0;i<intervals_ms.length;i++){
      cumulative_ms.push(cumMs);
      cumulative_ppq.push(cumPpq);
      cumMs+=intervals_ms[i];
      cumPpq+=intervals_ppq[i];
    }

    const totalMs=cumMs;
    const totalPpq=cumPpq;
    const ratio=intervals_ms.length>1
      ? intervals_ms[0]/intervals_ms[intervals_ms.length-1]
      : 1;

    return{
      intervals_ms,
      intervals_ppq,
      cumulative_ms,
      cumulative_ppq,
      totalMs,
      totalPpq,
      ratio,
      params:{e,bpm,notes:intervals_ms.length,t0,dir,ppq}
    };
  }

  /**
   * MIDI delta tick 配列のみを簡易取得
   * @param {Object} [opts]  compute() と同じオプション
   * @returns {number[]}  PPQ delta tick の配列
   */
  function deltaTicks(opts){
    return compute(opts).intervals_ppq;
  }

  /**
   * プリセットパラメータを取得
   * @param {string} name  プリセット名
   * @param {number} [bpm=120]  テンポ上書き
   * @param {number} [ppq=480]  PPQ上書き
   * @returns {Object}  compute() に渡せるパラメータ
   */
  function preset(name,bpm,ppq){
    const p=PRESETS[name]||PRESETS.gentle_accel;
    return Object.assign({},p,{bpm:bpm||120,ppq:ppq||480});
  }

  /**
   * 計算結果を分析
   * @param {Object} result  compute() の戻り値
   * @returns {Object}
   */
  function analyze(result){
    const ms=result.intervals_ms;
    const n=ms.length;
    if(!n)return{avgMs:0,minMs:0,maxMs:0,stdDev:0,isAccel:false,tempoRange:[0,0]};

    const avg=ms.reduce((a,b)=>a+b,0)/n;
    const min=Math.min(...ms);
    const max=Math.max(...ms);
    const variance=ms.reduce((s,v)=>s+(v-avg)*(v-avg),0)/n;
    const stdDev=Math.sqrt(variance);
    const isAccel=ms[0]>ms[n-1];

    /* 各intervalを瞬時BPMに変換 */
    const bpms=ms.map(dt=>dt>0?60000/dt:0);
    const tempoRange=[Math.min(...bpms),Math.max(...bpms)];

    return{avgMs:avg,minMs:min,maxMs:max,stdDev,isAccel,tempoRange};
  }

  return{compute,deltaTicks,preset,analyze,PRESETS};
})();

/* ═══ RUBATO PARAMS — グローバル状態 ═══ */
const RUBATO_PARAMS = {
  e:      0.80,       /* 反発係数 0.01-0.99 */
  t0:     1.0,        /* 初期間隔(拍の倍率) */
  notes:  16,         /* ノート数 */
  dir:    'bounce',   /* 'forward'|'reverse'|'bounce' */
};

