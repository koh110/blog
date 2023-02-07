---
title: WireGuardでVPNごしに自宅サーバ開発できる環境を作った
date: '2020-01-01T00:00:00.000Z'
---

# まえおき

自分は普段 MacBook Pro の 13 インチを開発機として利用しています。メモリは 16GB にしているので Web 開発をする時にはあまり不便に感じることはありません。
ただ、サービスの開発のステージ環境や、自宅内の自動化や副業で受けている調査案件などはそれぞれ環境ごとに仮想サーバを立ち上げています。

仮想サーバは nuc に入れた Windows 上の Hyper-V で運用しています。nuc は 24 時間立ち上げたままでテレビにつないで Amazon プライムの再生機も兼ねています。
メモリも 32GB 積んであるので開発サーバが立ち上がってても通常使用するぶんには割と余裕があります。

この自宅環境は割と便利で、自宅で開発しているときは十分活躍してくれるのですが、外出中にも開発サーバに ssh で入りたくなることがちょくちょくあります。（あーあのサーバにコード書き捨てたままだったとか、自動化コードが死んだ通知が外出中にきたりとか）

この問題を解消するために自宅に VPN を導入しようと以前から考えていたのですが、ソフトウェアの利用方法も自分にとっては難しく実現していませんでした。
そんな折たまたま [WireGuard](https://www.wireguard.com/) という文字列を目にして、調べてみたらシンプルで高速な VPN だということがわかりました。

参考: https://speakerdeck.com/fadis/zuo-tuteli-jie-suruwireguard?slide=2

さらに調べていくと、かなり設定もシンプルで自分でも理解できそうだったので、家に転がっていた Raspberry Pi を再利用して環境を構築してみることにしました。

Hyper-V にたてないで Raspberry Pi で構築した理由は、Windows が落ちたときに VPN が落ちてしまうと外から何もできなくなってしまうので、物理的に分割したかったからです。

# WireGuard のインストール

Raspberry Pi の OS は情報が多そうだったので無難に Raspbian を選択しました。

各種 OS のインストール方法は公式サイトに詳しくのっているのですが、Raspbian は Debian 系にまとめられているようでした。

https://www.wireguard.com/install/

他に参考にできるドキュメントを探していたら下記のリポジトリに永続化も含めて詳細に載っていたので、こちらを参考に環境を構築しました。

https://github.com/adrianmihalko/raspberrypiwireguard

やっていることは ubuntu のレポを追加してインストールできるようにしているっぽいです。

```bash
$ sudo apt-get update
$ sudo apt-get upgrade
$ sudo apt-get install raspberrypi-kernel-headers
$ echo "deb http://deb.debian.org/debian/ unstable main" | sudo tee --append /etc/apt/sources.list.d/unstable.list
$ sudo apt-get install dirmngr
$ printf 'Package: *\nPin: release a=unstable\nPin-Priority: 150\n' | sudo tee --append /etc/apt/preferences.d/limit-unstable
$ sudo apt-key adv --keyserver   keyserver.ubuntu.com --recv-keys 8B48AD6246925553
$ sudo apt-key adv --keyserver   keyserver.ubuntu.com --recv-keys 04EE7237B7D453EC
$ sudo apt-key adv --keyserver   keyserver.ubuntu.com --recv-keys 7638D0442B90D010
$ sudo apt-get update
$ sudo apt-get install wireguard
```

/etc/sysctl.conf を vi でいじる。net.ipv4.ip_forward の項目を 1 にする。

```bash
# Uncomment the next line to enable packet forwarding for IPv4
net.ipv4.ip_forward=1
```

# WireGuard の設定

まずは VPN を使って外部ネットワークから Raspberry Pi に ssh できるようにします。それができたら Raspberry Pi を踏み台に他のサーバにも ssh できるようにします。

WireGuard の設定にサーバとクライアントという概念は出ず Peer to Peer のような仕組みになっています。VPN を接続する Peer 同士で秘密鍵と公開鍵の生成が必要になります。

便宜上ここから先では Raspberry Pi 上の WireGuard をサーバ、Mac に入れる WireGuard アプリをクライアントと考えて説明します。

WireGuard がインストールできたら、wg というコマンドが利用できるようになるので、サーバ用の秘密鍵と公開鍵を生成します。

```bash
$ mkdir wgkeys
$ cd wgkeys
# 秘密鍵の生成
$ wg genkey > server_private.key
# 秘密鍵から公開鍵を生成
$ wg pubkey > server_public.key < server_private.key
```

Mac 用のアプリは公式のストアにあるので、ここからダウンロードします。

https://apps.apple.com/jp/app/wireguard/id1451685025

アプリを起動したら左下の+ボタンから `Add Empty Tunnel` を選択すると秘密鍵と公開鍵が生成されるので、名前をつけて一旦 save します。

![Mac設定](./mac.jpeg)

ここで生成された公開鍵をサーバの方の設定ファイルに書くことになります。

![Mac鍵](./mac_key.jpeg)

サーバの設定ファイルは /etc/wireguard/wg0.conf に配置します。

Interface に自分自身の設定（ここでは Raspberry Pi）、Peer に接続させる端末の設定（ここでは Mac）を書きます。

```bash
[Interface]
# VPN の仮想的なネットワークで使うIPアドレスを設定する。今回はわかりやすいように10.0.0.1/24で設定した。
Address = 10.0.0.1/24
# WireGuard を listen させるポート。ルータのポート開放に使うので適当に変える。
ListenPort = 123456

# wgコマンドで生成した秘密鍵を文字列で記入する
PrivateKey = <server_private.key>
# replace eth0 with the interface open to the internet (e.g might be wlan0 if wifi)
# 起動時と終了時に動くコマンドがかける。ひとまずnatするための呪文だと思っておく。
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
# Macで生成した公開鍵を文字列で記入する
PublicKey = <client_public.key>
# わかりやすくするためにクライアントの仮想IPを 10.0.0.2/32 に設定する。サーバへの接続許可IPに追加する。
AllowedIPs = 10.0.0.2/32
```

Mac 側は Peer の反対側なので逆に設定していく。違いは ListenPort がないことと、Endpoint を設定することです。

Endpoint を設定することで接続先を探しにいけるようになります。

```bash
[Interface]
PrivateKey = <client_private.key>
# クライアントの仮想IP
Address = 10.0.0.2/24

[Peer]
# serverの公開鍵を文字列で記入する
PublicKey = <server_public.key>
AllowedIPs = 10.0.0.1/32
# サーバのグローバルIPとListenPortを設定する。こんなグローバルIPはありえないけど各環境に合わせてよみかえる。
Endpoint = 192.168.11.1:123456
```

ここまで設定が終わったらルーターの設定をいじって、Raspberry Pi の IP と ListenPort に指定したポートをインターネットに公開します。
WireGuard が利用するのは TCP ではなく UDP なので公開するときはその点も注意が必要です。

設定し終わったらサーバで WireGuard を起動します。

```bash
$ sudo wg-quick up wg0
```

サーバが起動できていることを確認したら Mac を携帯でテザリングしてから WireGuard アプリで先程設定した Activate ボタンを押します。

うちのルーターはヘアピン NAT に対応していないので、同じネットワーク内から自分自身のグローバル IP を解決できないので、必ず Mac を別のネットワークにつなぐ必要がありました。（ここに気づくのに結構時間がかかった）

うまく接続が成功すると自分で設定した仮想 IP に対して ssh で Raspberry Pi に接続できるようになります。

```bash
$ ssh 10.0.0.1
```

# LAN 内の他の機器にも VPN ごしに接続できるようにする

この状態では Raspberry Pi 以外にアクセスできないので、Raspberry Pi を踏み台にして家の LAN 内の機器にアクセスできるようにします。

これは Raspberry Pi 側の設定で PostUp で iptables の MASQUERADE ルールを追加するとできるようになります。

PostUp の最後に `iptables -t nat -A POSTROUTING -s 10.0.0.0/24 -j MASQUERADE` を追加します。PostDown で -D することでお掃除も忘れないようにします。

```bash
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE; iptables -t nat -A POSTROUTING -s 10.0.0.0/24 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE; iptables -t nat -D POSTROUTING -s 10.0.0.0/24 -j MASQUERADE
```

Mac 側では Peer の AllowedIPs に他の機器の IP を追加します。

```bash
AllowedIPs = 10.0.0.1/32, 192.168.11.0/24
```

この設定で Mac から 192.168.11.0/24 のレンジにある機器に到達できるようになります。（もちろん ssh だけでなく Remote Desktop 等もできます）

# WireGuard を自動起動させる

このままだと Raspberry Pi が再起動すると WireGuard が自動起動しないので、systemctl で自動起動するようにします。

```
$ sudo systemctl start wg-quick@wg0
```

# おわりに

これで WireGuard を利用して外部ネットワークから自宅の開発サーバにアクセスできるようになりました。

家に強力なサーバを用意しておけば、カフェなどでも開発ができるのはなかなかよい体験だなと思っています。

自宅 VPN は思った以上に Quality of Development に貢献するので、簡単に環境を用意できるようになる WireGuard はおすすめです。

自宅 VPN を用意して快適な開発ライフを送りましょう！
