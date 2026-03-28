const ci = require('miniprogram-ci')
const path = require('path')
const config = require('../miniprogram-ci.config.js')

const project = new ci.Project(config)

ci.preview({
  project,
  version: '1.0.0-preview',
  desc: '预览',
  setting: {
    es6: true,
    es7: true,
    minify: true,
    autoPrefixWXSS: true,
    disableUseStrict: true,
  },
  qrcodeFormat: 'image',
  qrcodeOutputDest: path.resolve(__dirname, '../qrcode.jpg'),
}).then(res => {
  console.log('预览成功，二维码已保存到 qrcode.jpg')
  console.log(res)
}).catch(err => {
  console.error('预览失败:', err)
  process.exit(1)
})
