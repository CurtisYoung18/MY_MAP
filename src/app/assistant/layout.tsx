import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MY_MAP - 智能地图助手",
  description: "AI 驱动的智能地图助手，支持全国路线规划和 POI 推荐",
};

export default function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="assistant-layout [&~footer]:hidden">
      {children}
    </div>
  );
}
