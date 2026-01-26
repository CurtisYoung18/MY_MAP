import Image from "next/image";
import Link from "next/link";
import { Navigation, Map, Route, Utensils, Sparkles, ArrowRight } from "lucide-react";

export const metadata = {
  title: "MY_MAP - 智能地图助手",
  description: "AI 驱动的智能地图助手，支持全国路线规划、沿途 POI 推荐",
};

const features = [
  {
    icon: Route,
    title: "智能路线规划",
    description: "支持全国城市驾车路线规划，包含途经点、距离、时间和过路费估算",
  },
  {
    icon: Utensils,
    title: "沿途推荐",
    description: "根据规划路线智能推荐沿途餐厅、咖啡厅、加油站等服务设施",
  },
  {
    icon: Map,
    title: "可视化展示",
    description: "路线和推荐地点实时在地图上标注，一目了然",
  },
  {
    icon: Sparkles,
    title: "自然语言交互",
    description: "用自然语言描述你的出行需求，AI 理解并为你规划最佳行程",
  },
];

export default function AssistantIntroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="size-4" />
            <span>AI 驱动</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            MY_MAP
          </h1>
          <p className="text-xl text-muted-foreground mb-2">智能地图助手</p>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            告诉我你想去哪里，我来帮你规划路线和推荐好去处。
            支持全国城市，自然语言交互，让出行更简单。
          </p>
          
          <Link
            href="/assistant"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Navigation className="size-5" />
            开始使用
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">功能演示</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Route Planning Screenshot */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">路线规划</h3>
              <div className="rounded-xl overflow-hidden border border-border shadow-lg bg-background">
                <Image
                  src="/screenshots/assistant-route.png"
                  alt="路线规划演示"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                />
              </div>
            </div>
            
            {/* POI Recommendation Screenshot */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">沿途推荐</h3>
              <div className="rounded-xl overflow-hidden border border-border shadow-lg bg-background">
                <Image
                  src="/screenshots/assistant-poi.png"
                  alt="沿途推荐演示"
                  width={800}
                  height={600}
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">核心功能</h2>
          
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl bg-background border border-border hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="size-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example Queries Section */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">试试这样问</h2>
          
          <div className="space-y-3">
            {[
              "从深圳南山科技园到龙华大浪，途经宝安沙井",
              "从北京西站到故宫怎么走",
              "上海外滩到浦东机场，推荐沿途的咖啡厅",
              "广州塔到白云机场，沿途有什么好吃的",
            ].map((query, i) => (
              <div
                key={i}
                className="px-4 py-3 rounded-lg bg-muted/50 border border-border text-sm"
              >
                &ldquo;{query}&rdquo;
              </div>
            ))}
          </div>
          
          <div className="text-center mt-8">
            <Link
              href="/assistant"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              立即体验
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto text-center text-sm text-muted-foreground">
          <p>MY_MAP · 基于高德地图 API 和 MiniMax AI 构建</p>
        </div>
      </footer>
    </div>
  );
}
