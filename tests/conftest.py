import os
import tempfile

import pytest

# 테스트가 선생님 PC의 실제 설정(AppData)을 건드리지 않도록 격리
_DATA = tempfile.mkdtemp(prefix="pumui-test-")
os.environ["PUMUI_DATA_DIR"] = _DATA
for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE", "PUMUI_CERT_PASSWORD"):
    os.environ.pop(k, None)


@pytest.fixture(autouse=True)
def clean_config():
    from pumui import paths

    for f in (paths.config_file(), paths.history_file()):
        if f.exists():
            f.unlink()
    yield
