import type { NormalizedContent, RuleSet } from './types'

export const ZHEJIANG_CITIES = [
  '杭州',
  '宁波',
  '温州',
  '嘉兴',
  '湖州',
  '绍兴',
  '金华',
  '衢州',
  '舟山',
  '台州',
  '丽水',
] as const

function normalized(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/gu, '')
}

// Only explicit location metadata is considered. IP, author profile and body text are excluded.
export function contentLocation(item: NormalizedContent): string {
  const values = ['location', 'region', 'province', 'city', 'poi'].flatMap((key) => {
    const value = item.metadata[key]
    if (typeof value === 'string') return [value]
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const record = value as Record<string, unknown>
    return ['province', 'city', 'name', 'address', 'addressRegion', 'addressLocality'].flatMap(
      (field) => (typeof record[field] === 'string' ? [record[field]] : []),
    )
  })
  return [...new Set(values)].join(' · ')
}

const OTHER_PROVINCES =
  /北京|上海|天津|重庆|江苏|福建|江西|安徽|广东|山东|湖南|湖北|河南|河北|四川|云南|贵州|陕西|山西|甘肃|青海|海南|台湾|辽宁|吉林|黑龙江|广西|内蒙古|宁夏|新疆|西藏|香港|澳门/u

function geographicLocation(item: NormalizedContent): string {
  const explicit = ['province', 'city', 'region'].flatMap((key) =>
    typeof item.metadata[key] === 'string' ? [item.metadata[key]] : [],
  )
  for (const key of ['location', 'region', 'poi']) {
    const value = item.metadata[key]
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const record = value as Record<string, unknown>
    for (const field of [
      'province',
      'city',
      'provinceName',
      'cityName',
      'province_name',
      'city_name',
      'addressRegion',
      'addressLocality',
    ]) {
      if (typeof record[field] === 'string' && record[field].trim()) explicit.push(record[field])
    }
  }
  return explicit.length > 0 ? explicit.join(' · ') : contentLocation(item)
}

function containsPlace(location: string, place: string): boolean {
  const value = normalized(location)
  const target = normalized(place).replace(/[省市]$/u, '')
  if (target === '浙江' || target === 'zhejiang') {
    // A conflicting explicit province is never overridden by a coincidental city name.
    if (OTHER_PROVINCES.test(value)) return false
    return (
      value.includes('浙江') ||
      value.includes('zhejiang') ||
      ZHEJIANG_CITIES.some((city) =>
        value.split(/[·,，/]/u).some((part) => part === city || part.startsWith(`${city}市`)),
      )
    )
  }
  return value.includes(target)
}

export function checkRegion(
  item: NormalizedContent,
  region: RuleSet['regionFilter'],
): 'match' | 'outside' | 'missing' {
  if (!region) return 'match'
  const location = geographicLocation(item)
  if (!location.trim()) return 'missing'
  if (!containsPlace(location, region.province)) {
    const explicit = ['province', 'city', 'region'].some(
      (key) => typeof item.metadata[key] === 'string' && Boolean(item.metadata[key]),
    )
    return explicit || OTHER_PROVINCES.test(location) || /省|市|浙江|zhejiang/iu.test(location)
      ? 'outside'
      : 'missing'
  }
  if (region.cities.length === 0 || region.cities.some((city) => containsPlace(location, city)))
    return 'match'
  return ZHEJIANG_CITIES.some((city) => location.includes(city)) ||
    (typeof item.metadata.city === 'string' && Boolean(item.metadata.city))
    ? 'outside'
    : 'missing'
}
