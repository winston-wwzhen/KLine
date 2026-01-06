// cloudfunctions/analyze-kline/index.js
const cloud = require("wx-server-sdk");
const { GLM_CONFIG } = require("./config.js");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

/**
 * Sleep 工具函数
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 解析AI返回的结果，提取关键词和报告
 */
function parseAIResponse(response) {
  try {
    // 查找JSON数组部分（关键词）
    const jsonArrayMatch = response.match(/^\s*\[[\s\S]*?\]\s*(?:\n|$)/);
    let keywords = [];
    let report = response;

    if (jsonArrayMatch) {
      try {
        keywords = JSON.parse(jsonArrayMatch[0]);
        // 移除关键词部分，保留报告
        report = response.substring(jsonArrayMatch[0].length).trim();

        // 如果报告以 "---" 或 "===" 等分隔符开头，移除它们
        report = report.replace(/^[-=]{3,}\s*\n/, '').trim();
      } catch (e) {
        // JSON解析失败，整个内容都是报告
        console.warn("关键词JSON解析失败:", e.message);
        keywords = [];
        report = response;
      }
    }

    return { keywords, report };
  } catch (error) {
    console.error("解析AI响应失败:", error);
    return { keywords: [], report: response };
  }
}

/**
 * 单次调用 GLM API（不含重试逻辑）
 */
