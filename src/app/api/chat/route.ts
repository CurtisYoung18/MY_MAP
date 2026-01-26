import { NextRequest, NextResponse } from "next/server";
import { chatWithToolLoop, type Message } from "@/lib/minimax";
import {
  geocode,
  planDrivingRoute,
  searchPOIAlongRoute,
  POI_TYPES,
  type RouteResult,
  type POIResult,
} from "@/lib/amap";

// 存储当前会话的路线数据（简单实现，生产环境应使用数据库或 Redis）
let currentRoute: RouteResult | null = null;

// 执行工具调用
async function executeToolCall(
  name: string,
  input: Record<string, unknown>
): Promise<{ result: unknown; mapData?: { route?: RouteResult; pois?: POIResult[] } }> {
  switch (name) {
    case "geocode": {
      const result = await geocode(
        input.address as string,
        input.city as string | undefined
      );
      return { result };
    }

    case "plan_driving_route": {
      const waypoints = input.waypoints
        ? (input.waypoints as string).split(",").map((w: string) => w.trim())
        : undefined;

      const route = await planDrivingRoute(
        input.origin as string,
        input.destination as string,
        waypoints
      );

      if (route) {
        currentRoute = route;
        return {
          result: {
            success: true,
            distance: `${(route.distance / 1000).toFixed(1)} 公里`,
            duration: `${Math.round(route.duration / 60)} 分钟`,
            tolls: route.tolls > 0 ? `${route.tolls} 元` : "无过路费",
            steps_count: route.steps.length,
          },
          mapData: { route },
        };
      }
      return { result: { success: false, error: "路线规划失败" } };
    }

    case "search_poi_along_route": {
      if (!currentRoute) {
        return { result: { error: "请先规划路线" } };
      }

      // 根据 category 获取 POI 类型
      let types: string | undefined;
      switch (input.category) {
        case "western_restaurant":
          types = POI_TYPES.WESTERN_RESTAURANT;
          break;
        case "chinese_restaurant":
          types = POI_TYPES.CHINESE_RESTAURANT;
          break;
        case "restaurant":
          types = POI_TYPES.RESTAURANT;
          break;
        case "gas_station":
          types = POI_TYPES.GAS_STATION;
          break;
        case "cafe":
          types = POI_TYPES.CAFE;
          break;
        case "hotel":
          types = POI_TYPES.HOTEL;
          break;
        case "mall":
          types = POI_TYPES.MALL;
          break;
      }

      const pois = await searchPOIAlongRoute(
        currentRoute.polyline,
        input.keywords as string,
        { types, maxResults: 5 }
      );

      const simplifiedPois = pois.map((poi) => ({
        name: poi.name,
        address: poi.address,
        rating: poi.rating || "暂无评分",
        cost: poi.cost ? `人均 ${poi.cost} 元` : "暂无价格",
        tel: poi.tel || "暂无电话",
      }));

      return {
        result: {
          count: pois.length,
          recommendations: simplifiedPois,
        },
        mapData: { pois },
      };
    }

    default:
      return { result: { error: `未知工具: ${name}` } };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages: userMessages } = body;

    if (!userMessages || !Array.isArray(userMessages)) {
      return NextResponse.json(
        { error: "请提供 messages 数组" },
        { status: 400 }
      );
    }

    // 转换消息格式
    const messages: Message[] = userMessages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 调用 AI 并处理工具调用
    const { content, mapData } = await chatWithToolLoop(messages, executeToolCall);

    return NextResponse.json({
      message: content,
      mapData,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "对话失败" },
      { status: 500 }
    );
  }
}
