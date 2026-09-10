// ==UserScript==
// @name         GANSHA · X Mutual Radar
// @namespace    http://tampermonkey.net/
// @version      6.10
// @description  [GANSHA 互關雷達] X 追蹤名單增強：未回關／未回跟自動排到最前並加粉紅框、互關標綠、本地記錄誰偷偷取關你；右下角面板可點數字看完整名單。資料只存自己的瀏覽器，不公開、不上傳、不自動操作。安裝與排解見 repo 的 INSTALL.md。
// @author       𝕏 @todaygansha
// @updateURL    https://raw.githubusercontent.com/TODAYGANSHA/x-mutual-radar/main/GANSHA-Mutual-Radar.user.js
// @downloadURL  https://raw.githubusercontent.com/TODAYGANSHA/x-mutual-radar/main/GANSHA-Mutual-Radar.user.js
// @homepageURL  https://github.com/TODAYGANSHA/x-mutual-radar
// @supportURL   https://github.com/TODAYGANSHA/x-mutual-radar/blob/main/INSTALL.md
// @match        *://x.com/*
// @match        *://twitter.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 腳本版本：面板頁腳統一讀這裡，往後改版只要改這一行就不會漏
    const SCRIPT_VER = '6.10';

    // v6.9.1 啟動標記：一眼判斷「腳本到底有沒有被瀏覽器執行」。
    // 在 x.com 按 F12 → Console（主控台），看到這行＝腳本在跑；
    // 完全沒看到＝擴充權限沒開（Chrome/Edge 138+ 需在 Tampermonkey 詳情頁開啟
    // 「允許使用者指令碼 / Allow User Scripts」，或於擴充頁開啟開發者模式）。
    try {
        console.log('%c[GANSHA 雷達] v' + SCRIPT_VER + ' 已載入 ✅ 正在監聽 x.com 的 /followers 與 /following 列表頁',
            'color:#e0245e;font-weight:bold;font-size:13px');
    } catch (e) {}

    // ---------- UI 文字（全中文顯示；品牌標題保留英文 GANSHA RADAR） ----------
    const i18n = {
        tracked: '已監測',
        dayUnit: '天',
        today: '今天',
        brandTag: '\u{1D54F} @todaygansha',
        found: '未回關',
        notBack: '未回跟',
        mutual: '互關',
        total: '總共',
        backed: '已回跟',
        // v6.8 推薦／建議帳號（非粉絲，排除用；只在「自己的」跟隨者頁生效）
        suggest: '推薦 · 非粉絲',
        excluded: '已排除推薦',
        // v6.9 別人的列表：改用「他追不追你」的口徑
        followsYou: '關注你',
        followsYouTag: '關注了你',
        trackedByMe: '已追蹤',
        othersList: '他人列表',
        // v6.6 取關偵測
        unfNew: '剛取關你',
        unfPast: '曾取關',
        unfLabel: '取關',
        unfCopy: '點此看名單',
        unfCopied: '已複製',
        unfEmpty: '尚無紀錄',
        // v6.10 名單視窗（點面板上的數字就能看完整名單）
        listHint: '看名單',
        listTitleSuffix: '名單',
        listBtnCopy: '複製名單',
        listBtnCopied: '已複製 ✓',
        listBtnClose: '關閉',
        listHintTitle: '點一下看完整名單（含已監測天數）',
        unfWatching: '還在觀察中',
        unfTip: '本地取關偵測：記錄「曾追蹤你、後來取消」的帳號。只存在你自己的瀏覽器，不上傳、不公開。剛開始一定是 0，要累積一段時間才會有數字。',
        unfNoteOpen: '這是「本地取關偵測」的紀錄。腳本只在你自己的跟隨者頁運作，把「曾經追蹤過你、後來取消」的人記下來。資料只存在你自己的瀏覽器裡，不上傳、不公開、也不會自動做任何事。剛開始一定是 0，要持續開著頁面、讓腳本觀察一段時間才會有數字。',
        listNoteOwn: '這是腳本「捲過就看過」的累計名單（只增不減，不會因為你往回捲就掉數字）。數字對不上時，把列表往下多捲幾段讓它掃完。點帳號可以直接開他的主頁。',
        listNoteOthers: '這是你在別人的列表上已經捲過的帳號。上面列出「關注了你」（值得你回關）與「你已追蹤」的人；跟你互不相干的不會列出來。',
        listEmpty: '目前還沒有資料。把列表往下捲，讓腳本掃過帳號就會累積進來。'
    };

    // ---------- 「對方回關了我」的關鍵詞（包含匹配，兼容多語言變體） ----------
    const followsYouKeywords = [
        'follows you', 'follows you back',
        '关注了你', '关注你', '已关注', '正在关注你',
        '關注了你', '關注你', '已關注', '正在關注你',
        '跟隨了你', '跟随了你', '跟隨你', '跟随你', '正在跟隨你', '正在跟随你',
        '追隨了你', '追随了你', '追隨你', '追随你', '正在追隨你', '正在追随你',
        '互相追隨', '互相追随', '互相跟隨', '互相跟随', '跟你互相追隨', '跟你互相追随',
        'フォローされています', '나를 팔로우합니다', 'te sigue', 'vous suit',
        'folgt dir', 'segue você', 'ti segue', 'يتابعك'
    ];

    const IGNORED_USERNAMES = new Set([
        'search', 'explore', 'notifications', 'messages', 'home', 'settings', 'i'
    ]);

    // ---------- 本地監測存儲 ----------
    const STORE_KEY = 'xufr_first_seen_v2';
    const store = loadStore();

    function loadStore() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function saveStore() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
    }
    function todayStr() {
        const d = new Date();
        return d.getFullYear() + '-' +
               String(d.getMonth() + 1).padStart(2, '0') + '-' +
               String(d.getDate()).padStart(2, '0');
    }
    function daysSince(dateStr) {
        if (!dateStr) return 0;
        const t = new Date(dateStr + 'T00:00:00').getTime();
        if (isNaN(t)) return 0;
        const now = new Date(); now.setHours(0, 0, 0, 0);
        return Math.max(0, Math.round((now.getTime() - t) / 86400000));
    }
    function fmtDays(n) {
        if (n <= 0) return i18n.today;
        return i18n.tracked + ' ' + n + ' ' + i18n.dayUnit;
    }

    // ================= v6.6 取關偵測（本地、增量、寬限確認） =================
    // 原理：每次掃到某人就記下「他當時有沒有追你」；下次再掃到時比對。
    //   上次 = 有追你(1) → 這次 = 沒追你(0)，且 0 的狀態持續超過寬限期 → 判定「被取關」。
    // 為什麼要寬限期：X 的「跟隨你」指示器是分批渲染的，剛載入時常暫時讀不到，
    //   若當下就判定會大量誤判。設 30 分鐘寬限 → DOM 載完會自動回到 1，誤判自動消失。
    // 合規：資料全部存在自己的瀏覽器 localStorage，不公開、不上傳、不標記他人。
    const MSTATE_KEY = 'xufr_mstate_v1';   // username -> {s:0|1, z:首次觀測到0的時間, t:最後觀測}
    const UNF_KEY = 'xufr_unf_v1';         // username -> 'YYYY-MM-DD'（確認被取關的日期）
    const GRACE_MS = 30 * 60 * 1000;       // 寬限 30 分鐘

    let mstate = loadMState();
    let unfLog = loadUnfLog();
    let mstateDirty = false;

    function loadMState() {
        try { return JSON.parse(localStorage.getItem(MSTATE_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function loadUnfLog() {
        try { return JSON.parse(localStorage.getItem(UNF_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function flushMState() {
        if (!mstateDirty) return;
        try { localStorage.setItem(MSTATE_KEY, JSON.stringify(mstate)); } catch (e) {}
        mstateDirty = false;
    }
    function saveUnfLog() {
        try { localStorage.setItem(UNF_KEY, JSON.stringify(unfLog)); } catch (e) {}
    }

    // 回傳：'new' = 本次剛確認被取關；'past' = 之前就記過；null = 無事件
    function detectUnfollow(username, followedBy) {
        const now = Date.now();
        const prev = mstate[username];
        let result = null;

        if (followedBy) {
            // 現在有追你 → 記下「曾經追過我」基準(h=1)，並清空「觀測到 0」的計時
            if (!prev || prev.s !== 1 || prev.z || prev.h !== 1) {
                mstate[username] = { h: 1, s: 1, z: 0, t: now };
            } else {
                prev.t = now;
            }
            mstateDirty = true;
        } else {
            // h 必須保留（不能被 s=0 覆寫）：它是「他是否曾追過我」的唯一基準
            const hadFollowed = (prev && prev.h) ? prev.h : 0;
            const zeroSince = (prev && prev.z) ? prev.z : now;
            mstate[username] = { h: hadFollowed, s: 0, z: zeroSince, t: now };
            mstateDirty = true;

            // 兩個條件都成立才判定：曾明確觀測到他追你 ＋ 0 的狀態持續超過寬限
            if (hadFollowed === 1 && (now - zeroSince) >= GRACE_MS) {
                const existed = !!unfLog[username];
                const today = todayStr();
                if (!existed || unfLog[username] !== today) {
                    unfLog[username] = today;   // 反覆取關者更新為最近一次日期
                    saveUnfLog();
                }
                result = existed ? 'past' : 'new';
            }
        }
        return result;
    }

    function unfCount() { return Object.keys(unfLog).length; }

    // 匯出：純本地名單，複製到剪貼簿（自己保存用，不公開、不上傳）
    function exportUnfollowers() {
        const keys = Object.keys(unfLog).sort((a, b) => (unfLog[a] < unfLog[b] ? 1 : -1));
        if (!keys.length) return i18n.unfEmpty;
        const lines = keys.map(u => '@' + u + '  ' + unfLog[u]);
        const txt = 'GANSHA 取關紀錄 ' + todayStr() + '（共 ' + keys.length + '）\n' + lines.join('\n');
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
        } catch (e) {}
        try { console.log(txt); } catch (e) {}
        return txt;
    }
    window.__ganshaExportUnfollowers = exportUnfollowers;

    // 每 60 秒落盤一次狀態（避免每次掃描都寫 localStorage）
    setInterval(flushMState, 60000);

    // ---------- 統計面板 ----------
    let lastKey = '';
    let statsPanel = null;

    // label：主計數標題；count：主計數；diag：第二行細項
    function updateStats(label, count, diag) {
        if (!document.body) return;
        const key = (label || '') + '|' + count + '|' + (diag || '');
        if (key === lastKey && statsPanel) return;
        lastKey = key;

        if (!statsPanel) {
            statsPanel = document.createElement('div');
            statsPanel.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 999999; background: rgba(0,0,0,0.8); color: #fff; padding: 10px 15px; border-radius: 8px; font-size: 13px; font-family: monospace; pointer-events: none; border: 1px solid #333; max-width: 360px;';
            document.body.appendChild(statsPanel);
        }
        statsPanel.innerHTML =
            '<div style="display:flex;align-items:center;gap:7px">' +
            '<svg width="17" height="17" viewBox="0 0 18 18" style="flex:0 0 auto" aria-hidden="true">' +
            '<circle cx="9" cy="9" r="7.4" fill="none" stroke="#00ba7c" stroke-width="1.4" opacity=".9"/>' +
            '<circle cx="9" cy="9" r="4.6" fill="none" stroke="#00ba7c" stroke-width="1.4" opacity=".55"/>' +
            '<circle cx="9" cy="9" r="1.5" fill="#00ba7c"/>' +
            '<line x1="9" y1="9" x2="13.6" y2="5" stroke="#00ba7c" stroke-width="1.7" stroke-linecap="round"/>' +
            '</svg>' +
            '<span style="font-size:15px;font-weight:800;letter-spacing:2px;line-height:1">GANSHA</span>' +
            '<span style="font-size:9px;font-weight:700;letter-spacing:2.5px;opacity:.6;margin-left:2px;padding-top:2px">RADAR</span>' +
            '</div>' +
            '<div id="gansha-main-line" title="' + i18n.listHintTitle + '" style="margin-top:5px;display:flex;align-items:baseline;gap:6px;pointer-events:auto;cursor:pointer">' +
            '<span>' + (label || i18n.found) + ': <b style="font-size:15px">' + count + '</b></span>' +
            '<span style="opacity:.55;font-size:10px;text-decoration:underline dotted;text-underline-offset:3px">' + i18n.listHint + '</span>' +
            '</div>' +
            (diag ? '<div style="opacity:.7;font-size:11px;margin-top:2px">' + diag + '</div>' : '') +
            '<div id="gansha-unf-line" title="' + i18n.unfTip + '" style="opacity:.85;font-size:11px;margin-top:4px;pointer-events:auto;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px">' +
            i18n.unfLabel + ': <b>' + unfCount() + '</b> · ' + (unfCount() ? i18n.unfCopy : i18n.unfWatching) + '</div>' +
            '<div style="opacity:.45;font-size:10px;margin-top:5px;padding-top:3px;border-top:1px solid rgba(255,255,255,.18)">' +
            i18n.brandTag + ' · v' + SCRIPT_VER + '</div>';

        // v6.10：點「未回關 / 未回跟 數字」→ 開完整名單；點「取關」行 → 開取關偵測說明與名單
        if (!statsPanel.dataset.unfBound) {
            statsPanel.dataset.unfBound = '1';
            statsPanel.addEventListener('click', (ev) => {
                const t = ev.target;
                if (!t || !t.closest) return;
                if (t.closest('#gansha-main-line')) { openListModal(); return; }
                if (t.closest('#gansha-unf-line')) { openUnfListModal(); return; }
            });
        }
    }

    // ---------- v6.10：名單視窗 ----------
    // X 的列表是虛擬捲動，再怎麼滑也看不完、也數不清。這裡把腳本累計到的名單
    // 一次攤開，可點帳號開主頁、可複製。純前端顯示，不做任何自動操作。
    let listModal = null;
    let listSnapshot = { title: '', note: '', rows: [], empty: '' };

    function setSnapshot(title, note, rows, empty) {
        listSnapshot = { title: title, note: note || '', rows: rows || [], empty: empty || i18n.listEmpty };
    }

    function copyToClipboard(txt) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt);
        } catch (e) {}
        try {
            const ta = document.createElement('textarea');
            ta.value = txt;
            ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return Promise.resolve();
        } catch (e) { return Promise.reject(e); }
    }

    function closeListModal() { if (listModal) listModal.style.display = 'none'; }

    function rowsToText(rows) {
        return rows.map(r => '@' + r.u + (r.note ? '  ' + r.note : '')).join('\n');
    }

    function openListModal() {
        if (!document.body) return;
        const snap = listSnapshot;

        if (!listModal) {
            listModal = document.createElement('div');
            listModal.style.cssText = 'position:fixed;inset:0;z-index:1000001;background:rgba(0,0,0,.55);display:none;';
            listModal.addEventListener('click', (ev) => { if (ev.target === listModal) closeListModal(); });
            document.body.appendChild(listModal);
            document.addEventListener('keydown', (ev) => {
                if (ev.key === 'Escape' && listModal && listModal.style.display === 'block') closeListModal();
            });
        }

        const rowsHtml = snap.rows.length
            ? snap.rows.map(r =>
                '<a href="https://x.com/' + r.u + '" target="_blank" rel="noopener noreferrer" ' +
                'style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 2px;' +
                'border-bottom:1px solid rgba(255,255,255,.09);color:#fff;text-decoration:none">' +
                '<span style="font-family:monospace;font-size:13px">@' + r.u + '</span>' +
                '<span style="opacity:.6;font-size:11px;white-space:nowrap">' + (r.note || '') + '</span></a>').join('')
            : '<div style="opacity:.75;padding:12px 2px;line-height:1.75;font-size:12px">' + snap.empty + '</div>';

        listModal.innerHTML =
            '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,92vw);max-height:78vh;' +
            'display:flex;flex-direction:column;background:#15202b;color:#fff;border-radius:12px;padding:16px 18px;' +
            'font-family:monospace;box-shadow:0 12px 44px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12)">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex:0 0 auto">' +
                '<div style="font-size:15px;font-weight:800;letter-spacing:.5px">' + snap.title + '</div>' +
                '<div id="gansha-modal-close" style="cursor:pointer;opacity:.65;font-size:17px;line-height:1;padding:2px 7px">✕</div>' +
              '</div>' +
              (snap.note ? '<div style="opacity:.6;font-size:11px;margin-top:7px;line-height:1.7;flex:0 0 auto">' + snap.note + '</div>' : '') +
              '<div style="margin-top:10px;overflow:auto;flex:1 1 auto;min-height:44px">' + rowsHtml + '</div>' +
              '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;flex:0 0 auto">' +
                '<div id="gansha-modal-copy" style="cursor:pointer;padding:6px 13px;border:1px solid rgba(255,255,255,.3);' +
                'border-radius:999px;font-size:12px">' + i18n.listBtnCopy + '</div>' +
                '<div id="gansha-modal-ok" style="cursor:pointer;padding:6px 15px;background:#1d9bf0;border-radius:999px;' +
                'font-size:12px;font-weight:700">' + i18n.listBtnClose + '</div>' +
              '</div>' +
            '</div>';
        listModal.style.display = 'block';

        const closeEl = listModal.querySelector('#gansha-modal-close');
        const okEl = listModal.querySelector('#gansha-modal-ok');
        const copyEl = listModal.querySelector('#gansha-modal-copy');
        if (closeEl) closeEl.addEventListener('click', closeListModal);
        if (okEl) okEl.addEventListener('click', closeListModal);
        if (copyEl) copyEl.addEventListener('click', () => {
            if (!snap.rows.length) { copyEl.textContent = i18n.unfEmpty; return; }
            copyToClipboard(rowsToText(snap.rows)).then(() => {
                copyEl.textContent = i18n.listBtnCopied;
                setTimeout(() => { copyEl.textContent = i18n.listBtnCopy; }, 1500);
            }).catch(() => { copyEl.textContent = i18n.unfEmpty; });
        });
    }

    // 取關偵測名單（含說明；0 筆時把「這是什麼」講清楚，不要讓人一頭霧水）
    function openUnfListModal() {
        const keys = Object.keys(unfLog).sort((a, b) => (unfLog[a] < unfLog[b] ? 1 : -1));
        setSnapshot(
            i18n.unfLabel + i18n.listTitleSuffix + ' · ' + keys.length,
            i18n.unfNoteOpen,
            keys.map(u => ({ u: u, note: unfLog[u] })),
            i18n.unfNoteOpen
        );
        openListModal();
    }

    // ---------- 不重複累計帳號（username → 0/1） ----------
    // 0 = 未回關 / 未回跟（應排最前）；1 = 互關 / 已回跟
    // X 虛擬列表會回收離開畫面的 DOM → 舊版每輪只算「當下可見」造成數字倒退；
    // v5.7 改：帳號掃過一次就進 Map、只增不減，狀態以最新掃描覆蓋。
    const acc = new Map();
    let accPath = '';        // 目前累計的頁面（完整 pathname）
    let accZeroStreak = 0;   // 連續幾輪「0 列可見」→ 判斷 X 清空重建
    const sugSeen = new Set(); // v6.8：本頁已排除的推薦帳號（換頁清空）
    // v6.9：別人列表的專用計數（不進 acc，避免污染自己的未回跟統計）
    const othersSeen = new Set();
    const othersFY = new Set();      // 他有追你
    const othersTracked = new Set(); // 你已追他

    // 只取主欄內真正可見的 UserCell；排除右欄建議、aria-hidden 副本、彈窗
    function visibleCellsOnPage() {
        const root = document.querySelector('[data-testid="primaryColumn"]') || document.body;
        const sidebar = document.querySelector('[data-testid="sidebarColumn"]');
        let list = Array.from(root.querySelectorAll('[data-testid="UserCell"]'));
        if (sidebar) list = list.filter(c => !sidebar.contains(c));
        list = list.filter(c => {
            if (c.closest('[aria-hidden="true"]')) return false;
            if (c.closest('[role="dialog"]')) return false;
            const r = c.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        });
        return list;
    }

    // 「我已經在追蹤他」的按鈕文字（v6.7 新增）
    // 舊版只認「跟隨/關注/Follow」開頭 → X 若渲染成「關注中／已關注／正在關注」這類變體，
    // 會被誤判成「未回跟」而錯標紅框。這裡先攔一次「已追蹤」狀態。
    const FOLLOWING_TXT_RE = /^(正在跟隨|跟隨中|已跟隨|正在關注|關注中|已關注|正在追隨|追隨中|已追蹤|追蹤中|Following|フォロー中|フォロー済み|Siguiendo|Suivre|Abonné)/i;
    // 「我還沒追蹤他」的按鈕文字
    const FOLLOW_TXT_RE = /^(跟隨|追随|关注|關注|追蹤|Follow|フォロー|Seguir|Suivre|Følg|Следить|Takip|Ikuti)/;

    // ---------- v6.8：推薦／建議帳號識別（他們根本沒追你，不是粉絲） ----------
    // X 會在 /followers 列表尾端插入「為你推薦／你可能感興趣／Who to follow」區塊，
    // 這些人不是你的粉絲，但一樣渲染成 UserCell + 「跟隨」鈕 → 會被當成「未回跟」錯標紅框。
    // 兩道關卡：① 只掃主列表容器（下面 mainListCells）② 文案識別兜底（這裡）。
    const SUGGEST_TITLE_RE = /(為你推薦|为你推荐|推薦給你|推荐给你|推薦關注|推荐关注|推薦追蹤|推荐追踪|建議追蹤|建议追踪|建議關注|建议关注|建議用戶|建议用户|你可能感興趣|你可能感兴趣|你可能認識|你可能认识|你可能想追蹤|你可能想关注|你可能想關注|熱門帳號|热门账号|為你精選|为你精选|發現更多|发现更多|Who to follow|Suggested for you|Suggestions for you|You might like|Popular accounts|Discover more|Recommended)/i;
    // 注意：這裡刻意不放 "Followed by" —— X 在一般 UserCell 上也會顯示「被誰關注」的
    // 社交證明，放進來會把真粉絲誤判成推薦帳號（寧可漏網，不可誤排除）。
    const SUGGEST_REASON_RE = /(你關注的人也在關注|你关注的人也关注|與你有共同追蹤|与你有共同|因為你關注|因为你关注|因為您追蹤|为你推荐|為你推薦|Based on your|Suggested for you|Promoted|贊助內容|推广)/i;

    // 只查「這一列自己」的區塊標題（cell 內 + 該列的 cellInnerDiv 內）。
    // 刻意不往上爬整頁：followers 列表與推薦模組常共用同一個容器，
    // 往上找標題會連前面幾十個真粉絲一起誤判成推薦 → 寧可不抓，也不誤排除。
    function nearSuggestTitle(cell) {
        if (!cell) return false;
        const scopes = [cell, cell.parentElement];
        for (const n of scopes) {
            if (!n || !n.querySelectorAll) continue;
            let heads = null;
            try { heads = n.querySelectorAll('[role="heading"], h2, h3, [data-testid="moduleTitle"]'); }
            catch (e) { continue; }
            if (!heads || !heads.length || heads.length > 3) continue;
            for (const h of heads) {
                const t = (h.textContent || '').trim();
                if (t && t.length <= 40 && SUGGEST_TITLE_RE.test(t)) return true;
            }
        }
        return false;
    }

    function isSuggestedEntry(cell) {
        if (!cell) return false;
        try {
            const tags = cell.querySelectorAll('div, span');
            for (const t of tags) {
                const raw = (t.textContent || '').trim();
                if (!raw || raw.length > 40) continue;
                if (SUGGEST_REASON_RE.test(raw)) return true;
                if (SUGGEST_TITLE_RE.test(raw) && raw.length <= 20) return true;
            }
            if (nearSuggestTitle(cell)) return true;
        } catch (e) {}
        return false;
    }
    // 供排序模組共用（兩個 IIFE 之間唯一的橋接點，純函式、無副作用）
    try { window.__ganshaIsSuggested = isSuggestedEntry; } catch (e) {}

    // ---------- v6.8：只掃「主列表容器」內的 UserCell ----------
    // 舊版掃 primaryColumn 內所有 UserCell → 把列表尾端的推薦模組、以及其他容器的
    // 建議用戶一起算進來（他們不是粉絲，卻被當「未回跟」）。
    // 這裡與排序模組同源：找出「含最多 cellInnerDiv 的那個容器」，只處理它裡面的列。
    let cachedListRoot = null;
    function mainListCells() {
        const primary = document.querySelector('[data-testid="primaryColumn"]') || document.body;
        const sidebar = document.querySelector('[data-testid="sidebarColumn"]');
        let divs = Array.from(primary.querySelectorAll('[data-testid="cellInnerDiv"]'));
        if (sidebar) divs = divs.filter(d => !sidebar.contains(d));
        divs = divs.filter(d => d.querySelector('[data-testid="UserCell"]'));
        if (!divs.length) return [];

        const byParent = new Map();
        for (const d of divs) {
            const p = d.parentElement;
            if (!p) continue;
            if (!byParent.has(p)) byParent.set(p, []);
            byParent.get(p).push(d);
        }
        if (!byParent.size) return [];

        let root = null, best = null;
        for (const [p, list] of byParent.entries()) {
            if (!best || list.length > best.length) { best = list; root = p; }
        }
        // 容器選擇要穩定：上一輪的容器若還掛著且仍有多數列，就繼續用它（避免來回跳）
        if (cachedListRoot && cachedListRoot.isConnected) {
            const prev = byParent.get(cachedListRoot);
            if (prev && prev.length >= Math.max(2, (best ? best.length : 0) * 0.6)) root = cachedListRoot;
        }
        cachedListRoot = root || null;

        const list = byParent.get(root) || divs;
        const out = [];
        for (const d of list) {
            const c = d.querySelector('[data-testid="UserCell"]');
            if (!c) continue;
            if (c.closest('[aria-hidden="true"]')) continue;
            if (c.closest('[role="dialog"]')) continue;
            const r = c.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) out.push(c);
        }
        return out;
    }

    // 跟隨者頁「你已回跟？」——只採「按鈕已渲染」的列。
    // 回傳：1 = 已回跟（取消跟隨鈕）/ 0 = 未回跟（跟隨鈕）/ null = 尚未載完，不採計
    function readBackState(cell) {
        if (!cell) return null;
        if (cell.querySelector('[data-testid$="-unfollow"]')) return 1;
        if (cell.querySelector('[data-testid$="-follow"]')) return 0;
        const nodes = cell.querySelectorAll('[role="button"]');
        for (const b of nodes) {
            const t = (b.textContent || '').trim();
            if (!t || t.length > 14) continue;
            if (FOLLOWING_TXT_RE.test(t)) return 1;   // v6.7：已追蹤 → 不是未回跟
        }
        for (const b of nodes) {
            const t = (b.textContent || '').trim();
            if (!t || t.length > 14) continue;
            if (FOLLOW_TXT_RE.test(t)) return 0;
        }
        return null; // 動作按鈕還沒出現 → 視為骨架，等下一輪
    }

    // 跟隨中頁「能否判定互關」：取消跟隨鈕 / 互關指示 / 變體任一出現 = 載入完成
    function followingLoaded(cell) {
        if (!cell) return false;
        if (cell.querySelector('[data-testid$="-unfollow"]')) return true;
        if (cell.querySelector('[data-testid="userFollowIndicator"]')) return true;
        const v = cell.getAttribute('data-x-mutual-variant');
        if (v === 'mutual' || v === 'one_way_following') return true;
        const rs = cell.getAttribute('data-radar-scanned') || '';
        return /_(true|false)$/.test(rs);
    }

    function getUsername(cell) {
        const link = cell.querySelector('a[href^="/"]');
        if (!link) return null;
        const parts = (link.getAttribute('href') || '').split('/');
        if (parts.length < 2 || !parts[1]) return null;
        const u = parts[1].toLowerCase();
        return IGNORED_USERNAMES.has(u) ? null : u;
    }

    // ---------- v6.9：這是「誰的」列表？自己的 vs 別人的 ----------
    // 使用者的真實用法：點進別人的跟隨者列表，看看裡面有沒有值得關注的人。
    // 那些人本來就沒追你，若在別人頁面上照跑「未回跟 → 紅框」，整頁會被標成紅框
    // （v6.8 報障的真正原因），而且「推薦 · 非粉絲」這種標籤在別人頁面上也毫無意義。
    // → 別人頁面改用完全不同的口徑：只標「他有沒有追你」＋「你有沒有追過他」。
    const MY_HANDLE_KEY = 'xufr_myhandle_v1';
    let myHandleCache = '';
    function myHandle() {
        if (myHandleCache) return myHandleCache;
        try { myHandleCache = localStorage.getItem(MY_HANDLE_KEY) || ''; } catch (e) {}
        if (myHandleCache) return myHandleCache;
        let h = '';
        try {
            // 來源 1：側欄/底欄個人頭像連結 href="/你的帳號"
            const a = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
            if (a) {
                const seg = (a.getAttribute('href') || '').split('/').filter(Boolean);
                if (seg.length) h = seg[0].toLowerCase();
            }
            // 來源 2：帳號切換鈕內的 @handle 文字
            if (!h) {
                const s = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
                if (s) {
                    const m = /@([A-Za-z0-9_]{1,15})/.exec(s.textContent || '');
                    if (m) h = m[1].toLowerCase();
                }
            }
        } catch (e) {}
        if (h) {
            myHandleCache = h;
            try { localStorage.setItem(MY_HANDLE_KEY, h); } catch (e) {}
        }
        return h;
    }
    // 網址第一段就是列表主人（/xxx/followers → xxx）
    function pageOwner() {
        const seg = location.pathname.split('/').filter(Boolean);
        if (!seg.length) return null;
        const first = seg[0].toLowerCase();
        if (IGNORED_USERNAMES.has(first)) return null;
        return first;
    }
    // 抓不到（無法判斷）時一律視為「自己的」→ 維持舊行為，不會因為抓不到就把自己頁面搞壞
    function isOwnList() {
        const o = pageOwner();
        if (!o) return true;
        const me = myHandle();
        if (!me) return true;
        return o === me;
    }
    try { window.__ganshaIsOwnList = isOwnList; } catch (e) {}

    // ---------- 紅框標記（v6.7 改用 outline：不佔佈局空間，列高不變） ----------
    let FRAME_ON = true;   // v6.9：由 scanDOM 依「是否自己的列表」切換
    // 舊版用 border 會把列高撐高 4px，X 虛擬列表的 translateY 模型跟我們重寫的值對不上
    // → 相鄰列邊框疊加混亂、捲動時跳動。outline 完全不影響盒模型。
    function frameCell(cell, strong) {
        // v6.9：紅框只畫在「自己的」列表上。逛別人的關注／跟隨者列表是為了找人，
        // 整頁紅框沒有意義，也沒有任何需要處理的異常 → 一律不畫。
        if (!FRAME_ON) return;
        cell.style.outline = '2px solid #e0245e';
        cell.style.outlineOffset = '-2px';
        cell.style.backgroundColor = strong ? 'rgba(224, 36, 94, 0.07)' : 'rgba(224, 36, 94, 0.05)';
        cell.style.borderRadius = '16px';
    }

    // ---------- 徽章 ----------
    function appendBadge(cell, username, badge) {
        // 同類標籤已存在就不再插（防重複疊加）
        try {
            const kind = badge.dataset && badge.dataset.radarTag;
            if (kind && cell.querySelector('.x-radar-badge-cell[data-radar-tag="' + kind + '"]')) return;
        } catch (e) {}
        const textDivs = cell.querySelectorAll('span');
        let inserted = false;
        for (let t of textDivs) {
            if (t.textContent.toLowerCase() === '@' + username) {
                if (t.parentElement) {
                    t.parentElement.appendChild(badge);
                    inserted = true;
                }
                break;
            }
        }
        if (!inserted) cell.appendChild(badge);
    }

    // 狀態標籤：notback=未回關(粉紅) / mutual=互關(綠) / backed=已回跟(綠) / notbacked=未回跟(灰)
    function makeTag(kind, days) {
        const b = document.createElement('div');
        b.className = 'x-radar-badge-cell';
        b.dataset.radarTag = kind;
        let txt, css;
        // v6.7：限高 18px、line-height 16px → 徽章不會把列撐高（列高一變，X 虛擬列表的
        // translateY 模型就跟我們重寫的值對不上 → 邊框疊加/重疊混亂）
        const base = 'font-size: 12px; font-weight: 600; padding: 0 10px; height: 18px; line-height: 16px; ' +
                     'box-sizing: border-box; align-items: center; border-radius: 999px; margin-left: 8px; ' +
                     'display: inline-flex; white-space: nowrap;';
        if (kind === 'notback') {
            txt = '未回關 · ' + fmtDays(days);
            css = 'color: #f91880; border: 1px solid #f91880; background: #fff;';
        } else if (kind === 'unf') {
            // 第二參數作模式用：'new' = 本次剛偵測到；其餘為日期字串（M/D）
            txt = (days === 'new') ? i18n.unfNew : (i18n.unfPast + ' · ' + (days || ''));
            css = 'color: #fff; border: 1px solid #e0245e; background: #e0245e;';
        } else if (kind === 'mutual') {
            txt = '互關';
            css = 'color: #00a06a; border: 1px solid #7fe0c0; background: #f0fbf6;';
        } else if (kind === 'backed') {
            txt = '已回跟';
            css = 'color: #00a06a; border: 1px solid #7fe0c0; background: #f0fbf6;';
        } else if (kind === 'followsyou') {
            // v6.9：在別人的列表裡，他已經追你 → 這才是值得你回關的訊號
            txt = i18n.followsYouTag;
            css = 'color: #00a06a; border: 1px solid #00a06a; background: #f0fbf6;';
        } else if (kind === 'tracked') {
            // v6.9：你已經追過他了（避免重複點）
            txt = i18n.trackedByMe;
            css = 'color: #00a06a; border: 1px solid #7fe0c0; background: #f0fbf6;';
        } else if (kind === 'suggest') {
            // v6.8：X 自己插入的推薦帳號（不是粉絲）→ 灰標，讓你知道為什麼這列沒被算進去
            txt = i18n.suggest;
            css = 'color: #8b98a5; border: 1px dashed #cfd9de; background: #f7f9f9;';
        } else {
            txt = '未回跟';
            css = 'color: #8b98a5; border: 1px solid #cfd9de; background: #fff;';
        }
        b.innerText = txt;
        b.style.cssText = css + base;
        return b;
    }

    // 清除某格可能殘留的雷達視覺標記（全部清除，不只第一個）
    function clearCellVisual(cell) {
        try {
            cell.querySelectorAll('.x-radar-badge-cell').forEach(n => n.remove());
        } catch (e) {}
        cell.style.outline = '';
        cell.style.outlineOffset = '';
        cell.style.border = '';       // 清舊版殘留
        cell.style.backgroundColor = '';
        cell.style.borderRadius = '';
    }

    // ---------- 互關快取（命中長快取 5 分鐘；未命中只 8 秒 → 內容分批載入後會重掃） ----------
    function cellFollowedBy(cell) {
        if (cell.querySelector('[data-testid="userFollowIndicator"]')) return true;
        const v = cell.getAttribute && cell.getAttribute('data-x-mutual-variant');
        if (v === 'mutual') return true;
        if (v === 'one_way_following') return false;

        const now = Date.now();
        const at = cell.dataset.radarKwAt;
        if (at) {
            const age = now - (+at);
            if (age < 300000 && cell.dataset.radarKw === '1') return true;  // 命中：長快取 5 分鐘
            if (age < 8000 && cell.dataset.radarKw === '0') return false;   // 未命中：只短快取 8 秒
        }
        let hit = false;
        const tags = cell.querySelectorAll('div, span, a');
        for (let tag of tags) {
            const raw = (tag.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
            if (!raw || raw.length > 40) continue;
            const lower = raw.toLowerCase();
            if (followsYouKeywords.some(kw => lower.includes(kw))) { hit = true; break; }
        }
        cell.dataset.radarKw = hit ? '1' : '0';
        cell.dataset.radarKwAt = String(now);
        return hit;
    }

    // ---------- 主掃描（每 1.2s）：累計 + 視覺標記 ----------
    function scanDOM() {
        const p = window.location.pathname;
        const isFol = p.endsWith('/following');
        const isFers = p.endsWith('/followers');
        if (!isFol && !isFers) {
            if (statsPanel) statsPanel.style.display = 'none';
            return;
        }
        if (statsPanel) statsPanel.style.display = 'block';

        // 換頁（含換到別人的同名清單）→ 重新累計
        if (accPath !== p) {
            accPath = p; acc.clear(); sugSeen.clear(); accZeroStreak = 0; lastKey = '';
            othersSeen.clear(); othersFY.clear(); othersTracked.clear();
        }

        const ownList = isOwnList();
        FRAME_ON = ownList;   // v6.9：別人的列表不畫紅框

        // v6.8：優先只取主列表容器的列（排除推薦模組／側欄建議／彈窗）；取不到再退回全頁掃描
        let cells = mainListCells();
        if (!cells.length) cells = visibleCellsOnPage();

        // v6.5 block 校正：被拉黑的帳號 X 會把他從跟隨/跟隨者列表移除，但 acc 是「只增不減」
        // 累計（防捲動倒退），block 又不觸發整列重建 → 殘留造成數字不扣。偵測拉黑動作後，
        // 若該帳號已不在任何可見列（＝被移除），就從累計剔除。
        if (pendingBlocks.size) {
            const domUsers = new Set();
            for (const c of cells) { const u = getUsername(c); if (u) domUsers.add(u); }
            pendingBlocks.forEach((deadline, user) => {
                if (Date.now() > deadline) { pendingBlocks.delete(user); return; } // 期限到還在 → 沒真的拉黑（取消），放棄
                if (!domUsers.has(user)) { acc.delete(user); pendingBlocks.delete(user); } // 確認已從列表消失 → 扣除
            });
        }

        // X 清空重建列表（連續兩輪 0 列）→ 清掉上一輪，避免混入已移除帳號
        if (acc.size && !cells.length) {
            accZeroStreak++;
            if (accZeroStreak >= 2) { acc.clear(); accZeroStreak = 0; lastKey = ''; }
        } else {
            accZeroStreak = 0;
        }

        cells.forEach(cell => {
            const username = getUsername(cell);
            if (!username) return;

            if (isFers) {
                // v6.9：別人的跟隨者列表 → 換一套口徑（這裡的人本來就不是你的粉絲）
                if (!ownList) {
                    const stO = readBackState(cell);   // 1 = 你已追他 / 0 = 你沒追他
                    if (stO === null) return;
                    const fb = cellFollowedBy(cell);   // 他有沒有追你（X 會顯示「關注了你」）
                    const mode = fb
                        ? (stO === 1 ? 'o_mutual' : 'o_fy')
                        : (stO === 1 ? 'o_tracked' : 'o_none');
                    const ckO = 'other_' + mode;
                    othersSeen.add(username);
                    if (fb) othersFY.add(username);
                    if (stO === 1) othersTracked.add(username);
                    if (cell.dataset.radarScanned === ckO) return;
                    cell.dataset.radarScanned = ckO;
                    clearCellVisual(cell);
                    if (mode === 'o_mutual') appendBadge(cell, username, makeTag('mutual'));
                    else if (mode === 'o_fy') appendBadge(cell, username, makeTag('followsyou'));
                    else if (mode === 'o_tracked') appendBadge(cell, username, makeTag('tracked'));
                    // o_none：沒追你、你也没追 → 完全不標。你就是來找這種人的，標了只是噪音。
                    return;
                }
                // v6.8：推薦／建議帳號（根本沒追你）→ 不打紅框、不算未回跟、只標灰徽章
                if (isSuggestedEntry(cell)) {
                    sugSeen.add(username);
                    if (cell.dataset.radarScanned === 'fers_sug') return;
                    cell.dataset.radarScanned = 'fers_sug';
                    clearCellVisual(cell);
                    appendBadge(cell, username, makeTag('suggest'));
                    return;
                }
                // 跟隨者頁：未回跟 = 你沒追蹤他。只採「按鈕已渲染」的列
                const st = readBackState(cell);
                if (st === null) return;
                acc.set(username, st);

                // v6.7 穩定確認：同一狀態需連續觀測到 2 次才上色。
                // X 的按鈕是分批渲染的，首輪可能只看到「跟隨」鈕（其實你已回跟），
                // 當下就上紅框會造成誤標。等一次掃描確認即可完全避免。
                if (cell.dataset.radarStUser !== username) {
                    cell.dataset.radarStUser = username;
                    cell.dataset.radarSt = String(st);
                    cell.dataset.radarStN = '1';
                    cell.dataset.radarStTot = '1';
                } else {
                    const same = cell.dataset.radarSt === String(st);
                    cell.dataset.radarSt = String(st);
                    cell.dataset.radarStN = same ? String((+cell.dataset.radarStN || 0) + 1) : '1';
                    cell.dataset.radarStTot = String((+cell.dataset.radarStTot || 0) + 1);
                }
                if ((+cell.dataset.radarStN || 0) < 2 && (+cell.dataset.radarStTot || 0) < 6) return;

                // v6.6：此人若曾在跟隨中頁被偵測到「取關過我」，此頁一併標示
                const unfDateF = unfLog[username] || null;
                const ck = 'fers_' + st + '_' + (unfDateF || '');
                if (cell.dataset.radarScanned === ck) return;
                cell.dataset.radarScanned = ck;
                clearCellVisual(cell);

                if (st === 1) {
                    // 已回跟：綠標，絕不畫紅框（紅框只保留給真正的「未回跟」）
                    appendBadge(cell, username, makeTag('backed'));
                    if (unfDateF) {
                        const pf = unfDateF.split('-');
                        const mdF = pf.length === 3 ? (+pf[1]) + '/' + (+pf[2]) : unfDateF;
                        appendBadge(cell, username, makeTag('unf', mdF));
                    }
                    return;
                }

                // 未回跟 → 紅框圈起來（與 following 頁未回關同款視覺語言）
                frameCell(cell, !!unfDateF);
                if (unfDateF) {
                    const pf = unfDateF.split('-');
                    const mdF = pf.length === 3 ? (+pf[1]) + '/' + (+pf[2]) : unfDateF;
                    appendBadge(cell, username, makeTag('unf', mdF));
                } else {
                    appendBadge(cell, username, makeTag('notbacked'));
                }
                return;
            }

            // ----- following 頁：未回關雷達（每列都標狀態） -----
            const followBtn = cell.querySelector('[data-testid$="-unfollow"]');
            const isFollowing = !!followBtn;
            if (!isFollowing) return;             // 非跟隨中列表正常列 → 不採
            if (!followingLoaded(cell)) return;   // 未載完 → 等下一輪再判

            const isFollowedBy = cellFollowedBy(cell);
            acc.set(username, isFollowedBy ? 1 : 0);

            // v6.6 取關偵測：比對上次觀測狀態（須持續 30 分鐘才確認，避免指示器延遲渲染誤判）
            const unfEvt = detectUnfollow(username, isFollowedBy);
            const unfDate = unfLog[username] || null;

            const fullKey = username + '_' + isFollowing + '_' + isFollowedBy + '_' + (unfDate || '');
            if (cell.dataset.radarScanned === fullKey) return; // 視覺已處理過

            clearCellVisual(cell);
            cell.dataset.radarScanned = fullKey;

            if (isFollowedBy && store[username]) { delete store[username]; saveStore(); }

            // 取關紀錄優先顯示：他追過你又跑掉，比單純「未回關」更值得注意
            if (unfDate) {
                frameCell(cell, true);
                const pp = unfDate.split('-');
                const mdTxt = pp.length === 3 ? (+pp[1]) + '/' + (+pp[2]) : unfDate;
                appendBadge(cell, username, makeTag('unf', unfEvt === 'new' ? 'new' : mdTxt));
                return;
            }

            if (isFollowedBy) {
                appendBadge(cell, username, makeTag('mutual'));
                return;
            }

            if (!store[username]) {
                store[username] = todayStr();
                saveStore();
            }
            frameCell(cell, false);
            appendBadge(cell, username, makeTag('notback', daysSince(store[username])));
        });

        // 統計：以不重複累計為準（只增不減；分類以最新狀態覆蓋）
        // v6.9：別人的跟隨者列表 → 改以「他有沒有追你」為主統計，不看未回跟
        if (isFers && !ownList) {
            // v6.10：同時準備可點開的名單（關注你的排前，你已追蹤的附在後）
            const oRows = [];
            othersFY.forEach(u => oRows.push({ u: u, note: i18n.followsYouTag }));
            othersTracked.forEach(u => { if (!othersFY.has(u)) oRows.push({ u: u, note: i18n.trackedByMe }); });
            setSnapshot(i18n.followsYou + i18n.listTitleSuffix + ' · ' + othersFY.size,
                i18n.listNoteOthers, oRows, i18n.listEmpty);
            updateStats(i18n.followsYou, othersFY.size,
                i18n.total + ' ' + othersSeen.size +
                ' · ' + i18n.trackedByMe + ' ' + othersTracked.size +
                ' · ' + i18n.othersList);
            return;
        }
        if (!acc.size) {
            setSnapshot((isFers ? i18n.notBack : i18n.found) + i18n.listTitleSuffix + ' · 0',
                i18n.listNoteOwn, [], i18n.listEmpty);
            updateStats(isFers ? i18n.notBack : i18n.found, 0, i18n.total + ' 0');
            return;
        }
        let backed = 0;
        acc.forEach(v => { if (v === 1) backed++; });
        const seen = acc.size;
        // v6.10：未回關／未回跟名單（含已監測天數，最久的排最前，與頁面上的排序一致）
        const pendingRows = [];
        acc.forEach((v, u) => { if (v !== 1) pendingRows.push({ u: u, d: store[u] ? daysSince(store[u]) : 0 }); });
        pendingRows.sort((a, b) => b.d - a.d);
        const rowsForModal = pendingRows.map(r => ({ u: r.u, note: fmtDays(r.d) }));
        if (isFers) {
            const ex = sugSeen.size ? ' · ' + i18n.excluded + ' ' + sugSeen.size : '';
            setSnapshot(i18n.notBack + i18n.listTitleSuffix + ' · ' + pendingRows.length,
                i18n.listNoteOwn, rowsForModal, i18n.listEmpty);
            updateStats(i18n.notBack, seen - backed,
                i18n.total + ' ' + seen + ' · ' + i18n.backed + ' ' + backed + ex);
        } else {
            setSnapshot(i18n.found + i18n.listTitleSuffix + ' · ' + pendingRows.length,
                i18n.listNoteOwn, rowsForModal, i18n.listEmpty);
            updateStats(i18n.found, seen - backed,
                i18n.total + ' ' + seen + ' · ' + i18n.mutual + ' ' + backed);
        }
    }

    // ---------- v6.5 block 校正偵聽 ----------
    // 拉黑（封鎖）後 X 會把對方從列表移除，但「只增不減」累計不會扣 → 數字失真。
    // 偵測「封鎖」選單/確認鈕點擊 → 記下該帳號，之後每輪掃描確認他真的從列表消失就剔除；
    // 若 15 秒內仍在（＝使用者取消封鎖）則放棄，acc 不動。
    const pendingBlocks = new Map(); // username -> 驗證期限(ms)
    const BLOCK_ACT_RE = /(^|\s)(block|封鎖|拉黑|ブロック|차단|bloquear|bloqueer|bloqueia|sperren|blokkeren|bloccare|blocca)(\s|@|$)/i;
    document.addEventListener('click', (ev) => {
        const el = ev.target;
        if (!el || !el.closest) return;
        const item = el.closest('[role="menuitem"], [data-testid="confirmationSheetConfirm"]');
        if (!item) return;
        const txt = (item.textContent || '').trim();
        if (!BLOCK_ACT_RE.test(txt)) return;
        let user = null;
        const m = txt.match(/@([A-Za-z0-9_]{1,15})/);
        if (m) user = m[1].toLowerCase();
        if (!user) {
            const cell = item.closest('[data-testid="UserCell"]');
            if (cell) user = getUsername(cell);
        }
        if (!user) return;
        pendingBlocks.set(user, Date.now() + 15000);
    }, true);

    setInterval(scanDOM, 1200);
})();

// =====================================================================
// 排序模組 v4.1（v5.7）——追加功能，原雷達邏輯保留
// 行為：
//   跟隨中頁  /following  -> 未回關(單向) 排最前、已回關(互關) 排最後
//   跟隨者頁  /followers -> 未回跟 排最前、已回跟 排最後
//
// 已知結構（使用者實測提供）：
//   X 的跟隨/跟隨者清單 =
//     容器 div(position:relative; min-height:Npx)
//       └ cellInnerDiv ×N  (position:absolute; transform:translateY(Ypx))
//           └ UserCell
//   畫面位置由 translateY 決定、與 DOM 順序無關
//   → 排序必須「重掛 DOM 順序 + 依高度重寫一次 translateY」。
//
// v5.7 核心策略（針對「往下拉刷新→中間大面積空白/列消失/卡頓」根治）：
//   1) 排序只在「列表頂部」執行：掛載列的最小 translateY 須 ≈0（列 0..N 連續片段）
//      才允許重掛 + 從 0 累加重寫 translateY（與 X 引擎的位置模型一致，安全）。
//   2) 一旦捲離頂部（深處載入中）→ 完全不碰 DOM / translateY，把捲動 100% 交給 X，
//      不再與 X 的虛擬列表回收打架 → 不再出現空白、列消失、卡頓。
//   3) 回到頂部並靜止時，自動重新套用排序（把可見的未互關集中到最前）。
//   4) 只採「已載入完成」的列做判定（骨架列回傳 null），就緒率不足就延後，避免誤排。
//   5) 防打架：重掛後鎖定 + 12 秒內重掛 ≥4 次 → 暫停 20 秒。
// 合規：純客戶端顯示層調整，無 API 呼叫、無自動跟隨/取消跟隨。
// =====================================================================
(function() {
    'use strict';

    const SORT_KEYWORDS = [
        'follows you', 'follows you back',
        '关注了你', '关注你', '已关注', '正在关注你',
        '關注了你', '關注你', '已關注', '正在關注你',
        '跟隨了你', '跟随了你', '跟隨你', '跟随你', '正在跟隨你', '正在跟随你',
        '追隨了你', '追随了你', '追隨你', '追随你', '正在追隨你', '正在追随你',
        '互相追隨', '互相追随', '互相跟隨', '互相跟随', '跟你互相追隨', '跟你互相追随',
        'フォローされています', '나를 팔로우합니다', 'te sigue', 'vous suit',
        'folgt dir', 'segue você', 'ti segue', 'يتابعك'
    ];

    const KW_HIT_MS = 300000;     // 關鍵詞「命中」結果有效 5 分鐘
    const KW_MISS_MS = 8000;      // 未命中只短快取 8 秒（內容分批載入，稍後重掃校正）
    const SETTLE_MS = 400;        // X 連續變動後需靜止多久才允許重掛
    const REBUILD_GAP_MS = 2000;  // 兩次「重掛 DOM」最短間隔
    const LOCK_MS = 4000;         // 重掛後的鎖定期：完全不動作
    const FREEZE_MS = 8000;       // 使用者點了跟隨/取消跟隨 → 凍結排序 8 秒（防列在手下跳走）
    const READY_RATIO = 0.6;      // 就緒率門檻（可判定的列佔比）
    const TOP_MIN_Y = 60;         // 掛載列最小 translateY ≤ 此值才視為「列表頂部」
    const TOP_MIN_Y_LOW = -80;    // 允許小幅負值 overscan

    let currentPath = null;
    let pageLoadAt = 0;
    function getPageType() {
        const p = location.pathname;
        let t = null;
        if (p.endsWith('/following')) t = 'following:' + p;
        else if (p.endsWith('/followers')) t = 'followers:' + p;
        if (t !== currentPath) { currentPath = t; pageLoadAt = Date.now(); }
        return t;
    }
    function getCell(row) {
        return (row.querySelector && row.querySelector('[data-testid="UserCell"]')) || null;
    }
    function rowUser(row) {
        const cell = getCell(row);
        if (!cell) return '?';
        const a = cell.querySelector('a[href^="/"]');
        if (!a) return '?';
        const seg = (a.getAttribute('href') || '').split('/').filter(Boolean);
        return seg.length ? seg[0] : '?';
    }

    // ---- 主列表 rows：primaryColumn 內、含 UserCell 的可見 cellInnerDiv ----
    function getRows() {
        const primary = document.querySelector('[data-testid="primaryColumn"]') || document.querySelector('main');
        if (!primary) return [];
        const sidebar = document.querySelector('[data-testid="sidebarColumn"]');
        let divs = Array.from(primary.querySelectorAll('[data-testid="cellInnerDiv"]'));
        if (sidebar) divs = divs.filter(d => !sidebar.contains(d));
        divs = divs.filter(d => {
            if (!d.querySelector('[data-testid="UserCell"]')) return false;
            if (d.closest && d.closest('[aria-hidden="true"]')) return false;
            const r = d.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        });
        if (!divs.length) return [];

        const byParent = new Map();
        for (const d of divs) {
            const p = d.parentElement;
            if (!p) continue;
            if (!byParent.has(p)) byParent.set(p, []);
            byParent.get(p).push(d);
        }
        let best = null;
        for (const list of byParent.values()) {
            if (!best || list.length > best.length) best = list;
        }
        return best || [];
    }

    // ---- 互關判定（快通道；回傳 true/false/null=未就緒） ----
    function fastMutualThem(cell) {
        if (!cell) return null;
        const rs = cell.getAttribute && cell.getAttribute('data-radar-scanned');
        if (rs) {
            const seg = rs.split('_');
            const last = seg[seg.length - 1];
            if (last === 'true') return true;
            if (last === 'false') return false;
        }
        if (cell.querySelector('[data-testid="userFollowIndicator"]')) return true;
        const v = cell.getAttribute && cell.getAttribute('data-x-mutual-variant');
        if (v === 'mutual') return true;
        if (v === 'one_way_following') return false;
        return null;
    }
    function kwMutualThem(cell) {
        if (!cell) return false;
        const now = Date.now();
        const at = cell.dataset.radarKwAt;
        if (at) {
            const age = now - (+at);
            if (age < KW_HIT_MS && cell.dataset.radarKw === '1') return true;  // 命中：長快取
            if (age < KW_MISS_MS && cell.dataset.radarKw === '0') return false; // 未命中：短快取
        }
        let hit = false;
        const tags = cell.querySelectorAll('div, span, a');
        for (const tag of tags) {
            const raw = (tag.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
            if (!raw || raw.length > 40) continue;
            const lower = raw.toLowerCase();
            if (SORT_KEYWORDS.some(kw => lower.includes(kw))) { hit = true; break; }
        }
        cell.dataset.radarKw = hit ? '1' : '0';
        cell.dataset.radarKwAt = String(now);
        return hit;
    }

    // 該列在 /following 是否已載入完成
    function rowLoadedFollowing(cell) {
        if (!cell) return false;
        if (cell.querySelector('[data-testid$="-unfollow"]')) return true;
        if (cell.querySelector('[data-testid="userFollowIndicator"]')) return true;
        const v = cell.getAttribute('data-x-mutual-variant');
        if (v === 'mutual' || v === 'one_way_following') return true;
        const rs = cell.getAttribute('data-radar-scanned') || '';
        return /_(true|false)$/.test(rs);
    }
    // 該列在 /followers 是否已載入完成（有跟隨/取消跟隨任一按鈕或文字）
    function rowLoadedFollowers(cell) {
        if (!cell) return false;
        if (cell.querySelector('[data-testid$="-unfollow"]')) return true;
        if (cell.querySelector('[data-testid$="-follow"]')) return true;
        const nodes = cell.querySelectorAll('[role="button"]');
        for (const b of nodes) {
            const t = (b.textContent || '').trim();
            if (!t || t.length > 14) continue;
            if (/^(跟隨|追随|关注|關注|Follow|フォロー|Seguir|Suivre|Følg|Следить|Takip|Ikuti)/.test(t)) return true;
        }
        return false;
    }

    // v6.7：「我已經在追蹤他」的按鈕文字（與雷達端一致，避免把已回跟誤判成未回跟）
    const FOLLOWING_TXT_RE = /^(正在跟隨|跟隨中|已跟隨|正在關注|關注中|已關注|正在追隨|追隨中|已追蹤|追蹤中|Following|フォロー中|フォロー済み|Siguiendo|Suivre|Abonné)/i;

    // 分類：回傳 'front'（未互關/未回跟，應排前）| 'back'（互關/已回跟）| null（未就緒）
    function cellClass(cell, page) {
        if (!cell) return null;
        const isFers = page.indexOf('followers:') === 0;
        if (isFers) {
            if (!rowLoadedFollowers(cell)) return null;
            // v6.9：別人的跟隨者列表 → 排序改以「他有沒有追你」為準。
            // 你在別人列表裡要找的是「值得關注的人」，而最值得回關的就是已經追你的人 → 排最前。
            let own = true;
            try {
                if (typeof window.__ganshaIsOwnList === 'function') own = window.__ganshaIsOwnList();
            } catch (e) {}
            if (!own) {
                const fm = fastMutualThem(cell);
                if (fm !== null) return fm ? 'front' : 'back';
                return kwMutualThem(cell) ? 'front' : 'back';
            }
            // v6.8：推薦／建議帳號（不是粉絲）一律排到最後，不混進「未回跟」前段
            try {
                if (typeof window.__ganshaIsSuggested === 'function' && window.__ganshaIsSuggested(cell)) return 'back';
            } catch (e) {}
            if (cell.querySelector('[data-testid$="-unfollow"]')) return 'back'; // 已回跟
            // v6.7：按鈕若渲染成「關注中／已關注」等變體（無 testid），也算已回跟
            for (const b of cell.querySelectorAll('[role="button"]')) {
                const t = (b.textContent || '').trim();
                if (t && t.length <= 14 && FOLLOWING_TXT_RE.test(t)) return 'back';
            }
            return 'front'; // 已載入且有跟隨鈕 → 未回跟
        }
        // following
        if (!rowLoadedFollowing(cell)) return null;
        const fm = fastMutualThem(cell);
        if (fm !== null) return fm ? 'back' : 'front';
        return kwMutualThem(cell) ? 'back' : 'front';
    }

    function rowY(row) {
        const m = /translateY\((-?[\d.]+)px\)/.exec(row.style.transform || '');
        return m ? parseFloat(m[1]) : 0;
    }
    function isAbs(row) {
        try { return getComputedStyle(row).position === 'absolute'; } catch (e) { return false; }
    }

    // 是否「列表頂部」：掛載列最小 translateY ≈ 0（列 0..N 的連續片段）
    function isTopOfList(rows) {
        let minY = Infinity;
        for (const r of rows) {
            const y = rowY(r);
            if (y < minY) minY = y;
        }
        return minY >= TOP_MIN_Y_LOW && minY <= TOP_MIN_Y;
    }

    // 頁面實際捲動距離（＞0 = 使用者停在列表深處 / 正在往下載入 → 絕不重排）
    function scrollDrift() {
        try {
            const se = document.scrollingElement;
            if (se && se.scrollTop > 25) return se.scrollTop;
            const pc = document.querySelector('[data-testid="primaryColumn"]');
            if (pc && pc.scrollTop > 25) return pc.scrollTop;
        } catch (e) {}
        return 0;
    }

    // 依 DOM 順序從 0 累加高度、重寫每格 translateY（只允許頂部時呼叫）
    function ensureY(ordered) {
        const plan = [];
        let y = 0;
        for (const r of ordered) {
            const h = r.offsetHeight || 0;
            if (h <= 0) return false;   // 高度還沒量到（正在載入）→ 放棄本次重寫，避免算出錯位
            plan.push({ r: r, want: Math.round(y) });
            y += h;
        }
        let changed = false;
        for (const p of plan) {
            if (Math.abs(rowY(p.r) - p.want) > 3) {
                p.r.style.transform = 'translateY(' + p.want + 'px)';
                changed = true;
            }
        }
        return changed;
    }

    let rebuildCount = 0;
    let lastRebuildAt = 0;
    let lastMutAt = 0;
    let lockUntil = 0;
    let pausedUntil = 0;
    let pausedWarned = false;
    const rebuildTimes = [];

    function doSort(page) {
        const now = Date.now();
        if (now < pausedUntil) return;          // 暫停中（X 持續還原）
        if (now < lockUntil) return;            // 剛重掛完鎖定期：不動作
        if (now - lastMutAt < SETTLE_MS) return; // X 還在變動

        // X 的「取消跟隨？」確認彈窗開著時絕不重排（這時搬 DOM 畫面一定跳）
        try {
            if (document.querySelector('[data-testid="confirmationSheetDialog"]')) return;
        } catch (e) {}

        const rows = getRows();
        if (rows.length < 2) return;
        const container = rows[0].parentElement;
        if (!container) return;

        // ★ 核心：只允許「列表頂部」重排。深處載入期間完全不碰 DOM（防空白/消失/卡頓）
        if (!isTopOfList(rows)) return;
        if (scrollDrift() > 25) return;   // 頁面已捲離頂部（載入中）→ 完全不動

        // 就緒率：太多列還不能判定 → 等雷達/內容載入後再排
        if (rows.length >= 10) {
            let ready = 0;
            for (const r of rows) {
                const c = getCell(r);
                const loaded = page.indexOf('followers:') === 0
                    ? rowLoadedFollowers(c)
                    : rowLoadedFollowing(c);
                if (loaded) ready++;
            }
            if (ready / rows.length < READY_RATIO) {
                schedule(page, 600);
                return;
            }
        }

        const fronts = [], backs = [];
        for (const r of rows) {
            const cls = cellClass(getCell(r), page);
            (cls === 'front' ? fronts : backs).push(r); // null 視為 back，不誤放前面
        }
        const ordered = fronts.concat(backs);

        // DOM 順序是否已是「前段全部在前」——是就完全不動 translateY
        let domOk = rows.length === ordered.length;
        if (domOk) {
            for (let i = 0; i < rows.length; i++) {
                if (rows[i] !== ordered[i]) { domOk = false; break; }
            }
        }
        if (domOk) return;

        if (now - lastRebuildAt < REBUILD_GAP_MS) return; // 重掛太密 → 跳過

        // 防無限打架：短時間內重掛多次代表 X 持續還原 → 暫停自動重排
        rebuildTimes.push(now);
        while (rebuildTimes.length && now - rebuildTimes[0] > 12000) rebuildTimes.shift();
        if (rebuildTimes.length >= 4) {
            pausedUntil = now + 20000;
            pausedWarned = false;
            return;
        }
        if (!pausedWarned) { pausedWarned = true; }

        lastRebuildAt = now;
        lockUntil = now + LOCK_MS;

        // 一次搬移完成重排
        const frag = document.createDocumentFragment();
        for (const r of ordered) frag.appendChild(r);
        container.insertBefore(frag, container.firstChild);

        let yMoved = false;
        const absMode = rows.every(isAbs);
        if (absMode) {
            try { yMoved = ensureY(ordered); } catch (e) {}
        }
        rebuildCount++;
        try {
            console.log('[排序6.9] ' + page + ' 重排#' + rebuildCount +
                ' · 列=' + rows.length + ' · 前=' + fronts.length + '/後=' + backs.length +
                ' · 首=' + rowUser(ordered[0]) +
                (absMode ? ' · [Y]' + (yMoved ? '已修' : '') : ' · [flow]'));
        } catch (e) {}
    }

    // ---- 觸發（debounce + settle gate） ----
    let pendT = null;
    let scrollT = null;
    let obs = null;

    function schedule(page, delay) {
        if (pendT) return;
        pendT = setTimeout(() => {
            pendT = null;
            const cur = getPageType();
            if (!cur) return;
            if (Date.now() - lastMutAt < SETTLE_MS) {
                schedule(cur, 500);
                return;
            }
            try { doSort(cur); } catch (e) { try { console.log('[排序6.9] 錯誤', e); } catch (_) {} }
        }, delay);
    }

    function start() {
        const page = getPageType();
        if (!page) { setTimeout(start, 1000); return; }
        const rows = getRows();
        if (!rows.length) { setTimeout(start, 1000); return; }

        const container = rows[0].parentElement;
        if (container) {
            obs = new MutationObserver(() => {
                lastMutAt = Date.now();
                schedule(getPageType() || page, 350);
            });
            obs.observe(container, { childList: true, subtree: true });
        }

        // 捲動停止後檢查一次（只在頂部時會真的重排；深處只會輕量 return）
        window.addEventListener('scroll', () => {
            if (scrollT) clearTimeout(scrollT);
            scrollT = setTimeout(() => {
                const p = getPageType();
                if (p) schedule(p, 200);
            }, 200);
        }, { passive: true });

        // v6.7：使用者點「跟隨 / 取消跟隨 / 回關」→ 凍結排序 8 秒。
        // 舊版一按下，該列狀態變了就立刻被我們搬到後段 → 畫面在手下跳走（使用者回報的跳動）。
        const FOLLOW_BTN_RE = /(跟隨|取消跟隨|正在跟隨|關注|取消關注|正在關注|已關注|追蹤|Follow|Following|Unfollow|フォロー)/i;
        document.addEventListener('click', (ev) => {
            const el = ev.target;
            if (!el || !el.closest) return;
            const cell = el.closest('[data-testid="UserCell"]');
            if (!cell) return;
            let isFollowBtn = !!el.closest('[data-testid$="-follow"], [data-testid$="-unfollow"]');
            if (!isFollowBtn) {
                const b = el.closest('[role="button"]');
                if (b && b !== cell) {
                    const t = (b.textContent || '').trim();
                    if (t && t.length <= 14 && FOLLOW_BTN_RE.test(t)) isFollowBtn = true;
                }
            }
            if (!isFollowBtn) return;
            const now = Date.now();
            lockUntil = now + FREEZE_MS;
            lastRebuildAt = now;
            lastMutAt = now;
            try { console.log('[排序6.9] 偵測到跟隨操作 → 凍結排序 ' + (FREEZE_MS / 1000) + ' 秒'); } catch (e) {}
        }, true);

        // 兜底：換頁 / observer 漏接時仍會檢查
        setInterval(() => {
            const p = getPageType();
            if (p) schedule(p, 200);
        }, 2000);

        schedule(page, 300);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(start, 800));
    } else {
        setTimeout(start, 800);
    }
})();
