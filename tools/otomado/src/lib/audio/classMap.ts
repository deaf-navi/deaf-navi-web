/**
 * YAMNet クラスマップ CSV のパース。
 * 形式: index,mid,display_name — display_name は「"Smoke detector, smoke alarm"」のように
 * カンマを含む場合ダブルクォートで囲まれる。
 */
export function parseClassMapCsv(csv: string): string[] {
  const names: string[] = []
  const lines = csv.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    const cols = parseCsvLine(line)
    if (cols.length < 3) continue
    const [index, , displayName] = cols
    // ヘッダー行（index が数値でない）はスキップ
    if (!/^\d+$/.test(index.trim())) continue
    names[Number(index)] = displayName
  }
  return names
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      cols.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  cols.push(cur)
  return cols
}
