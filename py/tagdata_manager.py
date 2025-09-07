from . import paths
import csv
import os
import sqlite3

# ===============================================
# タグデータを管理し、検索機能を提供する
# ===============================================
class TagDataManager:
    
    # -------------------------------------------
    # 静的プロパティ
    # -------------------------------------------
    main_data: list[dict] = []
    extra_data: list[dict] = []
    embeddings_data: list[dict] = []
    loras_data: list[dict] = []

    all_data: list[dict] = []
    
    max_count: int = 50
    restrictAlias: bool = False
    
    conn = None
    
    
    # -------------------------------------------
    # 初期化
    # -------------------------------------------
    @classmethod
    def init_db(cls):
        cls.conn = sqlite3.connect(':memory:')
        cls.conn.execute('''
            CREATE TABLE tags (
                term TEXT,
                text TEXT,
                value TEXT,
                category TEXT,
                postCount TEXT,
                categoryName TEXT,
                site TEXT
            )
        ''')
        # インデックス作成で検索高速化
        cls.conn.execute('CREATE INDEX idx_term ON tags(term)')
        cls.conn.execute('CREATE INDEX idx_category ON tags(category)')
        # categoryNameを大文字小文字無視で検索できるようにするインデックス
        cls.conn.execute('CREATE INDEX idx_categoryName_lower ON tags(LOWER(categoryName))')
        cls.conn.commit()
    
    # -------------------------------------------
    # カテゴリマップ読込
    # -------------------------------------------
    @classmethod
    def load_category_map(cls):
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
    
    
    # -------------------------------------------
    # CSV読込
    # -------------------------------------------
    @classmethod
    def load_csv(cls, filename, is_main):
        csv_path = paths.tags_dir / filename
        
        with open(csv_path, mode="r", encoding="utf-8") as file:
            reader = csv.reader(file)
            rows = [row for row in reader if row] # 空行除去
            parsed = cls.parse_csv(rows)
        
        if is_main:
            cls.main_data = parsed
        else:
            cls.extra_data = parsed
        
        cls.update_all_data()
    
    
    # -------------------------------------------
    # Embeddings読込
    # -------------------------------------------
    @classmethod
    def load_embeddings(cls, files):
        cls.embeddings_data = cls.parse_embeddings(files)
        cls.update_all_data()
    
    
    # -------------------------------------------
    # LoRA読込
    # -------------------------------------------
    @classmethod
    def load_loras(cls, files):
        cls.loras_data = cls.parse_loras(files)
        cls.update_all_data()
    
    
    # -------------------------------------------
    # 全データ更新
    # -------------------------------------------
    @classmethod
    def update_all_data(cls):
        cls.all_data = [
            *cls.main_data, 
            *cls.extra_data, 
            *cls.embeddings_data, 
            *cls.loras_data
        ]
        cls.all_data = [data for data in cls.all_data if data and data.get("term")]
        
        # データベースを初期化してall_dataを挿入
        if cls.conn is None:
            cls.init_db()
        
        # 既存データをクリア
        cls.clear_data()

        # all_dataを挿入
        cls.insert_data(cls.all_data)
    
    
    # -------------------------------------------
    # データベースにデータを挿入
    # -------------------------------------------
    @classmethod
    def insert_data(cls, data):
        for item in data:
            if item and item.get("term"):
                cls.conn.execute('''
                    INSERT INTO tags (term, text, value, category, postCount, categoryName, site)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    item.get("term"),
                    item.get("text"),
                    item.get("value"),
                    item.get("category"),
                    item.get("postCount"),
                    item.get("categoryName"),
                    item.get("site")
                ))
        cls.conn.commit()
    
    
    # -------------------------------------------
    # パース
    # -------------------------------------------
    # --- CSV ---
    @classmethod
    def parse_csv(cls, rows: list[list[str]]):
        data = []
        category_map = cls.load_category_map()

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
            mapInfo = category_map.get(tagData.get("category")) or {
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
                "term": name, 
                "text": name, 
                "value": f"embedding:{name}", 
                "category": None, 
                "postCount": None, 
                "categoryName": "Embedding", 
                "site": None
            })
        
        return data
    
    # --- Loras ---
    @classmethod
    def parse_loras(cls, files: list[str]):
        data = []
        for file in files:
            name = os.path.splitext(file)[0]
            data.append({
                "term": name, 
                "text": name, 
                "value": f"<lora:{name}:1>", 
                "category": None, 
                "postCount": None, 
                "categoryName": "LoRA", 
                "site": None
            })
        
        return data
    
    
    
    # -------------------------------------------
    # 検索
    # -------------------------------------------
    @classmethod
    def search(cls, term: str, category: list[str] = None):
        if cls.conn is None:
            return []
        
        # restrictAliasがtrueの場合の条件
        if cls.restrictAlias:
            # Aliasではないデータ、またはAliasで完全一致するデータのみ
            where_clause = "WHERE (postCount != 'Alias' OR (postCount = 'Alias' AND term = ?)) AND term LIKE '%' || ? || '%'"
            params = [term, term]
        else:
            # 通常の部分一致検索
            where_clause = "WHERE term LIKE '%' || ? || '%'"
            params = [term]
        
        # カテゴリフィルタ（複数対応）- categoryNameで検索
        if category and len(category) > 0:
            # カテゴリリストを全部小文字化
            category_lower = [c.lower() for c in category]
            placeholders = ','.join(['?' for _ in category_lower])
            where_clause += f" AND LOWER(categoryName) IN ({placeholders})"
            params.extend(category_lower)
        
        # postCountでソート（数字変換可能なら大きい順、そうでなければ末尾）
        query = f'''
            SELECT term, text, value, category, postCount, categoryName, site 
            FROM tags 
            {where_clause}
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
            params.append(cls.max_count)
        
        cursor = cls.conn.execute(query, params)
        results = []
        
        for row in cursor.fetchall():
            results.append({
                "term": row[0],
                "text": row[1], 
                "value": row[2],
                "category": row[3],
                "postCount": row[4],
                "categoryName": row[5],
                "site": row[6]
            })
        
        return results
    
    
    # -------------------------------------------
    # データベースクリア
    # -------------------------------------------
    @classmethod
    def clear_data(cls):
        if cls.conn:
            cls.conn.execute("DELETE FROM tags")
            cls.conn.commit()
    
    
    # -------------------------------------------
    # データベース閉じる
    # -------------------------------------------
    @classmethod
    def close(cls):
        if cls.conn:
            cls.conn.close()
            cls.conn = None