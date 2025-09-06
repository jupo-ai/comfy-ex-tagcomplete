/**
* テキストエリアのキャレット座標計算とテキスト操作を統合したクラス
*/
const CHAR_CODE_ZERO = "0".charCodeAt(0);
const CHAR_CODE_NINE = "9".charCodeAt(0);

// キャレット座標計算用のプロパティ一覧
const COPY_PROPERTIES = [
   "direction", "boxSizing", "width", "height", "overflowX", "overflowY",
   "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
   "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
   "fontStyle", "fontVariant", "fontStretch", "fontSize", "fontSizeAdjust", 
   "lineHeight", "fontFamily", "textAlign", "textTransform", "textIndent", 
   "textDecoration", "letterSpacing", "wordSpacing", "tabSize", "MozTabSize"
];

const isBrowser = typeof window !== "undefined";
const isFirefox = isBrowser && window.mozInnerScreenX != null;

export class TextAreaCaretHelper {
   constructor(el, getScale) {
       this.el = el;
       this.getScale = getScale;
   }

   // === キャレット座標計算 ===
   
   #getCaretCoordinates(position, options = {}) {
       if (!isBrowser) {
           throw new Error("ブラウザ環境でのみ使用可能です");
       }

       const debug = options.debug || false;
       if (debug) {
           const el = document.querySelector("#input-textarea-caret-position-mirror-div");
           if (el) el.parentNode.removeChild(el);
       }

       const div = document.createElement("div");
       div.id = "input-textarea-caret-position-mirror-div";
       document.body.appendChild(div);

       const style = div.style;
       const computed = window.getComputedStyle ? window.getComputedStyle(this.el) : this.el.currentStyle;
       const isInput = this.el.nodeName === "INPUT";

       style.whiteSpace = "pre-wrap";
       if (!isInput) style.overflowWrap = "break-word";
       
       style.position = "absolute";
       if (!debug) style.visibility = "hidden";

       COPY_PROPERTIES.forEach(prop => {
           if (isInput && prop === "lineHeight") {
               if (computed.boxSizing === "border-box") {
                   const height = parseInt(computed.height);
                   const outerHeight = 
                       parseInt(computed.paddingTop) + 
                       parseInt(computed.paddingBottom) + 
                       parseInt(computed.borderTopWidth) + 
                       parseInt(computed.borderBottomWidth);
                   const targetHeight = outerHeight + parseInt(computed.lineHeight);
                   if (height > targetHeight) {
                       style.lineHeight = height - outerHeight + "px";
                   } else if(height === targetHeight) {
                       style.lineHeight = computed.lineHeight;
                   } else {
                       style.lineHeight = 0;
                   }
               } else {
                   style.lineHeight = computed.height;
               }
           } else {
               style[prop] = computed[prop];
           }
       });

       if (isFirefox) {
           if (this.el.scrollHeight > parseInt(computed.height)) style.overflowY = "scroll";
       } else {
           style.overflow = "hidden";
       }

       div.textContent = this.el.value.substring(0, position);
       if (isInput) div.textContent = div.textContent.replace(/\s/g, "\u00a0");

       const span = document.createElement("span");
       span.textContent = this.el.value.substring(position) || ".";
       div.appendChild(span);

       const coordinates = {
           top: span.offsetTop + parseInt(computed["borderTopWidth"]), 
           left: span.offsetLeft + parseInt(computed["borderLeftWidth"]), 
           height: parseInt(computed["lineHeight"]), 
       };

       if (debug) {
           span.style.backgroundColor = "#aaa";
       } else {
           document.body.removeChild(div);
       }
       
       return coordinates;
   }

   // === 座標計算系 ===
   
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

   #isDigit(charCode) {
       return CHAR_CODE_ZERO <= charCode && charCode <= CHAR_CODE_NINE;
   }

   #getLineHeightPx() {
       const computedStyle = getComputedStyle(this.el);
       const lineHeight = computedStyle.lineHeight;

       if (this.#isDigit(lineHeight.charCodeAt(0))) {
           const floatLineHeight = parseFloat(lineHeight);
           return this.#isDigit(lineHeight.charCodeAt(lineHeight.length - 1))
               ? floatLineHeight * parseFloat(computedStyle.fontSize)
               : floatLineHeight;
       }

       return this.#calculateLineHeightPx(this.el.nodeName, computedStyle);
   }

   #calculateLineHeightPx(nodeName, computedStyle) {
       const body = document.body;
       if (!body) return 0;

       const tempNode = document.createElement(nodeName);
       tempNode.innerHTML = " ";
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

   #getElScroll() {
       return { top: this.el.scrollTop, left: this.el.scrollLeft };
   }

   #getCursorPosition() {
       return this.#getCaretCoordinates(this.el.selectionEnd);
   }

   // === パブリックメソッド ===
   
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

   getBeforeCursor() {
       return this.el.selectionStart !== this.el.selectionEnd
           ? null
           : this.el.value.substring(0, this.el.selectionEnd);
   }

   getAfterCursor() {
       return this.el.value.substring(this.el.selectionEnd);
   }

   insertAtCursor(value, offset, finalOffset) {
       if (this.el.selectionStart != null) {
           const startPos = this.el.selectionStart;
           const endPos = this.el.selectionEnd;

           this.el.selectionStart = startPos + offset;
           this.el.setRangeText(value, this.el.selectionStart, endPos, "end");
           this.el.selectionStart = this.el.selectionEnd = startPos + value.length + offset + (finalOffset ?? 0);
       } else {
           console.warn("selectionStart が取得できませんでした");
           this.el.value += value;
       }
   }
}