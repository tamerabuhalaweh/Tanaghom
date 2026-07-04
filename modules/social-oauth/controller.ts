import { createHash, randomBytes } from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { AppError, ForbiddenError, UnauthorizedError } from '@shared/errors';
import { encryptSecret, secretFingerprint } from '@shared/crypto/secret-vault';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { getActiveIntegrationCredential } from '../integration-credentials/service';

export const socialOAuthRouter = Router();

const startSchema = z.object({
  platform: z.string().trim().min(1).max(80).regex(/^[a-z0-9._:-]+$/i),
  scopes: z.array(z.string().trim().min(1)).optional(),
});

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function requireConnectorAdmin(role: string): void {
  if (!['admin', 'cco', 'department_head', 'marketing_manager'].includes(role)) {
    throw new ForbiddenError('Connector setup access required for social account connections');
  }
}

socialOAuthRouter.get('/connections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireConnectorAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const connections = await prisma.socialAccountConnection.findMany({
      where: { tenant_key: tenantKey },
      orderBy: [{ platform: 'asc' }, { connected_at: 'desc' }],
    });
    res.json({
      tenantKey,
      connections: connections.map((connection) => ({
        id: connection.id,
        platform: connection.platform,
        accountId: connection.account_id,
        accountName: connection.account_name,
        scopes: connection.scopes,
        status: connection.status,
        accessTokenFingerprint: secretFingerprint(connection.encrypted_access_token),
        refreshTokenStatus: connection.encrypted_refresh_token ? 'configured' : 'missing',
        tokenExpiresAt: connection.token_expires_at,
        connectedAt: connection.connected_at,
        rawSecretsReturned: false,
      })),
    });
  } catch (err) {
    next(err);
  }
});

socialOAuthRouter.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireConnectorAdmin(payload.role);
    const input = startSchema.parse(req.body);
    const tenantKey = payload.tenantKey || 'default';
    const credential = await getActiveIntegrationCredential('social_oauth', 'oauth_client', tenantKey, input.platform);
    if (!credential) {
      throw new AppError(`OAuth client credential is missing for ${input.platform}`, 424, 'OAUTH_CLIENT_MISSING');
    }

    const clientId = requiredSecret(credential.secrets, 'clientId');
    const redirectUri = requiredSecret(credential.secrets, 'redirectUri');
    const authorizationUrl = requiredSecret(credential.secrets, 'authorizationUrl');
    requiredSecret(credential.secrets, 'clientSecret');
    requiredSecret(credential.secrets, 'tokenUrl');
    const scopes = input.scopes?.length ? input.scopes : parseScope(credential.secrets.scope);
    const state = randomBytes(32).toString('base64url');
    const stateHash = hashValue(state);
    const codeVerifier = randomBytes(32).toString('base64url');

    await prisma.oAuthConnectionState.create({
      data: {
        tenant_key: tenantKey,
        platform: input.platform,
        state_hash: stateHash,
        redirect_uri: redirectUri,
        requested_scopes: scopes,
        requester_user_id: payload.sub,
        code_verifier: codeVerifier,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const url = new URL(authorizationUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    if (scopes.length) url.searchParams.set('scope', scopes.join(' '));

    auditLog(
      { actor: `user:${payload.sub}`, action: 'social_oauth_started', object_type: 'social_oauth', object_id: input.platform, result: 'success' },
      `OAuth authorization started for ${input.platform}`,
    );

    res.json({
      platform: input.platform,
      authorizationUrl: url.toString(),
      expiresInSeconds: 600,
      rawSecretsReturned: false,
      _label: 'Open this authorization URL to connect the official social account.',
    });
  } catch (err) {
    next(err);
  }
});

socialOAuthRouter.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = z.string().min(1).parse(req.query.code);
    const state = z.string().min(16).parse(req.query.state);
    const stateHash = hashValue(state);
    const record = await prisma.oAuthConnectionState.findUnique({ where: { state_hash: stateHash } });
    if (!record || record.used_at || record.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedError('Invalid or expired OAuth state');
    }

    const credential = await getActiveIntegrationCredential('social_oauth', 'oauth_client', record.tenant_key, record.platform);
    if (!credential) throw new AppError(`OAuth client credential is missing for ${record.platform}`, 424, 'OAUTH_CLIENT_MISSING');

    const tokenPayload = await exchangeAuthorizationCode({
      code,
      redirectUri: record.redirect_uri,
      codeVerifier: record.code_verifier || undefined,
      secrets: credential.secrets,
    });
    const accessToken = requireString(tokenPayload.access_token, 'access_token');
    const refreshToken = typeof tokenPayload.refresh_token === 'string' ? tokenPayload.refresh_token : null;
    const scopes = parseTokenScopes(tokenPayload.scope, record.requested_scopes);
    const account = await resolveAccountIdentity(credential.secrets, accessToken, tokenPayload);
    const expiresAt = typeof tokenPayload.expires_in === 'number'
      ? new Date(Date.now() + tokenPayload.expires_in * 1000)
      : null;

    const connection = await prisma.$transaction(async (tx) => {
      await tx.oAuthConnectionState.update({
        where: { id: record.id },
        data: { used_at: new Date() },
      });
      return tx.socialAccountConnection.upsert({
        where: {
          tenant_key_platform_account_id: {
            tenant_key: record.tenant_key,
            platform: record.platform,
            account_id: account.accountId,
          },
        },
        create: {
          tenant_key: record.tenant_key,
          platform: record.platform,
          account_id: account.accountId,
          account_name: account.accountName,
          scopes,
          encrypted_access_token: encryptSecret(accessToken),
          encrypted_refresh_token: refreshToken ? encryptSecret(refreshToken) : null,
          token_expires_at: expiresAt,
          status: 'connected',
          connected_by_user_id: record.requester_user_id,
          metadata: { tokenType: tokenPayload.token_type || null, accountSource: account.source },
        },
        update: {
          account_name: account.accountName,
          scopes,
          encrypted_access_token: encryptSecret(accessToken),
          encrypted_refresh_token: refreshToken ? encryptSecret(refreshToken) : undefined,
          token_expires_at: expiresAt,
          status: 'connected',
          connected_by_user_id: record.requester_user_id,
          metadata: { tokenType: tokenPayload.token_type || null, accountSource: account.source },
        },
      });
    });

    auditLog(
      { actor: `user:${record.requester_user_id}`, action: 'social_oauth_connected', object_type: 'social_account', object_id: connection.id, result: 'success' },
      `Social OAuth connected for ${record.platform}/${account.accountId}`,
    );

    res.type('html').send(`<!doctype html><html><body><h1>Social account connected</h1><p>${escapeHtml(record.platform)} account ${escapeHtml(account.accountName || account.accountId)} is connected.</p></body></html>`);
  } catch (err) {
    next(err);
  }
});

