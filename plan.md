# 天气K线图微信小程序 - 实现计划

## 项目概述

一个以天气数据为数据源的K线图微信小程序，将2025年全年的天气数据以周K线形式展示。

### 核心需求
- **K线类型**: 周K线（一周一根）
- **时间范围**: 2025-01-01 至 2026-01-06（约53周）
- **城市范围**: 31个省会城市
- **交互**: 下拉选择城市，左右滑动查看K线
- **颜色规则**: 红涨绿跌

### 周K线数据映射
```
开盘价 = 本周一最低气温
收盘价 = 本周日最低气温
最高价 = 本周内最高气温
最低价 = 本周内最低气温
```

---

## 技术架构

```
┌─────────────────────────────────────────────┐
│              微信小程序前端                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 主页面   │  │ K线组件  │  │ 城市选择 │   │
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
│  │  - 初始化完成后只读，不做更新           │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## 数据流程（MVP）

### 初始化阶段（一次性）
```
Open-Meteo API → sync-weather云函数 → 云数据库（按日存储）
  (31个城市)
```

### 用户访问阶段
```
小程序 → get-kline云函数 → 云数据库读取日度数据 → 前端聚合成周K线
```

---

## 项目结构

```
D:/KLine/
├── miniprogram/                    # 小程序源码
│   ├── pages/
│   │   ├── index/                  # 主页面（K线图）
│   │   │   ├── index.js
│   │   │   ├── index.json
│   │   │   ├── index.wxml
│   │   │   └── index.wxss
│   │   └── city/                   # 城市选择页面（可选）
│   ├── components/
│   │   └── kline-chart/            # K线图组件
│   │       ├── kline-chart.js
│   │       ├── kline-chart.json
│   │       ├── kline-chart.wxml
│   │       └── kline-chart.wxss
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
│   │   ├── index.js
│   │   └── package.json
│   └── sync-weather/               # 同步天气数据云函数（初始化用）
│       ├── index.js
│       └── package.json
├── project.config.json             # 小程序项目配置
├── project.cloud.json              # 云开发配置
├── .gitignore
└── README.md
```

---

## 实现步骤

### 步骤 1: 项目基础结构搭建
1. 创建 `miniprogram/` 和 `cloudfunctions/` 目录结构
2. 创建配置文件 `project.config.json`、`project.cloud.json`
3. 创建小程序入口文件 `app.js`、`app.json`、`app.wxss`

### 步骤 2: 省会城市数据准备
创建 `miniprogram/utils/data.js`，包含31个省会城市的经纬度：
```javascript
export const PROVINCE_CAPITALS = [
  { name: '北京', en: 'Beijing', lat: 39.9042, lon: 116.4074 },
  { name: '上海', en: 'Shanghai', lat: 31.2304, lon: 121.4737 },
  // ... 其余29个城市
]
```

### 步骤 3: sync-weather 云函数（数据初始化）
创建 `cloudfunctions/sync-weather/index.js`：
- 遍历31个省会城市
- 调用 Open-Meteo API 获取2025-01-01至2026-01-06的日度天气数据
- **直接按日写入云数据库**，不做聚合

使用方式：在云开发控制台手动调用一次，或创建管理端页面触发

### 步骤 4: get-kline 云函数
创建 `cloudfunctions/get-kline/index.js`：
- 接收参数：`{ city: 'Beijing' }`
- 从云数据库读取对应城市的所有日度数据
- 直接返回日度数据（由前端聚合成周K线）

### 步骤 5: 云数据库初始化
创建集合 `weather_data`：
- 索引：`city` 字段

### 步骤 6: ECharts 集成
1. 下载 ECharts for 微信小程序
2. 创建 K线图组件 `kline-chart/`
3. 配置 K线图 option：
   - type: 'candlestick'
   - 红涨绿跌颜色配置
   - dataZoom 支持左右滑动

### 步骤 7: 主页面实现
创建 `miniprogram/pages/index/`：
1. 顶部：城市选择器（picker下拉）
2. 中部：K线图展示区域
3. 页面逻辑：调用 get-kline 云函数获取数据

---

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
  year: 2025,                // 年份（用于查询优化）
  month: 1,                  // 月份（用于查询优化）
}
```

每个城市约370条记录（2025-01-01 至 2026-01-06）
31个城市共约 11,470 条记录

### 前端聚合逻辑（日 → 周）

```javascript
// 将每日数据聚合成周K线
function aggregateToWeekly(dailyData) {
  const weeklyData = [];
  const weekMap = new Map();

  dailyData.forEach(day => {
    const weekNum = getWeekNumber(day.date);
    if (!weekMap.has(weekNum)) {
      weekMap.set(weekNum, {
        dates: [],
        temps: []
      });
    }
    weekMap.get(weekNum).dates.push(day.date);
    weekMap.get(weekNum).temps.push(day.tempMin, day.tempMax);
  });

  weekMap.forEach((value, weekNum) => {
    const temps = value.temps;
    weeklyData.push({
      week: weekNum,
      open: temps[0],           // 本周一最低温
      close: temps[temps.length - 2],  // 本周日最低温
      high: Math.max(...temps),  // 本周最高温
      low: Math.min(...temps),   // 本周最低温
      dates: value.dates
    });
  });

  return weeklyData;
}
```

---

## 关键文件清单

| 文件 | 说明 |
|------|------|
| `miniprogram/utils/data.js` | 省会城市数据（31个城市经纬度） |
| `miniprogram/pages/index/*` | 主页面（K线图展示） |
| `miniprogram/components/kline-chart/*` | K线图组件 |
| `cloudfunctions/get-kline/index.js` | 获取K线数据云函数 |
| `cloudfunctions/sync-weather/index.js` | 同步天气数据云函数（初始化用） |
| `project.config.json` | 小程序项目配置 |

---

## 初始化流程

1. 部署云函数 `sync-weather` 和 `get-kline`
2. 在云开发控制台手动调用 `sync-weather` 云函数
3. 云函数遍历31个城市，获取数据并写入数据库
4. 数据库准备完成后，小程序即可使用
