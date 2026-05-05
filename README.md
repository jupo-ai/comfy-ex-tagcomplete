# ComfyUI-Ex-TagComplete

[<img src="https://img.shields.io/badge/lang-English-red.svg?style=plastic" height="25" />](README.en.md)
[<img src="https://img.shields.io/badge/言語-日本語-green.svg?style=plastic" height="25" />](README.md)

![capture](https://files.catbox.moe/fv292m.webp)

ComfyUI のテキスト入力欄で、タグ補完を行う拡張機能です。  
タグ CSV に加えて、翻訳ファイル、Embedding、LoRA、Wildcard も候補に含められます。

この拡張機能は [ComfyUI-Custom-Scripts](https://github.com/pythongosssss/ComfyUI-Custom-Scripts) を参考にしています。

## 特徴

- タグ CSV を使った補完
- 翻訳ファイルを使った検索補助と翻訳表示
- Embedding / LoRA / Wildcard の候補表示
- カテゴリ指定検索
- プレフィックス付き挿入
- Wiki リンクボタン表示

## インストール

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/jupo-ai/comfy-ex-tagcomplete.git
```

追加の `pip` 依存関係はありません。

## 使い方

インストール後に ComfyUI を起動すると、対応した複数行テキスト入力でタグ補完が使えるようになります。  
設定は ComfyUI の設定画面から変更できます。

## 設定

![settings](https://files.catbox.moe/0ai9mj.png)

| 項目 | 説明 |
| --- | --- |
| `Enable` | 機能全体の ON / OFF を切り替えます。 |
| `Choose Main File` | メインで使うタグ CSV を選びます。`tags` フォルダ内の `extra` で始まらない CSV が対象です。 |
| `Choose Extra File` | 追加タグ CSV を選びます。`tags` フォルダ内の `extra` で始まる CSV が対象です。 |
| `Choose Translate File` | 翻訳 CSV を選びます。`translate` フォルダ内の CSV が対象です。`None` を選ぶと無効化されます。 |
| `Delimiter` | タグ挿入時の区切り文字を指定します。`,` `.` `None` から選べます。 |
| `Add 'Space' after delimiter` | 区切り文字の後ろに半角スペースを自動で入れます。 |
| `Max Suggestions to Display` | 候補の最大表示数です。`0` にすると全件表示しますが、件数によっては重くなります。 |
| `Add 🔍 Link button` | 候補の左に Wiki / タグページを開くボタンを表示します。 |
| `Wiki Link Site` | `🔍` ボタンで開くサイトを選びます。`Auto` はタグ元のサイトを優先します。 |
| `Replace '_' with 'Space'` | 挿入時に `_` をスペースへ置き換えます。 |
| `Artist Tag Prefix` | artist 系タグの前に付ける文字列です。例: `@` |
| `Completion Delay (ms)` | 入力後、候補を表示するまでの待ち時間です。 |
| `Enable Embeddings` | Embedding を候補に含めます。`embedding:name` 形式で表示されます。 |
| `Enable LoRAs` | LoRA を候補に含めます。挿入時は `<lora:name:1>` 形式になります。 |
| `Enable Wildcards` | Wildcard を候補に含めます。`__name__` 形式で表示されます。 |
| `Restrict Alias` | Alias 候補を完全一致時のみ表示します。たとえば `1girls -> 1girl` は `1girls` まで入力したときだけ表示されます。 |
| `Search Method` | 検索方法を切り替えます。`smart` は入力文字列を空白や `_` で分割し、各語をすべて含むタグを検索します。`legacy` は入力文字列全体を 1 つのパターンとして扱い、`%term%` 形式の部分一致で検索します。 |
| `Sort Method` | 候補の並び順を切り替えます。`relevance` は完全一致 → 前方一致 → 部分一致の順で優先し、その後に `postCount` とタグ長を見ます。`legacy` は一致位置や一致度を考慮せず、主に `postCount` の高い順で並べます。 |

## 検索構文

### カテゴリフィルタ

![filter](https://files.catbox.moe/bir330.png)

`--カテゴリ名` を入力すると、カテゴリを絞って検索できます。  
利用可能なカテゴリは [category_map.csv](category_map.csv) を参照してください。

例:

```text
--character fate
```

`fate` の検索結果から、`character` カテゴリのものだけを表示します。

### プレフィックス

![prefix](https://files.catbox.moe/uddq2d.png)

`++文字列` を付けると、選択したタグの前にその文字列を付けて挿入できます。  
プレフィックスは複数指定できます。

例:

```text
++pink skirt
```

`skirt` を検索して `pleated skirt` を選ぶと、`pink pleated skirt` が挿入されます。

## 同梱データ

`tags` フォルダ内の以下の 3 ファイルは、[a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete) からお借りしています。

- `danbooru.csv`
- `danbooru_e621_merged.csv`
- `extra-quality-tags.csv`

## 補足

- 翻訳 CSV は `1列目: タグ名`、`最後の列: 翻訳文字列` として読み込まれます。
- Wildcard 候補は ComfyUI 側で利用可能な Wildcard 定義を読み込みます。
- 一部の複数行入力欄では、互換性のため補完を無効化しています。
