"""Validated, immutable task criteria and deterministic matching."""
from datetime import datetime, timedelta, timezone, date
import re
import unicodedata

SHANGHAI = timezone(timedelta(hours=8))
REASONS = {
 'ip_missing':'IP 属地未公开或未能读取', 'ip_mismatch':'IP 属地不匹配',
 'time_missing':'未读取到可确认的发布时间', 'before_range':'早于发布时间范围', 'after_range':'晚于发布时间范围',
 'likes_missing':'点赞数未能读取', 'likes_low':'点赞数低于下限', 'likes_high':'点赞数高于上限',
 'type_missing':'内容类型未能确认', 'type_mismatch':'内容类型不匹配',
 'author_missing':'作者信息未能读取', 'author_mismatch':'作者不在限定名单', 'author_excluded':'作者在排除名单',
 'body_missing':'筛选所需正文未能读取', 'include_mismatch':'未命中包含词规则', 'exclude_hit':'命中排除词',
}
UNKNOWN_REASONS = {'ip_missing','time_missing','likes_missing','type_missing','author_missing','body_missing'}


def fold_text(value):
    return unicodedata.normalize('NFKC',str(value or '')).casefold()


def split_terms(value, limit=300, length=100):
    if value is None:
        return []
    if isinstance(value, str):
        value = re.split(r'[\r\n,，;；]+', value)
    if not isinstance(value, (list, tuple)):
        raise ValueError('词汇或地区必须是文本或列表。')
    result, seen = [], set()
    for word in value:
        if not isinstance(word, str):
            raise ValueError('词汇必须是文本。')
        word = unicodedata.normalize('NFKC', word).strip()
        if not word:
            continue
        if len(word) > length or '\x00' in word:
            raise ValueError(f'单条内容不能超过 {length} 个字符。')
        key = word.casefold()
        if key not in seen:
            result.append(word)
            seen.add(key)
    if len(result) > limit:
        raise ValueError(f'最多可填写 {limit} 条。')
    return result


def normalize_region(value):
    value = unicodedata.normalize('NFKC', str(value or '')).strip()
    value = re.sub(r'^\s*IP\s*属地\s*[:：]?\s*', '', value, flags=re.I).strip()
    value = re.sub(r'^(中国大陆|中国)[\s·-]*', '', value).strip()
    aliases = {'内蒙古自治区':'内蒙古','广西壮族自治区':'广西','宁夏回族自治区':'宁夏','新疆维吾尔自治区':'新疆',
               '西藏自治区':'西藏','香港特别行政区':'香港','澳门特别行政区':'澳门','台湾省':'台湾'}
    value = aliases.get(value, value)
    if value.endswith(('省', '市')):
        value = value[:-1]
    return '' if value.strip() in ('未知','未公开','不详','未知属地','暂无') else value.strip()


def parse_public_time(raw, reference=None):
    """Never reinterpret an edited timestamp as the publication timestamp."""
    reference = reference or datetime.now(SHANGHAI)
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=SHANGHAI)
    raw = str(raw or '').strip()
    result = {'published_at':'', 'published_precision':'unknown', 'time_kind':'unknown'}
    if not raw:
        return result
    if re.search(r'编辑|修改|更新|updated|modified', raw, re.I):
        result['time_kind'] = 'updated'
        return result
    text = re.sub(r'^(发布于|发表于|发布|发布时间|Published)\s*[:：]?\s*', '', raw, flags=re.I)
    try:
        if re.match(r'^\d{4}-\d{2}-\d{2}T', text):
            instant = datetime.fromisoformat(text.replace('Z','+00:00'))
            if instant.tzinfo:
                instant = instant.astimezone(SHANGHAI)
            return {'published_at':instant.date().isoformat(),'published_precision':'timestamp','time_kind':'published'}
        match = re.search(r'(?<!\d)(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?', text)
        if match:
            day = date(*map(int, match.groups()))
            return {'published_at':day.isoformat(),'published_precision':'day','time_kind':'published'}
        if any(word in text for word in ('刚刚','今天','昨天','前天')):
            offset = 2 if '前天' in text else 1 if '昨天' in text else 0
            day = reference.date() - timedelta(days=offset)
            return {'published_at':day.isoformat(),'published_precision':'relative','time_kind':'published'}
        match = re.search(r'(\d+)\s*(分钟|小时|天|周)前', text)
        if match:
            amount, unit = int(match[1]), match[2]
            seconds = amount * {'分钟':60, '小时':3600, '天':86400, '周':604800}[unit]
            return {'published_at':(reference-timedelta(seconds=seconds)).date().isoformat(),'published_precision':'relative','time_kind':'published'}
        match = re.search(r'(?<![\d-])(\d{1,2})[-/月](\d{1,2})日?(?![\d-])', text)
        if match:
            day = date(reference.year, int(match[1]), int(match[2]))
            if day > reference.date():
                day = day.replace(year=reference.year-1)
            return {'published_at':day.isoformat(),'published_precision':'inferred_year','time_kind':'published'}
    except (ValueError, OverflowError):
        pass
    return result


