# mahjong_lite_server

このリポジトリは、mahjong_lite※におけるリアルタイム通信サーバーです。

※ mahjong_lite：https://github.com/kanata-kikuchi/mahjong_lite


---


## 主な機能

- ルーム作成リクエストに応じてIDを発行し、ルームを管理
- ルームに参加しているユーザー情報の管理
- 局ごとの点数移動などの試合進行情報を受信し、ルーム内のユーザーへブロードキャスト


---


## 技術構成

使用言語：
- JavaScript

実行環境：
- Node.js

 ライブラリ：
- Socket.IO


---


## 使い方 / 起動方法

本サーバーは Render 上にデプロイして稼働しています。
フロントエンド（Flutter Web）は GitHub Pages 上に配置されており、
クライアントからの Socket.IO 接続を受け付けます。
