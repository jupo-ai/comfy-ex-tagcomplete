import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { api } from "../../scripts/api.js";
import { TagCompleter } from "./tag_completer.js";
import { debug, _name, _endpoint } from "./utils.js";

// ==============================================
// 設定オブジェクト
// ==============================================

const enableSetting = {
    name: "Enable",
    id: _name("enable"),
    type: "boolean",
    defaultValue: true,
    onChange: (value) => { TagCompleter.enabled = value; },
};

const mainTagsFileSetting = {
    name: "Main Tags file",
    id: _name("mainTagsFile"),
    type: "combo",
    defaultValue: "",
    options: [],
    onChange: (value) => {
        api.fetchApi(_endpoint("dataframe"), {
            method: "POST",
            body: JSON.stringify({ tagsfile: value }),
        });
    },
    init: async function() {
        const res = await api.fetchApi(_endpoint("filelist"));
        const files = await res.json();
        if (files.length > 0) {
            this.options = files.map(file => ({ text: file, value: file }));
            this.defaultValue = files[0];
        }
    },
};

const extraTagsFileSetting = {
    name: "Extra Tags file",
    id: _name("extraTagsFile"),
    type: "combo",
    defaultValue: "",
    options: [],
    onChange: (value) => {
        api.fetchApi(_endpoint("dataframe"), {
            method: "POST",
            body: JSON.stringify({ extrafile: value }),
        });
    },
    init: async function() {
        const res = await api.fetchApi(_endpoint("extra_filelist"));
        const files = await res.json();
        if (files.length > 0) {
            this.options = files.map(file => ({ text: file, value: file }));
            this.defaultValue = files[0];
        }
    },
};

const delimiterSetting = {
    name: "Delimiter",
    id: _name("delimiter"),
    type: "combo",
    defaultValue: ",",
    options: [
        { text: "Comma (,)", value: "," },
        { text: "Period (.)", value: "." },
        { text: "None", value: "" },
    ],
    onChange: (value) => { TagCompleter.delimiter = value; },
};

const addSpaceSetting = {
    name: "Add 'Space' after delimiter",
    id: _name("insertSpace"),
    type: "boolean",
    defaultValue: true,
    onChange: (value) => { TagCompleter.addSpace = value; },
};

const insertOnTabSetting = {
    name: "Insert Tag with Tab key",
    id: _name("insertOnTab"),
    type: "boolean",
    defaultValue: true,
    onChange: (value) => { TagCompleter.insertOnTab = value; },
};

const insertOnEnterSetting = {
    name: "Insert Tag with Enter key",
    id: _name("insertOnEnter"),
    type: "boolean",
    defaultValue: true,
    onChange: (value) => { TagCompleter.insertOnEnter = value; },
};

const suggestionCountSetting = {
    name: "Max Suggestions to Display",
    id: _name("suggestionCount"),
    type: "slider",
    defaultValue: 20,
    attrs: { min: 0, max: 200, step: 1 },
    tooltip: "0: Show all available suggestions.",
    onChange: (value) => { TagCompleter.suggestionCount = value; },
};

const wikiLinkSetting = {
    name: "Add Wiki Link Button",
    id: _name("wikiLink"),
    type: "boolean",
    defaultValue: false,
    tooltip: "Add a 🔍 button that opens the tag's Wiki page.",
    onChange: (value) => { TagCompleter.wikiLink = value; },
};

const replaceUnderbarSetting = {
    name: "Replace '_' with 'Space'",
    id: _name("replaceUnderbar"),
    type: "boolean",
    defaultValue: true,
    onChange: (value) => { TagCompleter.replaceUnderbar = value; },
};

const completionDelaySetting = {
    name: "Completion Delay (ms)",
    id: _name("completionDelay"),
    type: "slider",
    defaultValue: 100,
    attrs: { min: 0, max: 200, step: 10 },
    onChange: (value) => { TagCompleter.updateDelay(value); },
};

const enableEmbeddingsSetting = {
    name: "Enable Embeddings", 
    id: _name("enableEmbeddings"), 
    type: "boolean", 
    defaultValue: false, 
    onChange: (value) => {
        api.fetchApi(_endpoint("embeddings"), {
            method: "POST",
            body: JSON.stringify({ enabled: value }),
        });
    },
};

const enableLorasSetting = {
    name: "Enable LoRAs", 
    id: _name("enableLoras"), 
    type: "boolean", 
    defaultValue: false, 
    onChange: (value) => {
        api.fetchApi(_endpoint("loras"), {
            method: "POST",
            body: JSON.stringify({ enabled: value }),
        });
    },
};

