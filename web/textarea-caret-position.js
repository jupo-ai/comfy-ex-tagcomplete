/*
    https://github.com/component/textarea-caret-position
*/

// コピーするプロパティ一覧
// 一部のブラウザ(例: Firefox)は省略形のプロパティを結合しないため、
// すべてのプロパティを明示的にリストアップする
const properties = [
    "direction", // 文字の方向(RTL対応)
    "boxSizing", 
    "width", // ChromeやIEではスクロールバーを場外して、テキストエリアと同じ幅にする
    "height", 
    "overflowX", 
    "overflowY", 

    "borderTopWidth", 
    "borderRightWidth", 
    "borderBottomWidth", 
    "borderLeftWidth", 

    "paddingTop", 
    "paddingRight", 
    "paddingBottom", 
    "paddingLeft", 

    // フォント関連のプロパティ
    "fontStyle", 
    "fontVariant", 
    "fontStretch", 
    "fontSize", 
    "fontSizeAdjust", 
    "lineHeight", 
    "fontFamily", 

    "textAlign", 
    "textTransform", 
    "textIndent", 
    "textDecoration", 

    "letterSpacing", 
    "wordSpacing", 
    
    "tabSize", 
    "MozTabSize", 
];
const isBrowser = typeof window !== "undefined";
const isFirefox = isBrowser && window.mozinnerScreenX != null;

export function getCaretCoordinates(element, position, options) {
    if (!isBrowser) {
        throw new Error("getCaretCoordinates はブラウザ環境でのみ使用可能です。");
    }

    const debug = (options && options.debug) || false;
    if (debug) {
        const el = document.querySelector("#input-textarea-caret-position-mirror-div");
        if (el) el.parentNode.removeChild(el);
    }

    // キャレット位置を計算するための「ミラー」要素を作成
    const div = document.createElement("div");
    div.id = "input-textarea-caret-posiion-mirror-div";
    document.body.appendChild(div);

    const style = div.style;
    const computed = window.getComputedStyle ? window.getComputedStyle(element) : element.currentStyle; // IE < 9 対応
    const isInput = element.nodeName === "INPUT";

    // テキストエリアのデフォルトスタイル
    style.whiteSpace = "pre-wrap";
    if (!isInput) style.overflowWrap = "break-word"; // テキストエリア用
    
    // 画面外に配置
    style.position = "absolute";
    if (!debug) style.visibility = "hidden";

    // 元の要素のスタイルをミラー要素にコピー
    properties.forEach(function(prop) {
        if (isInput && prop === "lineHeight") {
            // <input> の場合、lineHeight が height と一致しない可能性があるため特別処理
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
        // Firefoxはテキストエリアの overflow プロパティを誤って報告するため修正
        if (element.scrollHeight > parseInt(computed.height)) style.overflowY = "scroll";
    } else {
        style.overflow = "hidden"; // Chromeではスクロールバーを表示させない
    }

    // キャレットの位置までのテキストをミラー要素にコピー
    div.textContent = element.value.substring(0, position);

    // <input> 要素の場合、スペースを非改行スペースに変換
    if (isInput) div.textContent = div.textContent.replace(/\s/g, "\u00a0");

    const span = document.createElement("span");
    // キャレットの正確な位置を特定するため、残りのテキストを span に入れる
    span.textContent = element.value.substring(position) || "."; // 空だと描画されないため「.」を使用
    div.appendChild(span);

    // キャレットの座標を取得
    const coordinates = {
        top: span.offsetTop + parseInt(computed["borderTopWidth"]), 
        left: span.offsetLeft + parseInt(computed["borderLeftWidth"]), 
        height: parseInt(computed["lineHeight"]), 
    };

    if (debug) {
        span.style.backgroundColor = "#aaa";
    } else {
        document.body.removeChild(div); // デバッグでない場合は削除
    }
    
    return coordinates;
}