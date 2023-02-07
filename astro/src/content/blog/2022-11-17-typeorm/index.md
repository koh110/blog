---
title: TypeORM v0.3へのバージョンアップ方法
date: '2022-11-17'
tags: ['nodejs', 'typeorm']
---

# TypeORMのアップデート

NestJSで利用しているTypeORMのバージョンをv0.2からv0.3に引き上げた。
v0.3ではかなりの破壊的変更が入っていたため、結構大変な作業だったのでやり方と方針を備忘録にまとめる。

[TypeORMリリースノート](https://github.com/typeorm/typeorm/blob/master/CHANGELOG.md#030-2022-03-17)

個人的におおきな破壊的変更は次の3つ

1. データベースのつなぎ方がConnectionからDataSourceという仕組みに変更
2. CustomRepositoryの定義方法がclassからobjectに変更
3. findのwhereが `{ id: undefined }` の時の返却値が、空配列から全件取得に変更

## ConnectionからDataSourceに変更

データベースへの接続がDataSourceオブジェクトを生成する形に変更された。
また`ormconfig.js`ファイルから自動で読み込む仕組みがなくなったため、configファイルを直接importで指定する必要がある。

```javascript
import ormconfig from './ormconfig';

const dataSource = new DataSource(ormconfig);

await dataSource.connect();
```

configファイルを直接指定する形式になったので、JavaScript(`ormconfig.js`)からTypeScript(`ormconfig.ts`)に置き換えた。

NestJSのTypeORMモジュールではDataSourceオブジェクトの生成からconnectまでを内部でやってくれている。

```javascript
// app.module.ts
import ormconfig from './ormconfig';

@Module({
  imports: [
    TypeOrmModule.forRoot(config), // ここで直接ormconfigを指定する形に
    ...
  ],
})
```

## CustomRepositoryの定義方法がobjectに変更

元々のCustomRepositoryの定義方法はclassに対してEntityRepositoryデコレータでEntityを紐づける形。

```javascript
import { EntityRepository, Repository } from 'typeorm';
import { BarEntity } from './bar.entity';

@EntityRepository(BarEntity)
export class BarRepository extends Repository<BarEntity> {
  async fineBarWithQuery(query) {
    ...
  }
}
```

これがdataSourceオブジェクトから生成する形に変更になった。

`dataSource.getRepository(Entity).extends({ ... })`

この書き換えで課題になるのは「dataSoureオブジェクトをどうやってCustomRepositoryファイルに渡すか」という点。

repositoryファイルの中で`new DataSource()`するのはコネクションを多重接続してしまうのでなし。

次に考えられるのは別ファイルで`export const dataSource = new DataSource()`したものをimportする方法。
しかしこれをやるとNestJS側で生成しているコネクションと2重になってしまった時にトランザクションがどのように動くか分からなかった。

そのため、NestJSが生成したdataSourceをCustomRepositoryに渡す必要がある。
なのでFactoryを作成して、NestJSにはproviderで直接指定する形を採用することにした。

先ほどのサンプルを書き換えると次のような形になる

```javascript
import { DataSource } from 'typeorm';
import { getDataSourceToken, getCustomRepositoryToken } from '@nestjs/typeorm';
import { FactoryProvider } from '@nestjs/common';
import { BarEntity } from './bar.entity';

// classの代わりの型定義
export type BarRepositoryType = ReturnType<typeof BarRepositoryFactory>;

// dataSourceを受け取るためのfactory
export const BarRepositoryFactory = (dataSource: DataSource) => {
  return dataSource.getRepository(BarEntity).extend({
    async fineBarWithQuery(query) {
      ...
    }
  });
};

// NestJSに注入するためProvider
export const BarRepositoryProvider: FactoryProvider<BarRepositoryType> = {
  provide: getCustomRepositoryToken(BarRepositoryFactory),
  useFactory: BarRepositoryFactory,
  inject: [getDataSourceToken()],
};
```

NestJSがわは元々`TypeOrmModule.forFeature([...])`の引数にCustomRepositoryのクラスを指定することで自動的にDIなどができた。

```javascript
import { TypeOrmModule } from '@nestjs/typeorm';
import { BarRepository } from './bar.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([BarRepository]),
  ],
  providers: [FooService]
})
export class FooModule {}
```

今回のアップデートでforFeatureへの指定ができなくなってしまったため、providersで直接指定する形に変更する。

```javascript
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { BarRepositoryProvider } from './bar.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([])
  ],
  providers: [
    FooService,
    BarRepositoryProvider
  ]
})
export class FooModule {}
```

Providerに直接指定するためには、どのインスタンスが同一のものかを判定するためにprovideに一意な文字列が必要になる。
TypeORMモジュールのコードを読んでみると、classの頃は`class.name`を内部的に参照していた。

同様にFactoryのnameを一意な値として利用すればよいかと考えたが、コードを読んでいたらたまたまTypeORM側に`getCustomRepositoryToken`というutilメソッドが用意されているのを発見したのでそちらを利用する形にした。

[getCustomRepositoryToken](https://github.com/nestjs/typeorm/blob/9432329a7c5da4e5866af3b8ed2ef712c909e931/lib/common/typeorm.utils.ts#L61-L66)

動作だけなら`Factory.name`や一意な文字列を与えればよいが、今後自分以外がいじる際にルールを守れるかという点が気になったため、意図を明示できる関数を利用する方向にした。

NestJSの内部で生成されたDataSourceをFactoryの引数に与えるためには`getDataSourceToken`を利用する。

[getDataSourceToken](https://github.com/nestjs/typeorm/blob/9432329a7c5da4e5866af3b8ed2ef712c909e931/lib/common/typeorm.utils.ts#L74-L87)

`getDataSourceToken`をinjectに与える事で、NestJSのセットアップ時に`BarRepositoryFactory`に内部で生成されたdataSourceの参照が注入される。

```javascript
// NestJSに注入するためProvider
export const BarRepositoryProvider: FactoryProvider<BarRepositoryType> = {
  provide: getCustomRepositoryToken(BarRepositoryFactory),
  useFactory: BarRepositoryFactory,
  inject: [getDataSourceToken()],
};
```

最後にCustomRepositoryを使ってたServiceの改修をする。

元々はimportしたclassをそのままコンストラクタに指定してするとNestJSが判断してDIしてくれていた。

```javascript
import { Injectable } from '@nestjs/common';
import { BarRepository } from './bar.repository';

export class FooService {
  constructor(
    private repository: BarRepository
  ) {}
}
```

これを明示的にDI指定するためにInjectアノテーションに直接`getCustomRepositoryToken`とFactoryから生成した文字列を与える。
これでprovidersの中で指定したprovideと文字列が一致するのでDIされるようになる。

```javascript
import { Injectable, Inject } from '@nestjs/common';
import { getCustomRepositoryToken } from '@nestjs/typeorm';

import {
  BarRepositoryFactory,
  BarRepositoryType
} from './bar.repository';

export class FooService {
  constructor(
    @Inject(BarRepositoryInjectName)
    private repository: BarRepositoryType // classじゃなくなったのでFactoryのReturnTypeで返ってきたオブジェクトを型にする
  ) {}
}
```

```javascript
const repo = getManager().getCustomRepository(BarRepository);
---
const repo = dataSource.manager.withRepository(BarRepository);
```

## findのwhere条件を変更

動的にfind条件を変更するメソッドで `{ id: undefined }` になるパターンがあった。

この時、v0.2では空配列（=該当なし）として扱われていたが、v0.3ではデータ全件（=条件の指定なし）にさらっと変更されていた。（ドキュメントに記載見当たらず）

まるきり逆の挙動になってる上に、全件取得という結構な負荷が出そうな変更がさらっとされていてかなり驚いた。

テスト書いてあって助かった。

# 感想

個人的にCustomRepositoryが一番大きな破壊的変更だった。

変更後の方がclassもアノテーションを用いずに個人的にはきれいで好み。
だが、なぜこのタイミングでこれだけ設計全体に影響を与える大きな破壊的変更を加えたのかは疑問を持った。

[issue](https://github.com/typeorm/typeorm/issues/9013)でも同様の意見があがっていたが、なぜという疑問に回答はなかった。

v0のアプリケーションなので破壊的変更が加わるのは仕方ないとは思うが、もう少しmigrationのコストが低くないと脱落する人が出てきそうという感想をもった。

NestJSではTypeORMが標準的な扱いを受けているところもあるので、今後もカジュアルに破壊的変更がされるとなると少し採用に慎重な姿勢を持ってしまいそうである。
