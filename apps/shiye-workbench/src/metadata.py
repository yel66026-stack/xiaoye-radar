"""Read public note/profile metadata from the user's browser DOM."""
from urllib.parse import urlsplit
from rules import normalize_region, parse_public_time

DETAIL_SCRIPT = r'''() => {
 const root = document.querySelector('#noteContainer,.note-detail,.note-detail-mask,.note-container') || document.querySelector('.note-content')?.parentElement || document;
 const outsideComments = el => el && !el.closest('.comment-item,.comments-container,.comments-el');
 const first = selectors => Array.from(root.querySelectorAll(selectors)).find(outsideComments);
 const text = el => el?.innerText?.trim() || el?.textContent?.trim() || '';
 const desc = first('#detail-desc,.note-content .desc,[data-note-description]');
 const date = first('.bottom-container .date,.note-content .date,.note-meta .date,time[itemprop="datePublished"],time[data-published]');
 const dateText = text(date);
 let published = '', source = 'page';
 const meta = document.querySelector('meta[property="article:published_time"],meta[itemprop="datePublished"]');
 if(meta?.content){published=meta.content;source='page-meta';}
 if(!published){
   const entries=[];
   for(const script of document.querySelectorAll('script[type="application/ld+json"]')){
     try {const obj=JSON.parse(script.textContent);entries.push(...(Array.isArray(obj)?obj:obj['@graph']||[obj]));}catch(e){}
   }
   for(const entry of entries){
     const types=Array.isArray(entry['@type'])?entry['@type']:[entry['@type']];
     const canonical=typeof entry.url==='string'?entry.url:typeof entry.mainEntityOfPage==='string'?entry.mainEntityOfPage:'';
     if(canonical){try{if(new URL(canonical,location.href).pathname!==location.pathname)continue;}catch(e){continue;}}
     if(types.some(t=>['Article','SocialMediaPosting','BlogPosting','VideoObject'].includes(t)) && entry.datePublished){published=String(entry.datePublished);source='json-ld';break;}
   }
 }
 if(!published)published=/编辑|更新|修改/.test(dateText)?dateText:date?.getAttribute('datetime')||dateText;
 const ipElement=first('.ip-location,.ip-container,.IP-container,.ip-info,[data-ip-location]');
 let ip=text(ipElement);
 if(!ip){
   const candidates=Array.from(root.querySelectorAll('.bottom-container .date,.note-meta,.bottom-container .ip')).filter(outsideComments);
   for(const el of candidates){const m=text(el).match(/IP\s*属地\s*[:：]?\s*([^\s·|，,\n]+)/i);if(m){ip=m[0];break;}}
 }
 const author=first('.author-container a[href*="/user/profile/"],.author-wrapper a[href*="/user/profile/"],a.author[href*="/user/profile/"]');
 const video=first('video,[data-note-type="video"]');
 const image=first('.media-container img,.note-slider img,.image-container img,.swiper-slide img,[data-note-type="image"]');
 return {description:text(desc),published_raw:dateText||published,published_value:published,published_source:source,
    ip_raw:ip,author_link:author?.href||'',note_type:video?'video':image?'image':'unknown'};
}'''

PROFILE_SCRIPT = r'''() => {
 const root=document.querySelector('.user-info,.user-info-container,.user-page') || document;
 const elements=Array.from(root.querySelectorAll('.ip-location,.ip-container,.IP-container,.ip-info,[data-ip-location]'));
 const element=elements.find(el=>!el.closest('.note-item,.comment-item,.comments-container'));
 return element?.innerText?.trim() || element?.textContent?.trim() || '';
}'''


def normalize_metadata(raw, reference=None):
    result = parse_public_time(raw.get('published_value') or raw.get('published_raw'), reference)
    ip_raw = str(raw.get('ip_raw') or '').strip()
    result.update({'published_raw':str(raw.get('published_raw') or ''),
        'published_source':str(raw.get('published_source') or 'page'),
        'ip_raw':ip_raw, 'ip_location':normalize_region(ip_raw), 'ip_source':'note' if ip_raw else '',
        'note_type':raw.get('note_type') if raw.get('note_type') in ('image','video') else 'unknown',
        'author_link':safe_profile_link(raw.get('author_link') or '')})
    return result


def safe_profile_link(link):
    parsed = urlsplit(str(link))
    if parsed.scheme not in ('https','http') or parsed.hostname not in ('www.xiaohongshu.com','xiaohongshu.com'):
        return ''
    parts = parsed.path.strip('/').split('/')
    return str(link) if len(parts)==3 and parts[:2]==['user','profile'] and parts[2] else ''
