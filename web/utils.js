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

/*
https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/main/web/js/common/utils.js

MIT License

Copyright (c) 2023 pythongosssss

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

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

