/**
 * 高德地图 API 服务层
 * 封装路线规划、POI搜索、地理编码等功能
 */

const AMAP_BASE_URL = "https://restapi.amap.com/v3";

// GCJ-02 转 WGS-84 坐标转换
// 高德使用 GCJ-02，MapLibre 使用 WGS-84
const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function transformLat(x: number, y: number): number {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret +=
    ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) *
      2.0) /
    3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret +=
    ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) *
      2.0) /
    3.0;
  return ret;
}

export function gcj02ToWgs84(lng: number, lat: number): [number, number] {
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

export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
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

// 解析高德返回的坐标字符串 "lng,lat"
function parseCoordinate(coord: string): [number, number] {
  const [lng, lat] = coord.split(",").map(Number);
  return [lng, lat];
}

// 解析高德路线的 polyline 字符串
function parsePolyline(polyline: string): [number, number][] {
  return polyline.split(";").map((coord) => {
    const [lng, lat] = parseCoordinate(coord);
    return gcj02ToWgs84(lng, lat);
  });
}

// 类型定义
export interface GeocodeResult {
  formatted_address: string;
  location: [number, number]; // WGS-84
  locationGcj02: [number, number]; // GCJ-02 原始坐标
  province: string;
  city: string;
  district: string;
  adcode: string;
}

export interface RouteStep {
  instruction: string;
  road: string;
  distance: number; // 米
  duration: number; // 秒
  polyline: [number, number][]; // WGS-84
}

export interface RouteResult {
  distance: number; // 米
  duration: number; // 秒
  tolls: number; // 收费（元）
  polyline: [number, number][]; // 完整路线 WGS-84
  steps: RouteStep[];
  origin: [number, number];
  destination: [number, number];
  waypoints?: [number, number][];
}

export interface POIResult {
  id: string;
  name: string;
  type: string;
  typecode: string;
  address: string;
  location: [number, number]; // WGS-84
  locationGcj02: [number, number]; // GCJ-02
  tel: string;
  distance?: number; // 米（周边搜索时返回）
  rating?: string; // 评分
  cost?: string; // 人均消费
  photos?: string[]; // 图片URL
  businessArea?: string; // 商圈
  openingHours?: string; // 营业时间
}

// API 函数
function getApiKey(): string {
  const key = process.env.AMAP_API_KEY;
  if (!key) {
    throw new Error("AMAP_API_KEY environment variable is not set");
  }
  return key;
}

/**
 * 地理编码：地址转坐标
 */
export async function geocode(address: string, city?: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    key: getApiKey(),
    address,
    output: "json",
  });
  if (city) {
    params.set("city", city);
  }

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
    locationGcj02: [lng, lat],
    province: result.province,
    city: result.city || result.province,
    district: result.district,
    adcode: result.adcode,
  };
}

/**
 * 逆地理编码：坐标转地址
 */
export async function reverseGeocode(
  lng: number,
  lat: number,
  isWgs84 = true
): Promise<string | null> {
  // 如果是 WGS-84 坐标，先转换为 GCJ-02
  const [gcjLng, gcjLat] = isWgs84 ? wgs84ToGcj02(lng, lat) : [lng, lat];

  const params = new URLSearchParams({
    key: getApiKey(),
    location: `${gcjLng},${gcjLat}`,
    output: "json",
  });

  const response = await fetch(`${AMAP_BASE_URL}/geocode/regeo?${params}`);
  const data = await response.json();

  if (data.status !== "1" || !data.regeocode) {
    return null;
  }

  return data.regeocode.formatted_address;
}

/**
 * 驾车路线规划（支持全国城市）
 */
export async function planDrivingRoute(
  origin: string | [number, number],
  destination: string | [number, number],
  waypoints?: (string | [number, number])[]
): Promise<RouteResult | null> {
  // 处理起点（不指定城市，让高德自动识别）
  let originCoord: [number, number];
  if (typeof origin === "string") {
    const geo = await geocode(origin);
    if (!geo) throw new Error(`无法解析起点地址: ${origin}`);
    originCoord = geo.locationGcj02;
  } else {
    originCoord = wgs84ToGcj02(origin[0], origin[1]);
  }

  // 处理终点
  let destCoord: [number, number];
  if (typeof destination === "string") {
    const geo = await geocode(destination);
    if (!geo) throw new Error(`无法解析终点地址: ${destination}`);
    destCoord = geo.locationGcj02;
  } else {
    destCoord = wgs84ToGcj02(destination[0], destination[1]);
  }

  // 处理途经点
  let waypointCoords: [number, number][] = [];
  if (waypoints?.length) {
    waypointCoords = await Promise.all(
      waypoints.map(async (wp) => {
        if (typeof wp === "string") {
          const geo = await geocode(wp);
          if (!geo) throw new Error(`无法解析途经点地址: ${wp}`);
          return geo.locationGcj02;
        }
        return wgs84ToGcj02(wp[0], wp[1]);
      })
    );
  }

  const params = new URLSearchParams({
    key: getApiKey(),
    origin: `${originCoord[0]},${originCoord[1]}`,
    destination: `${destCoord[0]},${destCoord[1]}`,
    extensions: "all",
    output: "json",
    strategy: "10", // 躲避拥堵
  });

  if (waypointCoords.length > 0) {
    params.set(
      "waypoints",
      waypointCoords.map((c) => `${c[0]},${c[1]}`).join(";")
    );
  }

  const response = await fetch(`${AMAP_BASE_URL}/direction/driving?${params}`);
  const data = await response.json();

  if (data.status !== "1" || !data.route?.paths?.length) {
    console.error("Route planning failed:", data);
    return null;
  }

  const path = data.route.paths[0];
  const allPolylines: [number, number][] = [];
  const steps: RouteStep[] = [];

  for (const step of path.steps) {
    const stepPolyline = parsePolyline(step.polyline);
    allPolylines.push(...stepPolyline);
    steps.push({
      instruction: step.instruction,
      road: step.road || "",
      distance: parseInt(step.distance, 10),
      duration: parseInt(step.duration, 10),
      polyline: stepPolyline,
    });
  }

  return {
    distance: parseInt(path.distance, 10),
    duration: parseInt(path.duration, 10),
    tolls: parseFloat(path.tolls) || 0,
    polyline: allPolylines,
    steps,
    origin: gcj02ToWgs84(originCoord[0], originCoord[1]),
    destination: gcj02ToWgs84(destCoord[0], destCoord[1]),
    waypoints: waypointCoords.map((c) => gcj02ToWgs84(c[0], c[1])),
  };
}

