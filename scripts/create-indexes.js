#!/usr/bin/env node
/**
 * 批量创建文档型数据库索引，并清理旧版 openid 相关遗留索引
 *
 * 用法：
 *   npm run create-indexes              # 创建新索引 + 删除遗留索引
 *   npm run create-indexes -- --dry-run # 仅预览
 *   npm run create-indexes -- --skip-drop # 只创建，不删旧索引
 *
 * 依赖根目录 .env：CLOUDBASE_ENV_ID、WX_APPID、WX_SECRET
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'schema', 'indexes.config.json');

function loadEnv() {
  const envFile = path.join(ROOT, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`JSON 解析失败: ${raw.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw || '{}'));
        } catch (e) {
          reject(new Error(`JSON 解析失败: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getAccessToken(appId, secret) {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}`;
  const data = await getJson(url);
  if (!data.access_token) {
    throw new Error(data.errmsg || data.errMsg || '获取 access_token 失败');
  }
  return data.access_token;
}

async function updateIndexesForCollection(accessToken, envId, collectionName, createIndexes, dropIndexes) {
  const url = `https://api.weixin.qq.com/tcb/updateindex?access_token=${encodeURIComponent(accessToken)}`;
  const body = {
    env: envId,
    collection_name: collectionName,
    create_indexes: createIndexes,
    drop_indexes: dropIndexes,
  };
  return postJson(url, body);
}

function isIgnorableCreateError(result) {
  const msg = String(result.errmsg || result.errMsg || '').toLowerCase();
  return (
    result.errcode === 0
    || msg.includes('already exist')
    || msg.includes('已存在')
    || msg.includes('duplicate')
  );
}

function isIgnorableDropError(result) {
  const msg = String(result.errmsg || result.errMsg || '').toLowerCase();
  return (
    result.errcode === 0
    || msg.includes('not exist')
    || msg.includes('不存在')
    || msg.includes('not found')
    || msg.includes('找不到')
  );
}

function uniqueNames(names) {
  return Array.from(new Set((names || []).map((name) => String(name).trim()).filter(Boolean)));
}

function buildDropList(config, collectionName, newIndexNames) {
  const globalLegacy = config.legacy_drop_indexes || [];
  const perCollection = (config.legacy_drop_by_collection || {})[collectionName] || [];
  const reserved = new Set(newIndexNames);

  return uniqueNames([...globalLegacy, ...perCollection])
    .filter((name) => !reserved.has(name))
    .map((name) => ({ name }));
}

function collectTargets(config) {
  const map = new Map();

  for (const item of config.collections || []) {
    map.set(item.name, {
      indexes: item.indexes || [],
      dropOnly: false,
    });
  }

  for (const name of config.legacy_only_collections || []) {
    if (!map.has(name)) {
      map.set(name, { indexes: [], dropOnly: true });
    }
  }

  return map;
}

async function main() {
  loadEnv();
  const dryRun = process.argv.includes('--dry-run');
  const skipDrop = process.argv.includes('--skip-drop');
  const envId = process.env.CLOUDBASE_ENV_ID || process.env.ENV_ID;
  const appId = process.env.WX_APPID || process.env.APPID;
  const secret = process.env.WX_SECRET;

  if (!envId || !appId || !secret) {
    console.error('缺少环境变量：请在 .env 配置 CLOUDBASE_ENV_ID、WX_APPID、WX_SECRET');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const targets = collectTargets(config);
  const totalCreate = [...targets.values()].reduce((sum, item) => sum + item.indexes.length, 0);
  let totalDrop = 0;
  for (const [name, item] of targets.entries()) {
    totalDrop += buildDropList(config, name, item.indexes.map((idx) => idx.name)).length;
  }

  console.log(`环境: ${envId}`);
  console.log(`计划创建 ${totalCreate} 个索引，清理 ${skipDrop ? 0 : totalDrop} 个遗留索引`);

  if (dryRun) {
    for (const [name, item] of targets.entries()) {
      console.log(`\n[${name}]`);
      for (const idx of item.indexes) {
        const fields = idx.keys.map((k) => `${k.name}:${k.direction}`).join(', ');
        console.log(`  + ${idx.name}${idx.unique ? ' (unique)' : ''} => ${fields}`);
      }
      if (!skipDrop) {
        const drops = buildDropList(config, name, item.indexes.map((idx) => idx.name));
        for (const drop of drops) {
          console.log(`  - ${drop.name}`);
        }
      }
    }
    return;
  }

  const accessToken = await getAccessToken(appId, secret);
  let created = 0;
  let dropped = 0;
  let failed = 0;

  for (const [name, item] of targets.entries()) {
    const indexes = item.indexes;
    const newNames = indexes.map((idx) => idx.name);

    if (indexes.length > 0) {
      process.stdout.write(`\n${name} create (${indexes.length}) ... `);
      try {
        const result = await updateIndexesForCollection(accessToken, envId, name, indexes, []);
        if (isIgnorableCreateError(result)) {
          console.log('✅');
          created += indexes.length;
        } else {
          console.log(`⚠️  ${result.errcode} ${result.errmsg || result.errMsg || ''}`);
          failed += indexes.length;
        }
      } catch (e) {
        console.log(`❌ ${e.message}`);
        failed += indexes.length;
      }
    }

    if (skipDrop) continue;

    const dropIndexes = buildDropList(config, name, newNames);
    if (dropIndexes.length === 0) continue;

    process.stdout.write(`${name} drop (${dropIndexes.length}) ... `);
    try {
      const result = await updateIndexesForCollection(accessToken, envId, name, [], dropIndexes);
      if (isIgnorableDropError(result)) {
        console.log('✅');
        dropped += dropIndexes.length;
      } else {
        console.log(`⚠️  ${result.errcode} ${result.errmsg || result.errMsg || ''}`);
        failed += dropIndexes.length;
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
      failed += dropIndexes.length;
    }
  }

  console.log('\n────────────────────────');
  console.log(`完成：创建 ${created}，删除遗留 ${dropped}，失败 ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
