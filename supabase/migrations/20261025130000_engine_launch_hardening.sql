BEGIN;

CREATE TABLE public.engine_request_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'search', 'scenario', 'evaluate', 'contribute', 'ingest_source',
    'index_corpus', 'review_feedback', 'review_evaluation',
    'export_dataset', 'train_model', 'model_status'
  )),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action)
);

ALTER TABLE public.engine_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.engine_request_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_engine_request_limit(p_action text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_window_seconds integer;
  v_limit integer;
  v_count integer;
  v_window_start timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT configured.window_seconds, configured.max_requests
  INTO v_window_seconds, v_limit
  FROM (VALUES
    ('search', 60, 30),
    ('scenario', 60, 8),
    ('evaluate', 60, 15),
    ('contribute', 60, 4),
    ('ingest_source', 60, 2),
    ('index_corpus', 60, 2),
    ('review_feedback', 60, 20),
    ('review_evaluation', 60, 20),
    ('export_dataset', 60, 5),
    ('train_model', 300, 1),
    ('model_status', 60, 30)
  ) AS configured(action, window_seconds, max_requests)
  WHERE configured.action = p_action;

  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'Unsupported engine action';
  END IF;

  INSERT INTO public.engine_request_limits AS current_limit (
    user_id, action, window_started_at, request_count, updated_at
  )
  VALUES (v_user_id, p_action, v_now, 1, v_now)
  ON CONFLICT (user_id, action) DO UPDATE
  SET window_started_at = CASE
        WHEN current_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now THEN v_now
        ELSE current_limit.window_started_at
      END,
      request_count = CASE
        WHEN current_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now THEN 1
        ELSE current_limit.request_count + 1
      END,
      updated_at = v_now
  WHERE current_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now
     OR current_limit.request_count < v_limit
  RETURNING request_count, window_started_at INTO v_count, v_window_start;

  IF NOT FOUND THEN
    SELECT current_limit.window_started_at INTO v_window_start
    FROM public.engine_request_limits AS current_limit
    WHERE current_limit.user_id = v_user_id AND current_limit.action = p_action;

    RETURN jsonb_build_object(
      'allowed', false,
      'limit', v_limit,
      'remaining', 0,
      'retry_after_seconds', greatest(
        1,
        ceil(extract(epoch FROM (
          v_window_start + make_interval(secs => v_window_seconds) - v_now
        )))::integer
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'limit', v_limit,
    'remaining', greatest(0, v_limit - v_count),
    'retry_after_seconds', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_engine_request_limit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_engine_request_limit(text) TO authenticated;

COMMIT;
