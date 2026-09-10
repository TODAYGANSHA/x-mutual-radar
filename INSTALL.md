# 𝕏 GANSHA Mutual Radar 安裝教程

> 給完全不懂電腦的人看的。全程不用改設定、不用註冊、不用花錢、不會動到你任何檔案。
> 版本：v6.9 ｜ 作者：𝕏 @todaygansha
> 文件更新：2026-09-10（增補 **macOS 快捷鍵**與「**找不到油猴面板 / Dashboard**」排解）

---

## 這個東西在做什麼

它是掛在瀏覽器上的一個小工具。裝好之後，你打開 X（推特）的「跟隨者 / 跟隨中」名單，它會自動幫你標出：

- **誰沒回關你**（紅框圈起來，還會集中排到最前面）
- **誰偷偷取關過你**
- 右下角會出現一個黑色小面板，寫著 `GANSHA RADAR`

它只在你自己的瀏覽器裡看畫面，**不發任何訊息、不按任何按鈕、不上傳任何資料**。

---

## 先選一條路（不懂就選 A）

| 路線 | 適合誰 | 要多久 | 會不會卡住 |
|---|---|---|---|
| **A 複製貼上**（推薦） | 完全新手、下載一直失敗的人 | 5 分鐘 | 幾乎不會 |
| **B 一鍵安裝** | 已經裝好「油猴」外掛的人 | 1 分鐘 | 沒裝油猴就一定失敗 |
| **C 叫 AI 幫你裝** | 電腦上有 WorkBuddy / Claude Code 的人 | 3 分鐘 | AI 會一步一步帶你 |

> ⚠️ **你卡在 Raw 那一步，99% 是因為還沒裝「油猴」（Tampermonkey）。**
> 沒有這個外掛，瀏覽器不知道 `.user.js` 是什麼，只能把它當純文字顯示，當然「沒法下載」。

---

# 路線 A：複製貼上安裝（最穩，推薦）

## 第 1 步：裝「油猴」外掛

**先搞清楚你用的是哪個瀏覽器**：看你電腦上那個用來上網的圖示——
- 藍綠色圓圈 → **Edge**
- 紅黃綠藍花花圓圈 → **Chrome**
- 橘色狐狸繞地球 → **Firefox**

### Edge（推薦，國內最穩）
1. 打開這個網址：https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd
2. 按右邊藍色的「**取得**」
3. 跳出小視窗按「**新增擴充功能**」
4. 右上角出現一個**黑白方塊圖示**（像兩格積木）就成功了

### Chrome（Mac / Windows 都一樣，要能連上 Google 商店）
1. 打開 Chrome 線上應用程式商店，搜尋 **Tampermonkey**：
   https://chromewebstore.google.com/search/Tampermonkey
   （或在 Google 直接搜「Tampermonkey Chrome」）
2. 找到 **Tampermonkey**（圖示是黑底、中間一顆白眼睛的方形），按「**加到 Chrome / Add to Chrome**」
3. 跳出小視窗按「**新增擴充功能 / Add extension**」
4. 右上角出現一個**黑白方塊圖示**就成功了

> ⚠️ **很多人卡在這裡**：裝完之後圖示**不一定會直接顯示**，要從右上角的**拼圖圖示 🧩** 裡才找得到。下一節「第 3 步」有圖解。

> 如果 Chrome 商店一直轉圈打不開（國內常見），改用 Edge 或 Firefox 會省很多事。

### Firefox
1. 打開：https://addons.mozilla.org/firefox/addon/tampermonkey/
2. 按「**新增至 Firefox**」→ 跳出視窗按「**新增**」

### 怎麼確認裝好了
瀏覽器**右上角**（網址列右邊）應該出現一個**黑白方塊積木圖示**。

**看不到這個圖示？這很正常**——新版的 Chrome / Edge 會把擴充圖示收起來。做法：
1. 點網址列右邊的**拼圖圖示 🧩**（Extensions / 擴充功能）
2. 清單裡找到「**Tampermonkey**」
3. 點它旁邊的**圖釘 📌**（Pin），圖示就會固定顯示在工具列

