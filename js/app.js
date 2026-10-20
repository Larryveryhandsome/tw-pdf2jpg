/* tw-pdf2jpg 畫面邏輯。純函式在 pdf2img.js。全部在你的瀏覽器裡處理，檔案不會上傳。 */
(function () {
  'use strict';
  const P = window.Pdf2Img;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let files = [];     // { file, pdf, total }
  let results = [];   // { name, blob, url, w, h }

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
    for (const file of pdfs) {
      try {
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
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
      files.splice(Number(b.dataset.rm), 1); renderFiles();
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
        const name = P.pageFileName(f.file.name, n, f.total, format);
        results.push({ name, blob, url: URL.createObjectURL(blob), w: canvas.width, h: canvas.height });
        canvas.width = canvas.height = 0;
        $('bar').style.width = `${((i + 1) / jobs.length) * 100}%`;
      }
      renderResults();
      status(`完成！共 ${results.length} 張。`, 'ok');
    } catch (e) {
      console.error(e);
      status('轉換失敗：' + e.message, 'error');
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

  $('resetBtn').addEventListener('click', () => { clearResults(); files = []; renderFiles(); status(''); $('progress').hidden = true; });
})();
