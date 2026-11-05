import { Box, Text } from 'ink'

export type Hint = readonly [key: string, label: string]

export function KeyHints({ hints }: { hints: readonly Hint[] }) {
  return (
    <Box flexWrap="wrap" columnGap={2}>
      {hints.map(([key, label]) => (
        <Text key={key}>
          <Text bold color="cyan">
            {key}
          </Text>
          <Text dimColor> {label}</Text>
        </Text>
      ))}
    </Box>
  )
}
