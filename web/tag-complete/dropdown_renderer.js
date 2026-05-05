import { $el } from "../../../scripts/ui.js";
import { TagCompleterSettings } from "./tag_completer_settings.js";

const WIKI_SITES = {
    danbooru: {
        label: "Danbooru",
        buildUrl: ({ tag }) => `https://danbooru.donmai.us/wiki_pages/${tag}`,
    },
    e621: {
        label: "e621",
        buildUrl: ({ tag }) => `https://e621.net/wiki_pages/${tag}`,
    },
    gelbooru: {
        label: "Gelbooru",
        buildUrl: ({ tag }) => {
            if (!tag) return null;
            return `https://gelbooru.com/index.php?page=wiki&s=list&search=${encodeURIComponent(tag)}`;
        },
    },
};

// ==============================================
// ドロップダウンの描画とDOM操作を担当するクラス
// ==============================================

export class DropdownRenderer {
    constructor() {
        this.settings = TagCompleterSettings;
    }

    // ------------------------------------------
    // ドロップダウンアイテムを作成
    // ------------------------------------------
    createDropdownItems(searchResults, searchInfo, onItemClick) {
        return searchResults.map(result => {
            const parts = this.createItemParts(result, searchInfo, onItemClick);
            const item = this.createDropdownItem(result, searchInfo, parts, onItemClick);
            return item;
        });
    }


    // ------------------------------------------
    // アイテムの構成要素を作成
    // ------------------------------------------
    createItemParts(result, searchInfo, onItemClick) {
        const parts = [];

        // カスタムプレフィックス
        if (searchInfo.customPrefixes && searchInfo.customPrefixes.length > 0) {
            const prefixBadges = this.createCustomPrefixBadges(searchInfo.customPrefixes);
            parts.push(...prefixBadges);
        }

        // カテゴリフィルタ
        if (searchInfo.categoryFilters && searchInfo.categoryFilters.length > 0) {
            const filterBadges = this.createCategoryFilterBadges(searchInfo.categoryFilters);
            parts.push(...filterBadges);
        }

        // Wikiリンク
        if (this.settings.wikiLink) {
            const wikiLink = this.createWikiLink(result);
            if (wikiLink) {
                parts.push(wikiLink);
            }
        }

        // Alias候補では正規タグではなくalias文字列を挿入できるボタンを出す
        if (result.note === "alias") {
            parts.push(this.createAliasButton(result, searchInfo, onItemClick));
        }

        // テキスト部分
        parts.push(this.createTextParts(result, searchInfo.term));

        // 翻訳
        if (result.translate) {
            String(result.translate).split(",").forEach(translate => {
                const trimmed = translate.trim();
                parts.push(this.createPill(trimmed));
            })
        }

        // postCount
        if (result.postCount) {
            parts.push(this.createPill(String(result.postCount)));
        }

        // カテゴリ名
        if (result.categoryName) {
            const categoryName = this.createPill(String(result.categoryName));
            this.applyCategoryColor(categoryName, result);
            parts.push(categoryName);
        }

        // サイト情報
        if (result.site) {
            parts.push(this.createPill(String(result.site)));
        }

        return parts;
    }


    // ------------------------------------------
    // カスタムプレフィックスバッジ
    // ------------------------------------------
    createCustomPrefixBadges(prefixes) {
        if (!prefixes || prefixes.length === 0) return [];

        return prefixes.map(prefix => {
            return $el("span.jupo-tagcomplete-prefix-badge", {
                textContent: `${prefix}`
            });
        });
    }


    // ------------------------------------------
    // カテゴリフィルタバッジ
    // ------------------------------------------
    createCategoryFilterBadges(filters) {
        if (!filters || filters.length === 0) return [];

        return filters.map(filter => {
            return $el("span.jupo-tagcomplete-filter-badge", {
                textContent: `${filter.toUpperCase()}`
            });
        });
    }


