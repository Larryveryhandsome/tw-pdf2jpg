/*
 * tw-pdf2jpg 純函式（不碰畫面）：頁碼範圍、檔名、輸出設定。
 * 瀏覽器：window.Pdf2Img；Node：require('./pdf2img.js')
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pdf2Img = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * 「1-3,5,8-」→ [1,2,3,5,8,9,...total]。空白＝全部。超出範圍的頁碼略過。
   * 回傳 { pages: [...], errors: [...] }
   */
  function parsePageRange(text, total) {
    const pages = new Set();
    const errors = [];
    const src = String(text || '').replace(/[，、；;\s]+/g, ',').replace(/[－—～~]/g, '-').trim();
    if (!src || src === ',') {
      for (let i = 1; i <= total; i++) pages.add(i);
      return { pages: [...pages], errors };
    }
    for (const part of src.split(',').filter(Boolean)) {
      const m = part.match(/^(\d*)-(\d*)$/);
      if (m) {
        const a = m[1] ? parseInt(m[1], 10) : 1;
        const b = m[2] ? parseInt(m[2], 10) : total;
        if (a > b) { errors.push(`「${part}」起訖顛倒`); continue; }
        for (let i = Math.max(1, a); i <= Math.min(total, b); i++) pages.add(i);
        if (a > total) errors.push(`「${part}」超過總頁數 ${total}`);
      } else if (/^\d+$/.test(part)) {
        const n = parseInt(part, 10);
        if (n >= 1 && n <= total) pages.add(n);
        else errors.push(`第 ${n} 頁不存在（共 ${total} 頁）`);
      } else {
        errors.push(`看不懂「${part}」`);
      }
    }
    return { pages: [...pages].sort((x, y) => x - y), errors };
  }

  /** 去掉 .pdf 與 Windows／Mac 不允許的檔名字元。 */
  function baseName(fileName) {
    const name = String(fileName || 'document').replace(/\.pdf$/i, '');
    const safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim();
    return safe || 'document';
  }

  /** 每頁輸出檔名：報告_p001.jpg（頁數補零到總頁數的位數，至少 3 位，排序才正確）。 */
  function pageFileName(fileName, pageNum, totalPages, format) {
    const width = Math.max(3, String(totalPages).length);
    const ext = format === 'png' ? 'png' : 'jpg';
    return `${baseName(fileName)}_p${String(pageNum).padStart(width, '0')}.${ext}`;
  }

  /** 解析度：DPI → pdf.js 的 scale（PDF 一點＝1/72 英吋）。限制在 36～600 DPI。 */
  function dpiToScale(dpi) {
    const d = Math.min(600, Math.max(36, Number(dpi) || 150));
    return d / 72;
  }

  /** 避免畫布太大讓瀏覽器當掉：長邊超過 maxSide 就自動縮小 scale。 */
  function safeScale(widthPt, heightPt, scale, maxSide, maxPixels) {
    const limit = maxSide || 8000;
    const area = maxPixels || 16000000; // iOS Safari 等行動瀏覽器畫布上限約 16.7M 像素，超過會變空白圖
    let s = scale;
    const longest = Math.max(widthPt, heightPt) * s;
    if (longest > limit) s *= limit / longest;
    const px = widthPt * s * heightPt * s;
    if (px > area) s *= Math.sqrt(area / px);
    return s;
  }

  /** 避免同名檔互相覆蓋（ZIP 裡同名會只剩一個）：a.jpg、a (2).jpg、a (3).jpg…；used 是已用過的 Set，會被更新。 */
  function uniqueName(name, used) {
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
    let out = name, i = 2;
    while (used.has(out.toLowerCase())) out = `${stem} (${i++})${ext}`;
    used.add(out.toLowerCase());
    return out;
  }

  /** 品質 1～100 → 0.01～1。 */
  function quality(q) {
    const n = Math.min(100, Math.max(1, Number(q) || 92));
    return n / 100;
  }

  function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  return { parsePageRange, baseName, pageFileName, uniqueName, dpiToScale, safeScale, quality, formatBytes };
});
