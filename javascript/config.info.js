var setting_info = {
    'info.act_name': `
        活動名稱
    `,
    'info.output_filename': `
        匯出後的 CSV 檔名
    `,
    'info.can_back_if_not_appear': `
        抽出來若不在現場，可否繼續參與後續抽獎？<br />
        <em>若為 <span>是</span> 表示之後仍然有可能抽中他</em>，<br />
        若為 <span>否</span> 表示若不在場的話將會被歸為普獎
    `,
    'info.restore_key': `
        預設備援金鑰
    `,
    'msg_conf.is_testing': `
        是否在測試模式下？<br />
        「注意」若為 <span>是</span> 時，則所有訊息都會發給管理員，<br />
        <em>活動當天「千萬記得」設成 <span>否</span></em>
    `,
    'msg_conf.admin_sn': `
        管理員員工編號，測試模式下會把所有訊息全發到這個員工編號，<br>你可以<button class="msg-test">按我測試訊息發佈</button>
    `,
    'msg_conf.user_id': `
        訊息系統帳號
    `,
    'msg_conf.password': `
        訊息系統密碼
    `,
    'msg_conf.post_text': `
        領獎辦法文字，屆時訊息格式為<br /><em> [活動名稱] 您中的獎是 [獎項編號] [獎項標題]：[獎項內容]，[領獎辦法文字]</em>
    `,
    'msg_conf.url': `
        sendMSG([user.sn array], [msg content], [callback]) 函數的位置
    `,
    'firebase_conf.email': `
        firebase 所使用的 email
    `,
    'firebase_conf.apiKey': `Firebase 網站的 apiKey`,
    'firebase_conf.authDomain': `Firebase 網站的 authDomain`,
    'firebase_conf.databaseURL': `Firebase 網站的 databaseURL`,
    'firebase_conf.storageBucket': `Firebase 網站的 storageBucket`,
    'firebase_conf.messagingSenderId': `Firebase 網站的 messagingSenderId`,
    'justfont_conf': `
        justfont 的 html tag 設定，詳見 <a href="https://github.com/Grassboy/Lottery/wiki/JustFontAccountSetting" target="_blank">JustFontAccountSetting</a>
    `
};
