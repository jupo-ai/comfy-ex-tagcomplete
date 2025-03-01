
def log(message: str):
    print(f"[tag complete] {message}")


author = "tsukihara"
packageName = "ExTagComplete"

def _name(name):
    return f"{author}.{packageName}.{name}"


def _endpoint(part):
    return f"/{author}/{packageName}/{part}"
