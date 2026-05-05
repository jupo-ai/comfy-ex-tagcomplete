from aiohttp import web

from .utils import Endpoint
from . import paths
from .data_manager import TagDataManager


@Endpoint.get("get_main_files")
async def get_main_files(req: web.Request):
    files = paths.tags_dir.glob("*.csv")
    return web.json_response([file.name for file in files if not file.stem.startswith("extra")])


@Endpoint.get("get_extra_files")
async def get_extra_files(req: web.Request):
    files = paths.tags_dir.glob("*.csv")
    return web.json_response([file.name for file in files if file.stem.startswith("extra")])


@Endpoint.get("get_translate_files")
async def get_translate_files(req: web.Request):
    files = paths.translate_dir.glob("*.csv")
    return web.json_response(["None"] + [file.name for file in files])


@Endpoint.post("toggle_enable")
async def toggle_enable(req: web.Request):
    data = await req.json()
    TagDataManager.set_enable(data.get("value"))
    return web.json_response({"status": "success"})


@Endpoint.post("load_main")
async def load_main(req: web.Request):
    data = await req.json()
    TagDataManager.main_filename = data.get("filename")
    TagDataManager.load_main()
    return web.json_response({"status": "success"})


@Endpoint.post("load_extra")
async def load_extra(req: web.Request):
    data = await req.json()
    TagDataManager.extra_filename = data.get("filename")
    TagDataManager.load_extra()
    return web.json_response({"status": "success"})


@Endpoint.post("load_translate")
async def load_translate(req: web.Request):
    data = await req.json()
    TagDataManager.translate_filename = data.get("filename")
    TagDataManager.load_translate()
    return web.json_response({"status": "success"})


@Endpoint.post("load_embeddings")
async def load_embeddings(req: web.Request):
    data = await req.json()
    TagDataManager.enable_embeddings = data.get("value")
    TagDataManager.load_embeddings()
    return web.json_response({"status": "success"})


@Endpoint.post("load_loras")
async def load_loras(req: web.Request):
    data = await req.json()
    TagDataManager.enable_loras = data.get("value")
    TagDataManager.load_loras()
    return web.json_response({"status": "success"})


@Endpoint.post("load_wildcards")
async def load_wildcards(req: web.Request):
    data = await req.json()
    TagDataManager.enable_wildcards = data.get("value")
    TagDataManager.load_wildcards()
    return web.json_response({"status": "success"})


@Endpoint.post("set_suggestion_count")
async def set_suggestion_count(req: web.Request):
    data = await req.json()
    TagDataManager.max_count = data.get("value")
    return web.json_response({"status": "success"})


@Endpoint.post("set_restrict_alias")
async def set_restrict_alias(req: web.Request):
    data = await req.json()
    value = data.get("value")
    TagDataManager.restrict_alias = value
    TagDataManager.restrictAlias = value
    return web.json_response({"status": "success"})


@Endpoint.post("set_search_method")
async def set_search_method(req: web.Request):
    data = await req.json()
    value = data.get("value")
    if isinstance(value, str) and value.strip().lower() in {"legacy", "smart"}:
        TagDataManager.search_method = value.strip().lower()
        return web.json_response({"status": "success"})

    return web.json_response({"status": "error", "message": "invalid search method"}, status=400)


@Endpoint.post("set_sort_method")
async def set_sort_method(req: web.Request):
    data = await req.json()
    value = data.get("value")
    if isinstance(value, str) and value.strip().lower() in {"legacy", "relevance"}:
        TagDataManager.sort_method = value.strip().lower()
        return web.json_response({"status": "success"})

    return web.json_response({"status": "error", "message": "invalid sort method"}, status=400)


@Endpoint.post("search")
async def search(req: web.Request):
    data = await req.json()
    results = TagDataManager.search(data.get("term"), data.get("filters"))
    return web.json_response(results)
