"""Daylight compatibility tests against isolated SQLite data and local browser fixtures."""
import csv
import json
from pathlib import Path
import sqlite3
import sys
import traceback
from daylight_api import DaylightApi
from selftest import FixtureEngine, wait_until
from store import Store, seed_demo


def run(directory):
    directory=Path(directory)
    directory.mkdir(parents=True,exist_ok=True)
    report={'passed':False,'checks':[],'scope':'Isolated databases and local fixtures, no account or live Xiaohongshu collection.'}
    api=None
    try:
        home=directory/'legacy-workspace'
        legacy=Store(home/'data'/'workspace.sqlite3',home/'采集结果')
        seed_demo(legacy)
        legacy.save_settings({'workspace':'原版保留的工作区','interval':5,'detail_interval':3})
        api=DaylightApi(home)
        snapshot=api.snapshot()['data']
        assert snapshot['stats']['total']==12 and len(snapshot['libraries'])==1
        assert snapshot['settings']['workspace']=='原版保留的工作区'
        assert snapshot['settings']['interval']==5
        assert Path(snapshot['upgrade_backup']).is_file()
        with sqlite3.connect(snapshot['upgrade_backup']) as db:
            assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
            assert db.execute('SELECT COUNT(*) FROM notes').fetchone()[0]==12
            assert not db.execute("SELECT value FROM settings WHERE key='daylight_version'").fetchone()
        report['checks'].append('2.1 schema, notes, vocabulary, export settings and task snapshots remain readable; pre-upgrade SQLite backup is intact')
        row=api.notes()['data']['rows'][0]
        assert api.notes({'saved_only':True})['data']['total']==0
        assert not api.export_notes({'format':'json','filters':{'saved_only':True}})['ok']
        assert api.set_note_saved(row['id'],True)['ok']
        assert api.notes({'saved_only':True})['data']['total']==1
        assert api.notes({'saved_only':True,'ids':[999999]})['data']['total']==0
        assert api.set_note_saved(row['id'],'bad')['ok'] is False
        for fmt in ('csv','xlsx','json'):
            result=api.export_notes({'format':fmt,'filters':{'saved_only':True}})
            assert result['ok'] and result['data']['count']==1,result
            assert Path(result['data']['path']).is_file()
        assert api.save_task_note(row['task_id'],'用于下一期内容研究')['ok']
        backup=api.backup()['data']
        with sqlite3.connect(backup) as db:
            prefs=json.loads(db.execute("SELECT value FROM settings WHERE key='daylight'").fetchone()[0])
            assert row['id'] in prefs['saved_ids']
            assert prefs['task_notes'][row['task_id']]=='用于下一期内容研究'
        api._engine.shutdown()
        api=DaylightApi(home)
        assert api.notes({'saved_only':True})['data']['total']==1
        assert api.snapshot()['data']['upgrade_backup']==''
        assert api.snapshot()['data']['ui']['task_notes'][row['task_id']]=='用于下一期内容研究'
        report['checks'].append('Favorites, selected/favorite-scope exports, annotation persistence and backups use the existing SQLite settings safely')
        assert api.toggle_demo()['ok']
        assert api.notes({'saved_only':True})['data']['total']==0
        assert api.create_tasks({'keywords':['禁止演示采集'],'target':2,'mode':'fast'})['ok'] is False
        assert api.toggle_demo()['ok']
        assert api.notes({'saved_only':True})['data']['total']==1
        report['checks'].append('Demo data, favorites and real collection permissions remain isolated')
        api._engine.shutdown()
        api._engine=FixtureEngine(api._real,home/'fixture-engine')
        result=api.create_tasks({'keywords':['Daylight桥接验收'],'target':2,'mode':'deep','criteria':{'min_likes':10000,'max_likes':13000,'include_words':['测试正文'],'text_scope':'body','max_scan':10}})
        assert result['ok'],result
        identity=result['data'][0]
        wait_until(lambda:api._real.task(identity)['status'] in ('completed','error'),25)
        task=api._real.task(identity)
        assert task['status']=='completed' and task['count']==2,task
        assert task['criteria']['min_likes']==10000 and task['criteria']['include_words']==['测试正文']
        assert api.notes({'task_id':identity})['data']['total']==2
        result=api.export_notes({'format':'csv','filters':{'task_id':identity}})
        assert result['ok'] and result['data']['count']==2
        with open(result['data']['path'],encoding='utf-8-sig',newline='') as f:
            assert len(list(csv.reader(f)))==3
        report['checks'].append('The unchanged production queue executes a task submitted through DaylightApi, applies combination criteria, saves and exports real local-fixture browser results')
        report['passed']=True
    except Exception:
        report['error']=traceback.format_exc()
    finally:
        if api:api._engine.shutdown()
        (directory/'adapter-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return 0 if report['passed'] else 1

if __name__=='__main__':raise SystemExit(run(sys.argv[1]))
