import { api } from "../../scripts/api.js";
import { $el } from "../../scripts/ui.js";
import { _endpoint, addStylesheet, debug } from "./utils.js";
import { TextAreaCaretHelper } from "./caret_helper.js";

addStylesheet(import.meta.url);

/**
 * タグ補完機能を提供するクラス
 */
export class TagCompleter {
    static enabled = true;          // オートコンプリート機能の有効/無効
    static separator = ",";         // 候補挿入時の区切り文字
    static insertSpace = true;      // 区切り文字後に空白を挿入するか
    static insertOnTab = true;      // Tabキーで候補を挿入するか
    static insertOnEnter = true;    // Enterキーで候補を挿入するか
    static suggestionCount = 20;    // 表示する候補数
    static replaceUnderbar = true;  // アンダーバーを空白に変換するか
    static wikiLink = false;        // Wikiリンクボタンを表示するか
    static colors = {};             // カテゴリごとの色（JSONから読み込み）
    static delay = 50;              // デバウンスのディレイ値
    static instanceArray = [];      // インスタンスをグローバルで管理

    el;                             // 関連するtextarea要素
    helper;                         // テキストエリアのカーソル操作ヘルパー
    dropdown;                       // ドロップダウン要素
    items;                          // ドロップダウンの選択肢リスト
    currentIndex = 0;               // 現在選択中のインデックス
    prevAllText = null;             // Undo用に保存する前のテキスト
    #termCursoPosition = null;      // term取得時のカーソル位置を保持
    #debouncedUpdate;               // デバウンス処理された更新関数

    constructor(el) {
        this.el = el;
        this.helper = new TextAreaCaretHelper(el, () => app.canvas.ds.scale);
        this.dropdown = $el("div.jupo-tagcomplete");
        this.#setup();
        this.#updateDebouncedUpdate();
        TagCompleter.instanceArray.push(this);
    }

