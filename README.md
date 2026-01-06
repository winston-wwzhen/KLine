# 天气K线图微信小程序

一个以天气数据为数据源的K线图微信小程序，将2025年全年的天气数据以周K线形式展示。

## 功能特点

- **周K线展示**: 一周一根K线，直观展示天气变化趋势
- **31个省会城市**: 支持全国31个省会/直辖市天气数据查询
- **6种显示模式**: 原始温度、Z-score标准化、环比变化率、昼夜温差、累积距平、温度加速度
- **AI智能分析**: 集成智谱AI GLM-4.5-AirX，生成具有社交传播属性的年度天气报告
  - ✨ 吸睛标题，制造好奇与共鸣
  - 💬 金句频出，适合做成海报
  - 🎯 情感共鸣，将天气与生活联系
  - 💬 话题讨论，引发用户互动
  - 🏷️ 话题标签，方便社交传播
- **社交分享**: 支持分享到好友、朋友圈，适合小红书等平台传播
- **管理后台**: 支持批量生成AI报告，一键同步186份报告
- **城市切换**: 下拉选择城市，快速切换查看
- **图表交互**: 支持左右滑动、缩放查看K线图
- **红涨绿跌**: 遵循中国股市配色习惯
- **下拉刷新**: 支持下拉刷新数据
- **渐变玻璃态UI**: 现代化的视觉设计

## K线数据映射

```
开盘价 = 本周一最低气温
收盘价 = 本周日最低气温
最高价 = 本周内最高气温
最低价 = 本周内最低气温
```

## 技术架构

```
┌─────────────────────────────────────────────┐
│              微信小程序前端                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 主页面   │  │ K线组件  │  │ 管理后台 │   │
│  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│            微信云函数 (后端)                   │
│  ┌──────────────────────────────────────┐   │
│  │  get-kline 云函数                     │   │
│  │  - 从云数据库读取日度数据               │   │
│  │  - 前端将日度数据聚合成周K线            │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │  analyze-kline 云函数                 │   │
│  │  - 调用智谱AI GLM-4.5-AirX            │   │
│  │  - 生成具有社交传播属性的AI报告        │   │
│  │  - 支持批量生成、查询、统计            │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │  sync-weather 云函数（初始化用）        │   │
│  │  - 调用 Open-Meteo API               │   │
│  │  - 写入云数据库（按日存储）             │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│           云数据库 (MongoDB)                  │
│  ┌──────────────────────────────────────┐   │
│  │  weather_data 集合                    │   │
│  │  - 预置31个城市2025年日度数据           │   │
│  │  - 每条记录一天的数据                   │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## 项目结构

```
D:/KLine/
├── miniprogram/                    # 小程序源码
│   ├── pages/
│   │   ├── index/                  # 主页面（K线图）
│   │   └── admin/                  # 管理页面
│   │       ├── admin.wxml/js/wxss/json    # AI报告管理
│   │       ├── sync/             # 数据同步
│   │       └── debug/            # 调试页面
│   ├── components/
│   │   └── kline-chart-native/     # K线图组件（Canvas 2D）
│   ├── lib/
│   │   └── ec-canvas/              # ECharts 图表库
│   ├── utils/
│   │   ├── config.js               # 配置文件
│   │   ├── request.js              # 云函数调用封装
│   │   └── data.js                 # 省会城市数据
│   ├── app.js
│   ├── app.json
│   └── app.wxss
├── cloudfunctions/
│   ├── get-kline/                  # 获取K线数据云函数
│   │   ├── config.example.js       # 配置模板
│   │   └── config.js               # 实际配置（不提交）
│   ├── analyze-kline/              # AI分析报告云函数
│   │   ├── config.example.js       # 配置模板
│   │   └── config.js               # 实际配置（不提交）
│   └── sync-weather/               # 同步天气数据云函数
│       ├── config.example.js       # 配置模板
│       └── config.js               # 实际配置（不提交）
├── .gitignore
├── project.config.json             # 小程序项目配置
├── project.cloud.json              # 云开发配置
├── plan.md                         # 开发计划
├── ROADMAP.md                      # 功能迭代规划
├── AI_ANALYSIS_SETUP.md            # AI分析功能配置文档
└── README.md
```

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd KLine
```

