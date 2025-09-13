import folder_paths
from pathlib import Path
import configparser
import os
import yaml
from . import paths
import numpy as np
import re
from typing import List, Dict, Tuple, Optional, Any

# -----------------------------------------------
# 以下のフォルダからワイルドカードを取得する
#   1. comfy-simple-wildcards/wildcard
#   2. extra_model_pathsでwildcardsに設定されたディレクトリ
#   3. ComfyUI-Impact-Pack/wildcards
#   4. ComfyUI-Impact-Pack/impact-pack.iniで設定されたディレクトリ
# -----------------------------------------------
def get_wildcard_dirs() -> List[str]:
    """ワイルドカードファイルが格納されているディレクトリのリストを取得します。"""
    dirs = []
    
    # 1. comfy-simple-wildcards/wildcard
    dirs.append(str(paths.custom_nodes_dir / "comfy-simple-wildcards" / "wildcards"))

    # 2. extra_model_paths.yaml で設定されたパス
    try:
        # `folder_paths.get_folder_paths` はリストを返す
        dirs.extend(folder_paths.get_folder_paths("wildcards"))
    except Exception:
        pass
    
    # 3. ComfyUI-Impact-Pack/wildcards
    dirs.append(str(paths.custom_nodes_dir / "ComfyUI-Impact-Pack" / "wildcards"))

    # 4. ComfyUI-Impact-Pack/impact-pack.ini で設定されたパス
    ini_file = paths.custom_nodes_dir / "ComfyUI-Impact-Pack" / "impact-pack.ini"
    try:
        config = configparser.ConfigParser()
        config.read(ini_file, encoding="utf-8")
        if "default" in config and "custom_wildcards" in config["default"]:
            dirs.append(config["default"]["custom_wildcards"])
    except Exception:
        pass

    # 存在するディレクトリのみをリストアップ
    return [path for path in dirs if Path(path).exists()]


