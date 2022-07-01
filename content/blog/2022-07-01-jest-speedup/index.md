---
title: jestでDBありのテストを高速化する
date: '2022-07-01T00:00:00.000Z'
---

# 課題

お手伝いしているシステムでNestJSを採用しているバックエンドのテストが遅いという課題があったので対処した。

# 前提

| フレームワーク | DB | テストランナー | その他 |
|---|---|---|---|
| NestJS | postgres | jest | TypeScript, ts-jest |

テストの総数は700弱。

# 最終結果

最終的には2段階の改修を経てローカルのテストが3倍速程度高速化した。

```bash
# before
Test Suites: 145 passed, 145 total
Tests:       2 skipped, 681 passed, 683 total
Snapshots:   0 total
Time:        925.063 s
Ran all test suites.
Done in 926.48s.

# ts-jestを@swc/jestに置き換えた
Test Suites: 145 passed, 145 total
Tests:       2 skipped, 681 passed, 683 total
Snapshots:   0 total
Time:        613.74 s
Ran all test suites.
Done in 615.33s.

# 4並列にした
Test Suites: 145 passed, 145 total
Tests:       2 skipped, 681 passed, 683 total
Snapshots:   0 total
Time:        293.974 s
Ran all test suites.
Done in 310.08s.
```

ただ、トランスパイラの置き換え（ts-jest -> @swc/jest）とworker数の増加だけではCI上の実行時間は変わらなかった。
そのため、ローカルとCIでは別の並列化を行い、最終的にはCIの実行速度も3倍速程度まで高速化した。

# 戦略

TypeScriptで記述されたテストであったため、コストの低い対策として高速なトランスパイラーへの置き換えを検証した。
また、コストは高いが確実な方法としてDBのテストを直列から並列に変更する方法を検証した。

- トランスパイラーの置き換え
  - @swc/jestへ置き換え（採用）
  - vitestへ置き換え（失敗）
- テストの並列化
  - `--runInBand` の削除
  - `--maxWorkers=4` の追加
  - 並列数分のDBを用意
  - テスト時にworkerのインデックスを取得してDBをつなぎ分ける
- CIの並列化
  - `--shard` オプションの利用（採用）
  - CIのテストステップを4分割
  - `--maxWorkers=4` で動かす（失敗）

## トランスパイラーの置き換え

トランスパイラーをts-jestから@swc/jestへ置き換えた。

やること自体はそんな難しくなくドキュメントに記載されている通りにコンフィグを書き換える。

https://swc.rs/docs/usage/jest

```diff
// jest.config.js
transform: {
-  "^.+\\.(t|j)sx?$": "ts-jest",
+  "^.+\\.(t|j)sx?$": ["@swc/jest"],
},
```

次にswcの設定ファイルを配置する。

NestJS特有で気をつけなければいけない点として、デコレータ周りの設定（legacyDecorator, decoratorMetadata）をきちんとかかないと動かない。
pathsはtsconfigに設定されているものをそのままコピペして配置。

```
// .swcrc
{
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "decorators": true
    },
    "target": "es2020",
    "keepClassNames": true,
    "transform": {
      "legacyDecorator": true,
      "decoratorMetadata": true
    },
    "baseUrl": ".",
    "paths": {
      "@common/*": ["./src/common/*"],
      "@test/*": ["./src/test/*"],
    }
  },
  "sourceMaps": true
}
```

また、追加で今回はTypeORM特有のつまづきポイントがあった。

https://github.com/swc-project/swc/issues/1160

tscでトランスパイルすると `@Column()` と書いていても自動的に型を推論してくれるが、swcがトランスパイルの仕方が違うため、TypeORMが解釈できない形に変換されてしまっていた。

これは `@Column({ type: "varchar" })` のように詳細に型を指定してあげると回避できた。

### vitestへの置き換え

swcより先にvitestを試した。jestと互換性があるということで気軽に試してみたが、案外書き換えも必要+NestJSではうまく動作しない部分があり断念した。

断念理由1: esbuildがサポートしてないデコレータがある

vitestが内部で採用しているesbuildがいくつかデコレータの書き方に対応していなかった。

https://github.com/vitest-dev/vitest/issues/708
https://github.com/evanw/esbuild/issues/257#issuecomment-658053616

ここはプロダクトコードの方のデコレータの書き方を直すことでデコレータ部分まではクリアできたが、次にあげるモジュール解決の問題が発生した。

