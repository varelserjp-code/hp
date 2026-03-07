/* ═══════════════════════════════════════════════════
   v12.2+: CELLULAR AUTOMATON ENGINE
   Wolfram 1D Elementary Automaton → Harmonic Gate Matrix
   ─────────────────────────────────────────────────
   UIや既存変数に一切依存しない純粋ロジックモジュール。
   ソース: ca_sequencer.html (CA Texture Sequencer)

   使い方:
     const ca = CellularAutomaton.create({
       width: 64,       // セル幅 (default 64)
       rule: 30,         // Wolframルール番号 0-255 (default 30)
       seed: 'single',   // 'single'|'random'|'sparse'|'dense'|Uint8Array
       rows: 45          // 事前生成する行数 (default 45)
     });

     ca.grid                   // → 現在行 Uint8Array
     ca.history                // → 全行配列 [Uint8Array, ...]
     ca.step()                 // → 1世代進める（historyに追加）
     ca.stepN(10)              // → N世代一括進行
     ca.density()              // → 0-1 (活性セル密度)
     ca.gateMatrix(genIdx, harmonics, steps)
                               // → harmonics×steps の2Dゲート配列
     ca.reset()                // → seed状態に戻す
     ca.reset('random')        // → 別seedで再初期化

     // 静的ユーティリティ
     CellularAutomaton.applyRule(row, rule) // → 次世代の Uint8Array
     CellularAutomaton.ruleInfo(30)         // → {rule,binary,name}

   プリセットルール:
     30  — Chaotic (Class III)
     90  — Fractal / Sierpiński (Class II/III)
     110 — Turing-Complete (Class IV)
     54  — Complex (Class IV)
     18  — Self-similar (Class II)
     150 — XOR Lattice (Class III)
═══════════════════════════════════════════════════ */
const CellularAutomaton=(()=>{
  'use strict';

  /** 名前付きプリセット */
  const PRESETS={
    30:  'Chaotic (Class III)',
    90:  'Fractal / Sierpiński',
    110: 'Turing-Complete (Class IV)',
    54:  'Complex (Class IV)',
    18:  'Self-similar (Class II)',
    150: 'XOR Lattice (Class III)',
    73:  'Balanced Complex',
    45:  'Organic Growth',
    60:  'Cascade',
    105: 'Grain Scatter',
    122: 'Dendritic',
    126: 'Full Class III'
  };

  /**
   * 1D Elementary CA — 1ステップ適用
   * @param {Uint8Array} prev  現在行
   * @param {number} rule  Wolframルール番号 (0-255)
   * @returns {Uint8Array} 次世代
   */
  function applyRule(prev,rule){
    const n=prev.length;
    const next=new Uint8Array(n);
    for(let i=0;i<n;i++){
      const l=prev[(i-1+n)%n];
      const c=prev[i];
      const r=prev[(i+1)%n];
      const idx=(l<<2)|(c<<1)|r;
      next[i]=(rule>>idx)&1;
    }
    return next;
  }

  /**
   * シード行を生成
   * @param {number} width
   * @param {string|Uint8Array} seed
   * @returns {Uint8Array}
   */
  function makeSeed(width,seed){
    if(seed instanceof Uint8Array){
      if(seed.length===width)return new Uint8Array(seed);
      const out=new Uint8Array(width);
      for(let i=0;i<Math.min(width,seed.length);i++)out[i]=seed[i];
      return out;
    }
    const g=new Uint8Array(width);
    switch(seed){
      case'single':
        g[Math.floor(width/2)]=1;
        break;
      case'random':
        for(let i=0;i<width;i++)g[i]=rng()<0.5?1:0;
        break;
      case'sparse':
        for(let i=0;i<width;i++)g[i]=rng()<0.1?1:0;
        break;
      case'dense':
        for(let i=0;i<width;i++)g[i]=rng()<0.8?1:0;
        break;
      default:
        g[Math.floor(width/2)]=1;
    }
    return g;
  }

  /**
   * ルール情報を取得
   * @param {number} rule
   * @returns {{rule:number, binary:string, name:string|null}}
   */
  function ruleInfo(rule){
    return{
      rule:rule,
      binary:(rule>>>0).toString(2).padStart(8,'0'),
      name:PRESETS[rule]||null
    };
  }

  /**
   * CA インスタンスを生成
   * @param {Object} [opts]
   * @param {number} [opts.width=64]
   * @param {number} [opts.rule=30]
   * @param {string|Uint8Array} [opts.seed='single']
   * @param {number} [opts.rows=45]
   * @param {number} [opts.maxHistory=450]
   * @returns {Object}
   */
  function create(opts){
    const o=opts||{};
    const width=o.width||64;
    let rule=o.rule!=null?o.rule:30;
    const seedArg=o.seed||'single';
    const preRows=o.rows||45;
    const maxH=o.maxHistory||450;

    let grid=makeSeed(width,seedArg);
    let history=[new Uint8Array(grid)];

    /* 事前生成 */
    for(let i=1;i<preRows;i++){
      grid=applyRule(grid,rule);
      history.push(new Uint8Array(grid));
    }

    return{
      /** 現在行への参照 */
      get grid(){return grid;},
      /** 全行履歴 */
      get history(){return history;},
      /** セル幅 */
      get width(){return width;},
      /** 現在のルール番号 */
      get rule(){return rule;},

      /** ルールを動的に変更 */
      setRule(r){rule=Math.max(0,Math.min(255,r|0));},

      /** 1世代進める */
      step(){
        grid=applyRule(grid,rule);
        history.push(new Uint8Array(grid));
        if(history.length>maxH)history.splice(0,preRows);
      },

      /** N世代一括進行 */
      stepN(n){
        for(let i=0;i<n;i++){
          grid=applyRule(grid,rule);
          history.push(new Uint8Array(grid));
        }
        if(history.length>maxH)history.splice(0,history.length-maxH);
      },

      /**
       * 活性セル密度 (0-1)
       * @param {number} [lastN]  直近N行のみで計算（省略=全履歴）
       */
      density(lastN){
        const rows=lastN?history.slice(-lastN):history;
        let sum=0,total=0;
        for(const r of rows){
          for(let i=0;i<r.length;i++)sum+=r[i];
          total+=r.length;
        }
        return total?sum/total:0;
      },

      /**
       * CA 行 → 倍音系列ゲートマトリクス
       * CA の各行をサンプリングして harmonics × steps の 2D 配列を返す
       *
       * @param {number} genIndex  世代オフセット (step番号等を足す)
       * @param {number} [harmonics=8]  倍音レイヤー数
       * @param {number} [steps=16]     ステップ数(列)
       * @returns {number[][]}  [harmonic][step] = 0 or 1
       */
      gateMatrix(genIndex,harmonics,steps){
        harmonics=harmonics||8;
        steps=steps||16;
        const m=[];
        for(let h=0;h<harmonics;h++){
          const rowIdx=(genIndex+h*3)%history.length;
          const row=history[rowIdx];
          const gates=[];
          for(let s=0;s<steps;s++){
            const caPos=Math.floor((s/steps)*width);
            gates.push(row[caPos]);
          }
          m.push(gates);
        }
        return m;
      },

      /** シード状態に戻す（別seedも指定可） */
      reset(newSeed){
        grid=makeSeed(width,newSeed||seedArg);
        history=[new Uint8Array(grid)];
        for(let i=1;i<preRows;i++){
          grid=applyRule(grid,rule);
          history.push(new Uint8Array(grid));
        }
      }
    };
  }

  return{create,applyRule,makeSeed,ruleInfo,PRESETS};
})();

/* ═══ CA PARAMS — グローバル状態 ═══ */
const CA_PARAMS = {
  rule:     30,
  seed:     'single',   /* 'single'|'random'|'sparse'|'dense' */
  override: false,      /* false=ジャンル自動選択, true=手動指定 */
};

