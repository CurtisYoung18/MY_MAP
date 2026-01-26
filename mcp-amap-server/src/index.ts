#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const AMAP_BASE_URL = "https://restapi.amap.com/v3";

if (!process.env.AMAP_API_KEY) {
  console.error("Error: AMAP_API_KEY environment variable is required");
  process.exit(1);
}

const AMAP_API_KEY = process.env.AMAP_API_KEY;

// GCJ-02 转 WGS-84 坐标转换
const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

function gcj02ToWgs84(lng: number, lat: number): [number, number] {
  const dlat = transformLat(lng - 105.0, lat - 35.0);
  const dlng = transformLng(lng - 105.0, lat - 35.0);
  const radlat = (lat / 180.0) * PI;
  let magic = Math.sin(radlat);
  magic = 1 - EE * magic * magic;
  const sqrtmagic = Math.sqrt(magic);
  const dlatFinal = (dlat * 180.0) / (((A * (1 - EE)) / (magic * sqrtmagic)) * PI);
  const dlngFinal = (dlng * 180.0) / ((A / sqrtmagic) * Math.cos(radlat) * PI);
  const mglat = lat + dlatFinal;
  const mglng = lng + dlngFinal;
  return [lng * 2 - mglng, lat * 2 - mglat];
}

function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  const dlat = transformLat(lng - 105.0, lat - 35.0);
  const dlng = transformLng(lng - 105.0, lat - 35.0);
  const radlat = (lat / 180.0) * PI;
  let magic = Math.sin(radlat);
  magic = 1 - EE * magic * magic;
  const sqrtmagic = Math.sqrt(magic);
  const dlatFinal = (dlat * 180.0) / (((A * (1 - EE)) / (magic * sqrtmagic)) * PI);
  const dlngFinal = (dlng * 180.0) / ((A / sqrtmagic) * Math.cos(radlat) * PI);
  return [lng + dlngFinal, lat + dlatFinal];
}

// 解析高德坐标字符串
function parseCoordinate(coord: string): [number, number] {
  const [lng, lat] = coord.split(",").map(Number);
  return [lng, lat];
}

// 解析路线 polyline
function parsePolyline(polyline: string): [number, number][] {
  return polyline.split(";").map((coord) => {
    const [lng, lat] = parseCoordinate(coord);
    return gcj02ToWgs84(lng, lat);
  });
}

// API 调用函数
async function geocode(address: string, city?: string) {
  const params = new URLSearchParams({
    key: AMAP_API_KEY,
    address,
    output: "json",
  });
  if (city) params.set("city", city);

  const response = await fetch(`${AMAP_BASE_URL}/geocode/geo?${params}`);
  const data = await response.json();

  if (data.status !== "1" || !data.geocodes?.length) {
    return null;
  }

  const result = data.geocodes[0];
  const [lng, lat] = parseCoordinate(result.location);
  const wgs84 = gcj02ToWgs84(lng, lat);

  return {
    formatted_address: result.formatted_address,
    location: wgs84,
    province: result.province,
    city: result.city || result.province,
    district: result.district,
  };
}

async function planDrivingRoute(
  origin: string,
  destination: string,
  waypoints?: string[]
) {
  // 解析起点
  const originGeo = await geocode(origin, "深圳");
  if (!originGeo) throw new Error(`无法解析起点: ${origin}`);

  // 解析终点
  const destGeo = await geocode(destination, "深圳");
  if (!destGeo) throw new Error(`无法解析终点: ${destination}`);

  // 解析途经点
  const waypointCoords: [number, number][] = [];
  if (waypoints?.length) {
    for (const wp of waypoints) {
      const wpGeo = await geocode(wp, "深圳");
      if (!wpGeo) throw new Error(`无法解析途经点: ${wp}`);
      waypointCoords.push(wgs84ToGcj02(wpGeo.location[0], wpGeo.location[1]));
    }
  }

  const originGcj = wgs84ToGcj02(originGeo.location[0], originGeo.location[1]);
  const destGcj = wgs84ToGcj02(destGeo.location[0], destGeo.location[1]);

  const params = new URLSearchParams({
    key: AMAP_API_KEY,
    origin: `${originGcj[0]},${originGcj[1]}`,
    destination: `${destGcj[0]},${destGcj[1]}`,
    extensions: "all",
    output: "json",
    strategy: "10",
  });

  if (waypointCoords.length > 0) {
    params.set("waypoints", waypointCoords.map((c) => `${c[0]},${c[1]}`).join(";"));
  }

  const response = await fetch(`${AMAP_BASE_URL}/direction/driving?${params}`);
  const data = await response.json();

  if (data.status !== "1" || !data.route?.paths?.length) {
    return null;
  }

  const path = data.route.paths[0];
  const allPolylines: [number, number][] = [];

  for (const step of path.steps) {
    allPolylines.push(...parsePolyline(step.polyline));
  }

  return {
    distance: `${(parseInt(path.distance, 10) / 1000).toFixed(1)} 公里`,
    duration: `${Math.round(parseInt(path.duration, 10) / 60)} 分钟`,
    tolls: parseFloat(path.tolls) > 0 ? `${path.tolls} 元` : "无过路费",
    origin: {
      address: originGeo.formatted_address,
      location: originGeo.location,
    },
    destination: {
      address: destGeo.formatted_address,
      location: destGeo.location,
    },
    polyline: allPolylines,
  };
}

