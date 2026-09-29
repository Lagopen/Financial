# 刷卡回饋與支付方式管理

以原生 HTML、CSS 與 JavaScript 建置的單頁工具。Firebase 設定完成後，首頁可搜尋店家回饋；登入者的「我的支付方式」會儲存在 Firestore 個人文件。

## Firestore 資料結構

在 Firebase 專案的同一個 Firestore Database 建立以下集合與文件：

- `Store/{店名}`：文件欄位 `Keyword` 使用逗號分隔字串（例如 `"7-ELEVEN, 7-11, 小7"`）提供搜尋關鍵字，`category`（字串）為商店類別，`offers` 為交錯排列的支付名稱與回饋文字，可存字串陣列（`["UNIOPEN卡", "4%", "測試", "1%"]`）或逗號分隔字串（`"UNIOPEN卡, 4%, 測試, 1%"`）。
- `PaymentMethods/{支付方式名稱}`：文件欄位 `Keyword` 使用相同的逗號分隔字串格式提供搜尋關鍵字，`category`（字串）為支付類別，`offers` 支援相同的陣列或逗號分隔字串格式。
- `users/{uid}`：欄位 `NickName` 儲存使用者暱稱；`PaymentMethods` 以逗號分隔字串儲存該使用者勾選的支付方式，例如 `"國泰世華Cube卡, 全支付"`。

管理表單新增或修改時，`Keyword` 會儲存為逗號分隔字串；舊資料若為字串陣列仍可讀取。回饋內容以偶數位置作為優惠名稱、下一個位置作為回饋；缺少配對回饋時會顯示「未提供」。字串格式以中英文逗號切分，因此名稱或回饋文字本身不要包含逗號。商店可依文件 ID、`Keyword` 或 `category` 搜尋；支付頁可依名稱、`Keyword`、類別或優惠內容篩選。

## Firestore Security Rules

將下列規則部署到此 Firestore Database。`Store` 與 `PaymentMethods` 公開讀取並僅允許列出的管理員 UID 寫入；個人資料與載具資料只允許文件所屬使用者讀寫。

```text
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		function isAdmin() {
			return request.auth != null
				&& request.auth.uid in [
					'sM3CsKGLJ9ZbGyXIoG1syy6T5mR2',
					'EPA1WaPcf4Wai6O5MHyDY2KxLl72'
				];
		}

		match /Store/{document=**} {
			allow read: if true;
			allow write: if isAdmin();
		}
		match /PaymentMethods/{document=**} {
			allow read: if true;
			allow write: if isAdmin();
		}
		match /PersonalSettings/{userId}/Carrier/{document=**} {
			allow read, write: if request.auth != null && request.auth.uid == userId;
		}
		match /users/{userId} {
			allow read, write: if request.auth != null && request.auth.uid == userId;
		}
		match /{document=**} {
			allow read: if false;
			allow write: if false;
		}
	}
}
```

## Firebase SDK 與登入設定

Firebase v12.19.0 使用 CDN ES module 匯入，程式分別載入 Firebase App、Authentication、Firestore 與 Analytics；`Store`、`PaymentMethods`、`users` 共用 `getFirestore(app)` 的預設資料庫。請在 Firebase Console 啟用 Email/Password 與 Google 登入提供者，並將本機與正式站網域加入 Authentication 的授權網域。

```sh
npm install
npm run dev
```

註冊時輸入的暱稱會寫入同一資料庫的 `users/{uid}` 文件 `NickName` 欄位；Google 登入會先使用 Google 顯示名稱建立暱稱，若文件已存在則以 Firestore 中的 `NickName` 為準。登入後頁首原登入按鈕會顯示該暱稱，旁邊可登出。Firebase Web 設定中的 API key 是公開識別資訊，不是資料存取授權；資料安全由 Authentication 與 Firestore Security Rules 控制。Analytics 在不支援環境不可用時不會影響登入或 Firestore。

登入後點擊頁首暱稱可開啟個人資料頁並修改 `NickName`。進入個人頁面時，程式會在 `Store/__admin_access_probe/checks` 建立隨機測試文件、讀回並刪除；只有 Firestore Rules 實際允許此讀寫時才顯示管理員版本按鈕。管理員版本啟用後，店家查詢與支付方式頁面頂端會顯示新增、編輯及刪除面板；點擊既有項目可載入資料，文件 ID 更名會以單一 transaction 搬移，避免覆寫同名項目。請部署上方遞迴匹配 `Store/{document=**}` 與 `PaymentMethods/{document=**}` 的 Rules，讓管理操作和巢狀測試路徑套用管理員寫入權限；實際資料變更仍由 Firestore Rules 驗證。

## 部署與測試

1. 依上方結構新增 `Store`、`PaymentMethods` 文件，並部署 Security Rules。
2. 執行 `npm run dev` 開發，或執行 `npm run build` 產生 `dist/` 部署檔案；可用 `npm run preview` 預覽建置結果。
3. 驗證 Email/Password 註冊登入、Google Popup 登入、頁首暱稱讀取與登出，以及店家搜尋、`users/{uid}.PaymentMethods` 儲存與回饋高亮。
