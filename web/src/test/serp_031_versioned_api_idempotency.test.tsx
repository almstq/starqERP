import { describe, it, expect } from 'vitest';
import {
  buildVersionedRequestEnvelope,
  dispatchVersionedApiCommand,
} from '../services/apiGateway';
import { Principal } from '../../../contracts/commands';

describe('SERP-031: Versioned API, Error & Idempotency Gateway', () => {
  const ORG = '20000000-0000-4000-8000-000000000001';
  const principal: Principal = {
    personId: 'usr-counter-1',
    organisationId: ORG,
    actingSeat: 'counter',
    heldSeats: ['counter'],
    seatVerifiedAt: new Date().toISOString(),
  };

  it('builds standard v1 request envelope with request ID and idempotency key', () => {
    const env = buildVersionedRequestEnvelope({
      command: 'CALL',
      payload: { customerPhone: '7770000' },
      idempotencyKey: 'idemp-test-01',
    });

    expect(env.version).toBe('v1');
    expect(env.command).toBe('CALL');
    expect(env.idempotencyKey).toBe('idemp-test-01');
    expect(env.requestId).toMatch(/^req_/);
  });

  it('dispatches command and returns applied response', () => {
    const env = buildVersionedRequestEnvelope({
      command: 'CALL',
      payload: { customerPhone: '7771111' },
      idempotencyKey: 'idemp-apply-1',
    });

    const res = dispatchVersionedApiCommand({
      request: env,
      principal,
      handler: (p) => ({ ok: true, data: { created: true, phone: (p as any).customerPhone } }),
    });

    expect(res.ok).toBe(true);
    expect(res.disposition).toBe('applied');
    expect(res.data).toEqual({ created: true, phone: '7771111' });
  });

  it('replays same cached response when exact same key and payload is dispatched', () => {
    const env = buildVersionedRequestEnvelope({
      command: 'CALL',
      payload: { customerPhone: '7772222' },
      idempotencyKey: 'idemp-replay-target',
    });

    let executions = 0;
    const handler = () => {
      executions++;
      return { ok: true, data: { count: executions } };
    };

    const first = dispatchVersionedApiCommand({ request: env, principal, handler });
    expect(first.disposition).toBe('applied');
    expect(executions).toBe(1);

    const second = dispatchVersionedApiCommand({ request: env, principal, handler });
    expect(second.disposition).toBe('replayed');
    expect(executions).toBe(1); // Not executed twice
  });

  it('detects and rejects idempotency key conflicts when payload is changed', () => {
    const env1 = buildVersionedRequestEnvelope({
      command: 'CALL',
      payload: { customerPhone: '7773333' },
      idempotencyKey: 'idemp-conflict-target',
    });

    const env2 = buildVersionedRequestEnvelope({
      command: 'CALL',
      payload: { customerPhone: '9994444' }, // altered payload
      idempotencyKey: 'idemp-conflict-target', // reuse same key
    });

    dispatchVersionedApiCommand({ request: env1, principal, handler: () => ({ ok: true, data: {} }) });

    const conflict = dispatchVersionedApiCommand({ request: env2, principal, handler: () => ({ ok: true, data: {} }) });
    expect(conflict.ok).toBe(false);
    expect(conflict.disposition).toBe('rejected');
    expect(conflict.error?.code).toBe('idempotency_key_conflict');
  });
});
