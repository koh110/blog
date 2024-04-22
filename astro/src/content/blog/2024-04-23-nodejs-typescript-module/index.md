---
layout: '../../../layouts/MarkdownLayout.astro'
title: Node.js + TypeScriptのモジュールを整理してみる
date: '2024-04-23'
tags: ['nodejs', 'typescript', 'module']
---

## はじめに

最近受けるNode.js + TypeScript環境の相談の中で、CommonJSやECMAScript Modulesのあたりで落とし穴にはまっている人が多いという事に気づいた。

Node.jsは歴史的にCommonJSとECMAScript Modules（以後ESMと表記）がどうしても入り乱れる環境にあり、これにTypeScriptのモジュールが加わると組み合わせでさらに複雑度が増すのが現状である。

説明する際に口頭より整理した文章が欲しいと思ったので記事にする。

以下のリポジトリで検証コードを管理している。

https://github.com/koh110/module_test

## Node.jsモジュールチェックシート

まず最初にNode.jsにおけるCommonJSとESMの挙動について整理する。
いきなり書かれても把握できないかもしれないが、一旦これだけのパターンがあるという事だけ理解してほしい。

- 拡張子
  - `.js` -> 基本はCommonJS。package.json次第で挙動が変わる
  - `.mjs` -> ESM
  - `.cjs` -> CommonJS
- package.jsonのtype
  - `"type": "module"` -> そのディレクトリ以下は `.js` をESM扱い
  - `"type": "commonjs"` -> そのディレクトリ以下は `.js` をCommonJS扱い
- 読み込み
  - ESMからCommonJS -> できる
  - CommonJSからESM -> できない（DynamicImportならできる）

Node.jsにおけるモジュール解決でだいたいこのパターンの組み合わせになる。
このあたりで何か詰まった時は、上記のパターンのどれに当てはまるのかをまず確認していくとよい。

jestなどのテストフレームワークはさらに内部でバンドラーや独自のモジュール解決を行っている場合もあるが、ビルドされた結果最終的に上記のパターンのどれかで動いていると捉えておくと解決しやすい。

ここからは上記のパターンについて説明していく。

## Node.jsとモジュール

Node.jsの中にはCommonJSとECMAScript Modulesの2つのモジュール解決法方法が存在する。

