---
layout: '../../../layouts/MarkdownLayout.astro'
title: Redis Streamsでキューを実装するときの注意点
date: '2019-08-05'
tags: ['redis']
---

## はじめに

Redis Streams とはざっくりいうと Redis v5 から加わった Pub/Sub とはまた違うキューイングの仕組みです。

https://redis.io/topics/streams-intro

Pub/Sub は Subscribe したら揮発してしまうのに対して、Streams はキューが詰められるときに指定した Max を超えたものが押し出されて消える仕組みです。

登録した Stream に対して購読グループを複数作ったりすることで、1 つの Stream に対して個別のグループで購読管理ができたりします。（Kafka で導入されたアイデアを輸入したもの）

今回は上記のグループを使わずにキューを複数プロセスで受け取る実装のサンプルと、自分が勘違いしていた部分をまとめます。

## Stream を触ってみる

キューの追加は XADD というコマンドを使います。

かんたんに各項目を説明すると下記のようになります。

- stream-sample: キューを追加する Stream
- MAXLEN 10: 10 個までキューを保持する（すでに 10 個キューがあったら先頭から削除されていく）
- message test: `message` という key に対して `test` という value を入れる

```bash
127.0.0.1:6379> XADD stream-sample MAXLEN 10 * message test
"1565014160054-0"
```

この追加したキューを読み取るには XREAD というコマンドを使います

`STREAMS stream-sample` で読み込む Stream を指定し、次に読み込む ID を指定します。ここで指定した ID 以降の値が読み込まれますが、0 を指定すると先頭から読み込みます。

```bash
127.0.0.1:6379> XREAD STREAMS stream-sample 0
1) 1) "stream-sample"
   2) 1) 1) "1565014160054-0"
         2) 1) "message"
            2) "test"

# 2つ追加してみる
127.0.0.1:6379> XADD stream-sample MAXLEN 10 * message test2
"1565014529460-0"
127.0.0.1:6379> XADD stream-sample MAXLEN 10 * message test3
"1565014577669-0"

# 最初のIDを指定して読み込むと、それ以降に追加されたキューが読み込まれる。
127.0.0.1:6379> XREAD STREAMS stream-sample 1565014160054-0
1) 1) "stream-sample"
   2) 1) 1) "1565014529460-0"
         2) 1) "message"
            2) "test2"
      2) 1) "1565014577669-0"
         2) 1) "message"
            2) "test3"

# 0を指定すると最初から読み込む
127.0.0.1:6379> XREAD STREAMS stream-sample 0
1) 1) "stream-sample"
   2) 1) 1) "1565014160054-0"
         2) 1) "message"
            2) "test"
      2) 1) "1565014529460-0"
         2) 1) "message"
            2) "test2"
      3) 1) "1565014577669-0"
         2) 1) "message"
            2) "test3"

# MAXLEN を 2 に指定してキューに突っ込んでみる
127.0.0.1:6379> XADD stream-sample MAXLEN 2 * message test4
"1565014734414-0"

# 2 個になるようにキューが先頭から削除される
127.0.0.1:6379> XREAD STREAMS stream-sample 0
1) 1) "stream-sample"
   2) 1) 1) "1565014577669-0"
         2) 1) "message"
            2) "test3"
      2) 1) "1565014734414-0"
         2) 1) "message"
            2) "test4"
```

これだけではキューが追加されたことを検知できないので、このままではキューとしては使えません。

キューの追加を Subscribe するために XREAD で BLOCK というオプションを使います。

# キューを待ち受ける

`BLOCK 0`: キューを指定時間まで待ち受ける。0 を指定するとタイムアウトせずに待ち受ける。

ここで新しい `$` という特殊な ID が出てきます。先のサンプルでは 0 か ID を直接指定していましたが、 `$` を指定すると XREAD をはじめたタイミングからあとに追加されたものを受け取る、という特別な振る舞いをします。

https://redis.io/commands/xread#the-special-codecode-id

```bash
127.0.0.1:6379> XREAD BLOCK 0 STREAMS stream-sample $

# キューが追加されるまで接続が開きっぱなしになるので、別プロセスから XADD してキューを追加する

1) 1) "stream-sample"
   2) 1) 1) "1565015282007-0"
         2) 1) "message"
            2) "test"
(4.06s)
```

`XREAD BLOCK` を複数プロセスで同時に起動すると、一対多に伝播するキューが実装できます。

また、XREAD には COUNT というオプションもあり、READ するキューの個数を設定することができます。

