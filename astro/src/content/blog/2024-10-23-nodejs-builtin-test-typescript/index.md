---
layout: '../../../layouts/MarkdownLayout.astro'
title: Node.jsのビルトインテストランナーでTypeScriptのテストを実行する
date: '2024-10-23'
tags: ['nodejs', 'typescript', 'test']
---

## はじめに

Node.jsのv22から `--experimental-strip-types` オプションが追加され、TypeScriptのファイルを直接実行する手段が提供されはじめました。

https://nodejs.org/en/blog/release/v22.6.0

多少癖はありますが、これはテスト時に特にうれしい機能だと考えています。  
現状TypeScriptを利用したテストを書く場合には次のような手段がとれます。

- テストランナーライブラリにプラグインを導入する（TypeScriptが最初からサポートされているテストランナーの導入も含む）
- tscでビルドしてからテストランナーを実行する

後者の場合、ビルド結果のファイルは主にdistなど別のディレクトリに出力されるのが一般的です。この場合TypeScriptのファイルと実際に動作させるファイルの位置が異なるため、jsonファイルなどを参照している際にエラーが発生したり、エラーがおきた場合のスタックトレースが分かりにくいといった問題が発生します。

そのため、現在の環境ではテストランナーのプラグインなどでTypeScriptで記述したテストファイルを実行することが一般的です。  
例えば `vitest` は内部的に `esbuild` を利用してTypeScriptのテストファイルを実行できますし、 `jest` では `ts-jest` などのプラグインを導入することが多いでしょう。  
しかし、これらはTypeScriptからJavaScriptの変換に独自のトランスパイラを利用しているため、TypeScriptが提供しているtscとは異なる挙動をすることがあります。  
このtscと挙動が違うということは、例えばtsconfig.jsonでpathsを利用している場合にjest側でも同じ設定を記述する必要が出てきたり、ESMuduleのつもりで書いたコードがテストではCommonJSとして扱われてしまい意図しないエラーが発生するなどの問題の要因になりえます。

Node.jsのビルトインテストランナーでTypeScriptのテストを実行できるなら、モジュール解決の仕組み（CJS, ESM）はNode.jsのものを利用するためテスト時のファイルとの差分が発生しにくく、テストランナー用のビルド/読み込みの設定などで悩むことがなくなる可能性があります。  

そこで、この記事では `--experimental-strip-types` とNode.jsのビルトインテストランナーを利用してTypeScriptのテストを実行する方法について検証していきます。

## テストの準備

実際に試したコードは下記のリポジトリで管理しています。

https://github.com/koh110/nodejs-builtin-testrunner-typescript

今回は前提として下記の条件を満たします。

- Node.js >= v22
- ESModule
- Node.jsのテストランナーを利用
- アプリケーションのビルド結果はdistに出力

## ビルトインテストランナー

https://nodejs.org/api/test.html

基本的な使い方はjestやvitestと似たAPIをもっていて、それらのテストランナーを利用したことがある人なら特に違和感なく利用できるでしょう。

```javascript
// src/index.test.ts
import { test, type TestContext } from 'node:test'

test('1 + 2 = 3', (t: TestContext) => {
  t.assert.deepStrictEqual(1 + 2, 3)
})
```

assertは `node:assert` 等も利用できますが、コンテキスト内部に存在するものを利用した方がよいと考えています。これは<a href="/2023-10-25-frontend-test-book#3章">フロントエンド開発のためのテスト入門書評の3章</a>でも述べましたが、失敗時のテストでは特にassertの回数を数える必要があると考えているためです。  
Node.jsのビルトインテストランナーの場合はTestContext内のplan関数でTestContext内のassertを規定回数呼んだかどうかを記述できます。  

https://nodejs.org/api/test.html#contextplancount

コンテキスト内のassertを利用する時はTestContext型を明示的に指定する必要があります。これはTypeScriptの仕様に起因するもので、一定の深さの型推論が停止されてしまうためです。いずれ解消されるかもしれませんが、現状は型を利用するためは記述が必要です。  
型については `@types/node` を導入することで読み込みできるようになります。  

