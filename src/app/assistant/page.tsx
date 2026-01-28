"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Send, Loader2, Navigation, Utensils, Plus, MessageSquare, MapIcon, Layers } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapRoute,
  MapControls,
  type MapRef,
} from "@/registry/map";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { RouteResult, POIResult } from "@/lib/amap";

// 标记点类型
interface MarkerData {
  id: string;
  name: string;
  location: [number, number];
  address?: string;
  type?: "location" | "origin" | "destination" | "waypoint";
}

type MobileView = "chat" | "map";

// 简化的 Header
function AssistantHeader({ 
  onNewChat, 
  hasMessages 
}: { 
  onNewChat: () => void;
  hasMessages: boolean;
}) {
  return (
    <header className="w-full h-12 sm:h-14 border-b border-border bg-background/95 backdrop-blur shrink-0">
      <nav className="flex size-full items-center justify-between px-3 sm:px-4">
        <Link href="/assistant/intro" className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity">
          <Navigation className="size-4 sm:size-5 text-primary" />
          <span className="font-bold tracking-tight text-sm sm:text-base">MY_MAP</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">智能地图助手</span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {hasMessages && (
            <button
              onClick={onNewChat}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-border hover:bg-accent hover:border-accent-foreground/20 active:scale-95 transition-all duration-150"
            >
              <Plus className="size-3.5 sm:size-4" />
              <span className="hidden sm:inline">新对话</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

// 移动端底部导航
function MobileTabBar({
  activeView,
  onViewChange,
  hasRoute,
}: {
  activeView: MobileView;
  onViewChange: (view: MobileView) => void;
  hasRoute: boolean;
}) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-background/95 backdrop-blur border-t border-border flex z-50">
      <button
        onClick={() => onViewChange("chat")}
        className={cn(
          "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors",
          activeView === "chat" ? "text-primary" : "text-muted-foreground"
        )}
      >
        <MessageSquare className="size-5" />
        <span className="text-[10px] font-medium">对话</span>
      </button>
      <button
        onClick={() => onViewChange("map")}
        className={cn(
          "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative",
          activeView === "map" ? "text-primary" : "text-muted-foreground"
        )}
      >
        <MapIcon className="size-5" />
        <span className="text-[10px] font-medium">地图</span>
        {hasRoute && activeView !== "map" && (
          <span className="absolute top-2 right-1/4 w-2 h-2 bg-primary rounded-full" />
        )}
      </button>
    </div>
  );
}