> 🍎 **Mac 用戶必看**：接下來的快捷鍵，`Ctrl` 一律換成 **⌘（Command）**——
> `Ctrl+A` → `⌘+A`、`Ctrl+C` → `⌘+C`、`Ctrl+V` → `⌘+V`、`Ctrl+S` → `⌘+S`。

---

## 第 2 步：拿到腳本內容（兩種方式，選一個）

### 方式 1：有人直接傳 .js 檔案給你（最快）
1. 把檔案存到**桌面**
2. 在檔案上**按右鍵 → 開啟檔案 → 記事本**（Mac 用「文字編輯」）
3. 會看到一大堆英文字，按 `Ctrl + A` 全選 → `Ctrl + C` 複製
4. 關掉記事本

### 方式 2：自己從網頁複製
1. 打開：https://github.com/TODAYGANSHA/x-mutual-radar/blob/main/GANSHA-Mutual-Radar.user.js
2. 在程式碼區塊**裡面點一下**，按 `Ctrl + A` → `Ctrl + C`
3. 複製到的內容開頭應該是 `// ==UserScript==`

> 如果 GitHub 打不開 → 跳到下面「Raw 沒法下載」那一節，用鏡像網址。

---

## 第 3 步：貼進油猴

### 先找到油猴的面板在哪（找不到 Dashboard 就看這裡）

**如果右上角看不到黑白方塊圖示，不代表沒裝成功**，只是被收起來了。三種打開方式，任選一種：

**方式 1：從拼圖圖示 🧩 找（最常用）**
1. 點網址列右邊的**拼圖圖示 🧩**
2. 清單裡找到「**Tampermonkey**」→ 點它
3. 想以後都看得到，就點它旁邊的**圖釘 📌** 釘選起來

**方式 2：從擴充功能管理頁找（最保險，一定找得到）**
1. 網址列輸入 `chrome://extensions` 按 Enter
2. 找到 **Tampermonkey** → 點「**詳細資料**」
3. 往下找「**擴充功能選項**」→ 點它，就會開面板
> 如果這一頁**根本沒有 Tampermonkey** → 代表它沒裝成功，回第 1 步重裝。

**方式 3：直接在網址列開面板（進階）**
在網址列貼上（Chrome）：
```
chrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html
```

### 開面板、新增腳本

1. 點**油猴的黑白方塊圖示** → 選「**控制台**」（Dashboard / 儀表板）
2. 點左上的「**+**」號（新增腳本）
3. 會開出一個編輯視窗，裡面有一堆**範例文字** → 用 `Ctrl + A`（Mac：`⌘+A`）全選 → **按 Delete 全部刪掉**（這一步很重要，要清乾淨）
4. 把第 2 步複製的內容 `Ctrl + V`（Mac：`⌘+V`）**貼上**
5. 按 `Ctrl + S`（Mac：`⌘+S`），或點上面的「**檔案 → 儲存**」
6. 關掉這個視窗

> 成功的話，油猴控制台的列表會出現一行「**GANSHA · X Mutual Radar**」，左邊開關是綠色的。

---

## 第 4 步：開 X 驗證

1. 打開 https://x.com/ ，登入你的帳號
2. 進到你的**跟隨者**頁面（網址長這樣：`https://x.com/你的帳號/followers`）
3. **右下角出現一個黑色小面板，寫著 `GANSHA RADAR`** ＝ 成功 🎉

如果沒有跳出來：把頁面**重新整理一次**（`F5` 或 `Ctrl + R`），等 3 秒。

---

# 路線 B：一鍵安裝（要先裝好油猴）

**如果第 1 步的油猴還沒裝，這條路一定會失敗，請回到路線 A。**

確認油猴裝好之後：

1. 打開這個網址：
   ```
   https://raw.githubusercontent.com/TODAYGANSHA/x-mutual-radar/main/GANSHA-Mutual-Radar.user.js
   ```
2. 油猴會**自動跳出安裝畫面**
3. 按中間的「**安裝**」（Install）
4. 出現「安裝成功」就可以關掉

### 如果這個網址打不開（國內很常見）
依序試這幾個，哪個能開就用哪個：

