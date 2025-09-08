import folder_paths
from pathlib import Path
import configparser
import os
import yaml
from . import paths

# -----------------------------------------------
# 以下のフォルダからワイルドカードを取得する
#   1. comfy-simple-wildcards/wildcard
#   2. extra_model_pathsでwildcardsに設定されたディレクトリ
#   3. ComfyUI-Impact-Pack/wildcards
#   4. ComfyUI-Impact-Pack/impact-pack.iniで設定されたディレクトリ
# -----------------------------------------------

def get_wildcard_dirs():
    dirs = []
    
    # 1. comfy-simple-wildcards/wildcard
    path = str(paths.custom_nodes_dir / "comfy-simple-wildcards" / "wildcards")
    dirs.append(path)

    # 2. extra_model_paths
    try:
        path = folder_paths.get_folder_paths("wildcards")
        dirs.append(path)
    except:
        pass
    
    # 3. ComfyUI-Impact-Pack/wildcards
    path = str(paths.custom_nodes_dir / "ComfyUI-Impact-Pack" / "wildcards")
    dirs.append(path)

    # 4. ComfyUI-Imapct-Pack/impact-pack.ini
    ini_file = paths.custom_nodes_dir / "ComfyUI-Impact-Pack" / "impact-pack.ini"
    try:
        config = configparser.ConfigParser()
        config.read(ini_file, encoding="utf-8")
        if "default" in config and "custom_wildcards" in config["default"]:
            path = config["default"]["custom_wildcards"]
            dirs.append(path)
    except:
        pass

    # 存在するパスのみ
    dirs = [str(path) for path in dirs if Path(path).exists()]

    return dirs



class WildcardLoader:
    wildcards = {}
    dirs = get_wildcard_dirs()

    @classmethod
    def get_wildcards_list(cls):
        return [f"__{x}__" for x in cls.wildcards.keys()]
    
    @classmethod
    def get_wildcards_dict(cls):
        return cls.wildcards
    
    @classmethod
    def __path_normalize(cls, x: str):
        return x.replace("\\", "/").replace(" ", "-").lower()
    
    @classmethod
    def __key_normalize(cls, key: str):
        if not key.startswith("__"):
            key = f"__{key}"
        
        if not key.endswith("__"):
            key = f"{key}__"
        
        return key
        
    
    
    @classmethod
    def __read_wildcard_dict(cls, dirpath):
        for root, dirs, files, in os.walk(dirpath, followlinks=True):
            for file in files:
                if file.endswith(".txt"):
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, dirpath)
                    key = cls.__path_normalize(os.path.splitext(rel_path)[0])
                    key = cls.__key_normalize(key)

                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            lines = f.read().splitlines()
                    except UnicodeDecodeError:
                        with open(file_path, "r", encoding="ISO-8859-1") as f:
                            lines = f.read().splitlines()
                    
                    if not key in cls.wildcards:
                        cls.wildcards[key] = [x for x in lines if not x.strip().startswith("#")]
                
                elif file.endswith(".yaml") or file.endswith(".yml"):
                    file_path = os.path.join(root, file)

                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            yaml_data = yaml.load(f, Loader=yaml.FullLoader)
                    except yaml.reader.ReaderError:
                        with open(file_path, "r", encoding="ISO-8859-1", errors="ignore") as f:
                            yaml_data = yaml.load(f, Loader=yaml.FullLoader)
                    
                    for k, v in yaml_data.items():
                        if not k in cls.wildcards:
                            key = cls.__key_normalize(k)
                            if isinstance(v, list):
                                cls.wildcards[key] = [str(x) for x in v]
                            else:
                                cls.wildcards[key] = [str(v)]
    
    
    @classmethod
    def load(cls):
        cls.unload()

        for path in cls.dirs:
            try:
                cls.__read_wildcard_dict(path)
            except Exception as e:
                print(f"Failed to load wildcards: {e}")
    
    
    @classmethod
    def unload(cls):
        cls.wildcards = {}
    
    
    