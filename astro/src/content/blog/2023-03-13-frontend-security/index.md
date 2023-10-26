---
layout: '../../../layouts/MarkdownLayout.astro'
title: フロントエンド開発のためのセキュリティ入門書評
date: '2023-03-13'
tags: ['nodejs', 'frontend', 'security', 'book']
---

## はじめに

2023/02/13に発売された「フロントエンド開発のためのセキュリティ入門」を読みました。

<a href="https://www.amazon.co.jp/dp/B0BQM1KMBG?&linkCode=li3&tag=koh11001-22&linkId=6f10a301ca8ec5a8ff90824f3f086ca4&language=ja_JP&ref_=as_li_ss_il" target="_blank"><img border="0" src="//ws-fe.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=B0BQM1KMBG&Format=_SL250_&ID=AsinImage&MarketPlace=JP&ServiceVersion=20070822&WS=1&tag=koh11001-22&language=ja_JP" ></a><img src="https://ir-jp.amazon-adsystem.com/e/ir?t=koh11001-22&language=ja_JP&l=li3&o=9&a=B0BQM1KMBG" width="1" height="1" border="0" alt="" style="border:none !important; margin:0px !important;" />

自著の実践Node.js入門と発売日が近かった事もあり、Node学園41時限目で著者の<a href="https://twitter.com/shisama_" target="_blank">shisama</a>さんとLTをさせていただきました。

https://nodejs.connpass.com/event/275061/

本とイベントの内容を忘れないうちに記事にしておこうと思います。

## 「フロントエンド開発のためのセキュリティ入門」について

この書籍はフロントエンドエンジニアがおさえておくべきセキュリティ対策について解説されています。

セキュリティの良著といえば特丸本が思い浮かびます。
解説も再現方法も重厚で日本語で読める書籍で一度は読んでおいたほうがよい本ではありますが、はじめてセキュリティについて触れようと思うフロントエンドエンジニアにとっては少しひるんでしまう面もあると思います。

<a href="https://www.amazon.co.jp/%E4%BD%93%E7%B3%BB%E7%9A%84%E3%81%AB%E5%AD%A6%E3%81%B6-%E5%AE%89%E5%85%A8%E3%81%AAWeb%E3%82%A2%E3%83%97%E3%83%AA%E3%82%B1%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3%E3%81%AE%E4%BD%9C%E3%82%8A%E6%96%B9-%E7%AC%AC2%E7%89%88%EF%BC%BB%E5%9B%BA%E5%AE%9A%E7%89%88%EF%BC%BD-%E8%84%86%E5%BC%B1%E6%80%A7%E3%81%8C%E7%94%9F%E3%81%BE%E3%82%8C%E3%82%8B%E5%8E%9F%E7%90%86%E3%81%A8%E5%AF%BE%E7%AD%96%E3%81%AE%E5%AE%9F%E8%B7%B5-%E5%BE%B3%E4%B8%B8-%E6%B5%A9-ebook/dp/B07DVY4H3M?_encoding=UTF8&qid=&sr=&linkCode=li3&tag=koh11001-22&linkId=512c80a3103316e304b0058c0aad0bb4&language=ja_JP&ref_=as_li_ss_il" target="_blank"><img border="0" src="//ws-fe.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=B07DVY4H3M&Format=_SL250_&ID=AsinImage&MarketPlace=JP&ServiceVersion=20070822&WS=1&tag=koh11001-22&language=ja_JP" ></a><img src="https://ir-jp.amazon-adsystem.com/e/ir?t=koh11001-22&language=ja_JP&l=li3&o=9&a=B07DVY4H3M" width="1" height="1" border="0" alt="" style="border:none !important; margin:0px !important;" />

「フロントエンド開発のためのセキュリティ入門」はもう少しフロントエンドよりの視点から執筆されていて、はじめてこういったジャンルに触れるフロントエンドエンジニアにとっては中間を埋めるのによいステップであると感じました。

かといってセキュリティの記述についておろそかになっている箇所があるわけではありません。

