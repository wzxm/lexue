const path = require('path')
const fs = require('fs')

const APP_ID = 'wx8db7f3de48496906'

function resolvePrivateKeyPath() {
  // Prefer explicit env var in CI/local shells.
  if (process.env.WX_PRIVATE_KEY_PATH) {
    return path.resolve(process.env.WX_PRIVATE_KEY_PATH)
  }

  const candidates = [
    path.resolve(__dirname, `private.${APP_ID}.key`),
    path.resolve(__dirname, `../private.${APP_ID}.key`),
  ]

  const found = candidates.find(filePath => fs.existsSync(filePath))
  if (!found) {
    throw new Error(
      `Missing private key file. Checked: ${candidates.join(', ')}. ` +
      'Set WX_PRIVATE_KEY_PATH to your key file path.',
    )
  }

  return found
}

module.exports = {
  appid: APP_ID,
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, 'dist'),
  privateKeyPath: resolvePrivateKeyPath(),
  ignores: ['node_modules/**/*'],
}
