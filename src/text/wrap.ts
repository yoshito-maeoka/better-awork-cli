const wrapLine = (line: string, width: number): string[] => {
  const out: string[] = []
  let rest = line
  while (rest.length > width) {
    const space = rest.lastIndexOf(' ', width)
    const cut = space > 0 ? space : width
    out.push(rest.slice(0, cut).trimEnd())
    rest = rest.slice(cut).trimStart()
  }
  return [...out, rest]
}

/** Pre-wrap text so scroll windows can count rows exactly. */
export function wrapLines(text: string, width: number): string[] {
  const safeWidth = Math.max(1, width)
  return text.split('\n').flatMap((line) => wrapLine(line, safeWidth))
}
