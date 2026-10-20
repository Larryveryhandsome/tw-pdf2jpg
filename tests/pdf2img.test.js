const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/pdf2img.js');

test('頁碼範圍：空白＝全部', () => {
  assert.deepStrictEqual(P.parsePageRange('', 3).pages, [1, 2, 3]);
  assert.deepStrictEqual(P.parsePageRange('  ', 2).pages, [1, 2]);
});

test('頁碼範圍：區間、單頁、開放式、去重排序', () => {
  assert.deepStrictEqual(P.parsePageRange('5, 1-3, 2, 8-', 10).pages, [1, 2, 3, 5, 8, 9, 10]);
  assert.deepStrictEqual(P.parsePageRange('-2', 5).pages, [1, 2]);
});

test('頁碼範圍：全形逗號、頓號、波浪號也看得懂', () => {
  assert.deepStrictEqual(P.parsePageRange('1～2，4、6', 6).pages, [1, 2, 4, 6]);
});

test('頁碼範圍：錯誤提示', () => {
  const r = P.parsePageRange('0, 9, 3-1, abc', 5);
  assert.deepStrictEqual(r.pages, []);
  assert.strictEqual(r.errors.length, 4);
  assert.match(P.parsePageRange('7-9', 5).errors[0], /超過總頁數/);
  assert.deepStrictEqual(P.parsePageRange('4-9', 5).pages, [4, 5]);
});

test('檔名：去副檔名、去非法字元、頁碼補零', () => {
  assert.strictEqual(P.baseName('報告.PDF'), '報告');
  assert.strictEqual(P.baseName('a/b:c*?.pdf'), 'a_b_c__');
  assert.strictEqual(P.baseName('...pdf'), 'document');
  assert.strictEqual(P.pageFileName('合約.pdf', 7, 12, 'jpg'), '合約_p007.jpg');
  assert.strictEqual(P.pageFileName('書.pdf', 25, 1200, 'png'), '書_p0025.png');
});

test('解析度與畫布上限', () => {
  assert.strictEqual(P.dpiToScale(72), 1);
  assert.strictEqual(P.dpiToScale(144), 2);
  assert.strictEqual(P.dpiToScale(10000), 600 / 72);
  assert.strictEqual(P.dpiToScale('abc'), 150 / 72);
  const s = P.safeScale(595, 842, 10, 4000);
  assert.ok(Math.abs(842 * s - 4000) < 1e-9);
  assert.strictEqual(P.safeScale(595, 842, 2, 4000), 2);
});

test('品質與檔案大小顯示', () => {
  assert.strictEqual(P.quality(92), 0.92);
  assert.strictEqual(P.quality(500), 1);
  assert.strictEqual(P.quality(0), 0.92);
  assert.strictEqual(P.formatBytes(500), '500 B');
  assert.strictEqual(P.formatBytes(2048), '2.0 KB');
  assert.strictEqual(P.formatBytes(3 * 1024 * 1024), '3.00 MB');
});

test('沒有嵌入字型的中文 PDF：app.js 有設定 CMap，且對照表檔案都在', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  assert.match(app, /cMapUrl:\s*'vendor\/pdfjs-cmaps\/'/);
  assert.match(app, /cMapPacked:\s*true/);
  for (const f of ['UniCNS-UCS2-H.bcmap', 'ETen-B5-H.bcmap', 'GBK-EUC-H.bcmap', 'UniGB-UCS2-H.bcmap']) {
    assert.ok(fs.existsSync(path.join(root, 'vendor', 'pdfjs-cmaps', f)), f);
  }
});

test('安全：pdf.js 一律關閉 isEvalSupported（CVE-2024-4367，惡意 PDF 可執行任意 JS）', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(app, /getDocument\(\{[^}]*isEvalSupported:\s*false/);
});

test('畫布像素上限：A3 300DPI 會自動縮小，A4 300DPI 不縮', () => {
  const a4 = P.safeScale(595, 842, 300 / 72);
  assert.strictEqual(a4, 300 / 72);
  const a3 = P.safeScale(842, 1191, 300 / 72);
  assert.ok(a3 < 300 / 72);
  assert.ok(842 * a3 * 1191 * a3 <= 16000001);
  const huge = P.safeScale(14400, 14400, 600 / 72);
  assert.ok(14400 * huge * 14400 * huge <= 16000001);
});

test('同名檔不互相覆蓋', () => {
  const used = new Set();
  assert.strictEqual(P.uniqueName('a_p001.jpg', used), 'a_p001.jpg');
  assert.strictEqual(P.uniqueName('a_p001.jpg', used), 'a_p001 (2).jpg');
  assert.strictEqual(P.uniqueName('A_P001.JPG', used), 'A_P001 (3).JPG');
  assert.strictEqual(P.uniqueName('b.jpg', used), 'b.jpg');
});
