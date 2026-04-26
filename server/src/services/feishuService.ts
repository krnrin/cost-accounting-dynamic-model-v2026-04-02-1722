import { config } from '../config.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

/** Cached tenant_access_token */
let cachedTenantToken: { token: string; expiresAt: number } | null = null;

interface FeishuTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

interface FeishuUserInfoResponse {
  code: number;
  msg: string;
  data?: {
    open_id: string;
    union_id: string;
    user_id: string;
    name: string;
    avatar_url: string;
    email: string;
    mobile: string;
  };
}

interface FeishuAccessTokenResponse {
  code: number;
  msg: string;
  data?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

/** 飞书集成服务 */
export class FeishuService {
  /** 检查飞书是否已配置 */
  static isConfigured(): boolean {
    return !!(config.FEISHU_APP_ID && config.FEISHU_APP_SECRET);
  }

  /**
   * [PR-031] 验证飞书 webhook 签名
   * @see https://open.feishu.cn/document/ukTMukTMukTM/uUTN4QjL2UDN24iNkwjN/event-subscription-configure-/encrypt-and-verify-the-request
   */
  static verifyLarkSignature(
    timestamp: string,
    nonce: string,
    body: string,
    signature: string
  ): boolean {
    if (!config.FEISHU_APP_SECRET) return false;

    // 拼接字符串: timestamp + nonce + body
    const content = timestamp + nonce + body;

    // 使用 HMAC-SHA256 计算签名
    const expectedSignature = crypto
      .createHmac('sha256', config.FEISHU_APP_SECRET)
      .update(content)
      .digest('hex');

    // 比较签名（使用时间安全比较防止时序攻击）
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /** Get tenant_access_token (app-level token for API calls) */
  private static async getTenantAccessToken(): Promise<string> {
    if (cachedTenantToken && Date.now() < cachedTenantToken.expiresAt - 300000) {
      return cachedTenantToken.token;
    }

    if (!config.FEISHU_APP_ID || !config.FEISHU_APP_SECRET) {
      throw new Error('飞书应用未配置');
    }

    const res = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: config.FEISHU_APP_ID,
        app_secret: config.FEISHU_APP_SECRET,
      }),
    });

    const data = (await res.json()) as FeishuTokenResponse;
    if (data.code !== 0) {
      throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
    }

    cachedTenantToken = {
      token: data.tenant_access_token!,
      expiresAt: Date.now() + (data.expire || 7200) * 1000,
    };

    return cachedTenantToken.token;
  }

  /** 飞书 SSO: 用授权码换取用户信息 */
  static async exchangeCode(code: string): Promise<{
    openId: string;
    unionId: string;
    name: string;
    email: string;
    avatarUrl: string;
  }> {
    if (!this.isConfigured()) throw new Error('飞书应用未配置');

    const tenantToken = await this.getTenantAccessToken();

    // Exchange code for access_token
    const tokenRes = await fetch(`${FEISHU_API_BASE}/authen/v1/oidc/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tenantToken}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as FeishuAccessTokenResponse;
    if (tokenData.code !== 0) {
      throw new Error(`获取 access_token 失败: ${tokenData.msg}`);
    }

    // Get user info with access_token
    const userRes = await fetch(`${FEISHU_API_BASE}/authen/v1/user_info`, {
      headers: {
        'Authorization': `Bearer ${tokenData.data!.access_token}`,
      },
    });

    const userData = (await userRes.json()) as FeishuUserInfoResponse;
    if (userData.code !== 0) {
      throw new Error(`获取用户信息失败: ${userData.msg}`);
    }

    const user = userData.data!;
    return {
      openId: user.open_id,
      unionId: user.union_id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
    };
  }

  /**
   * [PR-031] 飞书 SSO 登录：查找或创建用户，签发 JWT
   */
  static async loginWithFeishu(code: string): Promise<{
    user: { id: string; email: string; name: string; role: string; feishuId: string | null };
    token: string;
    isNewUser: boolean;
  }> {
    const userInfo = await this.exchangeCode(code);

    // 查找现有用户（通过 feishuId 或 email）
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { feishuId: userInfo.openId },
          { email: userInfo.email },
        ],
      },
    });

    let isNewUser = false;

    if (!user) {
      // 创建新用户
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name,
          feishuId: userInfo.openId,
          role: 'ENGINEER', // 默认角色
          password: '', // 飞书用户无密码
          tokenVersion: 0,
        },
      });
      isNewUser = true;
    } else if (!user.feishuId) {
      // 更新现有用户的 feishuId
      user = await prisma.user.update({
        where: { id: user.id },
        data: { feishuId: userInfo.openId },
      });
    }

    // 签发 JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        tokenVersion: user.tokenVersion,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        feishuId: user.feishuId,
      },
      token,
      isNewUser,
    };
  }

  /** 代理飞书 API 调用 */
  static async proxyApiCall(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<unknown> {
    const tenantToken = await this.getTenantAccessToken();

    const res = await fetch(`${FEISHU_API_BASE}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await res.json();
    if ((data as { code?: number }).code !== 0) {
      throw new Error(`飞书 API 调用失败 [${path}]: ${(data as { msg?: string }).msg}`);
    }

    return (data as { data?: unknown }).data;
  }

  /** 发送审批实例 */
  static async createApproval(params: {
    approvalCode: string;
    userId: string;
    formData: Record<string, unknown>;
  }): Promise<{ instanceCode: string }> {
    if (!this.isConfigured()) throw new Error('飞书应用未配置');

    const result = await this.proxyApiCall('/approval/v4/instances', {
      method: 'POST',
      body: {
        approval_code: params.approvalCode,
        user_id: params.userId,
        form: params.formData,
      },
    }) as { instance_code?: string };

    return { instanceCode: result.instance_code || '' };
  }

  /** 发送消息卡片 */
  static async sendCard(params: {
    receiveId: string;
    receiveType: 'open_id' | 'chat_id';
    cardContent: Record<string, unknown>;
  }): Promise<{ messageId: string }> {
    if (!this.isConfigured()) throw new Error('飞书应用未配置');

    const result = await this.proxyApiCall('/im/v1/messages', {
      method: 'POST',
      body: {
        receive_id: params.receiveId,
        receive_id_type: params.receiveType,
        msg_type: 'interactive',
        content: JSON.stringify(params.cardContent),
      },
    }) as { message_id?: string };

    return { messageId: result.message_id || '' };
  }

  /** 处理事件订阅回调 */
  static async handleEvent(body: Record<string, unknown>): Promise<{ challenge?: string }> {
    // 处理 url_verification 类型的挑战请求
    if (body.type === 'url_verification') {
      return { challenge: body.challenge as string };
    }
    // TODO: 处理审批状态变更等事件
    return {};
  }

  /** Clear cached tokens (for testing) */
  static clearTokenCache(): void {
    cachedTenantToken = null;
  }
}