    #updateDebouncedUpdate() {
        this.#debouncedUpdate = this.debounce(() => this.#update(), TagCompleter.delay);
    }

    #setup() {
        this.el.addEventListener("keydown", this.#onKeyDown.bind(this));
        this.el.addEventListener("input", this.#onInput.bind(this));
        this.el.addEventListener("click", this.#hide.bind(this));
        this.el.addEventListener("blur", () => setTimeout(() => this.#hide(), 150));
    }

    async #onKeyDown(e) {
        if (!TagCompleter.enabled) return;

        if (this.dropdown.parentElement) {
            switch (e.key) {
                case "ArrowUp":
                    this.currentIndex -= 1;
                    if (this.currentIndex < 0) this.currentIndex = this.items.length - 1;
                    this.#updateItems();
                    e.preventDefault();
                    break;
                case "ArrowDown":
                    this.currentIndex += 1;
                    if (this.currentIndex >= this.items.length) this.currentIndex = 0;
                    this.#updateItems();
                    e.preventDefault();
                    break;
                case "Tab":
                    if (TagCompleter.insertOnTab) {
                        this.#insertItem();
                        e.preventDefault();
                    }
                    break;
                case "Enter":
                    if (!e.ctrlKey && TagCompleter.insertOnEnter) {
                        this.#insertItem();
                        e.preventDefault();
                    }
                    break;
                case "Escape":
                    this.#hide();
                    e.preventDefault();
                    break;
            }
        }
    }

    async #onInput(e) {
        if (!TagCompleter.enabled) return;
        this.#debouncedUpdate();
    }

    #insertItem() {
        if (!this.items) return;
        this.#debouncedUpdate();
        this.items[this.currentIndex].click();
    }

    debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    }

    async #update() {
        const term = this.#getTermBeforeCursor();
        if (!term) {
            this.#hide();
            return;
        }
        this.#termCursoPosition = {
            start: this.el.selectionStart,
            end: this.el.selectionEnd,
        };

        const words = await this.#getSearchResult(term);
        this.items = await this.#createDropdownItems(words, term);
        this.currentIndex = 0;
        this.#updateItems();
    }

    #getTermBeforeCursor() {
        const before = this.helper.getBeforeCursor();
        if (!before?.length) return null;

        const m = before.match(/([^,;"|{}()\n]+)$/);
        return m ? m[0].replace(/^\s+/, "").replace(/\s/g, "_") || null : null;
    }

    async #getSearchResult(term) {
        const body = { term: term };
        const res = await api.fetchApi(_endpoint("search"), {
            method: "POST",
            body: JSON.stringify(body),
        });
        let words = await res.json();
        if (TagCompleter.suggestionCount > 0) {
            words = words.slice(0, TagCompleter.suggestionCount);
        }
        return words;
    }

    #createDropdownItems(words, term) {
        return words.map(info => {
            const parts = [];

            if (TagCompleter.wikiLink) {
                const wikiLink = this.#createWikiLink(info);
                if (wikiLink) {
                    parts.push(wikiLink);
                }
            }

            parts.push(...this.#createTextParts(info, term));

            if (info.postCount) {
                parts.push($el("span.jupo-tagcomplete-pill", { textContent: String(info.postCount) }));
            }

            if (info.description && info.category !== null) {
                const description = $el("span.jupo-tagcomplete-pill", { textContent: String(info.description) });
                const colors = TagCompleter.colors?.[String(info.category)];
                if (colors) {
                    description.style.setProperty("--pill-bg", colors);
                }
                parts.push(description);
            }

            if (info.site) {
                parts.push($el("span.jupo-tagcomplete-pill", { textContent: String(info.site) }));
            }

            return this.#createDropdownItem(info, term, parts);
        });
    }

    #createWikiLink(info) {
        // categoryがnullの場合はリンクを作成しない
        if (info.category === null) {
            return null;
        }

        const category = Number(info.category) || 0;
        const linkPart = encodeURIComponent(info.value);
        const href = category >= 6
            ? `https://e621.net/wiki_pages/${linkPart}`
            : `https://danbooru.donmai.us/wiki_pages/${linkPart}`;

        return $el("a.jupo-tagcomplete-wikiLink", {
            textContent: "🔍",
            title: "Open external wiki page for this tag.",
            href: href,
            target: "_blank",
            rel: "noopener noreferrer",
            onclick: (e) => {
                e.stopPropagation();
            },
        });
    }

    #createTextParts(info, term) {
        const textParts = [];
        const splitText = info.text.split(new RegExp(`(${term})`, "gi"));

        splitText.forEach(part => {
            const el = $el("span", { textContent: part });
            if (part.toLowerCase() === term.toLowerCase()) {
                el.classList.add("jupo-tagcomplete-highlight");
            }
            if (typeof info.postCount === "string") {
                switch (info.postCount) {
                    case "Alias": 
                        el.classList.add("jupo-tagcomplete-alias");
                        break;
                    case "Embedding":
                        el.classList.add("jupo-tagcomplete-embeddings");
                        break;
                    case "LoRA":
                        el.classList.add("jupo-tagcomplete-loras");
                        break;
                    default:
                        el.classList.add("jupo-tagcomplete-extra");
                }
            }
            textParts.push(el);
        });

        return textParts;
    }

    #createDropdownItem(info, term, parts) {
        return $el("div.jupo-tagcomplete-item", {
            onclick: (e) => {
                if (e.target.classList.contains("jupo-tagcomplete-wikiLink")) return;

                this.el.focus();
                this.prevAllText = this.el.value;

                if (this.#termCursoPosition) {
                    this.el.selectionStart = this.#termCursoPosition.start;
                    this.el.selectionEnd = this.#termCursoPosition.end;
                }
                
                let value = info.value;
                // 通常タグの場合のみエスケープやリプレイス処理
                if (info.category !== null) {
                    value = this.#escapeParentheses(info.value);
                    value = this.#replaceUnderbarToSpace(value);
                }

                const afterCursor = this.helper.getAfterCursor();
                const shouldAddSeparator = !afterCursor.trim().startsWith(TagCompleter.separator.trim())
                                            && (info.postCount !== "LoRA"); // loraの場合はセパレータを付けない
                let separator = TagCompleter.separator;
                if (separator && TagCompleter.insertSpace) {
                    separator += " ";
                }

                this.helper.insertAtCursor(
                    value + (shouldAddSeparator ? separator : ""),
                    -term.length,
                );
                setTimeout(() => this.#hide(), 150);
            },
        }, parts);
    }

    #escapeParentheses(text) {
        return text.replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    }

    #replaceUnderbarToSpace(text) {
        if (!TagCompleter.replaceUnderbar) return text;
        return text.replace(/_/g, " ");
    }

    #updateItems() {
        const selectedClassName = "jupo-tagcomplete-item--selected";
        this.items.forEach((item, i) => {
            item.classList.toggle(selectedClassName, this.currentIndex === i);
            if (this.currentIndex === i) {
                item.scrollIntoView({ block: "nearest", behavior: "auto" });
            }
        });

        this.dropdown.replaceChildren(...this.items);
        if (!this.dropdown.parentElement) {
            document.body.append(this.dropdown);
        }

        const position = this.helper.getCursorOffset();
        this.dropdown.style.left = `${position.left ?? 0}px`;
        this.dropdown.style.top = `${position.top ?? 0}px`;
        this.dropdown.style.maxHeight = `${window.innerHeight - position.top}px`;
    }

    #hide() {
        this.items = null;
        this.currentIndex = 0;
        this.dropdown.remove();
    }

    static updateDelay(value) {
        TagCompleter.delay = value;
        TagCompleter.instanceArray.forEach(instance => instance.#updateDebouncedUpdate());
    }
}