---
title: ダークモードを導入してCSS+JSでテーマを管理する
date: '2019-10-28T00:00:00.000Z'
---

# きっかけ

デフォルトは OS のダークモードをみて対応したいけど、JavaScript で切り替えにも対応したい。

そして色とかスタイルに関わる責務は CSS に寄せて、JavaScript はただ切り替えのロジックにだけ集中したい。

`prefers-color-scheme` を使った CSS によるダークテーマ実装は、検索するとよく出てくるけど、色の管理とかが body にクラスをつけて切り替えます、というのが多かったので CSS でもカラーテーマを管理しつつ、切り替えだけ JavaScript で行う方法をまとめてみる。

# CSS でカラーテーマを管理する

テーマが切り替わるということうことは、色が同時に多数切り替わるというわけなので、変数で管理したい。

CSS の Variables を管理するなら :root で書きたい。

じゃあダークモードの時に変数上書きするにはどうしたらいいのか？と思って調べてみたら、次のように attribute で上書きできるということがわかった。

これでカラーテーマを複数管理すれば色弱の方のアクセサビリティみたいなのにも応用できそう。

```css
:root {
  --color-background-body: #ffffff;
  --color-body: #545454;
}

[data-mode='dark'] {
  --color-background-body: #15202b;
  --color-body: #ffffff;
}
```

# JS でテーマを切り替えたい

`prefers-color-scheme` で OS のダークモードを判定することができます。この辺の詳細は検索するとたくさん情報が出てくるので割愛。

CSS で attribute だけ定義しておくと、`document.documentElement.setAttribute` でアクセスできるというのがちょっとおもしろかった。

`window.matchMedia` でメディアクエリにアクセスできるので、こいつに `addListner` しておくと OS のモードが切り替わったときに連動してテーマを切り替えられる。これが発火するシーンは多くないけど自己満足で入れてる。

あと本当にダークモードの切り替えができてるかのテストにはリアルタイムで反映されるのでいい。

```js
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.setAttribute('data-mode', 'dark')
}

window.matchMedia('(prefers-color-scheme: dark)').addListener(e => {
  if (e.matches) {
    document.documentElement.setAttribute('data-mode', 'dark')
  } else {
    // 今回のコードでは light は定義されてないのでデフォルトの変数に戻る
    document.documentElement.setAttribute('data-mode', 'light')
  }
})
```

上記のコードには記載していないが、適当なチェックボックスやトグルボタンのイベントに `setAttribute` をいじるコードをいれれば、ユーザが任意のタイミングでテーマを切り替えるボタンになる。

# まとめ

この方式で管理すれば、色などデザインに関わる領域は CSS、テーマの切り替え機能などロジックは JavaScript と責任を分離できてよさそう。
