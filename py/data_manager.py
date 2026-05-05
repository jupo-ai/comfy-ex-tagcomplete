import csv
import os
import re
import sqlite3

import folder_paths

from .wildcards import WildcardLoader
from . import paths


def load_category_map():
    category_map = {}
    if not paths.category_map_path.exists():
        return category_map

    with open(paths.category_map_path, mode="r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            category = row.get("category")
            if not category:
                continue

            category_map[category] = {
                "categoryName": row.get("description"),
                "category": (row.get("description") or "").lower() or None,
                "site": row.get("site"),
            }

    return category_map


class TagDataManager:
    enable: bool = True
    enable_embeddings: bool = False
    enable_loras: bool = False
    enable_wildcards: bool = False

    search_method: str = "smart"
    sort_method: str = "relevance"

    main_filename: str = None
    extra_filename: str = None
    translate_filename: str = None

    tables = ["main", "extra", "embeddings", "loras", "wildcards"]
    columns = [
        ("term", "TEXT"),
        ("display", "TEXT"),
        ("value", "TEXT"),
        ("postCount", "INTEGER"),
        ("category", "TEXT"),
        ("categoryName", "TEXT"),
        ("site", "TEXT"),
        ("wildcardValue", "TEXT"),
        ("note", "TEXT"),
    ]
    translate_table_name = "translate_terms"
    category_map = load_category_map()
    max_count: int = 50
    restrict_alias: bool = False

    # Backwards-compatible spelling used by the old endpoints/settings.
    restrictAlias: bool = False

    conn = None

    @classmethod
    def init_db(cls):
        cls.conn = sqlite3.connect(":memory:")

        for table in cls.tables:
            columns_sql = ", ".join([f"{column} {typing}" for column, typing in cls.columns])
            cls.conn.execute(f"CREATE TABLE IF NOT EXISTS {table}_tags ({columns_sql})")
            cls.conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_term ON {table}_tags (term)")
            cls.conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_category ON {table}_tags (category)")
            cls.conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_category_name ON {table}_tags (categoryName)")

        cls.conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {cls.translate_table_name} (
                term TEXT PRIMARY KEY,
                translate TEXT
            )
            """
        )
        cls.conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{cls.translate_table_name}_term ON {cls.translate_table_name} (term)")
        cls.conn.commit()

    @classmethod
    def load_main(cls):
        if not cls.conn:
            cls.init_db()

        cls.clear_data_by_table("main")
        if not cls.enable:
            return
        if not cls.main_filename or cls.main_filename == "None":
            return

        csv_path = paths.tags_dir / cls.main_filename
        if not csv_path.exists():
            return

        with open(csv_path, mode="r", encoding="utf-8") as file:
            rows = [row for row in csv.reader(file) if row]

        cls.insert_data_to_table("main", cls.parse_csv(rows, cls.infer_site_from_filename(cls.main_filename)))

    @classmethod
    def load_extra(cls):
        if not cls.conn:
            cls.init_db()

        cls.clear_data_by_table("extra")
        if not cls.enable:
            return
        if not cls.extra_filename or cls.extra_filename == "None":
            return

        csv_path = paths.tags_dir / cls.extra_filename
        if not csv_path.exists():
            return

        with open(csv_path, mode="r", encoding="utf-8") as file:
            rows = [row for row in csv.reader(file) if row]

        cls.insert_data_to_table("extra", cls.parse_csv(rows, cls.infer_site_from_filename(cls.extra_filename)))

    @classmethod
    def load_translate(cls):
        if not cls.conn:
            cls.init_db()

        cls.clear_data_by_table(cls.translate_table_name)
        if not cls.enable:
            return
        if not cls.translate_filename or cls.translate_filename == "None":
            return

        csv_path = paths.translate_dir / cls.translate_filename
        if not csv_path.exists():
            return

        translations = []
        with open(csv_path, mode="r", encoding="utf-8") as file:
            for row in csv.reader(file):
                if len(row) < 2:
                    continue
                tag = row[0]
                translate_str = row[-1]
                if tag and translate_str:
                    translations.append((tag, translate_str))

        if translations:
            cls.conn.executemany(
                f"INSERT OR REPLACE INTO {cls.translate_table_name} (term, translate) VALUES (?, ?)",
                translations,
            )
            cls.conn.commit()

    @classmethod
    def load_embeddings(cls):
        if not cls.conn:
            cls.init_db()

        cls.clear_data_by_table("embeddings")
        if not cls.enable or not cls.enable_embeddings:
            return

        cls.insert_data_to_table("embeddings", cls.parse_embeddings(folder_paths.get_filename_list("embeddings")))

    @classmethod
    def load_loras(cls):
        if not cls.conn:
            cls.init_db()

        cls.clear_data_by_table("loras")
        if not cls.enable or not cls.enable_loras:
            return

        cls.insert_data_to_table("loras", cls.parse_loras(folder_paths.get_filename_list("loras")))

    @classmethod
    def load_wildcards(cls):
        if not cls.conn:
            cls.init_db()

        cls.clear_data_by_table("wildcards")
        if not cls.enable or not cls.enable_wildcards:
            WildcardLoader.unload()
            return

        WildcardLoader.load(force=True)
        cls.insert_data_to_table("wildcards", cls.parse_wildcards())

    @classmethod
    def parse_csv(cls, rows: list[list[str]], source_site: str = None):
        data = []

        for row in rows:
            try:
                if len(row) < 4:
                    continue

                tag = row[0]
                category_id = row[1]
                post_count = row[2]
                aliases_str = row[3]
                if not tag:
                    continue

                entry = {
                    "term": tag,
                    "display": tag,
                    "value": tag,
                }

                if post_count and post_count.isdecimal():
                    entry["postCount"] = int(post_count)
                elif post_count:
                    entry["note"] = post_count

                category_info = cls.category_map.get(category_id)
                if category_info:
                    entry["category"] = category_info.get("category")
                    entry["categoryName"] = category_info.get("categoryName")
                    if not source_site:
                        entry["site"] = category_info.get("site")

                if source_site:
                    entry["site"] = source_site

                data.append(entry)

                if aliases_str:
                    for alias in aliases_str.split(","):
                        if not alias:
                            continue
                        alias_entry = entry.copy()
                        alias_entry["term"] = alias
                        alias_entry["display"] = f"{alias} -> {tag}"
                        alias_entry["note"] = "alias"
                        data.append(alias_entry)
            except Exception as error:
                print(f"ExTagComplete: failed to parse row {row}: {error}")

        return data

    @classmethod
    def parse_embeddings(cls, files: list[str]):
        return [
            {
                "term": f"embedding:{os.path.splitext(file)[0]}",
                "display": f"embedding:{os.path.splitext(file)[0]}",
                "value": f"embedding:{os.path.splitext(file)[0]}",
                "category": "embedding",
                "categoryName": "Embedding",
                "note": "embedding",
            }
            for file in files
        ]

    @classmethod
    def parse_loras(cls, files: list[str]):
        data = []
        for file in files:
            name = os.path.splitext(file)[0]
            data.append(
                {
                    "term": f"lora:{name}",
                    "display": f"lora:{name}",
                    "value": f"<lora:{name}:1>",
                    "category": "lora",
                    "categoryName": "LoRA",
                    "note": "lora",
                }
            )
        return data

    @classmethod
    def parse_wildcards(cls):
        data = []
        wildcards = WildcardLoader.get_wildcards_dict()
        for key, value in wildcards.items():
            wildcard_key = f"__{key}__"
            data.append(
                {
                    "term": wildcard_key,
                    "display": wildcard_key,
                    "value": wildcard_key,
                    "category": "wildcard",
                    "categoryName": "Wildcard",
                    "wildcardValue": ",".join(value),
                    "note": "wildcard",
                }
            )
        return data

    @classmethod
    def insert_data_to_table(cls, table_name, data_list):
        if not data_list:
            return

        target_columns = [column for column, _ in cls.columns]
        cols_str = ", ".join(target_columns)
        placeholders = ", ".join(["?"] * len(target_columns))
        sql = f"INSERT INTO {table_name}_tags ({cols_str}) VALUES ({placeholders})"
        rows = [[entry.get(column, None) for column in target_columns] for entry in data_list]

        cls.conn.executemany(sql, rows)
        cls.conn.commit()

    @classmethod
    def clear_data_by_table(cls, table_name):
        if cls.conn:
            target = table_name if table_name == cls.translate_table_name else f"{table_name}_tags"
            cls.conn.execute(f"DELETE FROM {target}")
            cls.conn.commit()

    @classmethod
    def search(cls, term: str, category_filters: list[str] = None):
        if not cls.enable or cls.conn is None:
            return []

        term = (term or "").strip()
        if not term:
            return []

        cls.restrict_alias = bool(cls.restrict_alias or cls.restrictAlias)
        exact_term_lower = term.lower()

        like_conditions = []
        like_params = []
        is_smart_search = cls.search_method == "smart"
        is_wildcard_term = term.startswith("__")

        if is_smart_search and not is_wildcard_term:
            chunks = [chunk for chunk in re.split(r"[_ ]+", term) if chunk]
            if not chunks:
                return []

            for chunk in chunks:
                esc = cls._escape_like(chunk).replace("*", "%")
                like_conditions.append("term COLLATE NOCASE LIKE ? ESCAPE '\\'")
                like_params.append(f"%{esc}%")
        else:
            escaped_term = cls._escape_like(term)
            pattern = escaped_term.replace("*", "%")
            if not pattern.startswith("%"):
                pattern = f"%{pattern}"
            if not pattern.endswith("%"):
                pattern = f"{pattern}%"

            like_conditions.append("term COLLATE NOCASE LIKE ? ESCAPE '\\'")
            like_params.append(pattern)

        raw_filters = []
        for value in category_filters or []:
            normalized = (value or "").strip().lower()
            if normalized:
                raw_filters.append(normalized)

        category_conditions = []
        category_params = []
        for value in dict.fromkeys(raw_filters):
            category_conditions.append("(LOWER(COALESCE(category, '')) LIKE ? OR LOWER(COALESCE(categoryName, '')) LIKE ?)")
            category_params.extend([f"%{value}%", f"%{value}%"])

        alias_filter_required = cls.restrict_alias and "*" not in term and exact_term_lower
        columns = ", ".join([column for column, _ in cls.columns])
        selects = []
        params = []

        for table in cls.tables:
            where_clauses = ["(" + " AND ".join(like_conditions) + ")"]
            table_params = list(like_params)

            if category_conditions:
                where_clauses.append("(" + " OR ".join(category_conditions) + ")")
                table_params.extend(category_params)

            if alias_filter_required:
                where_clauses.append("(note IS NULL OR LOWER(note) <> 'alias' OR LOWER(term) = ?)")
                table_params.append(exact_term_lower)

            selects.append(f"SELECT {columns} FROM {table}_tags WHERE " + " AND ".join(where_clauses))
            params.extend(table_params)

        limit_clause = ""
        query_params = list(params)
        applied_limit = None
        if isinstance(cls.max_count, int) and cls.max_count > 0:
            limit_clause = "LIMIT ?"
            query_params.append(cls.max_count)
            applied_limit = cls.max_count

        sql_order_by = "LENGTH(term) ASC, postCount DESC" if cls.sort_method == "relevance" else "postCount DESC"
        union_sql = "\nUNION ALL\n".join(selects)
        final_sql = f"""
            SELECT {columns} FROM (
                {union_sql}
            ) AS combined
            ORDER BY
                CASE WHEN LOWER(COALESCE(note, '')) = 'alias' THEN 1 ELSE 0 END,
                {sql_order_by}
            {limit_clause}
        """

        try:
            cursor = cls.conn.execute(final_sql, query_params)
            rows = cursor.fetchall()
        except Exception as error:
            print(f"ExTagComplete: search error: {error}")
            return []

        column_names = [desc[0] for desc in cursor.description] if cursor.description else []
        base_results = [dict(zip(column_names, row)) for row in rows]

        combined_results = cls._include_translation_hits(
            base_results,
            term,
            applied_limit,
            category_conditions,
            category_params,
        )
        combined_results = cls._sort_results(combined_results, original_term=term)
        if applied_limit is not None:
            combined_results = combined_results[:applied_limit]

        cls._merge_translations(combined_results)
        return [cls._format_result(entry) for entry in combined_results]

    @classmethod
    def _include_translation_hits(cls, results, term, limit, category_conditions, category_params):
        base = results.copy()
        translation_terms = cls._get_translation_terms(term)
        existing_terms = {entry.get("term", "").lower() for entry in base if entry.get("term")}
        new_terms = [item for item in translation_terms if item and item.lower() not in existing_terms]

        extra_results = cls._fetch_entries_by_terms(new_terms, category_conditions, category_params)
        combined = cls._dedupe_results(base + extra_results)
        combined = cls._sort_results(combined, original_term=term)
        return combined[:limit] if limit is not None else combined

    @classmethod
    def _get_translation_terms(cls, term: str):
        if not term or not cls.conn:
            return []

        try:
            if cls.search_method == "smart":
                chunks = [chunk for chunk in re.split(r"[_ ]+", term) if chunk]
                if not chunks:
                    return []

                conditions = []
                params = []
                for chunk in chunks:
                    esc = cls._escape_like(chunk).replace("*", "%")
                    conditions.append("translate COLLATE NOCASE LIKE ? ESCAPE '\\'")
                    params.append(f"%{esc}%")

                cursor = cls.conn.execute(
                    f"SELECT term FROM {cls.translate_table_name} WHERE " + " AND ".join(conditions),
                    params,
                )
            else:
                pattern = cls._escape_like(term).replace("*", "%")
                if not pattern.startswith("%"):
                    pattern = f"%{pattern}"
                if not pattern.endswith("%"):
                    pattern = f"{pattern}%"

                cursor = cls.conn.execute(
                    f"SELECT term FROM {cls.translate_table_name} WHERE translate COLLATE NOCASE LIKE ? ESCAPE '\\'",
                    [pattern],
                )

            return [row[0] for row in cursor.fetchall() if row and row[0]]
        except Exception:
            return []

    @classmethod
    def _fetch_entries_by_terms(cls, terms, category_conditions, category_params):
        if not terms:
            return []

        columns = ", ".join([column for column, _ in cls.columns])
        placeholders = ", ".join(["?"] * len(terms))
        selects = []
        params = []

        for table in cls.tables:
            where_clauses = [f"term IN ({placeholders})"]
            table_params = list(terms)

            if category_conditions:
                where_clauses.append("(" + " OR ".join(category_conditions) + ")")
                table_params.extend(category_params)

            selects.append(f"SELECT {columns} FROM {table}_tags WHERE " + " AND ".join(where_clauses))
            params.extend(table_params)

        try:
            cursor = cls.conn.execute("\nUNION ALL\n".join(selects), params)
        except Exception:
            return []

        column_names = [desc[0] for desc in cursor.description] if cursor.description else []
        return [dict(zip(column_names, row)) for row in cursor.fetchall()]

    @classmethod
    def _dedupe_results(cls, results):
        seen = set()
        deduped = []
        column_keys = [column for column, _ in cls.columns]

        for entry in results:
            key = tuple(entry.get(column) for column in column_keys)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(entry)

        return deduped

    @classmethod
    def _sort_results(cls, results, original_term: str = ""):
        lower_term = original_term.lower() if original_term else ""
        is_relevance = cls.sort_method == "relevance"

        def sort_key(entry):
            note = entry.get("note")
            alias_flag = 1 if isinstance(note, str) and note.lower() == "alias" else 0
            post_count = entry.get("postCount")
            post_count_value = post_count if isinstance(post_count, int) else 0

            if is_relevance and lower_term:
                term_value = str(entry.get("term") or "").lower()
                if term_value == lower_term:
                    match_score = 0
                elif term_value.startswith(lower_term):
                    match_score = 1
                elif lower_term in term_value:
                    match_score = 2
                else:
                    match_score = 3

                return (alias_flag, match_score, -post_count_value, len(term_value))

            return (alias_flag, -post_count_value)

        return sorted(results, key=sort_key)

    @classmethod
    def _merge_translations(cls, results):
        if not results or cls.conn is None:
            return

        terms = list(dict.fromkeys([entry.get("term") for entry in results if entry.get("term")]))
        if not terms:
            return

        placeholders = ", ".join(["?"] * len(terms))
        try:
            cursor = cls.conn.execute(
                f"SELECT term, translate FROM {cls.translate_table_name} WHERE term IN ({placeholders})",
                terms,
            )
        except Exception:
            return

        translation_map = {term: translate for term, translate in cursor.fetchall() if translate}
        for entry in results:
            translate = translation_map.get(entry.get("term"))
            if translate:
                entry["translate"] = translate

    @classmethod
    def _format_result(cls, entry):
        display = entry.get("display") or entry.get("term")
        category_name = entry.get("categoryName")
        category = entry.get("category")
        note = entry.get("note")
        post_count = entry.get("postCount")

        return {
            "term": entry.get("term"),
            "text": display,
            "display": display,
            "value": entry.get("value"),
            "category": category,
            "postCount": post_count if post_count is not None else ("Alias" if note == "alias" else None),
            "categoryName": category_name,
            "site": entry.get("site"),
            "translate": entry.get("translate"),
            "wildcardValue": entry.get("wildcardValue"),
            "note": note,
        }

    @classmethod
    def infer_site_from_filename(cls, filename: str):
        normalized = str(filename or "").strip().lower()
        if not normalized:
            return None

        if "gelbooru" in normalized:
            return "gelbooru"
        if "e621" in normalized and "danbooru" not in normalized:
            return "e621"
        if "danbooru" in normalized and "e621" not in normalized:
            return "danbooru"

        return None

    @classmethod
    def _escape_like(cls, value: str):
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    @classmethod
    def close(cls):
        if cls.conn:
            cls.conn.close()
            cls.conn = None

    @classmethod
    def toggle_enable(cls, value):
        cls.set_enable(value)

    @classmethod
    def set_enable(cls, value):
        cls.enable = value

        if value:
            cls.load_main()
            cls.load_extra()
            cls.load_embeddings()
            cls.load_loras()
            cls.load_wildcards()
            cls.load_translate()
        else:
            cls.close()
