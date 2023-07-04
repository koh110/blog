---
layout: '../../../layouts/MarkdownLayout.astro'
title: TypeScriptのモノレポ構成を考える
date: '2023-07-03'
tags: ['JavaScript', 'TypeScript', 'Node.js', 'monorepo']
---

# はじめに

あまりモノレポの構成について語られている記事が多くないなと感じたので、現時点で自分が考えている設計をまとめてみる。

以前にTwitterでディレクトリ構成と内容については言及したが、実際に利用する技術についてはあまり触れなかったので改めて検証してみた。

https://twitter.com/koh110/status/1617510034266808322


クライアントサイドとサーバーサイドのコード共有については下記の記事がよくまとまっていた。
https://capelski.medium.com/effective-code-sharing-in-typescript-monorepos-475f9600f6b4

上記の記事の構成も参考にしつつ、自分の考えも加えて検証していく。

- 相対パスを利用する方法
- npmのローカルパス指定（file:xx）を利用する方法
- シンボリックリンクを利用する方法
- npm workspaces機能を利用する方法

先に結論を記述しておくと「npm workspaces機能を利用する方法」が一番よいと考えている。

## 相対パスを利用する方法

相対パスで共通モジュールを読み込む方法について下記のリポジトリで検証を行った。

https://github.com/koh110/monorepo-test-relative-path

構成要素は下記

- フロントエンド (create-react-app)
- フロントエンド (vite)
- バックエンド（express）
- 共通モジュール

viteを検証するため、すべてのパッケージはECMA Modulesで構成する。

### メリット

- 相対パス指定なのでやっている事がわかりやすい
  - ディレクトリベースで考えればよいのでシンプルで、何かおかしな挙動があっても原因を特定しやすい

### デメリット

- npm installがそれぞれのパッケージルートで必要
- それぞれのディレクトリに移動して各パッケージを起動する（ちょっとめんどくさい）
- create-react-appは動かない
- 共通モジュールがTypeScriptの場合、事前にそのパッケージでビルドしていないといけない（tsconfigのProject Referencesを使う方法はある）
- 依存ライブラリをsharedだけでなくそれぞれのパッケージにも入れないと動かない（dayjs）
  - テストは共通パッケージのみで完結したいが、それぞれがばらばらのdayjsに依存してた場合適切なテストと言えるのか疑問になる

それぞれのパッケージについて次に記述する

### frontend (create-react-app)

そもそも src/ の外のディレクトリを指定できないため現実的でない。
webpack等の設定を適切にいじる必要がある。あまり建設的なやり方にできなさそう。

![create-react-appのエラー](/img/2023-07-03-monorepo/relative1.png)

### frontend-vite (vite)

viteは特に問題なく src/ 外のファイルもビルドできる。

`dist/assets/index-xxx.js` を見るとdayjsごとビルドされていることがわかる。

### backend

shared/ 以下で依存しているライブラリは shared/node_modules/ を見てほしいが backend/dist のディレクトリ構成的に backend/node_modules/ を見てしまう

```bash
$ npm start
> prestart
> rm -rf dist && tsc


> start
> PORT=3001 node dist/backend/src/server.js

node:internal/errors:491
    ErrorCaptureStackTrace(err);
    ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'dayjs' imported from /xxx/monorepo-test-relative-path/backend/dist/shared/src/date-util.js
```

backendのtsconfigに `"rootDir": "."` をセットしないことに注意

相対パスで `backend/` を超える指定をしているため、rootDirの指定をするとビルド時にエラーが発生する

> src/server.ts:3:32 - error TS6059: File '/xxx/monorepo-test-relative-path/shared/src/date-util.ts' is not under 'rootDir' '/xxx/monorepo-test-relative-path/backend'. 'rootDir' is expected to contain all source files.

rootDirの指定をしないと dist/ 以下にbackendとsharedを含めたディレクトリ構成でビルドされる

