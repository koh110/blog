---
layout: '../../../layouts/MarkdownLayout.astro'
title: vitestではbeforeEachを使わない
date: '2025-07-11'
tags: ['nodejs', 'typescript', 'test', 'vitest']
---

# はじめに

最近DBありのテストを記述していた際に、実はvitestではbeforeEachは必要ないのではないか、という考えに至ったのでその理由と設計についてまとめてみる。

下記のリポジトリで実験する

https://github.com/koh110/vitest-beforeeach

# テストでbeforeEachが欲しくなるシーン

テストを記述する際にbeforeEachが欲しくなるシーンは主に以下の2点ではないかと考えている。

- mockの設定/reset
- seedsの投入

このうち、前者mockの設定/resetはbeforeEachではなくbeforeAll or すべての個別テストごとに設定すべきなのではと考えている。　　
これは自分がテスト単体での移植性を重視している（テスト単体をコピペしてもなるべくそのまま動かせる）ので、beforeEachでやってしまうとあるテストに関係のないmock化やmockのresetが入り込んでしまう可能性があると考えているのが理由である。

後者のseedsの投入については共通するseedをテストごとに投入したいというニーズも、beforeEachで行われることが多いが、そのseedのデータにアクセスしようとすると、一旦testのスコープの外にデータの参照を逃がす等しないといけないため、きれいにかけていなかった。

```javascript
let seeds = []
beforeEach(async () => {
  seeds = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ]
  await db.user.createManey({
    data: seeds
  })
})

test('test1', async () => {
  const newUser = await createUser('Charlie')
  const after = await db.user.findMany()

  // ここでファイルglobalな変数にアクセスするのがイケてない
  expect(after.length).toStrictEqual(seeds.legnth + 1)
})
```

また、beforeEachでseedの生成をやってしまうと、個別のテストで走らなくてもよいシーンでもseedの生成が必ず走ってしまうため無駄なDBアクセスが発生し、テスト速度低下の要因にもなりえる。  
そして何10件も共通するデータをテストごとに書くのは冗長で面倒くさい。シンプルに移植性なども考えれば共通のseed生成関数を作ってテストの前で呼び出せばいいが、もっとうまい方法はないのかと考えていた。  
vitestのドキュメントを読んでいたところ、Text Contextの拡張がちょうどこれらの要件にマッチしているということに気付いたので、この実装を試してみることにした。

## Text Context