async function searchPOI(center: [number, number], keywords: string, radius = 3000) {
  const gcj = wgs84ToGcj02(center[0], center[1]);

  const params = new URLSearchParams({
    key: AMAP_API_KEY,
    location: `${gcj[0]},${gcj[1]}`,
    keywords,
    radius: radius.toString(),
    offset: "10",
    sortrule: "weight",
    extensions: "all",
    output: "json",
  });

  const response = await fetch(`${AMAP_BASE_URL}/place/around?${params}`);
  const data = await response.json();

  if (data.status !== "1" || !data.pois?.length) {
    return [];
  }

  return data.pois.map((poi: Record<string, unknown>) => {
    const [lng, lat] = parseCoordinate(poi.location as string);
    const wgs84 = gcj02ToWgs84(lng, lat);
    const biz = poi.biz_ext as Record<string, unknown> | undefined;

    return {
      name: poi.name,
      type: poi.type,
      address: poi.address || "",
      location: wgs84,
      tel: poi.tel || "",
      rating: biz?.rating || "暂无评分",
      cost: biz?.cost ? `人均 ${biz.cost} 元` : "暂无价格",
    };
  });
}

// 创建 MCP Server
const server = new Server(
  {
    name: "mcp-amap-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "geocode",
        description: "将地址转换为坐标（地理编码），支持深圳及周边城市",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "要转换的地址，如 '深圳湾科技园'、'龙华大浪'",
            },
            city: {
              type: "string",
              description: "城市名称，默认为深圳",
            },
          },
          required: ["address"],
        },
      },
      {
        name: "plan_driving_route",
        description: "规划驾车路线，支持途经点，返回距离、时间、路线坐标",
        inputSchema: {
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
              type: "array",
              items: { type: "string" },
              description: "途经点地址列表，如 ['宝安区沙井', '福永']",
            },
          },
          required: ["origin", "destination"],
        },
      },
      {
        name: "search_poi",
        description: "搜索周边 POI（餐厅、加油站等），返回名称、评分、地址等信息",
        inputSchema: {
          type: "object",
          properties: {
            center: {
              type: "array",
              items: { type: "number" },
              description: "搜索中心点坐标 [经度, 纬度]，WGS-84 坐标系",
            },
            keywords: {
              type: "string",
              description: "搜索关键词，如 '西餐厅'、'加油站'",
            },
            radius: {
              type: "number",
              description: "搜索半径（米），默认 3000",
            },
          },
          required: ["center", "keywords"],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "geocode": {
        const result = await geocode(
          args?.address as string,
          (args?.city as string) || "深圳"
        );
        if (!result) {
          return { content: [{ type: "text", text: "无法解析该地址" }] };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "plan_driving_route": {
        const result = await planDrivingRoute(
          args?.origin as string,
          args?.destination as string,
          args?.waypoints as string[] | undefined
        );
        if (!result) {
          return { content: [{ type: "text", text: "路线规划失败" }] };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "search_poi": {
        const result = await searchPOI(
          args?.center as [number, number],
          args?.keywords as string,
          (args?.radius as number) || 3000
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        return { content: [{ type: "text", text: `未知工具: ${name}` }] };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "工具执行失败";
    return { content: [{ type: "text", text: `错误: ${message}` }] };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Amap Server started");
}

main().catch(console.error);
