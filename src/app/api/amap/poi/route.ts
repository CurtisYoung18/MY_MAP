import { NextRequest, NextResponse } from "next/server";
import { searchPOIAround, searchPOIAlongRoute } from "@/lib/amap";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const keywords = searchParams.get("keywords");
  const lng = searchParams.get("lng");
  const lat = searchParams.get("lat");
  const radius = searchParams.get("radius");
  const types = searchParams.get("types") || undefined;

  if (!keywords) {
    return NextResponse.json(
      { error: "请提供搜索关键词 (keywords)" },
      { status: 400 }
    );
  }

  if (!lng || !lat) {
    return NextResponse.json(
      { error: "请提供中心点坐标 (lng, lat)" },
      { status: 400 }
    );
  }

  try {
    const result = await searchPOIAround(
      [parseFloat(lng), parseFloat(lat)],
      keywords,
      {
        radius: radius ? parseInt(radius, 10) : 3000,
        types,
        isWgs84: true,
      }
    );

    return NextResponse.json({ pois: result, count: result.length });
  } catch (error) {
    console.error("POI API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "POI 搜索失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coordinates, keywords, radius, types, maxResults } = body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return NextResponse.json(
        { error: "请提供有效的路线坐标数组 (coordinates)" },
        { status: 400 }
      );
    }

    if (!keywords) {
      return NextResponse.json(
        { error: "请提供搜索关键词 (keywords)" },
        { status: 400 }
      );
    }

    const result = await searchPOIAlongRoute(coordinates, keywords, {
      radius: radius || 2000,
      types,
      maxResults: maxResults || 10,
    });

    return NextResponse.json({ pois: result, count: result.length });
  } catch (error) {
    console.error("POI along route API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "沿途 POI 搜索失败" },
      { status: 500 }
    );
  }
}
