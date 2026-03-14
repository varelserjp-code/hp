/* ═══════════════════════════════════════════════════
   v12.2+: LORENZ ATTRACTOR ENGINE
   Strange Attractor — RK4 Integration — Spatial Controller
   ─────────────────────────────────────────────────
   UIや既存変数に一切依存しない純粋ロジックモジュール。
   ソース: lorenz-midi-module.html v1.1

   使い方:
     const L = LorenzAttractor.create();        // デフォルト σ=10,ρ=28,β=8/3
     L.step();                                   // RK4 で 1 ステップ進める
     L.state                                     // → {x, y, z}
     L.normalized()                              // → {x:0-127, y:0-127, z:0-127}
     L.reset()                                   // 初期状態に戻す

     // パラメータ変更
     const L2 = LorenzAttractor.create({sigma:10, rho:28, beta:2.667, dt:0.01});

     // N ステップ一括実行して軌道を取得
     const trajectory = LorenzAttractor.generate(500, {sigma:10, rho:28, beta:2.667, dt:0.01});
     // → [{x,y,z}, {x,y,z}, ...] 500 点

     // 単発: 現在座標から CC 値を得る (外部で step を回す場合)
     LorenzAttractor.norm127(val, min, max)  // → 0-127
═══════════════════════════════════════════════════ */
const LorenzAttractor=(()=>{
  'use strict';

  /**
   * ローレンツ方程式の微分
   * dx/dt = σ(y − x)
   * dy/dt = x(ρ − z) − y
   * dz/dt = xy − βz
   */
  function derivatives(s,p){
    return{
      dx: p.sigma*(s.y-s.x),
      dy: s.x*(p.rho-s.z)-s.y,
      dz: s.x*s.y-p.beta*s.z
    };
  }

  /**
   * 4次 Runge-Kutta 1ステップ
   * @param {{x,y,z}} state  現在の状態 (破壊的に更新)
   * @param {{sigma,rho,beta}} params
   * @param {number} dt  積分刻み幅
   */
  function stepRK4(state,params,dt){
    const k1=derivatives(state,params);
    const s2={x:state.x+k1.dx*dt/2, y:state.y+k1.dy*dt/2, z:state.z+k1.dz*dt/2};
    const k2=derivatives(s2,params);
    const s3={x:state.x+k2.dx*dt/2, y:state.y+k2.dy*dt/2, z:state.z+k2.dz*dt/2};
    const k3=derivatives(s3,params);
    const s4={x:state.x+k3.dx*dt, y:state.y+k3.dy*dt, z:state.z+k3.dz*dt};
    const k4=derivatives(s4,params);
    state.x+=(k1.dx+2*k2.dx+2*k3.dx+k4.dx)*dt/6;
    state.y+=(k1.dy+2*k2.dy+2*k3.dy+k4.dy)*dt/6;
    state.z+=(k1.dz+2*k2.dz+2*k3.dz+k4.dz)*dt/6;
  }

  /** 値を 0-127 にスケーリング（MIDI CC レンジ） */
  function norm127(val,min,max){
    if(max===min)return 64;
    return Math.max(0,Math.min(127,Math.round((val-min)/(max-min)*127)));
  }

  /**
   * ローレンツ・アトラクタのインスタンスを生成
   * @param {Object} [opts]
   * @param {number} [opts.sigma=10]
   * @param {number} [opts.rho=28]
   * @param {number} [opts.beta=2.6667]  (8/3)
   * @param {number} [opts.dt=0.01]
   * @param {number} [opts.x0=0.1]  初期 x
   * @param {number} [opts.y0=0]    初期 y
   * @param {number} [opts.z0=0]    初期 z
   * @returns {Object} instance
   */
  function create(opts){
    const o=opts||{};
    const params={
      sigma: o.sigma!=null?o.sigma:10,
      rho:   o.rho  !=null?o.rho:28,
      beta:  o.beta !=null?o.beta:8/3
    };
    const dt=o.dt!=null?o.dt:0.01;
    const initState={
      x: o.x0!=null?o.x0:0.1,
      y: o.y0!=null?o.y0:0,
      z: o.z0!=null?o.z0:0
    };
    const state={x:initState.x, y:initState.y, z:initState.z};

    /* アダプティブレンジ: 正規化の上下限を自動拡張 */
    const range={
      xMin:-25,xMax:25,
      yMin:-30,yMax:30,
      zMin:0,  zMax:50
    };

    function updateRange(){
      range.xMin=Math.min(range.xMin,state.x);
      range.xMax=Math.max(range.xMax,state.x);
      range.yMin=Math.min(range.yMin,state.y);
      range.yMax=Math.max(range.yMax,state.y);
      range.zMin=Math.min(range.zMin,state.z);
      range.zMax=Math.max(range.zMax,state.z);
    }

    return{
      /** 現在状態への参照 */
      get state(){return state;},
      /** パラメータへの参照 */
      get params(){return params;},
      /** アダプティブレンジへの参照 */
      get range(){return range;},

      /** RK4 で 1 ステップ進める */
      step(){
        stepRK4(state,params,dt);
        updateRange();
      },

      /** N ステップ一括実行 */
      stepN(n){
        for(let i=0;i<n;i++){
          stepRK4(state,params,dt);
          updateRange();
        }
      },

      /** 現在の x,y,z を 0-127 に正規化して返す */
      normalized(){
        return{
          x:norm127(state.x,range.xMin,range.xMax),
          y:norm127(state.y,range.yMin,range.yMax),
          z:norm127(state.z,range.zMin,range.zMax)
        };
      },

      /** 初期状態にリセット */
      reset(){
        state.x=initState.x;
        state.y=initState.y;
        state.z=initState.z;
        range.xMin=-25;range.xMax=25;
        range.yMin=-30;range.yMax=30;
        range.zMin=0;  range.zMax=50;
      }
    };
  }

  /**
   * N ステップ分の軌道を一括生成して配列で返す
   * @param {number} steps
   * @param {Object} [opts]  create() と同じオプション
   * @returns {{x:number,y:number,z:number}[]}
   */
  function generate(steps,opts){
    const inst=create(opts);
    const out=[];
    for(let i=0;i<steps;i++){
      inst.step();
      out.push({x:inst.state.x,y:inst.state.y,z:inst.state.z});
    }
    return out;
  }

  return{create,generate,norm127,stepRK4,derivatives};
})();

