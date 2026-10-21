
# JavaScript 模块化演进史：IIFE 到 ES Modules

JavaScript 的模块化之路走得异常曲折。从全局污染到标准化 ES Modules，这条路走了 20 年。


## 全局变量时代（1995-2005）

所有代码共享全局作用域。用命名空间前缀（如 `var app = app || {}`）来避免冲突。问题：命名冲突、依赖顺序混乱、全局污染严重。


## IIFE 时代（2005-2010）

立即执行函数表达式创建私有作用域。通过闭包隐藏内部变量，只暴露公共 API。jQuery 就是典型例子。优势：私有作用域。问题：仍需手动管理依赖。


## CommonJS（2009）

Node.js 采用的模块规范。`require()` 同步加载，module.exports 导出。每个文件是一个模块，有自己的作用域。优势：简单直接。问题：同步加载不适合浏览器。


## AMD（2011）

Asynchronous Module Definition，用于浏览器环境。RequireJS 是最流行的实现。define() 定义模块，异步加载依赖。解决了浏览器异步加载的问题。


## ES Modules（2015至今）

JavaScript 官方的模块标准。import / export 语法。静态分析（支持 Tree Shaking）、异步加载、命名空间隔离。动态 import() 实现代码分割。


## 总结

ES Modules 是 JavaScript 模块化的最终答案。它提供了静态分析（Tree Shaking）、异步加载、命名空间隔离等所有现代需求。了解这段历史有助于理解各种构建工具的底层原理。
