import { app } from "../../scripts/app.js";
import { mk_name, api_get, api_post } from "./utils.js";
import { TagCompleter } from "./completer/tag_completer.js";

// ==============================================
// 設定オブジェクト
// ==============================================

export const settings = {
    // 登録用のリストを返す
    getList() {
        return Object.values(this)
            .filter(v => v && typeof v === "object" && !Array.isArray(v))
            .slice()
            .reverse();
    }, 

    // 各設定の初期化処理
    async initialize() {
        for (const setting of this.getList()) {
            if (typeof setting.init === "function") {
                await setting.init();
            }
        }
    },

    // セットアップ
    async setup() {
        // 初回起動時用にファイルを明示的に読み込む
        const comfySetting = app.extensionManager.setting;
        const mainFile = comfySetting.get(this.mainFile.id);
        const extraFile = comfySetting.get(this.extraFile.id);

        await this.mainFile.onChange(mainFile);
        await this.extraFile.onChangeL(extraFile);
    }, 

    // ------------------------------------------
    // 以下、各種設定
    // ------------------------------------------
    enable: {
        name: "Enable", 
        id: mk_name("enable"), 
        type: "boolean", 
        defaultValue: true, 
        onChange: (value) => {
            TagCompleter.updateSetting("enable", value);
        }, 
    }, 

    mainFile: {
        name: "Choose Main File",
        id: mk_name("mainTagsFile"), 
        type: "combo", 
        defaultValue: "", 
        options: [], 
        onChange: async (value) => {
            if (!value) return;
            await api_post("load_csv", {
                filename: value, 
                isMain: true
            });
        }, 
        init: async function() {
            const files = await api_get("get_main_files");
            if (files.length > 0) {
                this.options = files.map(file => ({ text: file, value: file }));
                this.defaultValue = files[0];
            }
        }, 
    }, 

    extraFile: {
        name: "Choose Extra File", 
        id: mk_name("extraTagsFile"), 
        type: "combo", 
        defaultValue: "", 
        options: [], 
        onChangeL: async (value) => {
            if (!value) return;
            await api_post("load_csv", {
                filename: value, 
                isMain: false
            });
        }, 
        init: async function() {
            const files = await api_get("get_extra_files");
            if (files.length > 0) {
                this.options = files.map(file => ({ text: file, value: file }));
                this.defaultValue = files[0];
            }
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
        defaultValue: 20, 
        attrs: { min: 0, max: 200, step: 1 }, 
        tooltip: "0: Show all avaliable suggestion.", 
        onChange: async (value) => {
            await api_post("set_suggestion_count", {
                suggestionCount: value
            });
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

    replaceUnderbar: {
        name: "Replace '_' with 'Space'", 
        id: mk_name("replaceUnderbar"), 
        type: "boolean", 
        defaultValue: true, 
        onChange: (value) => {
            TagCompleter.updateSetting("replaceUnderbar", value);
        }, 
    }, 

    delay: {
        name: "Completion Delay (ms)", 
        id: mk_name("completionDelay"), 
        type: "slider", 
        defaultValue: 100, 
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
            await api_post("load_embeddings", {
                enabled: value
            });
        }, 
    }, 

    loras: {
        name: "Enable LoRAs", 
        id: mk_name("enableLoras"), 
        type: "boolean", 
        defaultValue: false, 
        onChange: async (value) => {
            await api_post("load_loras", {
                enabled: value
            });
        }, 
    }, 

    restirctAlias: {
        name: "Restrict Alias", 
        id: mk_name("restrict Alias"), 
        type: "boolean", 
        defaultValue: false, 
        tooltip: "If enabled, aliases are only sohwn when an exact match is found.", 
        onChange: async (value) => {
            await api_post("set_restrict_alias", {
                enabled: value
            });
        }, 
    }, 

}