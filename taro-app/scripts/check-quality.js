const ci = require('miniprogram-ci')
const config = require('../miniprogram-ci.config.js')

const project = new ci.Project(config)

ci.checkCodeQuality(project).then(res => {
  console.log('代码质量检查结果:', res)
}).catch(err => {
  console.error('代码质量检查失败:', err)
  process.exit(1)
})
