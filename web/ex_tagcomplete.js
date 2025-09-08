import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { mk_name } from "./utils.js";
import { settings } from "./settings.js";
import { TagCompleter } from "./completer/tag_completer.js";

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
// エクステンションの定義
// ==============================================
const extension = {
    name: mk_name("TagCompleter"),

    // ------------------------------------------
    // 設定
    // ------------------------------------------
    settings: settings.getList(), 


    // ------------------------------------------
    // 初期化
    // ------------------------------------------
    init: async function(app) {
        hijackSTRING();
    },


    // ------------------------------------------
    // セットアップ
    // ------------------------------------------
    setup: async function(app) {
    },
};

app.registerExtension(extension);