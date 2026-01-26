import { NextRequest, NextResponse } from "next/server";
import { planDrivingRoute } from "@/lib/amap";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, destination, waypoints } = body;

    if (!origin || !destination) {
      return NextResponse.json(
        { error: "请提供起点 (origin) 和终点 (destination)" },
        { status: 400 }
      );
    }

    const result = await planDrivingRoute(origin, destination, waypoints);

    if (!result) {
      return NextResponse.json(
        { error: "路线规划失败，请检查地址是否正确" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Route API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "路线规划失败" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  const waypoints = searchParams.get("waypoints");

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "请提供起点 (origin) 和终点 (destination)" },
      { status: 400 }
    );
  }

  try {
    const waypointsArray = waypoints ? waypoints.split("|") : undefined;
    const result = await planDrivingRoute(origin, destination, waypointsArray);

    if (!result) {
      return NextResponse.json(
        { error: "路线规划失败，请检查地址是否正确" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Route API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "路线规划失败" },
      { status: 500 }
    );
  }
}
