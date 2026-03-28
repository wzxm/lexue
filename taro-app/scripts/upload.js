const ci = require('miniprogram-ci')
const config = require('../miniprogram-ci.config.js')

const project = new ci.Project(config)

const version = process.argv[2] || '1.0.0'
const desc = process.argv[3] || `上传于 ${new Date().toLocaleString()}`

ci.upload({
  project,
  version,
  desc,
  setting: {
    es6: true,
    es7: true,
    minify: true,
    autoPrefixWXSS: true,
    disableUseStrict: true,
  },
}).then(res => {
  console.log('上传成功:', res)
}).catch(err => {
  console.error('上传失败:', err)
  process.exit(1)
})