/* ═══ LORENZ PARAMS — グローバル状態 ═══ */
const LORENZ_PARAMS = {
  sigma:   10,
  rho:     28,
  beta:    8/3,
  dt:      0.02,
  warmup:  1000,
  /* プリセット定義 */
  PRESETS: {
    classic: { label:'Classic',  sigma:10,   rho:28,   beta:2.667, dt:0.020, warmup:1000 },
    chaos:   { label:'Chaos',    sigma:14,   rho:46,   beta:2.0,   dt:0.015, warmup:2000 },
    gentle:  { label:'Gentle',   sigma:6,    rho:18,   beta:2.667, dt:0.025, warmup:500  },
    edge:    { label:'Edge',     sigma:10,   rho:24.1, beta:2.667, dt:0.018, warmup:800  },
  },
  activePreset: 'classic',
};

/* ═══════════════════════════════════════════════════
   v22.0: ATTRACTOR SEQUENCER ENGINE
   Lorenz · Rössler · Thomas の 3アトラクター統合
   x/y/z → pitch / velocity / duration / gate / density / none
   に任意マッピング可能な汎用ストレンジアトラクターエンジン
═══════════════════════════════════════════════════ */
const AttractorEngine = (() => {
  'use strict';

  /* ── Runge-Kutta 4次 汎用ステッパー ── */
  function rk4(state, derivFn, params, dt) {
    const k1 = derivFn(state, params);
    const s2 = { x: state.x + k1.dx*dt/2, y: state.y + k1.dy*dt/2, z: state.z + k1.dz*dt/2 };
    const k2 = derivFn(s2, params);
    const s3 = { x: state.x + k2.dx*dt/2, y: state.y + k2.dy*dt/2, z: state.z + k2.dz*dt/2 };
    const k3 = derivFn(s3, params);
    const s4 = { x: state.x + k3.dx*dt,   y: state.y + k3.dy*dt,   z: state.z + k3.dz*dt   };
    const k4 = derivFn(s4, params);
    state.x += (k1.dx + 2*k2.dx + 2*k3.dx + k4.dx) * dt / 6;
    state.y += (k1.dy + 2*k2.dy + 2*k3.dy + k4.dy) * dt / 6;
    state.z += (k1.dz + 2*k2.dz + 2*k3.dz + k4.dz) * dt / 6;
  }

  /* ── アトラクター微分方程式 ── */
  const DERIV = {
    /* Lorenz: σ=10, ρ=28, β=8/3 */
    lorenz: (s, p) => ({
      dx: p.a * (s.y - s.x),
      dy: s.x * (p.b - s.z) - s.y,
      dz: s.x * s.y - p.c * s.z
    }),
    /* Rössler: a=0.2, b=0.2, c=5.7 */
    rossler: (s, p) => ({
      dx: -(s.y + s.z),
      dy: s.x + p.a * s.y,
      dz: p.b + s.z * (s.x - p.c)
    }),
    /* Thomas' Cyclically Symmetric Attractor: b=0.208186 */
    thomas: (s, p) => ({
      dx: Math.sin(s.y) - p.a * s.x,
      dy: Math.sin(s.z) - p.a * s.y,
      dz: Math.sin(s.x) - p.a * s.z
    }),
  };

  /* アトラクターごとのデフォルトパラメータ */
  const DEFAULT_PARAMS = {
    lorenz:  { a:10,    b:28,    c:2.667 },
    rossler: { a:0.2,   b:0.2,   c:5.7   },
    thomas:  { a:0.208, b:0,     c:0     },
  };

  /* アトラクターごとのデフォルト dt・warmup・初期値 */
  const DEFAULT_INIT = {
    lorenz:  { dt:0.02,  warmup:1000, x0:0.1,  y0:0,    z0:0    },
    rossler: { dt:0.05,  warmup:500,  x0:0.1,  y0:0,    z0:0    },
    thomas:  { dt:0.05,  warmup:300,  x0:0.1,  y0:0,    z0:0    },
  };

  /* アトラクターごとのアダプティブレンジ初期値 */
  const DEFAULT_RANGE = {
    lorenz:  { xMin:-25, xMax:25, yMin:-30, yMax:30, zMin:0,   zMax:50  },
    rossler: { xMin:-12, xMax:12, yMin:-12, yMax:12, zMin:0,   zMax:25  },
    thomas:  { xMin:-3,  xMax:3,  yMin:-3,  yMax:3,  zMin:-3,  zMax:3   },
  };

  /** 値を 0-127 に正規化 */
  function norm127(val, min, max) {
    if (max === min) return 64;
    return Math.max(0, Math.min(127, Math.round((val - min) / (max - min) * 127)));
  }

  /**
   * アトラクターインスタンス生成
   * @param {string} type  'lorenz' | 'rossler' | 'thomas'
   * @param {Object} [opts]  { a, b, c, dt, warmup, x0, y0, z0 }
   */
  function create(type, opts) {
    const t = DERIV[type] ? type : 'lorenz';
    const derivFn = DERIV[t];
    const dp = DEFAULT_PARAMS[t];
    const di = DEFAULT_INIT[t];
    const dr = DEFAULT_RANGE[t];
    const o = opts || {};

    const params = {
      a: o.a != null ? o.a : dp.a,
      b: o.b != null ? o.b : dp.b,
      c: o.c != null ? o.c : dp.c,
    };
    const dt = o.dt != null ? o.dt : di.dt;
    const initState = {
      x: o.x0 != null ? o.x0 : di.x0,
      y: o.y0 != null ? o.y0 : di.y0,
      z: o.z0 != null ? o.z0 : di.z0,
    };
    const state = { x: initState.x, y: initState.y, z: initState.z };
    const range = { ...dr };

    function updateRange() {
      if (state.x < range.xMin) range.xMin = state.x;
      if (state.x > range.xMax) range.xMax = state.x;
      if (state.y < range.yMin) range.yMin = state.y;
      if (state.y > range.yMax) range.yMax = state.y;
      if (state.z < range.zMin) range.zMin = state.z;
      if (state.z > range.zMax) range.zMax = state.z;
    }

    return {
      type,
      get state() { return state; },
      get params() { return params; },
      get range()  { return range;  },
      step() {
        rk4(state, derivFn, params, dt);
        updateRange();
      },
      stepN(n) {
        for (let i = 0; i < n; i++) { rk4(state, derivFn, params, dt); updateRange(); }
      },
      normalized() {
        return {
          x: norm127(state.x, range.xMin, range.xMax),
          y: norm127(state.y, range.yMin, range.yMax),
          z: norm127(state.z, range.zMin, range.zMax),
        };
      },
      reset() {
        state.x = initState.x; state.y = initState.y; state.z = initState.z;
        Object.assign(range, DEFAULT_RANGE[t]);
      },
    };
  }

  /* ── プリセット定義 ── */
  const PRESETS = {
    /* Lorenz */
    'lorenz-classic':  { label:'Lorenz Classic',   type:'lorenz',  a:10,    b:28,    c:2.667, dt:0.020, warmup:1000 },
    'lorenz-chaos':    { label:'Lorenz Chaos',      type:'lorenz',  a:14,    b:46,    c:2.0,   dt:0.015, warmup:2000 },
    'lorenz-gentle':   { label:'Lorenz Gentle',     type:'lorenz',  a:6,     b:18,    c:2.667, dt:0.025, warmup:500  },
    'lorenz-edge':     { label:'Lorenz Edge',       type:'lorenz',  a:10,    b:24.1,  c:2.667, dt:0.018, warmup:800  },
    /* Rössler */
    'rossler-classic': { label:'Rössler Classic',   type:'rossler', a:0.2,   b:0.2,   c:5.7,   dt:0.050, warmup:500  },
    'rossler-funnel':  { label:'Rössler Funnel',    type:'rossler', a:0.343, b:1.82,  c:9.75,  dt:0.030, warmup:800  },
    'rossler-band':    { label:'Rössler Band',      type:'rossler', a:0.1,   b:0.1,   c:14.0,  dt:0.030, warmup:600  },
    /* Thomas */
    'thomas-classic':  { label:'Thomas Classic',    type:'thomas',  a:0.208, b:0,     c:0,     dt:0.050, warmup:300  },
    'thomas-dense':    { label:'Thomas Dense',      type:'thomas',  a:0.1,   b:0,     c:0,     dt:0.040, warmup:400  },
    'thomas-sparse':   { label:'Thomas Sparse',     type:'thomas',  a:0.32,  b:0,     c:0,     dt:0.060, warmup:200  },
  };

  return { create, norm127, PRESETS, DEFAULT_PARAMS, DEFAULT_INIT, DERIV };
})();

/* ═══ ATTRACTOR_STATE — グローバル状態 ═══ */
const ATTRACTOR_STATE = {
  /* アトラクター種別・パラメータ */
  type:    'lorenz',         /* 'lorenz' | 'rossler' | 'thomas' */
  a:       10,               /* lorenz=σ / rossler=a / thomas=b */
  b:       28,               /* lorenz=ρ / rossler=b */
  c:       2.667,            /* lorenz=β / rossler=c */
  dt:      0.02,
  warmup:  1000,
  activePreset: 'lorenz-classic',

  /* x/y/z のマッピング先
   * 'velocity' | 'pitch' | 'duration' | 'gate' | 'density' | 'none'
   * pitch = ノートインデックスオフセット ±N
   */
  mapX: 'velocity',
  mapY: 'pitch',
  mapZ: 'gate',

  /* 各マッピングのスケール (0-100 → 内部倍率) */
  scaleX: 50,   /* velocity変調幅 % */
  scaleY: 50,   /* pitch offset 幅 % */
  scaleZ: 50,   /* gate/duration 変調幅 % */
};

