import { describe, it, expect } from 'vitest';
import {
  computeManifestSignature,
  validateReleaseCandidateManifest,
  ReleaseCandidateManifest,
} from '../../contracts/commands';

describe('SERP-025: Release Candidate & Evidence Manifest Contract', () => {
  const baseValidManifest: ReleaseCandidateManifest = {
    manifestVersion: '1.0',
    releaseCandidateId: 'RC-STARQ-V1-EFFC531',
    gitCommitHead: 'effc531e79fcde5a29ed9adc645bb24aac9cdc63',
    environment: 'production',
    generatedAt: '2026-08-26T22:30:00Z',
    generatedBy: 'Codex & Antigravity (SERP-025)',
    artifacts: [
      {
        path: 'supabase/migrations/202608200001_core_foundation.sql',
        sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
        byteLength: 4200,
      },
      {
        path: 'contracts/commands.ts',
        sha256: 'f1e2d3c4b5a60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
        byteLength: 95000,
      },
    ],
    testEvidence: [
      {
        suite: 'Deno Contract Negative Conformance',
        total: 112,
        passed: 112,
        failed: 0,
        passedAt: '2026-08-26T22:30:00Z',
      },
      {
        suite: 'Web Vitest Component & Workflow Suite',
        total: 58,
        passed: 58,
        failed: 0,
        passedAt: '2026-08-26T22:30:00Z',
      },
    ],
    securityGates: {
      tenantHardcodingViolations: 0,
      privilegedPathsInventoried: true,
      privacyTelemetryCompliant: true,
      migration0011Gated: true,
      migration0021Rehearsed: true,
    },
    manifestSignature: '',
  };

  it('validates a compliant immutable release candidate manifest', () => {
    const sig = computeManifestSignature(baseValidManifest);
    const manifest = { ...baseValidManifest, manifestSignature: sig };

    const res = validateReleaseCandidateManifest(manifest);
    expect(res.valid).toBe(true);
    expect(res.manifest?.manifestVersion).toBe('1.0');
    expect(res.manifest?.releaseCandidateId).toBe('RC-STARQ-V1-EFFC531');
  });

  it('fails closed when any test suite contains failures', () => {
    const failedSuiteManifest = {
      ...baseValidManifest,
      testEvidence: [
        {
          suite: 'Deno Contract Negative Conformance',
          total: 112,
          passed: 110,
          failed: 2,
          passedAt: '2026-08-26T22:30:00Z',
        },
      ],
    };
    failedSuiteManifest.manifestSignature = computeManifestSignature(failedSuiteManifest);

    const res = validateReleaseCandidateManifest(failedSuiteManifest);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('failed_test_suite_detected');
  });

  it('fails closed when tenant hardcoding violations exist', () => {
    const hardcodedManifest = {
      ...baseValidManifest,
      securityGates: {
        ...baseValidManifest.securityGates,
        tenantHardcodingViolations: 1,
      },
    };
    hardcodedManifest.manifestSignature = computeManifestSignature(hardcodedManifest);

    const res = validateReleaseCandidateManifest(hardcodedManifest);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('tenant_hardcoding_violations_detected');
  });

  it('fails closed on signature tampering or modified artifact hashes', () => {
    const sig = computeManifestSignature(baseValidManifest);
    const tamperedManifest = {
      ...baseValidManifest,
      manifestSignature: sig,
      gitCommitHead: '0000000000000000000000000000000000000000', // modified!
    };

    const res = validateReleaseCandidateManifest(tamperedManifest);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('manifest_signature_mismatch');
  });
});