[CommonJS](https://nodejs.org/api/modules.html)
[ECMAScript modules](https://nodejs.org/api/esm.html)

CommonJSは当時JavaScriptに標準のモジュール仕様がなかったため、Node.jsが採用した仕様。

`exports` というオブジェクトに公開したい値や関数を与える事でファイルの外に公開し `require` で読み込む。

```javascript
// foo.js
exports.bar = 'bar';

---

const foo = require('./foo.js')
console.log(foo.bar)
```

ESMはJavaScript標準のモジュール仕様。
`export` というキーワードで値や関数をファイルの外に公開し `import` で読み込む。

```javascript
// foo.js
export const bar = 'bar'

---

import { bar } from './foo.js'
```

現在のLTSバージョンであるNode.js v20ではどちらのモジュール仕様もネイティブに利用可能である。

### Node.jsにおける.js拡張子

まずNode.jsの基本の動きを把握する。

Node.jsにおいて `.js` という拡張子で書かれたファイルはCommonJSで解決されるのが一番基礎のルールとなる。

つまり `.js` で import/export というキーワードは利用できない。

```javascript
// packages/module1/foo.js
export const bar = 'bar'

---
// packages/module1/index.js
import { bar } from './foo_export.js'
console.log(bar)
```

上記のコードを実行するとSyntaxErrorが発生する。

```shell
$ node packages/module1/index.js
(node:45419) Warning: To load an ES module, set "type": "module" in the package.json or use the .mjs extension.
(Use `node --trace-warnings ...` to show where the warning was created)
/home/xxx/packages/module1/index.js:1
import { bar } from './foo.js'
^^^^^^

SyntaxError: Cannot use import statement outside a module
```

これはCommonJSでは import/export という文法に対応していないためである。

まずこの何もしない状態では `.js` はCommonJSで解決されるという挙動を理解しておくとよい。

### Node.jsとESM

`.js` は基本的にCommonJSという事はわかった。ではESMを利用したい場合にはどうしたらよいのだろうか。

先ほどのWarning にも書いてあるが2通りの方法がある。

- 拡張子を `.mjs` にする
- package.jsonにtypeを設定する

#### 拡張子を.mjsにする

まずは `.mjs` を使う方法をみていく。

Node.jsでは `.mjs` 拡張子はESMで記述されていると認識される。

次のコードのように読み込む側/読み込まれる側の拡張子を `.mjs` にする。

```javascript
// packages/module2/foo.mjs
export const bar = 'bar'

---

// packages/module2/index.mjs
import { bar } from './foo.mjs'
console.log(bar)
```

これはどちらのファイルもESMになっているので問題なく実行できる

```shell
$ node packages/module2/index.mjs
bar
```

CommonJSを強制的に利用したい場合は `.cjs` という拡張子を利用する。

```javascript
// packages/module2/foo.cjs
// foo.cjsはCommonJSなのでexportではなくexportsオブジェクトに代入する
exports.bar = 'bar'

---

// packages/module2/index.mjs
// index.mjsはESMなのでrequireではなくimportを使う
import { bar } from './foo.cjs'
console.log(bar)
```

この時 `index.mjs` はESMで `foo.cjs` はCommonJSとしてNode.jsに認識される。

ESMはCommonJSのファイルをimportできるので先ほどと同じように実行できる。

```shell
$ node packages/module2/index.mjs
bar
```

逆に　`index.cjs` でindexをCommonJSに強制してもCommonJSからESMの読み込みはできない

```javascript
// packages/module2/index.cjs
const { bar } = './foo.mjs'
console.log(bar)
```

```shell
$ node packages/module2/index.cjs
node:internal/modules/cjs/loader:1089
    throw new ERR_REQUIRE_ESM(filename, true);
    ^

Error [ERR_REQUIRE_ESM]: require() of ES Module /home/xxx/packages/module2/foo.mjs not supported.
```

これはDynamicImportなどCommonJSとESMの仕様に微妙な差異があるので仕方がない。（もともとNode.jsはフロントエンドと違い、起動時に全部メモリにのせればいいので動的なモジュール読み込みが必要なケースが少ない）

ただしそのうち解消されそうではある。

ref: https://joyeecheung.github.io/blog/2024/03/18/require-esm-in-node-js/

どうしてもCommonJSからESMを読み込みたい場合はCommonJSにDynamicImportの文法が実装されているので `await import(...)` を使う事で読み込むこともできる。（実用をすすめするわけではない）

```javascript
// packages/module2/index2.cjs
async function main() {
  const { bar } = await import('./foo.mjs')
  console.log(bar)
}
main().catch(console.error)
```

#### package.jsonにtypeを設定する

次にpackage.jsonに `"type": "module"` を加える方法をみていく。

下記のコードのようにpackage.jsonの中に `"type": "module"` を加えると、そのpackage.jsonがあるディレクトリ以下の `.js` 拡張子のファイルがESMであると認識される。

```javascript
// packages/module3/package.json
{
  "private": true,
  "type": "module"
}

---

// packages/module3/foo.js
export const bar = 'bar'

---

// packages/module3/index.js
import { bar } from './foo.js'
console.log(bar)
```

こうすることで `.js` でもESMを利用できるようになる。

```shell
$ node packages/module3/index.js
bar
```

typeはpackage.jsonが存在するディレクトリ配下に影響するため、特定のディレクトリ以下をすべてESM扱いする、といったような使い方ができる。

また `"type": "commonjs"` とする事で特定のディレクトリ以下をCommonJS扱いにもできる。


```javascript
// packages/module3/esm_dir/package.json
{
  "private": true,
  "type": "module" // esm_dir以下のファイルはESMとして認識される
}

---

// packages/module3/cjs_dir/package.json
{
  "private": true,
  "type": "commonjs" // cjs_dir以下のファイルはCommonJSとして認識される
}

---

// packages/module3/cjs_dir/index.js
// .jsだがpackage.jsonで "type": "commonjs" を指定しているのでCommonJSで記述する
exports.cjsbar = 'cjs bar'

---

// packages/module3/index.mjs
// ./cjs_dir/index.js は `.js` だがpackage.jsonでCommonJS扱いになっているのでESMからCommonJSを読み込んでいることになり正常に動作する
import { cjsbar } from './cjs_dir/index.js'
console.log(cjsbar) // cjs bar
```

同じプロジェクト中で混じらせない方がよいとは思うが、CommonJSからESMへの移行期間中ではお世話になることがある挙動かもしれない。

## TypeScriptとモジュール

ここまででNode.jsのCommonJS/ESMのパターンを確認してきた。次にTypeScriptを組み合わせた時を考えてみる。

まず最初に気をつけなければならないことは「**TypeScriptのモジュール記法はESMではない**」ということだ。

TypeScriptはESMっぽい記法を採用している。

```javascript
// packages/typescript_module/src/foo.ts
export const bar = 'bar'

export default 'default export'
---

// packages/typescript_module/src/index.ts
import foo, { bar } from './foo.js' // コンパイル後のファイル名を指定するため `.js` になる
console.log(foo)
console.log(bar)

```

しかしNode.js環境におけるTypeScriptは、あくまでJavaScriptを生成するための元ファイルだ。実際に動作するのはコンパイルされた後のJavaScriptファイルになる。

これに関しては実際にコンパイルされた結果をみるとわかりやすい。次の設定で上記のコードをコンパイルした結果を確認してみよう。

```json
// packages/typescript_module/tsconfig.json
{
  "compilerOptions": {
    "outDir": "dist",
    "target": "es2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

結果は下記のようなコードになった。

```javascript
// packages/typescript_module/dist/foo.js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bar = void 0;
exports.bar = 'bar';
exports.default = 'default export';

---

// packages/typescript_module/dist/index.js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const foo_js_1 = require("./foo.js");
console.log(foo_js_1.default);
console.log(foo_js_1.bar);
```

`.js` ファイルが吐き出され、TypeScriptファイル内で書いていたimport/exportはrequire/exportsに書き換えられている。また、本筋とは関係ないが `default export` で記述したものは `exports.default` に置き換えられる。

先に確認したNode.jsの仕様に照らし合わせると `.js` は基本はCommonJSになるため「CommonJSでrequire/exportsが利用されている = 問題ない」コードが生成されていることになる。

そのため、下記のように特に問題なく実行できる。

```shell
$ node packages/typescript_module/dist/index.js
default export
bar
```

自分で書いたスクリプトしかない状態であればこれで特に問題はない。問題はnpmなどで外部から取得してきたファイルがどうなるかである。

外部のライブラリの状況を再現するために `esm_lib/foo.mjs` というファイルを読み込むサンプルを考えてみる。

次のようなディレクトリ構成とすると `src/index.ts` 内部のimportとコンパイルされた結果の `dist/index.js` 内部のrequireで参照する相対パスが一致するため、このような構成としている。

```shell
typescript_module2
├── dist
│   └── index.js
├── esm_lib
│   └── foo.mjs
├── src
│   └── index.ts
├── package.json
└── tsconfig.json
```

ファイルの内容は次のようにする。

```javascript
// packages/typescript_module2/src/index.ts
import { bar } from '../esm_lib/foo.mjs'
console.log(bar)

---

// packages/typescript_module2/esm/foo.mjs
// .mjsなのでESMとして解釈される
export const bar = 'bar'
```

これを先ほどと同じtsconfigでコンパイルすると `../esm/foo.mjs` を読み込む `dist/index.js` が生成される。

```javascript
// packages/typescript_module2/dist/index.ts
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const foo_mjs_1 = require("../esm_lib/foo.mjs");
console.log(foo_mjs_1.bar);
```

問題はこれを実行した場合だ。

```shell
$ node packages/typescript_module2/dist/index.js
node:internal/modules/cjs/loader:1089
    throw new ERR_REQUIRE_ESM(filename, true);
    ^

Error [ERR_REQUIRE_ESM]: require() of ES Module /home/xxx/packages/typescript_module2/esm_lib/foo.mjs not supported.
```

これをNode.jsの仕様に照らし合わせて考えてみよう。

生成された `dist/index.js` は `.js` なのでCommonJSとして扱われる。だが `require("../esm_lib/foo.mjs");` で読み込もうとしているファイルは `.mjs` なのでESMとして扱われるファイルだ。
つまりCommonJSからESMを読み込もうとしている状態になりエラーが発生する。

TypeScriptのプロジェクトを運用していると、依存ライブラリをバージョンアップしたらアプリケーションが動かなくなったというケースに遭遇したことがある人もいるだろう。
それはこのサンプルのように、依存ライブラリがESMで記述されるようになったがtsconfig.jsonの設定でCommonJSのファイルが吐き出されるため、CommonJS -> ESMの読み込みとなってエラーになったというパターンがある。

ではこれについてはどう解決したらよいか。これも2パターンの解決策がある。

### ファイルの拡張子を.mtsに変更する

1つめの選択肢は拡張子の変更だ。Node.jsでは `.mjs` というファイルがESM扱いされる仕様だったが、TypeScriptでは `.mts` というファイルは `.mjs` ファイルにコンパイルされる。（この後のサンプルには関係ないが `.cts` にすると `.cjs` になる）

```javascript
// packages/typescript_module3/src/index.mts
import { bar } from '../esm_lib/foo.mjs'
console.log(bar)
```

これを先の設定でコンパイルするとdist以下に `.mjs` ファイルとして生成される。

```shell
typescript_module3
├── dist
│   └── index.mjs
├── esm_lib
│   └── foo.mjs
├── src
│   └── index.mts
├── package.json
└── tsconfig.json
```

だが、このままだと `.mjs` ではあるが内部ではrequireを使っているファイルが生成されてしまう。

```javascript
// packages/typescript_module3/src/index.mjs
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const foo_mjs_1 = require("../esm_lib/foo.mjs");
console.log(foo_mjs_1.bar);
```

このファイルを実行しようとすると当然エラーとなる。
これはNode.jsとしてはESMのファイルとして認識しているのに、TypeScriptがCommonJSのファイルを吐き出してしまい、TypeScriptが挿入しているコード内部でexportsというCommonJS用のオブジェクトにアクセスしてしまっているためだ。

```shell
$ node packages/typescript_module3/dist/index.mjs
file:///home/xxx/packages/typescript_module3/dist/index.mjs:2
Object.defineProperty(exports, "__esModule", { value: true });
                      ^

ReferenceError: exports is not defined in ES module scope
```

これを回避するためにtsconfig.jsonの設定を変更する。

これを `NodeNext` とすることで生成される `.mjs` が利用するモジュールがESMになる。（正確には挙動はもっと複雑だが後述する）

```diff
{
  "compilerOptions": {
    "outDir": "dist",
    "target": "es2020",
-    "module": "commonjs",
+    "module": "NodeNext",
    "esModuleInterop": false,
    "skipLibCheck": true
  }
}
```

```shell
typescript_module4
├── dist
│   └── index.mjs
├── esm_lib
│   └── foo.mjs
├── src
│   └── index.mts
├── package.json
└── tsconfig.json
```

この設定でコンパイルしてみたファイルを確認すると生成された `.mjs` の内部でESMの文法をきちんと利用できていることが確認できる。

```javascript
// packages/typescript_module4/dist/index.mjs
import { bar } from '../esm_lib/foo.mjs';
console.log(bar);
```

大分シンプルなファイルが吐き出されるようになった。

こうなればESMからESMを読み込んでいる状態になるため、問題なく実行できるようになる。

```shell
$ node packages/typescript_module4/dist/index.mjs
bar
```

### package.jsonのtypeを設定する

もう一つは先ほどNode.jsの時にも出てきたpackage.jsonに `"type": "module"` を設定する方法だ。

tsconfig.jsonは先ほどと同様にmoduleに `NodeNext` を設定する。

```json
{
  "compilerOptions": {
    "outDir": "dist",
    "target": "es2020",
    "module": "NodeNext",
    "esModuleInterop": false,
    "skipLibCheck": true
  }
}
```

この状態で `.mts` ではなく `src/index.ts` をコンパイルしてみる。

```shell
typescript_module5
├── dist
│   └── index.js
├── esm_lib
│   └── foo.mjs
├── src
│   └── index.ts
├── package.json
└── tsconfig.json
```

この状態ではcompilerOptionsのmoduleはNodeNextとしているが、Node.jsは `.js` をCommonJSとして認識するため、TypeScriptもそれにならい `dist/index.js` をCommonJSとして生成する。

```javascript
// packages/typescript_module5/dist/index.mjs
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const foo_mjs_1 = require("../esm_lib/foo.mjs");
console.log(foo_mjs_1.bar);
```

ここでpackage.jsonに `"type": "module"` を設定する。

```diff
{
  "private": true,
+  "type": "module",
  "name": "typescript_module5",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

Node.jsの仕様を思い出すと、このpackage.jsonが配置されているディレクトリ配下の `.js` ファイルはESMとして扱うことになる。

TypeScriptもこの仕様にのっとり、package.jsonに設定が追加されている場合はESM仕様のモジュール解決をする `.js` ファイルを生成する。

ただしtsconfig.jsonの `compilerOptions.module` を `commonjs` にしているときはpackage.jsonにtypeを指定していても強制的にCommonJSのファイルが生成されることには注意が必要だ。

まとめると「package.jsonに `"type": "module"` を設定 && tsconfig.jsonの `compilerOptions.module` に `NodeNext`を設定」すると「 `.js` でESMを利用するファイルが生成される」という挙動になる。

## TypeScriptモジュールチェックシート

TypeScriptの挙動をかなり削って記述すると次のパターンの組み合わせになる。

設定の組み合わせによって生成された内部の記述と拡張子のパターンがあるという事だけ頭に入れてほしい。

- package.jsonのtype && compilerOptions.module
  - `"type": "commonjs"` && `compilerOptions.module: "commonjs"` -> CommonJSが生成される
  - `"type": "commonjs"` && `compilerOptions.module: "NodeNext"` -> CommonJSが生成される
  - `"type": "module"` && `compilerOptions.module: "commonjs"` -> CommonJSが生成される
  - `"type": "module"` && `compilerOptions.module: "NodeNext"` -> ESMが生成される
- 拡張子
  - `.ts` -> `.js` が生成される
  - `.mts` -> `.mjs` が生成される
  - `.cts` -> `.cjs` が生成される

このあたりでつまった時はそれぞれの設定がどうなっているかをまず確認するとよいだろう。

tsconfig.jsonの組み合わせによる具体的な挙動は下記のドキュメント参照するとよい。

ref: https://www.typescriptlang.org/docs/handbook/modules/theory.html#the-module-output-format



## Node.js + TypeScriptの設定をどうすべきか

ここまで挙動について細かく書いてきたが、じゃあ結局今どういう設定でやればいいのか自分の考えをまとめる。

### 新規プロジェクト

今このタイミングで0からプロジェクトを作成する場合はESMを基本にして考えたい。

そのため「package.jsonに `"type": "module"` を設定 && tsconfig.jsonの `compilerOptions.module` に `NodeNext`を設定」をして「 `.js` でESMを利用する」状態で作る。

ESM -> CommonJSは現状でも動かしやすく、つまづきポイントが少ないため最初からESMで動作する状態から作り始めるのが、運用も含めて今後楽になると考えている。

### 現時点でCommonJSのプロジェクト

今後ESMでしか動かないライブラリは増えていくと考えられるため、今のままではいずれライブラリアップデートで壊れる可能性が出てくる。

node_modules以下のファイルをwebpackやbabelなどを使って無理やりCommonJSにするという手もなくはないが、ライブラリ作者の想定を超えた利用方法になっていることが想像されるためできるだけ避けたい。

現時点の環境ではCommonJS -> ESMはそのままだと動かないので基本はESMに移行していきたい。

移行期間中はCommonJSとESMが入り混じるが、package.jsonに `"type": "module"` を設定して基本はESMを利用する形に変更し、動かない箇所は拡張子を `.cts` にして強制的にCommonJSとして動かして様子をみる形をとるだろう。

### 公開するライブラリ

現状でTypeScriptを採用しているプロジェクトでは、まだ設定でCommonJSがビルド結果として生成されているものが多いと考えられる。CommonJS -> ESMの読み込みが大変な現状ではESMのみで公開するのはユーザーフレンドリーじゃない。
だが、いずれESMに移行するというステップが必要にはなるので今はCommonJSとESMの両方に対応したデュアルパッケージを公開するのがいいだろう。

## まとめ

Node.js + TypeScript + ESMで困っているという相談を受ける事が多い。

Node.jsのCommonJSとESMのパターンを説明し、それを踏まえTypeScriptの設定からNode.jsの仕様に合わせたCommonJSとESMのパターンを説明した。

こんな複雑なことで悩みたくないというのが本音なのだが、周辺ライブラリなどのエコシステムが追いつくには時間がかかるし、今が一番カオスな状況だと思う。

そんな状況下で、おそらくNode.jsもTypeScriptもESMになるように設定してつかうのが今は一番考えることが少なくてすむ選択になると考えている。

CommonJSからESMを読めるようにする実装も近いうちにでるので、それがでたらこのへんの落とし穴にはまることも少なくなるかなと見込んでいる。多分あと1-2年くらいだろうか。

Node.js + TypeScriptのモジュールまわりで詰まっている人の一助になれば幸い。
