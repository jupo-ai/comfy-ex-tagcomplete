from functools import wraps
from server import PromptServer

author = "jupo"
packageName = "ExTagComplete"


# ===============================================
# ユーティリティ
# ===============================================
def mk_name(name: str):
    return f"{author}.{packageName}.{name}"

def un_name(name: str):
    return name.replace(f"{author}.", "").replace(f"{packageName}.", "").replace("_", " ")

def set_default_category(node_class_mappings: dict):
    for cls in node_class_mappings.values():
        if not hasattr(cls, "CATEGORY"):
            setattr(cls, "CATEGORY", f"{author}/{packageName}")
        


# ===============================================
# エンドポイント用
# ===============================================
class Endpoint:
    routes = PromptServer.instance.routes
    
    @classmethod
    def _endpoint(cls, part: str):
        return f"/{author}/{packageName}/{part}"
    
    @classmethod
    def get(cls, path: str):
        """GETリクエスト用のデコレータ"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                return func(*args, **kwargs)
            
            cls.routes.get(cls._endpoint(path))(wrapper)
            return wrapper
        return decorator
    
    @classmethod
    def post(cls, path: str):
        """POSTリクエスト用のデコレータ"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                return func(*args, **kwargs)
            
            cls.routes.post(cls._endpoint(path))(wrapper)
            return wrapper
        return decorator

