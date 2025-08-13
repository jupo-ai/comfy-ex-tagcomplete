import { api } from "../../scripts/api.js";
import { $el } from "../../scripts/ui.js";
import { _endpoint, addStylesheet, debug } from "./utils.js";
import { TextAreaCaretHelper } from "./caret_helper.js";

addStylesheet(import.meta.url);

/**
 * タグ補完機能を提供するクラス
 * ComfyUI用のタグオートコンプリート機能を実装
 */
export class TagCompleter {
    // 静的設定プロパティ
    static enabled = true;
    static separator = ",";
    static insertSpace = true;
    static insertOnTab = true;
    static insertOnEnter = true;
    static suggestionCount = 20;
    static replaceUnderbar = true;
    static wikiLink = false;
    static colors = {};
    static delay = 50;
    static instanceArray = [];
    
    // カテゴリフィルタリング設定
    static categoryFilters = {
        "--general": "general", 
        "--artist": "artist", 
        "--copyright": "copyright", 
        "--character": "character", 
        "--meta": "meta", 
        "--contributor": "contributor", 
        "--species": "species", 
        "--lore": "lore", 
        "--embedding": "embedding",
        "--lora": "lora",
        "--alias": "alias"
    };

    // インスタンスプロパティ
    #el;                        // 関連するtextarea要素
    #helper;                    // テキストエリアのカーソル操作ヘルパー
    #dropdown;                  // ドロップダウン要素
    #items = null;              // ドロップダウンの選択肢リスト
    #currentIndex = 0;          // 現在選択中のインデックス
    #prevAllText = null;        // Undo用に保存する前のテキスト
    #termCursorPosition = null; // term取得時のカーソル位置を保持
    #debouncedUpdate;           // デバウンス処理された更新関数
    #abortController = null;    // 検索リクエストのキャンセル制御
    #requestSequence = 0;       // リクエストの順序制御用
    #isUpdating = false;        // 更新処理中フラグ

    constructor(el) {
        this.#el = el;
        this.#helper = new TextAreaCaretHelper(el, () => app.canvas.ds.scale);
        this.#dropdown = $el("div.jupo-tagcomplete");
        
        this.#initialize();
        TagCompleter.instanceArray.push(this);
    }

    // ===== パブリックメソッド =====

    /**
     * インスタンスを破棄
     */
    destroy() {
        this.#cancelCurrentRequest();
        this.#removeEventListeners();
        this.#hide();
        const index = TagCompleter.instanceArray.indexOf(this);
        if (index > -1) {
            TagCompleter.instanceArray.splice(index, 1);
        }
    }

    // ===== 静的メソッド =====

    /**
     * デバウンス遅延時間を更新
     */
    static updateDelay(value) {
        TagCompleter.delay = value;
        TagCompleter.instanceArray.forEach(instance => {
            instance.#updateDebouncedFunction();
        });
    }

    // ===== プライベートメソッド =====

