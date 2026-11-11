/** Small RFC 4180 reader for previews: quoted fields, "" escapes, CRLF; `;` / tab when they clearly win over `,`. */
export function parseCsv(input: string, maxRows = 500): string[][] {
  const firstLine = input.slice(0, input.indexOf('\n') === -1 ? input.length : input.indexOf('\n'))
  const counts = { ',': 0, ';': 0, '\t': 0 } as Record<string, number>
  for (const char of firstLine) if (char in counts) counts[char] += 1
  const [best, bestCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  const delimiter = bestCount > 0 ? best : ','

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"' && field === '') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      if (rows.length >= maxRows) return rows
    } else {
      field += char
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** 0 → A, 25 → Z, 26 → AA */
export function columnName(index: number) {
  let name = ''
  let value = index + 1
  while (value > 0) {
    const rest = (value - 1) % 26
    name = String.fromCharCode(65 + rest) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}
