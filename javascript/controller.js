$.when(
    $.getScript('javascript/config.js?'+(new Date()).getTime()),
    $.getScript('javascript/config.info.js?'+(new Date()).getTime())
).then(function(){
    var addition_gift_index = 0;
    firebase.initializeApp(firebase_conf);
    //{{ 設定檔介面戴入
    (function initConfig(){
        $.getScript(msg_conf.url);
        $('.config-group').map(function(i, obj){
            var $this = $(this), id = this.id;
            var obj = window[id];
            var addTextItem = function(k, val, ps){
                var $item = $(
                `<li class="config-item">
                    <input type="text" id="${k}-value" class="config-value" />
                </li>`
                ).appendTo($this);
                $this.find('#'+k+'-value').val($.trim(val));
                if(setting_info[ps]) {
                    $('<div class="config-info"></div>').html(setting_info[ps]).prependTo($item);
                }
            };
            var addBooleanItem = function(k, val, ps){
                var $item = $(
                `<li class="config-item">
                    <label><input type="radio" id="${k}-true" value="true" name="${k}-value"> 是</label>
                    <label><input type="radio" id="${k}-false" value="false" name="${k}-value"> 否</label>
                </li>`
                ).appendTo($this);
                if(val == true) {
                    $this.find('#'+k+'-true').prop('checked', true);
                } else {
                    $this.find('#'+k+'-false').prop('checked', true);
                }
                if(setting_info[ps]) {
                    $('<div class="config-info"></div>').html(setting_info[ps]).prependTo($item);
                }
            };
            switch(typeof obj) {
            case "string":
                addTextItem(id, obj, id);
                break;
            case "object":
                for(var k in obj){
                    switch(typeof obj[k]) {
                    case "boolean":
                        addBooleanItem(k, obj[k], id+'.'+k);
                        break;
                    default:
                        addTextItem(k, obj[k], id+'.'+k);
                        break;
                    }
                }
                break;
            default:
                break;
            }
        });
        $('.export-config').bind('click', function(){
            var result_js = [];
            $('.config-group').map(function(){
                var $this = $(this), id = this.id;
                if(typeof(window[id]) == 'string') {
                    $this.find('input[type="text"]:first').map(function(){
                        var $child = $(this), child_id = this.id;
                        result_js.push(
                            `var ${id} = ${JSON.stringify($child.val())};`
                        );
                    });
                } else if(typeof(window[id] == 'object')) {
                    var tpl = ['var ',id, ' = {\n'];
                    var child_value = [];
                    $this.find('input[type="text"],input[type="radio"]:checked').map(function(){
                        var $child = $(this), child_id = this.id;
                        if($child.is('input[type="radio"]')) {
                            if(child_id.indexOf('-true')!=-1) {
                                child_value.push(
                                    `\t${child_id.replace('-true', '')}: true`
                                );
                            } else if(child_id.indexOf('-false')!=-1){
                                child_value.push(
                                    `\t${child_id.replace('-false', '')}: false`
                                );
                            } else {
                                throw 'the id of radio item should end with "-true" or "-false"';
                            }
                        } else if($child.is('input[type="text"]')) {
                            child_value.push(
                                `\t${child_id.replace('-value', '')}: ${JSON.stringify($child.val())}`
                            );
                        }
                    });
                    tpl.push(child_value.join(',\n'));
                    tpl.push("\n}");
                    result_js.push(tpl.join(''));
                }
            });
            
            alert('您即將下載一個檔案，檔名為 config.js\n\n請將它丟到 lottery/javascript 資料夾下\n\n並將原本的 config.js 覆蓋過去，再重新載入系統才算完成設定喲~\n\n\n(建議：覆蓋之前請將原本的 config.js 備份，若覆蓋失敗可以再蓋回來)');

            var a         = document.createElement('a');
            a.href        = 'data:attachment/txt,%EF%BB%BF' + encodeURIComponent(result_js.join('\n\n'));
            a.target      = '_blank';
            a.download    = 'config.js';

            document.body.appendChild(a);
            a.click();
            setTimeout(function(){
                $(a).remove();
            }, 200);
        });
        $('.back-to-import').bind('click', function(){
            $('.page.active').removeClass('active').addClass('inactive');
            $('.page.import-page').removeClass('inactive').addClass('active');
        });
        $('.to-remote-button').bind('click', function(){
            window.open(`http://grassboy.github.io/Lottery/button.html#${JSON.stringify({
                email: firebase_conf.email,
                apiKey: firebase_conf.apiKey,
                authDomain: firebase_conf.authDomain,
                databaseURL: firebase_conf.databaseURL,
                storageBucket: firebase_conf.storageBucket,
                messagingSenderId: firebase_conf.messagingSenderId
            })}`)
        });
        $('.msg-test').bind('click', function(){
            sendMSG([msg_conf.admin_sn], '訊息達人測試', function(is_success, msg){
                if(!is_success) {
                    alert('測試訊息發送失敗！');
                } else {
                    alert('訊息已送出！');
                }
            });
        });
    })();
    ////}}
    var user_id_index = 0;  //員工流水號(自動遞增)
    var gift_id_index = 0;  //獎項流水號(自動遞增)
    var user_array = [], gift_array = []; //用來存放所有的員工 & 獎項資料
    var drawmodes = {};
    var current_drawmode;   //用來記目前的抽獎方式
    var myFirebaseRef;      //Firebase 的同步連線物件
    var NOT_EXIST_STR = '不在現場的普獎';
    firebase_conf = firebase_conf || {};
    $.extend(firebase_conf, {
        check: 'auth/check/', //檢查目前的 server 是否需要輸入密碼
        get: 'auth/draw/',
        response: 'auth/gua_result/',
        connection: 'auth/connection',
        sync: 'auth/sync/'  //Sync 的位置，預期會再加入一層 restore key
                            //送的資料格式： {from: [本機random_id], user: [user_array index], gift: [gift_array index]}
    });
    // 代換活動資訊
    document.title = info.act_name;

    var browser_id = 'b'+(Math.random()*10000000).toFixed(0);
    var globalLog = function(data){
        myFirebaseRef.ref(firebase_conf.sync).push($.extend(data, {from: browser_id}));
        if(data.action == 'log') {
            var user = user_array[data.user_index];
            myFirebaseRef.ref(firebase_conf.get).push({
                action: 'draw-result',
                sn: user.sn,
                name: user.name,
                group: user.group,
                real_id: user.real_id
            });
        }
    };

    var _dom = {
        header_h1: $('.header h1'),
        header_h2: $('.header h2'),
        user_list: $('.user-list'),
        real_id_tips: $('.real-id-tips'),
        summary_page: $('.summary-page'),
        summary_list: $('.summary-list'),
        gift_result_list: $('.gift-result-list'),
        gift_list: $('.gift-list'),
        gift_chart: $('.gift-chart'),
        gift_count_all: $('.summary-gift-count em'),
        gift_count_now: $('.summary-gift-count-now em'),
        drawing_page: $('.drawing-page'),
        drawtype_list: $('.drawtype-list'),
        ping: $('.ping')
    };
    _dom.header_h2.text(info.act_name);
    if(info.can_back_if_not_appear) {
        $('body').addClass('can-back');
    }
    var _tpl = {
        user_data: null,
        gift_data: null,
        gift_chart_data: null,
        ps_data: null,
        gift_result_data: null,
        gift_owner: null
    };
    var randomOf = function(array){
        return array[(Math.random()*array.length)^0];
    };
    var filterOne = function(array, filter){
        for(var i = 0, n = array.length; i < n; ++i){
            if(filter(array[i])) {
                return array[i];
            }
        }
        return null;
    };
    var sn = function(str){ //六碼 sn
        return ("000000"+str).substr(-6);
    }
    //{{ 員工物件
    var User = function(opts){
        this._id = user_id_index++;             //系統流水號
        this.real_id = opts.real_id;            //抽獎單編號
        this.sn = sn(opts.sn);                  //員工編號
        this.group = opts.group;                //處室
        this.name = opts.name;                  //姓名
        this.title = opts.title;                //職稱
        this.gone_ok = opts.gone_ok || false;   //是否不在現場亦可領獎
        this.receive_gift = null;               //得到的獎項
        this.allow_gift = '';                   //只能領取的獎項，如果為空，表示所有獎項皆可領取
        this.removed = false;
        user_array.push(this);

        var dom = this.$dom = _tpl.user_data.clone().appendTo(_dom.user_list);
        dom.find('.user-id').text(this._id + 1);
        dom.find('.user-sn').text(this.sn);
        dom.find('.user-group').text(this.group);
        dom.find('.user-name').text(this.name);
        dom.find('.user-title').text(this.title);
    };

    User.prototype = {
        constructor: User,
        receiveGift: function(gift, restore_mode){
            if(gift.award_to.length >= gift.count) {
                console.log(['員工', this.sn, '獎項指定失敗', gift.sn, gift.title, '只允許', gift.count, '人抽到'].join(' '));
                return -1;
            }
            this.receive_gift = gift;
            this.$dom.find('.user-receive').text(gift.toString());
            gift.toUser(this, restore_mode);
            if(!restore_mode){
                globalLog({
                    action: 'log',
                    user_index: this._id,
                    gift_index: gift._id
                });
            }
        },
        changeGift: function(gift, restore_mode){
            if(gift.award_to.length >= gift.count) {
                alert('轉移失敗，此獎項名額已滿');
                return;
            }
            if(this.receive_gift && this.receive_gift.delUser){
                this.receive_gift.delUser(this);
                this.receive_gift = null;
            }
            this.$dom.find('.user-receive').text('');
            this.receiveGift(gift, true); //這裡的 change 就不用再送 log 了
            if(!restore_mode){
                globalLog({
                    action: 'gift_change',
                    user_index: this._id,
                    gift_index: gift._id
                });
            }
        },
        receiveFail: function(gift, restore_mode){
            gift.delUser(this);
            if(info.can_back_if_not_appear) {
                this.receive_gift = null;
                this.$dom.find('.user-receive').text('');
            } else {
                this.receive_gift = NOT_EXIST_STR;
                this.$dom.find('.user-receive').text(this.receive_gift);
            }
            if(!restore_mode){
                globalLog({
                    action: 'fail',
                    user_index: this._id,
                    gift_index: gift._id
                });
            }
        },
        backToBox: function(restore_mode){
            if(this.receive_gift == NOT_EXIST_STR) {
                this.receive_gift = null
                this.$dom.find('.user-receive').text('');
                if(!restore_mode){
                    globalLog({
                        action: 'back_to_box',
                        user_index: this._id
                    });
                }
            } else {
                alert('此人並非"不在現場的普獎"');
            }
        },
        toString: function(){
            return [this.sn, ' ', this.group, ' - ', this.name, ' (' , this.real_id,')' ].join('');
        }
    };
    ////}}

    //{{ 獎項物件 
    var Gift = function(opts){
        var dom;
        this._id = gift_id_index++;                                 //系統流水號
        this.sn = opts.sn;                                          //獎項編號 (獎品組編號)
        this.title = opts.title;                                    //獎項標題 ex: 三獎
        this.content = opts.content;                                //獎項內容 ex: 現金 1000 元
        this.count = opts.count;                                    //數量
        this.award_to = [];                                         //得獎人流水號陣列
        this.skip = null;                                           //禁止領此獎的 user sn 名單 (會在載入 ps.csv 時更新)
        this.default_drawmode = null                                //預設的抽獎模式

        //如果有指定預設抽獎模式，則套用之
        if(opts.default_drawmode && drawmodes[opts.default_drawmode]) {
            this.default_drawmode = opts.default_drawmode;
        }
        gift_array.push(this);

        //獎項清單側欄 DOM
        dom = this.$dom = _tpl.gift_data.clone().appendTo(_dom.gift_list);
        dom.find('.gift-sn').text(this.sn);
        dom.find('.gift-title').text(this.title);
        dom.find('.gift-content').text(this.content || "？？？");
        dom.find('.gift-count').text(this.count?["(",this.count,"人)"].join(''):"(？人)");
        dom.find('.gift-start').data('for', this._id);
        if(this.title.indexOf('加碼')!=-1 && this.sn.toLowerCase().indexOf('x') == -1) {
            dom.addClass('gift-bonus');
        }

        //獎項清單頁 DOM
        dom = this.$dom_result = _tpl.gift_result_data.clone().appendTo(_dom.gift_result_list);
        dom.find('.gift-result-id span').text(this._id+1);
        dom.find('.gift-result-sn span').text(this.sn);
        dom.find('.gift-result-content').text([this.title, this.content || "？？？"].join(' - '));
        dom.find('.gift-result-count').text(this.count);
        dom.find('.gift-result-who-list').empty();
    };
    window.Gift = Gift;
    Gift.prototype = {
        constructor: Gift,
        show: function(){           //顯示獎項 title
            var that = this;
            var drawing_page = _dom.drawing_page.removeClass('inactive').addClass('active');
            if(drawing_page.data('gift_id') != this._id){
                //載入對應的抽獎方式
                if(this.default_drawmode) {
                    var now_drawmode = drawmodes[this.default_drawmode];
                    now_drawmode.setCurrent();
                }
                drawing_page.data('gift_id', this._id);
            }
            _dom.header_h1.text(this.content || "？？？");
            _dom.header_h2.text(this.sn + ' ' + this.title);
            _dom.gift_count_all.text(this.count);
            _dom.gift_count_now.text('0');
            _dom.summary_page.removeClass('done');
            _dom.summary_list.attr('style', null).empty();
            $('.summary-page .back-to-statics').trigger('click');
            for(var i = 0, n = this.award_to.length; i < n; ++i){
                var user = user_array[this.award_to[i]];
                this.insertSummary(user, i+1);
            }
        },
        toUser: function(user, restore_mode){        //把獎項指定至員工
            var that = this;
            _dom.real_id_tips.text(user.real_id);
            this.award_to.push(user._id);
            this.$dom_result.find('.gift-result-who-list').append(
                $('<li></li>').attr({'id': 'user-'+user._id, 'class': 'receiver'}).text(user.toString())
            );
            setTimeout(function(){
                if(that.award_to.length == that.count){ //已全抽完
                    setTimeout(function(){ //最後一個抽出來的人停久一點
                        var $parent = that.$dom.parent();
                        that.$dom.addClass('done').detach().appendTo($parent);
                        current_drawmode.under_auto_draw = false;
                        if(restore_mode) { //在備援機制下，不用作下列的 dom 操作
                            return;
                        }
                        _dom.summary_page.addClass('active');
                        setTimeout(function(){
                            $('.button-display').trigger('click');
                        }, 1000);
                    }, 2000);
                } else {
                    if(restore_mode) { //在備援機制下，不用作下列的 dom 操作
                        return;
                    }
                    _dom.summary_page.addClass('ready');
                }
            }, current_drawmode.id=='basic'?100:1000);
        },
        delUser: function(user){
            for(var i = 0, n = this.award_to.length; i < n; ++i){
                if(this.award_to[i] == user._id) {
                    this.award_to.splice(i, 1);
                    break;
                }
            }
            this.$dom.removeClass('done');
            this.$dom_result.find('li#user-'+user._id).remove();
        },
        draw: function(){           //Gift.prototype.draw 開始抽
            var that = this;
            if(that.award_to.length >= that.count) {
                alert('此獎項已經抽完，請更換下一個獎項');
                return;
            }
            _dom.real_id_tips.text('');
            var drawing = current_drawmode.draw(that.skip, that.sn);
            if(drawing) {
                drawing.then(function(user){
                    if(user != -1) {
                        var result = user.receiveGift(that);
                        if(result != -1) {
                            that.insertSummary(user, that.award_to.length);
                        }
                    }
                });
            }
        },
        removeSummary: function($tr){
            var that = this;
            $tr.animate({opacity: 0}, {complete: function(){
                    if(that.award_to.length == 0){
                        _dom.summary_list.empty();
                    }
                    $tr.remove();
                }
            });
            that.$dom.removeClass('done');
            _dom.summary_page.removeClass('done');
            _dom.gift_count_now.text(that.award_to.length);
        },
        insertSummary: function(user, index){        //顯示抽獎結果
            if(index == 1 && this.count > 1) { //插入第一筆時，如果獎項數大於 1 時，就要把 th 加上去
                _tpl.summary_th.clone().prependTo(_dom.summary_list);
            }
            var dom = _tpl.summary_item.clone().appendTo(_dom.summary_list);
            dom.data('user_id', user._id);
            if(user.gone_ok) dom.attr('data-gone-ok-msg', user.gone_ok);
            dom.find('.summary-sn').text(user.sn);
            dom.find('.summary-sn').attr({'data-real-id': user.real_id, 'data-index': index});
            dom.find('.summary-group').text(user.group);
            dom.find('.summary-name span').text(user.name);
            _dom.gift_count_now.text(this.award_to.length);
            if(this.award_to.length == this.count) {
                _dom.summary_page.addClass('done');
            }
        }, 
        toString: function(){
            return [this.sn, ' - ', this.title, ' - ', this.content].join('');
        }
    };
    ////}}

    //{{ 抽獎模式物件
    var DrawMode = function(opts){
        var dom;
        this.id = opts.id || alert('DrawMode.id 未指定');
        this.title = opts.title || '新抽獎方式';
        this.info = opts.info || '目前尚無此抽獎方式的說明';
        this.onDraw = opts.onDraw || function(deferred){ alert('你沒有設定抽獎過程！'); deferred.resolve(-1)};
        this.autoDraw = opts.autoDraw || function(deferred){ alert('你沒有設定自動抽獎動作！'); deferred.resolve(-1)};
        this.remoteDraw = opts.remoteDraw || function(){ alert('你沒有設定遠端抽獎動作！');};
        this.thumb = opts.thumb;
        this.$dom = opts.$dom;
        this.timer = [];
        this.under_auto_draw = false;
        if(opts.preProcess) {
            opts.preProcess.apply(this, []);
        }
        dom = this.$item = _tpl.drawtype_item.clone().appendTo(_dom.drawtype_list);
        dom.find('.drawtype-title').text(this.title);
        dom.find('.drawtype-info').text(this.info);
        dom.find('.drawtype-icon').css('background-image', 'url('+this.thumb+')');
        dom.data('drawtype', this.id);
        drawmodes[this.id] = this;
    };
    DrawMode.prototype = {
        constructor: DrawMode,
        LotteryBox: [], //摸彩箱，會把所有未得獎的員工流水號都丟進去
        setTimeout: function(callback, time){
            var timer = setTimeout(callback, time);
            this.timer.push(timer);
            return timer;
        },
        setInterval: function(callback, time){
            var timer = setInterval(callback, time);
            this.timer.push(timer);
            return timer;
        },
        inactive: function(){
            this.$dom.detach();
            this.$item.removeClass('active');
            this.deferred = null;
        },
        active: function(){
            this.$dom.prependTo('.drawing-page').removeClass('draw-start draw-done');
            this.$item.addClass('active');
        },
        getUser: function(){
            return randomOf(this.LotteryBox);
        },
        getUserBySn: function(user_sn){
            var user = filterOne(this.LotteryBox, function(user){
                return user.sn == user_sn;
            });
            return user;
        },
        setCurrent: function() {
            if(current_drawmode) {
                if(current_drawmode.id == this.id) { //如果已是目前抽獎模式，則略過
                    return;
                }
                current_drawmode.inactive();
            }
            current_drawmode = this;
            current_drawmode.active();
        },
        draw: function(skip_array, gift_sn){ //DrawMode.prototype.draw 由 Gift.draw 觸發
            var that = this;
            if(that.deferred && that.deferred.resolve) {
                alert('前一次的抽獎流程中斷，\r\n現在重新開始新的抽獎流程');
                that.deferred.resolve(-1);
            }
            for(var i = 0, n = that.timer.length; i < n; ++i){
                clearInterval(that.timer[i]);
                clearTimeout(that.timer[i]);
            }
            $('.gone-ok-msg').text('');
            that.LotteryBox = [];
            var skip_string = skip_array?('|'+skip_array.join('|')+'|'):'||';
            for(var i = 0, n = user_array.length; i < n; ++i){
                var user = user_array[i];
                if(!user.receive_gift) {
                    if(skip_string.indexOf('|'+user.sn+'|') != -1) {
                        console.log(user.sn + ' 這名員工不得抽這個獎，故略過');
                    } else if(user.allow_gift && user.allow_gift.indexOf('|'+gift_sn+'|')==-1) { //有指定允許抽的獎的話，如果 gift_sn 不在這個清單內，則略過
                        console.log(user.sn + ' 允許抽的獎當中，不含 '+gift_sn+'，故略過');
                    } else {
                        that.LotteryBox.push(user);
                    }
                } else {
                    //alert(user.name + '已抽過了，所以移除');
                }
            }
            if(that.LotteryBox.length == 0) {
                alert('所有同仁都已抽過獎，無法再抽了');
                return null;
            } else {
                console.log('籤筒載入完畢，共 ', that.LotteryBox.length, ' 支籤')
            }
            that.timer = [];
            that.deferred = $.Deferred();
            that.$dom.removeClass('draw-done').addClass('draw-start');
            that.onDraw(that.deferred);
            if(that.under_auto_draw) {
                setTimeout(function(){
                    that.autoDraw(that.deferred);
                }, 10);
            }
            return that.deferred.promise().then(function(user){
                that.deferred = null;  //清空前一次的抽獎流程
                that.$dom.removeClass('draw-start');
                if(user == -1) return -1; //前一次抽獎流程中斷
                that.$dom.addClass('draw-done');
                if(user.gone_ok) {  //如果可以不在現場，則把理由 show 出來
                    $('.gone-ok-msg').text(user.gone_ok);
                }
                if(that.under_auto_draw) {
                    setTimeout(function(){
                        $('.summary-page.ready .button-start').click();
                    }, current_drawmode.id=='basic'?500:2000);
                }
                return user;
            });
        }
    };
    ////}}

    (function initTemplate(){       //先把頁面需暫存的元素取出
        _tpl.user_data = $('.user-item.tpl-data').detach().removeClass('tpl-data');
        _tpl.gift_data = $('.gift-item.tpl-data').detach().removeClass('tpl-data');
        _tpl.gift_chart_data = $('.gift-chart-group-item.tpl-data').detach().removeClass('tpl-data');
        _tpl.ps_data = $('.ps-item.tpl-data').detach().removeClass('tpl-data');
        _tpl.gift_result_data = $('.gift-result-item.tpl-data').detach().removeClass('tpl-data');
        _tpl.drawtype_item = $('.drawtype-item.tpl-data').detach().removeClass('tpl-data');
        _tpl.summary_th = $('.summary-item.th.tpl-data').detach().removeClass('tpl-data');
        _tpl.summary_item = $('.summary-item.tpl-data').detach().removeClass('tpl-data');
    })();

    //{{ init StartUp Event Listener
    var initStartUpEvent = function(){ //要啟動系統後才會監聽的事件
        $('.back-to-import').hide();
        $('.header').bind('dblclick', function(){
            document.body.mozRequestFullScreen();
        });
        $('.footer').bind('click', function(){
            myFirebaseRef.ref(firebase_conf.get).push({action:'ping'});
        });

        //{{Gift Page
        $('.icon-gift').bind('click', function(){
            if($('.draw-start').length != 0){
                if(!confirm('抽獎過程尚未結束，確定要離開？')) {
                    return;
                } else {
                    current_drawmode.deferred && current_drawmode.deferred.resolve && current_drawmode.deferred.resolve(-1);
                }
            }
            $('.gift-page').toggleClass('active');
            _dom.summary_page.removeClass('active ready');
            $('.gift-add').removeClass('active');
            $('.gift-search-sn').select();
        });
        $('.icon-add').bind('click', function(){
            $('.gift-add').addClass('active');
            $('.gift-add-title').select();
        });
        $('.gift-add-button').bind('click', (function(){
            return function(){
                addition_gift_index++;
                var args = {
                    sn: (addition_gift_index < 10?'x0':'x')+addition_gift_index+'0',
                    title: $('.gift-add-title').val(),
                    content: $('.gift-add-content').val(),
                    count: $('.gift-add-count').val() || 1
                };
                new Gift(args);
                globalLog($.extend(args, {action: 'gift_add'}));
                $('.gift-add-title,.gift-add-content,.gift-add-count').val('');
                $('.gift-cancel-button').trigger('click');
                $('.gift-list').scrollTop(2147483647);
            };
        })());
        $('.gift-cancel-button').bind('click', function(){
            $('.gift-add').removeClass('active');
            $('.gift-search-sn').select();
        });
        $('.gift-add-title,.gift-add-content,.gift-add-count').bind('keyup', function(e){
            var $this = $(this);
            switch(e.keyCode) {
            case 27:
                $('.gift-cancel-button').trigger('click');
                break;
            case 13:
                if($this.is('.gift-add-title,.gift-add-content')) {
                    $this.next().focus();
                } else {
                    $('.gift-add-button').trigger('click');
                }
                break;
            }
        });
        $('.gift-search-sn').bind('keyup', function(){
            var $this = $(this), value = $this.val();
            $('.gift-list .gift-item').css('display', function(){
                if($(this).find('.gift-sn').text() == value) {
                    $(this).addClass('gift-show');
                } else {
                    $(this).removeClass('gift-show');
                }
                if($(this).find('.gift-sn').text().indexOf(value) === 0) {
                    return 'block';
                } else {
                    return 'none';
                }
            });
        });
        $('.gift-list').on('click', '.gift-item', function(){
            var gift_id = $(this).find('.gift-start').data('for');
            $('.page.active').removeClass('active').addClass('inactive');
            $('.gift-page').removeClass('active');
            gift_array[gift_id].show();
        });
        ////}}

        //{{Summary Page
        $('.summary-page .back-to-statics').bind('click', function(){
            _dom.summary_page.removeClass('ready').addClass('active');
            _dom.summary_list.attr('style', null);
            $('.summary-list-outer').attr('class', 'summary-list-outer');
            current_drawmode.under_auto_draw = false;
        });

        (function(){ //處理 summary 清單的跑馬
            var $outer = $('.summary-list-outer'), scroll_to;
            $('.summary-page .button-display').bind('click', function(){
                scroll_to = $outer[0].scrollHeight - $outer[0].offsetHeight;
                var pixcel_per_sec = 200;
                $outer[0].scrollTop = 0;
                _dom.summary_list.css({
                    transition: 'transform '+(scroll_to/pixcel_per_sec)+'s linear',
                    transform: 'translateY('+(-scroll_to)+'px)'
                });
            });
        })();
        _dom.summary_list.bind('transitionend', function(){
            if(_dom.summary_list.css('transform')=='matrix(1, 0, 0, 1, 0, 0)') {
                _dom.summary_list.attr('style', null);
            } else {
                setTimeout(function(){
                    _dom.summary_list.css('transform', 'matrix(1, 0, 0, 1, 0, 0)');
                }, 2000)
            }
        });
        _dom.summary_list.on('click', '.summary-remove', function(){
            var $this = $(this), $tr = $this.parents('.tr');
            if($tr.is('.check')) {
                $tr.removeClass('check');
                var user_id = $tr.data('user_id'), user = user_array[user_id];
                var gift_id = _dom.drawing_page.data('gift_id'), gift = gift_array[gift_id];
                if(user && gift){
                    user.receiveFail(gift);
                    gift.removeSummary($tr);
                }
            } else {
                $tr.addClass('check');
            }
        });
        _dom.summary_list.on('click', '.summary-cancel', function(){
            var $this = $(this), $tr = $this.parents('.tr');
            $tr.removeClass('check');
        });
        
        $('.button-start').bind('click', function(){
            var gift_id = _dom.drawing_page.data('gift_id'), gift = gift_array[gift_id];
            _dom.summary_page.removeClass('active ready');
            gift.draw();
        });

        $('.button-start-all').bind('click', function(){
            current_drawmode.under_auto_draw = true;
            $('.button-start').click();
        });
        ////}}

        //{{DrawMode Page
        $('.drawtype-list').on('click', '.drawtype-item', function(){
            var $this = $(this), drawtype = $this.data('drawtype');
            drawmodes[drawtype].setCurrent();
        });
        //}}
        
        //{{Gift-result page

        //把一個人從原本抽到 A 獎，換成抽到 B 獎
        //**************************************
        //此功能亂用的話，的確有可能作弊！請操作者別亂玩！
        //設計目的：如果好死不死，操作人員選錯獎項，
        //          台上抽 A 獎，系統開成 B 獎
        //          就必需把 B 獎得獎者，改成 A 獎才行
        //**************************************
        $('.gift-result-list').on('dblclick', '.gift-result-who-list .receiver', function(){
            var $this = $(this), user_id = $this.attr('id').replace('user-', '');
            var user = filterOne(user_array, function(user){
                    return user._id == user_id;
                });
            if(user) {
                var gift_sn = prompt('請輸入要指定的獎項編號');
                var gift = filterOne(gift_array, function(gift){
                    return gift.sn == gift_sn;
                });
                if(gift && confirm(['****警告，這個功能是為了補救抽獎流程錯誤而設計的，不要亂用！****\n您確定要將 ',user.name,' 所得的獎項換成 ',gift.sn,'-',gift.title,' ？！'].join(''))){
                    user.changeGift(gift);
                }
            } else {
                alert('指定的 user 不存在');
            }
        });

        //手動指定一個獎的得獎者
        //**************************************
        //此功能亂用的話，的確有可能作弊！請操作者別亂玩！
        //設計目的：如果好死不死，主要瀏覽器網路掛掉，
        //          抽出的獎項沒有 sync 過來，
        //          備援機就必需手動把主瀏覽器的資料備份過來
        //**************************************
        $('.gift-result-list').on('dblclick', '.gift-result-sn span', function(){
            var $this = $(this), gift_sn = $this.text();
            var gift = filterOne(gift_array, function(gift){
                return gift.sn == gift_sn;
            });
            if(gift) {
                var user_sn = prompt('請輸入該得獎者的員工編號');
                var user = filterOne(user_array, function(user){
                    return user.sn == user_sn;
                });
                if(user && user.receive_gift) {
                    alert('該同仁已得獎');
                } else {
                    if(user && confirm(['****警告，這個功能是為了補救已抽出的獎項沒有同步到其他瀏覽器而設計的，不要亂用！****\n您確定要將 ',gift.title, ' 這個獎項交給 ',user.sn,'-',user.name,' ？！'].join(''))){
                        user.receiveGift(gift, true);
                    }
                }
            }
        });
        //}}

        //手動將已不在現場的普獎的籤放回籤筒
        //**************************************
        //此功能亂用的話，的確有可能作弊！請操作者別亂玩！
        //設計目的：如果好死不死，主要瀏覽器網路掛掉，
        //          抽出的獎項手動 sync 過來的過程輸入錯誤，
        //          且把此得獎者刪掉後變普獎，
        //          就必需要把這個人的普獎拿掉，並把他的籤放回籤筒
        //**************************************
        $('.user-list').on('dblclick', '.user-receive:contains("'+NOT_EXIST_STR+'")', function(){
            var $this = $(this), user_sn = $this.prevAll('.user-sn').text();
            var user = filterOne(user_array, function(user){
                    return user.sn == user_sn;
                });
            if(user && confirm(['****警告，這個功能是為了補救手動 sync 得獎者時輸入錯誤，不能被放成普獎而設計的，不要亂用！****\n您確定要將 ',user.sn,'-',user.name,' 的籤從不在現場的普獎放回籤筒？！'].join(''))){
                user.backToBox();
            }
        });

        //{{ SMS handler
        $('.gift-result-list').on('click', '.gift-result-sn .icon-sms', function(){
            var $this = $(this), gift_sn = $this.parent().find('span').text();
            var user_list = [];
            $this.parents('.gift-result-item').find('.receiver').map(function(){
                var $this = $(this);
                var user_id = this.id.replace('user-', '')^0;
                var user = filterOne(user_array, function(user){
                        return user._id == user_id;
                    });
                if(user) {
                    user_list.push(user.sn);
                } else {
                    alert($this.text() + ' 的資訊不存在');
                }
            });
            var gift = filterOne(gift_array, function(gift){
                return gift.sn == gift_sn;
            });
            if(user_list.length > 0) {
                if(typeof window.sendMSG == 'function') {
                    var msg_contents = `${info.act_name} 您中的獎是 ${gift.sn} ${gift.title}：${gift.content}，${msg_conf.post_text}`;
                    if(msg_conf.is_testing) {
                        msg_contents = `原收件者：${user_list.join(',')}\n ${msg_contents}`;
                        user_list = [msg_conf.admin_sn];
                    }
                    sendMSG(user_list, msg_contents, function(is_success){
                        if(!is_success) {
                            alert('訊息發送失敗！\n以下是要發送的對象：\n'+user_list.join(' ')+'\n\n以下是要發送的訊息內容：\n'+msg_contents+'\n\n');
                        } else {
                            alert('訊息已送出！');
                            $this.addClass('sms-sent');
                        }
                    });
                } else {
                    alert('函數 sendMSG 不存在，因此無法發送簡訊');
                }
            } else {
                alert('這個獎項目前尚未抽出！');
            }
        });
        //}}

        //{{ 大獎統計 checkbox
        var total_group_count = {};
        (function(){
            user_array.forEach(function(user, i){
                var group_data = total_group_count[user.group] = total_group_count[user.group] || {count: 0, all: 0} ;
                group_data.all++;
            });
            for(var k in total_group_count) {
                var $chart_item = _tpl.gift_chart_data.clone().appendTo(_dom.gift_chart.find('.gift-chart-group-list'));
                $chart_item.attr('title', k).find('.gift-chart-group').html(k+' ('+total_group_count[k].all+') ');
            }
            var countGiftChartList = function(){
                for(var k in total_group_count) {
                    total_group_count[k].count = 0;
                }
                $('.gift-result-list').find('.gift-result-id .icon-award.active').map(function(){
                    var $this = $(this), $gift_item = $this.parents('.gift-result-item');
                    var gift_sn = $gift_item.find('.gift-result-sn span').text();
                    var gift = filterOne(gift_array, function(gift){
                        return gift.sn == gift_sn;
                    });
                    gift.award_to.forEach(function(id){
                        var user = user_array[id];
                        total_group_count[user.group].count++;
                    });
                });
            };
            var updateGiftChartList = function(){
                var is_count = (_dom.gift_chart.attr('data-focus') == 'count');
                var max_count = 0;
                for(var k in total_group_count) {
                    if(total_group_count[k].count > max_count) {
                        max_count = total_group_count[k].count;
                    }
                }
                for(var k in total_group_count) {
                    var $chart_item = $('.gift-chart-group-item[title="'+k+'"]');
                    $chart_item.find('.gift-chart-count').attr('title', ['中獎人數/處室人數：', total_group_count[k].count, '/', total_group_count[k].all].join(' ')).text(
                        is_count?
                            total_group_count[k].count:
                            ((total_group_count[k].count*100/total_group_count[k].all).toFixed(1)+'%')
                    );
                    $chart_item.find('.gift-chart-bar-inner').css(
                        'width', is_count?
                            ((total_group_count[k].count*100 / max_count)+'%'):
                            ((total_group_count[k].count*100/total_group_count[k].all)+'%')
                    );
                }
                var t = $('.gift-chart-group-item').sort(function (a, b) {
                    var $a = $(a);
                    var $b = $(b);
                    return (parseFloat($(a).find('.gift-chart-count').text()) >= parseFloat($(b).find('.gift-chart-count').text()))?-1:1;
                });
                t.map(function () {
                    $(this).appendTo(this.parentNode);
                });
            };
            $('.gift-chart-switch-outer').on('click', '.gift-chart-switch', function(){
                var $this = $(this);
                if($this.is('.gift-chart-switch-count')){
                    _dom.gift_chart.attr('data-focus', 'count');
                } else {
                    _dom.gift_chart.attr('data-focus', 'rate');
                }
                updateGiftChartList();
            });
            $('.gift-result-list').on('click', '.icon-award', function(){
                var $this = $(this), $gift_item = $this.parents('.gift-result-item');
                if($gift_item.is('.th')) {
                    if($this.is('.active')) {
                        $this.removeClass('active');
                        _dom.gift_result_list.find('.icon-award').removeClass('active');
                    } else {
                        $this.removeClass('half-active').addClass('active');
                        _dom.gift_result_list.find('.icon-award').addClass('active');
                    }
                } else {
                    $this.toggleClass('active');
                    var active_length = _dom.gift_result_list.find('.gift-result-id .icon-award.active').length;
                    var all_length =  _dom.gift_result_list.find('.gift-result-id .icon-award').length;
                    if(active_length == 0) {
                        _dom.gift_result_list.find('.th .icon-award').removeClass('active half-active');
                    } else if(active_length == all_length) {
                        _dom.gift_result_list.find('.th .icon-award').removeClass('half-active').addClass('active');
                    } else {
                        _dom.gift_result_list.find('.th .icon-award').removeClass('active').addClass('half-active');
                    }
                }
                countGiftChartList();
                updateGiftChartList();
            });
            $('.gift-chart-expand').bind('click', function(){
                _dom.gift_chart.toggleClass('inactive');
            });
            $('.gift-chart-reload').bind('click', function(){
                countGiftChartList();
                updateGiftChartList();
            });
            countGiftChartList();
            updateGiftChartList();
        })();
        //}}
        //{{bottom bar icons
        $('.toolbox').on('click', '.btn i', function(){
            if($('.draw-start').length != 0){
                if(!confirm('抽獎過程尚未結束，確定要離開？')) {
                    return;
                } else {
                    current_drawmode.deferred && current_drawmode.deferred.resolve && current_drawmode.deferred.resolve(-1);
                }
            }
            var $this = $(this), current_page = $('.page.active');
            if(!$this.is('.icon-arrow')) {
                if(current_page.is('.drawing-page')) {
                    _dom.header_h2.text(info.act_name);
                    _dom.header_h1.text('電子抽獎系統');
                }
                $('.gift-page').removeClass('active');
                _dom.summary_page.removeClass('active ready');
                $('.page.active').removeClass('active').addClass('inactive');
            } else {
                $('.toolbox').toggleClass('active');
            }
            if($this.is('.icon-user')){
                $('.page.user-page').removeClass('inactive').addClass('active');
            } else if ($this.is('.icon-award')) {
                $('.page.gift-result').removeClass('inactive').addClass('active');
            } else if ($this.is('.icon-ticket')) {
                $('.page.drawtype-page').removeClass('inactive').addClass('active');
            } else if ($this.is('.icon-settings')) {
                $('.page.config-page').removeClass('inactive').addClass('active');
            } else if ($this.is('.icon-notice')) {
                $('.page.ps-page').removeClass('inactive').addClass('active');
            } else if ($this.is('.icon-home')) {
                $('.page.main-page').removeClass('inactive').addClass('active');
            } else if ($this.is('.icon-draw')) {
                //{{ 將處室統計結果也更新到 csv 檔
                var gift_chart_rows = [['處室名稱','處室內人數','抽中大獎人數','比例'].join(',')];
                $('.gift-chart-reload').trigger('click'); //更新獎項清單
                for(var k in total_group_count) {
                    gift_chart_rows.push([k,total_group_count[k].all,total_group_count[k].count,(total_group_count[k].count*100/total_group_count[k].all).toFixed(1)].join(','))
                }
                //}}
                var cellStr = function(str){
                    if(str.indexOf(',')==-1){
                        return str;
                    } else {
                        return '"'+str.replace(/\"/g, '＂')+'"'
                    }
                }
                var csvRows = [['抽獎聯編號', '員工代號','姓名','職務','1級單位','獎項編號','獎項名稱','獎項內容'].join(',')+',,'+gift_chart_rows[0]], line;
                for(var i = 0, n = user_array.length; i < n; ++i){
                    var user = user_array[i];
                    line = [];
                    line.push(cellStr(user.real_id), cellStr(user.sn), cellStr(user.name), cellStr(user.title), cellStr(user.group));
                    if(user.receive_gift == NOT_EXIST_STR){
                        line.push('', NOT_EXIST_STR,'');
                    } else if(user.receive_gift){
                        line.push(cellStr(user.receive_gift.sn), cellStr(user.receive_gift.title), cellStr(user.receive_gift.content));
                    } else {
                        line.push(',,');
                    }
                    if(gift_chart_rows[i+1]) {
                        csvRows.push(line.join(',')+',,'+gift_chart_rows[i+1]);
                    } else {
                        csvRows.push(line.join(','));
                    }
                }
                var csvString = csvRows.join("%0A");
                var a         = document.createElement('a');
                a.href        = 'data:attachment/csv,%EF%BB%BF' + csvString;
                a.target      = '_blank';
                a.download    = info.output_filename;

                document.body.appendChild(a);
                a.click();
                setTimeout(function(){
                    $(a).remove();
                }, 200);
            }
        });
        //}}
        window.onbeforeunload = function () {
            return "";
        };
    };
    ////}}

    //{{ //初始化各種抽獎模式
    (function initDrawTypes(){
        current_drawmode = new DrawMode({
            id: 'basic',
            title: '一眼瞬間',
            info: '抽獎過程中，會有一瞬間的機會看到自己的員工編號，或許就在那一瞬間，成了永恆！',
            $dom: $([
                '<div class="drawmode-basic">',
                    '<h3>開始抽獎啦！！！</h3>',
                    '<div class="drawmode-sn"></div>',
                    '<div class="drawmode-group"></div>',
                    '<div class="drawmode-name"></div>',
                    '<button class="drawmode-stop">抽出</button>',
                '</div>'
            ].join('')),
            autoDraw: function(){
                //如果是 under_auto_draw，則 call DrawMode.protoype.draw() 時，會 setTimeout 來 call 這支
                //這支的目的是要讓 DrawMode.prototype.draw() 有抽出一個 user，讓[開始] button 再次出現
                setTimeout(function(){
                    $('.drawmode-basic .drawmode-stop').click();
                }, 100);
            },
            remoteDraw: function(){
                $('.drawmode-basic .drawmode-stop').click();
            },
            onDraw: function(deferred){
                var that = this, dom = this.$dom;
                var user;
                var updateView = function(){
                    user = that.getUser(); //抽出!!
                    dom.find('.drawmode-sn').text(user.sn);
                    dom.find('.drawmode-group').text(user.group);
                    dom.find('.drawmode-name').text(user.name);
                };
                var timer = this.setInterval(updateView, 100);
                this.$dom.find('.drawmode-stop').unbind('click').one('click', function(){
                    clearInterval(timer);
                    updateView(true);
                    deferred.resolve(user);
                });
            },
            thumb: 'images/drawmode1.png'
        });
        new DrawMode({
            id: 'slots',
            title: '瘋狂７７７',
            info: '把員工編號丟進 777 拉霸機進行拉霸，想要中獎只能祈禱上天保祐了…',
            $dom: $('.drawmode-slots').detach().removeClass('tpl-data'),
            autoDraw: function(){
                //如果是 under_auto_draw，則 call DrawMode.protoype.draw() 時，會 setTimeout 來 call 這支
                //這支的目的是要讓 DrawMode.prototype.draw() 有抽出一個 user，讓[開始] button 再次出現
                setTimeout(function(){
                    $('.drawmode-slots .slots-bar-button').click();
                }, 300);
            },
            remoteDraw: function(){
                $('.drawmode-slots .slots-bar-button').click();
            },
            onDraw: function(deferred){
                var that = this, dom = this.$dom;
                dom.removeClass('draw-running');
                dom.find('.drawmode-group').text('請點拉霸鈕↗');
                dom.find('.drawmode-name').text('');
                this.$dom.find('.slots-bar-button').unbind('click').one('click', function(){
                    var user = null;
                    $({}).queue(function(_) {
                        dom.find('.slot').removeClass('slot-start slot-end slot-turbo');
                        dom.find('.drawmode-group').text('');
                        dom.find('.drawmode-name').text('緊張！緊張！');
                        dom.addClass('draw-running');
                        setTimeout(function() {
                            console.log((new Date()).getTime(), 'Queue 1');
                            $(_).dequeue();
                        },
                        100);
                    }).queue(function(_) {
                        dom.find('.slot').removeClass('slot-start slot-end slot-turbo').addClass('slot-start');
                        setTimeout(function() {
                            console.log((new Date()).getTime(), 'Queue 2');
                            $(_).dequeue();
                        },
                        100);
                    }).queue(function(_) {
                        dom.find('.slot').removeClass('slot-start slot-end slot-turbo').addClass('slot-turbo');
                        setTimeout(function() {
                            console.log((new Date()).getTime(), 'Queue 3');
                            $(_).dequeue();
                        },
                        100);
                    }).queue(function(_) {
                        if(!_dom.drawing_page.is('.active')) {
                            sn = '0000000';
                        } else {
                            user = that.getUser(); //抽出!!
                            var sn = '0'+user.sn; //前面補零，在 substr(-100,1) 時會取到 0，即可處理「員工代號不足六碼時要補零」的機制
                        }
                        dom.find('.slot').removeClass('slot-start slot-end slot-turbo').attr('class', function(i) { //i 會傳入這是第幾個 slot
                            return 'slot slot-end slot-' + sn.substr(-(6-i), 1).toLowerCase();
                        });
                        setTimeout(function(){
                            console.log((new Date()).getTime(), 'Queue 4');
                            $(_).dequeue();
                        }, 500);
                    }).queue(function(_){
                        dom.removeClass('draw-running');
                        if(!_dom.drawing_page.is('.active')) {  //如果過程中切到別頁，則把號碼歸零，名字不 show
                            dom.find('.slot').attr('class', 'slot slot-end slot-0');
                            dom.find('.drawmode-group').text('------');
                            dom.find('.drawmode-name').text('------');
                            user = null;
                        } else { //到這個時間點，名字有打出來，所以就一定要給獎，不論有沒有切到別頁去
                            dom.find('.drawmode-group').text(user.group);
                            dom.find('.drawmode-name').text(user.name);
                        }
                        if(!user) {
                            deferred.resolve(-1);
                        } else {
                            deferred.resolve(user);
                        }
                    });
                });
            },
            thumb: 'images/drawmode2.png'
        });
        new DrawMode({
            id: 'guagua',
            title: '長官刮刮樂',
            info: '世界愈快，長官刮刮樂的節奏則慢，準備好接受這個殘忍的煎熬了嗎？',
            $dom: $('.drawmode-guagua').detach().removeClass('tpl-data'),
            preProcess: function(){
            },
            remoteDraw: function(){
                $('.drawmode-guagua .guagua-tips').click();
            },
            onDraw: function(deferred){
                var that = this, dom = this.$dom, user;
                var $img = dom.find('.guagua-img'), $canvas = dom.find('.guagua-canvas'), $cursor = dom.find('.guagua-cursor'), clear_timer;
                (function(){
                    var deferred = $.Deferred();
                    if(!$img[0].naturalWidth) {
                        $img.attr('src', 'images/card1.png').load(function(){
                            deferred.resolve($img);
                        });
                    } else {
                        deferred.resolve($img);
                    }
                    return deferred.promise();
                })().then(function($img){
                    var ctx = $canvas[0].getContext('2d');
                    var is_mousedown = false;
                    var mouseHandler = function (e) {
                        e.preventDefault();
                        if(is_mousedown){
                            e.preventDefault();
                            var $this = $(this);
                            var offset = $this.offset();
                            var x = (e.pageX - offset.left);
                            var y = (e.pageY - offset.top);
                            $canvas.trigger('scratch', [x, y, true]);
                        }
                    };
                    $canvas.unbind('initscratch').bind('initscratch', function(e, data){
                        ctx.clearRect(0, 0, 640, 480);
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.drawImage($img[0], 0, 0, 640, 480);
                        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                        dom.find('.drawmode-sn').text(data.sn);
                        dom.find('.drawmode-group').text(data.group).attr('data-group-length', data.group.length);
                        dom.find('.drawmode-name').text(data.name);
                        myFirebaseRef.ref(firebase_conf.get).remove();
                        myFirebaseRef.ref(firebase_conf.response).remove();
                        myFirebaseRef.ref(firebase_conf.response).push(data);
                    });
                    $canvas.unbind('scratch').bind('scratch', function (e, x, y, is_local) {
                        if(!clear_timer) {
                            if(!is_local) $cursor.addClass('show-coin');
                        } else {
                            clearTimeout(clear_timer);
                        }
                        ctx.globalCompositeOperation = "destination-out";
                        ctx.beginPath();
                        ctx.arc(x, y, 24, 0, Math.PI * 2, true);
                        ctx.fill();
                        $cursor.css({left: x, top: y});
                        clear_timer = setTimeout(function(){
                            $cursor.removeClass('show-coin');
                            clear_timer = null;
                        }, 1000);
                    });
                    $canvas.unbind('mousemove').unbind('mousedown').unbind('mouseup').bind('mousemove', mouseHandler).bind('mousedown', function(e){
                        is_mousedown = true;
                        mouseHandler.apply(this, [e]);
                    }).bind('mouseup', function(){
                        is_mousedown = false;
                    });
                });
                dom.find('.drawmode-sn').text('');
                dom.find('.drawmode-group').text('').attr('data-group-length', null);
                dom.find('.drawmode-name').text('');
                dom.removeClass('card-drawed');
                dom.find('.guagua-tips').one('click', function(){
                    user = that.getUser(); //抽出!!
                    dom.addClass('card-drawed');
                    dom.find('.guagua-canvas').trigger('initscratch', [{
                        action: 'initscratch',
                        sn: user.sn,
                        group: user.group,
                        name: user.name
                    }]);
                });
                dom.find('.card-final').one('dblclick', function(){
                    if(user){
                        deferred.resolve(user);
                    } else {
                        deferred.resolve(-1);
                    }
                    myFirebaseRef.ref(firebase_conf.response).push({
                        action: 'clearscratch'
                    });
                });
            },
            thumb: 'images/drawmode3.png'
        });
        new DrawMode({
            id: 'pokemon',
            title: '精靈寶可夢',
            info: '2016正夯的遊戲，你今天抓寶了嗎？想要得大獎？一起來被長官的寶貝球收服吧！',
            $dom: $('.drawmode-pokemon').detach().removeClass('tpl-data'),
            preProcess: function(){
                this.pokemonGo = new PokemonGo(this.$dom[0], {
                    pokemon: [
                        {normal: 'ivs_normal.png', hit: 'ivs_hit.png', desc: '前方有隻野生的大目千歲'},
                        {normal: 'hicloud_normal.png', hit: 'hicloud_hit.png', desc: '前方有隻野生的雲小獅'}
                    ],
                    ball: [
                        'ball.jpg', 'ball2.jpg', 'ball3.jpg'
                    ],
                    is_active: false
                });
            },
            remoteDraw: function(){
                var new_log = [PokemonGoMouseGesture[0][0]];
                var s = parseInt((PokemonGoMouseGesture[0].length-21)*Math.random())+1;
                new_log.push.apply(new_log, PokemonGoMouseGesture[0].slice(s, s+20))
                this.pokemonGo.replayLog(new_log);
            },
            autoDraw: function(){
                var that = this;
                setTimeout(function(){
                    var new_log = [PokemonGoMouseGesture[0][0]];
                    var s = parseInt((PokemonGoMouseGesture[0].length-21)*Math.random())+1;
                    new_log.push.apply(new_log, PokemonGoMouseGesture[0].slice(s, s+20))
                    that.pokemonGo.replayLog(new_log);
                }, 1000);
            },
            onDraw: function(deferred){
                var that = this, dom = this.$dom;
                var user = null;
                that.pokemonGo.resetAll();
                that.pokemonGo.setActive(true);
                that.pokemonGo.setBall();
                that.pokemonGo.setPokemon();
                myFirebaseRef.ref(firebase_conf.response).push({
                    action: 'initpoke'
                });
                dom.find('.pokemon-result').addClass('inactive').removeClass('animated bounceInDown');
                dom.unbind('pokedown').bind('pokedown', function(e, x, y){
                    that.pokemonGo.fakeTouchHandler.down({clientX: x, clientY: y});
                });
                dom.unbind('pokemove').bind('pokemove', function(e, x, y){
                    that.pokemonGo.fakeTouchHandler.move({clientX: x, clientY: y});
                });
                dom.unbind('pokeup').bind('pokeup', function(e, x, y){
                    that.pokemonGo.fakeTouchHandler.up();
                });
                dom.unbind('gotcha').one('gotcha', function(){
                    that.pokemonGo.setActive(false);
                    user = that.getUser();
                    dom.find('.pokemon-hp span').text(parseInt(Math.random()*800+50,10));
                    dom.find('.drawmode-sn').text(user.sn);
                    dom.find('.drawmode-group').text(user.group);
                    dom.find('.drawmode-name').text(user.name);
                    dom.find('.pokemon-result').removeClass('inactive').addClass('animated bounceInDown');
                    deferred.resolve(user);
                    myFirebaseRef.ref(firebase_conf.response).push({
                        action: 'clearpoke'
                    });
                });
            },
            thumb: 'images/drawmode4.png'
        });
        new DrawMode({
            id: 'vr',
            title: '虛擬實境',
            info: '結合 VR 眼鏡的抽獎模式，找出散佈於各處的員工編號，準備好一起天旋地轉了嗎？',
            $dom: $('.drawmode-vr').detach().removeClass('tpl-data'),
            preProcess: function(){
                window.vrDraw = this.vrDraw = new VRDraw(this.$dom[0], {
                    width: 1024, height: 608,
                    skip_euler_rotation: true,
                    min_arrow_scale: 3,
                    onClearGift: function(current_length, index){
                        myFirebaseRef.ref(firebase_conf.response).push({
                            action: 'vrcleargift',
                            current_length: current_length,
                            index: index
                        });
                    },
                    is_active: false
                });
            },
            remoteDraw: function(){
                //no-op
            },
            onDraw: function(deferred){
                var that = this, dom = this.$dom;
                that.vrDraw.setActive(true);
                dom.find('.vr-result').addClass('inactive').removeClass('animated bounceInDown');
                dom.addClass('vr-waiting');
                setTimeout(function(){
                    var user = that.getUser();
                    that.vrDraw.resetAll();
                    var sn = '0'+user.sn;
                    for(var i = 0; i < 6; i++) {
                        that.vrDraw.putRandomGift(user.sn.substr(-(6-i), 1));
                    }
                    dom.unbind('dblclick').one('dblclick', function(){
                        that.vrDraw.setActive(true);
                        dom.removeClass('vr-waiting');
                    });
                    var prev_moveto_time, move_to_timer;
                    dom.unbind('vrmoveto').bind('vrmoveto', function(e, data){
                        //{{regularing deviceOrientation
                        while(that.vrDraw.controls.deviceOrientation.alpha > 360) that.vrDraw.controls.deviceOrientation.alpha -= 360;
                        while(that.vrDraw.controls.deviceOrientation.alpha < 0) that.vrDraw.controls.deviceOrientation.alpha += 360;
                        while(that.vrDraw.controls.deviceOrientation.beta > 180) that.vrDraw.controls.deviceOrientation.beta -= 360;
                        while(that.vrDraw.controls.deviceOrientation.beta < -180) that.vrDraw.controls.deviceOrientation.beta += 360;
                        //}}
                        if(prev_moveto_time) {
                            clearTimeout(move_to_timer);
                            (function(from_time, to_time, now_pos, next_pos){
                                //{{ 改繞最短路徑
                                var skip = false;
                                if( now_pos.alpha > next_pos.alpha && now_pos.alpha - next_pos.alpha >  180 ) next_pos.alpha+=360;
                                if( now_pos.alpha < next_pos.alpha && now_pos.alpha - next_pos.alpha < -180 ) next_pos.alpha-=360;
                                if( now_pos.beta > next_pos.beta && now_pos.beta - next_pos.beta >  180 ) next_pos.beta+=360;
                                if( now_pos.beta < next_pos.beta && now_pos.beta - next_pos.beta < -180 ) next_pos.beta-=360;
                                //}}
                                (function tickTo(tick){
                                    var d = tick/(to_time - from_time);
                                    if(d>1) d = 1;
                                    var new_alpha = now_pos.alpha*(1-d) + next_pos.alpha*d;
                                    var new_beta = now_pos.beta*(1-d) + next_pos.beta*d;
                                    that.vrDraw.setEuler(
                                        new_alpha, new_beta, 0
                                    );
                                    if(d!=1) {
                                        clearTimeout(move_to_timer);
                                        move_to_timer = setTimeout(function(){
                                            var new_tick = ((new Date()).getTime() - to_time);
                                            tickTo(new_tick);
                                        }, 16);
                                    }
                                })(16);
                            })(prev_moveto_time, (new Date()).getTime(), {
                                    alpha: that.vrDraw.controls.deviceOrientation.alpha, 
                                    beta: that.vrDraw.controls.deviceOrientation.beta 
                                }, {
                                    alpha: data.euler.alpha,
                                    beta: data.euler.beta
                                }
                            );
                            prev_moveto_time = (new Date()).getTime();
                        } else {
                            that.vrDraw.setEuler(data.euler.alpha, data.euler.beta, 0);
                            prev_moveto_time = (new Date()).getTime();
                        }
                    });
                    dom.unbind('allclear').one('allclear', function(){
                        that.vrDraw.setActive(false);
                        dom.find('.drawmode-sn').text(user.sn);
                        dom.find('.drawmode-group').text(user.group);
                        dom.find('.drawmode-name').text(user.name);
                        dom.find('.vr-result').removeClass('inactive').addClass('animated bounceInDown');
                        myFirebaseRef.ref(firebase_conf.response).push({
                            action: 'clearvr'
                        });
                        deferred.resolve(user);
                    });
                    myFirebaseRef.ref(firebase_conf.get).remove();
                    myFirebaseRef.ref(firebase_conf.response).remove();
                    myFirebaseRef.ref(firebase_conf.response).push({
                        action: 'initvr',
                        sn: user.sn,
                        group: user.group,
                        name: user.name,
                        pos_array: that.vrDraw.getGiftsPos()
                    });
                }, 100);
            },
            thumb: 'images/drawmode5.png'
        });
        new DrawMode({
            id: 'manual',
            title: '人工抽獎',
            info: '抽獎過程中，取決於長官的手氣，你準備好了嗎！',
            $dom: $([
                '<div class="drawmode-basic">',
                    '<h3>(請輸入得獎者員工代碼)</h3>',
                    '<div class="drawmode-sn"></div>',
                    '<div class="drawmode-group"></div>',
                    '<div class="drawmode-name"></div>',
                    '<input class="drawmode-inputSn">',
                    '<button class="drawmode-stop">輸入</button>',
                '</div>'
            ].join('')),
            autoDraw: function(){
                //ToDo
            },
            remoteDraw: function(){
                //no-op
            },
            onDraw: function(deferred){
                var that = this, dom = this.$dom;
                var userSn;
                var user = {
                    sn: '得獎者是…',
                    group: '',
                    name: ''
                };

                var updateView = function(){
                    dom.find('.drawmode-sn').text(user.sn);
                    dom.find('.drawmode-group').text(user.group);
                    dom.find('.drawmode-name').text(user.name);
                };
                updateView();
                that.$dom.find('.drawmode-inputSn').bind('keydown', function(e){
                    if(e.keyCode == '13') {
                        that.$dom.find('.drawmode-stop').trigger('click');
                    }
                }).val('').focus();
                that.$dom.find('.drawmode-stop').unbind('click').one('click', function clickHandler(){
                    userSn= that.$dom.find('.drawmode-inputSn').val();
                    user = that.getUserBySn(userSn); //輸入中獎者
                    if(user) {
                        updateView();
                        deferred.resolve(user);
                    } else {
                        alert('此員工編號並不在籤筒裡，\n請確認他是否具有領獎資格');
                        user = {
                            sn: '！他能領獎嗎？',
                            group: '',
                            name: ''
                        };
                        updateView();
                        $(this).one('click', clickHandler);
                    }
                });
            },
            thumb: 'images/drawmode6.png'
        }); 
        drawmodes['slots'].setCurrent();
    })();
    ////}}

    //{{ 處理資料時會用到的函數
    var readCSVFile = function(file, callback){
        var reader = new FileReader();
        // Handle errors load
        reader.onload = function(e){
            var csv = e.target.result;
            callback(csv);
        };
        reader.onerror = function(){
            alert('載入 CSV 檔發生錯誤');
        };
        reader.readAsText(file, 'Big5');
    };
    var splitLine = function(line){ //把 csv 檔每行的逗點切開(若有開頭雙引號，則要 merge 到結尾雙引號為止)
        var result = [];
        var sep = line.split(',');
        var need_end = false;
        for(var i = 0, n = sep.length; i < n; ++i){
            if(need_end && result.length > 0) {
                result[result.length-1] += (','+sep[i]);
                if(sep[i].substr(-1, 1) == '"') {
                    need_end = false;
                    //把開頭結尾的雙引號都拿掉
                    result[result.length-1] = result[result.length-1].replace(/^\"(.*)\"$/, "$1");
                }
            } else {
                result.push(sep[i]);
                if(sep[i].substr(0, 1) == '"'){
                    need_end = true;
                }
            }

        }
        return result;
    };
    var processGiftData = function(r){
        var gifts = r.split('\n');
        for(var i = 1, n = gifts.length; i < n; ++i){
            var gift = splitLine($.trim(gifts[i]));
            if($.trim(gift[0])){
                var args = {
                    sn: $.trim(gift[0]),
                    title: $.trim(gift[1]),
                    content: $.trim(gift[2]),
                    count: $.trim(gift[3])
                };
                switch(gift[5]){
                case '1':
                    args.default_drawmode = 'basic';
                    break;
                case '2':
                    args.default_drawmode = 'slots';
                    break;
                case '3':
                    args.default_drawmode = 'guagua';
                    break;
                case '4':
                    args.default_drawmode = 'pokemon';
                    break;
                case '5':
                    args.default_drawmode = 'vr';
                    break;
                case '6':
                    args.default_drawmode = 'manual';
                    break;
                case '':
                    //沒設定預設抽獎模式
                    break;
                default:
                    if(gift[5]){ //如果有指定抽獎模式編號，但對不上的話…
                        alert(['獎項',args.sn,'未知的預設抽獎模式：', gift[5]].join(' '));
                    }
                    break;
                }
                new Gift(args);
            }
        }
    };
    var processUserData = function(r) {
        var users = r.split('\n');
        for(var i = 1, n = users.length; i < n; ++i){
            var user = splitLine($.trim(users[i]));
            if($.trim(user[1])){
                new User({
                    real_id: $.trim(user[0]),
                    sn: $.trim(user[1]),
                    group: $.trim(user[4]),
                    name: $.trim(user[2]),
                    title: $.trim(user[3])
                });
            }
        }
    };
    var processPSData = function(r){
        var users = r.split('\n');
        //users[0] 為 meta data，從第三欄開始為一連串不能領的 gift id
        //不過如果有一欄為「只能領某些獎」，要把該欄位綁到 user.allow_gift
        var data = splitLine($.trim(users[0]));
        var allow_gift_column_index;
        for(var i = 3, n = data.length; i < n; i++){
            if($.trim(data[i]).indexOf('只能領某些獎')!=-1) {
                allow_gift_column_index = i; //先把 column_index 記下來
                continue;
            }
            var gift_id = $.trim(data[i]).match(/不能領\ ?[\ ]*/) && $.trim(data[i]).replace(/不能領\ ?[\ ]*/, '');
            if(!gift_id) {
                continue;
            }
            var gift = filterOne(gift_array, function(gift){
                    return gift.sn == gift_id;
                });
            if(!gift) {
                alert('您設定不能領 '+gift_id+'，\n但該獎項編號並不存在您的獎項清單！');
            } else {
                data[i] = gift.skip = []; //把 data 拿來當該 gift 的 skip 屬性的捷徑
                data[i]._gift_sn = gift.sn //把 gift.skip 加個 sn 的 reference (這種寫法好醜0rz...以後應該要比照 allow_gift_column 的寫法才對)
            }
        }
        
        var noshow_count = only_count = skip_count = 0;
        for(var i = 1, n = users.length; i < n; ++i){
            var ps_user = $.trim(users[i]).split(',');
            if(ps_user[1]){
                var user = filterOne(user_array, function(user){
                        return user.sn == ps_user[1] || (user.sn^0)==(ps_user[1]);
                    });
                if(!user) {
                    alert('您指定了一筆特殊員工編號 '+ps_user[1]+'，\n但該編號並不存在於同仁清單！');
                } else {
                    if($.trim(ps_user[2])) {
                        user.gone_ok = $.trim(ps_user[2]);
                        //在 ps-page 下列出可不在現場原因
                        var ps_item = _tpl.ps_data.clone().appendTo('.ps-noshow-list');
                        ps_item.find('.ps-id').text(++noshow_count);
                        ps_item.find('.ps-sn').text(ps_user[1]);
                        ps_item.find('.ps-content').text(user.gone_ok);
                    }
                    var skip_gift_array = [];
                    for(var j = 3, n2 = ps_user.length; j < n2 && data[j]; ++j){
                        if(j == allow_gift_column_index) {
                            if($.trim(ps_user[allow_gift_column_index]) != '') { //如果該用戶只被允許領某些獎
                                user.allow_gift = '|'+$.trim(ps_user[allow_gift_column_index]).split(' ').join('|')+'|';
                                //在 ps-page 下列出該員工只能領取的獎項清單
                                var ps_item = _tpl.ps_data.clone().appendTo('.ps-only-list');
                                ps_item.find('.ps-id').text(++only_count);
                                ps_item.find('.ps-sn').text(ps_user[1]);
                                ps_item.find('.ps-content').text(user.allow_gift.replace(/\|/g, ' '));
                            }
                            continue;
                        }
                        if($.trim(ps_user[j])) {
                            data[j].push(user.sn);  //data[i] 為前面指定的 gift.skip 清單
                            //將此獎項的 id 列出 
                            skip_gift_array.push(data[j]._gift_sn);
                        }
                    }
                    if(skip_gift_array.length != 0) {
                        //在 ps-page 下列出必需 skip 的獎項清單
                        var ps_item = _tpl.ps_data.clone().appendTo('.ps-skip-list');
                        ps_item.find('.ps-id').text(++skip_count);
                        ps_item.find('.ps-sn').text(ps_user[1]);
                        ps_item.find('.ps-content').text(skip_gift_array.join(' '));
                    }
                }
            }
        }
    };
    //}}
    //{{ 測試時塞假資料的 code
    var fakeData = function(){
        var deferred = $.Deferred();
        $.ajax({
            type: 'get',
            url: 'data/gift99a.csv?'+(new Date()).getTime(),
            beforeSend: function(xhr) {
                xhr.overrideMimeType('text/html; charset=big5');
            },
            success: function(r) {
                processGiftData(r);
                $('.gift-a-csv').addClass('success');
            }
        }).then(function(){
            return $.ajax({
                type: 'get',
                url: 'data/gift99b.csv?'+(new Date()).getTime(),
                beforeSend: function(xhr) {
                    xhr.overrideMimeType('text/html; charset=big5');
                },
                success: function(r) {
                    processGiftData(r);
                    $('.gift-b-csv').addClass('success');
                }
            });
        }).then(function(){
            return $.ajax({
                type: 'get',
                url: 'data/user99.csv?'+(new Date()).getTime(),
                beforeSend: function(xhr) {
                    xhr.overrideMimeType('text/html; charset=big5');
                },
                success: function(r) {
                    processUserData(r);
                    $('.users-csv').addClass('success');
                }
            });
        }).then(function(){
            return $.ajax({
                type: 'get',
                url: 'data/ps.csv?'+(new Date()).getTime(),
                beforeSend: function(xhr) {
                    xhr.overrideMimeType('text/html; charset=big5');
                },
                success: function(r) {
                    processPSData(r);
                    $('.ps-csv').addClass('success');
                    $('.fake-data-button').hide();
                }
            });
        });
    };
    ////}}
    //{{ init Firebase
    var initFirebase = function(){ //Firebase sync
        firebase_conf.sync+=$('.restore-key').val();
        var authCallback = function (error){
            if(error == -1) {
                return;
            }
            alert('登入成功');
            myFirebaseRef = firebase.database();
            myFirebaseRef.ref(firebase_conf.get).remove()
            myFirebaseRef.ref(firebase_conf.connection).remove()
            var bindOfflineAlert = function() {
                myFirebaseRef.ref(firebase_conf.connection+'/'+browser_id).onDisconnect().set({
                    action: 'connect_error',
                    from: browser_id
                });
            };
            bindOfflineAlert();
            myFirebaseRef.ref(firebase_conf.connection).on("child_removed", function(snapshot) {
                var value = snapshot.val();
                console.log(value);
                if(value.from == browser_id) {
                    //重新接回線上 DB
                    console.log('回到線上了');
                    $('body').removeClass('bomb-self');
                    bindOfflineAlert();
                }
            });
            myFirebaseRef.ref(firebase_conf.connection).on("child_added", function(snapshot) {
                var value = snapshot.val();
                if(value.from != browser_id) {
                    console.log('喔喔！有人斷線了！');
                    $('body').addClass('bomb-other');
                    setTimeout(function(){
                        myFirebaseRef.ref(firebase_conf.connection+'/'+value.from).remove();
                        $('body').removeClass('bomb-other');
                    }, 3000);
                } else {
                    $('body').addClass('bomb-self');
                }
            });
            myFirebaseRef.ref(firebase_conf.response).remove();
            initStartUpEvent();
            $('.btn .icon-home').click();
            myFirebaseRef.ref(firebase_conf.sync).on("child_added", function(snapshot) {
                _dom.ping.toggleClass('pong');
                var value = snapshot.val();
                if(value.from == browser_id) {
                    return; //略過自己觸發的 sync 事件
                }
                if(value.action == 'log') { // a 同仁得到 b 獎
                    var user = user_array[value.user_index];
                    var gift = gift_array[value.gift_index];
                    if(!user) {
                        console.log('第 ' + value.user_index + ' 名 User 不存在')
                    } else if(!gift) {
                        console.log('第 ' + value.gift_index + ' 個 Gift 不存在')
                    } else {
                        console.log(user._id, ' 得到 ', gift._id);
                        if(!user.receive_gift) {
                            user.receiveGift(gift, true);
                            if(_dom.drawing_page.data('gift_id') == gift._id) { //如果目前有載入此筆獎項資訊，則要更新 summary page
                                gift.insertSummary(user, gift.award_to.length);
                            }
                        }
                    }
                } else if (value.action == 'fail') { // 同仁因不在現場改列普獎
                    var user = user_array[value.user_index];
                    var gift = gift_array[value.gift_index];
                    if(!user) {
                        console.log('第 ' + value.user_index + ' 名 User 不存在')
                    } else if(!gift) {
                        console.log('第 ' + value.gift_index + ' 個 Gift 不存在')
                    } else {
                        console.log(user._id, ' 無法得到 ', gift._id);
                        if(user.receive_gift != NOT_EXIST_STR) {
                            user.receiveFail(gift, true);
                        }
                    }
                } else if (value.action == 'back_to_box') { // 同仁從不在現場改列普獎改放回籤筒
                    var user = user_array[value.user_index];
                    if(!user) {
                        console.log('第 ' + value.user_index + ' 名 User 不存在')
                    } else {
                        console.log(user._id, ' 從普獎回籤筒 ');
                        if(user.receive_gift == NOT_EXIST_STR) {
                            user.backToBox(true);
                        }
                    }
                } else if (value.action == 'gift_change') { // 臨時改列獎項
                    var user = user_array[value.user_index];
                    var gift = gift_array[value.gift_index];
                    if(!user) {
                        console.log('第 ' + value.user_index + ' 名 User 不存在')
                    } else if(!gift) {
                        console.log('第 ' + value.gift_index + ' 個 Gift 不存在')
                    } else {
                        console.log(user._id, ' 改列 ', gift._id);
                        if(user.receive_gift && user.receive_gift._id != gift._id) {
                            user.changeGift(gift, true);
                        }
                    }
                } else if (value.action == 'gift_add') { // 臨時追加獎項
                    console.log('追加獎項 ', value.sn, value.title);
                    addition_gift_index++;
                    if(gift_array.filter(function(item){
                        return item.sn == value.sn;
                    }).length == 0) {
                        new Gift({
                            sn: value.sn,
                            title: value.title,
                            content: value.content,
                            count: value.count
                        });
                    }
                }
            });
            myFirebaseRef.ref(firebase_conf.get).on("child_added", function(snapshot) {
                var value = snapshot.val();
                if(value.action != 'vrmoveto') { //不理會 vrmoveto 的 ping 訊號
                    _dom.ping.toggleClass('pong');
                }
                if(value.action == 'draw-stop') {
                    if(current_drawmode.$dom.is('.draw-start')) {
                        current_drawmode.remoteDraw();
                    }
                } else if(value.action == 'scratch') {
                    var $canvas = $('.guagua-canvas');
                    if($canvas.length) {
                        $canvas.trigger('scratch', [value.x, value.y]);
                    }
                } else if(value.action.indexOf('poke')===0) {
                    var $area = $('.drawmode-pokemon');
                    if($area.length) {
                        $area.trigger(value.action, [value.x, value.y]);
                    }
                } else if(value.action == 'vrinited') {
                    current_drawmode.$dom.trigger('dblclick');
                } else if(value.action == 'vrmoveto') {
                    current_drawmode.$dom.trigger('vrmoveto', {euler: value.euler});
                } else if(value.action == 'vrcleargift') {
                    vrDraw.clearGift(value.current_length, value.index);
                }
            });
        };
        firebase.auth().signInAnonymously().catch(function(error){
            return -1;
        }).then(function(error){
            if(error == -1) {
                var pass = localStorage['pass'];
                if(!pass) {
                    pass = localStorage['pass'] = prompt('請輸入同步機制所需的密碼');
                }
                firebase.auth().signInWithEmailAndPassword(firebase_conf.email, pass).catch(function(error) {
                    var errorCode = error.code;
                    var errorMessage = error.message;
                    console.log('登入失敗：', errorCode, errorMessage);
                    delete localStorage['pass'];
                    alert('登入失敗，可能是密碼有誤，請重新整理後再輸入密碼');
                    return -1;
                }).then(authCallback);
            } else {
                alert('注意，您的 firebase 設定尚未修改，\n所以應該是位於 demo 模式下\ndemo 模式下的同步機制不保證永遠有效，\n請至設定頁設定您自己的 firebase 主機、帳號資訊');
                authCallback();
            }
        });
    };
    //}}
    //{{ init JustFont
    var initJustFont = (function() {
        var originHTML = document.body.textContent;
        var uniqueText = function (str) { //取得指定字串內的所有 unique 文字，即重複的字元會被濾掉
            var result = [];
            for (var i = 0, n = str.length; i < n; ++i) {
                var start = 0,
                end = result.length - 1;
                while (start <= end) {
                    var p = ((start + end) / 2) ^ 0;
                    var c = result[p];
                    if (str[i] == c) {
                        break;
                    } else if (str[i] > c) {
                        start = p + 1;
                    } else {
                        end = p - 1;
                    }
                }
                if (start > end) {
                    result.splice(start, 0, str[i]);
                }
            }
            result.sort(function(){return Math.random() - 0.5;}); //打亂結果字串
            return result.join('');
        };
        return function(){
            $('.unique-text').text(uniqueText(originHTML+'追加獎項開始抽獎關閉獎項清單人尚未開始抽獎，請按 [開始] 進行抽獎如此一來這名同仁就只能領普獎，確定嗎？結果載入恭喜中獎選我選我！'+$('.gift-result').text()));
            $($.trim(justfont_conf)).appendTo('head');
        };
    })();
    //}}
    //{{ init Event
    (function initEvent(){
        $('.restore-key').val(info.restore_key);
        $('.fake-data-button').bind('click', function(e){
            fakeData();
        });
        $('.config-button').bind('click', function(e){
            $('.page.active').removeClass('active').addClass('inactive');
            $('.config-page').removeClass('inactive').addClass('active');
        });
        $('.start-system-button').bind('click', function(e){
            if($('.need-file-item.success').length != 4) {
                alert('請載入必要的 CSV 檔，謝謝！');
                return;
            } 
            if(!$('.restore-key').val()) {
                alert('請指定備援金鑰');
                return;
            }
            initFirebase();
            initJustFont();
            $(this).hide();
            $('.icon-home').trigger('click');
        });
        $('input[type=file]').val('');
        $('.file-gift-a-csv').bind('change', function(e){
            var $item = $(this).parents('.need-file-item');
            readCSVFile(this.files[0], function(r){
                processGiftData(r);
                $item.addClass('success');
            });
        });
        $('.file-gift-b-csv').bind('change', function(e){
            var $item = $(this).parents('.need-file-item');
            readCSVFile(this.files[0], function(r){
                processGiftData(r);
                $item.addClass('success');
            });
        });
        $('.file-users-csv').bind('change', function(e){
            var $item = $(this).parents('.need-file-item');
            readCSVFile(this.files[0], function(r){
                processUserData(r);
                $item.addClass('success');
            });
        });
        $('.file-ps-csv').bind('change', function(e){
            var $item = $(this).parents('.need-file-item');
            readCSVFile(this.files[0], function(r){
                processPSData(r);
                $item.addClass('success');
                $('.fake-data-button').hide();
            });
        });
    })();
    ////}}
});