```bash
backend
├── dist
│   ├── backend
│   │   └── src
│   │       └── server.js
│   └── shared
│       └── src
│           └── date-util.js
├── src
│   └── server.ts
├── package-lock.json
├── package.json
└── tsconfig.json
```

## npmのローカルパス指定を利用する方法

npmのローカルパスしていで共通モジュールを読み込む方法について下記のリポジトリで検証を行った。

https://github.com/koh110/monorepo-test-npm-file

構成要素は下記

- フロントエンド (create-react-app)
- フロントエンド (vite)
- バックエンド（express）
- 共通モジュール

npmはdependenciesにローカルパスを指定が可能。

https://docs.npmjs.com/cli/v9/configuring-npm/package-json#local-paths

dependenciesに次のように `file:` からはじまるパスを指定し、`npm install` をするとnode_modules以下に指定したパスのシンボリックリンクが作成される。

```json
{
  "dependencies": {
    "@my-module/shared": "file:../shared"
  }
}
```

```bash
$ ls -la node_modules/@my-module
total 0
drwxr-xr-x   3 kohtaito  staff    96  5  8 18:00 ./
drwxr-xr-x  63 kohtaito  staff  2016  5  8 18:00 ../
lrwxr-xr-x   1 kohtaito  staff    15  5  8 18:00 shared@ -> ../../../shared
```

ここではsharedを事前ビルドしていないくてもビルドできるようにtsconfigのProject Referencesを利用する。
https://www.typescriptlang.org/docs/handbook/project-references.html

### メリット

- 昔からあるnpmの機能なので動作には安心感がある
- 依存ライブラリをsharedのpackage.jsonにだけ入れておけば動く

### デメリット

- npm installがそれぞれのパッケージルートで必要
- node_modulesのモジュールパス解決とTypeScriptのimportの解決方法をうまく合わせないと使いにくい

### frontend (create-react-app)

パッケージの依存にsharedを入れておけばバンドラーが参照してビルド成果物に含めてくれる

```json
{
  ...
  "dependencies": {
    ...
    "@my-module/shared": "file:../shared"
  }
  ...
}
```

TypeScriptのビルドがtscじゃないため、Project Referencesが効かない。

そのためsharedは事前ビルドが必要

### frontend (vite)

パッケージの依存にsharedを入れておけばバンドラーが参照してビルド成果物に含めてくれる

```json
{
  ...
  "dependencies": {
    ...
    "@my-module/shared": "file:../shared"
  }
  ...
}
```

create-react-appと同様にTypeScriptのビルドがtscじゃないため、Project Referencesが効かない。

そのためsharedは事前ビルドが必要

### backend

tscを実行すればsharedもビルドされるので、事前ビルドは不要だが、sharedのディレクトリで事前にnpm installは必要。

```json
{
  ...
  "dependencies": {
    ...
    "@my-module/shared": "file:../shared"
  }
  ...
}
```

```json
// tsconfig.json
{
  ...
  "references": [{ "path": "../shared" }]
}
```

sharedの依存ライブラリは `shapred/node_modules` を参照してくれる。

```bash
$ npm start

> prestart
> rm -rf dist && npm run tsc


> tsc
> tsc --build tsconfig.json


> start
> PORT=3001 node dist/server.js

listen on { address: '::', family: 'IPv6', port: 3001 }
2023/07/03
```

## シンボリックリンクを利用する方法

npmのローカルパスしていで共通モジュールを読み込む方法について下記のリポジトリで検証を行った。

https://github.com/koh110/monorepo-test-symbolic-link

それぞれのバンドラーやトランスパイラがシンボリックリンクを解決する際の挙動がバラバラ。

モノレポを維持していくためにはそれぞれのバンドラーやトランスパイラの挙動を把握しておかないとうまく動かせなくなりそう。

### メリット