const restrictAliasSetting = {
    name: "Restrict Alias", 
    id: _name("restrictAlias"), 
    type: "boolean", 
    defaultValue: false, 
    tooltip: "If enabled, aliases are only shown when an exact match is found.", 
    onChange: (value) => {
        api.fetchApi(_endpoint("restrictAlias"), {
            method: "POST", 
            body: JSON.stringify({ enabled: value }), 
        });
    }, 
};

// ==============================================
// STRINGウィジェットのハイジャック
// ==============================================

function hijackSTRING() {
    const STRING = ComfyWidgets.STRING;
    const SKIP_WIDGETS = new Set(["ttN xyPlot.x_values", "ttN xyPlot.y_values", "MathExpression|pysssss.expression"]);

    ComfyWidgets.STRING = function(node, inputName, inputData) {
        const res = STRING?.apply(this, arguments);
        const widgetData = inputData[1];

        if (widgetData?.multiline) {
            const config = widgetData?.["tagcomplete"] || widgetData?.["pysssss.autocomplete"];
            if (config === false) return res;

            const id = `${node.comfyClass}.${inputName}`;
            if (SKIP_WIDGETS.has(id)) return res;
            
            new TagCompleter(res.widget.inputEl);
        }

        return res;
    };
}

// ==============================================
// colors.jsonの読み込み
// ==============================================

async function loadColors() {
    const res = await api.fetchApi(_endpoint("colors"));
    return await res.json();
}

// ==============================================
// エクステンションの定義
// ==============================================

const tagCompleterExtension = {
    name: _name("TagCompleter"),

    /**
     * 初期化処理：設定の初期化とSTRINGウィジェットのハイジャック
     * @param {object} app - アプリケーションインスタンス
     */
    init: async function(app) {
        debug("init start");
        await mainTagsFileSetting.init();
        await extraTagsFileSetting.init();
        hijackSTRING();
        debug("init end");
    },

    /** 設定項目のリスト */
    settings: [
        restrictAliasSetting, 
        enableLorasSetting, 
        enableEmbeddingsSetting, 
        completionDelaySetting,
        replaceUnderbarSetting,
        wikiLinkSetting,
        suggestionCountSetting,
        insertOnEnterSetting,
        insertOnTabSetting,
        addSpaceSetting,
        delimiterSetting,
        extraTagsFileSetting,
        mainTagsFileSetting,
        enableSetting,
    ],

    /**
     * セットアップ処理：設定値を反映し、TagDatabaseを初期化
     * @param {object} app - アプリケーションインスタンス
     */
    setup: async function(app) {
        debug("setup start");

        // 設定値を取得
        const settings = app.extensionManager.setting;
        const enabled = settings.get(enableSetting.id);
        const tagsfile = settings.get(mainTagsFileSetting.id);
        const extrafile = settings.get(extraTagsFileSetting.id);
        const delimiter = settings.get(delimiterSetting.id);
        const addSpace = settings.get(addSpaceSetting.id);
        const insertOnTab = settings.get(insertOnTabSetting.id);
        const insertOnEnter = settings.get(insertOnEnterSetting.id);
        const suggestionCount = settings.get(suggestionCountSetting.id);
        const replaceUnderbar = settings.get(replaceUnderbarSetting.id);
        const wikiLink = settings.get(wikiLinkSetting.id);
        const delay = settings.get(completionDelaySetting.id);
        const enabledEmbeddings = settings.get(enableEmbeddingsSetting.id);
        const enabledLoras = settings.get(enableLorasSetting.id);
        const restrictAlias = settings.get(restrictAliasSetting.id);

        // TagCompleterに設定値を反映
        TagCompleter.enabled = enabled;
        TagCompleter.delimiter = delimiter;
        TagCompleter.addSpace = addSpace;
        TagCompleter.insertOnTab = insertOnTab;
        TagCompleter.insertOnEnter = insertOnEnter;
        TagCompleter.suggestionCount = suggestionCount;
        TagCompleter.replaceUnderbar = replaceUnderbar;
        TagCompleter.wikiLink = wikiLink;
        TagCompleter.delay = delay;

        // colors.jsonを読み込み
        TagCompleter.colors = await loadColors();

        // Python側のTagDatabaseをセットアップ
        await api.fetchApi(_endpoint("dataframe"), {
            method: "POST",
            body: JSON.stringify({ tagsfile: tagsfile, extrafile: extrafile }),
        });
        await api.fetchApi(_endpoint("embeddings"), {
            method: "POST", 
            body: JSON.stringify({ enabled: enabledEmbeddings }), 
        });
        await api.fetchApi(_endpoint("loras"), {
            method: "POST", 
            body: JSON.stringify({ enabled: enabledLoras }), 
        });
        await api.fetchApi(_endpoint("restrictAlias"), {
            method: "POST", 
            body: JSON.stringify({ enabled: restrictAlias }), 
        });

        debug("setup end");
    },
};

app.registerExtension(tagCompleterExtension);