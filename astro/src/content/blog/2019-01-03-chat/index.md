---
layout: '../../../layouts/MarkdownLayout.astro'
title: チャットシステムを作るときに知っておくべきこと
date: '2019-01-03'
tags: []
---

チャットシステムを作ってみているのでいろいろと気になる部分を記録。

会社で社内用のチャットシステムをずと開発・運用していたのである程度システム的なノウハウはあったものの、外向けに作るときに気にしなければならない部分が結構あるなというのを知った。

<a href="http://www.soumu.go.jp/main_content/000477428.pdf" target="_blank">電気通信事業法</a>に関しては確かに微妙なところで意識しづらいなぁと思いつつ、発信者情報開示請求はいざきてみたら結構やばいなという感じですね（チャットに限らずだけど）。

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">チャットサービス公開するのに電気通信事業法を意識しておかないといけないのは知らなかったな。言われてみれば確かに<br>10日間で「勉強会で使いたくなるチャット」を作りました - Qiita <a href="https://t.co/dI75VNgMNg">https://t.co/dI75VNgMNg</a></p>&mdash; Koh.I (@koh110) <a href="https://twitter.com/koh110/status/1080453104326197249?ref_src=twsrc%5Etfw">2019年1月2日</a></blockquote>

<blockquote class="twitter-tweet" data-lang="ja"><p lang="ja" dir="ltr">Slackから抜ける選択肢をとる人もいるのか。チャットサービスの実質デファクトになってるから相当の差別化がないと乗り換えはないと思っていた。<br>SlackからMattermostへ移行！比較結果とオススメポイントを解説 | jMatsuzaki <a href="https://t.co/9EwTAJgds7">https://t.co/9EwTAJgds7</a></p>&mdash; Koh.I (@koh110) <a href="https://twitter.com/koh110/status/1080472622503157761?ref_src=twsrc%5Etfw">2019年1月2日</a></blockquote>

個人でサービスを運用するにも、利用規約をしっかり整えたりログを落としたりといった、外に見えづらくモチベーションの上がりづらいものをやらないといけないのが辛いところ。

この辺は数をこなしていかないと自分の中のコストも下がらなそうだなぁ。
