/**
 * 飞书消息卡片通知模块
 * 
 * 提供:
 * - 金属价格预警卡片
 * - 核算完成通知卡片
 * - 通用消息发送 (文本/卡片)
 * 
 * 使用飞书 im/v1/messages API
 */

import { feishuApiCall } from './feishuApi';
import { isFeishuConfigured } from './feishuAuth';

/** Message target type */
export type ReceiveIdType = 'open_id' | 'user_id' | 'union_id' | 'email' | 'chat_id';

/**
 * Send a text message
 */
export async function sendTextMessage(
  receiveId: string,
  text: string,
  receiveIdType: ReceiveIdType = 'open_id'
): Promise<string> {
  if (!isFeishuConfigured()) throw new Error('飞书未配置');

  const result = await feishuApiCall<{ message_id: string }>(
    `/im/v1/messages?receive_id_type=${receiveIdType}`,
    {
      method: 'POST',
      body: {
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
    }
  );

  return result.message_id;
}

/**
 * Send an interactive card message
 */
export async function sendCardMessage(
  receiveId: string,
  card: Record<string, any>,
  receiveIdType: ReceiveIdType = 'open_id'
): Promise<string> {
  if (!isFeishuConfigured()) throw new Error('飞书未配置');

  const result = await feishuApiCall<{ message_id: string }>(
    `/im/v1/messages?receive_id_type=${receiveIdType}`,
    {
      method: 'POST',
      body: {
        receive_id: receiveId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      },
    }
  );

  return result.message_id;
}

// ── Card Templates ──

/**
 * Build a metal price alert card
 * Sent when copper or aluminum price changes exceed threshold
 */
export function buildMetalPriceAlertCard(params: {
  projectName: string;
  copperPrice: number;
  copperChange: number;    // percentage change
  aluminumPrice: number;
  aluminumChange: number;  // percentage change
  impactAmount: number;    // estimated cost impact in CNY
  alertLevel: 'info' | 'warning' | 'danger';
  detailUrl?: string;
}): Record<string, any> {
  const {
    projectName, copperPrice, copperChange, aluminumPrice, aluminumChange,
    impactAmount, alertLevel, detailUrl,
  } = params;

  const colorMap = {
    info: 'blue',
    warning: 'orange',
    danger: 'red',
  };

  const levelText = {
    info: '信息',
    warning: '预警',
    danger: '警告',
  };

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `金属价格${levelText[alertLevel]} — ${projectName}` },
      template: colorMap[alertLevel],
    },
    elements: [
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**铜价**\n¥${copperPrice.toFixed(2)}/kg (${copperChange >= 0 ? '+' : ''}${copperChange.toFixed(1)}%)` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**铝价**\n¥${aluminumPrice.toFixed(2)}/kg (${aluminumChange >= 0 ? '+' : ''}${aluminumChange.toFixed(1)}%)` },
          },
        ],
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**预估成本影响**: ¥${Math.abs(impactAmount).toFixed(2)} (${impactAmount >= 0 ? '成本上升' : '成本下降'})`,
        },
      },
      ...(detailUrl ? [{
        tag: 'action',
        actions: [{
          tag: 'button',
          text: { tag: 'plain_text', content: '查看详情' },
          url: detailUrl,
          type: 'primary',
        }],
      }] : []),
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: `数据来源: SHFE参考价 | ${new Date().toLocaleString('zh-CN')}` },
        ],
      },
    ],
  };
}

/**
 * Build a cost calculation completion card
 * Sent when batch cost calculation finishes
 */
export function buildCalcCompleteCard(params: {
  projectName: string;
  harnessCount: number;
  totalMaterialCost: number;
  totalPrice: number;
  profitRate: number;       // as percentage
  calculatedBy: string;
  detailUrl?: string;
}): Record<string, any> {
  const { projectName, harnessCount, totalMaterialCost, totalPrice, profitRate, calculatedBy, detailUrl } = params;

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `核算完成 — ${projectName}` },
      template: 'green',
    },
    elements: [
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**线束数量**\n${harnessCount} 项` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**核算人员**\n${calculatedBy}` },
          },
        ],
      },
      { tag: 'hr' },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**材料总成本**\n¥${totalMaterialCost.toFixed(2)}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**报价总额**\n¥${totalPrice.toFixed(2)}` },
          },
        ],
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**利润率**: ${profitRate.toFixed(2)}%`,
        },
      },
      ...(detailUrl ? [{
        tag: 'action',
        actions: [{
          tag: 'button',
          text: { tag: 'plain_text', content: '查看详情' },
          url: detailUrl,
          type: 'primary',
        }],
      }] : []),
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: `计算时间: ${new Date().toLocaleString('zh-CN')}` },
        ],
      },
    ],
  };
}

/**
 * Check metal price changes and send alert if threshold exceeded
 */
export async function checkAndAlertMetalPrice(params: {
  projectName: string;
  baseCopperPrice: number;
  baseAluminumPrice: number;
  currentCopperPrice: number;
  currentAluminumPrice: number;
  estimatedCostImpact: number;
  alertThresholdPercent: number; // e.g. 5 for 5%
  notifyTarget: string;         // open_id or chat_id
  notifyType?: ReceiveIdType;
  detailUrl?: string;
}): Promise<{ alerted: boolean; messageId?: string }> {
  const {
    projectName, baseCopperPrice, baseAluminumPrice,
    currentCopperPrice, currentAluminumPrice,
    estimatedCostImpact, alertThresholdPercent,
    notifyTarget, notifyType = 'open_id', detailUrl,
  } = params;

  const copperChange = baseCopperPrice > 0 ? ((currentCopperPrice - baseCopperPrice) / baseCopperPrice) * 100 : 0;
  const aluminumChange = baseAluminumPrice > 0 ? ((currentAluminumPrice - baseAluminumPrice) / baseAluminumPrice) * 100 : 0;

  const maxChange = Math.max(Math.abs(copperChange), Math.abs(aluminumChange));

  if (maxChange < alertThresholdPercent) {
    return { alerted: false };
  }

  let alertLevel: 'info' | 'warning' | 'danger' = 'info';
  if (maxChange >= alertThresholdPercent * 2) alertLevel = 'danger';
  else if (maxChange >= alertThresholdPercent) alertLevel = 'warning';

  const card = buildMetalPriceAlertCard({
    projectName,
    copperPrice: currentCopperPrice,
    copperChange,
    aluminumPrice: currentAluminumPrice,
    aluminumChange,
    impactAmount: estimatedCostImpact,
    alertLevel,
    detailUrl,
  });

  const messageId = await sendCardMessage(notifyTarget, card, notifyType);
  return { alerted: true, messageId };
}
