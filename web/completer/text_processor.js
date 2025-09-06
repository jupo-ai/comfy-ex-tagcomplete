import { TagCompleterSettings } from "./tag_completer_settings.js";

// ==============================================
// テキスト処理とタグ値操作を担当するクラス
// ==============================================

export class TextProcessor {
    constructor() {
        this.settings = TagCompleterSettings;
    }


    // ------------------------------------------
    // 検索語句を取得 (カーソル前の文字列から)
    // ------------------------------------------
    getSearchTerm(beforeCursor) {
        if (!beforeCursor?.length) return null;

        const match = beforeCursor.match(/([^,;"|{}()\n]+)$/);
        if (!match) return null;

        const rawTerm = match[0].replace(/^\s+/, "");
        if (!rawTerm) return null;

        return rawTerm;
    }


    // ------------------------------------------
    // タグ値を処理 (エスケープ、アンダーバー処理)
    // ------------------------------------------
    processTagValue(result, searchInfo) {
        let value = result.value;

        // 複数のカスタムプレフィックスがある場合は順番に適用
        if (searchInfo.customPrefixes && searchInfo.customPrefixes.length > 0) {
            const prefixString = searchInfo.customPrefixes.join(" ") + " ";
            value = prefixString + value;
        }

        // 通常のタグの場合のみエスケープやリプレイス処理
        if (result.category !== null) {
            value = this.escapeParenteses(value);
            value = this.replaceUnderbarToSpace(value);
        }

        return value;
    }


    // ------------------------------------------
    // 区切り文字を取得
    // ------------------------------------------
    getDelimiter(result, afterCursor) {
        const shouldAddDelimiter = !afterCursor.trim().startsWith(this.settings.delimiter.trim()) 
                                    && result.postCount !== "LoRA";
        
        if (!shouldAddDelimiter) return "";

        let delimiter = this.settings.delimiter;
        if (delimiter && this.settings.addSpace) {
            delimiter += " ";
        }

        return delimiter;
    }


    // ------------------------------------------
    // 括弧をエスケープ
    // ------------------------------------------
    escapeParenteses(text) {
        return text.replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    }

    
    // ------------------------------------------
    // アンダーバーを空白に変換
    // ------------------------------------------
    replaceUnderbarToSpace(text) {
        return this.settings.replaceUnderbar ? text.replace(/_/g, " ") : text;
    }


    // ------------------------------------------
    // テキストを挿入するための最終的な値を生成
    // ------------------------------------------
    createInsertValue(result, searchInfo, afterCursor) {
        const processedValue = this.processTagValue(result, searchInfo);
        const delimiter = this.getDelimiter(result, afterCursor);

        return processedValue + delimiter;
    }


    // ------------------------------------------
    // 置換する文字数を計算
    // ------------------------------------------
    getReplaceLength(searchInfo) {
        return -searchInfo.fullTerm.length;
    }
}