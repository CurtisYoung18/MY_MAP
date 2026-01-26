# MY_MAP - 智能地图助手

AI 驱动的智能地图助手，支持全国路线规划和沿途 POI 推荐。

## 功能特点

- **智能路线规划** - 支持全国城市驾车路线规划，包含途经点、距离、时间和过路费估算
- **沿途推荐** - 根据规划路线智能推荐沿途餐厅、咖啡厅、加油站等服务设施
- **可视化展示** - 路线和推荐地点实时在地图上标注
- **自然语言交互** - 用自然语言描述出行需求，AI 理解并规划最佳行程

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **地图**: MapLibre GL
- **AI**: MiniMax M2
- **地图服务**: 高德地图 API

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```env
AMAP_API_KEY=your_amap_api_key
MINIMAX_API_KEY=your_minimax_api_key
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 即可使用。

## 使用示例

- "从深圳南山科技园到龙华大浪，途经宝安沙井"
- "从北京西站到故宫怎么走"
- "上海外滩到浦东机场，推荐沿途的咖啡厅"
- "广州塔到白云机场，沿途有什么好吃的"

## API 说明

### 高德地图 API

需要在[高德开放平台](https://lbs.amap.com/)注册并获取 Web 服务 API Key。

免费配额：
- 路径规划：每日 5000 次
- 地理编码：每日 5000 次
- POI 搜索：每日 5000 次

### MiniMax API

需要在 [MiniMax 开放平台](https://platform.minimaxi.com/) 注册并获取 API Key。

## 项目结构

```
src/
├── app/
│   ├── api/           # API 路由
│   │   ├── amap/      # 高德地图 API
│   │   └── chat/      # AI 聊天 API
│   ├── assistant/     # 地图助手页面
│   └── page.tsx       # 首页（重定向）
├── components/        # UI 组件
├── lib/               # 工具函数
│   ├── amap.ts        # 高德地图封装
│   └── minimax.ts     # MiniMax AI 封装
└── registry/          # 地图组件
```

## License

MIT
