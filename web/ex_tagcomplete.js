import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { mk_name } from "./utils.js";
import { settings } from "./settings.js";
import { TagCompleter } from "./tag-complete/tag_completer.js";

const TAGCOMPLETER_INSTANCE = Symbol("jupo.tagcompleter.instance");
const VUE_TEXTAREA_WIDGET_TYPES = new Set(["customtext", "textarea", "multiline"]);

let vueNodesObserver = null;
let vueNodesScanScheduled = false;

function getWidgetConfig(inputData) {
    return inputData?.[1];
}

function shouldSkipWidget(node, inputName, widgetData) {
    const SKIP_WIDGETS = new Set(["ttN xyPlot.x_values", "ttN xyPlot.y_values", "MathExpression|pysssss.expression"]);
    if (!widgetData?.multiline) return true;

    const config = widgetData?.["tagcomplete"] || widgetData?.["pysssss.autocomplete"];
    if (config === false) return true;

    const comfyClass = node?.comfyClass || node?.constructor?.comfyClass || node?.type || node?.constructor?.title;
    const id = `${comfyClass}.${inputName}`;
    return SKIP_WIDGETS.has(id);
}

function getWidgetInputElement(widget) {
    if (widget?.inputEl instanceof HTMLTextAreaElement) {
        return widget.inputEl;
    }

    if (widget?.inputEl instanceof HTMLElement) {
        return widget.inputEl.matches("textarea") ? widget.inputEl : widget.inputEl.querySelector?.("textarea");
    }

    if (widget?.element instanceof HTMLTextAreaElement) {
        return widget.element;
    }

    if (widget?.element instanceof HTMLElement) {
        return widget.element.querySelector?.("textarea");
    }

    return null;
}

function attachTagCompleter(element) {
    if (!(element instanceof HTMLTextAreaElement)) return null;
    if (element[TAGCOMPLETER_INSTANCE]) return element[TAGCOMPLETER_INSTANCE];

    const completer = new TagCompleter(element);
    element[TAGCOMPLETER_INSTANCE] = completer;
    return completer;
}

function attachTagCompleterToWidget(node, inputName, inputData, widget) {
    const widgetData = getWidgetConfig(inputData);
    if (shouldSkipWidget(node, inputName, widgetData)) return;

    const inputEl = getWidgetInputElement(widget);
    attachTagCompleter(inputEl);
}

function getNodeGraph() {
    return app.canvas?.graph || app.graph || app.rootGraph;
}

function getNodeById(nodeId) {
    const graph = getNodeGraph();
    if (!graph) return null;

    return graph.getNodeById?.(nodeId) || graph.getNodeById?.(Number(nodeId)) || null;
}

function isVueTextareaWidget(widget) {
    const type = String(widget?.type ?? "").toLowerCase();
    return VUE_TEXTAREA_WIDGET_TYPES.has(type) || widget?.options?.multiline;
}

function getVueTextareaWidgets(node) {
    return (node?.widgets ?? []).filter((widget) => isVueTextareaWidget(widget) && !widget?.options?.canvasOnly);
}

function getVueNodeElement(element) {
    return element.closest?.("[data-node-id]");
}

function findVueNodeTextareas(root = document) {
    return root.querySelectorAll?.("[data-node-id] textarea") ?? [];
}

function attachTagCompleterToVueTextarea(textarea) {
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    if (textarea[TAGCOMPLETER_INSTANCE]) return;

    const nodeElement = getVueNodeElement(textarea);
    const nodeId = nodeElement?.dataset?.nodeId;
    const node = nodeId == null ? null : getNodeById(nodeId);
    if (!node) return;

    const textareas = Array.from(nodeElement.querySelectorAll("textarea"));
    const textareaIndex = textareas.indexOf(textarea);
    const widget = getVueTextareaWidgets(node)[textareaIndex];
    if (!widget) return;

    attachTagCompleterToWidget(node, widget.name, [widget.type, widget.options ?? {}], widget);
    attachTagCompleter(textarea);
}

function scanVueNodeTextareas(root = document) {
    for (const textarea of findVueNodeTextareas(root)) {
        attachTagCompleterToVueTextarea(textarea);
    }
}

function scheduleVueNodeTextareaScan(root = document) {
    if (vueNodesScanScheduled) return;

    vueNodesScanScheduled = true;
    const schedule = window.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
    schedule(() => {
        vueNodesScanScheduled = false;
        scanVueNodeTextareas(root);
    });
}

function setupVueNodesTextareaObserver() {
    if (vueNodesObserver || typeof MutationObserver === "undefined") return;

    vueNodesObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;

                if (
                    (node.matches?.("textarea") && getVueNodeElement(node)) ||
                    node.querySelector?.("[data-node-id] textarea") ||
                    (node.matches?.("[data-node-id]") && node.querySelector?.("textarea"))
                ) {
                    scheduleVueNodeTextareaScan();
                    return;
                }
            }
        }
    });

    vueNodesObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
    scheduleVueNodeTextareaScan();
}

// ==============================================
// STRINGウィジェットのハイジャック
// ==============================================
function hijackSTRING() {
    const STRING = ComfyWidgets.STRING;

    ComfyWidgets.STRING = function(node, inputName, inputData) {
        const res = STRING?.apply(this, arguments);
        attachTagCompleterToWidget(node, inputName, inputData, res?.widget);

        return res;
    };
}

function hookNodeCreation(nodeType) {
    if (nodeType.prototype.__jupoTagCompleteHooked) return;
    nodeType.prototype.__jupoTagCompleteHooked = true;

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function() {
        const res = onNodeCreated?.apply(this, arguments);

        queueMicrotask(() => {
            for (const widget of this.widgets ?? []) {
                attachTagCompleterToWidget(this, widget.name, [widget.type, widget.options ?? {}], widget);
            }
        });

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
        setupVueNodesTextareaObserver();
    },

    beforeRegisterNodeDef: async function(nodeType) {
        hookNodeCreation(nodeType);
    },
};

app.registerExtension(extension);
