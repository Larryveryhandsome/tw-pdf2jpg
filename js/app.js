/* tw-pdf2jpg 畫面邏輯。純函式在 pdf2img.js。全部在你的瀏覽器裡處理，檔案不會上傳。 */
(function () {
  'use strict';
  const P = window.Pdf2Img;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // PDF.js 4.x 只提供 ES module。網頁版（http/https）用專案自己帶的檔案；
  // 直接雙擊 index.html（file://）時瀏覽器不准載入本機 module，改從 cdnjs 載入（固定版本）。
  const PDFJS_VERSION = '4.10.38';
  const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VERSION + '/';
  const abs = rel => new URL(rel, document.baseURI).href;
  let pdfjsPromise = null;
  function loadPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = (async () => {
        let lib, worker;
        if (location.protocol !== 'file:') {
          try { lib = await import(abs('vendor/pdfjs/pdf.min.mjs')); worker = abs('vendor/pdfjs/pdf.worker.min.mjs'); } catch (e) { console.warn('本機 PDF.js 載入失敗，改用 CDN', e); }
        }
        if (!lib) { lib = await import(PDFJS_CDN + 'pdf.min.mjs'); worker = PDFJS_CDN + 'pdf.worker.min.mjs'; }
        lib.GlobalWorkerOptions.workerSrc = worker;
        return lib;
      })();
      pdfjsPromise.catch(() => { pdfjsPromise = null; });
    }
    return pdfjsPromise;
  }

  let files = [];     // { file, pdf, total }
  let results = [];   // { name, blob, url, w, h }
  const MAX_TOTAL_BYTES = 600 * 1024 * 1024; // 結果全放記憶體；累積超過就停下來，避免整個分頁當掉

  const drop = $('dropZone');
  drop.addEventListener('click', () => $('fileInput').click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); } });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('over');
    addFiles([...e.dataTransfer.files]);
  });
  $('fileInput').addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
  $('format').addEventListener('change', () => { $('qualityRow').hidden = $('format').value === 'png'; });
  $('quality').addEventListener('input', () => { $('qualityVal').textContent = $('quality').value; });

  function status(msg, kind) {
    const el = $('status');
    el.textContent = msg;
    el.className = 'status ' + (kind || '');
    el.hidden = !msg;
  }

  async function addFiles(list) {
    const pdfs = list.filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!pdfs.length) { status('請選 PDF 檔。', 'error'); return; }
    status('讀取中…');
    let pdfjsLib;
    try { pdfjsLib = await loadPdfjs(); }
    catch (e) { console.error(e); status('PDF 元件載入失敗，請檢查網路後重新整理頁面。', 'error'); return; }
    for (const file of pdfs) {
      try {
        // isEvalSupported:false＝關掉 PDF.js 的 eval 路徑（CVE-2024-4367 的緩解，4.2.67 起也已在程式內修正，兩層都留著）
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), cMapUrl: abs('vendor/pdfjs-cmaps/'), cMapPacked: true, isEvalSupported: false }).promise;
        files.push({ file, pdf, total: pdf.numPages });
      } catch (e) {
        status(`「${file.name}」打不開（可能有密碼或檔案損壞）。`, 'error');
      }
    }
    renderFiles();
    if (files.length) status('');
  }

  function renderFiles() {
    $('fileList').innerHTML = files.map((f, i) => `
      <div class="file-item">
        <div><div class="file-name">${esc(f.file.name)}</div>
        <div class="muted">${f.total} 頁・${P.formatBytes(f.file.size)}</div></div>
        <button class="link" data-rm="${i}" aria-label="移除 ${esc(f.file.name)}">移除</button>
      </div>`).join('');
    $('fileList').querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      const [gone] = files.splice(Number(b.dataset.rm), 1); if (gone && gone.pdf) gone.pdf.destroy(); renderFiles();
    }));
    $('convertBtn').disabled = !files.length;
    $('options').hidden = !files.length;
  }

  function clearResults() {
    results.forEach(r => URL.revokeObjectURL(r.url));
    results = [];
    $('results').innerHTML = '';
    $('resultBar').hidden = true;
  }

  function canvasToBlob(canvas, type, q) {
    return new Promise(resolve => canvas.toBlob(resolve, type, q));
  }

  $('convertBtn').addEventListener('click', async () => {
    clearResults();
    const format = $('format').value;
    const type = format === 'png' ? 'image/png' : 'image/jpeg';
    const q = P.quality($('quality').value);
    const scale0 = P.dpiToScale($('dpi').value);
    const jobs = [];
    const usedNames = new Set();
    let totalBytes = 0, stopMsg = '';
    $('bar').style.width = '0%';
    for (const f of files) {
      const { pages, errors } = P.parsePageRange($('pages').value, f.total);
      if (errors.length) { status(`${f.file.name}：${errors.join('；')}`, 'error'); return; }
      pages.forEach(n => jobs.push({ f, n }));
    }
    if (!jobs.length) { status('沒有要轉的頁面。', 'error'); return; }
    $('convertBtn').disabled = true;
    $('progress').hidden = false;
    try {
      for (let i = 0; i < jobs.length; i++) {
        const { f, n } = jobs[i];
        status(`轉換中… ${i + 1} / ${jobs.length}（${f.file.name} 第 ${n} 頁）`);
        const page = await f.pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: P.safeScale(base.width, base.height, scale0) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';  // JPG 沒有透明，先鋪白底
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const blob = await canvasToBlob(canvas, type, q);
        if (!blob) throw new Error(`第 ${n} 頁產生圖片失敗（頁面太大或記憶體不足），請降低解析度後再試`);
        page.cleanup();
        const name = P.uniqueName(P.pageFileName(f.file.name, n, f.total, format), usedNames);
        results.push({ name, blob, url: URL.createObjectURL(blob), w: canvas.width, h: canvas.height });
        canvas.width = canvas.height = 0;
        $('bar').style.width = `${((i + 1) / jobs.length) * 100}%`;
        totalBytes += blob.size;
        if (totalBytes > MAX_TOTAL_BYTES && i < jobs.length - 1) {
          stopMsg = `記憶體接近上限，已在第 ${i + 1} / ${jobs.length} 張停止。已轉好的可以下載；剩下的請用「頁碼」分批轉，或降低解析度。`;
          break;
        }
      }
      renderResults();
      if (stopMsg) status(stopMsg, 'error'); else status(`完成！共 ${results.length} 張。`, 'ok');
    } catch (e) {
      console.error(e);
      renderResults(); // 已轉好的頁面不要因為某一頁失敗就丟掉
      status('轉換失敗：' + e.message + (results.length ? `（前 ${results.length} 張已轉好，可以下載）` : ''), 'error');
    } finally {
      $('convertBtn').disabled = false;
    }
  });

  function renderResults() {
    $('results').innerHTML = results.map((r, i) => `
      <figure class="thumb">
        <img src="${r.url}" alt="${esc(r.name)}" loading="lazy">
        <figcaption>${esc(r.name)}<br><span class="muted">${r.w}×${r.h}・${P.formatBytes(r.blob.size)}</span></figcaption>
        <a class="btn small" href="${r.url}" download="${esc(r.name)}">下載</a>
      </figure>`).join('');
    $('resultBar').hidden = !results.length;
  }

  $('zipBtn').addEventListener('click', async () => {
    if (!window.JSZip) { status('ZIP 元件載入失敗，請改用單張下載。', 'error'); return; }
    status('打包中…');
    const zip = new JSZip();
    results.forEach(r => zip.file(r.name, r.blob));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = files.length === 1 ? `${P.baseName(files[0].file.name)}_images.zip` : 'pdf_images.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status(`已打包 ${results.length} 張。`, 'ok');
  });

  $('resetBtn').addEventListener('click', () => { clearResults(); files.forEach(f => f.pdf && f.pdf.destroy()); files = []; renderFiles(); status(''); $('progress').hidden = true; });
})();
