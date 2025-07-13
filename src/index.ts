import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

const server = new McpServer({
  name: "playwright-mcp-server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

server.tool(
  "get-alerts",
  "获取指定州的天气警报",
  {
    state: z.string().length(2).describe("美国州代码，如 CA, NY"),
  },
  async ({ state }) => {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest<{ features: any[] }>(alertsUrl);
    if (!alertsData) {
      return { content: [{ type: "text", text: "无法获取警报数据" }] };
    }
    const features = alertsData.features || [];
    if (features.length === 0) {
      return { content: [{ type: "text", text: `该州无活跃警报: ${stateCode}` }] };
    }
    const formattedAlerts = features.map((feature) => {
      const props = feature.properties;
      return [
        `事件: ${props.event || "未知"}`,
        `区域: ${props.areaDesc || "未知"}`,
        `严重性: ${props.severity || "未知"}`,
        `状态: ${props.status || "未知"}`,
        `标题: ${props.headline || "无标题"}`,
        "---",
      ].join("\n");
    });
    return { content: [{ type: "text", text: formattedAlerts.join("\n") }] };
  }
);

server.tool(
  "get-forecast",
  "获取指定位置的天气预报",
  {
    latitude: z.number().min(-90).max(90).describe("纬度"),
    longitude: z.number().min(-180).max(180).describe("经度"),
  },
  async ({ latitude, longitude }) => {
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest<{ properties: { forecast?: string } }>(pointsUrl);
    if (!pointsData) {
      return { content: [{ type: "text", text: `无法获取网格点数据: ${latitude}, ${longitude}` }] };
    }
    const forecastUrl = pointsData.properties?.forecast;
    if (!forecastUrl) {
      return { content: [{ type: "text", text: "未获取到预报 URL" }] };
    }
    const forecastData = await makeNWSRequest<{ properties: { periods: any[] } }>(forecastUrl);
    if (!forecastData) {
      return { content: [{ type: "text", text: "无法获取预报数据" }] };
    }
    const periods = forecastData.properties?.periods || [];
    if (periods.length === 0) {
      return { content: [{ type: "text", text: "无可用预报" }] };
    }
    const formattedForecast = periods.map((period: any) => [
      `${period.name || "未知"}:`,
      `温度: ${period.temperature || "未知"}°${period.temperatureUnit || "F"}`,
      `风: ${period.windSpeed || "未知"} ${period.windDirection || ""}`,
      `${period.shortForecast || "无预报"}`,
      "---",
    ].join("\n"));
    return { content: [{ type: "text", text: formattedForecast.join("\n") }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Playwright MCP Server 已通过 stdio 运行");
}

main().catch((error) => {
  console.error("main() 错误:", error);
  process.exit(1);
});