https://github.com/DefinitelyTyped/DefinitelyTyped/pull/70193#discussion_r1701279488
https://github.com/DefinitelyTyped/DefinitelyTyped/blob/a0058c8132907c88b6e4d3dd0f4103f799deb732/types/node/test.d.ts#L672-L687


`.js` ファイルであれば `node --test` だけでテストファイルを実行できます。  
デフォルトでは `test` ディレクトリや `**/*.test.js` などのファイルが実行対象になります。  

https://nodejs.org/api/test.html#running-tests-from-the-command-line

余談ですが自分は `**/*.test.js` というスタイルで、コードとテストを同じディレクトリに配置するスタイルが好きでよく採用しています。  
そのため、本記事でもこのスタイルでテストが可能かという視点で見ていきます。

今回は次のような構成で実行します。

```bash
.
├── src/
│     ├── index.test.ts
│     └── index.ts
├── tsconfig.json
├── package.json
└── package-lock.json
```

上記のテストコードを実行してみます。今回は明示的にテスト対象を選択するために `--test` の後にファイルを指定しています。  
`--experimental-strip-types` オプションでTypeScriptのテストファイルを直接実行してみます。

```bash
$ node --experimental-strip-types --test src/*.test.ts
(node:256792) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:256798) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ 1 + 2 = 3 (1.690332ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 100.474639
```

`--experimental-strip-types` はまだ実験的な機能と位置付けられているため、実行時に警告が表示されます。  
警告は出るものの、テスト自体は実行され結果が正常に表示されました。

これでほかのファイルを読み込まない独立したTypeScriptのテストファイルがビルトインテストランナーで実行できることが確認できました。

## TypeScriptモジュールのテスト

次はin/outだけの単純な関数をテストしてみましょう。  
libフォルダを作成し、calc.tsとcalc.test.tsを作成します。

```bash
.
├── src/
│     ├── lib/
│     │     ├── calc.test.ts
│     │     └── calc.ts
│     ├── index.test.ts
│     └── index.ts
├── tsconfig.json
├── package.json
└── package-lock.json
```

内容は単に足し算を行う関数です。

```typescript
// src/lib/calc.ts
export function add(a: number, b: number) {
  return a + b
}
```

テストの内容自体は先のテストと大して変わりませんが、別ファイルを読み込むためimportの記述が追加されています。  

```typescript
// src/lib/calc.test.ts
import { test, type TestContext } from 'node:test'
import { add } from './calc.ts'

test('add: 1 + 2', (t: TestContext) => {
  const result = add(1, 2)
  t.assert.deepStrictEqual(result, 3)
})
```

ここでの注意点は、importは `*.js` ではなく `*.ts` で記述するという点です。  
tscでビルドする場合は `*.js` でimportを記述しますが、`--experimental-strip-types` では `*.ts` を指定しなければなりません。この点がtscでビルドする場合と異なるため注意が必要です。  

https://nodejs.org/api/typescript.html#importing-types-without-type-keyword
https://github.com/nodejs/loaders/issues/208

このテストを先ほど同様に実行して確認してみましょう。フォルダが一階層深くなったため、`src/**/*.test.ts` をテスト対象に追加して実行します。

```bash
$ node --experimental-strip-types --test src/*.test.ts src/**/*.test.ts
(node:262472) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:262480) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ 1 + 2 = 3 (1.661692ms)
(node:262481) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ add: 1 + 2 (1.636742ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 101.524091
```

相変わらず警告が多く表示されてしまいますが、2つのテストが実行されています。これで別ファイルのテストも `--experimental-strip-types` で実行できることが確認できました。

### TypeScriptファイルを直接実行できるメリット

これだけだと直接実行するメリットがあまりありません。tscでテストファイルごとビルドし `dist/` 以下のテストファイルを実行すれば警告も表示されずに実行できるでしょう。  
もちろん実際にテストしたいファイルと実行されるファイルが異なるため、失敗時にスタックトレースが分かりにくいという問題はありますが。  

