// 使用express服务，覆盖了nuxt服务
// 则nuxtconfig中的 server.port = 9999 无效，因为该nuxt服务未启动
// 主要目的是添加响应头（nuxt服务无法添加），实现arraybuffer可用

const { Nuxt, Builder } = require('nuxt')
const app = require('express')()
const port = process.env.PORT || 3333

// 传入配置初始化 Nuxt.js 实例
const config = require('../nuxt.config.js')
const nuxt = new Nuxt(config)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(function (req, res, next) {
  // response.header( 'Access-Control-Allow-Origin' , '*') // 跨域最重要的一步 设置响应头
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  next() // 执行next函数执行后续代码
})

app.use(nuxt.render)
// 在开发模式下进行编译
if (config.dev) {
  new Builder(nuxt).build()
}

// 监听指定端口
app.listen(port, '0.0.0.0')
global.console.log('我搭建的服务器运行于 localhost:' + port)
