from . import paths
import csv
import os
import sqlite3
import folder_paths
from .wildcards import WildcardLoader

# ===============================================
# ユーティリティ
# ===============================================
def load_category_map():
    category_map = {}
    category_map_path = paths.root_dir / "category_map.csv"

    with open(category_map_path, mode="r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            category = row.get("category")
            if not category:
                continue
            category_map[category] = {
                "categoryName": row.get("description"), 
                "site": row.get("site")
            }
    
    return category_map



# ===============================================
# タグデータを管理し、検索機能を提供する
# ===============================================
class TagDataManager:
    
    # -------------------------------------------
    # 静的プロパティ
    # -------------------------------------------
    enable: bool = True
    enable_embeddings: bool = False
    enable_loras: bool = False
    enable_wildcards: bool = False
    
    main_filename: str = None
    extra_filename: str = None
    translate_filename: str = None
    
    tables = ["main", "extra", "embeddings", "loras", "wildcards"]
    category_map = load_category_map()
    max_count: int = 50
    restrictAlias: bool = False
    
    conn = None
    
    
    # -------------------------------------------
    # 初期化
    # -------------------------------------------
    @classmethod
    def init_db(cls): 
        cls.conn = sqlite3.connect(':memory:')
        
        # 各テーブル作成
        for table in cls.tables:
            cls.conn.execute(
                f'''
                CREATE TABLE IF NOT EXISTS {table}_tags (
                    term TEXT, 
                    text TEXT, 
                    value TEXT, 
                    category TEXT, 
                    postCount TEXT, 
                    categoryName TEXT, 
                    site TEXT, 
                    translate TEXT, 
                    wildcardValue TEXT
                )
                '''
            )
            
            # 各テーブルにインデックスを作成
            cls.conn.execute(f'CREATE INDEX IF NOT EXISTS idx_{table}_term ON {table}_tags(term)')
            cls.conn.execute(f'CREATE INDEX IF NOT EXISTS idx_{table}_category ON {table}_tags(category)')
            cls.conn.execute(f'CREATE INDEX IF NOT EXISTS idx_{table}_categoryName_lower ON {table}_tags(LOWER(categoryName))')
        
        cls.conn.commit()

    
    # -------------------------------------------
    # Main CSV
    # -------------------------------------------
    @classmethod
    def load_main(cls):
        # データベースが無ければ作成
        if not cls.conn:
            cls.init_db()
        
        # mainテーブルを削除
        cls.clear_data_by_table("main")
        
        # 早期リターン
        if not cls.enable: return
        if not cls.main_filename or cls.main_filename == "None": return
        csv_path = paths.tags_dir / cls.main_filename
        if not csv_path.exists(): return
        
        with open(csv_path, mode="r", encoding="utf-8") as file:
            reader = csv.reader(file)
            rows = [row for row in reader if row] # 空行除去
            
        data = cls.parse_csv(rows)
        
        # mainテーブルに挿入
        cls.insert_data_to_table(data, "main")

    
    # -------------------------------------------
    # Extra CSV
    # -------------------------------------------
    @classmethod
    def load_extra(cls):
        if not cls.conn:
            cls.init_db()
        
        cls.clear_data_by_table("extra")

        if not cls.enable: return
        if not cls.extra_filename or cls.extra_filename == "None": return
        csv_path = paths.tags_dir / cls.extra_filename
        if not csv_path.exists(): return
        
        with open(csv_path, mode="r", encoding="utf-8") as file:
            reader = csv.reader(file)
            rows = [row for row in reader if row]
        
        data = cls.parse_csv(rows)

        cls.insert_data_to_table(data, "extra")
        

    # -------------------------------------------
    # Translate
    # -------------------------------------------
    @classmethod
    def load_translate(cls):
        if not cls.conn:
            cls.init_db()
        
        cls.clear_translate_data()
        
        if not cls.enable: return
        if not cls.translate_filename or cls.translate_filename == "None": return
        csv_path = paths.translate_dir / cls.translate_filename
        if not csv_path.exists(): return
        
        with open(csv_path, mode="r", encoding="utf-8") as file:
            reader = csv.reader(file)
            rows = [row for row in reader if row]
        
        cls.apply_translate(rows)
    
    
    @classmethod
    def apply_translate(cls, rows: list[list[str]]):
        for row in rows:
            if len(row) < 2:
                continue
            
            tag = row[0]
            translate_str = row[-1]
            
            if not tag or not translate_str:
                continue
            
            for table in cls.tables:   
                cls.conn.execute(f'''
                    UPDATE {table}_tags 
                    SET translate = ?
                    WHERE term = ?
                ''', (translate_str, tag))
        
        cls.conn.commit()
    
    
    @classmethod
    def clear_translate_data(cls):
        if cls.conn is None:
            return
        
        # translateカラムを全てNULLにリセット
        for table in cls.tables:
            cls.conn.execute(f'UPDATE {table}_tags SET translate = NULL')
        cls.conn.commit()
    
    
    # -------------------------------------------
    # Embeddings
    # -------------------------------------------
    @classmethod
    def load_embeddings(cls):
        if not cls.conn:
            cls.init_db()
        
        cls.clear_data_by_table("embeddings")

        if not cls.enable: return
        if not cls.enable_embeddings: return
        
        files = folder_paths.get_filename_list("embeddings")
        data = cls.parse_embeddings(files)

        cls.insert_data_to_table(data, "embeddings")
    
    
    # -------------------------------------------
    # LoRA
    # -------------------------------------------
    @classmethod
    def load_loras(cls):
        if not cls.conn:
            cls.init_db()
        
        cls.clear_data_by_table("loras")

        if not cls.enable: return
        if not cls.enable_loras: return
        
        files = folder_paths.get_filename_list("loras")
        data = cls.parse_loras(files)

        cls.insert_data_to_table(data, "loras")
    
    
    # -------------------------------------------
    # Wildcards
    # -------------------------------------------
    @classmethod
    def load_wildcards(cls):
        if not cls.conn:
            cls.init_db()
        
        cls.clear_data_by_table("wildcards")
        WildcardLoader.unload()

        if not cls.enable: return
        if not cls.enable_wildcards: return
        
        WildcardLoader.load()
        data = cls.parse_wildcards()

        cls.insert_data_to_table(data, "wildcards")

        WildcardLoader.unload()
    

    # -------------------------------------------
    # データベースにデータを挿入
    # -------------------------------------------
    @classmethod
    def insert_data_to_table(cls, data, table):
        for item in data:
            if item and item.get("term"):
                cls.conn.execute(
                    f'''
                    INSERT INTO {table}_tags (term, text, value, category, postCount, categoryName, site, translate, wildcardValue)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        item.get("term"), 
                        item.get("text"), 
                        item.get("value"), 
                        item.get("category"), 
                        item.get("postCount"), 
                        item.get("categoryName"), 
                        item.get("site"), 
                        item.get("translate"), 
                        item.get("wildcardValue")
                    )
                )
        
        cls.conn.commit()
    
    
    # -------------------------------------------
    # パース
    # -------------------------------------------
    
    # --- CSV ---
    @classmethod
    def parse_csv(cls, rows: list[list[str]]):
        data = []

        for row in rows:
            if len(row) < 4:
                continue
            
            tag = row[0]
            category = row[1]
            postCount = row[2]
            aliasesStr = row[3]
            
            if not tag:
                continue # 空行や不正行をスキップ
            
            # --- メインデータ ---
            main_entry = {
                "term": tag, 
                "text": tag, 
                "value": tag, 
                "category": category if category else None, 
                "postCount": postCount if postCount else None, 
            }
            data.append(main_entry)

            # --- エイリアスデータ ---
            if aliasesStr:
                for aliasTag in aliasesStr.split(","):
                    if aliasTag:
                        alias_entry = {
                            "term": aliasTag, 
                            "text": f"{aliasTag} => {tag}", 
                            "value": tag, 
                            "category": category if category else None, 
                            "postCount": "Alias", 
                        }
                        data.append(alias_entry)
        
        # --- categoryName と site のマッピング ---
        for tagData in data:
            mapInfo = cls.category_map.get(tagData.get("category")) or {
                "categoryName": None, 
                "site": None
            }
            tagData["categoryName"] = mapInfo["categoryName"]
            tagData["site"] = mapInfo["site"]
        
        return data
    
    # --- Embeddings ---
    @classmethod
    def parse_embeddings(cls, files: list[str]):
        data = []
        for file in files:
            name = os.path.splitext(file)[0]
            data.append({
                "term": f"embedding:{name}", 
                "text": f"embedding:{name}", 
                "value": f"embedding:{name}", 
                "category": None, 
                "postCount": None, 
                "categoryName": "Embedding", 
                "site": None, 
            })
        
        return data
    
    # --- Loras ---
    @classmethod
    def parse_loras(cls, files: list[str]):
        data = []
        for file in files:
            name = os.path.splitext(file)[0]
            data.append({
                "term": f"lora:{name}", 
                "text": f"lora:{name}", 
                "value": f"<lora:{name}:1>", 
                "category": None, 
                "postCount": None, 
                "categoryName": "LoRA", 
                "site": None, 
            })
        
        return data
    
    # --- Wildcards ---
    @classmethod
    def parse_wildcards(cls):
        data = []
        wildcards = WildcardLoader.get_wildcards_dict()
        for key, value in wildcards.items():
            key = f"__{key}__"
            data.append({
                "term": key, 
                "text": key, 
                "value": key, 
                "category": None, 
                "postCount": None, 
                "categoryName": "Wildcard", 
                "site": None, 
                "wildcardValue": ",".join(value)
            })
        
        return data
    
    
    # -------------------------------------------
    # 検索
    # -------------------------------------------
    @classmethod
    def search(cls, term: str, category: list[str] = None):
        if not cls.enable or cls.conn is None: return []
        
        escaped_term = term.replace('_', '\\_').replace('%', '\\%')

        # Restrict Alias
        if cls.restrictAlias:
            where_clause = "(postCount IS NULL OR postCount != 'Alias' OR (postCount = 'Alias' AND (term = ? OR translate = ?))) AND (term LIKE '%' || ? || '%' ESCAPE '\\' OR translate LIKE '%' || ? || '%' ESCAPE '\\')"
            params = [term, term, escaped_term, escaped_term]
        else:
            where_clause = "(term LIKE '%' || ? || '%' ESCAPE '\\' OR translate LIKE '%' || ? || '%' ESCAPE '\\')"
            params = [escaped_term, escaped_term]
        
        # カテゴリフィルタ
        if category and len(category) > 0:
            category_lower = [c.lower() for c in category]
            placeholders = ','.join(['?' for _ in category_lower])
            where_clause += f" AND LOWER(categoryName) IN ({placeholders})"
            params.extend(category_lower)
        
        # 各テーブルからのSELECT文を作成
        union_queries = []
        for table in cls.tables:
            union_queries.append(f'''
                SELECT term, text, value, category, postCount, categoryName, site, translate, wildcardValue 
                FROM {table}_tags 
                WHERE {where_clause}
            ''')
        
        # UNIONで結合
        union_query = ' UNION ALL '.join(union_queries)
        
        # サブクエリとしてラップしてORDER BY
        query = f'''
        SELECT * FROM ({union_query})
        ORDER BY 
            CASE 
                WHEN postCount GLOB '[0-9]*' THEN CAST(postCount AS INTEGER)
                ELSE -1
            END DESC,
            CASE 
                WHEN postCount GLOB '[0-9]*' THEN ''
                ELSE postCount
            END ASC,
            term ASC
        '''
        
        # 取得数制限
        if cls.max_count is not None and cls.max_count > 0:
            query += f" LIMIT ?"
            # UNIONの場合、パラメータを各テーブル分準備
            all_params = []
            for _ in cls.tables:
                all_params.extend(params)
            all_params.append(cls.max_count)
        else:
            all_params = []
            for _ in cls.tables:
                all_params.extend(params)
        
        cursor = cls.conn.execute(query, all_params)
        results = []
        
        for row in cursor.fetchall():
            results.append({
                "term": row[0],
                "text": row[1], 
                "value": row[2],
                "category": row[3],
                "postCount": row[4],
                "categoryName": row[5],
                "site": row[6], 
                "translate": row[7], 
                "wildcardValue": row[8], 
            })
    
        return results
    
    
    # -------------------------------------------
    # データベースクリア
    # -------------------------------------------
    @classmethod
    def clear_data_by_table(cls, table):
        if cls.conn:
            cls.conn.execute(f"DELETE FROM {table}_tags")
            cls.conn.commit()
    
    
    # -------------------------------------------
    # データベース閉じる
    # -------------------------------------------
    @classmethod
    def close(cls):
        if cls.conn:
            cls.conn.close()
            cls.conn = None
    
    
    # -------------------------------------------
    # 有効無効の切り替え
    # -------------------------------------------
    @classmethod
    def toggle_enable(cls, value):
        cls.enable = value

        if value:
            # trueの場合、全データ読み直し
            cls.load_main()
            cls.load_extra()
            cls.load_translate()
            cls.load_embeddings()
            cls.load_loras()
        else:
            # false場合、データベースを閉じてメモリ解放
            cls.close()