import logging
import os
from pathlib import Path
import queue
import re
import shutil
import threading
import time
from urllib.parse import quote, urlsplit, urljoin

from store import now
from rules import normalize_rules, needs_body, needs_detail, match_note, REASONS, UNKNOWN_REASONS, normalize_region
from metadata import DETAIL_SCRIPT, PROFILE_SCRIPT, normalize_metadata, safe_profile_link


def browser_paths():
    result = {}
    for label, relative in [('chrome', 'Google/Chrome/Application/chrome.exe'), ('edge', 'Microsoft/Edge/Application/msedge.exe')]:
        for variable in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'):
            base = os.environ.get(variable)
            if base and (Path(base) / relative).is_file():
                result[label] = str(Path(base) / relative)
                break
        if label not in result:
            found = shutil.which('chrome' if label == 'chrome' else 'msedge')
            if found:
                result[label] = found
    return result


def likes_number(text):
    text = str(text or '').replace(',', '').replace(' ', '')
    match = re.search(r'(\d+(?:\.\d+)?)\s*([万亿wWkK]?)', text)
    if not match:
        return 0
    scale = {'万': 10000, '亿': 100000000, 'w': 10000, 'k': 1000}.get(match[2].lower(), 1)
    return int(float(match[1]) * scale)


def normalize_card(card, keyword):
    link = urljoin('https://www.xiaohongshu.com', str(card.get('link') or ''))
    parsed = urlsplit(link)
    parts = parsed.path.strip('/').split('/')
    if parsed.scheme not in ('https', 'http') or parsed.hostname not in ('xiaohongshu.com', 'www.xiaohongshu.com'):
        return None
    if len(parts) != 2 or parts[0] not in ('explore', 'search_result') or not parts[1]:
        return None
    title = str(card.get('title') or '').strip() or '（无标题笔记）'
    likes = str(card.get('likes') or '').strip()
    return {'note_id': parts[1], 'keyword': keyword, 'title': title, 'description': title,
            'author': str(card.get('author') or '未知作者').strip(), 'likes_text': likes or '未读取',
            'likes': likes_number(likes), 'likes_known':bool(re.search(r'\d',likes) or likes=='点赞'),
            'link': link, 'detail_status': 'title','author_link':safe_profile_link(card.get('author_link') or ''),
            'note_type':'unknown','ip_location':'','ip_source':'','published_at':'','time_kind':'unknown'}


CARDS_SCRIPT = '''() => Array.from(document.querySelectorAll('section.note-item')).map(card => {
 const text = selector => card.querySelector(selector)?.innerText?.trim() || '';
 const a = card.querySelector('a.cover') || card.querySelector('a[href*="/explore/"]') || card.querySelector('a[href*="/search_result/"]');
 const author=card.querySelector('.author-wrapper a[href*="/user/profile/"],a.author[href*="/user/profile/"]');
 return {link:a?.href || '',title:text('.title'),author:text('.author-wrapper .name') || text('.author .name'),likes:text('.like-wrapper .count'),author_link:author?.href||''};
})'''

GATE_SCRIPT = '''() => {
 const visible = s => Array.from(document.querySelectorAll(s)).some(el=>el.getBoundingClientRect().width>0 && el.getBoundingClientRect().height>0);
 if (visible('.captcha-modal,.captcha-container,#captcha-div,.verify-modal,[class*="verify-container"]')) return '页面要求安全验证，请在浏览器中手动完成后点击继续。';
 if (visible('.login-container,.login-modal,.login-box')) return '请在浏览器中登录小红书，完成后点击继续。';
 const body = (document.body?.innerText || '').slice(0,2000);
 if (body.includes('访问频次过高') || body.includes('请求过于频繁')) return '页面提示访问频繁，请稍后再继续或停止任务。';
 return '';
}'''


class Stopped(Exception):
    pass


