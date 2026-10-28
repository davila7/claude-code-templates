-- Supabase (download tracking project): who ran the CLI for each download.
-- Run in the Supabase SQL editor; not part of the Neon migrations above.
--
-- Written by dashboard/src/pages/api/track-download-supabase.ts from what
-- cli-tool/src/agent-detection.js reports. All three are self-reported and
-- nullable. CLI versions before this change send none of them, so a row is:
--   client_is_tty IS NULL                       -> unknown (old CLI)
--   client_agent IS NOT NULL                    -> run by an AI agent
--   client_agent IS NULL AND client_is_tty      -> a person in a terminal
--   client_agent IS NULL AND NOT client_is_tty  -> script, pipe or other non-interactive run
--
-- The endpoint falls back to inserting without these columns until this runs,
-- so the order of deploy and migration does not matter.

ALTER TABLE public.component_downloads
  ADD COLUMN IF NOT EXISTS client_agent text,
  ADD COLUMN IF NOT EXISTS client_entrypoint text,
  ADD COLUMN IF NOT EXISTS client_is_tty boolean;

ALTER TABLE public.component_downloads
  DROP CONSTRAINT IF EXISTS component_downloads_client_agent_len,
  ADD CONSTRAINT component_downloads_client_agent_len CHECK (char_length(client_agent) <= 32),
  DROP CONSTRAINT IF EXISTS component_downloads_client_entrypoint_len,
  ADD CONSTRAINT component_downloads_client_entrypoint_len CHECK (char_length(client_entrypoint) <= 32);

-- Make PostgREST see the new columns right away.
NOTIFY pgrst, 'reload schema';

-- Check: daily split since the columns exist.
-- SELECT date_trunc('day', created_at) AS day,
--        CASE WHEN client_is_tty IS NULL THEN 'unknown'
--             WHEN client_agent IS NOT NULL THEN 'agent'
--             WHEN client_is_tty THEN 'human'
--             ELSE 'non-interactive' END AS who,
--        count(*)
-- FROM public.component_downloads
-- WHERE created_at >= now() - interval '30 days'
-- GROUP BY 1, 2 ORDER BY 1, 2;
