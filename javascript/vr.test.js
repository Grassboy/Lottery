$.when(
    $.getScript('javascript/config.js?'+(new Date()).getTime())
).then(function(){
    $(function(){
        var dom = $('.drawmode-vr');
        var myFirebaseRef;      //Firebase 的同步連線物件
        $.extend(firebase_conf, {
            check: 'auth/check/', //檢查目前的 server 是否需要輸入密碼
            get: 'auth/draw/',
            response: 'auth/gua_result/',
            sync: 'auth/sync/'  //Sync 的位置，預期會再加入一層 restore key
                                //送的資料格式： {from: [本機random_id], user: [user_array index], gift: [gift_array index]}
        });
        firebase.initializeApp(firebase_conf);
        var authCallback = function(){
            alert('登入成功');
            myFirebaseRef = firebase.database();
            myFirebaseRef.ref(firebase_conf.get).remove()
            myFirebaseRef.ref(firebase_conf.response).remove();
            myFirebaseRef.ref(firebase_conf.get).on("child_added", function(snapshot) {
                var value = snapshot.val();
                if(value.action == 'vrinited') {
                    dom.trigger('dblclick');
                } else if(value.action == 'vrmoveto') {
                    dom.trigger('vrmoveto', {euler: value.euler});
                } else if(value.action == 'vrcleargift') {
                    vrDraw.clearGift(value.current_length, value.index);
                }
            });
            var user;
            var prev_moveto_time, move_to_timer;
            dom.unbind('vrmoveto').bind('vrmoveto', function(e, data){
                //{{regularing deviceOrientation
                while(vrDraw.controls.deviceOrientation.alpha > 360) vrDraw.controls.deviceOrientation.alpha -= 360;
                while(vrDraw.controls.deviceOrientation.alpha < 0) vrDraw.controls.deviceOrientation.alpha += 360;
                while(vrDraw.controls.deviceOrientation.beta > 180) vrDraw.controls.deviceOrientation.beta -= 360;
                while(vrDraw.controls.deviceOrientation.beta < -180) vrDraw.controls.deviceOrientation.beta += 360;
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
                            vrDraw.setEuler(
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
                            alpha: vrDraw.controls.deviceOrientation.alpha, 
                            beta: vrDraw.controls.deviceOrientation.beta 
                        }, {
                            alpha: data.euler.alpha,
                            beta: data.euler.beta
                        }
                    );
                    prev_moveto_time = (new Date()).getTime();
                } else {
                    vrDraw.setEuler(data.euler.alpha, data.euler.beta, 0);
                    prev_moveto_time = (new Date()).getTime();
                }
            });
            $('.drawmode-vr').bind('allclear', function(){
                vrDraw.resetAll();
                dom.find('.drawmode-sn').text(user.sn);
                dom.find('.drawmode-group').text(user.group);
                dom.find('.drawmode-name').text(user.name);
                dom.find('.vr-result').removeClass('inactive').addClass('animated bounceInDown');
                myFirebaseRef.ref(firebase_conf.response).push({
                    action: 'clearvr'
                });
                setTimeout(function(){
                    resetDraw();
                }, 5000);
            });

            var vrDraw = window.vrDraw = new VRDraw($('.drawmode-vr')[0], {
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
            var resetDraw = function(){
                dom.find('.vr-result').addClass('inactive').removeClass('animated bounceInDown');
                user = (function(){
                    var candidate_str = "0123456789VZ";
                    var sn = '';
                    for(var i = 0; i < 6; i++) {
                        sn+=candidate_str[parseInt(Math.random()*candidate_str.length)];
                    }
                    return {
                        sn: sn,
                        group: '不知什麼處',
                        name: '小胖子'
                    }
                })();
                for(var i = 0; i < 6; i++) {
                    vrDraw.putRandomGift(user.sn[i]);
                }
                myFirebaseRef.ref(firebase_conf.get).remove();
                myFirebaseRef.ref(firebase_conf.response).remove();
                myFirebaseRef.ref(firebase_conf.response).push({
                    action: 'initvr',
                    sn: user.sn,
                    group: user.group,
                    name: user.name,
                    pos_array: vrDraw.getGiftsPos()
                });
                vrDraw.setActive(true);
            };
            resetDraw();
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
    });
});
