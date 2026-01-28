/**
 * MiniMax API 服务层（使用 Anthropic SDK 兼容模式）
 * 参考: https://platform.minimaxi.com/docs/guides/text-generation
 */

import Anthropic from "@anthropic-ai/sdk";

// MiniMax 使用 Anthropic API 兼容模式 - 延迟初始化以确保环境变量已加载
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      throw new Error("MINIMAX_API_KEY 未设置，请检查 .env.local 文件");
    }
    _client = new Anthropic({
      baseURL: "https://api.minimaxi.com/anthropic",
      apiKey,
    });
  }
  return _client;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

// 地图助手工具定义
export const mapAssistantTools: ToolDefinition[] = [
  {
    name: "geocode",
    description: "将地址转换为坐标并在地图上标记位置。当用户只提供单个地点想查看位置时使用此工具。",
    input_schema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "要标记的地址，如 '深圳湾科技园'、'龙华大浪'、'北京天安门'",
        },
        city: {
          type: "string",
          description: "城市名称，如 '深圳'，用于提高地址解析准确性（可选）",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "plan_driving_route",
    description: "规划驾车路线，支持途经点。返回路线距离、时长、路线坐标等信息。",
    input_schema: {
      type: "object",
      properties: {
        origin: {
          type: "string",
          description: "起点地址，如 '南山区深圳湾科技园'",
        },
        destination: {
          type: "string",
          description: "终点地址，如 '龙华区大浪街道'",
        },
        waypoints: {
          type: "string",
          description: "途经点地址，多个用逗号分隔，如 '宝安区沙井,福永'",
        },
      },
      required: ["origin", "destination"],
    },
  },
  {
    name: "search_poi_along_route",
    description: "沿路线搜索 POI（餐厅、加油站等），按评分排序返回推荐结果。",
    input_schema: {
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description: "搜索关键词，如 '西餐厅'、'加油站'、'咖啡厅'",
        },
        category: {
          type: "string",
          description: "POI 类别：restaurant（餐厅）、gas_station（加油站）、cafe（咖啡厅）、hotel（酒店）",
          enum: ["restaurant", "western_restaurant", "chinese_restaurant", "gas_station", "cafe", "hotel", "mall"],
        },
      },
      required: ["keywords"],
    },
  },
];

// 系统提示词
export const MAP_ASSISTANT_SYSTEM_PROMPT = `你是一个专业的中国地图助手，帮助用户规划出行路线和推荐沿途的好去处。支持全国所有城市。

你的能力：
1. 地址解析：将地名转换为精确坐标，并在地图上标记位置
2. 路线规划：规划驾车路线，支持途经点
3. POI 搜索：沿途搜索餐厅、加油站等，并按评分推荐

使用说明：
- **查看位置**：当用户只提供单个地点名称时（如"大浪"、"深圳湾"），调用 geocode 在地图上标记该位置
- **路线规划**：当用户提供起点、终点时，调用 plan_driving_route 规划路线
- 地址中应包含城市名称，如"北京西站"、"上海外滩"、"深圳南山科技园"
- 如果用户需要途经某地，将途经点加入 waypoints 参数
- 规划路线后，如果用户需要推荐餐厅或其他服务，调用 search_poi_along_route
- 回复时提供清晰的行程建议，包括距离、预计时间、推荐地点等

注意：
- 支持全国所有城市，跨城市路线也可以规划
- 调用 geocode 或路线规划后，位置/路线会自动在地图上显示
- 推荐餐厅时，优先推荐评分高的
- 使用中文回复
- 回复使用 Markdown 格式，便于阅读`;

export interface ChatResponse {
  content: string;
  toolCalls?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  }[];
  stopReason: string;
}

export async function chat(
  messages: Message[],
  tools?: ToolDefinition[]
): Promise<Anthropic.Message> {
  const anthropicMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const response = await getClient().messages.create({
    model: "MiniMax-M2.1",
    max_tokens: 4096,
    system: MAP_ASSISTANT_SYSTEM_PROMPT,
    messages: anthropicMessages,
    tools: tools as Anthropic.Tool[],
  });

  return response;
}

export async function chatWithToolLoop(
  userMessages: Message[],
  executeToolCall: (name: string, input: Record<string, unknown>) => Promise<unknown>
): Promise<{ content: string; mapData: Record<string, unknown> }> {
  const messages: Anthropic.MessageParam[] = userMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let mapData: Record<string, unknown> = {};
  const maxIterations = 5;

  for (let i = 0; i < maxIterations; i++) {
    const response = await getClient().messages.create({
      model: "MiniMax-M2.1",
      max_tokens: 4096,
      system: MAP_ASSISTANT_SYSTEM_PROMPT,
      messages,
      tools: mapAssistantTools as Anthropic.Tool[],
    });

    // 检查是否有工具调用
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
      // 没有工具调用，提取文本响应
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      const content = textBlocks.map((b) => b.text).join("\n");
      return { content, mapData };
    }

    // 处理工具调用
    messages.push({
      role: "assistant",
      content: response.content,
    });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      try {
        const result = await executeToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );

        // 收集 mapData
        if (typeof result === "object" && result !== null) {
          const resultObj = result as Record<string, unknown>;
          if (resultObj.mapData) {
            mapData = { ...mapData, ...(resultObj.mapData as Record<string, unknown>) };
          }
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(
            typeof result === "object" && result !== null && "result" in result
              ? (result as Record<string, unknown>).result
              : result
          ),
        });
      } catch (error) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `错误: ${error instanceof Error ? error.message : "工具执行失败"}`,
          is_error: true,
        });
      }
    }

    messages.push({
      role: "user",
      content: toolResults,
    });
  }

  return { content: "抱歉，处理超时，请重试。", mapData };
}
