const path = require('path')

module.exports = {
  appid: 'wx8db7f3de48496906',
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, 'dist'),
  privateKeyPath: path.resolve(__dirname, 'private.wx8db7f3de48496906.key'),
  ignores: ['node_modules/**/*'],
}