class WildcardLoader:
    """
    テキスト内のワイルドカード（例: `__animal__`）や選択オプション（例: `{cat|dog}`）を
    解決・置換する機能を提供するクラス。
    """
    # --- クラス属性 & 定数 ---
    _wildcards: Dict[str, List[str]] = {}
    _dirs: List[str] = get_wildcard_dirs()

    # 正規表現パターン
    QUANTIFIER_RE = re.compile(r"(?P<quantifier>\d+)#__(?P<keyword>[\w.\-+/*\\]+?)__", re.IGNORECASE)
    OPTION_RE = re.compile(r'(?<!\\)\{((?:[^{}]|(?<=\\)[{}])*?)(?<!\\)\}')
    WILDCARD_RE = re.compile(r"__([\w.\-+/*\\]+?)__")

    # --- Public API ---

    @classmethod
    def load(cls, force: bool = False):
        """
        設定されたディレクトリからワイルドカードファイルを読み込みます。
        
        Args:
            force (bool): Trueの場合、読み込み済みのキャッシュを破棄して再読み込みします。
        """
        if force:
            cls.unload()
        
        if cls._wildcards:
            return

        for path_str in cls._dirs:
            try:
                cls._load_wildcards_from_directory(Path(path_str))
            except Exception as e:
                print(f"Failed to load wildcards from {path_str}: {e}")

    @classmethod
    def unload(cls):
        """読み込み済みのワイルドカードをすべてクリアします。"""
        cls._wildcards = {}
    
    @classmethod
    def get_wildcards_list(cls) -> List[str]:
        """__name__形式のワイルドカード名のリストを返します。"""
        return [f"__{key}__" for key in cls._wildcards.keys()]
    
    @classmethod
    def get_wildcards_dict(cls) -> Dict[str, List[str]]:
        """ワイルドカードの辞書（キー: 名前, 値: 候補リスト）を返します。"""
        return cls._wildcards

    @classmethod
    def process(cls, text: str, seed: int) -> str:
        """
        入力テキスト内のワイルドカードと選択オプションを展開します。
        
        Args:
            text (str): 処理対象のテキスト。
            seed (int): 乱数生成のためのシード値。
            
        Returns:
            str: 展開後のテキスト。
        """
        if not text:
            return ""

        text = cls._remove_comments(text)
        random_gen = np.random.default_rng(seed)
        
        # ネストされたワイルドカードやオプションを解決するため、置換がなくなるまでループ
        # 無限ループを避けるために最大深度を設定
        for _ in range(100):
            original_text = text
            
            # 数量子（例: 3#__animal__）を {__animal__|__animal__|__animal__} 形式に展開
            text = cls._handle_quantifiers(text)
            
            # 選択オプション（例: {cat|dog}）を置換
            text = cls._replace_all_options(text, random_gen)

            # ワイルドカード（例: __animal__）を置換
            text = cls._replace_all_wildcards(text, random_gen)

            # テキストに変化がなければループを終了
            if text == original_text:
                break
        
        return text

    # --- ファイル読み込み関連のメソッド ---

    @classmethod
    def _load_wildcards_from_directory(cls, dir_path: Path):
        """指定されたディレクトリからワイルドカードファイルを再帰的に読み込みます。"""
        for root, _, files in os.walk(dir_path, followlinks=True):
            root_path = Path(root)
            for file in files:
                file_path = root_path / file
                
                if file_path.suffix == ".txt":
                    key = cls._key_normalize(file_path.stem)
                    rel_path = file_path.relative_to(dir_path)
                    key = cls._key_normalize(str(rel_path.with_suffix('')))
                    
                    if key not in cls._wildcards:
                        lines = cls._read_text_file(file_path)
                        # コメント行（#で始まる行）を除外
                        cls._wildcards[key] = [line for line in lines if not line.strip().startswith("#")]

                elif file_path.suffix in [".yml", ".yaml"]:
                    yaml_data = cls._read_yaml_file(file_path)
                    if yaml_data:
                        cls._parse_yaml_data(yaml_data)

    @classmethod
    def _parse_yaml_data(cls, data: Any, prefix: str = ""):
        """YAMLファイルから読み込んだデータを再帰的に処理し、ワイルドカード辞書に登録します。"""
        if isinstance(data, dict):
            for key, value in data.items():
                new_prefix = f"{prefix}/{key}" if prefix else key
                cls._parse_yaml_data(value, new_prefix)
        elif isinstance(data, list):
            normalized_key = cls._key_normalize(prefix)
            cls._wildcards[normalized_key] = [str(item) for item in data]
        elif isinstance(data, (str, int, float)):
            normalized_key = cls._key_normalize(prefix)
            cls._wildcards[normalized_key] = [str(data)]

    @staticmethod
    def _read_text_file(file_path: Path) -> List[str]:
        """テキストファイルを読み込み、行のリストとして返します。UTF-8で失敗した場合、ISO-8859-1を試します。"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read().splitlines()
        except UnicodeDecodeError:
            with open(file_path, "r", encoding="ISO-8859-1") as f:
                return f.read().splitlines()

    @staticmethod
    def _read_yaml_file(file_path: Path) -> Optional[Dict]:
        """YAMLファイルを読み込み、辞書として返します。エンコーディングフォールバックにも対応します。"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
        except (UnicodeDecodeError, yaml.YAMLError):
            try:
                with open(file_path, "r", encoding="ISO-8859-1") as f:
                    return yaml.safe_load(f)
            except Exception as e:
                print(f"Failed to read YAML file {file_path}: {e}")
                return None

    # --- テキスト処理のコアメソッド ---

    @classmethod
    def _handle_quantifiers(cls, text: str) -> str:
        """ `N#__keyword__` 形式の数量子構文を展開します。"""
        for match in cls.QUANTIFIER_RE.finditer(text):
            parts = match.groupdict()
            count = int(parts.get('quantifier') or 1)
            keyword = parts.get('keyword', '')
            
            # `__keyword__|__keyword__|...` のような文字列に置換
            replacement = '__|__'.join([keyword] * count)
            
            # `*` などの特殊文字をエスケープして、正確な置換を行う
            keyword_re = keyword.replace('*', r'\*').replace('+', r'\+')
            temp_re = re.compile(fr"\d+#__{keyword_re}__", re.IGNORECASE)
            text = temp_re.sub(f"__{replacement}__", text, 1)
            
        return text

    @classmethod
    def _replace_all_options(cls, text: str, random_gen: np.random.Generator) -> str:
        """テキスト内のすべての選択オプション `{...}` を置換します。"""
        # 複数回の置換が必要な場合があるためループ処理
        while True:
            new_text, replacements_found = cls.OPTION_RE.subn(
                lambda m: cls._process_option_group(m, random_gen), text
            )
            if not replacements_found:
                break
            text = new_text
        return text
    
    @classmethod
    def _replace_all_wildcards(cls, text: str, random_gen: np.random.Generator) -> str:
        """テキスト内のすべてのワイルドカード `__...__` を置換します。"""
        matches = list(cls.WILDCARD_RE.finditer(text))
        
        for match in matches:
            wildcard_str = match.group(0) # `__keyword__`
            keyword = cls._key_normalize(match.group(1)) # `keyword`
            
            options = []
            
            # 1. 通常のワイルドカード
            if keyword in cls._wildcards:
                options = cls._wildcards[keyword]
            # 2. Globパターン (`*`) を含むワイルドカード
            elif '*' in keyword:
                try:
                    glob_re = re.compile(keyword.replace('*', '.*').replace('+', r'\+'))
                    for k, v in cls._wildcards.items():
                        if glob_re.fullmatch(k):
                            options.extend(v)
                except re.error:
                    pass # 無効な正規表現パターンは無視
            # 3. フォールバック (`/` がない場合、 `*/keyword` として再検索)
            elif '/' not in keyword:
                fallback_wildcard = f"__*/{keyword}__"
                # `text` 全体を渡すのではなく、現在のワイルドカード部分のみを再帰的に処理
                replacement = cls._replace_all_wildcards(fallback_wildcard, random_gen)
                text = text.replace(wildcard_str, replacement, 1)
                continue

            if options:
                # 確率をパースして選択
                probabilities, clean_options = cls._parse_probabilities(options)
                selected_item = random_gen.choice(clean_options, p=probabilities)
                text = text.replace(wildcard_str, str(selected_item), 1)

        return text

    @classmethod
    def _process_option_group(cls, match: re.Match, random_gen: np.random.Generator) -> str:
        """単一の選択グループ `{...}` を処理します。"""
        content = match.group(1)
        options = content.split('|')
        
        # 複数選択構文（例: `2-4$$__colors__`）の解析
        select_range_str, separator, remaining_options_str = cls._parse_multi_select_syntax(options[0])
        
        if select_range_str:
            # 範囲指定がある場合は、オプションを再構築
            options = remaining_options_str.split('|') if remaining_options_str else []
            # オプションがワイルドカード形式の場合、展開する
            if len(options) == 1 and cls.WILDCARD_RE.search(options[0]):
                options = cls._get_options_from_wildcard_str(options[0])
        
        if not options:
            return ""

        # 選択数の決定
        select_count = cls._determine_select_count(select_range_str, len(options), random_gen)
        
        # 確率の解析
        probabilities, clean_options = cls._parse_probabilities(options)

        # 置換アイテムの選択
        if select_count > len(clean_options):
             # 選択数より候補が少ない場合は、候補をシャッフルしてすべて使用
            random_gen.shuffle(clean_options)
            selected_items = clean_options
        else:
            selected_items = random_gen.choice(
                clean_options, 
                size=select_count, 
                replace=False, 
                p=probabilities
            )
        
        return separator.join(map(str, selected_items))

    # --- ユーティリティ & ヘルパーメソッド ---

    @staticmethod
    def _key_normalize(text: str) -> str:
        """ワイルドカードのキーを正規化します（小文字化、バックスラッシュをスラッシュに、スペースをハイフンに）。"""
        return text.replace("\\", "/").replace(" ", "-").lower()
        
    @staticmethod
    def _is_numeric(text: str) -> bool:
        """文字列が数値（整数または浮動小数点数）かどうかを判定します。"""
        return re.match(r'^-?(\d*\.?\d+|\d+\.?\d*)$', text) is not None

    @classmethod
    def _parse_probabilities(cls, options: List[str]) -> Tuple[List[float], List[str]]:
        """
        オプションリストから `確率::値` 形式を解析します。
        
        Returns:
            (正規化された確率のリスト, 確率部分を取り除いた値のリスト)
        """
        probabilities = []
        clean_options = []
        
        for option in options:
            option_str = str(option)
            parts = option_str.split("::", 1)
            
            weight = 1.0
            value = option_str
            
            if len(parts) == 2 and cls._is_numeric(parts[0].strip()):
                weight = float(parts[0].strip())
                value = parts[1]
            
            probabilities.append(weight)
            clean_options.append(value)
            
        total_weight = sum(probabilities)
        if total_weight == 0:
            # 全ての重みが0の場合は均等確率にする
            num_options = len(options)
            normalized_probs = [1.0 / num_options] * num_options if num_options > 0 else []
        else:
            normalized_probs = [w / total_weight for w in probabilities]
            
        return normalized_probs, clean_options

    @staticmethod
    def _parse_multi_select_syntax(option_str: str) -> Tuple[str, str, str]:
        """`範囲$$区切り文字$$オプション` の構文を解析します。"""
        if "$$" not in option_str:
            return "", " ", "" # デフォルト値

        parts = option_str.split("$$")
        if len(parts) == 2:
            return parts[0], " ", parts[1] # `範囲$$オプション`
        elif len(parts) == 3:
            return parts[0], parts[1], parts[2] # `範囲$$区切り文字$$オプション`
        
        return "", " ", option_str # 不正な形式

    @classmethod
    def _determine_select_count(cls, range_str: str, num_options: int, random_gen: np.random.Generator) -> int:
        """範囲文字列（例: `1-3`, `2`）から実際に選択する数を決定します。"""
        if not range_str:
            return 1 # 範囲指定なしの場合は1つ選択

        min_val, max_val = 1, 1
        
        range_match = re.match(r'(\d+)-(\d+)', range_str)
        if range_match:
            min_val = int(range_match.group(1))
            max_val = int(range_match.group(2))
        elif cls._is_numeric(range_str):
            min_val = max_val = int(range_str)
        
        # 実際の選択範囲を候補数に合わせる
        low = min(min_val, max_val)
        high = min(max(min_val, max_val), num_options)
        
        if low >= high:
            return high
        return random_gen.integers(low, high + 1)

    @classmethod
    def _get_options_from_wildcard_str(cls, wildcard_str: str) -> List[str]:
        """`__*color__`のような文字列からワイルドカードを展開して候補リストを返します。"""
        options = []
        matches = cls.WILDCARD_RE.findall(wildcard_str)
        
        for match in matches:
            keyword = cls._key_normalize(match)
            if keyword in cls._wildcards:
                options.extend(cls._wildcards[keyword])
            elif '*' in keyword:
                try:
                    glob_re = re.compile(keyword.replace('*', '.*').replace('+', r'\+'))
                    for k, v in cls._wildcards.items():
                        if glob_re.fullmatch(k):
                            options.extend(v)
                except re.error:
                    pass
        return options

    @staticmethod
    def _remove_comments(text: str) -> str:
        """
        テキストからコメント行を削除します。
        特殊仕様: コメント行の直後の行は、その前の有効な行に連結されます。
        """
        lines = text.split("\n")
        processed_lines = []
        previous_line_was_comment = False

        for line in lines:
            if line.strip().startswith("#"):
                previous_line_was_comment = True
                continue
            
            if not processed_lines:
                processed_lines.append(line)
            elif previous_line_was_comment:
                # 前の行がコメントだった場合、現在の行を前の行に連結
                processed_lines[-1] += ' ' + line
                previous_line_was_comment = False
            else:
                processed_lines.append(line)
        
        return "\n".join(processed_lines)