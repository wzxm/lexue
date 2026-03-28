// pnpm 钩子：覆盖 webpack peer dependency 要求
function readPackage(pkg, context) {
  return pkg;
}

module.exports = { hooks: { readPackage } };
