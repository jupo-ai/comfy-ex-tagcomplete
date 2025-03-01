import { debug } from "./utils.js";
import { getCaretCoordinates } from "./textarea-caret-position.js";

/**
 * テキストエリアのカーソル位置や行の高さを計算するヘルパークラス
 */
const CHAR_CODE_ZERO = "0".charCodeAt(0);
const CHAR_CODE_NINE = "9".charCodeAt(0);

export class TextAreaCaretHelper {
    constructor(el, getScale) {
        this.el = el;         // 対象のテキストエリア要素
        this.getScale = getScale; // スケールを取得する関数
    }

    /**
     * 要素のページ内オフセットを計算
     * @returns {{top: number, left: number}} - オフセット座標
     */
    #calculateElementOffset() {
        const rect = this.el.getBoundingClientRect();
        const owner = this.el.ownerDocument;
        if (!owner) throw new Error("要素がドキュメントに属していません");

        const { defaultView, documentElement } = owner;
        if (!defaultView) throw new Error("要素がウィンドウに属していません");

        const offset = {
            top: rect.top + defaultView.pageYOffset,
            left: rect.left + defaultView.pageXOffset,
        };

        if (documentElement) {
            offset.top -= documentElement.clientTop;
            offset.left -= documentElement.clientLeft;
        }
        return offset;
    }

    /**
     * 文字コードが数字（0〜9）か判定
     * @param {number} charCode - 文字コード
     * @returns {boolean}
     */
    #isDigit(charCode) {
        return CHAR_CODE_ZERO <= charCode && charCode <= CHAR_CODE_NINE;
    }

    /**
     * 行の高さをピクセル単位で取得
     * @returns {number} - 行の高さ（px）
     */
    #getLineHeightPx() {
        const computedStyle = getComputedStyle(this.el);
        const lineHeight = computedStyle.lineHeight;

        if (this.#isDigit(lineHeight.charCodeAt(0))) {
            const floatLineHeight = parseFloat(lineHeight);
            return this.#isDigit(lineHeight.charCodeAt(lineHeight.length - 1))
                ? floatLineHeight * parseFloat(computedStyle.fontSize)
                : floatLineHeight;
        }

        return this.#calclateLineHeightPx(this.el.nodeName, computedStyle);
    }

    /**
     * 行の高さを計算（"normal" などの場合）
     * @param {string} nodeName - 要素のノード名
     * @param {CSSStyleDeclaration} computedStyle - 計算済みスタイル
     * @returns {number} - 行の高さ（px）
     */
    #calclateLineHeightPx(nodeName, computedStyle) {
        const body = document.body;
        if (!body) return 0;

        const tempNode = document.createElement(nodeName);
        tempNode.innerHTML = " "; // 空白文字で高さを測定
        Object.assign(tempNode.style, {
            fontSize: computedStyle.fontSize,
            fontFamily: computedStyle.fontFamily,
            padding: "0",
            position: "absolute",
        });
        body.appendChild(tempNode);

        if (tempNode instanceof HTMLTextAreaElement) {
            tempNode.rows = 1;
        }

        const height = tempNode.offsetHeight;
        body.removeChild(tempNode);
        return height;
    }

    /**
     * 要素のスクロール量を取得
     * @returns {{top: number, left: number}} - スクロール量
     */
    #getElScroll() {
        return { top: this.el.scrollTop, left: this.el.scrollLeft };
    }

    /**
     * カーソルの現在位置を取得
     * @returns {{top: number, left: number}} - カーソル座標
     */
    #getCursorPosition() {
        return getCaretCoordinates(this.el, this.el.selectionEnd);
    }

    /**
     * カーソルの画面上オフセットを取得
     * @returns {{top: number, left?: number, right?: number, lineHeight: number, clientTop: number}}
     */
    getCursorOffset() {
        const scale = this.getScale();
        const elOffset = this.#calculateElementOffset();
        const elScroll = this.#getElScroll();
        const cursorPosition = this.#getCursorPosition();
        const lineHeight = this.#getLineHeightPx();
        const top = elOffset.top - (elScroll.top * scale) + (cursorPosition.top + lineHeight) * scale;
        const left = elOffset.left - elScroll.left + cursorPosition.left;
        const clientTop = this.el.getBoundingClientRect().top;

        if (this.el.dir !== "rtl") {
            return { top, left, lineHeight, clientTop };
        } else {
            const right = document.documentElement?.clientWidth - left || 0;
            return { top, right, lineHeight, clientTop };
        }
    }

    /**
     * カーソルより前のテキストを取得
     * @returns {string|null} - 選択中なら null、そうでなければテキスト
     */
    getBeforeCursor() {
        return this.el.selectionStart !== this.el.selectionEnd
            ? null
            : this.el.value.substring(0, this.el.selectionEnd);
    }

    /**
     * カーソルより後のテキストを取得
     * @returns {string} - テキスト
     */
    getAfterCursor() {
        return this.el.value.substring(this.el.selectionEnd);
    }

    /**
     * カーソル位置にテキストを挿入
     * @param {string} value - 挿入するテキスト
     * @param {number} offset - 挿入開始位置の調整値
     * @param {number} [finalOffset] - 挿入後のカーソル位置調整値
     */
    insertAtCursor(value, offset, finalOffset) {
        if (this.el.selectionStart != null) {
            const startPos = this.el.selectionStart;
            const endPos = this.el.selectionEnd;

            this.el.selectionStart = startPos + offset;
            this.el.setRangeText(value, this.el.selectionStart, endPos, "end");
            this.el.selectionStart = this.el.selectionEnd = startPos + value.length + offset + (finalOffset ?? 0);
        } else {
            debug("selectionStart が取得できませんでした");
            this.el.value += value;
        }
    }
}