    // ------------------------------------------
    // サイトリンク
    // ------------------------------------------
    createWikiLink(result) {
        const site = this.resolveWikiSite(result);
        if (!site) return null;

        const tag = result.value ?? result.term;
        if (!tag) return null;

        const linkTarget = {
            tag: String(tag),
        };
        const href = site.buildUrl ? site.buildUrl(linkTarget) : null;
        if (!href) return null;
        
        return $el("a.jupo-tagcomplete-wikiLink", {
            textContent: "🔍", 
            title: `Open ${site.label} wiki page for this tag.`,
            href,
            target: "_blank", 
            rel: "noopener noreferrer", 
            onclick: (event) => event.stopPropagation(),
        });
    }

    resolveWikiSite(result) {
        const selectedSite = this.settings.wikiSite || "auto";
        const siteKey = selectedSite === "auto" ? result.site : selectedSite;
        if (!siteKey) return null;

        return WIKI_SITES[String(siteKey).toLowerCase()] ?? null;
    }

    createAliasButton(result, searchInfo, onItemClick) {
        return $el("button.jupo-tagcomplete-aliasButton", {
            textContent: "alias",
            title: "Insert the alias text instead of the canonical tag.",
            onclick: (event) => {
                event.stopPropagation();
                onItemClick?.(event, { ...result, value: result.term }, searchInfo);
            },
        });
    }


    // ------------------------------------------
    // テキスト部分
    // ------------------------------------------
    createTextParts(result, inputTerm) {
        const safeTerm = this.escapeRegExp(inputTerm);
        const regex = new RegExp(`(${safeTerm})`, "gi");
        const displayText = result.display ?? result.text ?? "";
        const splitText = String(displayText).split(regex);

        const container = $el("div.jupo-tagcomplete-text");

        splitText.forEach(part => {
            const element = $el("span", { textContent: part });

            if (part.toLowerCase() === inputTerm.toLowerCase()) {
                element.classList.add("jupo-tagcomplete-highlight");
            }
            this.applyTextStyles(element, result);
            container.append(element);
        });

        return container;
    }

    applyTextStyles(element, result) {
        // postCountもしくはcategoryNameによってテキストスタイルを適用
        // postCountが数字文字列じゃなくて文字列の場合 -> postCountで適用
        // postCountがnullもしくは数字文字列の場合 -> categoryNameで適用
        const postCount = result.postCount;
        const categoryName = result.categoryName;
        
        let tag;
        
        // postCountが存在して、空文字でない、かつ数字以外の場合
        if (result.note) {
            tag = String(result.note).replace(" ", "").toLowerCase();
        }
        else if (postCount && String(postCount).trim() !== "" && isNaN(postCount)) {
            tag = String(postCount).replace(" ", "").toLowerCase();
        }
        // そうでなければcategoryNameを使用
        else if (categoryName) {
            tag = categoryName.replace(" ", "").toLowerCase();
        }
        // どちらもない場合は何もしない
        else {
            return;
        }
        
        const className = `jupo-tagcomplete-text-${tag}`;
        element.classList.add(className);
    }

    escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }


    // ------------------------------------------
    // ピル
    // ------------------------------------------
    createPill(text) {
        return $el("span.jupo-tagcomplete-pill", { textContent: text });
    }

    applyCategoryColor(element, result) {
        // カテゴリ名ごとの設定
        const categoryName = result.categoryName;
        if (!categoryName) return;
        if (categoryName.trim() === "") return;

        const className = `jupo-tagcomplete-pill-category-${categoryName.toLowerCase()}`;
        element.classList.add(className);
    }


    // ------------------------------------------
    // 各行のアイテムを作成
    // ------------------------------------------
    createDropdownItem(result, searchInfo, parts, onItemClick) {
        const item = $el("div.jupo-tagcomplete-item", {
            onclick: (e) => onItemClick(e, result, searchInfo), 
        }, parts);

        // wildcardの場合、アイテムにタイトルをつける
        this.applyItemTitle(item, result);

        return item;
    }

    // ------------------------------------------
    // アイテムタイトル
    // ------------------------------------------
    applyItemTitle(element, result) {
        if ((result.note === "wildcard" || result.categoryName === "Wildcard") && result.wildcardValue) {
            element.title = result.wildcardValue.replace(/,/g, '\n');
        }
    }

}
