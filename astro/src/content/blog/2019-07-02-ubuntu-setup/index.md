---
layout: '../../../layouts/MarkdownLayout.astro'
title: さくらで借りたUbuntu16のセットアップ
date: '2019-07-02'
tags: ['linux', 'ubuntu']
---

## さくら

パケットフィルタに最初は ssh しか設定されていないので http (80,443) を追加する。

これを追加しないといくら ufw や iptables を設定してもインターネット越しの通信が通らない。

```bash
$ sudo apt update
```

`/etc/ssh/sshd_config` で鍵認証の追加とパスワード認証の disable を行う

```diff
- #PubkeyAuthentication yes
+ PubkeyAuthentication yes

- PasswordAuthentication yes
+ #PasswordAuthentication yes

- PermitRootLogin prohibit-password
+ PermitRootLogin no
```

## Node.js のインストール

```bash
$ wget http://nodejs.org/dist/v12.5.0/node-v12.5.0-linux-x64.tar.gz
$ tar -C /usr/local --strip-components 1 -xaf node-v12.5.0-linux-x64.tar.gz
$ sudo tar -C /usr/local --strip-components 1 -xaf node-v12.5.0-linux-x64.tar.gz
$ sudo chown -R root:root /usr/local/bin/
```

## nginx のインストール

apt 用の GPG key を取得する

```bash
$ wget https://nginx.org/keys/nginx_signing.key
$ sudo apt-key add nginx_signing.key
```

`/etc/apt/sources.list` を編集して以下の 2 行を追加

```
deb http://nginx.org/packages/ubuntu/ bionic nginx
deb-src http://nginx.org/packages/ubuntu/ bionic nginx
```

更新を反映して nginx をインストール

そのままインストールしようとすると 1.16 をインストールしようとするが、依存パッケージが Ubuntu16 だと追いついていないのでバージョンを指定してインストール

```bash
$ sudo apt update
$ sudo apt install nginx=1.10.*
$ sudo systemctl status nginx
```

## MongoDB のインストール

公式にチュートリアルがある

https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/

上記ドキュメントが常に正しいと思うが記録のためにコマンドを下記に記す。

```bash
$ sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
$ echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list
$ sudo apt-get update
$ sudo apt-get install -y mongodb-org

# DB は apt-get の upgrade で勝手にバージョンアップされると怖いのでバージョンを固定しておく
$ echo "mongodb-org hold" | sudo dpkg --set-selections
$ echo "mongodb-org-server hold" | sudo dpkg --set-selections
$ echo "mongodb-org-shell hold" | sudo dpkg --set-selections
$ echo "mongodb-org-mongos hold" | sudo dpkg --set-selections
$ echo "mongodb-org-tools hold" | sudo dpkg --set-selections

$ sudo service mongod start
```

## Redis のインストール

https://redis.io/download#installation

make がなかったのでインストール

```bash
$ sudo apt-get install make
```

何故か make が失敗する

```bash
$ cd redis-5.0.5
$ sudo make

cd src && make all
make[1]: Entering directory '/tmp/redis-5.0.5/src'
    CC adlist.o
/bin/sh: 1: cc: not found
Makefile:248: recipe for target 'adlist.o' failed
make[1]: *** [adlist.o] Error 127
make[1]: Leaving directory '/tmp/redis-5.0.5/src'
Makefile:6: recipe for target 'all' failed
make: *** [all] Error 2
```

そりゃビルドに足りないパッケージあるよな、ということで build-essential をインストール

```bash
$ sudo apt-get build-essential
```

まだ make に失敗するので、次の issue に従って distclean をしたら動くようになった
https://github.com/antirez/redis/issues/722

```bash
$ make distclean
# 動いた
$ src/redis-server

# 動いたのでインストール
$ sudo make install

$ sudo mkdir -p /var/lib/redis
$ sudo mkdir -p /var/log/redis
$ sudo mkdir -p /etc/redis
$ sudo cp redis.conf /etc/redis
```

redis の config を公式サイトを参考に設定する

https://redis.io/topics/config

```
- dir ./
+ dir /var/lib/redis

- logfile ""
+ logfile /var/log/redis/redis.log

- supervised no
+ supervised systemd
```

systemd の設定

```bash
$ sudo vim /etc/systemd/system/redis.service
```

```
[Unit]
Description=Redis

[Service]
Type=notify
ExecStart=/usr/local/bin/redis-server /etc/redis/redis.conf
ExecStop=/usr/local/bin/redis-cli -p 6379 shutdown
User=root
Group=root

[Install]
WantedBy=multi-user.target
```

systemd 設定の反映と start

```bash
$ sudo systemctl daemon-reload
$ sudo systemctl start redis
```
