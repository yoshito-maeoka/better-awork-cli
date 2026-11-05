import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useMemo, useState } from 'react'
import type { Project } from '../api/schemas.js'
import { normalize } from '../project/detect.js'
import { KeyHints } from './KeyHints.js'
import { SelectList } from './SelectList.js'

// Title, explanation, search line, margins and key hints.
const CHROME_ROWS = 7

interface Props {
  projects: readonly Project[]
  suggestions: readonly Project[]
  height: number
  onPick: (project: Project) => void
  onCancel: () => void
}

/** Suggestions first, then everything else alphabetically. */
const orderProjects = (projects: readonly Project[], suggestions: readonly Project[]): Project[] => {
  const suggested = new Set(suggestions.map((p) => p.id))
  const rest = projects.filter((p) => !suggested.has(p.id)).sort((a, b) => a.name.localeCompare(b.name))
  return [...suggestions, ...rest]
}

export function ProjectPicker({ projects, suggestions, height, onPick, onCancel }: Props) {
  const [query, setQuery] = useState('')
  const ordered = useMemo(() => orderProjects(projects, suggestions), [projects, suggestions])
  const visible = useMemo(
    () => (query ? ordered.filter((p) => normalize(p.name).includes(normalize(query))) : ordered),
    [ordered, query],
  )
  const suggestedIds = new Set(suggestions.map((p) => p.id))

  useInput((_input, key) => {
    if (key.escape) onCancel()
  })

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Which awork project is this directory?
      </Text>
      <Text dimColor>Your choice is saved to .baw.json so baw finds it next time.</Text>
      <Box marginTop={1}>
        <Text color="cyan">search: </Text>
        <TextInput value={query} onChange={setQuery} placeholder="type to filter" />
      </Box>
      <Box marginTop={1}>
        <SelectList
          key={query}
          items={visible}
          height={height - CHROME_ROWS}
          vimKeys={false}
          keyOf={(p) => p.id}
          onSelect={onPick}
          emptyText="No project matches."
          renderItem={(p, isSelected) => (
            <Text inverse={isSelected}>
              {isSelected ? '› ' : '  '}
              {p.name}
              {suggestedIds.has(p.id) ? <Text color="green"> (suggested)</Text> : null}
            </Text>
          )}
        />
      </Box>
      <Box marginTop={1}>
        <KeyHints hints={[['↑↓', 'move'], ['enter', 'link project'], ['esc', 'quit']]} />
      </Box>
    </Box>
  )
}
