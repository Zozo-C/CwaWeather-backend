require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 取得全台天氣預報
 * CWA 氣象資料開放平臺 API
 * 使用「一般天氣預報-今明 36 小時天氣預報」資料集
 */
const getAllWeather = async (req, res) => {
  try {
    // 檢查是否有設定 API Key
    if (!CWA_API_KEY) {
      return res.status(500).json({
        error: "伺服器設定錯誤",
        message: "請在 .env 檔案中設定 CWA_API_KEY",
      });
    }

    // 呼叫 CWA API - 一般天氣預報（36小時）
    // API 文件: https://opendata.cwa.gov.tw/dist/opendata-swagger.html
    // 不指定 locationName 即可取得全台資料
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
        },
      }
    );

    // 取得全台所有縣市的天氣資料
    const allLocations = response.data.records.location;

    if (!allLocations || allLocations.length === 0) {
      return res.status(404).json({
        error: "查無資料",
        message: "無法取得天氣資料",
      });
    }

    // 整理全台天氣資料
    const allWeatherData = {
      updateTime: response.data.records.datasetDescription,
      cities: [],
    };

    // 遍歷每個縣市
    allLocations.forEach((locationData) => {
      const cityWeatherData = {
        city: locationData.locationName,
        forecasts: [],
      };

      // 解析天氣要素
      const weatherElements = locationData.weatherElement;
      const timeCount = weatherElements[0].time.length;

      for (let i = 0; i < timeCount; i++) {
      const forecast = {
        startTime: weatherElements[0].time[i].startTime,
        endTime: weatherElements[0].time[i].endTime,
        weather: "",
        rain: "",
        minTemp: "",
        maxTemp: "",
        comfort: "",
        windSpeed: "",
      };

      weatherElements.forEach((element) => {
        const value = element.time[i].parameter;
        switch (element.elementName) {
          case "Wx":
            forecast.weather = value.parameterName;
            break;
          case "PoP":
            forecast.rain = value.parameterName + "%";
            break;
          case "MinT":
            forecast.minTemp = value.parameterName + "°C";
            break;
          case "MaxT":
            forecast.maxTemp = value.parameterName + "°C";
            break;
          case "CI":
            forecast.comfort = value.parameterName;
            break;
          case "WS":
            forecast.windSpeed = value.parameterName;
            break;
        }
      });

        cityWeatherData.forecasts.push(forecast);
      }

      allWeatherData.cities.push(cityWeatherData);
    });

    res.json({
      success: true,
      data: allWeatherData,
    });
  } catch (error) {
    console.error("取得天氣資料失敗:", error.message);

    if (error.response) {
      // API 回應錯誤
      return res.status(error.response.status).json({
        error: "CWA API 錯誤",
        message: error.response.data.message || "無法取得天氣資料",
        details: error.response.data,
      });
    }

    // 其他錯誤
    res.status(500).json({
      error: "伺服器錯誤",
      message: "無法取得天氣資料，請稍後再試",
    });
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      allWeather: "/api/weather/all",
      health: "/api/health",
    },
  });
});

// 健康檢查端點（部署平台常用）
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 根路徑的健康檢查（備用）
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString() 
  });
});

// 取得全台天氣預報
app.get("/api/weather/all", getAllWeather);

// 舊路徑相容性（指向相同功能）
app.get("/api/weather/kaohsiung", getAllWeather);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).json({
    error: "伺服器錯誤",
    message: process.env.NODE_ENV === "production" ? "發生錯誤" : err.message,
  });
});

// 404 handler - 必須放在最後
app.use((req, res) => {
  res.status(404).json({
    error: "找不到此路徑",
    requestedPath: req.path,
    method: req.method,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 伺服器運行於 http://0.0.0.0:${PORT}`);
  console.log(`📍 環境: ${process.env.NODE_ENV || "development"}`);
  console.log(`⏰ 啟動時間: ${new Date().toISOString()}`);
});
