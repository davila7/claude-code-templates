export interface ReviewCycle {
  id: number;
  session_id: string;
  component_path: string;
  component_type: string;
  status: 'active' | 'completed' | 'failed' | 'merged';
  phase: 'selection' | 'research' | 'improve' | 'pr_created' | 'reporting' | 'merging';
  pr_url: string | null;
  pr_number: number | null;
  branch_name: string | null;
  linear_issue_id: string | null;
  improvements_summary: string | null;
  error_message: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ToolExecution {
  id: number;
  cycle_id: number;
  session_id: string;
  tool_name: string;
  tool_args_summary: string | null;
  phase: string | null;
  result_status: 'success' | 'error';
  result_summary: string | null;
  created_at: string;
}

export interface CycleControl {
  id: number;
  is_paused: boolean;
  paused_by: string | null;
  reason: string | null;
  updated_at: string;
}
