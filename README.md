# 当直記録

An app for recording on-call work by tapping a button. It is a PWA (a web app you can add to the home screen) that needs no server or build step.

## How to use
- **Record**: tap "対応開始" (start), enter the patient ID (you can also add it later), then tap "対応終了" (end). It also handles several patients at the same time.
- **Monthly list**: go to the month with ‹ ›. Tap a row to fix it, or use "＋ 手動で追加" to add a record you forgot.
- **Report**: "CSV出力" (opens in Excel without garbled characters) or "テキストをコピー" (tab-separated text you can paste into Excel).
- Records are grouped into a month by their **start time** (work that starts on the night of the last day of the month counts toward that month).

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
