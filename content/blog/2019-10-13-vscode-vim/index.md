---
title: VSCode + Vim Plugin が異常に重くなる件の対処法
date: '2019-10-13T00:00:00.000Z'
---

# 結論

自分の環境では、`vim.statusBarColorControl` という設定を切ったら実用に耐えるレベルになった。

https://github.com/VSCodeVim/Vim#vim-airline

setting.json に下の 2 行を加えた。 `editor.quickSuggestions` の方は効果を出しているかイマイチ実感はできていない。

```json
{
  ...
  "vim.statusBarColorControl": false,
  "editor.quickSuggestions": false
  ...
}
```

# 経過

ここ最近 VSCode + Vim Plugin がコーディングに支障をきたすほど遅くなってしまう状況に悩んでいた。

具体的に言うと `j`, `k` の移動を押しっぱなしにするとキーリピートの入力と画面移動が明らかに追いつかず、押し多分の移動量が一気に適応されるため、カーソル移動の目測がずれてしまっていた。
また、自分は `w` で一つ単語移動をよく使うが、これも入力から反映までが時間がかかるため、何回押したかを事前に測るという無駄な時間が発生していた。

流石に累積の時間を無駄にしすぎていると気づいたので調べていると、github に似た状況に悩んでいる人たちの issue が上がっていた。

https://github.com/VSCodeVim/Vim/issues/2021

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">最近VSCodeのVimプラグインが耐えられないくらい遅くて作業効率がガタ落ちしてしまう。切ったら切ったでVimのキーバインド使えないと作業効率落ちるのでどうしたものか……<br>みんな悩んでるっぽい<a href="https://t.co/j2J9PZN01T">https://t.co/j2J9PZN01T</a></p>&mdash; Kohta Ito (@koh110) <a href="https://twitter.com/koh110/status/1182484280338866176?ref_src=twsrc%5Etfw">October 11, 2019</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

2017 年の時点でまさに自分と同じ状況になっている人たちがいた。（VSCode を導入した当初から Vim Plugin を入れていたので、こんなもんかと思っていた）

https://github.com/VSCodeVim/Vim/issues/2021#issuecomment-329785744

読み進めていると `vim.statusBarColorControl` を `false` にすると解消したと言っている人たちが何人かいた。

実際に切ってみるとかなり重さがマシになったので、コーディングに人権を取り戻すことができた。

この設定は何なのかと README を見に行ってみると、免責事項的にこの設定はパフォーマンスに影響を与えますと書いてあった。わかってるならデフォルト ON はやめてよ！

> There are performance implications to using this plugin.

https://github.com/VSCodeVim/Vim#vim-airline

現在の Vim Mode に基づいてステータスバーの色を変更するために、setting.json を逐一オーバーライドするっぽい。それによって作業ディレクトリが常に変化し続けるためパフォーマンスイシューとなるらしい。

自分にとってステータスバーの色は生産性に寄与しないので、単純に設定を切ってしまっても問題なさそうだったので、そのまま設定まるごと切ってしまうことにした。
