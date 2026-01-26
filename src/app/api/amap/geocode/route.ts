import { NextRequest, NextResponse } from "next/server";
import { geocode, reverseGeocode } from "@/lib/amap";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");
  const lng = searchParams.get("lng");
  const lat = searchParams.get("lat");
  const city = searchParams.get("city") || undefined;

  try {
    // 逆地理编码：坐标转地址
    if (lng && lat) {
      const result = await reverseGeocode(parseFloat(lng), parseFloat(lat));
      if (!result) {
        return NextResponse.json(
          { error: "无法获取该位置的地址信息" },
          { status: 404 }
        );
      }
      return NextResponse.json({ address: result });
    }

    // 地理编码：地址转坐标
    if (address) {
      const result = await geocode(address, city);
      if (!result) {
        return NextResponse.json(
          { error: "无法解析该地址" },
          { status: 404 }
        );
      }
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "请提供 address 参数或 lng/lat 参数" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Geocode API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "地理编码失败" },
      { status: 500 }
    );
  }
}