ビルドしないで直接実行できることがうれしいケースは、TypeScript以外のファイルを読み込みたい場合です。  
例えばseedデータをjson形式で別に用意するケースを考えてみます。

```bash
.
├── src/
│     ├── lib/
│     │     ├── calc.test.seeds.json
│     │     ├── calc.test.ts
│     │     └── calc.ts
│     ├── index.test.ts
│     └── index.ts
├── tsconfig.json
├── package.json
└── package-lock.json
```

seedファイルの中身は以下のようなJSONにします。

```json
{
  "addSeeds": [
    [1, 2, 3],
    [2, 3, 5],
    [3, 4, 7],
    [5, 6, 11],
    [8, 9, 17]
  ]
}
```

tscでテストファイルごとビルドする場合、このファイルは `.json` であるためtscだけでは `dist/` にコピーされません。そのため、seedsファイルを `dist/` 以下にコピーするスクリプトを追加するなど、postbuildの処理が必要になります。  
しかし `--experimental-strip-types` を利用して直接実行できるのであれば、実態のファイルパスが変更されないためseedファイルの相対的な位置も変わらずに利用できます。  

このseedを利用してadd関数を繰り返し実行するテストを書いてみましょう。  
今回はdescribeとitを利用してsubテストとして作成します。  

`calc.test.seeds.json` から読み込んだadd関数の引数と計算結果の配列をもとにループでテストを実行します。  

```typescript
// src/lib/calc.test.ts
import { test, type TestContext, describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { add } from './calc.ts'

// seedファイルの読み込み
const { addSeeds } = JSON.parse(await readFile(new URL('./calc.test.seeds.json', import.meta.url), 'utf-8'))

test('add: 1 + 2', (t: TestContext) => {
  const result = add(1, 2)
  t.assert.deepStrictEqual(result, 3)
})

// seedを利用したテスト
describe('describe', () => {
  for (const [ a, b, expected ] of addSeeds) {
    it(`add(${a}, ${b}) === ${expected}`, async (context: TestContext) => {
      const result = add(a, b)
      context.assert.deepStrictEqual(result, expected)
    })
  }
})
```

上記のテストを実行してみると、seedファイルを読み込んでテストを実行していることが確認できます。（警告は省略しています）

```bash
$ node --experimental-strip-types --test src/*.test.ts src/**/*.test.ts
✔ 1 + 2 = 3 (1.716801ms)
✔ add: 1 + 2 (1.641153ms)
▶ describe
  ✔ add(1, 2) === 3 (0.587887ms)
  ✔ add(2, 3) === 5 (0.519558ms)
  ✔ add(3, 4) === 7 (0.486328ms)
  ✔ add(5, 6) === 11 (0.413608ms)
  ✔ add(8, 9) === 17 (0.450158ms)
▶ describe (1.137085ms)
ℹ tests 7
ℹ suites 1
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 110.9454
```

### 並列テスト

少し本筋からそれますが、ビルトインテストランナーは並列テストもサポートしています。testやdescribeのオプションで `concurrency: true` とすることで並列に実行されます。  
先のテストに `concurrency: true` とsleepを追加して並列テストの挙動を確認してみましょう。  

```typescript
// src/lib/calc.test.ts
import { test, type TestContext, describe, it } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { readFile } from 'node:fs/promises'
import { add } from './calc.ts'

const { addSeeds } = JSON.parse(await readFile(new URL('./calc.test.seeds.json', import.meta.url), 'utf-8'))

test('add: 1 + 2', (t: TestContext) => {
  const result = add(1, 2)
  t.assert.deepStrictEqual(result, 3)
})

// 明示的にconcurrency: falseを指定して直列実行
describe('describe', { concurrency: false }, () => {
  for (const [ a, b, expected ] of addSeeds) {
    it(`add(${a}, ${b}) === ${expected}`, async (context: TestContext) => {
      await setTimeout(1000)
      const result = add(a, b)
      context.assert.deepStrictEqual(result, expected)
    })
  }
})
```

