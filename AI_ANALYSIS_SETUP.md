# AI分析功能配置说明

## 功能介绍

本项目集成了智谱AI GLM-4.7大模型，可以根据温度K线数据生成智能分析报告。AI会从技术分析的角度解读天气变化趋势，发现数据中的有趣模式和异常点。

**优化后的方案：**
- 预生成并存储报告到数据库
- 用户点击时快速读取，响应时间<1秒
- 节省API调用费用

## 架构设计

```
┌─────────────────┐
│   首页用户      │
│  查看K线图      │
│  点击查看报告    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   数据库查询    │◄──────┐
│  kline_analysis  │       │
│   集合          │       │
└─────────────────┘       │
         ▲                │
         │                │
┌────────┴────────┐       │
│   管理后台      │       │
│  批量生成报告    │───────┘
│  (仅一次)       │
└─────────────────┘
```

## 配置步骤

### 1. 获取智谱AI API Key

1. 访问 [智谱AI开放平台](https://open.bigmodel.cn/)
2. 注册并登录账户
3. 进入 API Keys 管理页面
4. 创建新的 API Key 并复制保存

### 2. 配置云函数环境变量

在微信开发者工具中：

1. 打开云开发控制台
2. 进入「云函数」管理
3. 找到 `analyze-kline` 云函数
4. 点击「详情」→「配置」
5. 在「环境变量」中添加：
   - 键名：`GLM_API_KEY`
   - 值：你的智谱API Key（格式如：`id.secret`）
6. 保存并重新部署云函数

### 3. 部署云函数

在微信开发者工具中：

1. 右键点击 `cloudfunctions/analyze-kline` 文件夹
2. 选择「上传并部署：云端安装依赖」
3. 等待部署完成

### 4. 批量生成报告

这是关键步骤，只需执行一次：

1. 打开小程序，进入「数据管理」页面
2. 点击「🚀 开始批量生成」按钮
3. 等待5-15分钟，所有报告将生成并存储到数据库
4. 生成完成后，用户即可查看报告

**重要提示：**
- 首次使用或数据更新后需要重新生成
- 批量生成会产生API费用（约186份报告）
- 生成过程可以中断，已生成的报告会保存

## 使用说明

### 用户端（首页）

1. 在首页选择城市和显示模式
2. 等待K线图加载完成
3. 点击「✨ AI生成分析报告」按钮
4. **毫秒级响应**，直接显示报告

### 管理端（数据管理页面）

1. 进入「数据管理」页面
2. 查看已生成报告列表和统计
3. 需要时可重新批量生成报告

## 费用说明

**一次性费用：**
- 共31个城市 × 6个模式 = 186份报告
- 每份报告约消耗 300-500 tokens
- GLM-4.7 定价：¥0.5/百万tokens（输入）
- **预估总费用：¥0.3-0.5元**

**后续使用：**
- 用户查看报告直接从数据库读取
- **零额外费用**

详情请参考：https://open.bigmodel.cn/pricing

## 常见问题

**Q: 提示"报告尚未生成"？**
A: 首次使用需要在管理后台批量生成报告。

**Q: 数据更新后怎么办？**
A: 在管理后台重新执行批量生成，会覆盖更新已有报告。

**Q: 批量生成需要多久？**
A: 约5-15分钟，取决于网络速度和API响应时间。

**Q: 可以中断生成过程吗？**
A: 可以，已生成的报告会保存。可以稍后继续生成。

**Q: 如何更换API Key？**
A: 在云开发控制台修改环境变量后重新部署云函数即可。

## 技术说明

### 数据库结构

**集合：kline_analysis**

```javascript
{
  _id: ObjectId,
  city: "Beijing",        // 城市英文代码
  cityName: "北京",        // 城市中文名称
  mode: "original",        // 模式值
  report: "报告内容...",   // AI生成的报告
  createTime: ISODate,     // 创建时间
  updateTime: ISODate      // 更新时间
}
```

### 云函数API

**action: 'get'** - 获取报告
```javascript
wx.cloud.callFunction({
  name: 'analyze-kline',
  data: {
    action: 'get',
    city: 'Beijing',
    mode: 'original'
  }
})
```

**action: 'generate'** - 生成报告
```javascript
wx.cloud.callFunction({
  name: 'analyze-kline',
  data: {
    action: 'generate',
    city: 'Beijing',
    cityName: '北京',
    mode: 'original',
    klineData: [...]  // 周K线数据
  }
})
```

**action: 'list'** - 列出所有报告
```javascript
wx.cloud.callFunction({
  name: 'analyze-kline',
  data: {
    action: 'list'
  }
})
```

**action: 'stats'** - 获取统计
```javascript
wx.cloud.callFunction({
  name: 'analyze-kline',
  data: {
    action: 'stats'
  }
})
```

## API参考

- 智谱AI文档：https://docs.bigmodel.cn/
- GLM-4.7模型：https://open.bigmodel.cn/dev/api
