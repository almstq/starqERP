import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../auth/secure_session_store.dart';
import 'transport.dart';

const String configuredApiBaseUrl = String.fromEnvironment(
  'STARQBOOKS_API_BASE_URL',
  defaultValue: '',
);

enum NetworkOutcome {
  success,
  offline,
  timeout,
  rejected,
  unknown,
}

class ApiResponse {
  final NetworkOutcome outcome;
  final int statusCode;
  final Map<String, dynamic> data;
  final String? error;

  ApiResponse({
    required this.outcome,
    required this.statusCode,
    required this.data,
    this.error,
  });

  bool get isSuccess => outcome == NetworkOutcome.success && data['ok'] == true;
}

String generateUuidV4() {
  final Random rng = Random.secure();
  final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}';
}

class ApiClient {
  final String baseUrl;
  final SecureSessionStore secureStore;
  String? sessionCookie;
  String? csrfToken;
  VoidCallback? onUnauthorized;

  // Idempotency key tracking: payload string -> UUID
  final Map<String, String> _idempotencyKeys = {};

  ApiClient({
    String? baseUrlOverride,
    SecureSessionStore? secureStore,
    this.onUnauthorized,
  })  : baseUrl = (baseUrlOverride != null && baseUrlOverride.isNotEmpty)
            ? baseUrlOverride
            : configuredApiBaseUrl,
        secureStore = secureStore ?? createSecureSessionStore() {
    if (baseUrl.isEmpty) {
      throw StateError(
        'STARQBOOKS_API_BASE_URL is not configured. '
        'Specify --dart-define=STARQBOOKS_API_BASE_URL=<url> when building or passing an explicit baseUrlOverride.',
      );
    }
  }

  Future<void> initSession() async {
    if (!kIsWeb) {
      sessionCookie = await secureStore.readSessionCookie();
    }
  }

  Future<void> saveCookiesFromNative(http.Response response) async {
    if (kIsWeb) return; // Web uses browser-managed HttpOnly cookies with credentials
    final rawCookies = response.headers['set-cookie'];
    if (rawCookies != null && rawCookies.isNotEmpty) {
      final parts = rawCookies.split(',');
      for (var part in parts) {
        if (part.contains('sb_ops=')) {
          final cookiePair = part.split(';').first.trim();
          if (cookiePair.startsWith('sb_ops=')) {
            sessionCookie = cookiePair;
            await secureStore.saveSessionCookie(cookiePair);
          }
        }
      }
    }
  }

  Future<void> clearSession() async {
    sessionCookie = null;
    csrfToken = null;
    if (!kIsWeb) {
      await secureStore.clearSessionCookie();
    }
  }

  /// Which platform this client is, as the Edge names it.
  ///
  /// AUDIT CRITICAL #5 depends on this header and the client was not sending it.
  ///
  /// The Edge accepts exactly ONE Google audience per client kind, chosen by
  /// `x-starq-client-kind` (AUDIENCE_POLICIES in index.ts). `audienceIsValid`
  /// opens with `if (!clientKind) return no('audience_mismatch')`, so a MISSING
  /// header is not a lenient default — it is an outright refusal. Sign-in
  /// returned `identity_audience_rejected` on every platform until this existed.
  ///
  /// Unknown platforms deliberately return their real name rather than falling
  /// back to 'android'. There is no configured audience for them, so they must be
  /// refused either way, and being refused as 'ios' is debuggable while being
  /// refused as a wrong-but-plausible 'android' is not.
  String get _clientKind {
    if (kIsWeb) return 'web';
    if (defaultTargetPlatform == TargetPlatform.android) return 'android';
    return defaultTargetPlatform.name;
  }

  Map<String, String> _buildHeaders({String? idempotencyKey}) {
    final headers = <String, String>{
      'Content-Type': 'application/json; charset=utf-8',
      // Not advisory. The Edge selects the acceptable Google audience from this.
      'x-starq-client-kind': _clientKind,
    };

    if (!kIsWeb && sessionCookie != null && sessionCookie!.isNotEmpty) {
      headers['Cookie'] = sessionCookie!;
    }
    if (csrfToken != null && csrfToken!.isNotEmpty) {
      headers['X-CSRF-Token'] = csrfToken!;
    }
    if (idempotencyKey != null && idempotencyKey.isNotEmpty) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    return headers;
  }

  http.Client _createClient() {
    return createPlatformClient();
  }

  Future<Map<String, dynamic>> get(String path) async {
    final client = _createClient();
    try {
      final uri = Uri.parse('$baseUrl$path');
      final response = await client
          .get(uri, headers: _buildHeaders())
          .timeout(const Duration(seconds: 15));

      await saveCookiesFromNative(response);

      if (response.statusCode == 401) {
        await clearSession();
        onUnauthorized?.call();
        return {'ok': false, 'error': 'unauthenticated'};
      }

      final body = response.body;
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(body) as Map<String, dynamic>;
        if (data['user'] is Map && (data['user'] as Map)['csrf'] is String) {
          csrfToken = (data['user'] as Map)['csrf'] as String;
        }
        return data;
      } else {
        return {'ok': false, 'error': 'HTTP ${response.statusCode}: $body'};
      }
    } catch (e) {
      return {'ok': false, 'error': 'Network error: $e'};
    } finally {
      client.close();
    }
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> data) async {
    final client = _createClient();
    try {
      final uri = Uri.parse('$baseUrl$path');
      final payloadData = Map<String, dynamic>.from(data);
      if (csrfToken != null && !payloadData.containsKey('csrf')) {
        payloadData['csrf'] = csrfToken;
      }

      String? idempotencyKey;
      if (path.contains('/api/ops/event')) {
        final payloadString = jsonEncode(payloadData);
        idempotencyKey = _idempotencyKeys.putIfAbsent(payloadString, () => generateUuidV4());
      }

      final payload = jsonEncode(payloadData);
      final response = await client
          .post(uri, headers: _buildHeaders(idempotencyKey: idempotencyKey), body: payload)
          .timeout(const Duration(seconds: 15));

      await saveCookiesFromNative(response);

      if (response.statusCode == 401) {
        await clearSession();
        onUnauthorized?.call();
        return {'ok': false, 'error': 'unauthenticated'};
      }

      final body = response.body;
      final resData = jsonDecode(body) as Map<String, dynamic>;
      if (resData['user'] is Map && (resData['user'] as Map)['csrf'] is String) {
        csrfToken = (resData['user'] as Map)['csrf'] as String;
      }
      return resData;
    } catch (e) {
      return {'ok': false, 'error': 'Network error: $e'};
    } finally {
      client.close();
    }
  }
}
