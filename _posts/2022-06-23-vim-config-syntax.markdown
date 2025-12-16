---
layout: single
title:  "Vim Config Syntax"
date:   2022-06-23 15:30:09 +0900
categories: tools
excerpt: "Vim의 key mapping, autocommand 등 설정 문법 정리"
toc: true
toc_sticky: true
tags: vim
---


# Mapping key

```
map_mode <typeing-key> <what-to-execute>
"example
map <Leader>tt <ESC>:TagbarToggle<CR>
nmap <buffer> K <plug>(lsp-hover)
```
map mode
- nnoremap/ inoremap / vnoremap : 각각 normal/insert/visual mode 에서의 key mapping

### special key : <leader> key

대부분 사용하지 않는 키로 차별화를 두고 싶을 때 leader 키를 사용한다.
default 로는 backslash(\) 키로 지정되어있고 기호에 따라 다음과 같이 변경할 수 있다.
```
let mapleader = "/" # leader key 를 /로 변경
```
나 같은 경우에 MRU 를 사용하기 위해서 <leader>ru 를 사용하고 있다.

### special arguments

키 매핑을 지정할 때 아래와 같은 special arguments 들을 이용할 수 있다.

<buffer> :
<nowait> :
<silent> :
<special>:
<script> :
<expr> :
<unique> :

더 자세한 내용이 필요하다면 vim 에서 아래의 커맨드를 실행
```
:help map-modes
```

# Autocommand

autocmd 는 어떤 event 가 발생했을 때 자동적으로 특정 커맨드를 실행하고 싶을 때 사용한다.

문법은 다음과 같다.

```
:autocmd event pattern_to_filter command_to_run

"examples
:autocmd BufNewFile * :write
:autocmd BufNewFile *.txt :write
"multiple events
:autocmd BufWritePre,BufRead *.html :normal gg=G

```
다양한 event 들을 지원하기 때문에 필요한 event 가 있으면 Reference[1] 를 참고
(예를 들면, FileType 과 같은 event.)



# Autocommand Groups

vimrc 에서 아래와 같은 autocmd 를 정의했다고 가정해보자.
```
" when you do :write, echo message "Writting buffer!".
" you can see it with :message
:autocmd BufWrite * :echom "Writing buffer!"
```
vimrc 는 source 할때마다 실행하기 때문에 autocmd 도 반복적으로 불리게 된다.
문제는 autocmd 는 replace 하는 것이 아니고 duplicate 하게 된다는 점이다!
vim 내에서 source ~/.vimrc 를 여러번 수행하고 :w 를 하게 되면 한 번에 여러개의 메시지가 발생하는 것을 볼 수 있다.
즉, source 할 때 마다 점점 느려지게 될 것이다.
지금까지 정의된 autocmd 를 날리고싶다면 autocmd! 를 치면 된다.
## Reference

- [Learn Vimscript the Hard Way](https://learnvimscriptthehardway.stevelosh.com/chapters/14.html)
- [freeCodeCamp - Vimrc Configuration Guide](https://www.freecodecamp.org/news/vimrc-configuration-guide-customize-your-vim-editor/)
