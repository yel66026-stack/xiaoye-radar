"""Regression coverage for v2.1 conditions, public metadata and vocabulary."""
from datetime import datetime, timedelta
import json
from pathlib import Path
import sqlite3
import time
from unittest.mock import patch

from engine import Engine, browser_paths
from rules import normalize_rules, match_note, parse_public_time, normalize_region, SHANGHAI
from store import Store
from metadata import normalize_metadata


def wait(predicate,seconds=25):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        if predicate():
            return
        time.sleep(.04)
    raise AssertionError('Condition fixture timed out')


class ConditionFixtureEngine(Engine):
    def __init__(self,*args):
        self.fixture_fixed=False
        self.profile_visits=0
        super().__init__(*args)

    def _checkpoint(self,seconds=0):
        super()._checkpoint(min(seconds,.015))

    def _ensure_browser(self):
        if self.context:
            return self.context.pages[0]
        from playwright.sync_api import sync_playwright
        self.pw=sync_playwright().start()
        self.context=self.pw.chromium.launch_persistent_context(str(self.home/'condition_profile'),
            executable_path=next(iter(browser_paths().values())),headless=True)
        self.context.set_default_navigation_timeout(5000)
        def route_handler(route):
            path=route.request.url
            today=datetime.now(SHANGHAI).date()
            if '/search_result?' in path:
                cards=[]
                for identity in 'abcdefghij':
                    likes='50' if identity=='g' else '2,000'
                    cards.append(f'<section class="note-item"><a class="cover" href="https://www.xiaohongshu.com/explore/{identity}?xsec_token=fixture">封面</a><div class="title">装修设计 {identity}</div><div class="author-wrapper"><a href="https://www.xiaohongshu.com/user/profile/shared"><span class="name">作者甲</span></a></div><div class="like-wrapper"><span class="count">{likes}</span></div></section>')
                html=''.join(cards)
            elif '/user/profile/' in path:
                self.profile_visits+=1
                html='<div class="user-info"><div class="IP-container">IP属地：北京市</div></div>'
            else:
                identity=path.split('/explore/')[1].split('?')[0]
                day=today-timedelta(days=30 if identity=='e' else 1)
                date_text=('编辑于 ' if identity=='c' or (identity=='f' and not self.fixture_fixed) else '发布于 ')+day.isoformat()
                ip='' if identity in ('d','i') else '<div class="ip-location">IP属地：'+('上海' if identity=='a' else '北京')+'</div>'
                body='' if identity=='h' and not self.fixture_fixed else '<div id="detail-desc">装修预算与设计方案'+(' 广告' if identity=='b' else '')+'</div>'
                media='<div class="image-container"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></div>' if identity=='j' else '<video></video>'
                html=f'<div id="noteContainer"><div class="author-container"><a href="https://www.xiaohongshu.com/user/profile/shared">作者甲</a></div>{media}<div class="note-content">{body}<div class="bottom-container"><span class="date">{date_text}</span>{ip}</div></div><div class="comments-container"><div class="comment-item"><span class="ip-location">IP属地：广东</span><time>2020-01-01</time></div></div></div>'
                if identity=='c':
                    structured={'@type':'SocialMediaPosting','url':path,'datePublished':day.isoformat()}
                    html+='<script type="application/ld+json">'+json.dumps(structured)+'</script>'
            route.fulfill(status=200,content_type='text/html; charset=utf-8',body='<meta charset="utf-8">'+html)
        self.context.route('**/*',route_handler)
        return self.context.pages[0] if self.context.pages else self.context.new_page()


