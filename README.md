# Lottery
小弟於 2015 年初為敝公司寫的尾牙抽獎程式，預計清掉所有需授權的內容後 Open Source

想試玩系統，請至線上 Demo 頁 http://grassboy.github.io/Lottery/

此系統需要與下列幾個第三方服務進行介接：

 * Firebase (備援機制、多裝置同步機制)
   * Firebase 環境的建立請見 [FirebaseAccountSetting](https://github.com/Grassboy/Lottery/wiki/FirebaseAccountSetting)
 * justfont (讓抽獎系統字體看起來更 Fancy)
   * justfont 環境的建立請見 [JustFontAccountSetting](https://github.com/Grassboy/Lottery/wiki/JustFontAccountSetting)

遠端抽獎頁的網址為：http://grassboy.github.io/lotteryButton/index.html
 * 注意，直接連進去時並無法操作，此網址的格式應為 
   * `http://grassboy.github.io/lotteryButton/index.html?[firebase 設定]`
 * 請直接透過設定頁面的「至遠端抽獎頁」按鈕開啟
 * Firebase 設定需要填入由 Firebase 專案提供的設定資訊，如下圖
  ![Firebase 設定](http://i.imgur.com/8IqKImj.png)
  ![Firebase 設定2](http://i.imgur.com/vriDjyz.png)
  (你也是可以用用目前我設定好的 firebase 環境，支援暱名登入，不過如果這個 firebase 被用在其他未預期的用途上…我可能會考慮拿掉降子0rz...)

系統操作各式情境請見 [OperationScenario](https://github.com/Grassboy/Lottery/wiki/OperationScenario)

系統安裝方式請按以下步驟：

 * [下載此專案至本機](https://github.com/Grassboy/Lottery/archive/gh-pages.zip)
 * [下載 Compass.app](https://github.com/KKBOX/compassapp/releases)
 * 執行 Compass.app (開啟 compass.app 的紅色指南針程式)
 * 這時候可能會被要求電腦要安裝 java，可至 [Java 官網](https://java.com/zh_TW/download/) 安裝
 * 執行 Compass.app 時，Windows 工具列會多一個灰色指南針圖示，如下圖   
   ![Gray Compass](http://i.imgur.com/RC7YGLX.png)
 * 在灰色指南針按右鍵 → Preference → Services → 點選 Enable Web Server (port 設成 24680)   
   livereload 可設可不設，如下圖   
   ![Preference Box](http://i.imgur.com/fJpakOz.png)
 * 解壓縮一開始的 gh-pages.zip，會得到一個資料夾
 * 在灰色指南針按右鍵 → Watch a folder... → 選取剛才解壓縮後的資料夾
 * 灰色指南針此時會變成紅色指南針，即表示已完成 Watch，此時 http://localhost:24680/ 就可以連至抽獎系統，如下圖：
   ![System Preview](http://i.imgur.com/IzgDZjq.png)