- シンボリックリンク先がTypeScriptのファイルなので事前ビルドがいらない
- ビルドターゲットが利用側のtsconfig.jsonに依存する
  - 柔軟性とも言えなくはない

### デメリット

- npm installがそれぞれのパッケージルートで必要
- 依存ライブラリをsharedだけでなくそれぞれのパッケージにも入れないと動かない（dayjs）
- ビルドターゲットが利用側のtsconfig.jsonに依存する
- symbolicリンク先のファイル更新が遅れることがある
  - これは体感で感じたもの

### frontend (create-react-app)

```bash
$ cd frontend/src
$ ln -s ../../shared/src ./shared
```

そのまま実行しようとすると `Module parse failed: Unexpected token` というエラーが発生した

```bash
Failed to compile.

Module parse failed: Unexpected token (6:35)
File was processed with these loaders:
 * ./node_modules/@pmmmwh/react-refresh-webpack-plugin/loader/index.js
 * ./node_modules/source-map-loader/dist/cjs.js
You may need an additional loader to handle the result of these loaders.
| import dayjs from 'dayjs'
|
> export const toFormatString = (date: Date): string => {
|   return dayjs(date).format('YYYY/MM/DD')
| }
ERROR in ../shared/src/date-util.ts 6:35
Module parse failed: Unexpected token (6:35)
File was processed with these loaders:
 * ./node_modules/@pmmmwh/react-refresh-webpack-plugin/loader/index.js
 * ./node_modules/source-map-loader/dist/cjs.js
You may need an additional loader to handle the result of these loaders.
| import dayjs from 'dayjs'
|
> export const toFormatString = (date: Date): string => {
|   return dayjs(date).format('YYYY/MM/DD')
| }

webpack compiled with 1 error
No issues found.
One of your dependencies, babel-preset-react-app, is importing the
"@babel/plugin-proposal-private-property-in-object" package without
declaring it in its dependencies. This is currently working because
"@babel/plugin-proposal-private-property-in-object" is already in your
node_modules folder for unrelated reasons, but it may break at any time.

babel-preset-react-app is part of the create-react-app project, which
is not maintianed anymore. It is thus unlikely that this bug will
ever be fixed. Add "@babel/plugin-proposal-private-property-in-object" to
your devDependencies to work around this error. This will make this message
go away.
```

webpackのシンボリックリンクの解決方法に依存する挙動っぽいので `resolve.symlink` をfalseにすれば解消しそうな感じ

https://webpack.js.org/configuration/resolve/#resolvesymlinks

回避策はいくつか提示されているが、ejectしたりwebpackを露出させる必要がありそう。

https://github.com/facebook/create-react-app/issues/3547

過去には `resolve.symlink` を修正しようとしているPRはあったがクローズされている。

https://github.com/facebook/create-react-app/pull/7993

できないことはないがやらないほうが無難という印象

### frontend (vite)

```bash
$ cd frontend-vite/src
$ ln -s ../../shared/src ./shared
```

viteはシンボリックリンク先の絶対パスを取得してビルドしていた。

```bash
18:01:04 [vite] Internal server error: Failed to resolve import "dayjs" from "../shared/src/date-util.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: /xxx/monorepo-test-symbolic-link/shared/src/date-util.ts:1:18
  1  |  import dayjs from "dayjs";
     |                     ^
  2  |  export const toFormatString = (date) => {
  3  |    return dayjs(date).format("YYYY/MM/DD");
```

なのでdayjsはshared/node_modules以下のものが参照される。

### backend

backend（tsc）はシンボリックリンクを通常のファイルのように解決できたが、dayjsはbackend/package.jsonに記述しないといけない。

```bash
$ cd backend/src
$ ln -s ../../shared/src ./shared
```

## npm workspaces機能を利用する方法

npm workspacesで管理する方法について下記のリポジトリで検証を行った。

https://github.com/koh110/monorepo-test-workspaces

自分はモノレポ管理ツールとしてはnpm workpsacesを利用することが多いのでこちらで検証する。ここはyarnでもpnpmなんでもよいと思う。

