// SillyTavern.getContext() を実行時に呼び出す方式（公式ドキュメント推奨）
function initTextStyling() {
    console.log('テキストスタイル拡張機能 (修正版): 初期化開始');

    const MODULE_NAME = 'text_styling';
    const OLD_STORAGE_KEY = 'textStylingSettings_v6_modified';

    const TAG_CONFIG = {
        p: {
            label: '通常テキスト',
            isDynamic: false,
            defaults: { enabled: true, fontSize: 100, fontWeight: 400, textColor: '#dddddd', outlineColor: '#000000', outlineWidth: 1, lineHeight: 1.5, letterSpacing: 0, bottomMargin: 0, textOpacity: 1.0 }
        },
        q: {
            label: 'セリフ',
            isDynamic: false,
            defaults: { enabled: true, fontSize: 100, fontWeight: 400, textColor: '#dddddd', outlineColor: '#000000', outlineWidth: 1, lineHeight: 1.5, letterSpacing: 0, bottomMargin: 0, textOpacity: 1.0 }
        }
    };

    const OTHER_DEFAULTS = {
        chatWindowOpacity: 1.0,
        panelMinimized: false,
        activeTab: 'p'
    };

    const controls = {};
    let chatObserver = null;

    function getSTContext() {
        return (window.SillyTavern && typeof window.SillyTavern.getContext === 'function')
            ? window.SillyTavern.getContext()
            : null;
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
    }

    // ============================================================
    //  セグメントのラップ処理
    //  - 「」を含むテキストノード → セグメント分割して .stj-dialogue / .stj-normal-text でラップ
    //  - 裸のテキストノード（「」なし）でも、兄弟に .stj-dialogue / .stj-normal-text があれば
    //    .stj-normal-text でラップ（旧バージョンからの移行や部分ラップに対応）
    // ============================================================
    function hasSegmentSibling(textNode) {
        let s = textNode.previousSibling;
        while (s) {
            if (s.nodeType === 1 && s.classList &&
                (s.classList.contains('stj-dialogue') || s.classList.contains('stj-normal-text'))) {
                return true;
            }
            s = s.previousSibling;
        }
        s = textNode.nextSibling;
        while (s) {
            if (s.nodeType === 1 && s.classList &&
                (s.classList.contains('stj-dialogue') || s.classList.contains('stj-normal-text'))) {
                return true;
            }
            s = s.nextSibling;
        }
        return false;
    }

    function ensureSegmentsWrapped(mesTextEl) {
        if (!mesTextEl) return;

        // ラップ対象のテキストノードを収集（既存スパンの内側は除外）
        const walker = document.createTreeWalker(mesTextEl, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                let p = node.parentNode;
                while (p && p !== mesTextEl) {
                    if (p.classList && (p.classList.contains('stj-dialogue') || p.classList.contains('stj-normal-text'))) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    p = p.parentNode;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const textNodes = [];
        let n;
        while ((n = walker.nextNode())) {
            textNodes.push(n);
        }

        textNodes.forEach(textNode => {
            const txt = textNode.nodeValue;
            if (!txt) return;

            const hasDialogueMarker = txt.indexOf('「') >= 0;

            // --- パターン A: 「」を含むテキストノード ---
            if (hasDialogueMarker) {
                const regex = /「[^」]*」/g;
                const segments = [];
                let last = 0;
                let m;
                let hasDialogue = false;
                while ((m = regex.exec(txt)) !== null) {
                    hasDialogue = true;
                    if (m.index > last) {
                        segments.push({ text: txt.slice(last, m.index), isDialogue: false });
                    }
                    segments.push({ text: m[0], isDialogue: true });
                    last = regex.lastIndex;
                }
                if (!hasDialogue) return;
                if (last < txt.length) {
                    segments.push({ text: txt.slice(last), isDialogue: false });
                }

                const frag = document.createDocumentFragment();
                segments.forEach(seg => {
                    if (seg.text === '') return;
                    // 空白のみの通常セグメントはテキストノードとして保持
                    if (!seg.isDialogue && seg.text.trim() === '') {
                        frag.appendChild(document.createTextNode(seg.text));
                        return;
                    }
                    const span = document.createElement('span');
                    span.className = seg.isDialogue ? 'stj-dialogue' : 'stj-normal-text';
                    span.textContent = seg.text;
                    frag.appendChild(span);
                });
                if (textNode.parentNode) {
                    textNode.parentNode.replaceChild(frag, textNode);
                }
                return;
            }

            // --- パターン B: 「」なしの裸のテキストノード ---
            // 兄弟に既存のセグメントスパンがあれば .stj-normal-text でラップ
            if (txt.trim() !== '' && hasSegmentSibling(textNode)) {
                const span = document.createElement('span');
                span.className = 'stj-normal-text';
                span.textContent = txt;
                if (textNode.parentNode) {
                    textNode.parentNode.replaceChild(span, textNode);
                }
            }
        });

        // ---- <p> に stj-has-segment クラスを付与（余白の二重適用を防止） ----
        mesTextEl.querySelectorAll('p').forEach(p => {
            if (p.querySelector('.stj-dialogue, .stj-normal-text')) {
                p.classList.add('stj-has-segment');
            } else {
                p.classList.remove('stj-has-segment');
            }
        });

        // ---- <p> もセグメントもない .mes_text に stj-empty-text クラスを付与 ----
        const hasP = mesTextEl.querySelector('p');
        const hasSegment = mesTextEl.querySelector('.stj-dialogue, .stj-normal-text');
        if (!hasP && !hasSegment) {
            mesTextEl.classList.add('stj-empty-text');
        } else {
            mesTextEl.classList.remove('stj-empty-text');
        }
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
    restoreButton.innerHTML = '⚙';
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
    tabButtons.className
