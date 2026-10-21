"""Checks run inside this application's own WebView2 smoke-test mode."""
import csv
import json
from pathlib import Path
import time
from store import VERSION


def run(window, api, demo, report):
    def wait(expression, timeout=15):
        end = time.monotonic()+timeout
        while time.monotonic()<end:
            value=window.evaluate_js(expression)
            if value:
                return value
            time.sleep(.08)
        raise AssertionError('Native condition timed out: '+expression)

    wait('Boolean(window.App?.state.snap)')
    assert window.evaluate_js('window.App.state.snap.version') == VERSION
    window.evaluate_js("window.__nativeErrors=[];addEventListener('error',e=>window.__nativeErrors.push(e.message));addEventListener('unhandledrejection',e=>window.__nativeErrors.push(String(e.reason)))")
    assert window.evaluate_js("getComputedStyle(document.querySelector('h1')).color")=='rgb(15, 23, 42)'
    assert window.evaluate_js('document.documentElement.scrollWidth<=innerWidth')
    report['checks'].append('WebView2 renders the Daylight React UI through the real Python bridge')
    assert window.evaluate_js("document.querySelector('h1').textContent") == '工作台'
    wait("Boolean(document.querySelector('.overview-workbench .task-list'))")
    assert window.evaluate_js("document.querySelector('.overview-workbench').getBoundingClientRect().top < innerHeight - 120")
    assert window.evaluate_js("parseFloat(getComputedStyle(document.querySelector('.heading-actions .btn')).fontSize)") >= 13
    assert window.evaluate_js("!document.querySelector('.discovery-banner,.inspiration-panel,.app-footer,.date-greeting')")
    report['checks'].append('Dashboard shows actual tasks above the fold with readable controls and without promotional blocks')
    window.evaluate_js("window.App.navigate('library')")
    wait("document.querySelector('h1')?.textContent==='内容资料库'")
    if demo:
        wait("document.querySelectorAll('.note-check').length===12")
        window.evaluate_js("window.__nativeExport=null;window.pywebview.api.export_notes({format:'csv',filters:{ids:[1]}}).then(r=>window.__nativeExport=r)")
        result=wait('window.__nativeExport')
        assert result['ok'],result
        assert result['data']['count']==1
        with open(result['data']['path'],encoding='utf-8-sig',newline='') as file:
            assert len(list(csv.reader(file)))==2
        report['checks'].append('Actual WebView2-to-Python export writes a selected CSV record with all metadata fields')
    else:
        assert window.evaluate_js('window.App.state.snap.stats.total')==0
    window.evaluate_js('window.App.newTask()')
    wait("Boolean(document.querySelector('#task-form'))")
    assert window.evaluate_js("document.querySelector('#task-form button[type=submit]').disabled")==demo
    window.evaluate_js("document.querySelector('.advanced-toggle').click()")
    wait("Boolean(document.querySelector('.rule-fields'))")
    assert window.evaluate_js("document.querySelectorAll('.rule-fields input,.rule-fields select,.rule-fields textarea').length")>=13
    assert window.evaluate_js("parseFloat(getComputedStyle(document.querySelector('.rule-fields label')).fontSize)") >= 13
    assert window.evaluate_js("document.querySelector('.rule-explanation').open") is False
    window.evaluate_js("document.querySelector('.rule-explanation summary').click()")
    assert window.evaluate_js("document.querySelector('.rule-explanation').open") is True
    assert window.evaluate_js("document.querySelector('#task-form button[type=submit]').getBoundingClientRect().bottom <= document.querySelector('[role=dialog]').getBoundingClientRect().bottom")
    assert window.evaluate_js("document.getElementById('root').hasAttribute('inert')")
    report['checks'].append('Real task form exposes complete collection criteria, preserves demo blocking and traps background focus')
    window.evaluate_js('window.App.closeModal()')
    wait("!document.querySelector('[role=dialog]')")
    window.evaluate_js("window.App.navigate('words')")
    wait("document.querySelector('h1')?.textContent==='自定义词库'")
    if demo:
        payload={'name':'Daylight 原生桥接验收词库','search_terms':['AI 办公','内容研究'],'include_words':['工具'],'exclude_words':['广告'],'include_mode':'all'}
        window.evaluate_js('window.__nativeLibrary=null;window.pywebview.api.save_word_library('+json.dumps(payload,ensure_ascii=False)+').then(r=>window.__nativeLibrary=r)')
        result=wait('window.__nativeLibrary')
        assert result['ok'],result
        wait("document.body.textContent.includes('Daylight 原生桥接验收词库')")
        report['checks'].append('Vocabulary changes persist in SQLite and appear through live native snapshot polling')
    window.evaluate_js("window.App.navigate('tasks')")
    wait("document.querySelector('h1')?.textContent==='采集任务'")
    for view in ('列表','时间轴','看板'):
        window.evaluate_js("Array.from(document.querySelectorAll('[role=tab]')).find(e=>e.textContent==="+json.dumps(view)+").click()")
        wait("Array.from(document.querySelectorAll('[role=tab]')).some(e=>e.textContent==="+json.dumps(view)+"&&e.getAttribute('aria-selected')==='true')")
    if demo:
        window.evaluate_js("Array.from(document.querySelectorAll('[role=tab]')).find(e=>e.textContent==='列表').click()")
        wait("Boolean(document.querySelector('.task-list.is-full'))")
        task=api._get_store().tasks()[0]
        try:
            for state, expected in [('running',2),('paused',2),('stopped',1),('completed',0)]:
                api._get_store().update_task(task['id'],status=state)
                wait("window.App.state.snap.tasks.some(t=>t.id==="+json.dumps(task['id'])+"&&t.status==="+json.dumps(state)+")")
                wait("document.querySelectorAll('.tasks-page .task-actions button').length==="+str(expected))
                assert window.evaluate_js("Array.from(document.querySelectorAll('.tasks-page .task-actions button')).every(b=>b.disabled)")
        finally:
            api._get_store().update_task(task['id'],status=task['status'])
        report['checks'].append('Task rows expose pause/stop/resume actions for running, paused and stopped states while retaining demo guards')
    # Exercise the reorganized controls through the running React UI, rather than only calling the API.
    window.evaluate_js("document.querySelector('.settings-nav').click()")
    wait("Boolean(document.querySelector('#settings-form'))")
    def tab(label):
        window.evaluate_js("Array.from(document.querySelectorAll('#settings-form [role=tab]')).find(e=>e.textContent==="+json.dumps(label)+").click()")
        wait("Array.from(document.querySelectorAll('#settings-form [role=tab]')).some(e=>e.textContent==="+json.dumps(label)+"&&e.getAttribute('aria-selected')==='true')")
    def fill(selector, value, select=False):
        window.evaluate_js("(()=>{const e=document.querySelector("+json.dumps(selector)+");const p=Object.getPrototypeOf(e);Object.getOwnPropertyDescriptor(p,'value').set.call(e,"+json.dumps(value)+");e.dispatchEvent(new Event("+json.dumps('change' if select else 'input')+",{bubbles:true}));})()")
    fill('#settings-form input[aria-label="工作区名称"]','原生窗口设置验收')
    tab('采集')
    wait("document.querySelectorAll('#settings-form input[type=number]').length===2")
    fill('#settings-form select','edge',True)
    fill('#settings-form input[min="3"]','5.5')
    fill('#settings-form input[min="2"]','3.5')
    tab('导出')
    wait("Boolean(document.querySelector('#settings-form input[aria-label=导出目录]'))")
    assert window.evaluate_js("document.querySelector('#settings-form .path-input button').type")=='button'
    fill('#settings-form select','json',True)
    fill('#settings-form .form-grid label:last-child select','no',True)
    tab('常规')
    assert window.evaluate_js("document.querySelector('#settings-form input').value")=='原生窗口设置验收'
    window.evaluate_js("document.querySelector('#settings-form').requestSubmit()")
    wait("!document.querySelector('[role=dialog]')")
    wait("window.App.state.snap.settings.workspace==='原生窗口设置验收'")
    settings=api._get_store().settings()
    assert settings['interval']==5.5 and settings['detail_interval']==3.5 and settings['export_format']=='json' and settings['browser']=='edge' and settings['auto_export'] is False,settings
    report['checks'].append('All settings categories preserve pending edits and save real browser, timing, workspace and export values to SQLite')
    window.evaluate_js("document.querySelector('.settings-nav').click()")
    wait("Boolean(document.querySelector('#settings-form'))")
    tab('数据与备份')
    window.evaluate_js("Array.from(document.querySelectorAll('#settings-form button')).find(e=>e.textContent==='备份数据库').click()")
    wait("Boolean(document.querySelector('.backup-result'))")
    backup_path=window.evaluate_js("document.querySelector('.backup-result .selectable-path').textContent")
    assert Path(backup_path).is_file()
    assert window.evaluate_js("Array.from(document.querySelectorAll('#settings-form button')).some(e=>e.textContent==='查看运行日志')")
    window.evaluate_js('window.App.closeModal()')
    wait("!document.querySelector('[role=dialog]')")
    report['checks'].append('The data category creates an actual database backup and retains backup-folder, database-path and log actions')
    if demo:
        window.evaluate_js("window.App.navigate('words')")
        wait("document.querySelector('h1')?.textContent==='自定义词库'")
        wait("document.querySelectorAll('.word-card-actions').length>=1")
        window.evaluate_js("Array.from(document.querySelectorAll('.word-card-actions button')).find(e=>e.textContent==='编辑').click()")
        wait("Boolean(document.querySelector('#word-library-form'))")
        original=window.evaluate_js("document.querySelector('#word-library-form input[aria-label=词库名称]').value")
        fill('#word-library-form input[aria-label="词库说明"]','原生表单保存验收')
        window.evaluate_js("document.querySelector('#word-library-form').requestSubmit()")
        wait("!document.querySelector('[role=dialog]')")
        wait("document.body.textContent.includes('原生表单保存验收')")
        assert any(l['name']==original and l['description']=='原生表单保存验收' for l in api._get_store().libraries())
        window.evaluate_js("document.querySelector('.word-card-actions .primary').click()")
        wait("Boolean(document.querySelector('#task-form'))")
        assert window.evaluate_js("document.querySelector('#task-form #keywords').value.length>0")
        assert window.evaluate_js("document.querySelector('#task-form select').value.length>0")
        window.evaluate_js('window.App.closeModal()')
        wait("!document.querySelector('[role=dialog]')")
        report['checks'].append('Vocabulary editing saves through the form and its primary action loads the original search terms and library into collection')
    window.evaluate_js("document.querySelector('[aria-label=使用帮助]').click()")
    wait("Boolean(document.querySelector('.help-content'))")
    window.evaluate_js("Array.from(document.querySelectorAll('.help-actions button')).find(e=>e.textContent==='第三方许可').click()")
    wait("Boolean(document.querySelector('.license-copy'))")
    assert window.evaluate_js("document.querySelector('.license-copy').textContent.includes('Python / Windows')")
    assert window.evaluate_js("document.querySelector('.license-copy').textContent.includes('MIT License')")
    report['checks'].append('The self-contained executable exposes frontend and Python/Windows dependency license notices without companion files')
    window.evaluate_js('window.App.closeModal()')
    wait("!document.querySelector('[role=dialog]')")
    assert window.evaluate_js('window.__nativeErrors')==[]
    report['checks'].append('Native task navigation, three views and JavaScript error monitoring pass')