async function exchangeAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  secrets: Record<string, string>;
}): Promise<Record<string, unknown>> {
  const tokenUrl = requiredSecret(input.secrets, 'tokenUrl');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: requiredSecret(input.secrets, 'clientId'),
    client_secret: requiredSecret(input.secrets, 'clientSecret'),
  });
  if (input.codeVerifier) body.set('code_verifier', input.codeVerifier);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(`OAuth token exchange failed with status ${response.status}`, 502, 'OAUTH_TOKEN_EXCHANGE_FAILED');
  }
  if (!payload || typeof payload !== 'object') {
    throw new AppError('OAuth token endpoint returned an invalid response', 502, 'OAUTH_TOKEN_RESPONSE_INVALID');
  }
  return payload as Record<string, unknown>;
}

async function resolveAccountIdentity(
  secrets: Record<string, string>,
  accessToken: string,
  tokenPayload: Record<string, unknown>,
): Promise<{ accountId: string; accountName: string | null; source: string }> {
  const directId = firstString(tokenPayload, ['account_id', 'user_id', 'id', 'sub']);
  if (directId) {
    return {
      accountId: directId,
      accountName: firstString(tokenPayload, ['account_name', 'name', 'username']) || null,
      source: 'token_response',
    };
  }

  const accountInfoUrl = secrets.accountInfoUrl;
  if (!accountInfoUrl) {
    throw new AppError('OAuth token response did not include an account id. Configure accountInfoUrl for this provider.', 424, 'OAUTH_ACCOUNT_ID_MISSING');
  }
  const response = await fetch(accountInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload || typeof payload !== 'object') {
    throw new AppError(`OAuth account info request failed with status ${response.status}`, 502, 'OAUTH_ACCOUNT_INFO_FAILED');
  }
  const accountId = firstString(payload as Record<string, unknown>, ['id', 'sub', 'account_id', 'user_id']);
  if (!accountId) {
    throw new AppError('OAuth account info response did not include id/sub/account_id/user_id.', 502, 'OAUTH_ACCOUNT_ID_MISSING');
  }
  return {
    accountId,
    accountName: firstString(payload as Record<string, unknown>, ['name', 'username', 'display_name']) || null,
    source: 'account_info_endpoint',
  };
}

function requiredSecret(secrets: Record<string, string>, key: string): string {
  const value = secrets[key];
  if (!value) throw new AppError(`OAuth credential field is missing: ${key}`, 424, 'OAUTH_CREDENTIAL_INCOMPLETE');
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`OAuth token response missing ${field}`, 502, 'OAUTH_TOKEN_RESPONSE_INVALID');
  }
  return value;
}

function parseScope(scope: string | undefined): string[] {
  return scope?.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean) || [];
}

function parseTokenScopes(scope: unknown, fallback: string[]): string[] {
  if (typeof scope === 'string') return parseScope(scope);
  if (Array.isArray(scope)) return scope.filter((item): item is string => typeof item === 'string');
  return fallback;
}

function firstString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] || char));
}
