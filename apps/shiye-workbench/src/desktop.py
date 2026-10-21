import functools
import json
import logging
import os
from pathlib import Path
import threading
import webbrowser
from urllib.parse import urlsplit

from engine import Engine, browser_paths
from store import Store, VERSION, seed_demo, safe_name
from rules import normalize_rules, split_terms, REASONS
from datetime import datetime


def exposed(function):
    @functools.wraps(function)
    def invoke(self, *args, **kwargs):
        try:
            return {'ok': True, 'data': function(self, *args, **kwargs)}
        except ValueError as exc:
            logging.info('Validation %s: %s', function.__name__, exc)
            return {'ok': False, 'error': str(exc)[:800]}
        except Exception as exc:
            logging.exception('API %s failed', function.__name__)
            return {'ok': False, 'error': str(exc)[:800]}
    return invoke


class DesktopApi:
    def __init__(self, home, demo=False):
        self._home = Path(home)
        self._real = Store(self._home / 'data' / 'workspace.sqlite3', self._home / '采集结果')
        self._engine = Engine(self._real, self._home)
        self._demo = demo
        self._demo_store = None
        self._window = None
        self._exported = set()
        self._guard = threading.RLock()
        if demo:
            self._get_store()

    def _get_store(self):
        if not self._demo:
            return self._real
        if self._demo_store is None:
            self._demo_store = Store(self._home / 'data' / 'demo.sqlite3', self._home / '演示导出')
            seed_demo(self._demo_store)
        return self._demo_store

    @exposed
    def snapshot(self):
        with self._guard:
            store = self._get_store()
            return {'version': VERSION, 'demo': self._demo, 'settings': store.settings(),
                    'tasks': store.tasks(), 'stats': store.stats(), 'events': store.recent_events(),
                    'engine': self._engine.status(), 'browsers': list(browser_paths()),
                    'home': str(self._home), 'database': str(store.path),
                    'libraries':[{key:value for key,value in library.items() if key not in ('search_terms','include_words','exclude_words')} |
                        {'search_count':len(library['search_terms']),'include_count':len(library['include_words']),'exclude_count':len(library['exclude_words']),
                         'preview':library['search_terms'][:5]} for library in store.libraries()],
                    'reason_labels':REASONS}

    @exposed
    def notes(self, filters=None):
        return self._get_store().notes(filters)

    @exposed
    def note(self, identity):
        return self._get_store().note(identity)

    @exposed
    def task_events(self, identity):
        return self._get_store().recent_events(identity)

    @exposed
    def preview_criteria(self, criteria):
        return normalize_rules(criteria)

    @exposed
    def create_tasks(self, payload):
        with self._guard:
            if self._demo:
                raise ValueError('演示工作区不执行真实采集。请先返回工作区。')
            library=self._real.library(payload['library_id']) if payload.get('library_id') else {}
            keywords = payload.get('keywords', library.get('search_terms',[]))
            if not isinstance(keywords, list) or not 1 <= len(keywords) <= 30:
                raise ValueError('每次可创建 1–30 个关键词任务。')
            keywords = split_terms(keywords,30,80)
            if not keywords or any(len(k) > 80 for k in keywords):
                raise ValueError('请填写关键词，每个关键词不超过 80 个字符。')
            raw_target = payload.get('target', 0)
            target = int(raw_target)
            if isinstance(raw_target, bool) or float(raw_target) != target:
                raise ValueError('目标数量必须为整数。')
            mode = payload.get('mode', 'fast')
            if not 1 <= target <= 1000 or mode not in ('fast', 'deep'):
                raise ValueError('每个任务的目标数量为 1–1000 条，请选择有效模式。')
            criteria=payload.get('criteria') or {}
            if not isinstance(criteria,dict):
                raise ValueError('筛选条件格式无效。')
            criteria=dict(criteria)
            for field in ('include_words','exclude_words','include_mode'):
                if field not in criteria and library:
                    criteria[field]=library[field]
            criteria=normalize_rules(criteria)
            if len([t for t in self._real.tasks() if t['status'] == 'queued']) + len(keywords) > 100:
                raise ValueError('待执行任务过多，请等待部分任务完成。')
            identities = []
            for keyword in keywords:
                identity = self._real.create_task(keyword, target, mode,criteria,library)
                identities.append(identity)
                self._engine.submit(identity)
            return identities

    @exposed
    def task_action(self, identity, action):
        if self._demo:
            raise ValueError('演示任务仅供浏览。请返回真实工作区创建任务。')
        self._engine.action(identity, action)

    @exposed
    def word_library(self, identity):
        return self._get_store().library(identity)

    @exposed
    def save_word_library(self, payload):
        library=self._get_store().save_library(payload)
        self._get_store().event(None,'info',f'词汇库已保存：{library["name"]}')
        return library

    @exposed
    def delete_word_library(self, identity):
        self._get_store().delete_library(identity)

    @staticmethod
    def _read_library_file(path):
        path=Path(path)
        if path.stat().st_size>2_000_000:
            raise ValueError('词库文件不能超过 2 MB。')
        try:
            text=path.read_text(encoding='utf-8-sig')
        except UnicodeDecodeError:
            text=path.read_text(encoding='gb18030')
        if path.suffix.lower()=='.json':
            values=json.loads(text)
            if not isinstance(values,dict):
                raise ValueError('JSON 词库需要是一个对象。')
        else:
            values={'name':path.stem,'search_terms':[],'include_words':[],'exclude_words':[]}
            current='search_terms'
            sections={'[搜索词]':'search_terms','[包含词]':'include_words','[排除词]':'exclude_words'}
            for line in text.splitlines():
                if line.strip() in sections:
                    current=sections[line.strip()]
                elif line.strip() and not line.lstrip().startswith('#'):
                    values[current].extend(split_terms(line))
        result={key:split_terms(values.get(key),30 if key=='search_terms' else 300,80 if key=='search_terms' else 100)
                for key in ('search_terms','include_words','exclude_words')}
        if not any(result.values()):
            raise ValueError('文件中没有可用词汇。')
        mode=values.get('include_mode','any')
        if mode not in ('any','all'):
            raise ValueError('词库包含词匹配方式无效。')
        return {'name':str(values.get('name') or path.stem)[:40], 'description':str(values.get('description') or '')[:300],
                'include_mode':mode,**result}

    @exposed
    def import_word_library(self):
        import webview
        selected=self._window.create_file_dialog(webview.FileDialog.OPEN,allow_multiple=False,
                    file_types=('词汇库 (*.json;*.txt)','所有文件 (*.*)'))
        return self._read_library_file(selected[0]) if selected else None

    @exposed
    def export_word_library(self, identity):
        library=self._get_store().library(identity)
        folder=Path(self._get_store().settings()['export_dir'])/'词汇库'
        folder.mkdir(parents=True,exist_ok=True)
        path=folder/(safe_name(library['name'])+f'_{datetime.now():%Y%m%d_%H%M%S_%f}.json')
        values={key:library[key] for key in ('name','description','search_terms','include_words','exclude_words','include_mode')}
        values.update(format='shiye-word-library',version=1)
        path.write_text(json.dumps(values,ensure_ascii=False,indent=2),encoding='utf-8')
        self._exported.add(str(path))
        return str(path)

    @exposed
    def login(self):
        if self._demo:
            raise ValueError('请先返回真实工作区，再打开登录浏览器。')
        self._engine.login()

    @exposed
    def toggle_demo(self):
        with self._guard:
            if self._engine.status()['active'] or self._engine.login_busy or any(t['status'] == 'queued' for t in self._real.tasks()):
                raise ValueError('请先结束当前任务，再切换工作区。')
            self._demo = not self._demo
            self._get_store()
            return self._demo

    @exposed
    def save_settings(self, values):
        workspace = str(values.get('workspace', '')).strip()
        if not workspace or len(workspace) > 30:
            raise ValueError('工作区名称需要 1–30 个字符。')
        browser = values.get('browser', 'auto')
        interval = float(values.get('interval', 4))
        detail_interval = float(values.get('detail_interval', 2.5))
        fmt = values.get('export_format', 'xlsx')
        folder = Path(str(values.get('export_dir', '')))
        if browser not in ('auto', 'chrome', 'edge') or fmt not in ('csv', 'xlsx', 'json'):
            raise ValueError('无效的浏览器或导出格式。')
        if not 3 <= interval <= 30 or not 2 <= detail_interval <= 30:
            raise ValueError('翻页间隔为 3–30 秒，详情间隔为 2–30 秒。')
        if not folder.is_absolute():
            raise ValueError('请选择完整的保存路径。')
        folder.mkdir(parents=True, exist_ok=True)
        import tempfile
        with tempfile.TemporaryFile(dir=folder):
            pass
        result = {'workspace': workspace, 'browser': browser, 'interval': interval, 'detail_interval': detail_interval,
                  'export_format': fmt, 'export_dir': str(folder), 'auto_export': bool(values.get('auto_export', True))}
        self._get_store().save_settings(result)
        return result

    @exposed
    def choose_folder(self):
        import webview
        selected = self._window.create_file_dialog(webview.FileDialog.FOLDER)
        return selected[0] if selected else None

    @exposed
    def export_notes(self, payload):
        store = self._get_store()
        exported = store.export(store.settings()['export_dir'], payload.get('format', 'xlsx'), payload.get('filters'),
                                prefix='拾页_演示数据' if self._demo else '拾页_笔记数据')
        self._exported.add(exported['path'])
        store.event(None, 'info', f'导出完成：{exported["count"]} 条，{exported["path"]}')
        return exported

    @exposed
    def open_export(self, path):
        if path not in self._exported:
            raise ValueError('请先在当前工作区完成导出。')
        os.startfile(path)

    @exposed
    def open_folder(self, kind='exports'):
        if kind == 'exports':
            folder = Path(self._get_store().settings()['export_dir'])
        elif kind == 'backup':
            folder = self._home / '备份'
        elif kind == 'logs':
            folder = self._home / 'data' / 'logs'
        else:
            raise ValueError('无效目录')
        folder.mkdir(parents=True, exist_ok=True)
        os.startfile(str(folder))

    @exposed
    def open_note(self, identity):
        row = self._get_store().note(identity)
        parsed = urlsplit(row['link'])
        if parsed.scheme not in ('https', 'http') or parsed.hostname not in ('xiaohongshu.com', 'www.xiaohongshu.com'):
            raise ValueError('这条记录没有可打开的真实笔记链接。')
        webbrowser.open(row['link'])

    @exposed
    def backup(self):
        path = self._get_store().backup(self._home / '备份')
        self._get_store().event(None, 'info', f'工作区备份完成：{path}')
        return path
