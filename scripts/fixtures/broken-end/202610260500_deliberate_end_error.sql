-- Deliberately broken end migration (inserted after 202610260400_serp460_accounting_event_subledger)
-- Position 64 of 64: all real migrations apply OK, then this final file halts execution with exit 1.
CREATE TABLE public.deliberate_end_failure (
  id uuid PRIMARY KEY,
  syntax_error_at_end ;;;;;
);