async function callGLMAPISingle(systemPrompt, userContent) {
  return new Promise((resolve, reject) => {
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
        // 检查 HTTP 状态码
        if (res.statusCode === 429) {
          console.error("API 429 限流:", data);
          reject(new Error("API_RATE_LIMIT"));
          return;
        }
        if (res.statusCode !== 200) {
          console.error(`API HTTP错误 ${res.statusCode}:`, data);
          reject(new Error(`HTTP_${res.statusCode}: ${data}`));
          return;
        }

        try {
          const jsonData = JSON.parse(data);
          console.log("API返回数据:", JSON.stringify(jsonData).substring(0, 500));

          if (jsonData.choices && jsonData.choices[0]) {
            resolve(jsonData.choices[0].message.content);
          } else {
            console.error("API返回数据格式错误，完整响应:", data);
            reject(new Error(`API返回数据格式错误: ${data}`));
          }
        } catch (error) {
          console.error("JSON解析失败，原始数据:", data);
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
}

/**
 * 获取模式配置和单位
 */
function getModeInfo(mode) {
  const modeConfigs = {
    'original': {
      label: '原始温度',
      unit: '°C',
      meaning: '实际温度值',
      analysis: '关注季节变化、温度波动、寒潮热浪'
    },
    'zscore': {
      label: 'Z-score标准化',
      unit: 'σ',
      meaning: '标准化值（0为全年平均）',
      analysis: '关注异常周、偏离平均的程度、极端天气'
    },
    'range': {
      label: '昼夜温差',
      unit: '°C',
      meaning: '每日最高温与最低温的差值',
      analysis: '关注天气稳定性、温差变化、穿衣调整'
    },
    'cumulative': {
      label: '累积距平',
      unit: '°C',
      meaning: '累积的温度偏差',
      analysis: '关注全年趋势、冷暖阶段转换、持续偏暖/偏冷期'
    },
    'acceleration': {
      label: '温度加速度',
      unit: '°C',
      meaning: '温度变化的变化率',
      analysis: '关注温度变化的快慢、转折点、加速升温/降温期'
    }
  };
  return modeConfigs[mode] || modeConfigs['original'];
}

/**
 * 调用GLM API生成K线分析（带重试机制）
 */
async function callGLMAPI(klineData, cityName, mode) {
  // 获取模式信息
  const modeInfo = getModeInfo(mode);

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

  const systemPrompt = `你是一位擅长在社交媒体上创作爆款内容的数据分析师和天气达人。请根据**2025年度**的温度K线数据，生成一份具有强社交传播属性的天气分析报告。

⚠️ **重要提示**：
- 分析的数据是 **2025年** 的全年天气数据
- 报告中必须明确提及"2025年"，**严禁使用"今年"、"今年度"等模糊表述**
- 报告是回顾性质的，是对2025年天气的总结

📋 **输出格式**：
请按以下顺序输出：

1. 首先输出 **3-5个关键词**（JSON数组格式）
   - 每个关键词2-4个字
   - 概括该城市2025年天气的核心特点
   - 直接返回JSON数组，如：["温差大", "四季分明", "穿衣困难"]

2. 然后输出完整的分析报告

---

📱 **目标平台**：小红书、朋友圈、微博等社交媒体

✨ **报告核心要求**：
1. **标题党**：用引人注目的标题（10-15字），制造好奇心和共鸣
2. **金句频出**：每段都要有可被引用的金句，便于做成海报文字
3. **情感共鸣**：将2025年的天气数据与生活、心情、回忆联系起来
4. **话题性**：创造讨论点，让读者想评论互动
5. **数据故事化**：把数字变成有温度的故事
6. **视觉友好**：用emoji、分段、短句，适合快速阅读和做成海报
7. **精简有力**：用户没有耐心看长文，要短小精悍，直击要点

📋 **报告结构**（300-400字，精简有力）：
- 【吸睛标题】提及"2025"
- 【开场白】1句话制造悬念或共鸣
- 【数据亮点】2-3个最有趣的数据洞察（配emoji），**明确提及"2025年"**
- 【你的故事】将2025年的天气与读者生活联系起来
- 【话题讨论】1个互动问题
- 【话题标签】2-3个相关话题

💡 **传播技巧**：
- 多用"你"而不是"大家"，制造对话感
- 用反问句、感叹句增加情绪
- 制造"没想到"、"原来如此"的惊喜感
- 加入地域特色和人文关怀
- **时刻记住：这是2025年的回顾总结**
- **控制篇幅，用户没有耐心看长文**

请根据以下2025年度数据生成报告：`;

  const userContent = `📍 城市：${dataSummary.city}
📊 数据模式：${modeInfo.label}（${modeInfo.meaning}）
📅 时间范围：2025年 ${dataSummary.dateRange}
⏱️ 总周数：${dataSummary.totalWeeks}周

📈 2025年核心数据：
• "上涨"的周数：${ups}周
• "下跌"的周数：${downs}周
• 平均变化幅度：${avgChange.toFixed(2)}${modeInfo.unit}
• 2025年度最高点：${maxHigh.toFixed(2)}${modeInfo.unit}
• 2025年度最低点：${minLow.toFixed(2)}${modeInfo.unit}
• 极差：${(maxHigh - minLow).toFixed(2)}${modeInfo.unit}

🎯 **本次分析重点**：${modeInfo.analysis}

请根据这些2025年的${modeInfo.label}数据，先输出3-5个关键词（JSON数组），然后创作一篇适合在小红书/朋友圈发布的2025年度天气回顾报告！让读者看到后想转发、想讨论！`;

  // 重试逻辑
  const maxRetries = GLM_CONFIG.MAX_RETRIES || 3;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await callGLMAPISingle(systemPrompt, userContent);
      return response;
    } catch (error) {
      lastError = error;
      console.error(`GLM API调用失败 (第${attempt + 1}次尝试):`, error.message);

      // 判断错误类型
      const isRateLimit = error.message === "API_RATE_LIMIT";
      const isNetworkError = error.message.includes("ECONNRESET") ||
                           error.message.includes("ETIMEDOUT") ||
                           error.message.includes("ENOTFOUND");

      // 如果是最后一次尝试，不再重试
      if (attempt === maxRetries - 1) {
        break;
      }

      // 计算等待时间（指数退避）
      let waitTime = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s

      // 如果是频率限制，等待更长时间
      if (isRateLimit) {
        waitTime = 5000 * Math.pow(2, attempt); // 5s, 10s, 20s
        console.warn(`触发API频率限制，等待 ${waitTime / 1000} 秒后重试...`);
      } else if (isNetworkError) {
        console.warn(`网络错误，等待 ${waitTime / 1000} 秒后重试...`);
      } else {
        console.warn(`等待 ${waitTime / 1000} 秒后重试...`);
      }

      // 等待后重试
      await sleep(waitTime);
    }
  }

  // 所有重试都失败
  console.error("GLM API调用失败，已达到最大重试次数:", lastError);
  throw lastError || new Error("GLM API调用失败");
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
          keywords: result.data[0].keywords || [],
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
      const aiResponse = await callGLMAPI(klineData, cityName, mode);

      // 解析AI返回的结果，提取关键词和报告
      const { keywords, report } = parseAIResponse(aiResponse);

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
              keywords: keywords,
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
            keywords: keywords,
            createTime: now,
            updateTime: now,
          },
        });
      }

      return {
        success: true,
        report: report,
        keywords: keywords,
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
