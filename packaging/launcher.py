"""설치용 실행 파일(EdufineAutoPumui.exe)의 시작점."""

import multiprocessing
import sys

from pumui.server import main

if __name__ == "__main__":
    multiprocessing.freeze_support()
    if "--cli" in sys.argv:
        from pumui.cli import main as cli_main

        sys.argv.remove("--cli")
        sys.exit(cli_main())
    main()
