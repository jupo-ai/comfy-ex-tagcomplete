import { TagCompleterSettings } from "./tag_completer_settings.js";

// ==============================================
// キーボード操作とナビゲーションを担当するクラス
// ==============================================

export class KeyboardHandler {
    constructor() {
        this.settings = TagCompleterSettings;
        
        this.onNavigateUp = null;
        this.onNavigateDown = null;
        this.onInsertItem = null;
        this.onHide = null;
        this.onPageUp = null;
        this.onPageDown = null;
    }


    // ------------------------------------------
    // イベントハンドラーを設定
    // ------------------------------------------
    setEventHandlers({
        onNavigateUp, 
        onNavigateDown, 
        onInsertItem, 
        onHide, 
        onPageUp, 
        onPageDown
    }) {
        this.onNavigateUp = onNavigateUp;
        this.onNavigateDown = onNavigateDown;
        this.onInsertItem = onInsertItem;
        this.onHide = onHide;
        this.onPageUp = onPageUp;
        this.onPageDown = onPageDown;
    }


    // ------------------------------------------
    // キーダウンイベントハンドラー
    // ------------------------------------------
    handleKeyDown(e, isDropdownVisible) {
        if (!isDropdownVisible) return false;

        const keyActions = {
            ArrowUp: () => this.handleArrowUp(e), 
            ArrowDown: () => this.handleArrowDown(e), 
            Tab: () => this.handleTabKey(e), 
            Enter: () => this.handleEnterKey(e),
            Escape: () => this.handleEscapeKey(e), 
            PageUp: () => this.handlePageUp(e), 
            PageDown: () => this.handlePageDown(e)
        };

        const action = keyActions[e.key];
        if (action) {
            action();
            return true;
        }

        return false;
    }

    // --- 上矢印キー ---
    handleArrowUp(e) {
        this.onNavigateUp?.();
        e.preventDefault();
    }

    // -- 下矢印キー ---
    handleArrowDown(e) {
        this.onNavigateDown?.();
        e.preventDefault();
    }

    // --- Tabキー ---
    handleTabKey(e) {
        this.onInsertItem?.();
        e.preventDefault();
    }

    // --- Enterキー ---
    handleEnterKey(e) {
        if (!e.ctrlKey) {
            this.onInsertItem?.();
            e.preventDefault();
        }
    }

    // --- Escapeキー ---
    handleEscapeKey(e) {
        this.onHide?.();
        e.preventDefault();
    }

    // --- PageUpキー ---
    handlePageUp(e) {
        this.onPageUp?.();
        e.preventDefault();
    }

    // --- PageDownキー ---
    handlePageDown(e) {
        this.onPageDown?.();
        e.preventDefault();
    }

    
    // ------------------------------------------
    // ページ移動量を計算
    // ------------------------------------------
    calculatePageMoveAmount(dropdownHeight) {
        const itemHeight = 40; // 概算
        return Math.floor(dropdownHeight / itemHeight);
    }

}