```
https://gh-proxy.com/https://raw.githubusercontent.com/TODAYGANSHA/x-mutual-radar/main/GANSHA-Mutual-Radar.user.js
```
```
https://ghproxy.net/https://raw.githubusercontent.com/TODAYGANSHA/x-mutual-radar/main/GANSHA-Mutual-Radar.user.js
```

**全都打不開 → 直接走路線 A 的方式 2**（從 GitHub 網頁複製），或請人把 .js 檔案傳給你。

---

# 路線 C：叫 AI 幫你裝

如果你電腦上有 **WorkBuddy** 或 **Claude Code（CC）**，把下面這段**整段複製貼給它**，它就會一步一步帶你做完，**還會幫你把檔案下載到電腦裡**。

## 給 WorkBuddy 的提示詞（整段複製）

```
幫我安裝一個瀏覽器腳本（Tampermonkey 油猴腳本），我是電腦新手，請一步一步帶我做。
每一個動作都要明確告訴我「點哪裡、按什麼」，不要跳步，不要使用我聽不懂的術語。

腳本下載位置：
https://raw.githubusercontent.com/TODAYGANSHA/x-mutual-radar/main/GANSHA-Mutual-Radar.user.js

請幫我做到這幾件事：
1. 判斷我現在用的是什麼瀏覽器，告訴我該裝哪一版 Tampermonkey（油猴），並把安裝網址給我。
2. 把腳本下載到我電腦裡，並告訴我檔案確切放在哪個位置。
3. 帶我用「新增腳本 → 貼上內容」的方式把它裝進 Tampermonkey。
   （不要用瀏覽器直接下載安裝，我的電腦會擋。）
4. 最後告訴我怎麼驗證：打開 https://x.com/我的帳號/followers ，
   右下角應該出現黑色「GANSHA RADAR」小面板。

如果任何一步被瀏覽器擋住或出現錯誤，先告訴我「畫面上寫什麼」，再給我替代做法。
```

## 給 Claude Code / CC 的提示詞（整段複製）

```
我要在電腦上安裝一個 Tampermonkey（油猴）瀏覽器腳本，我是電腦新手。
請一步一步帶我做，每個動作都要明確說點哪裡，不要跳步，不要用術語。

腳本來源：
https://raw.githubusercontent.com/TODAYGANSHA/x-mutual-radar/main/GANSHA-Mutual-Radar.user.js

請幫我：
1. 把這個檔案下載到我電腦（例如桌面），告訴我確切路徑。
2. 如果下載失敗，改試這兩個鏡像，成功後告訴我用哪一個：
   https://gh-proxy.com/https://raw.githubusercontent.com/TODAYGANSHA/x-mutual-radar/main/GANSHA-Mutual-Radar.user.js
   https://ghproxy.net/https://raw.githubusercontent.com/TODAYGANSHA/x-mutual-radar/main/GANSHA-Mutual-Radar.user.js
3. 判斷我的作業系統（Windows / macOS）與瀏覽器，給我對應的 Tampermonkey 安裝網址。
4. 帶我用複製貼上的方式把腳本加進油猴：
   開啟檔案 → 全選複製 → 油猴控制台 → 新增腳本 → 清空範例內容 → 貼上 → 儲存。
5. 告訴我驗證方式：開 https://x.com/<我的帳號>/followers ，
   右下角出現黑色 GANSHA RADAR 面板就是成功。

遇到錯誤時，先複述畫面上的錯誤訊息，再給替代方案。
```

## AI 能幫你做到哪一步、哪一步一定要你自己來

| 步驟 | AI 能不能幫你 |
|---|---|
| 下載腳本檔案到電腦 | ✅ 可以 |
| 判斷你的瀏覽器、給安裝網址 | ✅ 可以 |
| 把程式碼內容準備好、甚至自動貼進剪貼簿 | ✅ 可以 |
| 點「加到瀏覽器 / 新增擴充功能」那個允許按鈕 | ❌ **一定要你自己按** |
| 登入 X 帳號 | ❌ 你自己來 |
| 驗證畫面有沒有出現面板 | ❌ 你自己看（但 AI 會教你怎麼看） |

