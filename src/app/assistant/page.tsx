"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Send, Loader2, Navigation, Utensils, Plus, Trash2 } from "lucide-react";
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

// 简化的 Header
function AssistantHeader({ 
  onNewChat, 
  hasMessages 
}: { 
  onNewChat: () => void;
  hasMessages: boolean;
}) {
  return (
    <header className="w-full h-14 border-b border-border bg-background/95 backdrop-blur">
      <nav className="flex size-full items-center justify-between px-4">
        <Link href="/assistant/intro" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Navigation className="size-5 text-primary" />
          <span className="font-bold tracking-tight">MY_MAP</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">智能地图助手</span>
        </Link>
        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              onClick={onNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent hover:border-accent-foreground/20 active:scale-95 transition-all duration-150"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">新对话</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </nav>
    </header>
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
}

// 默认中国中心坐标
const DEFAULT_CENTER: [number, number] = [116.4074, 39.9042];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mapData, setMapData] = useState<MapData>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);

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
          }));
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

  return (
    <div className="flex flex-col h-screen">
      <AssistantHeader onNewChat={handleNewChat} hasMessages={messages.length > 0} />

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧聊天面板 */}
        <div className="w-[420px] flex flex-col border-r border-border bg-background">
          {/* 聊天消息区 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Navigation className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">智能地图助手</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  告诉我你想去哪里，我来帮你规划路线和推荐好去处
                </p>
                <div className="space-y-2 w-full">
                  {suggestedQueries.map((query, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(query)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:bg-accent hover:border-accent-foreground/20 hover:shadow-sm active:scale-[0.98] transition-all duration-150 text-sm"
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
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
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
                <div className="bg-muted rounded-2xl px-4 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="p-4 border-t border-border">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入你的出行需求，支持全国城市..."
                className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-150 text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 hover:shadow-md active:scale-90 transition-all duration-150"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* 右侧地图面板 */}
        <div className="flex-1 relative h-full">
          <Map
            ref={mapRef}
            center={DEFAULT_CENTER}
            zoom={4}
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
              }}
              onLocateError={(error) => {
                const messages: Record<number, string> = {
                  1: "您已拒绝定位权限，请在浏览器设置中允许定位",
                  2: "无法获取位置信息，请检查设备定位功能",
                  3: "定位请求超时，请重试",
                };
                alert(messages[error.code] || "定位失败，请重试");
              }}
            />
          </Map>

          {/* 路线信息卡片 */}
          {mapData.route && (
            <div className="absolute top-4 left-4 bg-background/95 backdrop-blur rounded-lg border border-border shadow-lg p-4 max-w-xs">
              <div className="flex items-center gap-2 mb-2">
                <Navigation className="w-4 h-4 text-primary" />
                <span className="font-medium">路线信息</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">距离</span>
                  <p className="font-medium">
                    {(mapData.route.distance / 1000).toFixed(1)} 公里
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">预计时间</span>
                  <p className="font-medium">
                    {Math.round(mapData.route.duration / 60)} 分钟
                  </p>
                </div>
                {mapData.route.tolls > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">过路费</span>
                    <p className="font-medium">{mapData.route.tolls} 元</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