このテストを実行するとテストが直列実行されるため、describe以下のテストがそれぞれ1秒ずつ待機するためdescribe全体で5秒程度かかっていることが確認できます。

```bash
$ node --experimental-strip-types --test src/*.test.ts src/**/*.test.ts
✔ 1 + 2 = 3 (1.645572ms)
✔ add: 1 + 2 (1.828671ms)
▶ describe
  ✔ add(1, 2) === 3 (1001.921948ms)
  ✔ add(2, 3) === 5 (1001.390411ms)
  ✔ add(3, 4) === 7 (1001.122526ms)
  ✔ add(5, 6) === 11 (1002.082295ms)
  ✔ add(8, 9) === 17 (1001.884881ms)
▶ describe (5009.516737ms)
ℹ tests 7
ℹ suites 1
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5118.07752
```

これを `concurrency: true` に変更し実行してみると、それぞれのテストは1秒程度かかりますが、それぞれが並列に実行されるためdescribe全体では1秒程度で終了することが確認できます。  

```typescript
describe('describe', { concurrency: true }, () => {
  for (const [ a, b, expected ] of addSeeds) {
    it(`add(${a}, ${b}) === ${expected}`, async (context: TestContext) => {
      await setTimeout(1000)
      const result = add(a, b)
      context.assert.deepStrictEqual(result, expected)
    })
  }
})
```

```bash
$ node --experimental-strip-types --test src/*.test.ts src/**/*.test.ts
✔ 1 + 2 = 3 (1.609442ms)
✔ add: 1 + 2 (1.651502ms)
▶ describe
  ✔ add(1, 2) === 3 (1001.966849ms)
  ✔ add(2, 3) === 5 (1002.104528ms)
  ✔ add(3, 4) === 7 (1002.440337ms)
  ✔ add(5, 6) === 11 (1002.598376ms)
  ✔ add(8, 9) === 17 (1002.860005ms)
▶ describe (1004.070719ms)
ℹ tests 7
ℹ suites 1
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1107.18619
```

`concurrency` オプションはtrueだけでなく数値を指定することで並列数を制御することもできます。  

```bash
# `concurrency: 2` で実行したパターン
$ node --experimental-strip-types --test src/*.test.ts src/**/*.test.ts
✔ 1 + 2 = 3 (1.726581ms)
✔ add: 1 + 2 (1.529893ms)
▶ describe
  ✔ add(1, 2) === 3 (1001.594545ms)
  ✔ add(2, 3) === 5 (1002.170142ms)
  ✔ add(3, 4) === 7 (1000.926074ms)
  ✔ add(5, 6) === 11 (1000.583256ms)
  ✔ add(8, 9) === 17 (1002.427029ms)
▶ describe (3005.656064ms) # 5個のテストを2並列なので3秒程度
ℹ tests 7
ℹ suites 1
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3110.217062
```

describeを利用してサブテストを実行する際はこれだけで特に問題ありませんが、TestContextを利用してtest関数で並列なサブテストを作成する際は少し注意が必要です。  
TestContext内部にあるtest関数はPromiseを返すため本来はawaitをつける必要があります。

https://nodejs.org/api/test.html#testname-options-fn

```typescript
test('top level test', async (t) => {
  await t.test('longer running subtest', async (t) => {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 1000);
    });
  });
});
```

しかしawaitで待ち受けてしまうと直列のテストになってしまうので、concurrencyオプションを利用する場合はawaitをつけたくありません。

```typescript
test('add from seeds: subtest concurrency', { concurrency: true }, async (t) => {
  for (const [ a, b, expected ] of addSeeds) {
    // 並列に実行したいためawaitをつけたくない
    t.test(`add(${a}, ${b}) === ${expected}`, async (context: TestContext) => {
      await setTimeout(1000)
      const result = add(a, b)
      context.assert.deepStrictEqual(result, expected)
    })
  }
})
```

