import json
import yaml
from aiohttp import web

from server import PromptServer

from . import paths
from . import utils
from .tags_dataframe import TagsDataFrame


NODE_CLASS_MAPPINGS = {}
WEB_DIRECTORY = "./web"


# ===============================================
# エンドポイント
# ===============================================
routes = PromptServer.instance.routes

# debug print
@routes.post(utils._endpoint("debug"))
async def debug(request: web.Request):
    data = await request.json()
    utils.log(data)
    return web.Response()


# tagファイルリストを取得
@routes.get(utils._endpoint("filelist"))
async def get_tagfile_list(request: web.Request):
    # extraファイル以外のcsvファイル名のリストを返す
    files = paths.tags_dir.glob("*.csv")
    filelist = [file.name for file in files if not file.stem.startswith("extra")]
    body = json.dumps(sorted(filelist))
    
    return web.Response(body=body)


# extraファイルリストを取得
@routes.get(utils._endpoint("extra_filelist"))
async def get_extrafile_list(request: web.Request):
    # extra-で始まるcsvファイル名のリストを返す
    files = paths.tags_dir.glob("*.csv")
    filelist = [file.name for file in files if file.stem.startswith("extra")]
    body = json.dumps(sorted(filelist))

    return web.Response(body=body)


# CSVファイルからデータフレームを作成
@routes.post(utils._endpoint("dataframe"))
async def dataframe_create(request: web.Request):
    data = await request.json()
    tagsfile = data.get("tagsfile")
    extrafile = data.get("extrafile")
    
    if tagsfile:
        tagsfile_path = paths.tags_dir / tagsfile
        df, alias_df = TagsDataFrame.load_csv(tagsfile_path)
        TagsDataFrame.tags_df = df
        TagsDataFrame.tags_alias_df = alias_df
    
    if extrafile:
        extrafile_path = paths.tags_dir / extrafile
        df, alias_df = TagsDataFrame.load_csv(extrafile_path)
        TagsDataFrame.extra_df = df
        TagsDataFrame.extra_alias_df = alias_df
    
    return web.Response()

# Embeddingsデータフレームのトグル
@routes.post(utils._endpoint("embeddings"))
async def embeddings(request: web.Request):
    data = await request.json()
    enabled = data.get("enabled")
    
    if enabled:
        TagsDataFrame.embeddings_df = TagsDataFrame.load_embeddings()
    else:
        TagsDataFrame.embeddings_df = None
    
    return web.Response()

# LoRAsデータフレームのトグル
@routes.post(utils._endpoint("loras"))
async def loras(request: web.Request):
    data = await request.json()
    enabled = data.get("enabled")

    if enabled:
        TagsDataFrame.loras_df = TagsDataFrame.load_loras()
    else:
        TagsDataFrame.loras_df = None
    
    return web.Response()

# restrict alias のトグル
@routes.post(utils._endpoint("restrictAlias"))
async def restrict_alias(request: web.Request):
    data = await request.json()
    enabled = data.get("enabled")
    TagsDataFrame.restrictAlias = enabled

    return web.Response()
    

# 語句をデータフレームで検索
@routes.post(utils._endpoint("search"))
async def dataframe_search(request: web.Request):
    data = await request.json()
    term = data.get("term")
    category = data.get("category")
    res = TagsDataFrame.search(term, category)
    
    body = json.dumps(res)
    return web.Response(body=body)


# colors.jsonを読み込む
@routes.get(utils._endpoint("colors"))
async def load_colors(request: web.Request):
    filepath = paths.root_dir / "colors.yaml"
    try:
        with open(filepath, mode="r", encoding="utf-8") as file:
            colors = yaml.safe_load(file)
    except Exception as e:
        # デフォルト設定
        colors = {
            "0": "rgba(30, 144, 255, 0.7)",   #  danbooru General
            "1": "rgba(139, 0, 0, 0.7)",      #  danbooru Artist
            "3": "rgba(104, 65, 153, 0.7)",   #  danbooru Copyright
            "4": "rgba(0, 100, 0, 0.7)",      #  danbooru Character
            "5": "rgba(204, 85, 0, 0.7)",     #  danbooru Meta
            "7": "rgba(30, 144, 255, 0.7)",   #  e621 General
            "8": "rgba(184, 134, 11, 0.7)",   #  e621 Artist
            "9": "rgba(184, 134, 11, 0.7)",   #  e621 Contributor
            "10": "rgba(104, 65, 153, 0.7)",  #  e621 Copyright
            "11": "rgba(0, 100, 0, 0.7)",     #  e621 Character
            "12": "rgba(233, 150, 122, 0.7)", #  e621 Species
            "14": "rgba(40, 40, 40, 0.7)",    #  e621 Meta
            "15": "rgba(93, 139, 116, 0.7)",  #  e621 Lore
        }
    
    body = json.dumps(colors)
    return web.Response(body=body)

