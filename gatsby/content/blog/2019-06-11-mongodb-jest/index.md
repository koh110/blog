---
title: MongoDB + Jestのテスト方法
date: '2019-06-11T00:00:00.000Z'
---

## はじめに

MongoDB のテストを書いて、自分なりの方法が落ち着いたのでまとめる。

結論: <a href="https://www.npmjs.com/package/mongodb-memory-server" target="_blank">mongodb-memory-server</a> を利用する。

## 本物の MongoDB を使う方法（不採用）

自分は middleware なども含めてテストするために、実環境と同じ環境を用意して単体テスト時もそれらを利用するのが基本方針だった。

そこで MongoDB のテストもテスト用の DB を用意したが、DB を利用したテストでつきまとうテストの ABA 問題（初期化処理が二重に走って後続のテストが失敗する）に引っかかり、解決策を考えていた。

普段は並列数に合わせて `CREATE DATABASE` して DB 接続部分でそれぞれ被らないようにつなげる、という手法をよくやるのだが、Jest で並列数を固定化する方法にたどり着けなかった。

テスト開始のたびに自動で増やし続けてもいいが、ちょっとコストがかさみすぎるかなということで不採用とした。

## Jest 公式が提示する方法（不採用）

https://jestjs.io/docs/en/mongodb

ちゃんと Jest のドキュメントを読んでいると MongoDB のテストについてちゃんと記載があった。

`@shelf/jest-mongodb` というモジュールを使う方法だったので中身を読んでみた。

https://www.npmjs.com/package/@shelf/jest-mongodb

https://github.com/shelfio/jest-mongodb

中を見てみると、やっていることは Global Setup 時に mongodb-memory-server を立ち上げて、 Global Teardown 時に掃除しているだけだった。

mongodb-memory-server は人気があり活発に開発されているモジュールで、MongoDB の機能をほぼ網羅している。

jest-mongodb の機能が Setup/Teardown の Utility を提供するだけなのであれば、 mongodb-memory-server を直接使うほうが MongoDB のバージョンアップへの追従やモジュール自体のバグ修正に追いつくことも容易だろうということで、 jest-mongodb は採用しないことにした。

download 数もそこまで多くなく、更新頻度も流石に mongodb-memory-server に追従はできていなそうだったのも要因のひとつ。

## mongodb-memory-server（採用）

`@shelf/jest-mongodb` を参考に Setup/Teardown のスクリプトを自分で用意した。

setup.ts で MongoMemoryServer インスタンスを起動して global に。接続用の URI はアプリケーションが環境変数から読み込む仕様だったので環境変数に。

TypeScript で書いているわけだし本来は global の namespace にきちんと MongoMemoryServer の型を追加するべきなんだろうけど、テストコードでこのインスタンスにふれる事も少ないので any としてしまった。TypeScript は頑張りすぎないように書く方針。

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server'

export default async function() {
  const mongoServer = new MongoMemoryServer()
  const mongoUri = await mongoServer.getConnectionString()
  ;(global as any).MONGO_MEMORY_SERVER = mongoServer
  process.env.MONGODB_TEST_URI = mongoUri
}
```

最近は ; 省略派なので global への追加部分がちょっと読みづらくなってしまったが、あまり頻繁に手を加える部分じゃないしこのままとした。

teardown.ts は単純に global にある MongoMemoryServer を停止して終了。

```typescript
export default async function() {
  await (global as any).MONGO_MEMORY_SERVER.stop()
}
```

あとはテストの beforeAll と afterAll で db に接続すればテストができる。

```typescript
let client = null

beforeAll(async () => {
  client = await MongoClient.connect(process.env.MONGODB_TEST_URI, {
    useNewUrlParser: true
  })
})

afterAll(async () => {
  await client.close()
})

test('...', async () => {
  // test
})
```

メモリ上で動くので高速に動作するし、並列テストも容易。さらに実際の DB を用意する必要がなくなったので CI 上でも実行しやすくなった。

実際の MongoDB で動かすのはパターンを絞って e2e テストなどで対応しようと思う。

## まとめ

<a href="https://www.npmjs.com/package/mongodb-memory-server" target="_blank">mongodb-memory-server</a> を利用して MongoDB + Jest のテストをできるようにした。