// Markdown 渲染组件
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="bg-muted-foreground/20 px-1 py-0.5 rounded text-xs">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="bg-muted-foreground/10 p-2 rounded text-xs overflow-x-auto mb-2">{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary pl-2 italic text-muted-foreground mb-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-2 border-border" />,
        a: ({ href, children }) => (
          <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <table className="w-full text-sm border-collapse mb-2">{children}</table>
        ),
        th: ({ children }) => (
          <th className="border border-border px-2 py-1 bg-muted font-medium text-left">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-2 py-1">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MapData {
  route?: RouteResult;
  pois?: POIResult[];
  markers?: MarkerData[];
}

// 默认中国中心坐标
const DEFAULT_CENTER: [number, number] = [116.4074, 39.9042];

// 地图样式类型
type MapStyleType = "amap" | "maptiler" | "carto";

// MapTiler API Key
const MAPTILER_KEY = "qm9HVCYwIq04UgPI6EbV";

// 地图样式配置类型
type MapStyleConfig = string | {
  version: 8;
  sources: Record<string, { type: "raster"; tiles: string[]; tileSize: number }>;
  layers: { id: string; type: "raster"; source: string; minzoom: number; maxzoom: number }[];
};

// 所有地图样式配置
const MAP_STYLE_OPTIONS: Record<MapStyleType, { name: string; label: string; styles: { light: MapStyleConfig; dark: MapStyleConfig } }> = {
  amap: {
    name: "高德地图",
    label: "中文",
    styles: {
      light: {
        version: 8 as const,
        sources: {
          amap: {
            type: "raster" as const,
            tiles: [
              "https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
              "https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
              "https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
              "https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
            ],
            tileSize: 256,
          },
        },
        layers: [{ id: "amap-tiles", type: "raster" as const, source: "amap", minzoom: 0, maxzoom: 18 }],
      },
      dark: {
        version: 8 as const,
        sources: {
          amap: {
            type: "raster" as const,
            tiles: [
              // 暗色模式使用普通地图（ltype=4 太暗）
              "https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
              "https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
              "https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
              "https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
            ],
            tileSize: 256,
          },
        },
        layers: [{ id: "amap-tiles", type: "raster" as const, source: "amap", minzoom: 0, maxzoom: 18 }],
      },
    },
  },
  maptiler: {
    name: "MapTiler",
    label: "矢量",
    styles: {
      light: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`,
      dark: `https://api.maptiler.com/maps/streets-dark/style.json?key=${MAPTILER_KEY}`,
    },
  },
  carto: {
    name: "Carto",
    label: "简洁",
    styles: {
      light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    },
  },
};

// 地图样式切换器组件
function MapStyleSwitcher({
  currentStyle,
  onStyleChange,
}: {
  currentStyle: MapStyleType;
  onStyleChange: (style: MapStyleType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-20 md:bottom-auto md:top-4 left-2 md:left-auto md:right-4 z-30">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-2 bg-background/95 backdrop-blur rounded-lg border border-border shadow-lg hover:bg-accent active:scale-95 transition-all text-sm font-medium"
        >
          <Layers className="size-4" />
          <span>{MAP_STYLE_OPTIONS[currentStyle].label}</span>
        </button>
        
        {isOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 md:left-auto md:right-0 bottom-full md:bottom-auto md:top-full mb-1 md:mb-0 md:mt-1 bg-background/95 backdrop-blur rounded-lg border border-border shadow-lg overflow-hidden z-40 min-w-[140px]">
              {(Object.keys(MAP_STYLE_OPTIONS) as MapStyleType[]).map((styleKey) => (
                <button
                  key={styleKey}
                  onClick={() => {
                    onStyleChange(styleKey);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2.5 text-left text-sm hover:bg-accent active:bg-accent/80 transition-colors flex items-center justify-between",
                    currentStyle === styleKey && "bg-accent font-medium"
                  )}
                >
                  <span>{MAP_STYLE_OPTIONS[styleKey].name}</span>
                  <span className="text-muted-foreground text-xs">{MAP_STYLE_OPTIONS[styleKey].label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mapData, setMapData] = useState<MapData>({});
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [mapStyle, setMapStyle] = useState<MapStyleType>("amap"); // 默认高德地图
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);
  
  // 获取当前地图样式
  const currentMapStyles = MAP_STYLE_OPTIONS[mapStyle].styles;

  // 新建对话
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setMapData({});
    setInput("");
    // 重置地图视角到中国
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: DEFAULT_CENTER,
        zoom: 4,
        duration: 1000,
      });
    }
  }, []);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 调整地图视角以适应路线
  const fitMapToRoute = useCallback((route: RouteResult) => {
    if (!mapRef.current || !route.polyline.length) return;

    const coords = route.polyline;
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);

    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    mapRef.current.fitBounds(bounds, {
      padding: { top: 100, bottom: 50, left: 50, right: 50 },
      duration: 1000,
    });
  }, []);

  // 当路线更新时，调整地图视角
  useEffect(() => {
    if (mapData.route) {
      // 延迟执行以确保地图已加载
      const timer = setTimeout(() => {
        fitMapToRoute(mapData.route!);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mapData.route, fitMapToRoute]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: userMessage },
          ],
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `**错误**: ${data.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message || "抱歉，我没有理解你的问题。" },
        ]);

        // 更新地图数据
        if (data.mapData) {
          setMapData((prev) => ({
            route: data.mapData.route || prev.route,
            pois: data.mapData.pois || prev.pois,
            markers: data.mapData.markers || prev.markers,
          }));
          
          // 如果有新标记，移动地图到标记位置
          if (data.mapData.markers?.length && mapRef.current) {
            const marker = data.mapData.markers[0];
            mapRef.current.flyTo({
              center: marker.location,
              zoom: 14,
              duration: 1000,
            });
            // 移动端自动切换到地图视图
            if (window.innerWidth < 768) {
              setMobileView("map");
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "**网络错误**，请稍后重试。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQueries = [
    "从深圳南山科技园到龙华大浪，途经宝安沙井",
    "从北京西站到故宫怎么走",
    "上海外滩到浦东机场，推荐沿途的咖啡厅",
  ];

  // 当路线规划完成时，移动端自动切换到地图视图
  useEffect(() => {
    if (mapData.route && window.innerWidth < 768) {
      setMobileView("map");
    }
  }, [mapData.route]);

  return (
    <div className="flex flex-col h-screen h-[100dvh]">
      <AssistantHeader onNewChat={handleNewChat} hasMessages={messages.length > 0} />

      <div className="flex-1 flex overflow-hidden relative">
        {/* 聊天面板 */}
        <div 
          className={cn(
            "flex flex-col bg-background transition-transform duration-300 ease-in-out",
            // 移动端：全宽，通过 translate 切换
            "absolute inset-0 md:relative md:inset-auto",
            "w-full md:w-[420px] md:border-r md:border-border",
            // 移动端视图切换
            mobileView === "chat" ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            // 移动端底部留出导航栏空间
            "pb-14 md:pb-0"
          )}
        >
          {/* 聊天消息区 */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                  <Navigation className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold mb-2">智能地图助手</h2>
                <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-6">
                  告诉我你想去哪里，我来帮你规划路线和推荐好去处
                </p>
                <div className="space-y-2 w-full max-w-sm">
                  {suggestedQueries.map((query, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(query)}
                      className="w-full text-left px-3 py-3 sm:py-2.5 rounded-lg border border-border hover:bg-accent hover:border-accent-foreground/20 hover:shadow-sm active:scale-[0.98] active:bg-accent transition-all duration-150 text-xs sm:text-sm"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[90%] sm:max-w-[85%] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.role === "user" ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <MarkdownContent content={message.content} />
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="p-3 sm:p-4 border-t border-border bg-background">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入出行需求..."
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2.5 rounded-full border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-150 text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-11 h-11 sm:w-10 sm:h-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 hover:shadow-md active:scale-90 transition-all duration-150"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* 地图面板 */}
        <div 
          className={cn(
            "relative transition-transform duration-300 ease-in-out",
            // 移动端：全屏，通过 translate 切换
            "absolute inset-0 md:relative md:inset-auto",
            "w-full md:flex-1 h-full",
            // 移动端视图切换
            mobileView === "map" ? "translate-x-0" : "translate-x-full md:translate-x-0",
            // 移动端底部留出导航栏空间
            "pb-14 md:pb-0"
          )}
        >
          <Map
            ref={mapRef}
            center={DEFAULT_CENTER}
            zoom={4}
            styles={currentMapStyles}
          >
            {/* 路线 */}
            {mapData.route && (
              <MapRoute
                coordinates={mapData.route.polyline}
                color="#3b82f6"
                width={4}
                opacity={0.9}
              />
            )}

            {/* 起点标记 */}
            {mapData.route && (
              <MapMarker
                longitude={mapData.route.origin[0]}
                latitude={mapData.route.origin[1]}
              >
                <MarkerContent>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 border-2 border-white shadow-lg">
                    <span className="text-white text-xs font-bold">起</span>
                  </div>
                </MarkerContent>
                <MarkerPopup>
                  <div className="text-sm font-medium">起点</div>
                </MarkerPopup>
              </MapMarker>
            )}

            {/* 终点标记 */}
            {mapData.route && (
              <MapMarker
                longitude={mapData.route.destination[0]}
                latitude={mapData.route.destination[1]}
              >
                <MarkerContent>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 border-2 border-white shadow-lg">
                    <span className="text-white text-xs font-bold">终</span>
                  </div>
                </MarkerContent>
                <MarkerPopup>
                  <div className="text-sm font-medium">终点</div>
                </MarkerPopup>
              </MapMarker>
            )}

            {/* 途经点标记 */}
            {mapData.route?.waypoints?.map((wp, i) => (
              <MapMarker key={`wp-${i}`} longitude={wp[0]} latitude={wp[1]}>
                <MarkerContent>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 border-2 border-white shadow-lg">
                    <span className="text-white text-[10px] font-bold">
                      {i + 1}
                    </span>
                  </div>
                </MarkerContent>
                <MarkerPopup>
                  <div className="text-sm font-medium">途经点 {i + 1}</div>
                </MarkerPopup>
              </MapMarker>
            ))}

            {/* 位置标记（地理编码结果） */}
            {mapData.markers?.map((marker) => (
              <MapMarker
                key={marker.id}
                longitude={marker.location[0]}
                latitude={marker.location[1]}
              >
                <MarkerContent>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 border-2 border-white shadow-lg">
                    <Navigation className="w-4 h-4 text-white" />
                  </div>
                </MarkerContent>
                <MarkerPopup className="min-w-[180px]">
                  <div className="space-y-1">
                    <div className="font-medium">{marker.name}</div>
                    {marker.address && (
                      <div className="text-xs text-muted-foreground">
                        {marker.address}
                      </div>
                    )}
                  </div>
                </MarkerPopup>
              </MapMarker>
            ))}

            {/* POI 标记 */}
            {mapData.pois?.map((poi) => (
              <MapMarker
                key={poi.id}
                longitude={poi.location[0]}
                latitude={poi.location[1]}
              >
                <MarkerContent>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500 border-2 border-white shadow-lg">
                    <Utensils className="w-4 h-4 text-white" />
                  </div>
                </MarkerContent>
                <MarkerPopup className="min-w-[200px]">
                  <div className="space-y-1">
                    <div className="font-medium">{poi.name}</div>
                    {poi.rating && (
                      <div className="text-sm text-amber-500">
                        ⭐ {poi.rating} 分
                      </div>
                    )}
                    {poi.cost && (
                      <div className="text-sm text-muted-foreground">
                        人均 ¥{poi.cost}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {poi.address}
                    </div>
                    {poi.tel && (
                      <div className="text-xs text-muted-foreground">
                        📞 {poi.tel}
                      </div>
                    )}
                  </div>
                </MarkerPopup>
              </MapMarker>
            ))}

            <MapControls
              position="bottom-right"
              showZoom
              showLocate
              showFullscreen
              onLocate={(coords) => {
                console.log("定位成功:", coords);
                // 定位成功后可以在聊天中提示用户
                setInput(`我在这个位置附近，帮我推荐周边的餐厅`);
              }}
              onLocateError={(error) => {
                const messages: Record<number, string> = {
                  1: "您已拒绝定位权限，请在浏览器设置中允许定位",
                  2: "无法获取位置（桌面电脑需要开启 Wi-Fi）\n\n您可以直接输入地点名称，如「深圳南山科技园附近的餐厅」",
                  3: "定位请求超时，请重试",
                };
                alert(messages[error.code] || "定位失败，请重试");
              }}
            />
          </Map>

          {/* 地图样式切换器 */}
          <MapStyleSwitcher currentStyle={mapStyle} onStyleChange={setMapStyle} />

          {/* 路线信息卡片 */}
          {mapData.route && (
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-background/95 backdrop-blur rounded-lg border border-border shadow-lg p-2.5 sm:p-4 max-w-[180px] sm:max-w-xs">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                <span className="font-medium text-xs sm:text-sm">路线信息</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <div>
                  <span className="text-muted-foreground text-[10px] sm:text-xs">距离</span>
                  <p className="font-medium">
                    {(mapData.route.distance / 1000).toFixed(1)} 公里
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] sm:text-xs">预计时间</span>
                  <p className="font-medium">
                    {Math.round(mapData.route.duration / 60)} 分钟
                  </p>
                </div>
                {mapData.route.tolls > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-[10px] sm:text-xs">过路费</span>
                    <p className="font-medium">{mapData.route.tolls} 元</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 移动端底部导航 */}
      <MobileTabBar
        activeView={mobileView}
        onViewChange={setMobileView}
        hasRoute={!!mapData.route || !!mapData.markers?.length}
      />
    </div>
  );
}
