import { $el } from "../../scripts/ui.js";
import { api } from "../../scripts/api.js";

const DEBUG = false;
export function debug(data) {
    if (DEBUG) {
        api.fetchApi(_endpoint("debug"), {
            method: "POST", 
            body: JSON.stringify(data)
        });
    }
}

const author = "tsukihara";
const packageName = "ExTagComplete";

export function _name(name) {
    return `${author}.${packageName}.${name}`;
}

export function _endpoint(part) {
    return `/${author}/${packageName}/${part}`;
}


export function addStylesheet(url) {
    if (url.endsWith(".js")) {
        url = url.substr(0, url.length - 2) + "css";
    }
    $el("link", {
        parent: document.head, 
        rel: "stylesheet", 
        type: "text/css", 
        href: url.startsWith("http") ? url: getUrl(url), 
    });
}

