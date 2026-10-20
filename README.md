# tw-pdf2jpg｜PDF 轉圖片（JPG／PNG）

把 PDF 的每一頁轉成圖片，方便傳 LINE、貼到簡報、上傳到只收圖片的表單。

- **檔案不上傳**：全部在你的瀏覽器裡處理，適合合約、謄本、報價單這類不想交給線上轉檔網站的文件。
- 可以一次選好幾個 PDF，**挑頁碼**（例如 `1-3, 5, 8-`）
- 選 **JPG 或 PNG**、**解析度**（96／150／200／300 DPI）、JPG 品質
- 一張一張下載，或**全部打包成 ZIP**
- 檔名自動整理成 `檔名_p001.jpg`，排序不會亂

**線上直接用：** https://larryveryhandsome.github.io/tw-pdf2jpg/

---

## 適合誰

- 要把 PDF 傳到 LINE 群組、社群，或上傳到只收 JPG 的系統的**一般人、行政、業務**
- 房仲、代書、保險業務：謄本、合約截圖給客人看
- 不想安裝軟體、也不想把文件丟到來路不明轉檔網站的人

## 怎麼用

1. 打開上面的網址（或下載這個專案，雙擊 `index.html`）。
2. 把 PDF 拖進框框，或點一下選檔。
3. 選格式、解析度、頁碼（空白＝全部），按 **開始轉換**。
4. 下面會出現每一頁的縮圖，按 **下載**，或 **全部下載（ZIP）**。

### 小提醒

- **有密碼保護的 PDF** 打不開，請先用原本的軟體解除密碼。
- 解析度越高檔案越大；傳 LINE 用 150 DPI 就很清楚，要列印再選 300 DPI。
- 頁數很多又選高解析度時，手機可能會比較慢；超大頁面會自動縮小，避免瀏覽器當掉。
- 第一次開需要連網載入 PDF.js 和 JSZip（從 cdnjs，並用 SRI 驗證檔案沒被竄改）。

## 給開發者

| 檔案 | 用途 |
|---|---|
| `index.html` | 頁面與樣式 |
| `js/pdf2img.js` | 純函式：頁碼解析、檔名、DPI 換算（瀏覽器與 Node 共用） |
| `js/app.js` | 畫面邏輯（PDF.js 轉圖、下載、ZIP） |

```bash
npm test
```

## 授權

[Apache License 2.0](LICENSE)。使用 [PDF.js](https://mozilla.github.io/pdf.js/)（Apache-2.0）與 [JSZip](https://stuk.github.io/jszip/)（MIT）。

## 🛠️ 需要客製化？

這個工具是開源的，可以免費使用。如果你想要：
- 改成符合你們公司的流程、欄位或品牌
- 串接你現在在用的系統（LINE、Google 表單、POS、會計軟體……）
- 幫你安裝、架站、教學，或長期維護

歡迎加 LINE 跟我們聊。我們會依需求的範圍與複雜度報價，原則上以實際報價單為準。

<a href="https://lin.ee/pdYGARu"><img src="https://scdn.line-apps.com/n/line_add_friends/btn/zh-Hant.png" alt="加入好友" height="36"></a>

- 💬 LINE 官方帳號：[@812ibtir](https://lin.ee/pdYGARu)（請註明「PDF 轉圖片 客製化」）
- 🏢 留白事務所：網頁設計、AI 自動化、房仲遠端助理
- 👤 作者：[林其衞 Larry](https://github.com/Larryveryhandsome)
