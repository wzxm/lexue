// SVG 文件类型声明
declare module '*.svg' {
  const content: string
  export default content
}

// PNG 文件类型声明
declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

// 样式文件类型声明；项目未启用 CSS Modules，样式只做副作用导入，无导出成员
declare module '*.scss' {}
declare module '*.css' {}