断念理由2: ECMA Firstで解釈してしまう。

vitestはテスト実行時にモジュールをECMA Modulesとして解釈してしまう。

https://github.com/vitest-dev/vitest/issues/846

これも.mtsやpackage.jsonの指定でECMA Modules扱いにしてしまうというのも試したが、本番の動作に影響が出てしまう可能性を考えると、テストのためだけにやるのは少しコスト高いと判断した。

また、ECMA Modulesとして読み込もうとするとnode_modules以下のCommonJSモジュールと不整合が出る部分の対処も必要で、クリアできそうではあるが今回は少々コスト過多になりそうという印象を受けたので撤退した。

## テストの並列化

DBつきのテストなので、もともと `--runInBand` オプションで直列に実行されていた。なのでまずはこのオプションを外す戦略をたてた。

DBのテストを並列に実行する手法は、まず愚直に並列数分のDBを用意して、テストのDB接続時にそれぞれ競合しないDBに接続させる方法にした。

jestはデフォルトだと (コア数 - 1) 個のworkerを生成する。ただ、自分の環境は16コアだったので out of memory が発生してしまった。
最近の開発者の環境だとコア8個以上は当たり前になりつつあるし、 `--maxWorkers=4` を追加してworkerを4つまでに制限した。

今回はDBをdocker-comopseで立ち上げていたので、一つのDBインスタンスにDB名を分けるという形でworkerの接続席を分けることにした。

テストDBの事前準備をどうしようかなという部分がまだちゃんと煮詰まっていないが、pretest時にmigrationを流すスクリプトを作成した。

```json
"pretest": "WORKER_NUM=4 NODE_ENV=test yarn ts-node ./src/test/bin/setup-db.ts",
"test": "NODE_ENV=test jest --maxWorkers=4",
```

```javascript
import { promisify } from "util";
import { execFile, exec } from "child_process";

import { createConnection, getConnectionOptions } from "typeorm";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const WORKER_NUM = process.env.WORKER_NUM ? Number(process.env.WORKER_NUM) : 2;
const TYPEORM_HOST = process.env.TYPEORM_HOST ?? "dbname";
const TYPEORM_USERNAME = process.env.TYPEORM_USERNAME ?? "postgres";
const TYPEORM_DATABASE = process.env.TYPEORM_DATABASE ?? "postgres";
const PGPASSWORD = process.env.TYPEORM_PASSWORD ?? "password";

async function runMigrate(databaseName: string) {
  console.log(`[migrate:start] ${databaseName}`);
  const env = { ...process.env, PGPASSWORD };
  const timeout = 60 * 1000;
  // dbの存在チェック
  const { stdout } = await execAsync(
    `psql -U ${TYPEORM_USERNAME} -h ${TYPEORM_HOST} ${TYPEORM_DATABASE} -c "SELECT datname FROM pg_database WHERE datname = '${databaseName}'"`,
    { timeout, env },
  );
  console.log(`[exists] ${databaseName}:`, stdout);
  // dbが存在していたらdrop
  if (stdout.includes(databaseName)) {
    await execFileAsync(
      "dropdb",
      ["-h", TYPEORM_HOST, "-U", TYPEORM_USERNAME, databaseName],
      { timeout, env },
    );
    console.log(`[dropdb] ${databaseName}`);
  }
  // createdb
  await execFileAsync(
    "createdb",
    ["-h", TYPEORM_HOST, "-U", TYPEORM_USERNAME, databaseName],
    { timeout, env },
  );
  console.log(`[createdb] ${databaseName}`);

  // TypeORMのmigrate
  const options = await getConnectionOptions({ databaseName });
  const connection = await createConnection(options);

  try {
    console.log(`[runMigrations:start] ${databaseName}`);
    await connection.runMigrations({ transaction: "all" });
    console.log(`[runMigrations:end] ${databaseName}`);
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    if (connection) await connection.close();
  }
  console.log(`[migrate:end] ${databaseName}`);
}

// jestのworkerは1始まりなので1始まりのsuffixをつけたDB名をつける
function getDatabaseNames(workerNumber: number) {
  const names = Array(workerNumber)
    .fill("test_db")
    .map((prefix, i) => {
      return `${prefix}_${i + 1}`;
    });

  return names;
}

async function runAllMigrate() {
  const names = getDatabaseNames(WORKER_NUM);
  const promises = names.map(name => {
    return runMigrate(name);
  });
  await Promise.all(promises);
}

(async function () {
  try {
    await runAllMigrate();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
```