[Text Context](https://vitest.dev/guide/test-context)

vitestにはデフォルトでもいくつかテストごとに独立したContextを取得する方法が用意されている。

例えばskipなどで個別のテストをskipしたりできる。（この場合はit.skipでもよいが）

```javascript
import { it } from 'vitest'

it('skip test', ({ skip, expect }) => {
  skip()
  expect(1 + 2).toBe(3)
})
```

このContextにseedのデータが渡せると、ファイルスコープの変数に依存せずに、テストごとに独立したデータを扱えるようになる。

```javascript
// こういうことがしたい
it('test1', ({ seeds }) => {
  expect(seeds.length).toBe(2)
})
```

ドキュメントを読んでみるとbeforeEachのcontextに直接アクセスする方法があるが、これはDeprecatedになっている。（確かにシンプルではあるが型安全ではないしDeprecatedにしたいという理由はわかる）

https://vitest.dev/guide/test-context.html#beforeeach-and-aftereach

代わりに提供されているのが `test.extend` でテストそのものを拡張するやり方だ。

https://vitest.dev/guide/test-context.html#extend-test-context

test.extendを使ってbeforeEachでseedを作っていたテストを変更すると次のようになる。

```javascript
const test = baseTest.extend<{
  seeds: { id: number; name: string }[]
}>({
  seeds: async ({ task }, use) => {
    const seeds = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]
    await db.user.createMany({
      data: seeds
    })
    await use(seeds)
  }
})

test('test1', async ({ seeds }) => {
  const newUser = await createUser('Charlie')
  const after = await db.user.findMany()

  // ここでcontext経由のアクセスができる
  expect(after.length).toStrictEqual(seeds.legnth + 1)
})
```

contextを経由することでletによるスコープ外へのアクセスをなくしてseedデータにアクセスできるようになった。

また、`test.extend` による拡張のよい所はコンテキストにアクセスしない限りは実行されないという点だ。　

```javascript
const test = baseTest.extend<{
  seeds: { id: number; name: string }[]
}>({
  seeds: async ({ task }, use) => {
    const seeds = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]
    await db.user.createMany({
      data: seeds
    })
    await use(seeds)
  }
})

test('test1', async ({ seeds }) => {
  const newUser = await createUser('Charlie')
  const after = await db.user.findMany()

  expect(after.length).toStrictEqual(seeds.legnth + 1)
})

// seedにアクセスしなければcreateManyは実行されない
test('test2', async() => {
  expect(1 + 2).toBe(3)
})
```

これはbeforeEachに対する優位性で、testを単純に増やしても全体の実行時間が線形に増えないということになる。  
DBにアクセスするテストは何も考えずに書いていると、こういうったところが積み重なり実行時間が遅くなっていく傾向が多く、beforeEachを単純に膨れ上がらせることがない `test.extend` はよい選択だといえる。  

実際に単にbeforeEachでseedを投入するテストを `test.extend` で必要なタイミングだけseedを投入するように書くと、当たり前だがcreateManyが実行される回数が少なくなる分実行時間が短くなる。  
https://github.com/koh110/vitest-beforeeach/blob/main/src/user/index.baseTest.test.ts  
https://github.com/koh110/vitest-beforeeach/blob/main/src/user/index.beforeeach.test.ts  

```bash
 ✓ src/user/index.baseTest.test.ts (5 tests) 167ms
 ✓ src/user/index.beforeeach.test.ts (5 tests) 184ms

 Test Files  2 passed (2)
      Tests  10 passed (10)
```

この程度のテストの数では微差だが、テストの総実行時間は積み上げなのでこういった細かな最適化が大事だと考えている。  
そのため絶対に実行されてしまうbeforeEachはできるだけ避けて、適切なseedを必要なタイミングにだけ投入できる `test.extend` を利用していくのがよいのではないだろうか、というのが今回の要旨だ。

# 余談: DBつきテスト時間短縮に考えていること

seedの投入タイミングも大事だが、DBつきのテストでは並列性を上げることが特に重要だと考えている。  
DBつきのテストを並列実行する基礎の考え方は [jestでDBありのテストを高速化する](../2022-07-02-jest-speedup) に記載している。  
追加で、並列性を上げるために気を付けている書き方をまとめる。  

大きく考えると「seedがそれぞれuniqになるようにする」と「事前のstateに依存したテストをなるべく書かない」という点を意識してテストを書いている。  

DBつきのテストで実行時間を下げている要因は直列的な実行に依存したテストの書き方であることが多い。  
例えばseedの投入を考えても `user.name` にuniq制約がある場合、テストの実行ごとにtableのtruncateをはさんだり、同時に2つのテストが走った際にテストの本質とは関係がないのにuniq制約にひっかかりseedの投入に失敗するといったことがある。  
これを簡単に避けるために直列実行（jestの `--runInBand` や vitestの `--poolOptions.threads.maxThreads=1` など）が採用されてしまうケースがある。  
しかし、これは本質的にはユニーク制約を避けたい、だったり事前の状態を同じにしたいという欲求からきている。  
つまりそれをクリアできればよいので、テストは常に並列に実行されるという前提のもとでそれらをクリアできる書き方を常に考えるようにしている。  

例えば、ユニーク制約を避けるならば、テストごとにユニークな値が生成できればよい。  

vitestの場合はcontextに含まれる `task.id` がテストごとにユニークな値を持つreadonlyな値なので、uniq制約がつくパラメータにはこれをprefix/suffixとして付与されるようにしている。

https://vitest.dev/guide/test-context.html#task

```javascript
const test = baseTest.extend<{
  seeds: { id: number; name: string }[]
}>({
  seeds: async ({ task }, use) => {
    const seeds = [
      { id: 1, name: `${task.id}-Alice` },
      { id: 2, name: `${task.id}-Bob` }
    ]
    await db.user.createMany({
      data: seeds
    })
    await use(seeds)
  }
})

test('test1', async ({ seeds, task }) => {
  expect(seeds[0].name).toBe(`${task.id}-Alice`)
})

test('test2', async({ seeds }) => {
  expect(seeds[0].name).toBe(`${task.id}-Alice`)
})
```

こうすることで `test1` と `test2` は独立したseedsになるのでuniq制約に引っかからない = 並列に実行できる  

事前のstateを同じにしたいという場合は、なぜそうしたいのかを分解する必要がある。  
たとえばDBにデータが追加されることをテストするために、事前のstateから+1件されたといったケースでは、DBに入っている総データの数が大事なのではなく、事前のstateに対して+1件されたということが大事なので、事前のstateを同じにする必要はない。  

例えば以下のようにそのテストに関係しているstateのデータが+1されたと考えれば事前のDBの状態は考えなくてもよいはずである。  

```javascript
test('test1', async ({ seeds, task }) => {
  // task.idを含むデータの数
  const before = await db.user.count({
    where: { name: { startsWith: task.id } }
  })
  const newUser = await createUser(`${task.id}-Charlie`)
  // task.idを含むデータが+1件されていれば1件追加とみなせるはず
  const after = await db.user.count({
    where: { name: { startsWith: task.id } }
  })
  expect(after).toBe(before + 1)
})
```

ただ、本当に事前のstateをそろえる必要があったり、あまりにも複雑になりすぎてしまう場合は別のファイルに分割し直列実行に依存したテストとすることもある。

ここはバランスだが、必要のないテストまで直列に実行してしまうことがないように、できるだけ並列性を保てるテストというのを前提としてテストを書いている

