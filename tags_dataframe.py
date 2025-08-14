import pandas as pd
from . import paths
from .utils import log
import folder_paths
from pathlib import Path

class TagsDataFrame:
    """タグデータを管理し、検索用のデータフレームを提供するクラス"""
    
    tags_df: pd.DataFrame = None        # メインタグのデータフレーム
    tags_alias_df: pd.DataFrame = None  # タグエイリアスのデータフレーム
    extra_df: pd.DataFrame = None       # 追加タグのデータフレーム
    extra_alias_df: pd.DataFrame = None # 追加タグエイリアスのデータフレーム
    embeddings_df: pd.DataFrame = None  # embeddingsのデータフレーム
    loras_df: pd.DataFrame = None       # lorasのデータフレーム
    
    restrictAlias: bool = False

    @classmethod
    def load_csv(cls, csv_path):
        """
        CSVを読み込み、検索用のデータフレームを作成する。
        
        Args:
            csv_path (str): CSVファイルのパス
        
        Returns:
            tuple: (メインDataFrame, エイリアスDataFrame)
        
        作成されるデータフレームのカラム:
            - term: 検索対象のタグ
            - text: ドロップダウン表示用テキスト（例: 'alias => tag'）
            - value: 選択時の挿入タグ
            - category: タグの種類
            - postCount: 投稿数または任意の文字列（例: 'Alias', 'Embeddings'）
            - description: categoryが数値の場合の定義（なければNaN）
            - site: categoryが数値の場合のサイト情報（なければNaN）
        """
        try:
            df = pd.read_csv(csv_path, header=None)
        except Exception as e:
            log(f"CSV load failed: {e}")
            df = pd.DataFrame()

        # 期待するカラム名
        column_names = ["tag", "category", "postCount", "aliases"]
        current_cols = min(df.shape[1], len(column_names))
        df = df.iloc[:, :current_cols] # 余分なカラムは切り捨て
        df.columns = column_names[:current_cols] # 存在するカラムに名前を割り当て
        
        # 足りないカラムを追加(空埋め)
        for col in column_names[current_cols:]:
            df[col] = ""
        
        # エイリアスをリスト化して展開
        df["aliases"] = df["aliases"].fillna("")
        alias_df = df.assign(alias=df["aliases"].str.split(",")).explode("alias")
        alias_df = alias_df[alias_df["alias"] != ""]

        # メインとエイリアスのデータフレームを作成
        main_df = cls._format_main_df(df)
        alias_df = cls._format_alias_df(alias_df)

        # --- categoryマッピング ---
        # category_map.csv 読み込み
        category_csv = paths.root_dir / "category_map.csv"
        category_map_df = pd.read_csv(category_csv)

        # dict に変換
        map_desc = dict(zip(category_map_df["category"], category_map_df["description"]))
        map_site = dict(zip(category_map_df["category"], category_map_df["site"]))

        def apply_mapping(df_target):
            # category を文字列化(空はNone)
            df_target["category"] = df_target["category"].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() else None
            )
            # 数値カテゴリだけ description と site をセット
            df_target["description"] = df_target["category"].apply(
                lambda x: map_desc.get(int(x)) if x and x.isdigit() 
                else (x if x else None)
            )
            df_target["site"] = df_target["category"].apply(
                lambda x: map_site.get(int(x)) if x and x.isdigit() else None
            )
            return df_target
        
        # main_df と alias_df 両方に適用
        main_df = apply_mapping(main_df)
        alias_df = apply_mapping(alias_df)
        
        # 空文字をNoneに置き換え(javascript側の処理の都合上)
        main_df = main_df.replace("", None)
        alias_df = alias_df.replace("", None)

        return main_df, alias_df

    @classmethod
    def load_embeddings(cls):
        """embeddingsファイルからデータフレームを作成"""
        embeddings_list = folder_paths.get_filename_list("embeddings")
        termlist = [f"embedding:{Path(filename).with_suffix("")}" for filename in embeddings_list]
        embeddings_df = pd.DataFrame({
            "term": termlist, 
            "text": termlist,
            "value": termlist,
            "category": None,
            "postCount": None,
            "description": "Embedding",
            "site": None,
        })
        return embeddings_df

    @classmethod
    def load_loras(cls):
        """lorasファイルからデータフレームを作成"""
        loras_list = folder_paths.get_filename_list("loras")
        termlist = [f"lora:{Path(filename).with_suffix("")}" for filename in loras_list]
        valuelist = [f"<lora:{Path(filename).with_suffix("")}:1.0>" for filename in loras_list]
        loras_df = pd.DataFrame({
            "term": termlist, 
            "text": termlist, 
            "value": valuelist, 
            "category": None, 
            "postCount": None, 
            "description": "LoRA", 
            "site": None, 
        })
        return loras_df
    
    @staticmethod
    def _format_main_df(df: pd.DataFrame) -> pd.DataFrame:
        """メインタグのデータフレームを整形"""
        return df.assign(
            term=df["tag"],
            text=df["tag"],
            value=df["tag"]
        )[["term", "text", "value", "category", "postCount"]]

    @staticmethod
    def _format_alias_df(alias_df: pd.DataFrame) -> pd.DataFrame:
        """エイリアスタグのデータフレームを整形"""
        return alias_df.assign(
            term=alias_df["alias"],
            text=alias_df["alias"] + " => " + alias_df["tag"],
            value=alias_df["tag"],
            postCount="Alias"
        )[["term", "text", "value", "category", "postCount"]]

    @classmethod
    def search(cls, term: str, category: str) -> list:
        """
        データフレームから指定されたtermに一致するタグを検索
        
        Args:
            term (str): 検索語句
        
        Returns:
            list: 検索結果の辞書リスト
        """
        # 各データフレームから検索
        tags_res = cls._search_df(cls.tags_df, term)
        tags_alias_res = cls._search_df(cls.tags_alias_df, term, restrict=TagsDataFrame.restrictAlias)
        extra_res = cls._search_df(cls.extra_df, term)
        extra_alias_res = cls._search_df(cls.extra_alias_df, term, restrict=TagsDataFrame.restrictAlias)
        embeddings_res = cls._search_df(cls.embeddings_df, term)
        loras_res = cls._search_df(cls.loras_df, term)

        # 結果を結合してリスト化
        res = pd.concat([
            tags_res,
            tags_alias_res,
            extra_res,
            extra_alias_res,
            embeddings_res, 
            loras_res, 
        ], ignore_index=True)
        
        # カテゴリ指定がある場合は適用
        if category:
            category_lower = str(category).lower()
            res = res[res["description"].fillna("").str.lower() == category_lower]

        # NaNをNoneに変換してJSON互換にする
        res = res.where(pd.notna(res), None)
        
        return res.to_dict(orient="records")

    @staticmethod
    def _search_df(df: pd.DataFrame, term: str, restrict: bool = False) -> pd.DataFrame:
        """
        データフレームからtermに一致する行を抽出
        
        Args:
            df (pd.DataFrame): 検索対象のデータフレーム
            term (str): 検索語句
            restrict (bool): Trueなら完全一致のみ、Falseなら部分一致
        
        Returns:
            pd.DataFrame: 検索結果
        """
        if df is None or df.empty:
            return pd.DataFrame()

        try:
            if restrict:
                # 完全一致（エイリアス用）
                return df[df["term"] == term]
            else:
                # 部分一致：termで始まるものと含むもの
                starts_with = df[df["term"].str.startswith(term, na=False)]
                contains = df[df["term"].str.contains(term, na=False, regex=False)]
                contains = contains[~contains.index.isin(starts_with.index)]
                
                res =  pd.concat([starts_with, contains])

                def sort_postCount(item):
                    post_count = item.get("postCount")

                    # Noneや空文字の場合は最低順位
                    if not post_count:
                        return (2, 0)
                    
                    # 数値の場合は優先度 0 で降順ソート
                    if isinstance(post_count, int):
                        return (0, post_count)
                    
                    # 数字っぽい文字列なら変換して扱う
                    if isinstance(post_count, str) and post_count.isdigit():
                        return (0, int(post_count))
                    
                    # それ以外の場合
                    return (1, str(post_count))
                
                res = res.sort_values(
                    by="postCount", 
                    key=lambda col: col.map(lambda x: sort_postCount({"postCount": x})), 
                    ascending=False
                )
                return res
        except Exception as e:
            log(f"Search failed: {e}")
            return pd.DataFrame()