    /**
     * 初期化処理
     */
    #initialize() {
        this.#setupEventListeners();
        this.#updateDebouncedFunction();
    }

    /**
     * デバウンス関数を更新
     */
    #updateDebouncedFunction() {
        this.#debouncedUpdate = this.#debounce(() => this.#update(), TagCompleter.delay);
    }

    /**
     * イベントリスナーを設定
     */
    #setupEventListeners() {
        this.#el.addEventListener("keydown", this.#handleKeyDown.bind(this));
        this.#el.addEventListener("input", this.#handleInput.bind(this));
        this.#el.addEventListener("click", this.#hide.bind(this));
        this.#el.addEventListener("blur", () => {
            setTimeout(() => this.#hide(), 150);
        });
    }

    /**
     * イベントリスナーを削除
     */
    #removeEventListeners() {
        this.#el.removeEventListener("keydown", this.#handleKeyDown.bind(this));
        this.#el.removeEventListener("input", this.#handleInput.bind(this));
        this.#el.removeEventListener("click", this.#hide.bind(this));
    }

    // ===== イベントハンドラー =====

    /**
     * キーダウンイベントハンドラー
     */
    async #handleKeyDown(e) {
        if (!TagCompleter.enabled || !this.#dropdown.parentElement) {
            return;
        }

        const keyActions = {
            ArrowUp: () => this.#navigateUp(e),
            ArrowDown: () => this.#navigateDown(e),
            Tab: () => this.#handleTabKey(e),
            Enter: () => this.#handleEnterKey(e),
            Escape: () => this.#handleEscapeKey(e)
        };

        const action = keyActions[e.key];
        if (action) {
            action();
        }
    }

    /**
     * インプットイベントハンドラー
     */
    async #handleInput(e) {
        if (!TagCompleter.enabled) return;
        this.#debouncedUpdate();
    }

    // ===== キーボードナビゲーション =====

    #navigateUp(e) {
        this.#currentIndex = this.#currentIndex <= 0 
            ? this.#items.length - 1 
            : this.#currentIndex - 1;
        this.#updateDropdownDisplay();
        e.preventDefault();
    }

    #navigateDown(e) {
        this.#currentIndex = this.#currentIndex >= this.#items.length - 1 
            ? 0 
            : this.#currentIndex + 1;
        this.#updateDropdownDisplay();
        e.preventDefault();
    }

    #handleTabKey(e) {
        if (TagCompleter.insertOnTab) {
            this.#insertSelectedItem();
            e.preventDefault();
        }
    }

    #handleEnterKey(e) {
        if (!e.ctrlKey && TagCompleter.insertOnEnter) {
            this.#insertSelectedItem();
            e.preventDefault();
        }
    }

    #handleEscapeKey(e) {
        this.#hide();
        e.preventDefault();
    }

    // ===== コア機能 =====

    /**
     * 選択中のアイテムを挿入
     */
    #insertSelectedItem() {
        if (!this.#items || this.#items.length === 0) return;
        this.#debouncedUpdate();
        this.#items[this.#currentIndex].click();
    }

    /**
     * デバウンス関数を生成
     * 高速入力時の処理制御を強化
     */
    #debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            // 前のリクエストをキャンセル
            this.#cancelCurrentRequest();
            
            timeout = setTimeout(async () => {
                await fn(...args);
            }, delay);
        };
    }

    /**
     * 補完候補を更新
     * リクエストの競合を防ぐため、シーケンス番号で制御
     */
    async #update() {
        // 同時更新を防ぐ
        if (this.#isUpdating) {
            return;
        }

        const currentSequence = ++this.#requestSequence;
        this.#isUpdating = true;

        try {
            const searchInfo = this.#getSearchTerm();
            
            // 検索対象がない場合は即座に隠す
            if (!searchInfo || !searchInfo.term) {
                this.#hide();
                return;
            }

            // カーソル位置を記録（入力中に変わる可能性があるため早めに取得）
            this.#termCursorPosition = {
                start: this.#el.selectionStart,
                end: this.#el.selectionEnd,
            };

            // 検索実行
            const searchResults = await this.#fetchSearchResults(searchInfo, currentSequence);
            
            // リクエストが古い場合は処理をスキップ
            if (currentSequence !== this.#requestSequence) {
                debug("古いリクエストをスキップ:", currentSequence, "現在:", this.#requestSequence);
                return;
            }

            // 結果が空の場合
            if (!searchResults || searchResults.length === 0) {
                this.#hide();
                return;
            }

            this.#items = this.#createDropdownItems(searchResults, searchInfo);
            this.#currentIndex = 0;
            this.#updateDropdownDisplay();

        } catch (error) {
            // AbortErrorは正常なキャンセルなのでログを出力しない
            if (error.name !== 'AbortError') {
                debug("タグ検索エラー:", error);
            }
            this.#hide();
        } finally {
            this.#isUpdating = false;
        }
    }

    /**
     * カーソル前の検索用語を取得
     * カテゴリフィルタープレフィックスの解析も含む
     */
    #getSearchTerm() {
        const beforeCursor = this.#helper.getBeforeCursor();
        if (!beforeCursor?.length) return null;

        const match = beforeCursor.match(/([^,;"|{}()\n]+)$/);
        if (!match) return null;

        const rawTerm = match[0].replace(/^\s+/, "");
        if (!rawTerm) return null;

        return this.#parseSearchTerm(rawTerm);
    }

    /**
     * 検索用語を解析してカテゴリフィルターと検索語を分離
     */
    #parseSearchTerm(rawTerm) {
        // カテゴリフィルターのチェック
        for (const [prefix, category] of Object.entries(TagCompleter.categoryFilters)) {
            if (rawTerm.toLowerCase().startsWith(prefix.toLowerCase())) {
                const term = rawTerm.slice(prefix.length).trim().replace(/\s/g, "_");
                return {
                    term: term || null,
                    category: category,
                    prefix: prefix,
                    fullTerm: rawTerm
                };
            }
        }

        // 通常の検索語
        return {
            term: rawTerm.replace(/\s/g, "_"),
            category: null,
            prefix: null,
            fullTerm: rawTerm
        };
    }

    /**
     * 検索結果を取得
     * AbortControllerを使用してリクエストのキャンセルを可能にする
     */
    async #fetchSearchResults(searchInfo, requestSequence) {
        // 新しいAbortControllerを作成
        this.#abortController = new AbortController();
        
        try {
            const requestBody = {
                term: searchInfo.term,
                ...(searchInfo.category && { category: searchInfo.category })
            };

            const response = await api.fetchApi(_endpoint("search"), {
                method: "POST",
                body: JSON.stringify(requestBody),
                signal: this.#abortController.signal, // キャンセル可能にする
            });

            // レスポンス取得時に再度シーケンス番号をチェック
            if (requestSequence !== this.#requestSequence) {
                throw new Error("リクエストが古くなりました");
            }

            let results = await response.json();
            
            // クライアントサイドでのカテゴリフィルタリング（APIが対応していない場合のフォールバック）
            if (searchInfo.category && results.length > 0) {
                results = this.#filterResultsByCategory(results, searchInfo.category);
            }
            
            if (TagCompleter.suggestionCount > 0) {
                results = results.slice(0, TagCompleter.suggestionCount);
            }

            return results;
        } catch (error) {
            // キャンセルされた場合はAbortErrorをそのまま投げる
            if (error.name === 'AbortError') {
                throw error;
            }
            // その他のエラーは再throw
            throw new Error(`検索リクエスト失敗: ${error.message}`);
        }
    }

    /**
     * カテゴリによる結果フィルタリング（クライアントサイドフォールバック）
     */
    #filterResultsByCategory(results, targetCategory) {
        return results.filter(item => {
            // 通常のカテゴリ判定
            if (item.category !== null && item.category !== undefined) {
                const categoryMap = {
                    0: "general",
                    1: "artist", 
                    2: "invalid", 
                    3: "copyright",
                    4: "character",
                    5: "meta",
                    6: "invalid", 
                    7: "general", 
                    8: "artist", 
                    9: "contributor", 
                    10: "copyright", 
                    11: "character", 
                    12: "species", 
                    13: "invalid", 
                    14: "meta", 
                    16: "lore"
                };
                
                const itemCategory = categoryMap[Number(item.category)];
                return itemCategory === targetCategory.toLowerCase();
            }

            // postCountが文字列の場合（Embedding, LoRA, Alias等）
            if (typeof item.postCount === "string") {
                const postCountLower = item.postCount.toLowerCase();
                return postCountLower === targetCategory.toLowerCase();
            }
            
            return false;
        });
    }

    // ===== ドロップダウンアイテム生成 =====

    /**
     * ドロップダウンアイテムを生成
     */
    #createDropdownItems(searchResults, searchInfo) {
        return searchResults.map(info => {
            const parts = this.#createItemParts(info, searchInfo);
            return this.#createDropdownItem(info, searchInfo, parts);
        });
    }

    /**
     * アイテムの構成要素を生成
     */
    #createItemParts(info, searchInfo) {
        const parts = [];

        // カテゴリフィルターが適用されている場合の表示
        if (searchInfo.category) {
            const categoryBadge = this.#createCategoryBadge(searchInfo.category);
            parts.push(categoryBadge);
        }

        // Wikiリンク
        if (TagCompleter.wikiLink) {
            const wikiLink = this.#createWikiLink(info);
            if (wikiLink) {
                parts.push(wikiLink);
            }
        }

        // テキスト部分
        parts.push(...this.#createTextParts(info, searchInfo.term));

        // 投稿数
        if (info.postCount) {
            parts.push(this.#createPill(String(info.postCount)));
        }

        // 説明
        if (info.description && info.category !== null) {
            const description = this.#createPill(String(info.description));
            this.#applyColorTheme(description, info.category);
            parts.push(description);
        }

        // サイト情報
        if (info.site) {
            parts.push(this.#createPill(String(info.site)));
        }

        return parts;
    }

    /**
     * カテゴリバッジを生成
     */
    #createCategoryBadge(category) {
        const badge = $el("span.jupo-tagcomplete-category-badge", { 
            textContent: category.toUpperCase() 
        });
        
        // カテゴリごとの色設定
        const categoryColors = {
            "artist": "#ff6b6b",
            "character": "#4ecdc4", 
            "copyright": "#45b7d1",
            "general": "#96ceb4",
            "meta": "#feca57",
            "species": "#ff9ff3",
            "lore": "#54a0ff",
            "embedding": "#5f27cd",
            "lora": "#00d2d3",
            "alias": "#ff6348"
        };
        
        const color = categoryColors[category.toLowerCase()] || "#gray";
        badge.style.backgroundColor = color;
        badge.style.color = "white";
        badge.style.fontSize = "0.8em";
        badge.style.padding = "2px 6px";
        badge.style.borderRadius = "3px";
        badge.style.marginRight = "4px";
        
        return badge;
    }

    /**
     * Wikiリンクを生成
     */
    #createWikiLink(info) {
        if (info.category === null) return null;

        const category = Number(info.category) || 0;
        const linkPart = encodeURIComponent(info.value);
        const baseUrl = category >= 6 
            ? "https://e621.net/wiki_pages/" 
            : "https://danbooru.donmai.us/wiki_pages/";

        return $el("a.jupo-tagcomplete-wikiLink", {
            textContent: "🔍",
            title: "Open external wiki page for this tag.",
            href: baseUrl + linkPart,
            target: "_blank",
            rel: "noopener noreferrer",
            onclick: (e) => e.stopPropagation(),
        });
    }

    /**
     * テキスト部分を生成
     */
    #createTextParts(info, term) {
        const parts = [];
        const regex = new RegExp(`(${term})`, "gi");
        const splitText = info.text.split(regex);

        splitText.forEach(part => {
            const element = $el("span", { textContent: part });
            
            if (part.toLowerCase() === term.toLowerCase()) {
                element.classList.add("jupo-tagcomplete-highlight");
            }
            
            this.#applySpecialStyles(element, info.postCount);
            parts.push(element);
        });

        return parts;
    }

    /**
     * 特別なスタイルを適用
     */
    #applySpecialStyles(element, postCount) {
        if (typeof postCount !== "string") return;

        const styleMap = {
            "Alias": "jupo-tagcomplete-alias",
            "Embedding": "jupo-tagcomplete-embeddings",
            "LoRA": "jupo-tagcomplete-loras",
        };

        const className = styleMap[postCount] || "jupo-tagcomplete-extra";
        element.classList.add(className);
    }

    /**
     * ピル要素を生成
     */
    #createPill(text) {
        return $el("span.jupo-tagcomplete-pill", { textContent: text });
    }

    /**
     * カラーテーマを適用
     */
    #applyColorTheme(element, category) {
        const colors = TagCompleter.colors?.[String(category)];
        if (colors) {
            element.style.setProperty("--pill-bg", colors);
        }
    }

    /**
     * ドロップダウンアイテムを生成
     */
    #createDropdownItem(info, searchInfo, parts) {
        return $el("div.jupo-tagcomplete-item", {
            onclick: (e) => this.#handleItemClick(e, info, searchInfo),
        }, parts);
    }

    /**
     * アイテムクリック処理
     */
    #handleItemClick(e, info, searchInfo) {
        if (e.target.classList.contains("jupo-tagcomplete-wikiLink")) return;

        this.#el.focus();
        this.#prevAllText = this.#el.value;

        if (this.#termCursorPosition) {
            this.#el.selectionStart = this.#termCursorPosition.start;
            this.#el.selectionEnd = this.#termCursorPosition.end;
        }

        const processedValue = this.#processTagValue(info);
        const separator = this.#getSeparator(info);

        // プレフィックス付きの場合はフルターム長を使用
        const replaceLength = searchInfo.prefix ? 
            -searchInfo.fullTerm.length : 
            -searchInfo.term.length;

        this.#helper.insertAtCursor(
            processedValue + separator,
            replaceLength
        );

        setTimeout(() => this.#hide(), 150);
    }

    /**
     * タグ値を処理
     */
    #processTagValue(info) {
        let value = info.value;
        
        // 通常タグの場合のみエスケープやリプレイス処理
        if (info.category !== null) {
            value = this.#escapeParentheses(value);
            value = this.#replaceUnderbarToSpace(value);
        }
        
        return value;
    }

    /**
     * 区切り文字を取得
     */
    #getSeparator(info) {
        const afterCursor = this.#helper.getAfterCursor();
        const shouldAddSeparator = !afterCursor.trim().startsWith(TagCompleter.separator.trim()) 
                                 && info.postCount !== "LoRA";
        
        if (!shouldAddSeparator) return "";
        
        let separator = TagCompleter.separator;
        if (separator && TagCompleter.insertSpace) {
            separator += " ";
        }
        
        return separator;
    }

    /**
     * 括弧をエスケープ
     */
    #escapeParentheses(text) {
        return text.replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    }

    /**
     * アンダーバーを空白に変換
     */
    #replaceUnderbarToSpace(text) {
        return TagCompleter.replaceUnderbar ? text.replace(/_/g, " ") : text;
    }

    // ===== ドロップダウン表示管理 =====

    /**
     * ドロップダウンの表示を更新
     */
    #updateDropdownDisplay() {
        this.#updateItemSelection();
        this.#updateDropdownContent();
        this.#updateDropdownPosition();
    }

    /**
     * アイテムの選択状態を更新
     */
    #updateItemSelection() {
        const selectedClassName = "jupo-tagcomplete-item--selected";
        
        this.#items.forEach((item, index) => {
            const isSelected = this.#currentIndex === index;
            item.classList.toggle(selectedClassName, isSelected);
            
            if (isSelected) {
                item.scrollIntoView({ block: "nearest", behavior: "auto" });
            }
        });
    }

    /**
     * ドロップダウンの内容を更新
     */
    #updateDropdownContent() {
        this.#dropdown.replaceChildren(...this.#items);
        
        if (!this.#dropdown.parentElement) {
            document.body.append(this.#dropdown);
        }
    }

    /**
     * ドロップダウンの位置を更新
     */
    #updateDropdownPosition() {
        const position = this.#helper.getCursorOffset();
        this.#dropdown.style.left = `${position.left ?? 0}px`;
        this.#dropdown.style.top = `${position.top ?? 0}px`;
        this.#dropdown.style.maxHeight = `${window.innerHeight - position.top}px`;
    }

    /**
     * 現在の検索リクエストをキャンセル
     */
    #cancelCurrentRequest() {
        if (this.#abortController) {
            this.#abortController.abort();
            this.#abortController = null;
        }
    }

    /**
     * ドロップダウンを非表示
     */
    #hide() {
        this.#cancelCurrentRequest();
        this.#items = null;
        this.#currentIndex = 0;
        this.#dropdown.remove();
    }
}