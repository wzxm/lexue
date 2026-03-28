const ci = require('miniprogram-ci')
const config = require('../miniprogram-ci.config.js')

const project = new ci.Project(config)

ci.packNpm(project, {
  ignores: ['pack_npm_ignore_list'],
}).then(res => {
  console.log('构建 npm 成功:', res)
}).catch(err => {
  console.error('构建 npm 失败:', err)
  process.exit(1)
})
