# ComfyUI-Ex-TagComplete

[<img src="https://img.shields.io/badge/lang-English-red.svg?style=plastic" height="25" />](README.en.md)
[<img src="https://img.shields.io/badge/言語-日本語-green.svg?style=plastic" height="25" />](README.md)

![capture](https://files.catbox.moe/fv292m.webp)

This extension adds tag autocomplete to text input fields in ComfyUI.  
In addition to tag CSV files, it can also include translation files, Embeddings, LoRAs, and Wildcards in suggestions.

This extension is based on [ComfyUI-Custom-Scripts](https://github.com/pythongosssss/ComfyUI-Custom-Scripts).

## Features

- Tag autocomplete using CSV files
- Translation-aware search and translation display
- Suggestions for Embeddings, LoRAs, and Wildcards
- Category-based filtering
- Prefix insertion
- Wiki link button for tags

## Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/jupo-ai/comfy-ex-tagcomplete.git
```

No additional `pip` dependencies are required.

## Usage

After installation, start ComfyUI and autocomplete will be available in supported multiline text inputs.  
You can configure the behavior from the ComfyUI settings panel.

## Settings

![settings](https://files.catbox.moe/0ai9mj.png)

| Setting | Description |
| --- | --- |
| `Enable` | Turns the feature on or off. |
| `Choose Main File` | Selects the main tag CSV file. Targets CSV files in the `tags` folder that do not start with `extra`. |
| `Choose Extra File` | Selects an additional tag CSV file. Targets CSV files in the `tags` folder that start with `extra`. |
| `Choose Translate File` | Selects a translation CSV file from the `translate` folder. Choose `None` to disable translation support. |
| `Delimiter` | Sets the separator used when inserting tags. Choose from `,`, `.`, or `None`. |
| `Add 'Space' after delimiter` | Automatically inserts a space after the delimiter. |
| `Max Suggestions to Display` | Sets the maximum number of suggestions to show. `0` shows all results, which may become heavy with large datasets. |
| `Add 🔍 Link button` | Shows a button next to each suggestion that opens the related wiki or tag page. |
| `Wiki Link Site` | Chooses which site the `🔍` button opens. `Auto` uses the source site of the tag when available. |
| `Replace '_' with 'Space'` | Replaces `_` with spaces when inserting tags. |
| `Artist Tag Prefix` | Adds a prefix before inserted artist tags. Example: `@` |
| `Completion Delay (ms)` | Wait time before suggestions appear after typing. |
| `Enable Embeddings` | Includes Embeddings in the suggestion list. They are shown as `embedding:name`. |
| `Enable LoRAs` | Includes LoRAs in the suggestion list. They are inserted as `<lora:name:1>`. |
| `Enable Wildcards` | Includes Wildcards in the suggestion list. They are shown as `__name__`. |
| `Restrict Alias` | Shows alias entries only on exact match. For example, `1girls -> 1girl` appears only after typing `1girls`. |
| `Search Method` | Switches how matching works. `smart` splits the input by spaces and `_`, then searches for tags containing all chunks. `legacy` treats the whole input as a single pattern and searches with a `%term%` style partial match. |
| `Sort Method` | Switches how results are ordered. `relevance` prioritizes exact matches, then prefix matches, then partial matches, and uses `postCount` and tag length as tie-breakers. `legacy` does not consider match position or match strength and mainly sorts by `postCount`. |

## Search Syntax

### Category Filter

![filter](https://files.catbox.moe/bir330.png)

You can narrow results by category with `--category`.  
Available categories are listed in [category_map.csv](category_map.csv).

Example:

```text
--character fate
```

This shows only `character` entries from the results for `fate`.

### Prefix

![prefix](https://files.catbox.moe/uddq2d.png)

Use `++text` to prepend text before the selected tag when inserting it.  
You can use multiple prefixes.

Example:

```text
+pink skirt
```

If you search for `skirt` and select `pleated skirt`, the inserted result becomes `pink pleated skirt`.

## Bundled Data

The following 3 files in the `tags` folder are borrowed from [a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete):

- `danbooru.csv`
- `danbooru_e621_merged.csv`
- `extra-quality-tags.csv`

## Notes

- Translation CSV files are read as `first column: tag`, `last column: translated text`.
- Wildcard suggestions are loaded from the Wildcard definitions available to ComfyUI.
- Autocomplete is disabled for some multiline inputs for compatibility reasons.