簡單講：**AI 可以幫你把東西準備好、一步一步唸給你聽，但瀏覽器跳出來的「允許 / 新增」一律要你自己按。**

---

# 「Raw 那一步沒法下載」到底是什麼問題

| 你看到的狀況 | 真正原因 | 解法 |
|---|---|---|
| 打開是一整頁程式碼，不知道怎麼辦 | **還沒裝油猴** | 回到路線 A 第 1 步 |
| 點了沒反應、跳出「無法下載」 | **還沒裝油猴**，瀏覽器不認得 `.user.js` | 同上 |
| 進 `chrome://extensions` 找不到 Tampermonkey | **根本還沒裝成功** | 回到路線 A 第 1 步重裝 |
| 裝了油猴，但找不到「面板 / Dashboard」 | 圖示被收進右上角的**拼圖選單 🧩** 了 | 看**路線 A 第 3 步**的三種開啟方式 |
| Chrome 說「此檔案可能有害」 | Chrome 對 `.user.js` 的安全警告 | 按「保留」，或改用**複製貼上**（路線 A） |
| 網頁一直轉圈、逾時、連不上 | GitHub 在國內常被擋 | 用上面的**鏡像網址**，或走路線 A |
| 公司 / 學校電腦說「已封鎖下載」 | 單位資安政策 | 走路線 A 的**複製貼上**（完全不用下載） |
| 下載了但點開是記事本 | 正常，那本來就是純文字檔 | 照路線 A 第 2 步複製內容 |

> 💡 **一句話總結**：**不管遇到什麼下載問題，走「複製貼上」都一定會成功**，因為它完全不需要下載檔案。

---

# 驗證有沒有成功

進到你的跟隨者頁面（`https://x.com/你的帳號/followers`）：

- ✅ 右下角有**黑色 GANSHA RADAR 面板**
- ✅ 沒回跟的帳號被**紅框圈起來**、排在最上面
- ✅ 每個人名字旁邊有中文標籤（`互關` / `未回跟` / `已回跟`）

## 沒出現怎麼辦

0. **先確認油猴裝了、腳本也加進去了**：進 `chrome://extensions` 看有沒有 **Tampermonkey**；有就打開它的「控制台」，看列表裡有沒有「**GANSHA · X Mutual Radar**」這一行。
1. **重新整理頁面**（Windows：`Ctrl + R`／Mac：`⌘ + R`），等 3 秒
2. 點油猴圖示（找不到就點右上角**拼圖 🧩**）→ 看「GANSHA · X Mutual Radar」的**開關是不是綠色的**；灰色的話點一下打開
3. 確認網址結尾是 `/followers` 或 `/following`（其他頁面本來就不會出現）
4. 確認是**電腦版**網頁，手機版不支援
5. 還是沒有 → 把油猴控制台的畫面截圖給幫你的人看

---

# 常見疑問

**Q：會不會盜我的帳號 / 偷我的資料？**
不會。它只是在你自己的瀏覽器裡「看畫面、加標籤」。沒有 API、不會發文、不會自動追蹤任何人。取關紀錄只存在你自己瀏覽器的 localStorage 裡，沒有傳給任何人。

**Q：會害我被 X 鎖號嗎？**
不會。它完全不做任何自動操作（不自動追蹤、不自動取消、不自動發訊息），只是調整你自己頁面的顯示方式。

**Q：要錢嗎？**
完全免費、開源。程式碼全部公開在 GitHub 上，任何人都能檢查。

**Q：以後怎麼更新？**
重做一次路線 A 第 2、3 步（複製新的內容、貼上覆蓋、儲存）。或請作者給你新檔案。

**Q：我想移除它？**
油猴圖示 → 控制台 → 找到 GANSHA 那一行 → 按右邊的**垃圾桶**。資料會一起清掉。

---

## 萬一還是裝不起來

直接把這兩件事給幫你的人：
1. **你用的是什麼瀏覽器**（Edge / Chrome / Firefox）
2. **畫面上出現的錯誤訊息**（或截圖）

有這兩個，問題通常一分鐘就能定位。

---

𝕏 @todaygansha ｜ GANSHA Mutual Radar v6.9
