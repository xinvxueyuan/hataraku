-- H70: the indented samples in the Markdown article render as code blocks again.
-- One statement, located by id; it replaces the whole body.

-- 7: Markdown 教程
update posts set body_md = $h70$

# Markdown 教程

本 Markdown 示例展示了如何编写 Markdown 文件。本文档集成了核心语法和扩展（GMF）。

- [块级元素](#块级元素)
    - [段落与换行](#段落与换行)
    - [标题](#标题)
    - [引用块](#引用快)
    - [列表](#列表)
    - [代码块](#代码块)
    - [分割线](#分割线)
    - [表格](#表格)
- [行内元素](#行内元素)
    - [链接](#链接)
    - [强调](#强调)
    - [代码](#代码)
    - [图片](#图片)
    - [删除线](#删除线)
- [杂项](#杂项)
    - [自动链接](#自动链接)
    - [反斜杠转义](#反斜杠转义)
- [内联 HTML](#内联-HTML)


## 块级元素

### 段落与换行

#### 段落

HTML 标签: `<p>`

一个或多个空行。（只包含**空格**或**制表符**的行也被视为空行。）

代码：

    This will be
    inline.

    This is second paragraph.


预览：

---

This will be
inline.

This is second paragraph.

---


#### 换行

HTML 标签: `<br />`

在一行末尾添加**两个或更多空格**。

代码：

    This will be not
    inline.


预览：

---

This will be not  
inline.

---


### 标题

Markdown 支持两种标题风格：Setext 和 atx。

#### Setext

HTML 标签: `<h1>`, `<h2>`

使用**等号（=）**下划线表示 `<h1>`，**短横线（-）**下划线表示 `<h2>`，数量不限。

代码：

    This is an H1
    =============
    This is an H2
    -------------


预览：

---

# This is an H1

## This is an H2

---


#### atx

HTML 标签: `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>`, `<h6>`

在行首使用 1-6 个**井号（#）**，分别对应 `<h1>` - `<h6>`。

代码：

    # This is an H1
    ## This is an H2
    ###### This is an H6

Preview:

---

# This is an H1

## This is an H2

###### This is an H6

---


可选地，你可以“闭合”atx 风格标题。结尾的井号数量**不需要与开头一致**。

代码：

    # This is an H1 #
    ## This is an H2 ##
    ### This is an H3 ######

Preview:

---

# This is an H1

## This is an H2

### This is an H3

---


### 引用块

HTML 标签: `<blockquote>`

Markdown 使用邮件风格的 **>** 字符进行引用。建议每行前都加 >，效果最佳。

代码：

    > This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,
    > consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus.
    > Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.
    >
    > Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse
    > id sem consectetuer libero luctus adipiscing.

Preview:

---

> This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,
> consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus.
> Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.
>
> Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse
> id sem consectetuer libero luctus adipiscing.

---


Markdown 允许你偷懒，只在段落第一行前加 > 也可以。

代码：

    > This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,
    consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus.
    Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.

    > Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse
    id sem consectetuer libero luctus adipiscing.

Preview:

---

> This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,
> consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus.
> Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.

> Donec sit amet nisl. Aliquam semper ipsum sit amet velit. Suspendisse
> id sem consectetuer libero luctus adipiscing.

---


引用块可以嵌套（即引用中的引用），只需增加 > 层级。

代码：

    > This is the first level of quoting.
    >
    > > This is nested blockquote.
    >
    > Back to the first level.

Preview:

---

> This is the first level of quoting.
>
> > This is nested blockquote.
>
> Back to the first level.

---


引用块内可以包含其他 Markdown 元素，包括标题、列表和代码块。

代码：

    > ## This is a header.
    >
    > 1.   This is the first list item.
    > 2.   This is the second list item.
    >
    > Here's some example code:
    >
    >     return shell_exec("echo $input | $markdown_script");

Preview:

---

> ## This is a header.
>
> 1.  This is the first list item.
> 2.  This is the second list item.
>
> Here's some example code:
>
>     return shell_exec("echo $input | $markdown_script");

---


### 列表

Markdown 支持有序（编号）和无序（项目符号）列表。

#### 无序列表

HTML 标签: `<ul>`

无序列表可用**星号（*）**、**加号（+）**或**短横线（-）**。

代码：

    *   Red
    *   Green
    *   Blue

Preview:

---

- Red
- Green
- Blue

---


等价于：

代码：

    +   Red
    +   Green
    +   Blue


或：

代码：

    -   Red
    -   Green
    -   Blue


#### 有序列表

HTML 标签: `<ol>`

有序列表使用数字加英文句点：

代码：

    1.  Bird
    2.  McHale
    3.  Parish

Preview:

---

1.  Bird
2.  McHale
3.  Parish

---


有时你可能会不小心触发有序列表，比如：

代码：

    1986. What a great season.

Preview:

---

1986. What a great season.

---


你可以用**反斜杠（\\）**转义句点：

代码：

    1986\. What a great season.

Preview:

---

1986\. What a great season.

---

#### Indented


##### 列表项中的引用块

要在列表项中插入引用块，> 需要缩进：

代码：

    *   A list item with a blockquote:

        > This is a blockquote
        > inside a list item.

Preview:

---

- A list item with a blockquote:

  > This is a blockquote
  > inside a list item.

---


##### 列表项中的代码块

要在列表项中插入代码块，需要缩进两次（**8 个空格**或**两个 Tab**）：

代码：

    *   A list item with a code block:

            `<code goes here>`

Preview:

---

- A list item with a code block:

      `<code goes here>`

---


##### 嵌套列表

代码：

    * A
      * A1
      * A2
    * B
    * C

Preview:

---

- A
  - A1
  - A2
- B
- C

---


### 代码块

HTML 标签: `<pre>`

代码块每行需缩进**至少 4 个空格**或**1 个 Tab**。

代码：

    This is a normal paragraph:

        This is a code block.


预览：

---

This is a normal paragraph:

    This is a code block.

---


代码块会一直持续，直到遇到未缩进的行（或文档结尾）。

在代码块中，**& 符号**和**尖括号（< 和 >）**会自动转为 HTML 实体。

代码：

```html
        <div class="footer">
            &copy; 2004 Foo Corporation
        </div>
```

Preview:

---

```html
    <div class="footer">
        &copy; 2004 Foo Corporation
    </div>
```

---


下述“围栏代码块”和“语法高亮”是扩展语法，提供了另一种书写代码块的方式。

#### 围栏代码块

只需用 ` ``` ` 包裹代码（如下所示），无需再缩进四个空格。

代码：

    Here's an example:

    ```
    function test() {
      console.log("notice the blank line before this function?");
    }
    ```

Preview:

---

Here's an example:

```
function test() {
  console.log("notice the blank line before this function?");
}
```

---


#### 语法高亮

在围栏代码块后加上可选的语言标识，即可实现语法高亮（[支持的语言列表](https://github.com/github/linguist/blob/master/lib/linguist/languages.yml)）。

代码：

    ```ruby
    require 'redcarpet'
    markdown = Redcarpet.new("Hello World!")
    puts markdown.to_html
    ```

Preview:

---

```ruby
require 'redcarpet'
markdown = Redcarpet.new("Hello World!")
puts markdown.to_html
```

---


### 分割线

HTML 标签: `<hr />`
在单独一行输入**三个或以上的短横线（-）、星号（*）或下划线（_）**即可。符号间可有空格。

代码：

    * * *
    ***
    *****
    - - -
    ---------------------------------------
    ___

Preview:

---

---

---

---

---

---

---

---


### 表格

HTML 标签: `<table>`

（扩展语法）

用**竖线（|）**分隔列，用**短横线（-）**分隔表头，**冒号（:）**用于对齐。

外层竖线和对齐可选。每个单元格至少有 3 个分隔符。

代码：

```
| Left | Center | Right |
| :--- | :----: | ----: |
| aaa  |  bbb   |   ccc |
| ddd  |  eee   |   fff |

 | A   | B   |
 | --- | --- |
 | 123 | 456 |


| A   | B   |
| --- | --- |
| 12  | 45  |
```

Preview:

---

| Left | Center | Right |
| :--- | :----: | ----: |
| aaa  |  bbb   |   ccc |
| ddd  |  eee   |   fff |

| A   | B   |
| --- | --- |
| 123 | 456 |

| A   | B   |
| --- | --- |
| 12  | 45  |

---


## 行内元素

### 链接

HTML 标签: `<a>`

Markdown 支持两种链接风格：行内和引用。

#### 行内链接


行内链接格式如下：`[链接文本](URL "标题")`

标题可选。

代码：

    This is [an example](http://example.com/ "Title") inline link.

    [This link](http://example.net/) has no title attribute.

Preview:

---

This is [an example](http://example.com/ "Title") inline link.

[This link](http://example.net/) has no title attribute.

---


如果引用同一服务器上的本地资源，可以使用相对路径：

代码：

    See my [About](/about/) page for details.

Preview:

---

See my [About](/about/) page for details.

---


#### 引用链接

你可以预定义链接引用。格式如下：`[id]: URL "标题"`

标题同样可选。引用时格式为：`[链接文本][id]`

代码：

    [id]: http://example.com/  "Optional Title Here"
    This is [an example][id] reference-style link.

Preview:

---

[id]: http://example.com/ "Optional Title Here"

This is [an example][id] reference-style link.

---


即：

- 方括号内为链接标识符（**不区分大小写**，可选最多缩进三格）；
- 后跟冒号；
- 后跟一个或多个空格（或 Tab）；
- 后跟链接的 URL；
- 链接 URL 可选用尖括号包裹；
- 可选跟链接标题，标题可用双引号、单引号或括号包裹。

以下三种定义等价：

Code:

```md
    [foo]: http://example.com/  "Optional Title Here"
    [foo]: http://example.com/  'Optional Title Here'
    [foo]: http://example.com/  (Optional Title Here)
    [foo]: <http://example.com/>  "Optional Title Here"
```


使用空方括号时，链接文本本身作为标识符。

代码：

    [Google]: http://google.com/
    [Google][]

Preview:

---

[Google]: http://google.com/

[Google][]

---


### 强调

HTML 标签: `<em>`, `<strong>`

Markdown 用**星号（*）**和**下划线（_）**表示强调。**单个符号**为 `<em>`，**双符号**为 `<strong>`。

代码：

    *single asterisks*

    _single underscores_

    **double asterisks**

    __double underscores__

Preview:

---

_single asterisks_

_single underscores_

**double asterisks**

**double underscores**

---


但如果在 * 或 _ 两侧加空格，则会被视为普通字符。

你也可以用反斜杠转义：

代码：

    \*this text is surrounded by literal asterisks\*

Preview:

---

\*this text is surrounded by literal asterisks\*

---


### 行内代码

HTML 标签: `<code>`

用**反引号（`）**包裹。

代码：

    Use the `printf()` function.

Preview:

---

Use the `printf()` function.

---


如需在代码中包含反引号，可用**多个反引号**包裹：

代码：

    ``There is a literal backtick (`) here.``

Preview:

---

``There is a literal backtick (`) here.``

---


反引号包裹代码时，开头和结尾可各加一个空格，这样可在代码开头或结尾包含反引号：

代码：

    A single backtick in a code span: `` ` ``

    A backtick-delimited string in a code span: `` `foo` ``

Preview:

---

A single backtick in a code span: `` ` ``

A backtick-delimited string in a code span: `` `foo` ``

---


### 图片

HTML 标签: `<img />`

Markdown 的图片语法类似于链接，支持行内和引用两种风格。

#### 行内图片

Inline image syntax looks like this: `![Alt text](URL "Title")`

Title is optional.

Code:

    ![Alt text](/path/to/img.jpg)

    ![Alt text](/path/to/img.jpg "Optional title")

Preview:

---

![Alt text](https://s2.loli.net/2024/08/20/5fszgXeOxmL3Wdv.webp)

![Alt text](https://s2.loli.net/2024/08/20/5fszgXeOxmL3Wdv.webp "Optional title")

---


即：

- 一个感叹号 !；
- 后跟方括号，内为图片的 alt 文本；
- 后跟圆括号，内为图片的 URL 或路径，可选标题用引号包裹。


#### 引用图片

引用风格图片语法如下：`![Alt text][id]`

代码：

    [img id]: https://s2.loli.net/2024/08/20/5fszgXeOxmL3Wdv.webp  "Optional title attribute"
    ![Alt text][img id]

Preview:

---

[img id]: https://s2.loli.net/2024/08/20/5fszgXeOxmL3Wdv.webp "Optional title attribute"

![Alt text][img id]

---


### 删除线

HTML 标签: `<del>`

（扩展语法）

GFM 增加了删除线语法。

代码：

```
~~Mistaken text.~~
```

Preview:

---

~~Mistaken text.~~

---


## 杂项

### 自动链接

Markdown 支持为 URL 和邮箱地址创建“自动”链接，只需用尖括号包裹即可。

代码：

```md
    <http://example.com/>

    <address@example.com>
```

Preview:

---

[http://example.com/](http://example.com/)

[address@example.com](mailto:address@example.com)

---


GFM 会自动识别标准 URL。

代码：

```
https://github.com/emn178/markdown
```

Preview:

---

https://github.com/emn178/markdown

---


### 反斜杠转义

Markdown 允许用反斜杠转义本应有特殊含义的字符。

代码：

    \*literal asterisks\*

Preview:

---

\*literal asterisks\*

---


Markdown 支持对下列字符进行反斜杠转义：

代码：

    \   backslash
    `   backtick
    *   asterisk
    _   underscore
    {}  curly braces
    []  square brackets
    ()  parentheses
    #   hash mark
    +   plus sign
    -   minus sign (hyphen)
    .   dot
    !   exclamation mark


## 内联 HTML

对于 Markdown 未覆盖的标记，直接写 HTML 即可，无需特殊标记或分隔。

代码：

    This is a regular paragraph.

```html
    <table>
        <tr>
            <td>Foo</td>
        </tr>
    </table>
```

    This is another regular paragraph.

Preview:

---

This is a regular paragraph.

<table>
    <tr>
        <td>Foo</td>
    </tr>
</table>

This is another regular paragraph.

---


注意：Markdown 语法**不会在块级 HTML 标签内生效**。

与块级 HTML 不同，Markdown 语法**会在行内 HTML 标签内生效**。

代码：

```html
    <span>**Work**</span>

    <div>
        **No Work**
    </div>
```

Preview:

---

<span>**Work**</span>

<div>
  **No Work**
</div>
***
$h70$, updated_at = now() where id = 7;
