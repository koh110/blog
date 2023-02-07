---
title: AsyncIteratorと落とし穴
date: '2020-05-13'
tags: ['nodejs']
---

Node.js において Stream の処理というのはなくてはならないものです。しかし Stream の文法は慣れるまでは扱いにくいものです。

しかし、AsyncIterator の登場によって Stream を Promise の文脈で処理することができるようになり、「async/await に取り込み」「包括的エラーハンドリング」などができるようになりました。

２年ほど前に AsyncIterator について記事を書きました。[参考: さよなら Stream](https://qiita.com/koh110/items/0fba3acbce38916928f1)

以前に書いたときにはまだ Experimental な API だったため気軽に利用することはできませんでしたが、今はもう Stable なので、より色々なシーンで活かせる機会が増えるでしょう。

そこでこの記事では今まで書きにくかった Stream や Events のスマートな扱い方、その落とし穴と回避方法をまとめます。

# for await...of

`for await...of` は非同期な iterator オブジェクトを反復処理できる構文です。[MDN](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Statements/for-await...of)

具体的な例をあげると Stream の `data` イベントなどを処理するのに向いています。

下記は Stream でファイルを読み取り chunk ごとに処理をするコード例です。Stream は大きなデータを断続的に処理することでメモリを効率よく利用したり、同期コードを細切れに処理することで、途中に別のリクエストなどを受けることができます。

```js
const fs = require('fs')

const stream = fs.createReadStream(__filename, { encoding: 'utf8', highWaterMark: 64 })

stream.on('data', (chunk) => {
  console.log(chunk)
})

stream.on('close', () => {
  console.log('end!!')
})

stream.on('error', (e) => {
  console.log('error', e)
})
```

この時、data イベントのハンドラー内では非同期処理を待ち受けることができません。（async function 自体は書けますが、await で処理を実行している間にも data イベントは発生し続けてしまいます。）

また、Stream を扱う時は error イベントを「必ず」ハンドリングしなければなりません。error イベントのハンドリングを忘れると try-catch で受けることができず、エラーが突き抜けてアプリがクラッシュする可能性があります。

```diff
stream.on('data', (chunk) => {
  console.log(chunk)
+  stream.emit('error', new Error('error!!'))
})


+ // stream.on('error', (e) => {
+ //   console.log('error', e)
+ // })
```

これを AsyncIterator を使い `for await...of` で書き直すと次のようになります。 ReadableStream は data イベントを AsyncIteraotr として回すことができます。

`for await...of` の中では await で処理を待ち受けて、data イベント自体を待つこともできます。また、`main().catch` で包括的にエラーハンドリングを行うこともできます。

AsyncItaratro は Stream のメリットを受けながらも async/await のメリットを受けることができる素晴らしい記法です。

```js
const fs = require('fs')

const main = async () => {
  const stream = fs.createReadStream(__filename, { encoding: 'utf8', highWaterMark: 64 })

  for await (const chunk of stream) {
    console.log(chunk)
  }

  console.log('end!!')
}

main().catch((e) => console.error(e))
```

このあたりは [さよなら Stream](https://qiita.com/koh110/items/0fba3acbce38916928f1) で詳細に説明しているので、そちらを参照してください。

# Events.on, Events.once

サードパーティ製のモジュールでも Stream を利用しているモジュールはたくさんあります。例えば Redis に接続するモジュールの [ioredis](https://www.npmjs.com/package/ioredis) などはよく目にするのではないでしょうか。

ioredis は get/set などが Promise を返し、async/await 環境下でも利用しやすく人気のモジュールです。

Web アプリを作成する際 DB や KVS などを利用する時はサーバの listen をする前にそれぞれの接続を確立していなければなりません。

例えば Redis の場合には次のようなコードになるでしょう。

```js
const http = require('http')
const Redis = require('ioredis')

const redis = new Redis()
const server = http.createServer()

redis.once('ready', async () => {
  try {
    // なにか初期化処理
    await init()

    server.listen(3000, () => {
      console.log('Listening on', server.address())
    })
  } catch (e) {
    redis.emit('error', e)
  }
})

redis.on('error', (e) => {
  console.error(e)
  process.exit(1)
})
```

ioredis は接続が完了した時に `connect`イベントを emit し、利用可能状態になった時に `ready` イベントを emit します。つまりアプリケーションが Redis を利用可能になるには、ioredis が `ready` イベントを発行した時です。

ioredis は Stream を継承したオブジェクトになりますが、ready などは独自に設定されたイベントです。できればこれも AsyncIterator を使って async/await の構文で処理をしたくなります。

独自のイベントを AsyncIterator (Promise) で処理したい時に役に立つのが [events.on](https://nodejs.org/api/events.html#events_events_on_emitter_eventname), [events.once](https://nodejs.org/api/events.html#events_events_once_emitter_name)です。

## events.on

下記は Node.js ドキュメントのサンプルコードに sleep 処理を加えたものです。独自に定義した `foo` というイベントに対して AsyncIterator で処理することができるようになっているのがわかるかと思います。

```js
const { on, EventEmitter } = require('events')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const main = async () => {
  const ee = new EventEmitter()

  process.nextTick(() => {
    ee.emit('foo', 'bar')
    ee.emit('foo', 42)
  })

  for await (const event of on(ee, 'foo')) {
    console.log(event)
    await sleep(1000)
  }
}

main().catch(console.error)
```

Stream は EventEmitter を継承したオブジェクトなので、この関数を利用することで、独自のイベントを AsyncIterator や Promise で処理することができるようになります。

## events.once

先程の Redis の例を `events.once` を利用して書き直してみましょう。 `events.once` は Promise を返却するので await で待ち受けることができるようになります。

```js
const { once } = require('events')
const http = require('http')
const Redis = require('ioredis')

const redis = new Redis()
const server = http.createServer()

redis.on('error', (e) => {
  console.error(e)
  process.exit(1)
})

const main = async () => {
  await once(redis, 'ready')

  await init()

  server.listen(3000, () => {
    console.log('Listening on', server.address())
  })
}

main().catch(console.error)
```

async/await で処理ができるようになったので、初期化処理などと同等に書くことができるようになったので、見通しがよくなりました。

上のコードみて、なぜ `redis.on('error', ...)` で catch しているのか疑問に思う人がいるかもしれません。少しずつ解説していきます。

## once に潜む落とし穴 -タイミング-

上記の例では once で待ち受ける例がひとつの Stream しかありません。これが 2 つのストリームになるとどうでしょうか。

下記は e1 と e2 を 2 つの Stream に見立てたコードです。e1 が 1 秒後に返す`myevent1` と e2 が 2 秒後に返す `myevent2` を待ち受けて done を出力します。

```js
const { once, EventEmitter } = require('events')

const main = async () => {
  const e1 = new EventEmitter()
  const e2 = new EventEmitter()

  setTimeout(() => {
    e1.emit('myevent1', 1)
  }, 1000)

  setTimeout(() => {
    e2.emit('myevent2', 2)
  }, 2000)

  await once(e1, 'myevent1')
  console.log('e1')
  await once(e2, 'myevent2')
  console.log('e2')
}

main()
  .then(() => console.log('done'))
  .catch((e) => console.log('catch', e))
```

実行してみると問題なく動作していることがわかります。

```bash
$ node async-iterator.js
e1
e2
done
```

では e1 と e2 の時間を入れ替えてみたらどうなるでしょうか。

```diff
const { once, EventEmitter } = require('events')

const main = async () => {
  const e1 = new EventEmitter()
  const e2 = new EventEmitter()

  setTimeout(() => {
    e1.emit('myevent1', 1)
-  }, 1000)
+  }, 2000)

  setTimeout(() => {
    e2.emit('myevent2', 2)
-  }, 2000)
+  }, 1000)

  await once(e1, 'myevent1')
  console.log('e1')
  await once(e2, 'myevent2')
  console.log('e2')
}

main()
  .then(() => console.log("done"))
  .catch((e) => console.log("catch", e))
```

e1 しか出力されませんでした。

```bash
$ node async-iterator.js
e1
```

これは `once(e2, 'myevent2')` でハンドラーをセットする前に e2 は 'myevent2' を発行し終えてしまっているので、後続の処理が動かないためです。

つまり、両方の Stream を待ち受けるためには、ハンドラーへのセットを最速で行わなければなりません。events.once は Promise を返すので、同時にハンドラを登録するために Promise.all を利用します。

```js
const { once, EventEmitter } = require('events')

const main = async () => {
  const e1 = new EventEmitter()
  const e2 = new EventEmitter()

  setTimeout(() => {
    e1.emit('myevent1', 1)
    console.log('e1')
  }, 2000)

  setTimeout(() => {
    e2.emit('myevent2', 2)
    console.log('e2')
  }, 1000)

  await Promise.all([once(e1, 'myevent1'), once(e2, 'myevent2')])
  console.log('e1 and e2')
}

main()
  .then(() => console.log('done'))
  .catch((e) => console.log('catch', e))
```

きちんと実行されることが確認できます。

```bash
$  node async-iterator.js
e2
e1
e1 and e2
done
```

## once に潜む落とし穴 -エラーハンドリング-

正常に動作する場合は先程までのコードで問題ありません。では Stream が error を emit した場合はどうでしょうか。

```js
const { once, EventEmitter } = require('events')

const main = async () => {
  const e1 = new EventEmitter()
  const e2 = new EventEmitter()

  setTimeout(() => {
    e1.emit('myevent1', 1)
    e1.emit('error', new Error('error e1'))
    console.log('e1')
  }, 2000)

  setTimeout(() => {
    e2.emit('myevent2', 2)
    console.log('e2')
  }, 1000)

  await Promise.all([once(e1, 'myevent1'), once(e2, 'myevent2')])
  console.log('e1 and e2')
}

main()
  .then(() => console.log('done'))
  .catch((e) => console.log('catch', e))
```

一見動きそうですね。しかし実はこのコードはエラーをキャッチすることができません。

```
$ node async-iterator.js
e2
events.js:287
      throw er; // Unhandled 'error' event
      ^

Error: error e1
    at Timeout._onTimeout (/home/async-iterator.js:99:22)
```

実行してみるとエラーがキャッチできず突き抜けてしまっています。これはエラーが emit される箇所に起因しています。エラーの emit を独自イベントの前にしてみましょう。

```diff
const { once, EventEmitter } = require('events')

const main = async () => {
  const e1 = new EventEmitter()
  const e2 = new EventEmitter()

  setTimeout(() => {
+    e1.emit('error', new Error('error e1'))
    e1.emit('myevent1', 1)
-    e1.emit('error', new Error('error e1'))
    console.log('e1')
  }, 2000)

  setTimeout(() => {
    e2.emit('myevent2', 2)
    console.log('e2')
  }, 1000)

  await Promise.all([once(e1, 'myevent1'), once(e2, 'myevent2')])
  console.log('e1 and e2')
}

main()
  .then(() => console.log('done'))
  .catch((e) => console.log('catch', e))
```

こんどは無事にキャッチできていることが確認できます。

```bash
$ node async-iterator.js
e2
e1
catch Error: error e1
```

原理としては単純な話で events.once はワンショットのイベントを受けることを想定している関数です。つまり、最初の `myevent1` が emit された時点で once でラップした Promise は消化されてしまっています。

最初のサンプルは `myevent1` が emit された後に error イベントを emit していたため、後続の catch が動かなかったわけです。

しかし Stream はどのイベントがどのタイミングでくるかわかりません。なので error イベントのキャッチは Strem の構文でキャッチしておくのが無難でしょう。

```js
const { once, EventEmitter } = require('events')

const main = async () => {
  const e1 = new EventEmitter()
  const e2 = new EventEmitter()

  e1.on('error', (e) => {
    console.log('catch e1:', e)
    process.exit(1)
  })

  e2.on('error', (e) => {
    console.log('catch e2:', e)
    process.exit(1)
  })

  setTimeout(() => {
    e1.emit('myevent1', 1)
    e1.emit('error', new Error('error e1'))
    console.log('e1')
  }, 2000)

  setTimeout(() => {
    e2.emit('myevent2', 2)
    console.log('e2')
  }, 1000)

  await Promise.all([once(e1, 'myevent1'), once(e2, 'myevent2')])
  console.log('e1 and e2')
}

main()
  .then(() => console.log('done'))
  .catch((e) => console.log('catch', e))
```

# まとめ

AsyncIterator の使い方と `events.on`, `events.once` を使ってスマートに Stream を扱う方法と、その落とし穴 & 回避策をまとめました。
