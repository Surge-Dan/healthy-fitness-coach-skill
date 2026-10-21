 'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { normalizeAthleteProfile } = require('./athlete-state.js');
const text = value => typeof value === 'string' ? value.slice(0, 2000) : '';
function createCheckpoint({ profile = {}, program = {}, last_session = {}, next_session = '', pending_questions = [], updated_at, valid_until } = {}) {
  if (!Number.isFinite(Date.parse(updated_at)) || !Number.isFinite(Date.parse(valid_until)) || Date.parse(valid_until) < Date.parse(updated_at)) throw new Error('Valid update and expiry dates required');
  const safeProfile = normalizeAthleteProfile(profile);
  const snapshot = { schema_version: '1.0', updated_at, valid_until, profile: safeProfile,
    program: { version: text(program.version), summary: text(program.summary), minimum_version: text(program.minimum_version) },
    last_session: { date: text(last_session.date), summary: text(last_session.summary) },
    next_session: text(next_session), pending_questions: pending_questions.filter(v => typeof v === 'string').map(text).slice(0, 10) };
  snapshot.checkpoint_id = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return snapshot;
}
function assessResume(snapshot, { current_checkpoint_id, now = Date.now(), state_confirmed = false } = {}) {
  if (!snapshot || snapshot.schema_version !== '1.0') return { status: 'invalid', next: 'request_training_summary' };
  const { checkpoint_id, ...data } = snapshot;
  const expected = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  if (checkpoint_id !== expected || !Number.isFinite(Date.parse(snapshot.valid_until))) return { status: 'invalid', next: 'review_edited_summary' };
  if (current_checkpoint_id && current_checkpoint_id !== checkpoint_id) return { status: 'conflict', next: 'choose_current_plan_do_not_merge_silently' };
  if (Date.parse(snapshot.valid_until) < now) return { status: 'stale', next: 'confirm_goal_schedule_and_current_symptoms' };
  return { status: state_confirmed ? 'ready' : 'confirm_current_state', next: state_confirmed ? 'continue_next_session' : 'confirm_current_symptoms_time_and_equipment' };
}
function saveCheckpoint(directory, snapshot, { consent = false } = {}) {
  if (!consent || snapshot.profile?.persisted !== true) throw new Error('Explicit persistence consent required');
  if (assessResume(snapshot).status === 'invalid') throw new Error('Invalid checkpoint');
  fs.mkdirSync(directory, { recursive: true });
  const filename = 'TRAINING_CHECKPOINT-' + snapshot.checkpoint_id + '.json';
  const target = path.join(directory, filename);
  try { fs.writeFileSync(target, JSON.stringify(snapshot, null, 2), { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; if (fs.readFileSync(target, 'utf8') !== JSON.stringify(snapshot, null, 2)) throw new Error('Checkpoint conflict'); }
  const pointer = path.join(directory, 'CURRENT_TRAINING.json');
  const temporary = pointer + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify({ checkpoint_id: snapshot.checkpoint_id, file: filename, updated_at: snapshot.updated_at }));
  fs.renameSync(temporary, pointer);
  return { snapshot_path: target, current_pointer: pointer, persisted: true };
}
module.exports = { createCheckpoint, assessResume, saveCheckpoint };
