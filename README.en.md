# ComfyUI-Ex-TagComplete  

[<img src="https://img.shields.io/badge/lang-Egnlish-red.svg?style=plastic" height="25" />](README.en.md)
[<img src="https://img.shields.io/badge/言語-日本語-green.svg?style=plastic" height="25" />](README.md)

This `README.en.md` is translated by ChatGPT.

![capture](assets/capture.webp)  

This extension is inspired by [ComfyUI-Custom-Scripts](https://github.com/pythongosssss/ComfyUI-Custom-Scripts).  

Additionally, the following files in the `tags` folder:  

- `danbooru.csv`  
- `danbooru_e621_merged.csv`  
- `extra-quality-tags.csv`  

are borrowed from [a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete).  

## Install  
```
cd ComfyUI\custom_nodes  
git clone https://github.com/jupo-ai/comfy-ex-tagcomplete.git  
```  

## Settings  
![settings](assets/settings.webp)  

- **Enable**  
  - Enable or disable the functionality.  
- **Tags file**  
  - The main tag CSV file.  
  - Only files **excluding those starting with "extra"** in the `tags` folder are applicable.  
- **Extra file**  
  - Additional tag CSV file.  
  - Only files **starting with "extra"** in the `tags` folder are applicable.  
- **Separator**  
  - The character appended after inserting a tag.  
  - Choose from comma (,), period (.), or none.  
- **Insert 'Space' after separator**  
  - Whether to insert a space after the separator.  
- **Insert Tag on Tab key**  
  - Whether to insert a tag when pressing the Tab key.  
- **Insert Tag on Enter key**  
  - Whether to insert a tag when pressing the Enter key.  
- **Suggestion display count**  
  - The number of suggested tags displayed.  
  - Setting this to 0 shows all suggestions but may slow performance.  
- **Add Wiki Link Button**  
  - Adds a wiki link button (danbooru / e621) next to tag suggestions.  
- **Replace '_' to 'Space'**  
  - Replaces underscores (_) in tags with spaces.  
- **Completion delay (ms)**  
  - The delay before displaying tag suggestions after typing.  
  - If set too short, searching may not keep up with typing, leading to incorrect display.  
- **Enable Embeddings**  
  - Includes embedding files in tag suggestions.  
- **Enable LoRAs**  
  - Includes LoRA files in tag suggestions.  
- **Restrict Alias**  
  - If enabled, aliases (e.g., `1girls` → `1girl`) will only be displayed when there is an exact match.  
  - For example, "1girls" must be fully typed before the alias `1girls → 1girl` appears.  

## ToDo  
- ~~embeddings~~: done  
- ~~loras~~: done  