```bash
# 全部で3つのキューが入っている
127.0.0.1:6379> XREAD STREAMS stream-sample 0
1) 1) "stream-sample"
   2) 1) 1) "1565015282007-0"
         2) 1) "message"
            2) "test"
      2) 1) "1565016161343-0"
         2) 1) "message"
            2) "test2"
      3) 1) "1565016381246-0"
         2) 1) "message"
            2) "test3"

# COUNT 2 を指定すると2つだけ取り出せる
127.0.0.1:6379> XREAD COUNT 2 STREAMS stream-sample 0
1) 1) "stream-sample"
   2) 1) 1) "1565015282007-0"
         2) 1) "message"
            2) "test"
      2) 1) "1565016161343-0"
         2) 1) "message"
            2) "test2"
```

つまり `XREAD BLOCK 0 COUNT 100 STREAMS stream-sample $` というコマンドをループし続けると、100 個のキューを読み込む consumer が作れると思いました。
が、これは勘違いでバグを埋め込むことになっていまいました。

## BLOCK と COUNT オプションを同時に使う落とし穴

先に結論を言ってしまうと、ほぼ同時にキューが詰め込まれると意図とずれた挙動が発生します。手で実行しているとほぼ同時にキューが詰め込まれることがないのでなかなか気づけません。

Node.js でごく短時間に 10 個のキューを追加するコードを書いてみます。

```js
const Redis = require('ioredis')
const redis = new Redis({
  host: '127.0.0.1'
})

async function main() {
  const promises = []

  for (let i = 0; i < 10; i++) {
    const promise = redis.xadd('stream-sample', '*', 'message', `message-${i}`)
    promises.push(promise)
  }

  await Promise.all(promises)
}

redis.once('connect', () => {
  main()
    .catch(e => console.error(e))
    .finally(() => redis.disconnect())
})
```

追加されたキューを確認してみると同じ時刻に追加されたキューは ID に suffix に数字がついで区別される仕組みのようです。

```bash
127.0.0.1:6379> XREAD STREAMS stream-sample 0
1) 1) "stream-sample"
   2)  1) 1) "1565017990806-0"
          2) 1) "message"
             2) "message-0"
       2) 1) "1565017990806-1"
          2) 1) "message"
             2) "message-1"
       3) 1) "1565017990807-0"
          2) 1) "message"
             2) "message-2"
       4) 1) "1565017990808-0"
          2) 1) "message"
             2) "message-3"
       5) 1) "1565017990808-1"
          2) 1) "message"
             2) "message-4"
       6) 1) "1565017990808-2"
          2) 1) "message"
             2) "message-5"
       7) 1) "1565017990808-3"
          2) 1) "message"
             2) "message-6"
       8) 1) "1565017990808-4"
          2) 1) "message"
             2) "message-7"
       9) 1) "1565017990808-5"
          2) 1) "message"
             2) "message-8"
      10) 1) "1565017990808-6"
          2) 1) "message"
             2) "message-9"
```

ここで、先述の BLOCK と COUNT を使った consumer を用意してみます。期待としては `COUNT 20` としているので、新しく追加された 10 個のキューが全部とれて欲しいですが、実際にとれるのは 1 つめのに追加されたキューだけです。

```bash
127.0.0.1:6379> XREAD BLOCK 0 COUNT 20 STREAMS stream-sample $
1) 1) "stream-sample"
   2) 1) 1) "1565018255786-0"
         2) 1) "message"
            2) "message-0"
(4.61s)
```

Redis の issue を調べてみると `$` を使って待ち受けているときの仕様のようです。

https://github.com/antirez/redis/issues/5543

確かに `$` は XREAD した時から初めて XADD された瞬間に発火する、と考えれば最初のひとつしか取り出せないというのは理解できます。

しかも `$` を使った XREAD ループすると最初の 1 つ以降のキューはすでに追加されたあとなので、残り 9 個のキューは受け取れず過ぎ去ってしまいます。

そこで、キューを待ち受ける consumer を作るためには、起動時には `$` で待ち受け、それ以降は最後に受け取った ID を指定するというコードが必要になります。

下記のようなイメージです。

```js
async function consume(startId = '$') {
  let nextId = startId ? startId : '$'

  const res = await redis.xread('BLOCK', '0', 'COUNT', '20', 'STREAMS', 'stream-sample', startId)
  for (const [, val] of res) {
    for (const [id, messages] of val) {
      nextId = id
      // 何かしらの処理
    }
  }

  await consume(nextId)
}

consume()
```

# まとめ

XREAD と BLOCK, COUNT を使ってキューを実装する時は、 `$` だけでなく最後に受け取った ID を保持して読み込む ID をずらす必要があります。