def normalize_rules(raw=None, reference=None):
    raw = raw or {}
    if not isinstance(raw, dict):
        raise ValueError('筛选条件格式无效。')
    requested_regions=split_terms(raw.get('regions'),50,40)
    rules = {
      'regions':list(dict.fromkeys(normalize_region(r) for r in requested_regions)),
      'ip_source':raw.get('ip_source','either'), 'date_preset':raw.get('date_preset','all'),
      'date_from':str(raw.get('date_from') or ''), 'date_to':str(raw.get('date_to') or ''),
      'note_type':raw.get('note_type','all'), 'text_scope':raw.get('text_scope','both'),
      'include_mode':raw.get('include_mode','any'),
      'include_words':split_terms(raw.get('include_words')), 'exclude_words':split_terms(raw.get('exclude_words')),
      'authors':split_terms(raw.get('authors'),100,80), 'exclude_authors':split_terms(raw.get('exclude_authors'),100,80),
      'min_likes':None, 'max_likes':None, 'max_scan':1000,
    }
    if rules['ip_source'] not in ('either','note','author') or rules['note_type'] not in ('all','image','video'):
        raise ValueError('无效的属地来源或内容类型。')
    if any(not value for value in rules['regions']):
        raise ValueError('请填写明确的 IP 属地地区，例如北京、上海。')
    if rules['text_scope'] not in ('title','body','both') or rules['include_mode'] not in ('any','all'):
        raise ValueError('无效的词汇匹配方式。')
    if rules['date_preset'] not in ('all','last1','last7','last30','last90','custom'):
        raise ValueError('无效的发布时间范围。')
    if rules['date_preset'].startswith('last'):
        ref = reference or datetime.now(SHANGHAI)
        if isinstance(ref, datetime):
            ref = ref.astimezone(SHANGHAI).date() if ref.tzinfo else ref.date()
        days = int(rules['date_preset'][4:])
        rules['date_from'] = (ref - timedelta(days=days-1)).isoformat()
        rules['date_to'] = ref.isoformat()
    elif rules['date_preset'] == 'all' and (rules['date_from'] or rules['date_to']):
        rules['date_preset'] = 'custom'
    for key in ('date_from','date_to'):
        if rules[key]:
            try:
                parsed = date.fromisoformat(rules[key])
                if parsed.isoformat() != rules[key]:
                    raise ValueError
            except ValueError:
                raise ValueError('日期必须使用 YYYY-MM-DD 格式。')
    if rules['date_preset']=='custom' and not (rules['date_from'] or rules['date_to']):
        raise ValueError('自定义时间范围至少填写一个日期。')
    if rules['date_from'] and rules['date_to'] and rules['date_from']>rules['date_to']:
        raise ValueError('开始日期不能晚于结束日期。')
    for key in ('min_likes','max_likes','max_scan'):
        value = raw.get(key)
        if value is None or value == '':
            continue
        try:
            numeric = int(value)
            if isinstance(value,bool) or float(value)!=numeric or numeric<0:
                raise ValueError
        except (ValueError,TypeError,OverflowError):
            raise ValueError('点赞数和扫描上限必须是非负整数。')
        if key=='max_scan' and not 1<=numeric<=20000:
            raise ValueError('单次扫描上限为 1–20000 篇候选笔记。')
        if key!='max_scan' and numeric>1_000_000_000:
            raise ValueError('点赞数超出支持范围。')
        rules[key] = numeric
    if rules['min_likes'] is not None and rules['max_likes'] is not None and rules['min_likes']>rules['max_likes']:
        raise ValueError('点赞下限不能高于上限。')
    return rules


def needs_body(rules):
    return bool((rules['include_words'] or rules['exclude_words']) and rules['text_scope']!='title')


def needs_detail(rules):
    return bool(rules['regions'] or rules['date_from'] or rules['date_to'] or needs_body(rules) or rules['note_type']!='all')


def match_note(note, rules, early=False):
    """Across condition groups: AND. Within region/author whitelists: OR."""
    author = fold_text(note.get('author'))
    if rules['authors'] or rules['exclude_authors']:
        if not author or author=='未知作者':
            return 'author_missing', []
        if author in {fold_text(v) for v in rules['exclude_authors']}:
            return 'author_excluded', []
        if rules['authors'] and author not in {fold_text(v) for v in rules['authors']}:
            return 'author_mismatch', []
    if rules['min_likes'] is not None or rules['max_likes'] is not None:
        if not note.get('likes_known',True):
            return 'likes_missing', []
        if rules['min_likes'] is not None and note.get('likes',0)<rules['min_likes']:
            return 'likes_low', []
        if rules['max_likes'] is not None and note.get('likes',0)>rules['max_likes']:
            return 'likes_high', []
    if early:
        return None, []
    if rules['regions']:
        region = normalize_region(note.get('ip_location'))
        if not region:
            return 'ip_missing', []
        if region not in rules['regions']:
            return 'ip_mismatch', []
    published = note.get('published_at') or ''
    if rules['date_from'] or rules['date_to']:
        if not published or note.get('time_kind')!='published':
            return 'time_missing', []
        if rules['date_from'] and published<rules['date_from']:
            return 'before_range', []
        if rules['date_to'] and published>rules['date_to']:
            return 'after_range', []
    if rules['note_type']!='all':
        if note.get('note_type') not in ('image','video'):
            return 'type_missing', []
        if note['note_type']!=rules['note_type']:
            return 'type_mismatch', []
    if needs_body(rules) and note.get('detail_status')!='full':
        return 'body_missing', []
    text = note.get('title','') if rules['text_scope']=='title' else note.get('description','') if rules['text_scope']=='body' else note.get('title','')+'\n'+note.get('description','')
    text = fold_text(text)
    if any(fold_text(word) in text for word in rules['exclude_words']):
        return 'exclude_hit', []
    hits = [word for word in rules['include_words'] if fold_text(word) in text]
    if rules['include_words'] and ((rules['include_mode']=='all' and len(hits)!=len(rules['include_words'])) or not hits):
        return 'include_mismatch', hits
    return None, hits
