-- Deliberately broken middle migration (inserted between 202608260022 and 202608270023)
-- Position 25 of 64: must halt execution immediately, preventing 202608270023..202610260400 from running.
CREATE TABLE public.deliberate_mid_failure (
  id uuid PRIMARY KEY,
  syntax_error_intentional ;;;;;
);