しかし、このテストを実行すると次のようなエラーが発生します。

```bash
$ node --experimental-strip-types --test src/*.test.ts src/**/*.test.ts
✔ 1 + 2 = 3 (1.612933ms)
✔ add: 1 + 2 (1.603072ms)
▶ describe
  ✔ add(1, 2) === 3 (1002.117891ms)
  ✔ add(2, 3) === 5 (1002.2459ms)
  ✔ add(3, 4) === 7 (1002.544329ms)
  ✔ add(5, 6) === 11 (1002.755968ms)
  ✔ add(8, 9) === 17 (1003.071257ms)
▶ describe (1004.271421ms)
▶ add from seeds: subtest concurrency
  ✖ add(1, 2) === 3 (1.103144ms)
    'test did not finish before its parent and was cancelled'

  ✖ add(2, 3) === 5 (1.126055ms)
    'test did not finish before its parent and was cancelled'

  ✖ add(3, 4) === 7 (1.158344ms)
    'test did not finish before its parent and was cancelled'

  ✖ add(5, 6) === 11 (1.051615ms)
    'test did not finish before its parent and was cancelled'

  ✖ add(8, 9) === 17 (1.007206ms)
    'test did not finish before its parent and was cancelled'

▶ add from seeds: subtest concurrency (1.106255ms)
ℹ tests 13
ℹ suites 1
ℹ pass 7
ℹ fail 1
ℹ cancelled 5
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2109.967248

✖ failing tests:

test at src/lib/calc.test.ts:27:7
✖ add(1, 2) === 3 (1.103144ms)
  'test did not finish before its parent and was cancelled'

test at src/lib/calc.test.ts:27:7
✖ add(2, 3) === 5 (1.126055ms)
  'test did not finish before its parent and was cancelled'

test at src/lib/calc.test.ts:27:7
✖ add(3, 4) === 7 (1.158344ms)
  'test did not finish before its parent and was cancelled'

test at src/lib/calc.test.ts:27:7
✖ add(5, 6) === 11 (1.051615ms)
  'test did not finish before its parent and was cancelled'

test at src/lib/calc.test.ts:27:7
✖ add(8, 9) === 17 (1.007206ms)
  'test did not finish before its parent and was cancelled'
```

awaitをつけていないためサブテストの実行完了をまたずに親テストが終了してしまい、サブテストがキャンセルされるという状態です。  
これを回避して並列テストを実行するためには、サブテストを一旦配列で受け止め、Promise.allですべてのテスト実行を待ち受ける必要があります。（なぜこんな仕様にしてしまったのかは謎です。自分はdescribeよりtest関数を利用してネストを浅く書くのが好きなので残念な仕様です）

```typescript
test('add from seeds: subtest concurrency', { concurrency: true }, async (t) => {
  const promises: Promise<unknown>[] = []
  for (const [ a, b, expected ] of addSeeds) {
    const p = t.test(`add(${a}, ${b}) === ${expected}`, async (context: TestContext) => {
      await setTimeout(1000)
      const result = add(a, b)
      context.assert.deepStrictEqual(result, expected)
    })
    promises.push(p)
  }
  await Promise.all(promises)
})
```

## mockありのテスト

ここまでの内容でもテストは書けますが、実際にテストを実行しようと思うとモックの機能は欠かせないため `--experimental-strip-types` を利用してもモックの機能に影響がないことを確認します。

```bash
.
├── src/
│     ├── lib/
│     │     ├── calc.test.seeds.json
│     │     ├── calc.test.ts
│     │     ├── calc.ts
│     │     ├── request.test.ts
│     │     └── request.ts
│     ├── index.test.ts
│     └── index.ts
├── tsconfig.json
├── package.json
└── package-lock.json
```

単純なリクエストを送る `lib/request.ts` を作成し、テスト時にはリクエストが送られないようモックするというケースをテストします。  
今回はモックの機能の確認に利用するため、中身は単なるfetchのラッパーです。

```typescript
// src/lib/request.ts
export async function request(url: string) {
  const response = await fetch(url)
  const body = await response.text()
  return body
}
```

