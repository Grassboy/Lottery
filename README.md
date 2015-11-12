# Lottery
小弟於 2015 年初為敝公司寫的尾牙抽獎程式，預計清掉所有需授權的內容後 Open Source

此系統需要與下列幾個第三方服務進行介接：

 * Firebase (備援機制、多裝置同步機制)
   * Firebase 環境的建立請見 [FirebaseAccountSetting](https://github.com/Grassboy/Lottery/wiki/FirebaseAccountSetting)
 * justfont (讓抽獎系統字體看起來更 Fancy)
   * justfont 環境的建立請見 [JustFontAccountSetting](https://github.com/Grassboy/Lottery/wiki/JustFontAccountSetting)

遠端抽獎頁的網址為：http://grassboy.github.io/lotteryButton/index.html
 * 注意，直接連進去時並無法操作，此網址的格式應為 
   * `http://grassboy.github.io/lotteryButton/index.html?[firebase server 位置]?[firebase 用戶 email]`
