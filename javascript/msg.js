/*
 * sendMSG 範例：
 *      user_list: 員工編號的陣列
 *      contents: 發送的文字內容
 *      callback: 回傳給主程式的 callback，如果發送成功，則呼叫 callback(true) 否則呼叫 callback(false);
 * */

window.sendMSG = function(user_list, contents, callback){
    alert('(模擬發送簡訊)\n您已進行了一個"發送簡訊"的動作！\n以下是您發送的對象：\n'+user_list.join(',')+'\n\n以下是您發送的訊息內容：\n'+contents+'\n\n');
    callback(true);
};