調べるフックとなる単語には触れられていますし、参考となる書籍やリンクが明記されているため内容を深堀していくのに不自由はしないでしょう。

また、監修として関わられている<a href="https://twitter.com/hasegawayosuke" target="_blank">はせがわようすけ</a>さんは日本の中でもトップクラスのセキュリティに強い方なので、解説内容においても不安感がありません。

## 内容について

3章から具体的な対策についての記述がはじまります。

かならずJavaScriptをベースにしたハンズオン形式のコードが付属していて実際に挙動を確かめながら進められます。
著者のshisamaさんはNode.jsのコミッターでもあるのでNode.jsの使い方やコードの品質についても信頼できます。

コードは全体的にCJSで説明されていました。これは自著でも悩んだ所だったのですが、今このタイミングがかなり過渡期なのでESMだけで説明はできるが、逆にCJSに不十分さがでる可能性があって悩ましいよなぁと思いました。

`余談`: 実際、Node学園で具体的にESMだとなにが問題になりますか？というお話をしましたが「Node.js単体ではいける感触があるが、TypeScriptやバンドラーなどが関わると躓くことが多い」と思っています。
シンプルな構成ならいけそうだけど、フロントエンドなどのビルドエコシステムが組み合わさるとCJSとESMどちらかに寄せきるのが難しくなってくるな、というのが現状の認識です。

実務でフロントエンドのコードを書いた事がある人であれば3章くらいまではうっすらと理解できている事が多いのかなと思います。
4章以降は知ってはいるが、説明はむずかしいという内容が多く集中して読む箇所が増えました。

数年前に話題になったサイドチャネル攻撃を防ぐ方法についても記載されていて、色々と頑張るとプロセスを分離してSharedArrayBufferが使えるようになるよという解説があります。
しかし、これ頑張ってもSharedArrayBufferが使えるようになるだけならコスパ悪いよね、というのはNode学園でも笑い話としてあがっていました。
正直自分もSharedArrayBufferをアプリケーションで絶対に使いたいパターンがないので頑張る労力に見合わないなぁという感想です。

XSSの対策については<a href="https://github.com/cure53/DOMPurify" target="_blank">DOMPurify</a>と<a href="https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API" target="_blank">Sanitizer API</a>について触れられていました。

自分もDOMPurifyを主に使う事が多く、ブラウザの標準としてSanitizer APIがあるなら移行できないかと検討した事がありますがうまく使えなかった経緯があり、実際のアプリケーションを構築する面を考慮してDOMPurifyをメインに触れたのかなと思いました。

本書の内容で特に自分が面白かった点は、CSRFの対策はTokenをつけるとうっすらとした認識しかなかったが、それ以外にも複数対策はあるしむしろTokenは古い方法なのだという所でした。

expressが提供していた <a href="https://github.com/expressjs/csurf" target="_blank">csurf</a> モジュールがDeprecatedにされていて調度気になっていた所でしたが、SPAにはいらないと言われていたのは知っていましたがやっと内容として納得できました。

`余談`: [csurf](https://github.com/expressjs/csurf/commit/1cee470c2781727a5cf25a24c4f0fd3207a3ff2b) はarchiveされているが、どういう実装になっているのか確認しにいったらコードごと削除されていてダイナミックさに驚いた。

さっそく本書の内容を使って自分が開発しているシステムを最新の対策で書き直しできました。

なにより、一番よかったのは「パスワードマネージャーのためにもパスワードのコピペを禁止しないことが大切」という内容をセキュリティ本が書いてくれている所です。世の中にはまだこういうUIを提供するシステムも多いので、セキュリティ入門の側から発信される事は意義は大きいと思います。

## おわりに

セキュリティの入門書として、フロントエンド周辺の知識が多い自分にはかなりとっつきやすくすらすらと読める良著でした。

自著で書ききれないなと思った部分もかなり補完されていたので、自著を買っていただいた人にもノータイムでおすすめできる本です。
