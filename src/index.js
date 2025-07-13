"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";
const server = new mcp_js_1.McpServer({
    name: "playwright-mcp-server",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});
function makeNWSRequest(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            "User-Agent": USER_AGENT,
            Accept: "application/geo+json",
        };
        try {
            const response = yield fetch(url, { headers });
            if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);
            return (yield response.json());
        }
        catch (error) {
            console.error("Error making NWS request:", error);
            return null;
        }
    });
}
server.tool("get-alerts", "获取指定州的天气警报", {
    state: zod_1.z.string().length(2).describe("美国州代码，如 CA, NY"),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ state }) {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = yield makeNWSRequest(alertsUrl);
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
}));
server.tool("get-forecast", "获取指定位置的天气预报", {
    latitude: zod_1.z.number().min(-90).max(90).describe("纬度"),
    longitude: zod_1.z.number().min(-180).max(180).describe("经度"),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ latitude, longitude }) {
    var _b, _c;
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = yield makeNWSRequest(pointsUrl);
    if (!pointsData) {
        return { content: [{ type: "text", text: `无法获取网格点数据: ${latitude}, ${longitude}` }] };
    }
    const forecastUrl = (_b = pointsData.properties) === null || _b === void 0 ? void 0 : _b.forecast;
    if (!forecastUrl) {
        return { content: [{ type: "text", text: "未获取到预报 URL" }] };
    }
    const forecastData = yield makeNWSRequest(forecastUrl);
    if (!forecastData) {
        return { content: [{ type: "text", text: "无法获取预报数据" }] };
    }
    const periods = ((_c = forecastData.properties) === null || _c === void 0 ? void 0 : _c.periods) || [];
    if (periods.length === 0) {
        return { content: [{ type: "text", text: "无可用预报" }] };
    }
    const formattedForecast = periods.map((period) => [
        `${period.name || "未知"}:`,
        `温度: ${period.temperature || "未知"}°${period.temperatureUnit || "F"}`,
        `风: ${period.windSpeed || "未知"} ${period.windDirection || ""}`,
        `${period.shortForecast || "无预报"}`,
        "---",
    ].join("\n"));
    return { content: [{ type: "text", text: formattedForecast.join("\n") }] };
}));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const transport = new stdio_js_1.StdioServerTransport();
        yield server.connect(transport);
        console.error("Playwright MCP Server 已通过 stdio 运行");
    });
}
main().catch((error) => {
    console.error("main() 错误:", error);
    process.exit(1);
});
