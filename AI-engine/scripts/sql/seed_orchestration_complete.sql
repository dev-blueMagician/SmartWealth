-- Seed: CompletenessAgent should report is_complete=true (variables non-empty).

INSERT INTO orchestration_request (
  request_id, workflow_id, user_id, correlation_id,
  input_text, input_language, source_channel, priority, requested_at,
  confidence_threshold, human_approval_required,
  ssot_record_id, ssot_record_type, ssot_record_version, ssot_correlation_id,
  assessment_code,
  ssot_snapshot_id, environment, feature_flags,
  session_id, current_step, attempt_count,
  previous_result_ids, escalation_required, human_approval_status,
  human_approver_id, human_approval_at, variables
) VALUES (
  '44444444-4444-4444-4444-444444444444'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  'corr-seed-complete',
  'Assess onboarding completeness',
  'en',
  'api',
  1,
  NOW(),
  0.800,
  FALSE,
  '55555555-5555-5555-5555-555555555555'::uuid,
  'onboarding',
  'v1',
  'ssot-corr-seed',
  'onboarding_completeness',
  '66666666-6666-6666-6666-666666666666'::uuid,
  'dev',
  '{"onboarding_completeness_enabled": true}'::jsonb,
  'sess-seed-complete',
  'onboarding',
  1,
  '[]'::jsonb,
  FALSE,
  'NOT_REQUIRED',
  NULL,
  NULL,
  '{"customer_id":"C001"}'::jsonb
) ON CONFLICT (request_id) DO UPDATE SET
  variables = EXCLUDED.variables,
  session_id = EXCLUDED.session_id;
