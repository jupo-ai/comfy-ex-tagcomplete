import { api_post } from "../utils.js";
import { TagCompleterSettings } from "./tag_completer_settings.js";

// ==============================================
// 検索処理とAPIリクエストを担当するクラス
// ==============================================

export class SearchEngine {
    // ------------------------------------------
    // プライベートプロパティ
    // ------------------------------------------
    #abortController = null;
    #requestSequence = 0;
    #isUpdating = false;

    constructor() {
        this.settings = TagCompleterSettings;
    }

    // ------------------------------------------
    // 検索用語を解析して
    // カテゴリフィルタ、プレフィックス、検索語句を分離
    // ------------------------------------------
    parseSearchTerm(rawTerm) {
        let remainingTerm = rawTerm;
        let customPrefixes = [];
        let categoryFilters = [];

        // すべてのプレフィックス(++と--)を順序に関係なく抽出
        while (true) {
            let foundPrefix = false;

            // カスタムプレフィックス(++)の検出と抽出
            const customPrefixMatch = remainingTerm.match(/\+\+([^-+\s]+)/);
            if (customPrefixMatch) {
                customPrefixes.push(customPrefixMatch[1]);
                remainingTerm = remainingTerm.replace(customPrefixMatch[0], '').trim();
                foundPrefix = true;
            }

            // カテゴリフィルター(--)の検出と抽出
            const categoryFilterMatch = remainingTerm.match(/\-\-([^-+\s]+)/);
            if (categoryFilterMatch) {
                categoryFilters.push(categoryFilterMatch[1]);
                remainingTerm = remainingTerm.replace(categoryFilterMatch[0], '').trim();
                foundPrefix = true;
            }

            if (!foundPrefix) break;
        }

        // 残りの文字列を検索語句として処理
        const searchTerm = remainingTerm.replace(/\s/g, "_").trim();

        // 2文字から検索する
        // 日本語（ひらがな、カタカナ、漢字）が含まれるかチェックする正規表現
        const japaneseRegex = /[\u3040-\u30FF\u4E00-\u9FFF]/;
        if (!japaneseRegex.test(searchTerm) && searchTerm.length < 2) {
            return null;
        }

        return {
            term: searchTerm || null, 
            customPrefixes: customPrefixes, 
            categoryFilters: categoryFilters, 
            fullTerm: rawTerm, 
        };
    }


    // ------------------------------------------
    // 検索結果を取得
    // ------------------------------------------
    async fetchSearchResults(searchInfo, requestSequence) {
        // 新しいAbortControllerを作成
        this.#abortController = new AbortController();

        try {
            const body = {
                term: searchInfo.term, 
                filters: searchInfo.categoryFilters, 
            };

            const response = await api_post(
                "search", 
                body, 
                { signal: this.#abortController.signal }
            );

            // レスポンス取得時に再度シーケンス番号をチェック
            if (requestSequence !== this.#requestSequence) {
                throw new Error("リクエストが古くなりました");
            }

            return response;
        
        } catch (error) {
            if (error.name === "AbortError") {
                throw error;
            }
            throw new Error(`検索リクエスト失敗: ${error.message}`);
        }
    }


    // ------------------------------------------
    // 現在のリクエストをキャンセル
    // ------------------------------------------
    cancelCurrentRequest() {
        if (this.#abortController) {
            this.#abortController.abort();
            this.#abortController = null;
        }
    }


    // ------------------------------------------
    // リクエストシーケンス
    // ------------------------------------------
    // --- リクエストシーケンス番号を取得 ---
    getNextSequence() {
        return ++this.#requestSequence;
    }

    // --- 現在のシーケンス番号を取得 ---
    getCurrentSequence() {
        return this.#requestSequence;
    }


    // ------------------------------------------
    // 更新の状態
    // ------------------------------------------
    setUpdating(isUpdating) {
        this.#isUpdating = isUpdating;
    }

    isUpdating() {
        return this.#isUpdating;
    }


    // ------------------------------------------
    // クリーンアップ
    // ------------------------------------------
    destroy() {
        this.cancelCurrentRequest();
        this.#requestSequence = 0;
        this.#isUpdating = false;
    }
}