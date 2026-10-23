export type TaskKind = 'agent' | 'shell' | 'workflow'

export type TaskState = 'running' | 'completed' | 'failed' | 'killed'

// 띠가 그리는 값만 둔다, Haiku 입력은 모듈 변수에 따로 둔다
export type Task = {
  // agentId, backgroundTaskId, 또는 Workflow 호출의 tool_use_id
  id: string
  kind: TaskKind
  title: string
  // 에이전트 종류 원문 (Explore 등), 셸은 shell, Workflow 는 workflow · remote-workflow
  type: string
  state: TaskState
  startedAt: number
  endedAt?: number
  // 무슨 목적으로 무엇을 하는지 한 문장
  purpose?: string
  // 지금 하는 일의 종류 (read · code · plan · docs · test · run), Haiku 가 정한 값
  tag?: string
  // 마지막으로 진행이 보인 시각, 걸림 표시에 쓴다
  activeAt: number
  output?: string
  result?: string
  outputPath?: string
  // 속한 Workflow 행의 id
  groupId?: string
  // 셸을 띄운 에이전트 id
  parentId?: string
  // 부모 에이전트가 끝나면 함께 끝나는 셸 (완료 알림이 오지 않음)
  endsWithParent?: boolean
  // Workflow 완료 알림이 부르는 task id
  taskId?: string
  runId?: string
  // 에이전트에게 준 지시 · 셸 명령, 가리고 자른 것
  brief?: string
}

declare module 'claude-code' {
  interface PluginState {
    'task-lens': { tasks: Task[]; tick: number }
  }
}
