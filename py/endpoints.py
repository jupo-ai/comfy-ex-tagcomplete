from .utils import Endpoint
from .tagdata_manager import TagDataManager
from . import paths

from aiohttp import web
import folder_paths

# ===============================================
# エンドポイント
# ===============================================

# --- main タグファイルリストを取得 ---
@Endpoint.get("get_main_files")
async def get_main_files(req: web.Request):
    files = paths.tags_dir.glob("*.csv")
    filelist = [file.name for file in files if not file.stem.startswith("extra")]

    return web.json_response(filelist)

# --- extra タグファイルリストを取得 ---
@Endpoint.get("get_extra_files")
async def get_extra_files(req: web.Request):
    files = paths.tags_dir.glob("*.csv")
    filelist = [file.name for file in files if file.stem.startswith("extra")]

    return web.json_response(filelist)

# --- translate ファイルリストを取得 ---
@Endpoint.get("get_translate_files")
async def get_translate_files(req: web.Request):
    files = paths.translate_dir.glob("*.csv")
    filelist = [file.name for file in files]
    filelist = ["None"] + filelist
    
    return web.json_response(filelist)


# --- CSV ファイル読込 ---
@Endpoint.post("load_csv")
async def load_csv(req: web.Request):
    data = await req.json()
    filename = data.get("filename")
    filetype = data.get("filetype")

    TagDataManager.load_csv(filename, filetype)

    return web.json_response({"status": "success"})


# --- Translate ファイル読込 ---
@Endpoint.post("load_translate")
async def load_translate(req: web.Request):
    data = await req.json()
    filename = data.get("filename")
    reset = data.get("reset")

    TagDataManager.load_translate(filename, reset)

    return web.json_response({"status": "success"})


# --- Embeddings読込 ---
@Endpoint.post("load_embeddings")
async def load_embeddings(req: web.Request):
    data = await req.json()
    enabled = data.get("enabled")
    
    files = []
    if enabled:
        files = folder_paths.get_filename_list("embeddings")
    
    TagDataManager.load_embeddings(files)

    return web.json_response({"status": "success"})


# --- LoRA読込 ---
@Endpoint.post("load_loras")
async def load_loras(req: web.Request):
    data = await req.json()
    enabled = data.get("enabled")

    files = []
    if enabled:
        files = folder_paths.get_filename_list("loras")
    
    TagDataManager.load_loras(files)

    return web.json_response({"status": "sccuess"})


# --- Suggestion Count設定 --- 
@Endpoint.post("set_suggestion_count")
async def set_suggestion_count(req: web.Request):
    data = await req.json()
    count = data.get("suggestionCount")
    
    TagDataManager.max_count = count
    
    return web.json_response({"status": "success"})


# --- Restict Alias設定 ---
@Endpoint.post("set_restrict_alias")
async def set_restrict_alias(req: web.Request):
    data = await req.json()
    enabled = data.get("enabled")

    TagDataManager.restrictAlias = enabled
    
    return web.json_response({"status": "success"})


# --- 検索実行 ---
@Endpoint.post("search")
async def search(req: web.Request):
    data = await req.json()
    term = data.get("term")
    filters = data.get("filters")

    results = TagDataManager.search(term, filters)

    return web.json_response(results)