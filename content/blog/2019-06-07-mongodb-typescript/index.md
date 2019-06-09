---
title: MongoDB + Node.js + TypeScriptが強力だった
date: '2019-06-07T17:00:00.000Z'
---

## はじめに

MongoDB (node-mongodb-native) + Ndoe.js + TypeScript で RDB 並のスキーマ定義と、NoSQL の開発しやすさを両立できたのでまとめます。

## Node.js と MongoDB

MongoDB はドキュメント指向データベースです。簡単に言えば JSON のような形でデータを保持できる NoSQL です。

MySQL や Postgres などの RDB と違い、事前に CREATE TABLE のようなコマンドを打たなくても、insert されたタイミングで collection が作成され、データが保存されます。

また、MongoDB は後発のデータベースということもあり、RDB では 1 クエリで素直に表すことが難しいクエリも多くがクエリ化されていて 1 トランザクションで実行が可能です。（findOrUpdate など）

この柔軟性は非常に強力で、開発開始までのオーバーヘッドを大きく下げてくれます。

しかし、その柔軟さ故に後から加わった開発者がコードからデータの構造を読み取るのが難しいという難点もあります。

Node.js + MongoDB では <a href="https://mongoosejs.com/" target="_blank">mongoose</a> か <a href="http://mongodb.github.io/node-mongodb-native/">node-mongodb-native</a> が多く利用されます。

今までは上記のデータ構造の問題に対処するため、mongoose を利用してオブジェクトのスキーマ定義などを行ったりしていました。しかし、mongoose は ORM という特性上内部的に Object へのマッピングなど、パフォーマンスに影響を与えてしまうことが少なくありませんでした。そのためパフォーマンスが要求されるような箇所では mongoose から Object への変換が行われないようにするなど工夫されることが多いですが、そうしてしまうことでまたスキーマ定義がなく自由に使えてしまうというトレードオフが発生していました。

パフォーマンスの問題にぶつかることも多く、自分は mongoose はあまり使わなくなり node-mongo-native をメインに使っていました。

ある時、Node.js も TypeScript で全部書いてみようと試してみたところ、node-mongo-native を利用していてもスキーマ定義を TypeScript に任せることができ、データ構造がわかりにくいという問題が解決できてしまいました。

## TypeScript を組み合わせた MongoDB

下記が MongoDB アクセス用モジュール `db.ts` です。１つの School に対して Student が複数所属する設計とします。

```typescript
import { MongoClient, Collection, ObjectId } from 'mongodb'

const MONGODB_URI = 'mongodb://[user:password]@localhost:27017/example'

export type School = {
  _id?: ObjectId
  name: string
}

export type Student = {
  _id?: ObjectId
  schoolId: ObjectId
  name: string
}

export collections: {
  school: Collection<School>
  student: Collection<Student>
} = {
  school: null,
  student: null
}

export async function connect() {
  const client = await MongoClient.connect(MONGODB_URI, {
    useNewUrlParser: true
  })

  const db = client.db('example')
  collections.schools = db.collection<School>('schools')
  collections.students = db.collection<Student>('students')
}
```

ちなみにサーバー側はこんな感じで DB に接続が完了したら listen を開始するようにします。

```typescript
import http from 'http'
import express from 'express'
import * as db from './db'

const app = express()
const server = http.createServer(app)

db.connect().then(() => {
  server.listen(8000, () => {
    console.log('Listening on', server.address())
  })
})
```

ここで Student にひとつレコードを追加するコードを見てみましょう。

`db.collections.student` は db モジュールの中で型定義がされているので `Student` 型以外のオブジェクトを insertOne に与えようとすると TypeScript がエラーを返します。

```typescript
import { ObjectId } from 'mongodb'
import * db from './db'

export async function addStudent(schoolId: ObjectId, name: string) {
  const student = {
    schoolId: schoolId,
    name: name
  }

  const res = await db.collections.students.insertOne(student)

  return res
}
```

addStudent は引数以外で型定義も行っておらず JavaScript と変わらない書き味であるにもかかわらず、insert するべきオブジェクトが型安全になるというメリットが得られます。もちろんこれらの型は find や update などにも適用されます。

さらにこの組み合わせが強力なのは、交差型を利用することで MongoDB の aggregate（RDB でいう join）も型を使って効率よく開発できることです。

下記のコードは students コレクションから school というパラメータに school コレクションのデータを id をもとに join するサンプルです。

`.aggregate<db.Student & { school: db.School }>` がキモのコードで、交差型を使うことで Student 型に School 型の schrool パラメータを追加しています。こうすることで、aggregate の return が any にならず型の補助を受けられます。（lookup に合わせて自分で交差型を適切に書かないといけない部分は若干イケてないと思うがうまい方法を思いついていない。）

本来は toArray せずに cursor にして map を使わない方がきっとパフォーマンスはいいです。

```typescript
import { ObjectId } from 'mongodb'
import * db from './db'

export async function getStudent(studentId: ObjectId) {
  const students = await db.collections.students
    .aggregate<db.Student & { school: db.School }>([
      {
        $match: { _id: studentId }
      },
      {
        $lookup: {
          from: 'schools',
          localField: 'schoolId',
          foreignField: '_id',
          as: 'school'
        }
      }
    ]).toArray()

  return students
    .map((student) => {
      return {
        _id: student._id,
        name: student.name,
        // schoolId: student.schoolId,
        school: {
          _id: student.school._id,
          name: student.school.name
        }
      }
    })
}
```

## まとめ

MongoDB (node-mongodb-native) + Ndoe.js + TypeScript の組み合わせを用いることで RDB 並のスキーマ定義と、NoSQL の開発しやすさを両立できました。
