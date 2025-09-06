import { app } from "../../../scripts/app.js";
import { loadCSS } from "../utils.js";
import { TagCompleterSettings } from "./tag_completer_settings.js";
import { TextAreaCaretHelper } from "./caret_helper.js";
import { SearchEngine } from "./search_engine.js";
import { DropdownRenderer } from "./dropdown_renderer.js";
import { DropdownController } from "./dropdown_controller.js";
import { KeyboardHandler } from "./keyboard_handler.js";
import { TextProcessor } from "./text_processor.js";
import { VirtualDropdownController } from "./virtual_dropdown_controller.js";

loadCSS("css/tag_completer.css");
loadCSS("css/category_pill.css");
loadCSS("css/custom_badge.css");

// ==============================================
// タグ補間機能のメインクラス
// ==============================================

export class TagCompleter {

    // ------------------------------------------
    // 静的プロパティ
    // ------------------------------------------
    static instanceArray = [];

    // ------------------------------------------
    // コンストラクタ
    // ------------------------------------------
    constructor(element) {
        this.element = element;
        this.settings = TagCompleterSettings;

        this.initialize();
        TagCompleter.instanceArray.push(this);
    }

    // ------------------------------------------
    // 静的メソッド
    // ------------------------------------------

    // --- 設定を更新 ---
    static updateSetting(key, value) {
        if (key in TagCompleterSettings) {
            TagCompleterSettings[key] = value;

            if (key === "delay") {
                TagCompleter.instanceArray.forEach(instance => {
                    instance.updateDebouncedFunction();
                });
            }
        }
    }

    
    // ------------------------------------------
    // 初期化
    // ------------------------------------------

    // --- 初期化 ---
    initialize() {
        this.initializeComponents();
        this.setupKeyboardHandlers();
        this.setupEventListeners();
        this.updateDebouncedFunction();
    }

    // --- コンポーネントを初期化 ---
    initializeComponents() {
        this.helper = new TextAreaCaretHelper(this.element, () => app.canvas.ds.scale);
        this.searchEngine = new SearchEngine();
        this.dropdownRenderer = new DropdownRenderer();
        this.keyboardHandler = new KeyboardHandler();
        // this.dropdownController = new DropdownController(this.element);
        this.dropdownController = new VirtualDropdownController(this.element);
        this.textProcessor = new TextProcessor();
    }

    // --- キーボードイベントハンドラーを設定 ---
    setupKeyboardHandlers() {
        this.keyboardHandler.setEventHandlers({
            onNavigateUp: () => this.dropdownController.navigateUp(), 
            onNavigateDown: () => this.dropdownController.navigateDown(), 
            onInsertItem: () => this.insertSelectedItem(), 
            onHide: () => this.dropdownController.hide(), 
            onPageUp: () => this.handlePageUp(), 
            onPageDown: () => this.handlePageDown(), 
        });
    }


    // ------------------------------------------
    // クリーンアップ
    // ------------------------------------------
    
    // --- インスタンスを破棄 ---
    destroy() {
        this.searchEngine?.destroy();
        this.dropdownController?.destroy();
        this.removeEventListeners();

        const index = TagCompleter.instanceArray.indexOf(this);
        if (index > -1) {
            TagCompleter.instanceArray.splice(index, 1);
        }
    }


    // ------------------------------------------
    // イベント管理メソッド
    // ------------------------------------------

    // --- イベントリスナーを設定 ---
    setupEventListeners() {
        // バインドした関数を保存
        this.boundHandlers = {
            keydown: this.handleKeyDown.bind(this), 
            input: this.handleInput.bind(this), 
            click: this.handleClick.bind(this), 
            blur: this.handleBlur.bind(this)
        };

        this.element.addEventListener("keydown", this.boundHandlers.keydown);
        this.element.addEventListener("input", this.boundHandlers.input);
        this.element.addEventListener("click", this.boundHandlers.click);
        this.element.addEventListener("blur", this.boundHandlers.blur);
    }

    // --- イベントリスナーを削除 ---
    removeEventListeners() {
        if (!this.boundHandlers) return;

        this.element.removeEventListener("keydown", this.boundHandlers.keydown);
        this.element.removeEventListener("input", this.boundHandlers.input);
        this.element.removeEventListener("click", this.boundHandlers.click);
        this.element.removeEventListener("blur", this.boundHandlers.blur);

        this.boundHandlers = null;
    }

    // --- デバウンス関数を更新 ---
    updateDebouncedFunction() {
        this.debouncedUpdate = this.debounce(() => this.update(), this.settings.delay);
    }


    // ------------------------------------------
    // イベントハンドラー
    // ------------------------------------------

