const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "ios", "App", "App", "capacitor.config.json");
const pluginNames = ["VoiceCommandsPlugin", "SecureTokenPlugin", "CalendarPlugin", "AlarmKitPlugin"];

const raw = fs.readFileSync(configPath, "utf8");
const json = JSON.parse(raw);
const list = Array.isArray(json.packageClassList) ? json.packageClassList : [];

const next = Array.from(new Set([...list, ...pluginNames]));
json.packageClassList = next;

fs.writeFileSync(configPath, JSON.stringify(json, null, 2));
