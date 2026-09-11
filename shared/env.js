/**
 * 本地调试读仓库根目录 .env；线上云函数环境变量已注入，文件不存在则跳过。
 */

const fs = require('fs');
const path = require('path');

let loaded = false;

function loadLocalEnvFile() {
  if (loaded) return;
  loaded = true;
  const envFile = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function resolveCloudEnv(dynamicEnv) {
  loadLocalEnvFile();
  const fromEnv = (process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV || '').trim();
  return fromEnv || dynamicEnv;
}

module.exports = {
  loadLocalEnvFile,
  resolveCloudEnv,
};
