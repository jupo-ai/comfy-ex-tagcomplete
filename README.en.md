# ComfyUI-Ex-TagComplete

[<img src="https://img.shields.io/badge/lang-English-red.svg?style=plastic" height="25" />](README.en.md)
[<img src="https://img.shields.io/badge/言語-日本語-green.svg?style=plastic" height="25" />](README.md)

![capture](https://files.catbox.moe/fv292m.webp)

This extension is based on [ComfyUI-Custom-Scripts](https://github.com/pythongosssss/ComfyUI-Custom-Scripts).

Also, the following files in the tags folder:

- danbooru.csv
- danbooru_e621_merged.csv
- extra-quality-tags.csv

are borrowed from [a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete).

## Install
```
cd ComfyUI\custom_nodes
git clone https://github.com/jupo-ai/comfy-ex-tagcomplete.git
```

## Settings
![settings](https://files.catbox.moe/0ai9mj.png)

- `Enable`
  - Enable the feature
- `Main Tags file`
  - Main tags CSV file
  - Targets **all CSV files except those starting with 'extra'** in the tags folder
- `Extra Tags file`
  - Additional tags CSV file
  - Targets **only CSV files starting with 'extra'** in the tags folder
- `Translate file` ⭐new
  - Set a translation file
- `Delimiter`
  - Tag separator character
  - Choose from comma (,), period (.), or none
- `Add 'Space' after separator`
  - Add a space after the separator
- `Insert Tag on Tab key`
  - Insert tag with Tab key
- `Insert Tag on Enter key`
  - Insert tag with Enter key
- `Max Suggestions to Display`
  - Number of tag suggestions to display
  - 0 displays all ~~but becomes heavy (extremely heavy)~~
- `Add Wiki Link Button`
  - Add wiki (danbooru / e621) link button to the left of tag suggestions
- `Replace '_' to 'Space'`
  - Replace underscores in tags with spaces
- `Completion delay(ms)`
  - Time before displaying tag suggestions after input
- `Enable Embeddings`
  - Include Embedding files in suggestions
- `Enable LoRAs`
  - Include LoRA files in suggestions
- `Enable Wildcards` ⭐new
  - Include wildcards in suggestions
- `Restrict Alias`
  - When ON, Aliases (like 1girls => 1girl) are only displayed on exact match
  - For example, the alias "1girls => 1girl" will only be displayed when you type up to "1girls"

## Category Filter
![filter](https://files.catbox.moe/bir330.png)

You can search by specifying categories.  
Enter `--○○` to specify a category.  
Available categories are listed in [Category Map](category_map.csv).  
- Example
  - `--character fate`
    - Displays only results with category `character` from the `fate` search results.

## Prefix
![prefix](https://files.catbox.moe/uddq2d.png)

You can search with prefix settings.  
Enter `++○○` to set a prefix.  
Multiple prefixes can be set.  
- Example
  - `++pink skirt`
    - When searching for "skirt" and selecting `pleated skirt`, the result will be `pink pleated skirt`.