import { app } from "../../scripts/app.js";
import { mk_name, api_get, api_post } from "./utils.js";
import { TagCompleter } from "./tag-complete/tag_completer.js";

// ==============================================
// 設定オブジェクト
// ==============================================

const MAIN_FILES = await api_get("get_main_files")
const EXTRA_FILES = await api_get("get_extra_files")
const TRANSLATE_FILES = await api_get("get_translate_files")


export const settings = {
    // 登録用のリストを返す
    getList() {
        return Object.values(this)
            .filter(v => v && typeof v === "object" && !Array.isArray(v))
            .slice()
            .reverse();
    }, 

    // ------------------------------------------
    // 以下、各種設定
    // ------------------------------------------
    enable: {
        name: "Enable", 
        id: mk_name("enable"), 
        type: "boolean", 
        defaultValue: true, 
        onChange: async (value) => {
            TagCompleter.updateSetting("enable", value);
            await api_post("toggle_enable", { value: value })
        }, 
    }, 

    mainFile: {
        name: "Choose Main File",
        id: mk_name("mainTagsFile"), 
        type: "combo", 
        defaultValue: MAIN_FILES[0], 
        options: MAIN_FILES, 
        onChange: async (value) => {
            await api_post("load_main", { filename: value });
        }, 
    }, 

    extraFile: {
        name: "Choose Extra File", 
        id: mk_name("extraTagsFile"), 
        type: "combo", 
        defaultValue: EXTRA_FILES[0], 
        options: EXTRA_FILES, 
        onChange: async (value) => {
            await api_post("load_extra", { filename: value });
        }, 
    }, 

    translateFile: {
        name: "Choose Translate File", 
        id: mk_name("translateFile"), 
        type: "combo", 
        defaultValue: TRANSLATE_FILES[0], 
        options: TRANSLATE_FILES, 
        onChange: async (value) => {
            await api_post("load_translate", { filename: value });
        },
    }, 

    delimiter: {
        name: "Delimiter", 
        id: mk_name("delimiter"), 
        type: "combo", 
        defaultValue: ",", 
        options: [
            { text: "Comma (,)", value: "," }, 
            { text: "Period (.)", value: "." }, 
            { text: "None", value: "" }, 
        ], 
        onChange: (value) => {
            TagCompleter.updateSetting("delimiter", value);
        }, 
    }, 

    addSpace: {
        name: "Add 'Space' after delimiter", 
        id: mk_name("insertSpace"), 
        type: "boolean", 
        defaultValue: true, 
        onChange: (value) => {
            TagCompleter.updateSetting("addSpace", value);
        }, 
    }, 

    suggestionCount: {
        name: "Max Suggestions to Display", 
        id: mk_name("suggestionCount"), 
        type: "slider", 
        defaultValue: 50, 
        attrs: { min: 0, max: 200, step: 1 }, 
        tooltip: "0: Show all avaliable suggestion.", 
        onChange: async (value) => {
            await api_post("set_suggestion_count", { value: value });
        }, 
    }, 

    wikiLink: {
        name: "Add 🔍 Link button", 
        id: mk_name("wikiLink"), 
        type: "boolean", 
        defaultValue: true, 
        tooltip: "Add a 🔍 button that opens the tag's site page.", 
        onChange: (value) => {
            TagCompleter.updateSetting("wikiLink", value);
        }, 
    }, 

    wikiSite: {
        name: "Wiki Link Site",
        id: mk_name("wikiSite"),
        type: "combo",
        defaultValue: "auto",
        options: [
            { text: "Auto (tag site)", value: "auto" },
            { text: "Danbooru", value: "danbooru" },
            { text: "e621", value: "e621" },
            { text: "Gelbooru", value: "gelbooru" },
        ],
        tooltip: "Choose which site the 🔍 button opens. Auto uses the tag source when available.",
        onChange: (value) => {
            TagCompleter.updateSetting("wikiSite", value);
        },
    },

    replaceUnderbar: {
        name: "Replace '_' with 'Space'", 
        id: mk_name("replaceUnderbar"), 
        type: "boolean", 
        defaultValue: true, 
        onChange: (value) => {
            TagCompleter.updateSetting("replaceUnderbar", value);
        }, 
    }, 

    artistPrefix: {
        name: "Artist Tag Prefix",
        id: mk_name("artistPrefix"),
        type: "string",
        defaultValue: "",
        tooltip: "Text added before inserted artist tags. Example: @",
        onChange: (value) => {
            TagCompleter.updateSetting("artistPrefix", value);
        },
    },

    delay: {
        name: "Completion Delay (ms)", 
        id: mk_name("completionDelay"), 
        type: "slider", 
        defaultValue: 50, 
        attrs: { min: 0, max: 200, step: 10 }, 
        onChange: (value) => {
            TagCompleter.updateSetting("delay", value);
        }, 
    }, 

    embeddings: {
        name: "Enable Embeddings", 
        id: mk_name("enableEmbeddings"), 
        type: "boolean", 
        defaultValue: false, 
        onChange: async (value) => {
            await api_post("load_embeddings", { value : value });
        }, 
    }, 

    loras: {
        name: "Enable LoRAs", 
        id: mk_name("enableLoras"), 
        type: "boolean", 
        defaultValue: false, 
        onChange: async (value) => {
            await api_post("load_loras", { value: value });
        }, 
    }, 

    wildcards: {
        name: "Enable Wildcards", 
        id: mk_name("enableWildcards"), 
        type: "boolean", 
        defaultValue: false, 
        onChange: async (value) => {
            await api_post("load_wildcards", { value: value });
        }, 
    }, 

    restrictAlias: {
        name: "Restrict Alias", 
        id: mk_name("restrictAlias"), 
        type: "boolean", 
        defaultValue: false, 
        tooltip: "If enabled, aliases are only shown when an exact match is found.", 
        onChange: async (value) => {
            await api_post("set_restrict_alias", { value: value });
        }, 
    }, 

    searchMethod: {
        name: "Search Method",
        id: mk_name("searchMethod"),
        type: "combo",
        defaultValue: "smart",
        options: ["legacy", "smart"],
        onChange: async (value) => {
            await api_post("set_search_method", { value: value });
        },
    },

    sortMethod: {
        name: "Sort Method",
        id: mk_name("sortMethod"),
        type: "combo",
        defaultValue: "relevance",
        options: ["legacy", "relevance"],
        onChange: async (value) => {
            await api_post("set_sort_method", { value: value });
        },
    },

}
