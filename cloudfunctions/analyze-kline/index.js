// cloudfunctions/analyze-kline/index.js
const cloud = require("wx-server-sdk");
const { GLM_CONFIG } = require("./config.js");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

/**
 * 调用GLM API生成K线分析
 */
async function callGLMAPI(klineData, cityName, mode) {
  // 构造统计数据
  const ups = klineData.filter((k) => k.close > k.open).length;
  const downs = klineData.filter((k) => k.close < k.open).length;
  const avgChange =
    klineData.reduce((sum, k) => sum + (k.close - k.open), 0) /
    klineData.length;
  const maxHigh = Math.max(...klineData.map((k) => k.high));
  const minLow = Math.min(...klineData.map((k) => k.low));

  const dataSummary = {
    city: cityName,
    mode: mode,
    totalWeeks: klineData.length,
    dateRange: `${klineData[0]?.date || ""} 至 ${
      klineData[klineData.length - 1]?.date || ""
    }`,
  };

  const systemPrompt = `你是一位擅长在社交媒体上创作爆款内容的数据分析师和天气达人。请根据温度K线数据，生成一份具有强社交传播属性的年度天气分析报告。

📱 **目标平台**：小红书、朋友圈、微博等社交媒体

✨ **核心要求**：
1. **标题党**：用引人注目的标题（10-15字），制造好奇心和共鸣
2. **金句频出**：每段都要有可被引用的金句，便于做成海报文字
3. **情感共鸣**：将天气数据与生活、心情、回忆联系起来
4. **话题性**：创造讨论点，让读者想评论互动
5. **数据故事化**：把数字变成有温度的故事
6. **视觉友好**：用emoji、分段、短句，适合快速阅读和做成海报

📋 **报告结构**（600-800字）：
- 【吸睛标题】
- 【开场白】1-2句话制造悬念或共鸣
- 【数据有戏】3-4个有趣的数据洞察（配emoji）
- 【你的故事】将数据与读者生活联系起来
- 【话题讨论】提出1-2个互动问题
- 【话题标签】3-5个相关话题

💡 **传播技巧**：
- 多用"你"而不是"大家"，制造对话感
- 用反问句、感叹句增加情绪
- 制造"没想到"、"原来如此"的惊喜感
- 加入地域特色和人文关怀

请根据以下数据生成报告：`;

  const userContent = `📍 城市：${dataSummary.city}
📊 数据模式：${mode}
📅 时间范围：${dataSummary.dateRange}
⏱️ 总周数：${dataSummary.totalWeeks}周

📈 核心数据：
• 温度"上涨"的周数：${ups}周（感觉越来越暖）
• 温度"下跌"的周数：${downs}周（突然的冷意）
• 平均变化幅度：${avgChange.toFixed(2)}℃
• 年度最高点：${maxHigh.toFixed(2)}℃
• 年度最低点：${minLow.toFixed(2)}℃
• 极差：${(maxHigh - minLow).toFixed(2)}℃

请根据这些数据，创作一篇适合在小红书/朋友圈发布的年度天气报告！让读者看到后想转发、想讨论！`;

  try {
    const response = await new Promise((resolve, reject) => {
      const https = require("https");
      const url = require("url");

      const parsedUrl = url.parse(GLM_CONFIG.API_URL);
      const postData = JSON.stringify({
        model: GLM_CONFIG.MODEL,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      });

      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GLM_CONFIG.API_KEY}`,
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const jsonData = JSON.parse(data);
            if (jsonData.choices && jsonData.choices[0]) {
              resolve(jsonData.choices[0].message.content);
            } else {
              reject(new Error("API返回数据格式错误"));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });

    return response;
  } catch (error) {
    console.error("GLM API调用失败:", error);
    throw error;
  }
}

/**
 * 云函数主入口
 * action: 'generate' - 生成并保存报告
 * action: 'get' - 获取已保存的报告
 * action: 'list' - 列出所有报告
 * action: 'stats' - 获取统计数据
 */
exports.main = async (event, context) => {
  const { action, city, cityName, mode, klineData } = event;

  // 检查API Key
  if (!GLM_CONFIG.API_KEY) {
    return {
      success: false,
      error: "GLM_API_KEY未配置，请在 cloudfunctions/config.js 中配置",
    };
  }

  if (action === "get") {
    // 从数据库获取报告
    try {
      const result = await db
        .collection("kline_analysis")
        .where({
          city: city,
          mode: mode,
        })
        .get();

      if (result.data.length > 0) {
        return {
          success: true,
          report: result.data[0].report,
          timestamp: result.data[0].updateTime || result.data[0].createTime,
        };
      } else {
        return {
          success: false,
          error: "报告尚未生成",
        };
      }
    } catch (error) {
      console.error("查询报告失败:", error);
      return {
        success: false,
        error: "查询报告失败",
      };
    }
  }

  if (action === "list") {
    // 列出所有报告
    try {
      const result = await db
        .collection("kline_analysis")
        .orderBy("updateTime", "desc")
        .limit(100)
        .get();

      return {
        success: true,
        reports: result.data,
      };
    } catch (error) {
      console.error("查询报告列表失败:", error);
      return {
        success: false,
        error: "查询报告列表失败",
      };
    }
  }

  if (action === "stats") {
    // 获取统计数据
    try {
      const result = await db.collection("kline_analysis").get();

      const cities = new Set();
      const modes = new Set();

      result.data.forEach((item) => {
        cities.add(item.city);
        modes.add(item.mode);
      });

      return {
        success: true,
        stats: {
          totalReports: result.data.length,
          totalCities: cities.size,
          totalModes: modes.size,
        },
      };
    } catch (error) {
      console.error("获取统计数据失败:", error);
      return {
        success: false,
        error: "获取统计数据失败",
      };
    }
  }

  if (action === "generate") {
    // 生成新报告并保存到数据库
    if (!klineData || !Array.isArray(klineData) || klineData.length === 0) {
      return {
        success: false,
        error: "K线数据无效",
      };
    }

    if (!city || !cityName || !mode) {
      return {
        success: false,
        error: "缺少必要参数",
      };
    }

    try {
      // 调用GLM API生成分析报告
      const report = await callGLMAPI(klineData, cityName, mode);

      const now = new Date().toISOString();

      // 检查是否已存在报告
      const existing = await db
        .collection("kline_analysis")
        .where({
          city: city,
          mode: mode,
        })
        .get();

      if (existing.data.length > 0) {
        // 更新现有报告
        await db
          .collection("kline_analysis")
          .doc(existing.data[0]._id)
          .update({
            data: {
              report: report,
              updateTime: now,
            },
          });
      } else {
        // 创建新报告
        await db.collection("kline_analysis").add({
          data: {
            city: city,
            cityName: cityName,
            mode: mode,
            report: report,
            createTime: now,
            updateTime: now,
          },
        });
      }

      return {
        success: true,
        report: report,
        timestamp: now,
      };
    } catch (error) {
      console.error("生成分析报告失败:", error);
      return {
        success: false,
        error: error.message || "生成分析报告失败，请稍后重试",
      };
    }
  }

  return {
    success: false,
    error: "无效的action参数",
  };
};
