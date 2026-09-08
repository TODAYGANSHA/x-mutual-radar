// ==UserScript==
// @name         GANSHA · X Mutual Radar
// @namespace    http://tampermonkey.net/
// @version      6.5
// @description  [GANSHA 6.5] X 互關雷達（@todaygansha）：高亮未回關/未回跟帳號 + 首次發現日期追蹤 + 列表排序（未互關排最前）。v6.5：拉黑(封鎖)校正——偵測封鎖動作，確認對方從列表消失後自統計剔除，修「只增不減」累計下封鎖不扣數的失真。v6.4：following 未回關紅框統一為實線；頁腳品牌加 𝕏。v6.3：followers 未回跟紅框。v6.2：檔名英文化；全中文顯示；下拉載入空白收緊「頂部才重排」判定。v6.0：GANSHA RADAR LOGO。
// @author       You
// @match        *://x.com/*
// @match        *://twitter.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

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
        backed: '已回跟'
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
            '<div style="margin-top:5px">' + (label || i18n.found) + ': <b style="font-size:15px">' + count + '</b></div>' +
            (diag ? '<div style="opacity:.7;font-size:11px;margin-top:2px">' + diag + '</div>' : '') +
            '<div style="opacity:.45;font-size:10px;margin-top:5px;padding-top:3px;border-top:1px solid rgba(255,255,255,.18)">' +
            i18n.brandTag + ' · v6.5</div>';
    }

    // ---------- 不重複累計帳號（username → 0/1） ----------
    // 0 = 未回關 / 未回跟（應排最前）；1 = 互關 / 已回跟
    // X 虛擬列表會回收離開畫面的 DOM → 舊版每輪只算「當下可見」造成數字倒退；
    // v5.7 改：帳號掃過一次就進 Map、只增不減，狀態以最新掃描覆蓋。
    const acc = new Map();
    let accPath = '';        // 目前累計的頁面（完整 pathname）
    let accZeroStreak = 0;   // 連續幾輪「0 列可見」→ 判斷 X 清空重建

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
            if (/^(跟隨|追随|关注|關注|Follow|フォロー|Seguir|Suivre|Følg|Следить|Takip|Ikuti)/.test(t)) return 0;
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

    // ---------- 徽章 ----------
    function appendBadge(cell, username, badge) {
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
        let txt, css;
        const base = 'font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 999px; margin-left: 8px; display: inline-flex; white-space: nowrap;';
        if (kind === 'notback') {
            txt = '未回關 · ' + fmtDays(days);
            css = 'color: #f91880; border: 1px solid #f91880; background: #fff;';
        } else if (kind === 'mutual') {
            txt = '互關';
            css = 'color: #00a06a; border: 1px solid #7fe0c0; background: #f0fbf6;';
        } else if (kind === 'backed') {
            txt = '已回跟';
            css = 'color: #00a06a; border: 1px solid #7fe0c0; background: #f0fbf6;';
        } else {
            txt = '未回跟';
            css = 'color: #8b98a5; border: 1px solid #cfd9de; background: #fff;';
        }
        b.innerText = txt;
        b.style.cssText = css + base;
        return b;
    }

    // 清除某格可能殘留的雷達視覺標記
    function clearCellVisual(cell) {
        const oldBadge = cell.querySelector('.x-radar-badge-cell');
        if (oldBadge) oldBadge.remove();
        cell.style.border = '';
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
        if (accPath !== p) { accPath = p; acc.clear(); accZeroStreak = 0; lastKey = ''; }

        const cells = visibleCellsOnPage();

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
                // 跟隨者頁：未回跟 = 你沒追蹤他。只採「按鈕已渲染」的列
                const st = readBackState(cell);
                if (st === null) return;
                acc.set(username, st);
                const ck = 'fers_' + st;
                if (cell.dataset.radarScanned === ck) return;
                cell.dataset.radarScanned = ck;
                clearCellVisual(cell);
                if (st === 1) {
                    appendBadge(cell, username, makeTag('backed'));
                } else {
                    // 未回跟 → 紅框圈起來（與 following 頁未回關同款視覺語言）
                    cell.style.border = '2px solid #e0245e';
                    cell.style.backgroundColor = 'rgba(224, 36, 94, 0.05)';
                    cell.style.borderRadius = '16px';
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

            const fullKey = username + '_' + isFollowing + '_' + isFollowedBy;
            if (cell.dataset.radarScanned === fullKey) return; // 視覺已處理過

            clearCellVisual(cell);
            cell.dataset.radarScanned = fullKey;

            if (isFollowedBy) {
                if (store[username]) { delete store[username]; saveStore(); }
                appendBadge(cell, username, makeTag('mutual'));
                return;
            }

            if (!store[username]) {
                store[username] = todayStr();
                saveStore();
            }
            cell.style.border = '2px solid #e0245e';
            cell.style.backgroundColor = 'rgba(224, 36, 94, 0.05)';
            cell.style.borderRadius = '16px';
            appendBadge(cell, username, makeTag('notback', daysSince(store[username])));
        });

        // 統計：以不重複累計為準（只增不減；分類以最新狀態覆蓋）
        if (!acc.size) {
            updateStats(isFers ? i18n.notBack : i18n.found, 0, i18n.total + ' 0');
            return;
        }
        let backed = 0;
        acc.forEach(v => { if (v === 1) backed++; });
        const seen = acc.size;
        if (isFers) {
            updateStats(i18n.notBack, seen - backed,
                i18n.total + ' ' + seen + ' · ' + i18n.backed + ' ' + backed);
        } else {
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
    const LOCK_MS = 3000;         // 重掛後的鎖定期：完全不動作
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

    // 分類：回傳 'front'（未互關/未回跟，應排前）| 'back'（互關/已回跟）| null（未就緒）
    function cellClass(cell, page) {
        if (!cell) return null;
        const isFers = page.indexOf('followers:') === 0;
        if (isFers) {
            if (!rowLoadedFollowers(cell)) return null;
            if (cell.querySelector('[data-testid$="-unfollow"]')) return 'back'; // 已回跟
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
            plan.push({ r: r, want: Math.round(y) });
            y += r.offsetHeight || 0;
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
            console.log('[排序6.5] ' + page + ' 重排#' + rebuildCount +
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
            try { doSort(cur); } catch (e) { try { console.log('[排序6.5] 錯誤', e); } catch (_) {} }
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
