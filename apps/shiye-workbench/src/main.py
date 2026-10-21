import ctypes
import hashlib
from logging.handlers import RotatingFileHandler
import logging
import os
from pathlib import Path
import sys
import threading
import json
import time
import traceback
import socket

from store import VERSION


def resource_home():
    return Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))


def application_home():
    if '--data-home' in sys.argv:
        return Path(sys.argv[sys.argv.index('--data-home') + 1]).resolve()
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent / 'development'


def single_instance(home):
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateMutexW.argtypes = [ctypes.c_void_p, ctypes.c_bool, ctypes.c_wchar_p]
    kernel.CreateMutexW.restype = ctypes.c_void_p
    name = hashlib.sha256(str(home).casefold().encode()).hexdigest()[:20]
    handle = kernel.CreateMutexW(None, False, 'Local\\ShiyePro_' + name)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    if ctypes.get_last_error() == 183:
        raise RuntimeError('拾页工作台已在运行，请切换到已有窗口。')
    return handle


def frontend_port():
    # pywebview otherwise reuses 42001 when private_mode=False. A second
    # version/workspace could silently render the first process's UI assets.
    with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as probe:
        probe.bind(('127.0.0.1',0))
        return probe.getsockname()[1]


def main():
    if '--adapter-test' in sys.argv:
        from adapter_test import run
        return run(Path(sys.argv[sys.argv.index('--adapter-test') + 1]))
    if '--self-test' in sys.argv:
        from selftest import run_tests
        return run_tests(Path(sys.argv[sys.argv.index('--self-test') + 1]))
    home = application_home()
    try:
        os.environ['PYWEBVIEW_GUI'] = 'edgechromium'
        home.mkdir(parents=True, exist_ok=True)
        logs = home / 'data' / 'logs'
        logs.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(logs / 'app.log', maxBytes=2_000_000, backupCount=3, encoding='utf-8')
        handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(name)s %(message)s'))
        logging.basicConfig(level=logging.INFO, handlers=[handler])
        handle = single_instance(home)
        from daylight_api import DaylightApi
        import webview
        api = DaylightApi(home, demo='--demo' in sys.argv)
        window = webview.create_window(f'拾页 · Daylight 工作台 Pro {VERSION}',
            str(resource_home() / 'ui' / 'index.html'), js_api=api,
            width=1440, height=940, min_size=(1080, 720), background_color='#f4f6f9', text_select=True)
        api._window = window
        closing = {'started': False, 'allow': False}
        def on_closing():
            if closing['allow']:
                return True
            if closing['started']:
                return False
            closing['started'] = True
            def finish():
                # Closing runs synchronously on the WinForms UI thread. JS calls
                # must happen after it returns, otherwise WebView2 can deadlock.
                time.sleep(.05)
                try:
                    window.evaluate_js("window.App && window.App.onClosing()")
                except Exception:
                    pass
                api._engine.shutdown()
                closing['allow'] = True
                window.destroy()
            threading.Thread(target=finish, daemon=True).start()
            return False
        window.events.closing += on_closing
        native_report = None
        def native_smoke():
            nonlocal native_report
            native_report = {'passed': False, 'checks': []}
            try:
                if not window.events.loaded.wait(20):
                    raise RuntimeError('Native webview did not load')
                deadline = time.monotonic() + 20
                while not window.evaluate_js('Boolean(window.App?.state.snap)'):
                    if time.monotonic() > deadline:
                        raise RuntimeError('Native desktop bridge did not connect')
                    time.sleep(.1)
                from native_checks import run
                run(window, api, '--demo' in sys.argv, native_report)
                native_report['passed'] = True
            except Exception:
                native_report['error'] = traceback.format_exc()
            finally:
                window.destroy()
        logging.info('Starting Shiye Pro %s, home=%s', VERSION, home)
        webview.start(func=native_smoke if '--ui-smoke' in sys.argv else None,
                      gui='edgechromium', http_port=frontend_port(), debug='--debug' in sys.argv, icon=str(resource_home() / 'ui' / 'app.ico'),
                      private_mode=False, storage_path=str(home / 'data' / 'webview'))
        if native_report is not None:
            native_report['checks'].append('Actual window close event returns without blocking and worker exits')
            native_report['passed'] = native_report['passed'] and not api._engine.worker.is_alive()
            (home / 'native-report.json').write_text(json.dumps(native_report, ensure_ascii=False, indent=2), encoding='utf-8')
        kernel = ctypes.windll.kernel32
        kernel.CloseHandle.argtypes = [ctypes.c_void_p]
        kernel.CloseHandle(handle)
        return 0 if native_report is None or native_report['passed'] else 1
    except Exception as exc:
        logging.exception('Startup failed')
        ctypes.windll.user32.MessageBoxW(None, f'拾页工作台启动失败：\n{exc}\n\n请确认本机已安装 Microsoft Edge WebView2 Runtime。\n详细日志位于程序目录的 data\\logs。', '拾页工作台', 0x10)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