### 2. 配置云函数

⚠️ **重要：config.js 已加入 .gitignore，不会被提交到 Git**

在云函数目录下，每个云函数都有 `config.example.js` 模板文件：

1. 复制配置模板：
   ```bash
   # 在每个云函数目录下执行
   cp cloudfunctions/analyze-kline/config.example.js cloudfunctions/analyze-kline/config.js
   cp cloudfunctions/get-kline/config.example.js cloudfunctions/get-kline/config.js
   cp cloudfunctions/sync-weather/config.example.js cloudfunctions/sync-weather/config.js
   ```

2. 编辑各个云函数目录下的 `config.js`，填入你的配置：
   ```javascript
   // 微信云开发环境ID
   const CLOUD_ENV_ID = 'your_cloud_env_id_here';

   // 智谱AI API配置
   const GLM_CONFIG = {
     API_KEY: 'your_glm_api_key_here',  // 从 https://open.bigmodel.cn/ 获取
   };
   ```

3. 部署云函数时，`config.js` 会被自动打包上传（包含你的 API Key）

### 3. 下载 ECharts

从 [echarts-for-weixin](https://github.com/ecomfe/echarts-for-weixin) 下载 `echarts.min.js`，放到 `miniprogram/lib/ec-canvas/` 目录下。

### 4. 配置云环境

1. 在微信开发者工具中打开项目
2. 开通云开发服务
3. 修改 `miniprogram/app.js` 中的云环境ID：
   ```javascript
   wx.cloud.init({
     env: 'your-env-id', // 替换为你的云环境ID
     traceUser: true,
   });
   ```

### 5. 部署云函数

在微信开发者工具中：
1. 右键 `cloudfunctions/get-kline` → 上传并部署
2. 右键 `cloudfunctions/analyze-kline` → 上传并部署
3. 右键 `cloudfunctions/sync-weather` → 上传并部署

### 6. 初始化数据

在云开发控制台 → 云函数，手动调用 `sync-weather` 云函数，等待数据同步完成。

### 7. 批量生成AI报告

首次使用需要批量生成AI分析报告：

1. 在小程序中进入「调试」页面
2. 点击「🤖 AI报告管理」
3. 点击「🚀 开始批量生成」
4. 等待5-15分钟完成

详细说明请查看：[AI分析功能配置文档](AI_ANALYSIS_SETUP.md)

### 8. 运行项目

在微信开发者工具中点击编译，预览小程序效果。

## 数据来源

天气数据来自 [Open-Meteo Archive API](https://archive-api.open-meteo.com/)，免费且无需 API Key。

## 数据库设计

### weather_data 集合（按日存储）

```javascript
{
  _id: ObjectId,
  city: 'Beijing',           // 城市英文名
  cityName: '北京',           // 城市中文名
  date: '2025-01-01',        // 日期
  tempMax: 2,                // 当日最高气温
  tempMin: -8,               // 当日最低气温
  year: 2025,                // 年份
  month: 1,                  // 月份
}
```

### kline_analysis 集合（AI分析报告）

```javascript
{
  _id: ObjectId,
  city: 'Beijing',           // 城市英文名
  cityName: '北京',           // 城市中文名
  mode: 'original',           // 显示模式
  report: '...',             // AI生成的分析报告
  createTime: ISODate,        // 创建时间
  updateTime: ISODate         // 更新时间
}
```

## 支持的城市

31个省会/直辖市：北京、上海、天津、重庆、哈尔滨、长春、沈阳、呼和浩特、石家庄、太原、济南、郑州、西安、兰州、银川、西宁、乌鲁木齐、合肥、南京、杭州、长沙、南昌、武汉、成都、贵阳、昆明、南宁、广州、福州、海口、台北、拉萨。

## 功能迭代规划

详细的功能迭代规划请查看：[ROADMAP.md](ROADMAP.md)

### 二期功能（计划中）
- 🎨 海报生成功能
- 🆚 城市对比功能
- 📊 个性化推荐
- 📅 历史回溯（2020-2024）
- 🤖 AI对话模式

### 三期功能（探索中）
- 📝 UGC内容社区
- 🏆 天气挑战活动
- 🤝 品牌联名合作

## 开源协议

MIT License