プロジェクトルートにあるpackage.jsonにworkspacesを記述して、それぞれのパッケージをworkspacesで管理すると宣言する。

```json
{
  ...
  "workspaces": [
    "backend",
    "frontend",
    "frontend-vite",
    "shared"
  ]

}
```

workspacesを設定しプロジェクトルートで `npm install` を行うと node_modules 以下にそれぞれのパッケージのシンボリックリンクが作成される

```bash
root
├── node_modules
│   ├── @my-module/shared -> ../../shared
│   ├── backend -> ../../backend
│   ├── frontend -> ../../frontend
│   └── frontend-vite -> ../../frontend-vite
├── package-lock.json
├── package.json
└── tsconfig.json
```

npmのローカルパス指定に似ているが、このシンボリックリンクによって各々のパッケージが解決可能になる

基本的に `file:xx` の上位互換と考えてよいと思われる。

また、プロジェクトルートで `npm start -w backend` のように実行するパッケージを指定してそれぞれのスクリプトを起動できるようになる。

諸々の検証の中でこれが一番よさそうと考えている。

### メリット

- npm install一発ですべてのパッケージの環境が揃う
- package-lock.jsonがひとつですむ
- workspacesの機能で管理できる

### デメリット

- まれにパッケージのhoisting問題が発生する
- node_modulesのモジュールパス解決とTypeScriptのimportの解決方法をうまく合わせないと使いにくい

### frontend (create-react-app)

node_modules以下の依存モジュールと同様にバンドラーが解釈してくれるため、特に追記は必要なく、次のような記述ができる。

```js
import './App.css';
import { toFormatString } from '@my-module/shared/src/date-util.js'

function App() {
  return (
```

TypeScriptのビルドがtscじゃないため、Project Referencesが効かない。

そのためsharedは事前ビルドが必要

```bash
$ npm run build -w shared
```

### frontend (vite)

同上

### backend

npmのローカルパス指定する方法と比較するとpackage.jsonのdependenciesに `file:xx` がいらなくなる。

先の検証と同様にProject Referencesにsharedを指定することで事前ビルドがいらなくなる。

```json
// tsconfig.json
{
  ...
  "references": [{ "path": "../shared" }]
}
```

sharedの依存ライブラリは `shapred/node_modules` を参照してくれる。

```bash
$ npm start -w backend

> prestart
> rm -rf dist && npm run tsc


> tsc
> tsc --build tsconfig.json


> start
> PORT=3001 node dist/server.js

listen on { address: '::', family: 'IPv6', port: 3001 }
2023/07/03
```

## おまけ: Node.js + TypeScriptでモノレポ管理する際のTips

importする側は `{{package-name}}/src/{{file-name}}` を読み込む。

```js
// backend/server.ts
import http from 'http'
import express from 'express'
import { toFormatString } from '@my-module/shared/src/date-util.js'

const PORT = process.env.PORT
```

こう指定することで `backend/server.ts` では `shared/src/date-util.ts` がimportのDefinitionに紐付けられる。つまりVSCodeなどで `Go to Definition` した際に実際にいじるべきファイルにジャンプできるようになる。

次に、読み込まれる側のパッケージではexportsでビルド結果のdist以下に吐き出される実態ファイルを指定する。

```json
{
  "private": true,
  "name": "@my-module/shared",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./src/date-util.js": "./dist/src/date-util.js"
  },
  ...
}
```

こうすることで `@my-module/shared/src/date-util.js` がimportされた場合にNode.jsが実際に解決する実態を `shared/dist/src/date-util.js` にすげ替えることができる。

backendなどのimportでdistの方を指定してしまうと、`Go to Definition` した際にビルドされたファイルが出てきてしまうので、sharedのファイルを更新したいときに一手間必要になる。

このように組み合わせると開発効率もよいのではないかと考えている。
