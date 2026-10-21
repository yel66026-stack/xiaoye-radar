"""Daylight presentation adapter. Collection, matching and exports keep the 2.1 engine."""
from datetime import datetime, timedelta
from pathlib import Path
import json
import sqlite3

from desktop import DesktopApi, exposed
from rules import SHANGHAI


class DaylightApi(DesktopApi):
    def __init__(self, home, demo=False):
        home = Path(home)
        source = home / 'data' / 'workspace.sqlite3'
        self._upgrade_backup = ''
        if source.exists() and source.stat().st_size:
            with sqlite3.connect(source) as database:
                has_settings = database.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='settings'").fetchone()
                marker = database.execute("SELECT value FROM settings WHERE key='daylight_version'").fetchone() if has_settings else None
                if not marker:
                    folder = home / '备份'
                    folder.mkdir(parents=True, exist_ok=True)
                    backup = folder / f'升级前_Daylight_{datetime.now():%Y%m%d_%H%M%S_%f}.sqlite3'
                    with sqlite3.connect(backup) as target:
                        database.backup(target)
                    self._upgrade_backup = str(backup)
        super().__init__(home, demo)
        self._real.save_settings({'daylight_version': '2.2.2'})

    def _preferences(self):
        values = self._get_store().settings().get('daylight', {})
        return values if isinstance(values, dict) else {}

    def _filter(self, filters):
        filters = dict(filters or {})
        if filters.pop('saved_only', False):
            saved = self._preferences().get('saved_ids', [])
            requested = filters.get('ids')
            identities = sorted(set(int(i) for i in saved) & set(int(i) for i in requested)) if requested else list(saved)
            if not identities:
                return None
            filters['ids'] = identities
        return filters

    @exposed
    def snapshot(self):
        with self._guard:
            response = super().snapshot()
            if not response['ok']:
                raise ValueError(response['error'])
            snapshot = response['data']
            snapshot['libraries'] = self._get_store().libraries()
            snapshot['ui'] = self._preferences()
            snapshot['upgrade_backup'] = self._upgrade_backup
            today = datetime.now(SHANGHAI).date()
            with self._get_store().connection() as database:
                counts = {row[0]: row[1] for row in database.execute("SELECT date(collected_at,'+8 hours'),COUNT(*) FROM notes GROUP BY 1")}
            snapshot['daily_counts'] = [{'date': (today-timedelta(days=i)).isoformat(), 'count': counts.get((today-timedelta(days=i)).isoformat(), 0)} for i in range(6,-1,-1)]
            snapshot['stats']['today'] = counts.get(today.isoformat(),0)
            return snapshot

    @exposed
    def notes(self, filters=None):
        filters = self._filter(filters)
        return self._get_store().notes(filters) if filters is not None else {'rows': [], 'total': 0}

    @exposed
    def export_notes(self, payload):
        if len((payload.get('filters') or {}).get('ids') or []) > 1000:
            raise ValueError('单次最多勾选导出 1000 条；更多记录请使用当前筛选范围导出。')
        filters = self._filter(payload.get('filters'))
        if filters is None:
            raise ValueError('当前收藏范围没有可导出的笔记。')
        result = super().export_notes({**payload, 'filters': filters})
        if not result['ok']:
            raise ValueError(result['error'])
        return result['data']

    @exposed
    def set_note_saved(self, identity, saved):
        identity = int(identity)
        if not isinstance(saved, bool):
            raise ValueError('收藏状态无效。')
        self._get_store().note(identity)
        with self._guard:
            prefs = self._preferences()
            values = set(prefs.get('saved_ids', []))
            if saved:
                if identity not in values and len(values) >= 1000:
                    raise ValueError('最多收藏 1000 条笔记，请先整理部分收藏。')
                values.add(identity)
            else:
                values.discard(identity)
            prefs['saved_ids'] = sorted(values)
            self._get_store().save_settings({'daylight': prefs})
            return prefs['saved_ids']

    @exposed
    def save_task_note(self, identity, text):
        self._get_store().task(identity)
        if not isinstance(text,str) or len(text)>5000:
            raise ValueError('研究备注最多 5000 个字符。')
        with self._guard:
            prefs = self._preferences()
            notes = prefs.get('task_notes', {})
            notes[identity] = text
            prefs['task_notes'] = notes
            self._get_store().save_settings({'daylight': prefs})
        return text
