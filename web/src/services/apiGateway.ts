import {
  ApiRequestEnvelope,
  ApiResponseEnvelope,
  CommandName,
  ScmStep,
  executeVersionedApiCommand,
  Principal,
  DurableIdempotencyEntry,
} from '../../../contracts/commands';

// In-memory durable idempotency simulation for client-side API gateway bridge
const clientSideIdempotencyStore = new Map<string, DurableIdempotencyEntry>();

export function generateIdempotencyKey(prefix = 'idemp'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function buildVersionedRequestEnvelope<T>(params: {
  command: CommandName;
  step?: ScmStep;
  payload: T;
  idempotencyKey?: string;
  version?: string;
}): ApiRequestEnvelope<T> {
  return {
    version: params.version || 'v1',
    requestId: generateRequestId(),
    idempotencyKey: params.idempotencyKey || generateIdempotencyKey(),
    command: params.command,
    step: params.step,
    payload: params.payload,
    clientTimestamp: new Date().toISOString(),
  };
}

export function dispatchVersionedApiCommand<TReq = Record<string, unknown>, TRes = unknown>(params: {
  request: ApiRequestEnvelope<TReq>;
  principal: Principal;
  handler: (payload: TReq, principal: Principal) => { ok: boolean; data?: TRes; error?: { code: any; message: string } };
}): ApiResponseEnvelope<TRes> {
  return executeVersionedApiCommand<TReq, TRes>({
    request: params.request,
    principal: params.principal,
    idempotencyStore: clientSideIdempotencyStore,
    handler: params.handler,
  });
}
