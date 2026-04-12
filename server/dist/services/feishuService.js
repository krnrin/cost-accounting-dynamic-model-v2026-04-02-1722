import { config } from '../config.js';
/** 飞书集成服务 — 骨架代码，待飞书应用审批后实装 */
export class FeishuService {
    /** 检查飞书是否已配置 */
    static isConfigured() {
        return !!(config.FEISHU_APP_ID && config.FEISHU_APP_SECRET);
    }
    /** 飞书 SSO: 用授权码换取用户信息 */
    static async exchangeCode(code) {
        if (!this.isConfigured())
            throw new Error('飞书应用未配置');
        // TODO: 调用飞书 authen/v1/oidc/access_token
        throw new Error('飞书 SSO 尚未实装');
    }
    /** 发送审批实例 */
    static async createApproval(params) {
        if (!this.isConfigured())
            throw new Error('飞书应用未配置');
        // TODO: 调用飞书审批 v4 API
        throw new Error('飞书审批尚未实装');
    }
    /** 发送消息卡片 */
    static async sendCard(params) {
        if (!this.isConfigured())
            throw new Error('飞书应用未配置');
        // TODO: 调用飞书 message v1 API
        throw new Error('飞书消息卡片尚未实装');
    }
    /** 处理事件订阅回调 */
    static async handleEvent(body) {
        // 处理 url_verification 类型的挑战请求
        if (body.type === 'url_verification') {
            return { challenge: body.challenge };
        }
        // TODO: 处理审批状态变更等事件
        return {};
    }
}
