/* ═══════════════════════════════════════════════════
   v25.7: CONDUCTOR TRACK 可視化・編集エンジン
   ─────────────────────────────────────────────────
   設計:
   · CONDUCTOR_VIZ_STATE: エンジン状態 (グローバル)
   · ConductorViz IIFE:
       buildDisplayData(bpm, totalBars, tensionCurve,
                        tempoModEnabled, tempoDrift, sections)
           Canvas 描画用データを生成
       draw(canvas, displayData)
           Conductor Track を Canvas に描画
       bindEditInteraction(canvas, displayData, onChange)
           クリック/ドラッグでテンションカーブを編集
       getEffectiveCurve(originalCurve)
           編集済みカーブ優先で返す
           → doGenerate() 内で tensionCurve をラップ
       updateAfterGenerate(bpm, totalBars, tensionCurve,
                           tempoModEnabled, tempoDrift, sections)
           生成後に可視化を更新
           → drawTViz() の直後に呼ぶ
       resetEdit()
           編集をリセットして自動生成カーブに戻す
   ─────────────────────────────────────────────────
   doGenerate() との接続:
     1. generateTensionCurve() の結果を
        getEffectiveCurve() でラップ
     2. drawTViz() の直後に updateAfterGenerate() を呼ぶ
   ─────────────────────────────────────────────────
   ロード順:
     ...→ 29 → [34] → 22 → 24 → 23
═══════════════════════════════════════════════════ */

/* ── エンジン状態 (グローバル) ── */
const CONDUCTOR_VIZ_STATE = {
  enabled:        false,
  editedCurve:    null,   // null = doGenerate() の自動生成を使用
  editedSections: null,
  editMode:       false,
};

