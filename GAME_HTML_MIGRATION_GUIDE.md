# game.html 改造指引

## 📋 修改步驟

### 1. 複製原本的 index.html 並改名為 game.html

```bash
cp index.html game.html
```

### 2. 修改 &lt;head&gt; 區域

**原本：**
```html
<title>駐波名稱大師 V2.3</title>
<link rel="stylesheet" href="style.css">
```

**改成：**
```html
<title>QuizFlow 3.2 - Game</title>
<link rel="stylesheet" href="css/game.css">
<!-- 動態載入特殊主題 CSS（如果有的話）-->
<link rel="stylesheet" id="customThemeCSS">
```

### 3. 在 &lt;body&gt; 最開頭加上返回按鈕

```html
<body>
    <!-- 🆕 返回主選單按鈕 -->
    <button class="menu-btn" onclick="returnToMenu()">← 返回主選單</button>

    <!-- 原本的內容 -->
    <div id="preload-container" style="display:none;"></div>
    ...
```

### 4. 在所有 &lt;script&gt; 標籤之前加上主題載入邏輯

在原本的 JavaScript 之前加入：

```html
<script src="core/theme-loader.js"></script>
<script>
    // ==================== 主題載入系統 ====================
    
    /**
     * 讀取 URL 參數
     */
    const urlParams = new URLSearchParams(window.location.search);
    const themeName = urlParams.get('theme');

    // 驗證主題參數
    if (!themeName) {
        alert('❌ 請從主選單選擇主題');
        window.location.href = 'index.html';
        throw new Error('No theme specified');
    }

    console.log(`🎮 準備載入主題: ${themeName}`);

    /**
     * 載入主題資料
     */
    let themeData = null;
    const loader = new ThemeLoader();

    async function initTheme() {
        try {
            console.log(`📥 載入主題 ${themeName}...`);
            themeData = await loader.loadTheme(themeName);
            console.log('✅ 主題載入成功:', themeData);

            // 🎨 如果有特殊 CSS，動態載入
            if (themeData.theme.gameDisplay?.useCustomCSS) {
                const customCSS = document.getElementById('customThemeCSS');
                const cssPath = themeData.theme.gameDisplay.customCSSPath;
                customCSS.href = `themes/${themeName}/${cssPath}`;
                console.log(`🎨 載入特殊 CSS: ${cssPath}`);
            }

            // 🎨 套用主題色（通過 CSS 變數）
            applyThemeColors(themeData.theme.gameDisplay);

            // ✅ 主題載入完成，可以初始化遊戲
            console.log('✅ 主題系統初始化完成');
            
            // 原本的遊戲初始化會在這裡執行
            // 例如：initGame();
            
        } catch (error) {
            console.error('❌ 主題載入失敗:', error);
            alert(`主題載入失敗：${error.message}\n\n將返回主選單`);
            window.location.href = 'index.html';
        }
    }

    /**
     * 套用主題色到 CSS 變數
     */
    function applyThemeColors(gameDisplay) {
        if (!gameDisplay || !gameDisplay.colors) return;

        const root = document.documentElement;
        const colors = gameDisplay.colors;

        if (colors.player1) {
            root.style.setProperty('--p1-color', colors.player1);
            root.style.setProperty('--color-p1', colors.player1);
        }
        if (colors.player2) {
            root.style.setProperty('--p2-color', colors.player2);
            root.style.setProperty('--color-p2', colors.player2);
        }
        if (colors.background) {
            root.style.setProperty('--bg-color', colors.background);
            root.style.setProperty('--color-bg', colors.background);
        }

        console.log('🎨 主題色已套用');
    }

    /**
     * 返回主選單
     */
    function returnToMenu() {
        // 如果遊戲正在進行，先確認
        if (confirm('確定要返回主選單嗎？進度將不會保存。')) {
            window.location.href = 'index.html';
        }
    }

    // 初始化主題（立即執行）
    initTheme();
</script>
```

### 5. 修改原本的遊戲初始化代碼

**原本：**
```javascript
// 遊戲直接開始
const Game = {
    init: function(mode, time, level) {
        // ...
    }
};
```

**改成（如果需要使用 themeData）：**
```javascript
const Game = {
    init: function(mode, time, level) {
        // 可以在這裡使用 themeData
        if (themeData && themeData.theme.gameDisplay) {
            // 使用主題設定
            this.themeConfig = themeData.theme.gameDisplay;
        }
        
        // 原本的初始化邏輯
        // ...
    }
};
```

### 6. 確保載入順序正確

完整的 &lt;script&gt; 順序應該是：

```html
<!-- 1. 主題載入器 -->
<script src="core/theme-loader.js"></script>

<!-- 2. 主題初始化（上面的代碼）-->
<script>
    // 主題載入邏輯...
    initTheme();
</script>

<!-- 3. 遊戲引擎（原本的代碼）-->
<script>
    // 原本的遊戲邏輯...
    const Game = { ... };
</script>
```

---

## ✅ 檢查清單

完成修改後，檢查以下項目：

- [ ] 檔案已改名為 game.html
- [ ] CSS 連結改為 `css/game.css`
- [ ] 加入了返回主選單按鈕
- [ ] 加入了主題載入邏輯
- [ ] URL 參數驗證正常
- [ ] themeData 可以被遊戲引擎使用
- [ ] 錯誤處理正常（會返回主選單）

---

## 🧪 測試方法

### 測試 1：URL 參數
```
直接打開 game.html（沒有參數）
預期結果：顯示錯誤訊息，跳回 index.html
```

### 測試 2：有效主題
```
打開 game.html?theme=wave-harmonics
預期結果：正常載入遊戲
```

### 測試 3：無效主題
```
打開 game.html?theme=not-exist
預期結果：顯示錯誤訊息，跳回 index.html
```

### 測試 4：返回按鈕
```
點擊左上角「返回主選單」按鈕
預期結果：跳回 index.html
```

---

## 📊 完整流程圖

```
使用者從 index.html 點擊主題
    ↓
跳轉到 game.html?theme=xxx
    ↓
game.html 載入
    ↓
讀取 URL 參數 theme=xxx
    ↓
驗證參數（沒有 → 返回 index.html）
    ↓
使用 ThemeLoader 載入主題
    ↓
成功？
├─ NO → 顯示錯誤，返回 index.html
└─ YES ↓
    套用主題色和特殊 CSS
    ↓
    初始化遊戲引擎
    ↓
    遊戲開始
```

---

## 💡 重要提醒

1. **themeData 全域變數：** 宣告為全域變數，讓遊戲引擎可以存取
2. **async/await：** 主題載入是異步的，確保載入完成後才初始化遊戲
3. **錯誤處理：** 所有載入錯誤都要導向主選單，不要讓使用者卡住
4. **CSS 變數：** 主題色透過 CSS 變數注入，不需要修改遊戲引擎
5. **返回按鈕：** 位置要明顯但不干擾遊戲

---

## 📁 需要的檔案

確保以下檔案都存在：

```
QuizFlow/
├── index.html          ← 主選單（新）
├── game.html           ← 遊戲頁面（改造後）
├── css/
│   ├── menu.css       ← 主選單樣式
│   └── game.css       ← 遊戲樣式（原 style.css）
├── core/
│   ├── theme-loader.js  ← 主題載入器
│   └── game-engine.js   ← 遊戲引擎（原本的）
└── themes/
    └── wave-harmonics/
        ├── theme-v2.json
        ├── config-v2.json
        └── questions-v2.json
```

---

完成這些修改後，game.html 就能動態載入任何主題了！ ✅
