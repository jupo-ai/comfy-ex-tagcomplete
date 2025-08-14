# ComfyUI-Ex-TagComplete

[<img src="https://img.shields.io/badge/lang-Egnlish-red.svg?style=plastic" height="25" />](README.en.md)
[<img src="https://img.shields.io/badge/言語-日本語-green.svg?style=plastic" height="25" />](README.md)

![capture](https://files.catbox.moe/fv292m.webp)

この拡張機能は[ComfyUI-Custom-Scripts](https://github.com/pythongosssss/ComfyUI-Custom-Scripts)を参考にしています。

また、tagsフォルダ内の

- danbooru.csv
- danbooru_e621_merged.csv
- extra-quality-tags.csv

は[a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete)よりお借りしました。

## Install
```
cd ComfyUI\custom_nodes
git clone https://github.com/jupo-ai/comfy-ex-tagcomplete.git
```

## Settings
![settings](https://files.catbox.moe/0ai9mj.png)

- `Enable`
  - 機能の有効化
- `Main Tags file`
  - メインタグのcsvファイル
  - tagsフォルダ内の **extraで始まるcsv以外** が対象
- `Extra Tags file`
  - 追加タグのcsvファイル
  - tagsフォルダ内の **extraで始まるcsvのみ** が対象
- `Delimiter`
  - タグの区切り文字
  - カンマ(,) ピリオド(.) none(なし) から選択
- `Add 'Space' after separator`
  - 区切り文字の後に空白を追加する
- `Insert Tag on Tab key`
  - Tab キーで挿入する
- `Insert Tag on Enter key`
  - Enter キーで挿入する
- `Max Suggestions to Display`
  - タグ候補の表示数
  - 0で全て表示するが重くなる(めちゃくちゃ重い)
- `Add Wiki Link Button`
  - タグ候補左にwiki (danbooru / e621) へのリンクボタンを追加する
- `Replace '_' to 'Space'`
  - タグの _ を空白に置き換える
- `Completion delay(ms)`
  - 入力してからタグ候補を表示するまでの時間
- `Enable Embeddings`
  - Embeddingファイルも候補に含める
- `Enable LoRAs`
  - LoRAファイルも候補に含める
- `Restrict Alias`
  - ONにすると、Alias(1girls => 1girlなど)が完全一致の場合のみ表示される
  - 例えば、1girlsまで入力しないと「1girls => 1girl」のAliasは表示されない


## カテゴリフィルタ
![filter](https://files.catbox.moe/bir330.png)

カテゴリを指定して検索できます。  
`--〇〇` と入力してカテゴリを指定します。  
使用できるカテゴリは [カテゴリマップ](category_map.csv) にあります。  
- 例
  - `--character fate`
    - `fate` の検索結果のうち、カテゴリが `character` のもののみ表示されます。


## プレフィックス
![prefix](https://files.catbox.moe/uddq2d.png)

プレフィックスを設定して検索できます。  
`++〇〇` と入力してプレフィックスを設定します。  
プレフィックスは複数設定できます。  
- 例
  - `++pink skirt`
    - skirt で検索し、`pleated skirt` を選んだ場合、結果は `pink pleated skirt` となります。