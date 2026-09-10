// 公式ローダーは動的import()でこのファイルを読み込むため、その時点で
// DOMContentLoadedは発火済み（二度と発火しない）。よってこのイベントを
// 待つのではなく、readyStateを見て即時実行するか、まだloading中なら
// イベントを待つ、という防御的な初期化パターンに変更する。
function initTextStyling() {
    console.log('テキストスタイル拡張機能 v6-modified: 初期化開始');

    const TAG_CONFIG = {
        p: {
            label: '<p>',
            isDynamic: false,
            defaults: { enabled: true, fontSize: 100, fontWeight: 400, textColor: '#dddddd', outlineColor: '#000000', outlineWidth: 1, lineHeight: 1.5, textOpacity: 1.0 }
        },
        q: {
            label: '<q>',
            isDynamic: false,
            defaults: { enabled: true, fontSize: 100, fontWeight: 400, textColor: '#dddddd', outlineColor: '#000000', outlineWidth: 1, lineHeight: 1.5, textOpacity: 1.0 }
        },
        em: {
            label: '<em>',
            isDynamic: false,
            defaults: { enabled: true, fontSize: 100, fontWeight: 400, textColor: '#dddddd', outlineColor: '#000000', outlineWidth: 1, lineHeight: 1.5, textOpacity: 1.0 }
        }
    };
    const OTHER_DEFAULTS = {
        chatWindowOpacity: 1.0,
        panelMinimized: false,
        activeTab: 'p'
    };
    const controls = {};
    let chatObserver = null;

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
    }

    // --- UI生成 ---
    const panel = document.createElement('div');
    panel.id = 'text-styling-panel';
    document.body.appendChild(panel);

    const header = document.createElement('div');
    header.id = 'text-styling-header';
    header.textContent = 'テキストスタイル設定';
    panel.appendChild(header);

    const restoreButton = document.createElement('button');
    restoreButton.id = 'restore-panel-button';
    restoreButton.innerHTML = '⚙️';
    restoreButton.title = '設定パネルの表示/非表示';
    restoreButton.onclick = () => {
        panel.classList.toggle('hidden');
        saveSettings();
    };
    document.body.appendChild(restoreButton);

    const tabContainer = document.createElement('div');
    tabContainer.className = 'tab-container';
    panel.appendChild(tabContainer);

    const tabButtons = document.createElement('div');
    tabButtons.className = 'tab-buttons';
    tabContainer.appendChild(tabButtons);

    const tabContents = document.createElement('div');
    tabContents.className = 'tab-contents';
    tabContainer.appendChild(tabContents);

    function createTagControlSection(tagName) {
        return `
            <div class="enable-styling-toggle">
                <input type="checkbox" id="${tagName}-enabled">
                <label for="${tagName}-enabled">このスタイルを有効にする</label>
            </div>
            <div class="columns-container">
                <div class="column">
                    <div class="text-styling-control-group">
                        <label for="${tagName}-font-size">文字サイズ: <span id="${tagName}-font-size-value"></span>%</label>
                        <input type="range" id="${tagName}-font-size" min="50" max="250" step="10">
                    </div>
                    <div class="text-styling-control-group">
                        <label for="${tagName}-font-weight">文字の太さ: <span id="${tagName}-font-weight-value"></span></label>
                        <input type="range" id="${tagName}-font-weight" min="100" max="900" step="100">
                    </div>
                    <div class="text-styling-control-group">
                        <label for="${tagName}-line-height">行間: <span id="${tagName}-line-height-value"></span></label>
                        <input type="range" id="${tagName}-line-height" min="1.0" max="3.0" step="0.1">
                    </div>
                    <div class="text-styling-control-group">
                        <label for="${tagName}-text-opacity">透過度: <span id="${tagName}-text-opacity-value"></span>%</label>
                        <input type="range" id="${tagName}-text-opacity" min="0" max="100" step="1">
                    </div>
                </div>
                <div class="column">
                    <div class="text-styling-control-group">
                        <label for="${tagName}-text-color">文字色</label>
                        <input type="color" id="${tagName}-text-color">
                    </div>
                    <div class="text-styling-control-group">
                        <label for="${tagName}-outline-color">縁取り色</label>
                        <input type="color" id="${tagName}-outline-color">
                    </div>
                    <div class="text-styling-control-group">
                        <label for="${tagName}-outline-width">縁取り幅: <span id="${tagName}-outline-width-value"></span>px</label>
                        <input type="range" id="${tagName}-outline-width" min="0" max="10" step="0.5">
                    </div>
                </div>
            </div>`;
    }

    Object.keys(TAG_CONFIG).forEach(tagName => {
        const button = document.createElement('button');
        button.className = 'tab-button';
        button.dataset.tab = tagName;
        button.textContent = TAG_CONFIG[tagName].label;
        tabButtons.appendChild(button);

        const content = document.createElement('div');
        content.className = 'tab-content';
        content.dataset.tabContent = tagName;
        content.innerHTML = createTagControlSection(tagName);
        tabContents.appendChild(content);

        controls[tagName] = {
            content: content,
            enabledCheckbox: content.querySelector(`#${tagName}-enabled`),
            fontSizeInput: content.querySelector(`#${tagName}-font-size`),
            fontSizeValue: content.querySelector(`#${tagName}-font-size-value`),
            fontWeightInput: content.querySelector(`#${tagName}-font-weight`),
            fontWeightValue: content.querySelector(`#${tagName}-font-weight-value`),
            lineHeightInput: content.querySelector(`#${tagName}-line-height`),
            lineHeightValue: content.querySelector(`#${tagName}-line-height-value`),
            textColorInput: content.querySelector(`#${tagName}-text-color`),
            outlineColorInput: content.querySelector(`#${tagName}-outline-color`),
            outlineWidthInput: content.querySelector(`#${tagName}-outline-width`),
            outlineWidthValue: content.querySelector(`#${tagName}-outline-width-value`),
            textOpacityInput: content.querySelector(`#${tagName}-text-opacity`),
            textOpacityValue: content.querySelector(`#${tagName}-text-opacity-value`)
        };

        controls[tagName].enabledCheckbox.addEventListener('change', () => updateStyleAndAllMessages(tagName));
        Object.values(controls[tagName]).forEach(element => {
            if (element && element.tagName === 'INPUT' && element.type !== 'checkbox') {
                element.addEventListener('input', () => updateStyleAndAllMessages(tagName));
            }
        });
    });

    const chatSection = document.createElement('div');
    chatSection.className = 'text-styling-section';
    chatSection.style.marginTop = '15px';
    chatSection.innerHTML = `
        <h3>チャットウィンドウ設定</h3>
        <div class="text-styling-control-group">
            <label for="chat-opacity">透過度: <span id="chat-opacity-value"></span>%</label>
            <input type="range" id="chat-opacity" min="0" max="100" step="1">
        </div>`;
    panel.appendChild(chatSection);
    
    controls.chatOpacityInput = chatSection.querySelector('#chat-opacity');
    controls.chatOpacityValue = chatSection.querySelector('#chat-opacity-value');
    controls.chatOpacityInput.addEventListener('input', updateChatWindowOpacity);
    
    tabButtons.addEventListener('click', e => {
        if (e.target.matches('.tab-button')) {
            setActiveTab(e.target.dataset.tab);
            saveSettings();
        }
    });

    function setActiveTab(tabId) {
        tabButtons.querySelectorAll('.tab-button').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
        tabContents.querySelectorAll('.tab-content').forEach(content => content.classList.toggle('active', content.dataset.tabContent === tabId));
    }


    // --- 統合されたスタイル適用関数 ---
    function applyStylesToMessage(mesTextElement) {
        if (!mesTextElement) return;

        // 静的スタイルのクラスをON/OFF
        Object.keys(TAG_CONFIG).forEach(tagName => {
            if (!TAG_CONFIG[tagName].isDynamic) {
                const isEnabled = controls[tagName].enabledCheckbox.checked;
                mesTextElement.classList.toggle(`style-${tagName}-enabled`, isEnabled);
            }
        });
    }

    // --- コントロール変更時のメイン処理 ---
    function updateStyleAndAllMessages(tagName) {
        const tagControls = controls[tagName];
        const rootStyle = document.documentElement.style;
        const enabled = tagControls.enabledCheckbox.checked;
        tagControls.content.classList.toggle('disabled', !enabled);
        
        // CSS変数を更新
        if (enabled) {
            const fontSize = parseInt(tagControls.fontSizeInput.value);
            const fontWeight = parseInt(tagControls.fontWeightInput.value);
            const lineHeight = parseFloat(tagControls.lineHeightInput.value);
            const textColor = tagControls.textColorInput.value;
            const outlineColor = tagControls.outlineColorInput.value;
            const outlineWidth = parseFloat(tagControls.outlineWidthInput.value);
            const textOpacity = parseFloat(tagControls.textOpacityInput.value) / 100;
            
            tagControls.fontSizeValue.textContent = fontSize;
            tagControls.fontWeightValue.textContent = fontWeight;
            tagControls.lineHeightValue.textContent = lineHeight.toFixed(1);
            tagControls.outlineWidthValue.textContent = outlineWidth.toFixed(1);
            tagControls.textOpacityValue.textContent = Math.round(textOpacity * 100);

            rootStyle.setProperty(`--${tagName}-font-size`, `${fontSize}%`);
            rootStyle.setProperty(`--${tagName}-font-weight`, fontWeight);
            rootStyle.setProperty(`--${tagName}-line-height`, lineHeight);
            rootStyle.setProperty(`--${tagName}-text-rgb`, hexToRgb(textColor));
            rootStyle.setProperty(`--${tagName}-text-opacity`, textOpacity);
            rootStyle.setProperty(`--${tagName}-outline-width`, `${outlineWidth}px`);
            rootStyle.setProperty(`--${tagName}-outline-rgb`, hexToRgb(outlineColor));
        }
        
        // すべてのメッセージにスタイルを再適用
        document.querySelectorAll('#chat .mes_text').forEach(applyStylesToMessage);
        saveSettings();
    }
    
    function updateChatWindowOpacity() {
        const opacity = parseInt(controls.chatOpacityInput.value) / 100;
        controls.chatOpacityValue.textContent = controls.chatOpacityInput.value;
        document.documentElement.style.setProperty('--chat-opacity', opacity);
        saveSettings();
    }

    // --- オブザーバーセットアップ ---
    function setupObservers() {
        if (chatObserver) chatObserver.disconnect();
        const chatElement = document.getElementById('chat');
        if (!chatElement) return;

        chatObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) { // ELEMENT_NODE
                        const targets = node.classList.contains('mes_text') ? [node] : node.querySelectorAll('.mes_text');
                        targets.forEach(applyStylesToMessage);
                    }
                }
            }
        });
        chatObserver.observe(chatElement, { childList: true, subtree: true });
        console.log("チャット監視オブザーバーをセットアップしました。");
    }
    
    // --- 設定の保存と復元 (バージョン更新 v6) ---
    function saveSettings() {
        const settings = {
            tags: {},
            chatWindowOpacity: parseFloat(controls.chatOpacityInput.value) / 100,
            panelMinimized: panel.classList.contains("hidden"),
            activeTab: tabButtons.querySelector(".tab-button.active")?.dataset.tab || "p",
        };
        Object.keys(TAG_CONFIG).forEach(tagName => {
            const t = controls[tagName];
            settings.tags[tagName] = {
                enabled: t.enabledCheckbox.checked,
                fontSize: parseInt(t.fontSizeInput.value),
                fontWeight: parseInt(t.fontWeightInput.value),
                lineHeight: parseFloat(t.lineHeightInput.value),
                textColor: t.textColorInput.value,
                outlineColor: t.outlineColorInput.value,
                outlineWidth: parseFloat(t.outlineWidthInput.value),
                textOpacity: parseFloat(t.textOpacityInput.value) / 100,
            };
        });
        localStorage.setItem("textStylingSettings_v6_modified", JSON.stringify(settings));
    }

    function restoreSettings() {
        const saved = localStorage.getItem('textStylingSettings_v6_modified');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                Object.keys(TAG_CONFIG).forEach(tagName => {
                    const savedTag = settings.tags?.[tagName] || {};
                    const defaultTag = TAG_CONFIG[tagName].defaults;
                    const tagControls = controls[tagName];
                    tagControls.enabledCheckbox.checked = savedTag.enabled ?? defaultTag.enabled;
                    tagControls.fontSizeInput.value = savedTag.fontSize ?? defaultTag.fontSize;
                    tagControls.fontWeightInput.value = savedTag.fontWeight ?? defaultTag.fontWeight;
                    tagControls.lineHeightInput.value = savedTag.lineHeight ?? defaultTag.lineHeight;
                    tagControls.textColorInput.value = savedTag.textColor ?? defaultTag.textColor;
                    tagControls.outlineColorInput.value = savedTag.outlineColor ?? defaultTag.outlineColor;
                    tagControls.outlineWidthInput.value = savedTag.outlineWidth ?? defaultTag.outlineWidth;
                    tagControls.textOpacityInput.value = Math.round((savedTag.textOpacity ?? defaultTag.textOpacity) * 100);
                });
                controls.chatOpacityInput.value = Math.round((settings.chatWindowOpacity ?? OTHER_DEFAULTS.chatWindowOpacity) * 100);
                if (settings.panelMinimized) {
                    panel.classList.add('hidden');
                }
                setActiveTab(settings.activeTab || OTHER_DEFAULTS.activeTab);
            } catch (e) {
                console.error('設定復元エラー:', e);
                setDefaultSettings();
            }
        } else {
            setDefaultSettings();
        }
        
        // 起動時にすべてのスタイルを適用
        const originalSave = saveSettings;
        saveSettings = () => {}; // 復元中の不要な保存を抑制
        Object.keys(TAG_CONFIG).forEach(tagName => updateStyleAndAllMessages(tagName));
        updateChatWindowOpacity();
        saveSettings = originalSave;
    }

    function setDefaultSettings() {
        Object.keys(TAG_CONFIG).forEach(tagName => {
            const defaults = TAG_CONFIG[tagName].defaults;
            const tagControls = controls[tagName];
            tagControls.enabledCheckbox.checked = defaults.enabled;
            Object.keys(defaults).forEach(key => {
                if (key !== "enabled") {
                    const input = tagControls[key + "Input"] || tagControls[key];
                    if (input) {
                        if (key.includes("Color")) {
                            input.value = defaults[key];
                        } else if (key === "textOpacity") {
                            input.value = defaults[key] * 100;
                        } else {
                            input.value = defaults[key];
                        }
                    }
                }
            });
        });
        controls.chatOpacityInput.value = Math.round(OTHER_DEFAULTS.chatWindowOpacity * 100);
        panel.classList.remove('hidden');
        setActiveTab(OTHER_DEFAULTS.activeTab);

        const originalSave = saveSettings;
        saveSettings = () => {};
        Object.keys(TAG_CONFIG).forEach(tagName => updateStyleAndAllMessages(tagName));
        updateChatWindowOpacity();
        saveSettings = originalSave;
    }

    // --- 初期化処理 ---
    setTimeout(() => {
        console.log('拡張機能の初期化処理を開始');
        
        const windowControlContainer = document.createElement('div');
        windowControlContainer.id = 'window-control-buttons';
        document.body.appendChild(windowControlContainer);

        const centerButton = document.createElement('button');
        centerButton.id = 'center-button';
        centerButton.className = 'window-control-button';
        centerButton.textContent = '中央';
        windowControlContainer.appendChild(centerButton);

        const rightHalfButton = document.createElement('button');
        rightHalfButton.id = 'right-half-button';
        rightHalfButton.className = 'window-control-button';
        rightHalfButton.textContent = '右半分';
        windowControlContainer.appendChild(rightHalfButton);

        const sheld = document.getElementById('sheld');
        const sheldheader = document.getElementById('sheldheader');
        if (sheld && sheldheader) {
            centerButton.addEventListener('click', () => {
                sheld.style.resize = 'none';
                sheld.style.inset = '3.5vh 0px 60px 25vw';
                sheld.style.height = '100vh';
                sheld.style.width = '50vw';
                sheld.style.margin = 'unset';
            });
            rightHalfButton.addEventListener('click', () => {
                sheld.style.resize = 'none';
                sheld.style.inset = '3.5vh 0px 60px 50vw';
                sheld.style.height = '100vh';
                sheld.style.width = '50vw';
                sheld.style.margin = 'unset';
            });
            const topLimit = 35;
            sheldheader.addEventListener('mousedown', () => {
                sheld.style.resize = 'both';
                const onMouseUp = () => {
                    requestAnimationFrame(() => {
                        const top = parseFloat(sheld.style.top);
                        if (!isNaN(top) && top < topLimit) {
                            sheld.style.top = `${topLimit}px`;
                        }
                    });
                };
                document.addEventListener('mouseup', onMouseUp, { once: true });
            });
        }
        
        restoreSettings();
        setupObservers();
    }, 500);
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initTextStyling();
} else {
    document.addEventListener('DOMContentLoaded', initTextStyling);
}
