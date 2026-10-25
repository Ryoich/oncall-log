# 当直記録

An app for recording on-call work by tapping a button. It is a PWA (a web app you can add to the home screen) that needs no server or build step.

## How to use
- **Record**: tap "対応開始" (start), enter the patient ID (you can also add it later), then tap "対応終了" (end). It also handles several patients at the same time.
- **Monthly list**: go to the month with ‹ ›. Tap a row to fix it, or use "＋ 手動で追加" to add a record you forgot.
- **Report**: "CSV出力" (opens in Excel without garbled characters) or "テキストをコピー" (tab-separated text you can paste into Excel).
- **Application form**: "申請書（PDF）を作成" creates the month's on-call work report (当直実働申請書) as an A4 front/back PDF. On a phone, you can print it straight from the share sheet.
  - The form's frame is drawn by `form.js` (drawn on a canvas and embedded in the PDF). **The form's wording (title, headings, notes) is not included in this repository.**
  - Before first use, load a **form file** (`form-def.json`, managed locally under `reference/`, which is excluded from git) with "様式ファイルを読み込む". It is stored on the device and also included in backups
  - What gets filled: year/month, name, department, date and weekday, duty-type circles, start/end times, location (1 外来 / 2 病棟 / 3 他) and patient ID
  - The columns HR fills in, subtotals and totals are left blank
  - Each day holds up to 6 records, and each sheet holds 8 days (4 on the front, 4 on the back). Extra records continue in the next block, and extra days go onto a second sheet that is added automatically
- Records are grouped into a month by their **duty date**. Work that starts before 9:00 counts toward the previous day's night duty (宿直), so the early hours of the 1st after the last night of the month count toward the previous month. Work that starts at 9:00 or later as a continuation of night duty, and other exceptions, can be reassigned by changing the "当直日" (duty date) on the edit screen.
- Duty types are chosen with the buttons for each date in the monthly list. They are labelled 日直 / 宿直 / 怪我災害 / 小児二次 in the app, and appear on the form as 日直 / 宿直 / 救急 / 二次救. The defaults are 宿直 on weekdays, and 日直/宿直 on weekends judged from the times of the records. **Holidays aren't detected, so choose those by hand.**

## Data
- All data is kept only in the phone's `localStorage` and is never sent to any server.
- Uninstalling the app or clearing browser data deletes it. Back up regularly with "全データを保存" (save all data).

## Deployment (HTTPS required)
Host the files in this folder somewhere with HTTPS. For example:
- **Netlify Drop**: drag and drop this folder onto https://app.netlify.com/drop
- **GitHub Pages**: push to a repository and turn on Pages

Open the URL on your phone, then add it to your home screen:
- iPhone: Safari → Share → "ホーム画面に追加" (Add to Home Screen)
- Android: Chrome → menu → "ホーム画面に追加" (Add to Home Screen)

Note: data is kept separately per URL (origin) and per browser (on iPhone, Safari and the home screen app are also separate). Always use the app from the home screen.

## Testing on your computer
```
python3 -m http.server 8000
```
Then open http://localhost:8000.

## Updating
After you change the app, raise `VERSION` in `sw.js`.