テストの方ではこのセットアップスクリプトで作ったDBに接続するようにbeforeEachを書き換える。
jestはJEST_WORKER_IDという環境変数にworkerの番号が入っているため、これを使って振り分けることにした。

```javascript
export function getDatabaseName(index) {
  const databaseName = `test_db_${index}`;
  return databaseName;
}

---

beforeEach(async () => {
  const index = process.env.JEST_WORKER_ID;
  const databaseName = getDatabaseName(index);
  await setupDatabase({ databaseName });
});
```

`--maxWorkers=4` にするとJEST_WORKER_IDには1~4までの数字が入るので `test_db_1` ~ `test_db_4` までのDBをかぶらずに使用できる。

この修正でローカルでのテスト実行速度が3倍速くらいになった。理論上workerの数を増やせばいくらでも高速化できるが、現実的にはDBのリソースもじゃぶじゃぶ使うし、メモリの使用量がボトルネックになりそう。

また、ローカルのテストは高速化したがCIではむしろ実行時間が悪化した。

これは公式ドキュメントにものっているが、CIやコンテナなど特定の環境で遅くなるケースがあるらしい。

[参照](https://jestjs.io/docs/28.0/troubleshooting#tests-are-extremely-slow-on-docker-andor-continuous-integration-ci-server)

これの解決策に `--runInBand` を利用してくれとあったが、それではこの施策の意味がないため、CIでは別の方法を使って分割することにした。

## CIの並列化

workerを増やした並列化はCIでは出来ないという事がわかったので、jest v28から加わった `--shard` オプションを利用した。

https://jestjs.io/docs/28.0/cli#--shard

shardはテストの実行を単純に分割できるオプションです。`--shard=1/4`とすると最初の1/4だけ実行します。
つまり `--shard=1/4`, `--shard=2/4`, `--shard=3/4`, `--shard=4/4` とした CI を4つ実行すれば並列に実行できるということになる。

Github Actionsではmatrixを使うと同じstepを別の引数で実行できる。

これを使って次のようにshardオプションを呼び分けるようにすると、全てのテストが実行可能かつ並列に実行可能となる。

```
test-backend:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      shard: [1, 2, 3, 4]
  services:
    postgres:
      image: postgres
      ports:
        - 5432:5432
  steps:
~~~
    - name: Test Backend
      run: NODE_ENV=test jest --maxWorkers=1 --shard=${{ matrix.shard }}/${{ strategy.job-total }}
```

他のプロダクトでjestを使ってるときにも、maxWorkersで引っかかったことがあるのでCIではmaxWorkersは1にするのがベストプラクティスといえそう。

servicesでmartixごとに1つのDBを用意する形式になるので、全てのテストは `test_db_1` につなぐのがローカルの実行との違いになる。
この分け方はローカルと違ってリソースの上限がかかりにくくスケールが容易そうなので4つ以上の分割もできそうなのがいいところ。

ひとまず4分割にして実行したらCIでも3倍くらい速くなった。

ローカルも同じ実行の仕方にしても良かったが、shardで分割すると結果も分割されて表示されてしまうので結果が見にくくなった。
なので、ローカルではmaxWorkers、CIはshardというのがよいのではないかと考えている。

# おまけ

ts-nodeを使ってる箇所もswcを利用するモードにしたらスクリプトの実行時間も3倍くらい速くなった。

https://typestrong.org/ts-node/docs/swc/

ここはesbuild/registerでもよいとは思うが、swcとesbuildの2つのトランスパイラーを入れるのが嫌だったので、今回はts-node + swcを採用した。

# おわりに

NestJS + jestのDBつきテスト高速化を@swc/jestと並列化で達成した。

当たり前だけど、なんだかんだ並列化の設計をすることが一番効果高い。

トランスパイラーまわりの高速化も無視できない程度には効果があるが、やはり互換性がない部分がまだあるため、最後のチェックはtscを信じろにしたほうがリスクが少なそう。
自分はプロダクションビルドではtsc、テストや開発のみトランスパイラーを交換して高速化というスタイルをしばらく続けると思う。

esbuildはデコレータ処理が出てくると現時点では厳しいかもしれないので、viteよりswcが優勢か？という感想だったが、コミュニティの勢い的にはviteの方が盛り上がっているように感じるため、この辺は注視していく必要がありそう。