class Engine:
    def __init__(self, store, home):
        self.store = store
        self.home = Path(home)
        self.commands = queue.Queue()
        self.lock = threading.RLock()
        self.stop_signal = threading.Event()
        self.shutdown_signal = threading.Event()
        self.continue_signal = threading.Event()
        self.active = None
        self.paused = False
        self.browser_status = 'closed'
        self.browser_name = ''
        self.login_busy = False
        self.context = None
        self.pw = None
        self.worker = threading.Thread(target=self._loop, name='collector', daemon=True)
        self.worker.start()

    def status(self):
        with self.lock:
            return {'active': self.active, 'paused': self.paused, 'browser': self.browser_status,
                    'browser_name': self.browser_name, 'login_busy': self.login_busy}

    def submit(self, identity):
        self.commands.put(('run', identity))

    def login(self):
        with self.lock:
            if self.active or self.login_busy:
                raise ValueError('当前浏览器有任务在运行，请先暂停或结束任务。')
            self.login_busy = True
        self.commands.put(('login', None))

    def action(self, identity, action):
        task = self.store.task(identity)
        with self.lock:
            if identity == self.active:
                if action == 'pause' and task['status'] == 'running':
                    self.paused = True
                    self.store.update_task(identity, status='paused', message='任务已暂停，已保存的结果不会丢失。')
                elif action == 'resume' and task['status'] in ('paused', 'waiting'):
                    self.paused = False
                    self.continue_signal.set()
                    self.store.update_task(identity, status='running', message='正在继续采集……')
                elif action == 'stop':
                    self.stop_signal.set()
                    self.store.update_task(identity, message='正在停止，当前页面操作结束后完成保存。')
                else:
                    raise ValueError('当前任务状态不支持此操作')
            elif action == 'stop' and task['status'] == 'queued':
                self.store.update_task(identity, status='stopped', ended_at=now(), message='任务已取消，尚未开始。')
            elif action == 'resume' and task['status'] in ('interrupted', 'stopped', 'error', 'partial'):
                self.store.update_task(identity, status='queued', ended_at=None, message='继续任务已加入队列')
                self.submit(identity)
            else:
                raise ValueError('当前任务状态不支持此操作')
        self.store.event(identity, 'info', {'pause':'已暂停任务','resume':'已请求继续任务','stop':'已请求停止并保存'}[action])

    def _ensure_browser(self):
        if self.context is not None:
            try:
                page = next((p for p in self.context.pages if not p.is_closed()), None)
                if page:
                    return page
                return self.context.new_page()
            except Exception:
                self.context = None
        from playwright.sync_api import sync_playwright
        choices = browser_paths()
        preference = self.store.settings()['browser']
        name = preference if preference in choices else next(iter(choices), None) if preference == 'auto' else None
        if not name:
            raise ValueError('未找到所选浏览器，请安装 Chrome 或 Edge，或在设置中切换浏览器。')
        if self.pw is None:
            self.pw = sync_playwright().start()
        self.browser_status = 'opening'
        self.context = self.pw.chromium.launch_persistent_context(
            str(self.home / 'data' / 'browser_profile' / name), executable_path=choices[name],
            headless=False, no_viewport=True, accept_downloads=False, timeout=20000,
            args=['--start-maximized', '--no-first-run', '--no-default-browser-check'])
        self.context.set_default_timeout(6000)
        self.context.set_default_navigation_timeout(20000)
        self.browser_status = 'open'
        self.browser_name = 'Chrome' if name == 'chrome' else 'Microsoft Edge'
        self.context.on('close', self._on_browser_closed)
        return self.context.pages[0] if self.context.pages else self.context.new_page()

    def _on_browser_closed(self, *args):
        self.context = None
        self.browser_status = 'closed'

    def _checkpoint(self, seconds=0):
        deadline = time.monotonic() + seconds
        while True:
            if self.shutdown_signal.is_set() or self.stop_signal.is_set():
                raise Stopped()
            if not self.paused and time.monotonic() >= deadline:
                return
            # Pump Playwright events while keeping cancellation responsive.
            try:
                if self.context and self.context.pages:
                    self.context.pages[0].wait_for_timeout(150)
                else:
                    time.sleep(.15)
            except Exception:
                self.context = None
                self.browser_status = 'closed'
                raise RuntimeError('浏览器已关闭。结果已保留，可打开浏览器后继续任务。')

    def _await_user(self, identity, message):
        self.continue_signal.clear()
        self.store.update_task(identity, status='waiting', message=message)
        self.store.event(identity, 'warning', message)
        deadline = time.monotonic() + 900
        while not self.continue_signal.is_set():
            self._checkpoint(.2)
            if time.monotonic() > deadline:
                raise RuntimeError('等待登录或验证超过 15 分钟，任务已结束，可稍后继续。')
        self.store.update_task(identity, status='running', message='正在继续采集……')

    def _read_detail(self, identity, note, settings):
        detail = None
        try:
            detail=self.context.new_page()
            detail.goto(note['link'],wait_until='domcontentloaded')
            self._checkpoint(settings['detail_interval'])
            gate=detail.evaluate(GATE_SCRIPT)
            if gate:
                self._await_user(identity,gate)
            raw=detail.evaluate(DETAIL_SCRIPT)
            metadata=normalize_metadata(raw)
            if not metadata['author_link']:
                metadata['author_link']=note.get('author_link','')
            note.update(metadata)
            if raw.get('description'):
                note['description']=raw['description']
                note['detail_status']='full'
            else:
                note['detail_status']='fallback'
        except Stopped:
            raise
        except Exception:
            note['detail_status']='fallback'
            self.store.event(identity,'warning',f'详情字段未能完整读取，将按任务条件决定是否跳过：{note["title"][:45]}')
        finally:
            if detail:
                try:
                    detail.close()
                except Exception:
                    pass

    def _read_author_ip(self, identity, link, settings, cache):
        link=safe_profile_link(link)
        if not link:
            return ''
        key=urlsplit(link).path
        if key in cache:
            return cache[key]
        tab=None
        raw=''
        try:
            self._checkpoint(settings['detail_interval'])
            tab=self.context.new_page()
            tab.goto(link,wait_until='domcontentloaded')
            self._checkpoint(settings['detail_interval'])
            gate=tab.evaluate(GATE_SCRIPT)
            if gate:
                self._await_user(identity,gate)
            raw=tab.evaluate(PROFILE_SCRIPT)
        except Stopped:
            raise
        except Exception:
            pass
        finally:
            if tab:
                try:
                    tab.close()
                except Exception:
                    pass
        cache[key]=raw
        return raw

    def _collect(self, identity):
        task = self.store.task(identity)
        keyword, target = task['keyword'], task['target']
        settings = self.store.settings()
        # Criteria were normalized and date presets resolved when creating the
        # task; resuming must not silently change their date window or word list.
        rules = task.get('criteria') or normalize_rules()
        author_cache={}
        page = self._ensure_browser()
        self._checkpoint()
        url = f'https://www.xiaohongshu.com/search_result?keyword={quote(keyword, safe="")}&source=web_search_result_notes'
        try:
            page.goto(url, wait_until='domcontentloaded')
        except Exception as exc:
            if not page.locator('section.note-item').count():
                raise RuntimeError('搜索页面加载失败，请检查网络和浏览器后继续任务。') from exc
        self._checkpoint(3)
        seen = self.store.seen_ids(identity)
        count = task['count']
        if count >= target:
            return 'completed', '已达到目标数量'
        gate = page.evaluate(GATE_SCRIPT)
        if gate:
            self._await_user(identity, gate)
            self._checkpoint(1)
        # Revisit missing metadata from the top; stable rejections stay seen.
        retry_missing=any(reason in UNKNOWN_REASONS for reason in task.get('skip_reasons',{}))
        if task['scroll_y'] and task.get('scanned',count) and not retry_missing:
            page.evaluate('(y)=>window.scrollTo(0,y)', task['scroll_y'])
            self._checkpoint(settings['interval'])
        idle, rounds, scanned = 0, 0, 0
        while count < target and rounds < 200 and scanned<rules['max_scan']:
            self._checkpoint()
            gate = page.evaluate(GATE_SCRIPT)
            if gate:
                self._await_user(identity, gate)
                continue
            cards = page.evaluate(CARDS_SCRIPT)
            if not cards:
                idle += 1
                if idle == 3:
                    self._await_user(identity, '没有检测到笔记列表。请检查登录、验证和搜索结果，处理后点击继续；也可停止任务。')
                if idle >= 6:
                    return 'partial', '未检测到有效笔记，请确认关键词有结果或页面结构是否变化。'
                self._checkpoint(settings['interval'])
                continue
            inspected = 0
            for card in cards:
                self._checkpoint()
                if scanned>=rules['max_scan']:
                    break
                note = normalize_card(card, keyword)
                if not note or note['note_id'] in seen:
                    continue
                scanned+=1
                inspected+=1
                reason,_=match_note(note,rules,early=True)
                if not reason and (task['mode']=='deep' or needs_detail(rules)):
                    self._read_detail(identity,note,settings)
                if not reason and rules['regions'] and (rules['ip_source']=='author' or (rules['ip_source']=='either' and not note.get('ip_location'))):
                    raw=self._read_author_ip(identity,note.get('author_link',''),settings,author_cache)
                    note.update(ip_raw=raw,ip_location=normalize_region(raw),ip_source='author' if raw else '')
                if not reason:
                    reason,hits=match_note(note,rules)
                    note['matched_terms']=hits
                if reason:
                    self.store.record_candidate(identity,note['note_id'],'unknown' if reason in UNKNOWN_REASONS else 'filtered',reason)
                elif self.store.record_candidate(identity,note['note_id'],'matched',note=note):
                    count+=1
                seen.add(note['note_id'])
                self.store.update_task(identity, message=f'本轮扫描 {scanned} 篇，已命中并保存 {count} / {target} 条')
                if count >= target:
                    break
            idle = 0 if inspected else idle + 1
            if idle >= 7:
                return 'partial', '连续多次滚动未发现新的候选笔记，符合条件的结果已保存。'
            if count >= target:
                break
            page.evaluate('window.scrollBy(0,850)')
            scroll_y = page.evaluate('Math.round(window.scrollY)')
            self.store.update_task(identity, scroll_y=scroll_y)
            rounds += 1
            self._checkpoint(settings['interval'])
        return ('completed', '已达到符合条件的目标数量') if count >= target else ('partial', f'本轮已扫描 {scanned} 篇候选笔记，符合条件的结果已保存，可继续扫描。')

    def _run_task(self, identity):
        task = self.store.task(identity)
        if task['status'] != 'queued':
            return
        with self.lock:
            self.active = identity
            self.paused = False
            self.stop_signal.clear()
            self.continue_signal.clear()
        started = time.monotonic()
        self.store.update_task(identity, status='running', started_at=task['started_at'] or now(), message='正在准备浏览器……')
        self.store.event(identity, 'info', '开始采集；每条结果都会立即保存到本地数据库。')
        try:
            status, message = self._collect(identity)
        except Stopped:
            status, message = 'interrupted' if self.shutdown_signal.is_set() else 'stopped', '任务已停止，已保存的内容可继续查看和导出。'
        except Exception as exc:
            logging.exception('Task %s failed', identity)
            status, message = 'error', str(exc)[:700]
        self.store.update_task(identity, status=status, message=message, ended_at=now(), elapsed=task['elapsed'] + time.monotonic()-started)
        self.store.event(identity, 'error' if status == 'error' else 'info', message)
        summary=self.store.task(identity)
        if summary.get('skip_reasons'):
            reasons='；'.join(f'{REASONS.get(key,key)} {amount} 篇' for key,amount in summary['skip_reasons'].items())
            self.store.event(identity,'info',f'筛选统计：扫描 {summary["scanned"]} 篇，保存 {summary["count"]} 篇，跳过 {summary["skipped"]} 篇。'+reasons)
        if self.store.settings()['auto_export'] and self.store.task(identity)['count']:
            try:
                settings = self.store.settings()
                exported = self.store.export(settings['export_dir'], settings['export_format'], {'task_id': identity}, prefix='拾页_' + task['keyword'])
                self.store.event(identity, 'info', f'自动导出完成：{exported["path"]}')
            except Exception as exc:
                self.store.event(identity, 'warning', f'自动导出失败，数据仍保存在本地，可手动导出：{exc}')
        with self.lock:
            self.active = None
            self.paused = False

    def _loop(self):
        try:
            while not self.shutdown_signal.is_set():
                try:
                    action, identity = self.commands.get(timeout=.25)
                except queue.Empty:
                    if self.context and self.context.pages:
                        try:
                            self.context.pages[0].wait_for_timeout(50)
                        except Exception:
                            self._on_browser_closed()
                    continue
                if action == 'login':
                    try:
                        self._ensure_browser().goto('https://www.xiaohongshu.com', wait_until='domcontentloaded')
                        self.store.event(None, 'info', '浏览器已打开，请手动完成小红书登录。')
                    except Exception as exc:
                        self.browser_status = 'error'
                        self.store.event(None, 'error', f'浏览器打开失败：{exc}')
                    finally:
                        self.login_busy = False
                elif action == 'run':
                    self._run_task(identity)
        except Exception:
            logging.exception('Worker failed')
            if self.active:
                self.store.update_task(self.active, status='error', ended_at=now(), message='工作线程异常退出。数据已保留，请重启软件后继续。')
        finally:
            if self.context:
                try:
                    self.context.close()
                except Exception:
                    pass
            if self.pw:
                try:
                    self.pw.stop()
                except Exception:
                    pass

    def shutdown(self):
        self.shutdown_signal.set()
        self.stop_signal.set()
        self.continue_signal.set()
        self.worker.join(timeout=45)
        # Mark queued jobs resumable without starting them during shutdown.
        for task in self.store.tasks():
            if task['status'] == 'queued':
                self.store.update_task(task['id'], status='interrupted', ended_at=now(), message='程序已关闭，任务尚未开始，可继续。')