/**
 * 周边 POI 搜索
 */
export async function searchPOIAround(
  center: [number, number],
  keywords: string,
  options: {
    radius?: number; // 搜索半径（米），默认 3000
    types?: string; // POI 类型编码
    offset?: number; // 每页数量，默认 20
    page?: number; // 页码
    sortRule?: "distance" | "weight"; // 排序规则
    isWgs84?: boolean; // 中心点是否为 WGS-84 坐标
  } = {}
): Promise<POIResult[]> {
  const {
    radius = 3000,
    types,
    offset = 20,
    page = 1,
    sortRule = "weight",
    isWgs84 = true,
  } = options;

  // 转换坐标
  const [gcjLng, gcjLat] = isWgs84
    ? wgs84ToGcj02(center[0], center[1])
    : center;

  const params = new URLSearchParams({
    key: getApiKey(),
    location: `${gcjLng},${gcjLat}`,
    keywords,
    radius: radius.toString(),
    offset: offset.toString(),
    page: page.toString(),
    sortrule: sortRule,
    extensions: "all",
    output: "json",
  });

  if (types) {
    params.set("types", types);
  }

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
      id: poi.id,
      name: poi.name,
      type: poi.type,
      typecode: poi.typecode,
      address: poi.address || "",
      location: wgs84,
      locationGcj02: [lng, lat],
      tel: poi.tel || "",
      distance: poi.distance ? parseInt(poi.distance as string, 10) : undefined,
      rating: biz?.rating as string | undefined,
      cost: biz?.cost as string | undefined,
      photos: (poi.photos as { url: string }[] | undefined)?.map((p) => p.url),
      businessArea: poi.business_area as string | undefined,
      openingHours: biz?.opentime as string | undefined,
    } as POIResult;
  });
}

/**
 * 沿途 POI 搜索
 * 在路线上多个点进行搜索，去重后返回结果
 */
export async function searchPOIAlongRoute(
  routeCoordinates: [number, number][],
  keywords: string,
  options: {
    radius?: number;
    types?: string;
    maxResults?: number;
  } = {}
): Promise<POIResult[]> {
  const { radius = 2000, types, maxResults = 10 } = options;

  // 沿路线选取采样点（每 10km 一个点，或至少 3 个点）
  const totalPoints = routeCoordinates.length;
  const step = Math.max(1, Math.floor(totalPoints / 5));
  const sampleIndices = [
    0,
    Math.floor(totalPoints * 0.25),
    Math.floor(totalPoints * 0.5),
    Math.floor(totalPoints * 0.75),
    totalPoints - 1,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const allPOIs: POIResult[] = [];
  const seenIds = new Set<string>();

  for (const idx of sampleIndices) {
    const center = routeCoordinates[idx];
    const pois = await searchPOIAround(center, keywords, {
      radius,
      types,
      offset: 10,
      isWgs84: true,
    });

    for (const poi of pois) {
      if (!seenIds.has(poi.id)) {
        seenIds.add(poi.id);
        allPOIs.push(poi);
      }
    }
  }

  // 按评分排序（如果有评分的话）
  allPOIs.sort((a, b) => {
    const ratingA = parseFloat(a.rating || "0");
    const ratingB = parseFloat(b.rating || "0");
    return ratingB - ratingA;
  });

  return allPOIs.slice(0, maxResults);
}

/**
 * POI 类型编码常量
 * 完整列表参考: https://lbs.amap.com/api/webservice/download
 */
export const POI_TYPES = {
  // 餐饮
  RESTAURANT: "050000",
  CHINESE_RESTAURANT: "050100",
  WESTERN_RESTAURANT: "050200",
  FAST_FOOD: "050300",
  CAFE: "050500",
  
  // 购物
  SHOPPING: "060000",
  MALL: "060100",
  SUPERMARKET: "060400",
  
  // 生活服务
  GAS_STATION: "010100",
  PARKING: "150900",
  CHARGING_STATION: "011100",
  
  // 住宿
  HOTEL: "100000",
  
  // 景点
  SCENIC: "110000",
};