def run_condition_checks(directory):
    directory.mkdir(parents=True,exist_ok=True)
    checks=[]
    reference=datetime(2026,10,16,10,0,tzinfo=SHANGHAI)
    assert normalize_region('IP属地：北京市')=='北京'
    assert normalize_region('广西壮族自治区')=='广西'
    assert parse_public_time('昨天 08:20',reference)['published_at']=='2026-10-15'
    assert parse_public_time('3小时前',reference)['published_at']=='2026-10-16'
    assert parse_public_time('2026年10月14日',reference)['published_at']=='2026-10-14'
    assert parse_public_time('12-31',reference)['published_at']=='2025-12-31'
    assert parse_public_time('编辑于 2026-10-15',reference)['published_at']==''
    assert parse_public_time('2026-02-31',reference)['published_at']==''
    assert parse_public_time('2026-10-15T18:00:00Z',reference)['published_at']=='2026-10-16'
    relative=normalize_rules({'date_preset':'last7'},reference)
    assert (relative['date_from'],relative['date_to'])==('2026-10-10','2026-10-16')
    for invalid in ({'date_from':'2026-10-17','date_to':'2026-10-16'},{'min_likes':50,'max_likes':10},{'regions':['IP属地']},{'include_mode':'bogus'},{'max_scan':-1}):
        try:
            normalize_rules(invalid,reference)
            raise AssertionError('Expected invalid criteria to be rejected')
        except ValueError:
            pass
    sample={'title':'装修设计预算','description':'装修设计方案','author':'作者甲','likes':2000,'likes_known':True,
            'ip_location':'北京','published_at':'2026-10-15','time_kind':'published','note_type':'video','detail_status':'full'}
    criteria=normalize_rules({'regions':'北京,上海','date_from':'2026-10-10','date_to':'2026-10-16','min_likes':1000,
        'max_likes':3000,'include_words':['装修','设计'],'exclude_words':['广告'],'include_mode':'all','note_type':'video','authors':['作者甲']},reference)
    assert match_note(sample,criteria)==(None,['装修','设计'])
    assert match_note({**sample,'description':'装修设计广告'},criteria)[0]=='exclude_hit'
    assert match_note({**sample,'ip_location':''},criteria)[0]=='ip_missing'
    assert match_note({**sample,'published_at':'','time_kind':'updated'},criteria)[0]=='time_missing'
    assert match_note({**sample,'description':'装修','detail_status':'title'},criteria)[0]=='body_missing'
    assert match_note({**sample,'note_type':'image'},criteria)[0]=='type_mismatch'
    assert match_note(sample,normalize_rules({'authors':['其他人']}))[0]=='author_mismatch'
    assert match_note(sample,normalize_rules({'exclude_authors':['作者甲']}))[0]=='author_excluded'
    checks.append('Rules: AND/OR combinations, exclusion priority, author/type/like bounds, inclusive publish dates and missing-field rejection')
    checks.append('Public date parsing: relative dates, no-year inference, timezone conversion and edited-time separation')

    # A genuine v2.0 database shape with a Chinese record must upgrade losslessly.
    legacy=directory/'legacy.sqlite3'
    with sqlite3.connect(legacy) as db:
        db.executescript('''CREATE TABLE tasks(id TEXT PRIMARY KEY,keyword TEXT,target INTEGER,mode TEXT,status TEXT,created_at TEXT,
            started_at TEXT,ended_at TEXT,elapsed REAL DEFAULT 0,message TEXT DEFAULT '',scroll_y INTEGER DEFAULT 0);
            CREATE TABLE notes(id INTEGER PRIMARY KEY,task_id TEXT,note_id TEXT,keyword TEXT,title TEXT,description TEXT,author TEXT,
            likes_text TEXT,likes INTEGER,link TEXT,collected_at TEXT,detail_status TEXT,UNIQUE(task_id,note_id));
            INSERT INTO tasks(id,keyword,target,mode,status,created_at) VALUES('legacy','原有任务',10,'fast','completed','2026-10-01');
            INSERT INTO notes VALUES(1,'legacy','legacy-note','原有任务','原有笔记','原正文','原作者','12',12,'https://www.xiaohongshu.com/explore/old','2026-10-01','title');''')
    migrated=Store(legacy,directory/'exports')
    assert migrated.note(1)['title']=='原有笔记'
    assert migrated.note(1)['ip_location']=='' and migrated.note(1)['published_at']==''
    assert migrated.notes({'date_from':'2026-01-01'})['total']==0
    assert Path(migrated.migration_backup).is_file()
    with sqlite3.connect(migrated.migration_backup) as db:
        assert 'ip_location' not in {row[1] for row in db.execute('PRAGMA table_info(notes)')}
        assert db.execute('SELECT title FROM notes').fetchone()[0]=='原有笔记'
    checks.append('v2.0 migration: automatic pre-upgrade backup, preserved records and honest unknown metadata')
    folded_task=migrated.create_task('大小写与全角',1,'fast')
    folded={**sample,'note_id':'folded','keyword':'大小写与全角','title':'ＡＩ 设计','author':'ＮＡＭＥ',
            'likes_text':'2000','link':'https://www.xiaohongshu.com/explore/folded'}
    assert match_note(folded,normalize_rules({'include_words':['ai'],'text_scope':'title','authors':['name']}))[0] is None
    migrated.add_note(folded_task,folded)
    assert migrated.notes({'include_words':['ai'],'text_scope':'title','authors':['name']})['total']==1
    migrated.add_note(folded_task,{**folded,'note_id':'unknown','title':'数据缺失','author':'未知作者','likes_known':False})
    assert migrated.notes({'task_id':folded_task,'min_likes':0})['total']==1
    assert migrated.notes({'task_id':folded_task,'exclude_authors':['其他作者']})['total']==1
    checks.append('Scanning and library filters share Unicode/fullwidth and case-insensitive word/author matching')

    from desktop import DesktopApi
    api=DesktopApi(directory/'vocab-api')
    try:
        saved=api.save_word_library({'name':'北京装修扫描','search_terms':['装修','装修','设计'],'include_words':['装修','设计'],'exclude_words':['广告'],'include_mode':'all'})
        assert saved['ok']
        library=saved['data']
        assert library['search_terms']==['装修','设计']
        with patch.object(api._engine,'submit'):
            created=api.create_tasks({'target':20,'mode':'fast','library_id':library['id'],
                'criteria':{'regions':['北京'],'date_preset':'last7','max_scan':200}})
            assert created['ok'],created
            identity=created['data'][0]
        frozen=api._real.task(identity)
        api.save_word_library({**library,'name':'已修改词库','include_words':['新的规则']})
        api.delete_word_library(library['id'])
        assert api._real.task(identity)['criteria']['include_words']==['装修','设计']
        assert api._real.task(identity)['library']['name']=='北京装修扫描'
        assert frozen['criteria']['date_from']==api._real.task(identity)['criteria']['date_from']
        txt=directory/'分组词库.txt'
        txt.write_text('[搜索词]\n装修\n设计\n[包含词]\n北京\n[排除词]\n广告\n',encoding='utf-8-sig')
        imported=api._read_library_file(txt)
        assert imported['search_terms']==['装修','设计'] and imported['include_words']==['北京']
        lib=api.save_word_library(imported)['data']
        exported=api.export_word_library(lib['id'])
        assert exported['ok'] and api._read_library_file(exported['data'])['exclude_words']==['广告']
        assert api.create_tasks({'keywords':['测试'],'target':20,'mode':'fast','criteria':{'date_from':'2026-10-20','date_to':'2026-10-10'}})['ok'] is False
    finally:
        api._engine.shutdown()
    checks.append('Word libraries: CRUD, deduplication, TXT/JSON round-trip, immutable task snapshots and resolved date presets')

    store=Store(directory/'engine.sqlite3',directory/'scan-exports')
    store.save_settings({'auto_export':False})
    engine=ConditionFixtureEngine(store,directory)
    try:
        conditions=normalize_rules({'regions':['北京'],'date_preset':'last7','min_likes':1000,'max_likes':3000,
            'include_words':['装修','设计'],'exclude_words':['广告'],'include_mode':'all','note_type':'video','max_scan':10})
        identity=store.create_task('装修设计',10,'fast',conditions)
        engine.submit(identity)
        wait(lambda:store.task(identity)['status'] in ('partial','error'))
        task=store.task(identity)
        assert task['status']=='partial',task
        assert (task['count'],task['scanned'],task['skipped'])==(3,10,7),task
        result=store.notes({'task_id':identity})['rows']
        assert {n['note_id'] for n in result}=={'c','d','i'}
        assert all(n['published_at'] and n['ip_location']=='北京' and n['note_type']=='video' for n in result)
        assert next(n for n in result if n['note_id']=='d')['ip_source']=='author'
        assert next(n for n in result if n['note_id']=='c')['ip_source']=='note'
        assert next(n for n in result if n['note_id']=='c')['published_source']=='json-ld'
        assert engine.profile_visits==1,engine.profile_visits
        assert task['skip_reasons']=={'exclude_hit':1,'ip_mismatch':1,'before_range':1,'time_missing':1,'likes_low':1,'body_missing':1,'type_mismatch':1},task
        query={'regions':['北京市'],'date_from':conditions['date_from'],'date_to':conditions['date_to'],
            'note_type':'video','include_words':['装修','设计'],'include_mode':'all','exclude_words':['广告'],'min_likes':1000,'max_likes':3000}
        assert store.notes(query)['total']==3
        exported=store.export(directory/'scan-exports','json',query)
        rows=json.loads(Path(exported['path']).read_text(encoding='utf-8'))
        assert len(rows)==3 and all(row['matched_terms']==['装修','设计'] for row in rows)
        assert all(row['published_at'] and row['ip_location']=='北京' for row in rows)
        wait(lambda:engine.active is None)
        engine.fixture_fixed=True
        engine.action(identity,'resume')
        wait(lambda:store.task(identity)['status'] in ('partial','error') and store.task(identity)['count']>3)
        resumed=store.task(identity)
        assert (resumed['count'],resumed['scanned'],resumed['skipped'])==(5,10,5),resumed
        assert 'body_missing' not in resumed['skip_reasons'] and 'time_missing' not in resumed['skip_reasons']
        wait(lambda:engine.active is None)
        notes_only=store.create_task('仅笔记属地',10,'fast',{**conditions,'ip_source':'note'})
        before=engine.profile_visits
        engine.submit(notes_only)
        wait(lambda:store.task(notes_only)['status'] in ('partial','error'))
        assert engine.profile_visits==before
        assert store.task(notes_only)['skip_reasons'].get('ip_missing')==2
        checks.append('Real browser fixtures: IP source/fallback, profile caching, combined filtering, matched-only targets, budgets and reason counters')
        checks.append('Resumption: persistent exclusions, retry of missing metadata, stable criteria and duplicate-free result counts')
        checks.append('Library and exports: identical multi-condition scope, public metadata columns and recorded matched vocabulary')
    finally:
        engine.shutdown()
    return checks
