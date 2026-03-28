#!/usr/bin/env node
/**
 * 云函数部署脚本
 * 用法:
 *   node scripts/deploy-cloud-functions.js          # 部署所有云函数
 *   node scripts/deploy-cloud-functions.js auth     # 部署单个
 *   node scripts/deploy-cloud-functions.js auth schedule  # 部署多个
 */

const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

// ─── 配置 ───────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..')
const CF_ROOT = path.join(ROOT, 'cloudfunctions')
const ENV_ID = 'cloud1-1g0kf2p8b07af20f'
const APPID = 'wx8db7f3de48496906'
const PRIVATE_KEY_PATH = path.join(ROOT, 'private.wx8db7f3de48496906.key')

/** 需要部署的云函数列表（自动发现有 package.json 的目录） */
function discoverFunctions() {
  return fs.readdirSync(CF_ROOT).filter(name => {
    const pkgPath = path.join(CF_ROOT, name, 'package.json')
    return fs.existsSync(pkgPath)
  })
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
function log(msg) { process.stdout.write(msg) }
function ok()     { console.log(' ✅') }
function fail(e)  { console.log(` ❌\n  ${e.message || e}`) }

function pnpmInstall(fnName) {
  const dir = path.join(CF_ROOT, fnName)
  const result = spawnSync('pnpm', ['install', '--silent'], {
    cwd: dir,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'pnpm install failed')
  }
}

/**
 * 构建临时函数目录：复制源码 + shared，并将 require 路径修正为 ./shared/
 * 解决云函数部署时 shared 目录不在函数包内的问题
 */
function buildFnDir(fnName) {
  const srcDir = path.join(CF_ROOT, fnName)
  const sharedSrc = path.join(ROOT, 'shared')
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `lexue-${fnName}-`))

  // 递归复制函数目录（排除 node_modules）
  copyDirSync(srcDir, tmpDir, ['node_modules'])

  // 把 shared/ 复制进去
  copyDirSync(sharedSrc, path.join(tmpDir, 'shared'))

  // 修正所有 JS 文件里的 require 路径：../../shared/ → ./shared/
  fixRequirePaths(tmpDir)

  return tmpDir
}

/** 递归复制目录 */
function copyDirSync(src, dest, excludes = []) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (excludes.includes(entry.name)) continue
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, excludes)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/** 递归替换目录下所有 .js 文件中的 shared 路径 */
function fixRequirePaths(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      fixRequirePaths(fullPath)
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8')
      // 兼容各种层级的 ../../shared/ 引用，统一改为 ./shared/
      const fixed = content.replace(/require\(['"](?:\.\.\/)+shared\//g, "require('./shared/")
      if (fixed !== content) {
        fs.writeFileSync(fullPath, fixed, 'utf8')
      }
    }
  }
}

/**
 * 使用腾讯云 API 创建云函数（通过 wx-server-sdk 在云端创建）
 * 因为 miniprogram-ci 不支持创建函数，我们创建一个临时函数来完成
 */
function createFunctionViaAPI(fnName) {
  // 使用腾讯云 SCF SDK 创建函数
  const { ScfClient } = require('tencentcloud-sdk-nodejs/scf')
  const { Credential } = require('tencentcloud-sdk-nodejs/common')

  // 从私钥文件读取信息（如果有的话）
  // 这里我们使用一个更简单的方式：通过调用已有的云函数来创建

  // 实际上最简单的方式是提示用户在控制台创建
  throw new Error(`云函数 ${fnName} 不存在，请先在云开发控制台创建`)
}

function deployFunction(fnName) {
  const tmpDir = buildFnDir(fnName)
  try {
    const cmd = [
      'npx', 'miniprogram-ci',
      'cloud', 'functions', 'upload',
      '--appid', APPID,
      '--private-key-path', PRIVATE_KEY_PATH,
      '--project-path', ROOT,
      '--env', ENV_ID,
      '--name', fnName,
      '--path', tmpDir,
      '--remote-npm-install',  // 云端自动 npm install，不上传 node_modules
    ].join(' ')

    execSync(cmd, { cwd: ROOT, stdio: 'pipe' })
  } catch (e) {
    // 如果是函数不存在的错误，给出提示
    if (e.message?.includes('ResourceNotFound.Function')) {
      console.log(`\n  ⚠️  云函数 ${fnName} 不存在，请先在云开发控制台创建：`)
      console.log(`     1. 打开 https://console.cloud.tencent.com/tcb`)
      console.log(`     2. 选择环境 ${ENV_ID}`)
      console.log(`     3. 进入 云函数 → 新建云函数`)
      console.log(`     4. 函数名称: ${fnName}`)
      console.log(`     5. 运行环境: Nodejs16`)
      console.log(`     6. 创建后重新运行此脚本\n`)
    }
    throw e
  } finally {
    // 无论成败都清理临时目录
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const allFunctions = discoverFunctions()
  const targets = args.length > 0 ? args : allFunctions

  // 校验参数
  const invalid = targets.filter(n => !allFunctions.includes(n))
  if (invalid.length > 0) {
    console.error(`❌ 找不到云函数: ${invalid.join(', ')}`)
    console.error(`   可用: ${allFunctions.join(', ')}`)
    process.exit(1)
  }

  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error(`❌ 找不到私钥文件: ${PRIVATE_KEY_PATH}`)
    console.error('   请从微信公众平台下载上传密钥并放到项目根目录')
    process.exit(1)
  }

  console.log(`\n🚀 开始部署云函数 (共 ${targets.length} 个)\n`)

  const results = { success: [], fail: [] }

  for (const fnName of targets) {
    // Step 1: pnpm install
    log(`  [${fnName}] pnpm install...`)
    try {
      pnpmInstall(fnName)
      log(' ✓  deploy...')
    } catch (e) {
      fail(e)
      results.fail.push(fnName)
      continue
    }

    // Step 2: 上传云函数
    try {
      deployFunction(fnName)
      ok()
      results.success.push(fnName)
    } catch (e) {
      fail(e)
      results.fail.push(fnName)
    }
  }

  // 汇总
  console.log('\n─────────────────────────────────')
  if (results.success.length > 0) {
    console.log(`✅ 成功 (${results.success.length}): ${results.success.join(', ')}`)
  }
  if (results.fail.length > 0) {
    console.log(`❌ 失败 (${results.fail.length}): ${results.fail.join(', ')}`)
    process.exit(1)
  }
  console.log('─────────────────────────────────\n')
}

main().catch(e => {
  console.error('❌ 脚本异常:', e.message)
  process.exit(1)
})
