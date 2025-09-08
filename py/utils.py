from functools import wraps
from server import PromptServer
from typing import Union, Literal
from comfy.comfy_types import IO
import sys

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



# ===============================================
# ノード入力用
# ===============================================
class Field:
    @staticmethod
    def _field(field: str|list[str], data: dict={}):
        return (field, data)


    @staticmethod
    def string(
        default: str="", 
        multiline: bool=False, 
        dynamicPrompt: bool=False, 
        **kwargs
    ):
        data = {
            "default": default, 
            "multiline": multiline, 
            "dynamicPrompt": dynamicPrompt, 
        }
        data.update(kwargs)
        return Field._field(IO.STRING, data)
    
    
    @staticmethod
    def image(
        upload: bool=False, 
        folder: Literal["input", "output", "temp"]="input", 
        **kwargs
    ):
        data = {
            "image_upload": upload, 
            "image_folder": folder, 
        }
        data.update(kwargs)
        return Field._field(IO.IMAGE, data)
    
    
    @staticmethod
    def mask(**kwargs):
        return Field._field(IO.MASK, kwargs)
    
    
    @staticmethod
    def latent(**kwargs):
        return Field._field(IO.LATENT, kwargs)
    
    
    @staticmethod
    def boolean(
        default: bool=False, 
        label_on: str="true", 
        label_off: str="false", 
        **kwargs
    ):
        data = {
            "default": default, 
            "label_on": label_on, 
            "label_off": label_off, 
        }
        data.update(kwargs)
        return Field._field(IO.BOOLEAN, data)
    
    
    @staticmethod
    def number(
        default: Union[float, int]=0.0, 
        min: Union[float, int]=-sys.float_info.max, 
        max: Union[float, int]=sys.float_info.max, 
        step: Union[float, int]=0.01, 
        **kwargs
    ):
        data = {
            "default": default, 
            "min": min, 
            "max": max, 
            "step": step, 
        }
        data.update(kwargs)
        return Field._field(IO.NUMBER, data)
    
    
    @staticmethod
    def float(
        default: float=0.0, 
        min: float=-sys.float_info.max, 
        max: float=sys.float_info.max, 
        step: float=0.01, 
        **kwargs
    ):
        data = {
            "default": default, 
            "min": min, 
            "max": max, 
            "step": step, 
        }
        data.update(kwargs)
        return Field._field(IO.FLOAT, data)
    
    
    @staticmethod
    def int(
        default: int=0, 
        min: int=-sys.maxsize, 
        max: int=sys.maxsize, 
        step: int=1, 
        **kwargs
    ):
        data = {
            "default": default, 
            "min": min, 
            "max": max, 
            "step": step, 
        }
        data.update(kwargs)
        return Field._field(IO.INT, data)
    
    
    @staticmethod
    def conditioning(**kwargs):
        return Field._field(IO.CONDITIONING, kwargs)
    
    
    @staticmethod
    def sampler(**kwargs): 
        return Field._field(IO.SAMPLER, kwargs)
    
    
    @staticmethod
    def sigmas(**kwargs):
        return Field._field(IO.SIGMAS, kwargs)
    
    
    @staticmethod
    def guider(**kwargs):
        return Field._field(IO.GUIDER, kwargs)
    
    
    @staticmethod
    def noise(**kwargs):
        return Field._field(IO.NOISE, kwargs)
    
    
    @staticmethod
    def clip(**kwargs):
        return Field._field(IO.CLIP, kwargs)
    
    
    @staticmethod
    def controlnet(**kwargs):
        return Field._field(IO.CONTROL_NET, kwargs)
    
    
    @staticmethod
    def vae(**kwargs):
        return Field._field(IO.VAE, kwargs)

    
    @staticmethod
    def model(**kwargs):
        return Field._field(IO.MODEL, kwargs)
    
    
    @staticmethod
    def clip_vision(**kwargs):
        return Field._field(IO.CLIP_VISION, kwargs)
    
    
    @staticmethod
    def style_model(**kwargs):
        return Field._field(IO.STYLE_MODEL, kwargs)
    
    
    @staticmethod
    def gligen(**kwargs):
        return Field._field(IO.GLIGEN, kwargs)
    
    
    @staticmethod
    def upscale_model(**kwargs):
        return Field._field(IO.UPSCALE_MODEL, kwargs)
    
    @staticmethod
    def audio(**kwargs):
        return Field._field(IO.AUDIO, kwargs)
    
    
    @staticmethod
    def webcam(**kwargs):
        return Field._field(IO.WEBCAM, kwargs)
    
    
    @staticmethod
    def point(**kwargs):
        return Field._field(IO.POINT, kwargs)
    
    
    @staticmethod
    def face_analysis(**kwargs):
        return Field._field(IO.FACE_ANALYSIS, kwargs)
    
    
    @staticmethod
    def bbox(**kwargs):
        return Field._field(IO.BBOX, kwargs)
    
    
    @staticmethod
    def segs(**kwargs):
        return Field._field(IO.SEGS, kwargs)
    
    
    @staticmethod
    def any(**kwargs):
        return Field._field(IO.ANY, kwargs)
    
    
    @staticmethod
    def combo(
        choices: list[str], 
        default: str=None, 
        **kwargs
    ):
        if default is None: 
            default = choices[0] if len(choices) > 0 else None
        
        data = {"default": default}
        data.update(kwargs)
        return Field._field(choices, data)