    // --- keydown ---
    handleKeyDown(e) {
        if (!this.settings.enable) return;

        this.keyboardHandler.handleKeyDown(e, this.dropdownController.isVisible());
    }

    // --- input ---
    handleInput(e) {
        if (!this.settings.enable) return;

        this.debouncedUpdate();
    }

    // --- click ---
    handleClick(e) {
        this.dropdownController.hide();
    }

    // --- blur ---
    handleBlur(e) {
        // relatedTargetをチェックして、ドロップダウン内の要素にフォーカスが移った場合は隠さない
        if (e.relatedTarget && this.dropdownController.dropdown.contains(e.relatedTarget)) {
            return;
        }

        // mouseイベント中は隠さない
        if (this.dropdownController.isMouseInteracting()) {
            return;
        }

        setTimeout(() => {
            if (!this.dropdownController.dropdown.contains(document.activeElement)) {
                this.dropdownController.hide();
            }
        }, 0);
    }

    // --- pageup ---
    handlePageUp(e) {
        const pageSize = this.keyboardHandler.calculatePageMoveAmount(
            this.dropdownController.getDropdownHeight()
        );
        this.dropdownController.navigatePage(-1, pageSize);
    }

    // --- pagedown ---
    handlePageDown(e) {
        const pageSize = this.keyboardHandler.calculatePageMoveAmount(
            this.dropdownController.getDropdownHeight()
        );
        this.dropdownController.navigatePage(1, pageSize);
    }

    // --- item click ---
    handleItemClick(e, result, searchInfo) {
        if (e.target.classList.contains("jupo-tagcomplete-wikiLink")) return;

        this.element.focus();

        if (this.termCursorPostion) {
            this.element.selectionStart = this.termCursorPostion.start;
            this.element.selectionEnd = this.termCursorPostion.end;
        }

        const afterCursor = this.helper.getAfterCursor();
        const insertValue = this.textProcessor.createInsertValue(result, searchInfo, afterCursor);
        const replaceLength = this.textProcessor.getReplaceLength(searchInfo);

        this.helper.insertAtCursor(insertValue, replaceLength);

        setTimeout(() => this.dropdownController.hide(), 150);
    }


    // ------------------------------------------
    // コア機能
    // ------------------------------------------
    
    // --- 補間候補を更新 ---
    async update() {
        if (this.searchEngine.isUpdating()) return;

        const currentSequence = this.searchEngine.getNextSequence();
        this.searchEngine.setUpdating(true);

        try {
            const searchInfo = this.getSearchInfo();

            if (!searchInfo || !searchInfo.term) {
                this.dropdownController.hide();
                return;
            }

            // カーソル位置を記録
            this.termCursorPostion = {
                start: this.element.selectionStart, 
                end: this.element.selectionEnd, 
            };

            // 検索実行
            const searchResults = await this.searchEngine.fetchSearchResults(
                searchInfo, 
                currentSequence
            );

            // リクエストが古い場合は処理をスキップ
            if (currentSequence !== this.searchEngine.getCurrentSequence()) {
                console.warn("古いリクエストをスキップ: ", currentSequence);
                return;
            }

            // 結果が空の場合
            if (!searchResults || searchResults.length === 0) {
                this.dropdownController.hide();
                return;
            }

            this.showDropdown(searchResults, searchInfo);

        } catch(error) {
            if (error.name !== "AbortError") {
                console.error("タグ検索エラー: ", error);
            }
            this.dropdownController.hide();
        } finally {
            this.searchEngine.setUpdating(false);
        }
    }

    // --- 検索情報を取得 ---
    getSearchInfo() {
        const beforeCursor = this.helper.getBeforeCursor();
        const rawTerm = this.textProcessor.getSearchTerm(beforeCursor);

        if (!rawTerm) return null;

        return this.searchEngine.parseSearchTerm(rawTerm);
    }

    // --- ドロップダウンを表示 ---
    showDropdown(searchResults, searchInfo) {
        const items = this.dropdownRenderer.createDropdownItems(
            searchResults, 
            searchInfo, 
            (e, result, searchInfo) => this.handleItemClick(e, result, searchInfo)
        );

        const position = this.helper.getCursorOffset();
        this.dropdownController.show(items, position);
    }

    // --- 選択中のアイテムを挿入 ---
    insertSelectedItem() {
        const selectedItem = this.dropdownController.getSelectedItem();
        if (!selectedItem) return;

        selectedItem.click();
    }

    
    // ------------------------------------------
    // ユーティリティメソッド
    // ------------------------------------------
    
    // --- デバウンス関数を生成 ---
    debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            this.searchEngine.cancelCurrentRequest();

            timeout = setTimeout(async () => {
                await fn(...args);
            }, delay);
        };
    }
}