import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useState } from 'react'
import { KeyHints } from './KeyHints.js'

interface Props {
  isBusy: boolean
  onSubmit: (text: string) => void
  onCancel: () => void
}

export function CommentInput({ isBusy, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState('')
  useInput((_input, key) => {
    if (key.escape && !isBusy) onCancel()
  })
  const submit = (value: string) => {
    if (!isBusy && value.trim()) onSubmit(value)
  }
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold>New comment</Text>
      {isBusy ? (
        <Text color="yellow">Sending…</Text>
      ) : (
        <TextInput value={draft} onChange={setDraft} onSubmit={submit} placeholder="Write a comment…" />
      )}
      <KeyHints hints={[['enter', 'send'], ['esc', 'cancel']]} />
    </Box>
  )
}