const ConductorViz = (() => {
  'use strict';

  /* ── 内部キャッシュ ── */
  let _lastDisplayData = null;

  /* ── データ変換 ── */

  /**
   * buildConductorTrack() の引数から Canvas 描画用データを生成
   * doGenerate() 内で tensionCurve / sections が確定した直後に呼ぶ
   */
  function buildDisplayData(bpm, totalBars, tensionCurve, tempoModEnabled, tempoDrift, sections) {
    const bars = [];
    for (let bar = 0; bar < totalBars; bar++) {
      const t = (tensionCurve && tensionCurve[bar] != null)
        ? tensionCurve[bar]
        : 0.5;
      const actualBpm = tempoModEnabled
        ? Math.max(15, Math.min(200, Math.round(bpm + (t - 0.5) * 2 * tempoDrift)))
        : bpm;
      bars.push({
        bar,
        tension: t,
        bpm:     actualBpm,
        section: sections ? sections.find(s => s.bar === bar) : null,
      });
    }
    return {
      baseBpm: bpm,
      totalBars,
      tempoDrift,
      tempoModEnabled,
      bars,
      sections: sections || [],
      bpmMin:   Math.min(...bars.map(b => b.bpm)),
      bpmMax:   Math.max(...bars.map(b => b.bpm)),
    };
  }

  /* ── Canvas 描画 ── */

  /**
   * Conductor Track を Canvas 上に描画
   * 描画内容: テンポカーブ / テンションカーブ / セクションマーカー / 編集ハンドル
   */
  function draw(canvas, displayData) {
    const ctx = canvas.getContext('2d');
    const W   = canvas.width  = canvas.offsetWidth || 320;
    const H   = canvas.height = 120;
    ctx.clearRect(0, 0, W, H);

    if (!displayData || !displayData.bars.length) {
      ctx.fillStyle = 'rgba(0,229,255,0.08)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle   = 'rgba(0,229,255,0.5)';
      ctx.font        = '9px Share Tech Mono, monospace';
      ctx.textAlign   = 'center';
      ctx.fillText('GENERATE後に表示', W / 2, H / 2);
      return;
    }

    const { bars, sections, bpmMin, bpmMax, tempoModEnabled } = displayData;
    const n    = bars.length;
    const barW = W / n;

    /* ── テンションカーブ背景 ── */
    bars.forEach((b, i) => {
      const alpha = b.tension * 0.25 + 0.04;
      ctx.fillStyle = 'rgba(140,63,255,' + alpha.toFixed(3) + ')';
      ctx.fillRect(i * barW, 0, barW, H);
    });

    /* ── BPM カーブ (テンポモッド有効時) ── */
    if (tempoModEnabled && bpmMax > bpmMin) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,229,255,0.85)';
      ctx.lineWidth   = 1.5;
      bars.forEach((b, i) => {
        const x = i * barW + barW / 2;
        const y = H - 14 - ((b.bpm - bpmMin) / (bpmMax - bpmMin)) * (H - 28);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,229,255,0.6)';
      ctx.font      = '8px Share Tech Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(bpmMax + ' BPM', 2, 10);
      ctx.fillText(bpmMin + ' BPM', 2, H - 4);
    } else {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,229,255,0.35)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,229,255,0.5)';
      ctx.font      = '8px Share Tech Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(displayData.baseBpm + ' BPM (fixed)', 2, H / 2 - 3);
    }

    /* ── テンションカーブライン ── */
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,204,0,0.5)';
    ctx.lineWidth   = 1;
    bars.forEach((b, i) => {
      const x = i * barW + barW / 2;
      const y = H - 8 - b.tension * (H - 16);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    /* ── セクションマーカー ── */
    sections.forEach(s => {
      const x = s.bar * barW;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(29,233,182,0.8)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([2, 3]);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#1de9b6';
      ctx.font      = '7px Share Tech Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(s.name, x + 2, 10);
    });

    /* ── バーグリッド ── */
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth   = 1;
    bars.forEach((_, i) => {
      if (!i) return;
      const x = i * barW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    });

    /* ── 編集ハンドル (editMode 時) ── */
    if (CONDUCTOR_VIZ_STATE.editMode) {
      bars.forEach((b, i) => {
        const x = i * barW + barW / 2;
        const y = H - 8 - b.tension * (H - 16);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle   = 'rgba(255,204,0,0.9)';
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 1;
        ctx.fill();
        ctx.stroke();
      });
    }
  }

  /* ── インタラクション ── */

  /**
   * Canvas 上のクリック/ドラッグでテンションカーブを編集
   * editMode=true のとき有効
   */
  function bindEditInteraction(canvas, displayData, onChange) {
    let isDragging = false;

    function _getBar(x) {
      return Math.max(0, Math.min(
        displayData.totalBars - 1,
        Math.floor(x / (canvas.offsetWidth / displayData.totalBars))
      ));
    }

    function _getTension(y) {
      const H = canvas.height || 120;
      return Math.max(0, Math.min(1, 1 - (y - 8) / (H - 16)));
    }

    function _applyEdit(e) {
      if (!CONDUCTOR_VIZ_STATE.editMode) return;
      const rect = canvas.getBoundingClientRect();
      const bar  = _getBar(e.clientX - rect.left);
      const t    = _getTension(e.clientY - rect.top);

      if (!CONDUCTOR_VIZ_STATE.editedCurve) {
        CONDUCTOR_VIZ_STATE.editedCurve = displayData.bars.map(b => b.tension);
      }
      CONDUCTOR_VIZ_STATE.editedCurve[bar] = t;

      displayData.bars[bar].tension = t;
      displayData.bars[bar].bpm = displayData.tempoModEnabled
        ? Math.max(15, Math.min(200, Math.round(displayData.baseBpm + (t - 0.5) * 2 * displayData.tempoDrift)))
        : displayData.baseBpm;
      displayData.bpmMin = Math.min(...displayData.bars.map(b => b.bpm));
      displayData.bpmMax = Math.max(...displayData.bars.map(b => b.bpm));

      draw(canvas, displayData);
      if (onChange) onChange(displayData);
    }

    canvas.addEventListener('mousedown',  e => { isDragging = true;  _applyEdit(e); });
    canvas.addEventListener('mousemove',  e => { if (isDragging) _applyEdit(e); });
    canvas.addEventListener('mouseup',    ()  => { isDragging = false; });
    canvas.addEventListener('mouseleave', ()  => { isDragging = false; });
  }

  /* ── doGenerate() との接続 ── */

  /**
   * 編集済みカーブがあればそれを返し、なければ元のカーブをそのまま返す
   *
   * 使用例 (doGenerate() 内):
   *   const effectiveCurve = ConductorViz.getEffectiveCurve(tensionCurve);
   *   // 以降 tensionCurve の代わりに effectiveCurve を使う
   */
  function getEffectiveCurve(originalCurve) {
    return CONDUCTOR_VIZ_STATE.editedCurve || originalCurve;
  }

  /**
   * 生成後に可視化を更新
   *
   * 使用例 (doGenerate() 内 drawTViz() の直後):
   *   if (CONDUCTOR_VIZ_STATE.enabled) {
   *     ConductorViz.updateAfterGenerate(
   *       S.bpm, totalBars, tensionCurve,
   *       S.engines.macro && S.macroEnabled && S.tempoModEnabled,
   *       S.tempoDrift, sections
   *     );
   *   }
   */
  function updateAfterGenerate(bpm, totalBars, tensionCurve, tempoModEnabled, tempoDrift, sections) {
    const canvas = document.getElementById('conductorVizCanvas');
    if (!canvas) return;

    const data = buildDisplayData(bpm, totalBars, tensionCurve, tempoModEnabled, tempoDrift, sections);

    /* 編集中は手動カーブを維持、未編集時のみ表示データを更新 */
    if (!CONDUCTOR_VIZ_STATE.editedCurve) {
      _lastDisplayData = data;
    }

    const displayForDraw = _lastDisplayData || data;
    draw(canvas, displayForDraw);

    /* editMode 時は描画後に bindEditInteraction を再バインド
       (生成ごとに displayData 参照が更新されるため) */
    if (CONDUCTOR_VIZ_STATE.editMode) {
      /* 既存リスナーをクリアするためにキャンバスを置換 */
      const parent  = canvas.parentNode;
      const clone   = canvas.cloneNode(true);
      parent.replaceChild(clone, canvas);
      draw(clone, displayForDraw);
      bindEditInteraction(clone, displayForDraw, null);
    }
  }

  /**
   * 編集をリセットして自動生成カーブに戻す
   */
  function resetEdit() {
    CONDUCTOR_VIZ_STATE.editedCurve    = null;
    CONDUCTOR_VIZ_STATE.editedSections = null;
    CONDUCTOR_VIZ_STATE.editMode       = false;
    _lastDisplayData                   = null;
  }

  return {
    buildDisplayData,
    draw,
    bindEditInteraction,
    getEffectiveCurve,
    updateAfterGenerate,
    resetEdit,
  };
})();