上記のコードにテストを追加します。  
テストケース内では `https://www.yahoo.co.jp` にリクエストを送るように書いていますが、beforeで指定したmockでレスポンスが `defualt response` になるようにしています。  
`https://www.yahoo.co.jp` が `defualt response` という文字列を返すことはないので、このテストが成功すればmockが正常に動作していることが確認できます。  
また、2つめのtestではTestContextから与えられるmockを利用しbeforeで設定したmock上書きして `mocked response` を返すようにしています。

```typescript
// src/lib/request.test.ts
import { test, before, mock, type TestContext } from 'node:test'
import { request } from './request.js'

before(() => {
  mock.method(globalThis, 'fetch', () => {
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => 'defualt response'
    } as Response)
  })
})

test('request', async (t: TestContext) => {
  const res = await request('https://www.yahoo.co.jp')

  t.assert.strictEqual(res, 'defualt response')
})

test('mocked request', async (t: TestContext) => {
  t.mock.method(globalThis, 'fetch', () => {
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => 'mocked response'
    } as Response)
  })

  const res = await request('https://www.yahoo.co.jp')

  t.assert.strictEqual(res, 'mocked response')
})
```

このテストを実行してみると、mockが正常に動作してpassしていることが確認できます。

```bash
$ node --experimental-strip-types --test src/*.test.ts src/**/*.test.ts
✔ 1 + 2 = 3 (1.713982ms)
✔ add: 1 + 2 (1.700742ms)
▶ describe
  ✔ add(1, 2) === 3 (1001.976973ms)
  ✔ add(2, 3) === 5 (1002.164473ms)
  ✔ add(3, 4) === 7 (1002.471661ms)
  ✔ add(5, 6) === 11 (1002.68916ms)
  ✔ add(8, 9) === 17 (1003.102048ms)
▶ describe (1004.440781ms)
▶ add from seeds: subtest concurrency
  ✔ add(1, 2) === 3 (1001.539526ms)
  ✔ add(2, 3) === 5 (1001.913825ms)
  ✔ add(3, 4) === 7 (1002.222123ms)
  ✔ add(5, 6) === 11 (1002.549352ms)
  ✔ add(8, 9) === 17 (1002.658452ms)
▶ add from seeds: subtest concurrency (1003.817856ms)
✔ request (1.190434ms)
✔ mocked request (0.333959ms)
ℹ tests 15
ℹ suites 1
ℹ pass 15
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2117.159392
```

## 所感

`--experimental-strip-types` を利用してNode.jsのビルトインテストランナーでTypeScriptのテストを実行する方法について検証した。  
思った以上に普通に実行できてしまって個人的には驚いている。小さなプロダクトでvitesやjestも入れたくないというシーンでは活用できる箇所があるかもしれないと感じた。  

また、CLIツールなどではすでに `--experimental-strip-types` はかなり有用だと感じていて実践導入をしている。CLIでは直接TypeScriptファイルを実行したいという欲求はあるが、ビルドのの手間は省きたいし、ほかのファイルを読み込んだりすることもあるため相対パスのずれ問題などを考えたくない。さらに `ts-node` や `esbuild-register` などの依存も増えないため、ライブラリやNode.jsのバージョンアップで挙動に悩まされることもない `--experimental-strip-types` はかなりメリットがある。（CJSやEJSの違いでこの辺が壊れることがあったが、ビルトインの機能ならばその辺が本体で担保されるためトラブルシューティングがしやすいだろうという安心感がある）

反面、結局tscとimportの挙動が異なる点などもあるため、アプリケーションでは `--experimental-strip-types` を積極利用するのは難しそうだとも感じた。
挙動が異なる点などについてはいつか解消されるかもしれないが、そうならない可能性も高いとみている。現時点では実際に本番環境で動作するアプリケーションは、運用時の原因特定を容易にするという意味でもtscでビルドされた結果のJavaScriptファイルが実行されるべきだと考えている。
