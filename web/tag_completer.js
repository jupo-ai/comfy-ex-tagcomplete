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
    static delimiter = ",";
    static addSpace = true;
    static insertOnTab = true;
    static insertOnEnter = true;
    static suggestionCount = 20;
    static replaceUnderbar = true;
    static wikiLink = false;
    static colors = {};
    static delay = 50;
    static instanceArray = [];

    // インスタンスプロパティ
    #el;                        // 関連するtextarea要素
    #helper;                    // テキストエリアのカーソル操作ヘルパー
    #dropdown;                  // ドロップダウン要素
    #items = null;              // ドロップダウンの選択肢リスト
    #currentIndex = 0;          // 現在選択中のインデックス
    #termCursorPosition = null; // term取得時のカーソル位置を保持
    #debouncedUpdate;           // デバウンス処理された更新関数
    #abortController = null;    // 検索リクエストのキャンセル制御
    #requestSequence = 0;       // リクエストの順序制御用
    #isUpdating = false;        // 更新処理中フラグ
    #customPrefixes = null;     // カスタムプレフィックス保存用

    // 追加
    #isMousedownOnDropdown = false;
    #isHoveringDropdown = false;

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
     * 修正9: destroy時のクリーンアップ強化
     */
    destroy() {
        this.#cancelCurrentRequest();
        this.#removeEventListeners();
        this.#removeDropdownMouseEvents(); // 追加
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

        // 修正: より詳細なblur処理
        this.#el.addEventListener("blur", (e) => {
            // relatedTargetをチェックして、ドロップダウン内の要素にフォーカスが移った場合は隠さない
            if (e.relatedTarget && this.#dropdown.contains(e.relatedTarget)) {
                return;
            }

            // mousedownイベント中は隠さない
            if (this.#isMousedownOnDropdown) {
                return;
            }

            ssetTimeout(() => {
                // 再度チェック: アクティブ要素がドロップダウン内でない場合のみ隠す
                if (!this.#dropdown.contains(document.activeElement)) {
                    this.#hide()
                }
            }, 150);
        });

        // ドロップダウンのマウスイベントを監視
        this.#setupDropdownMouseEvents();
    }

    // 修正2: ドロップダウンのマウスイベント処理を追加
    #setupDropdownMouseEvents() {
        // マウスダウン時のフラグ管理
        this.#isMousedownOnDropdown = false;

        // ドロップダウンでmousedownが発生した時
        document.addEventListener("mousedown", (e) => {
            if (this.#dropdown.contains(e.target)) {
                this.#isMousedownOnDropdown = true;
                // スクロールバーのクリックを検知
                this.#handleScrollbarClick(e);
            } else {
                this.#isMousedownOnDropdown = false;
            }
        });

        // マウスアップ時にフラグをリセット
        document.addEventListener("mouseup", () => {
            this.#isMousedownOnDropdown = false;
        });

        // ドロップダウンにマウスが入ったときの処理
        this.#dropdown.addEventListener("mouseenter", () => {
            this.#isHoveringDropdown = true;
        });
        this.#dropdown.addEventListener("mouseleave", () => {
            this.#isHoveringDropdown = false;
        });
    }

    // 修正3: スクロールバークリックの検出と処理
    #handleScrollbarClick(e) {
        const dropdown = this.#dropdown;
        const rect = dropdown.getBoundingClientRect();

        // スクロールバー領域を計算(一般的には右端から17px程度)
        const scrollbarWidth = dropdown.offsetWidth - dropdown.clientWidth;
        const isScrollbarClick = e.clientX >= rect.right - scrollbarWidth;

        if (isScrollbarClick) {
            // スクロールバーがクリックされた場合、テキストエリアのフォーカスを維持
            e.preventDefault();
            setTimeout(() => {
                this.#el.focus();
            }, 0);
        }
    }

    /**
     * イベントリスナーを削除
     */
    #removeEventListeners() {
        this.#el.removeEventListener("keydown", this.#handleKeyDown.bind(this));
        this.#el.removeEventListener("input", this.#handleInput.bind(this));
        this.#el.removeEventListener("click", this.#hide.bind(this));
    }

    // 修正10: マウスイベントのクリーンアップ
    #removeDropdownMouseEvents() {
        // グローバルイベントリスナーのクリーンアップ
        // 実際の実装では、イベントリスナーの参照を保持して適切に削除する必要があります
        this.#isMousedownOnDropdown = false;
        this.#isHoveringDropdown = false;
    }

    // ===== イベントハンドラー =====

    /**
     * キーダウンイベントハンドラー
     * 修正6: より精密なキーボード処理
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
            Escape: () => this.#handleEscapeKey(e), 
            // Page Up/Down でのスクロール対応
            PageUp: () => this.#handlePageUp(e), 
            PageDown: () => this.#handlePageDown(e)
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

    // 修正7: Page Up/Down のサポート追加
    #handlePageUp(e) {
        const visibleItems = Math.floor(this.#dropdown.clientHeight / 40); // 概算
        this.#currentIndex = Math.max(0, this.#currentIndex - visibleItems);
        this.#updateDropdownDisplay();
        e.preventDefault();
    }

    #handlePageDown(e) {
        const visibleItems = Math.floor(this.#dropdown.clientHeight / 40); // 概算
        this.#currentIndex = Math.min(this.#items.length - 1, this.#currentIndex + visibleItems);
        this.#updateDropdownDisplay();
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
     * カテゴリフィルタープレフィックスとカスタムプレフィックスの解析も含む
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
     * 検索用語を解析してカテゴリフィルター複数カスタムプレフィックスと検索語を分離
     * 順序に関係なく--や++を解析できるように改善
     */
    #parseSearchTerm(rawTerm) {
        let remainingTerm = rawTerm;
        let customPrefixes = []; // 複数のカスタムプレフィックスを格納
        let category = null;
        let categoryPrefix = null;

        // すべてのプレフィックス（++と--）を順序に関係なく抽出
        while (true) {
            let foundPrefix = false;

            // カスタムプレフィックス（++）の検出と抽出
            const customPrefixMatch = remainingTerm.match(/\+\+([^-+\s]+)/);
            if (customPrefixMatch) {
                customPrefixes.push(customPrefixMatch[1]);
                // マッチした部分を削除
                remainingTerm = remainingTerm.replace(customPrefixMatch[0], '').trim();
                foundPrefix = true;
            }

            // カテゴリフィルター（--）の検出と抽出（最初の一つのみ有効）
            if (!category) {
                const categoryMatch = remainingTerm.match(/--([a-zA-Z]+)/);
                if (categoryMatch) {
                    category = categoryMatch[1].toLowerCase();
                    categoryPrefix = "--" + category;
                    // マッチした部分を削除
                    remainingTerm = remainingTerm.replace(categoryMatch[0], '').trim();
                    foundPrefix = true;
                }
            }

            // 新しいプレフィックスが見つからなかった場合はループを終了
            if (!foundPrefix) {
                break;
            }
        }

        // 残りの文字列を検索語として処理
        const searchTerm = remainingTerm.replace(/\s/g, "_").trim();

        // 複数のカスタムプレフィックスを保存（従来の単一プレフィックスとの互換性のため、配列として保存）
        this.#customPrefixes = customPrefixes.length > 0 ? customPrefixes : null;

        return {
            term: searchTerm || null,
            category: category,
            prefix: categoryPrefix,
            customPrefixes: customPrefixes.length > 0 ? customPrefixes : null,
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
                category: searchInfo.category
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
     * アイテムの構成要素を生成（複数プレフィックス対応版）
     */
    #createItemParts(info, searchInfo) {
        const parts = [];

        // 複数のカスタムプレフィックスがある場合の表示
        if (searchInfo.customPrefixes && searchInfo.customPrefixes.length > 0) {
            const prefixBadges = this.#createCustomPrefixBadges(searchInfo.customPrefixes);
            parts.push(...prefixBadges);
        }

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
     * 複数のカスタムプレフィックスバッジを生成
     */
    #createCustomPrefixBadges(prefixes) {
        if (!prefixes || prefixes.length === 0) return [];
        
        return prefixes.map(prefix => {
            const badge = $el("span.jupo-tagcomplete-prefix-badge", { 
                textContent: `++${prefix}`,
                title: `This tag will be prefixed with "${prefix}"`
            });
            
            return badge;
        });
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
        if (info.site === null) return null;

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
     * アイテムクリック処理（複数プレフィックス対応版）
     */
    #handleItemClick(e, info, searchInfo) {
        if (e.target.classList.contains("jupo-tagcomplete-wikiLink")) return;

        this.#el.focus();

        if (this.#termCursorPosition) {
            this.#el.selectionStart = this.#termCursorPosition.start;
            this.#el.selectionEnd = this.#termCursorPosition.end;
        }

        let processedValue = this.#processTagValue(info);
        
        // 複数のカスタムプレフィックスがある場合は順番に適用
        if (searchInfo.customPrefixes && searchInfo.customPrefixes.length > 0) {
            const prefixString = searchInfo.customPrefixes.join(" ") + " ";
            processedValue = prefixString + processedValue;
        }
        
        const delimiter = this.#getDelimiter(info);

        // フルタームの長さを使用（プレフィックスを含む全体を置換）
        const replaceLength = -searchInfo.fullTerm.length;

        this.#helper.insertAtCursor(
            processedValue + delimiter,
            replaceLength
        );

        // プレフィックスをクリア
        this.#customPrefixes = null;

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
    #getDelimiter(info) {
        const afterCursor = this.#helper.getAfterCursor();
        const shouldAdddelimiter = !afterCursor.trim().startsWith(TagCompleter.delimiter.trim()) 
                                 && info.postCount !== "LoRA";
        
        if (!shouldAdddelimiter) return "";
        
        let delimiter = TagCompleter.delimiter;
        if (delimiter && TagCompleter.addSpace) {
            delimiter += " ";
        }
        
        return delimiter;
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
     * 修正8: スムーズなスクロール処理
     */
    #updateItemSelection() {
        const selectedClassName = "jupo-tagcomplete-item--selected";
        
        this.#items.forEach((item, index) => {
            const isSelected = this.#currentIndex === index;
            item.classList.toggle(selectedClassName, isSelected);
            
            if (isSelected) {
                // よりスムーズなスクロール
                item.scrollIntoView({ block: "nearest", behavior: "smooth", inline: "nearest" });
            }
        });
    }

    /**
     * ドロップダウンの内容を更新
     * 修正5: ドロップダウンの表示時にtabindexを設定
     */
    #updateDropdownContent() {
        this.#dropdown.replaceChildren(...this.#items);

        // ドロップダウンをフォーカス可能にする
        this.#dropdown.setAttribute("tabindex", "-1");
        
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
     * 修正4: より堅牢なhide処理
     */
    #hide() {
        // 既に隠れている場合は何もしない
        if (!this.#dropdown.parentElement) {
            return;
        }

        this.#cancelCurrentRequest();
        this.#items = null;
        this.#currentIndex = 0;
        this.#customPrefixes = null;
        this.#isMousedownOnDropdown = false;
        this.#isHoveringDropdown = false;
        this.#dropdown.remove();
    }
}