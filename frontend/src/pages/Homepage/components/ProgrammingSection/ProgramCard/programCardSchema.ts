export type ProgramSession = {
  date: Date
  topic: string
}

export type Program = {
  age: string
  day: string
  copy: string
  sessions: ProgramSession[]
  title?: string
  dropIn?: boolean
}
