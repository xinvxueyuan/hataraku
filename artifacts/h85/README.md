# H85：文章详情页宽度

## 改动

- main 增加一条 `has-[[data-slot=post]]:max-w-6xl`；文章页外层容器标记 `data-slot="post"`；
- article 保持 `xl:max-w-3xl`（768），右侧 `ArticleToc` 占 224px 并 sticky；
- prose 容器改 `max-w-prose`，正文行宽 690px，不随 1152 外框变成长行；
- 没有动其他页面的宽度规则。

## 验证

1600/1440/1280 main 1152、article 768、prose 690；改前 main 672/article 328；1024/836/768/390 无横向溢出；1280+ toc sticky、以下收移动入口；ready/design/compat/knip/e2e 见 evidence.txt。截图 h85-article-{1600,1440,390}.png。
