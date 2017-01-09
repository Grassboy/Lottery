    var is_ok = false;
    var config = location.href.toString().split('#')[1];
    var err_postfix = '此頁網址格式應為\n'+
                      'http://grassboy.github.io/lotteryButton/index.html?[firebase 主機資訊]';
    if(!config) {
        alert(
            '錯誤：未指定 firebase 主機資訊，\n'+err_postfix
        );
    }
    try {
        config = JSON.parse(decodeURIComponent(config));
    } catch (e) {
        config = null;
    }

    if(!(config && config.apiKey && config.authDomain && config.databaseURL && config.storageBucket && config.messagingSenderId)) {
        alert('Firebase 主機資訊有誤');
    } else if (config.email.indexOf('@') == -1) {
        alert('錯誤：firebase 使用者 email 有誤\n'+err_postfix);
    } else {
        is_ok = true;
    }
    if(is_ok) {
        var firebase_conf = {   //Firebase 的設定檔
            server: config,
            check: 'auth/check/',
            get: 'auth/draw/',
            response: 'auth/gua_result/'
        };

        firebase.initializeApp(firebase_conf.server);
        var myFirebaseRef = firebase.database();
        var authCallback = function (error, authData) {
            if(error == -1) {
                return;
            }
            alert('登入成功');
            myFirebaseRef.ref(firebase_conf.get).remove();
            $('.ping').bind('touchstart', function(){
                myFirebaseRef.ref(firebase_conf.get).push({action:'ping'});
            });
            myFirebaseRef.ref(firebase_conf.get).on('child_added', function(snapshot){
                var value = snapshot.val();
                $('.ping').toggleClass('pong');
                if(value.action == 'draw-result'){
                    $('.user-sn').text(value.sn);
                    $('.user-group').text(value.group);
                    $('.user-name').text(value.name);
                    $('.user-real_id').text(value.real_id);
                    $('.draw-result').toggleClass('pong');
                }
            });
            myFirebaseRef.ref(firebase_conf.response).on('child_added', function(snapshot){
                var value = snapshot.val();
                if(value.action == 'initscratch') {
                    $('body').addClass('scratching');
                    $('.guagua-canvas').trigger('initscratch', [value]);
                } else if(value.action == 'clearscratch') {
                    $('body').removeClass('scratching');
                /*
                } else if(value.action == 'initpoke') {
                    $('body').addClass('pokemoning');
                } else if(value.action == 'clearpoke') {
                    $('body').removeClass('pokemoning');
                */
                } else if(value.action == 'initvr') {
                    $('.drawmode-vr').trigger('initvr', {pos_array: value.pos_array, name: value.name, sn: value.sn, group: value.group});
                } else if(value.action == 'clearvr') {
                    $('.drawmode-vr').trigger('clearvr');
                } else if(value.action == 'vrcleargift') {
                    $('.drawmode-vr').trigger('vrcleargift', {current_length: value.current_length, index: value.index});
                } else {
                    console.log('new action', value.action, value);
                }
            });
            $('.remote-draw-button').bind('touchstart', function(){
                myFirebaseRef.ref(firebase_conf.get).push({
                    action: 'draw-stop'
                });
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
                firebase.auth().signInWithEmailAndPassword(config.email, pass).catch(function(error) {
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

        (function(){
            $img = $('.guagua-img'), $canvas = $('.guagua-canvas');
            (function(){
                var deferred = $.Deferred();
                if(!$img[0].naturalWidth) {
                    $img.attr('src', 'images/card1.jpg?v2').load(function(){
                        deferred.resolve($img);
                    });
                } else {
                    deferred.resolve($img);
                }
                return deferred.promise();
            })().then(function($img){
                var count = 0;
                var ctx = $canvas[0].getContext('2d');
                var mouseHandler = function (e) {
                    e = e.originalEvent;
                    var touches = e.touches;
                    e.preventDefault();
                    var $this = $(this);
                    var offset = $this.offset();
                    var width = $this.width();
                    var height = $this.height();
                    for(var i = 0, n = touches.length; i < n; ++i){
                        var t = touches[i];
                        var x = (t.pageX - offset.left);
                        var y = (t.pageY - offset.top);
                        $canvas.trigger('scratch', [x,y]);
                    }
                };
                $canvas.bind('initscratch', function(e, data){
                    ctx.clearRect(0, 0, 640, 480);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.drawImage($img[0], 0, 0, 640, 480);
                    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                    $('.guagua-result .drawmode-sn').text(data.sn);
                    $('.guagua-result .drawmode-group').text(data.group);
                    $('.guagua-result .drawmode-name').text(data.name);
                });
                $canvas.bind('scratch', function (e, x, y) {
                    ctx.globalCompositeOperation = "destination-out";
                    ctx.beginPath();
                    ctx.arc(x, y, 24, 0, Math.PI * 2, true);
                    ctx.fill();
                    myFirebaseRef.ref(firebase_conf.get).push({
                        action: 'scratch',
                        x: x, y: y
                    });
                });
                $canvas.bind('touchmove', mouseHandler).bind('touchstart', mouseHandler);
            });
            $('.draw-result').bind('touchstart', function(){
                $(this).toggleClass('pong');
            });
        })();
        (function(){
            /*
            var prev_x = 0; prev_y = 0, threshold = 50;
            var mouseHandler = function (e, action) {
                myFirebaseRef.ref(firebase_conf.get).push({
                    action: action,
                    x: (e.clientX || 0), y: (e.clientY || 0)
                });
            };
            $pokemon_area = $('.pokemon-area');
            $pokemon_area.bind('touchstart', function(e){
                prev_x = prev_y = 0;
                e = e.originalEvent;
                e.preventDefault();
                e.stopPropagation();
                e = e.touches && e.touches[0] || e;
                mouseHandler(e, 'pokedown');
            });
            $pokemon_area.bind('touchmove', function(e){
                e = e.originalEvent;
                e.preventDefault();
                e.stopPropagation();
                e = e.touches && e.touches[0] || e;
                if((e.clientX - prev_x)*(e.clientX - prev_x) + (e.clientY - prev_y)*(e.clientY - prev_y) > threshold*threshold) {
                    prev_x = e.clientX;
                    prev_y = e.clientY;
                    console.log('move');
                    mouseHandler(e, 'pokemove');
                }
            });
            $pokemon_area.bind('touchend', function(e){
                prev_x = prev_y = 0;
                e = e.originalEvent;
                e.preventDefault();
                e.stopPropagation();
                e = e.touches && e.touches[0] || e;
                mouseHandler(e, 'pokeup');
            });
            */
        })();
        var toggleFullscreen = function(){
            if(document.webkitIsFullScreen) {
                document.webkitExitFullscreen && document.webkitExitFullscreen();
                screen && screen.orientation && screen.orientation.unlock();
            } else {
                document.body.webkitRequestFullscreen && document.body.webkitRequestFullscreen();
                screen && screen.orientation && screen.orientation.lock('landscape');
            }
        };
        $(window).bind('touchstart', function(e){
            e = e.originalEvent;
            if(e.touches.length == 5) {
                if(localStorage.vr_enable == 'yes') {
                    alert('關閉 VR 抽獎頁');
                    delete localStorage.vr_enable;
                } else {
                    alert('啟動 VR 抽獎頁');
                    localStorage.vr_enable = 'yes';
                }
                location.reload();
            } else if (e.touches.length == 4) {
                toggleFullscreen();
            }
        });
        if(localStorage.vr_enable) {
            (function(){
                //var clear_timer;
                var vrDraw = new VRDraw($('.drawmode-vr')[0], {
                    fullscreen: true, dualmode: !(window.innerWidth >= 800 || window.innerHeight >= 800), arrow_delay: 100, touch: true,
                    onClearGift: function(current_length, index) {
                        myFirebaseRef.ref(firebase_conf.get).push({
                            action: 'vrcleargift',
                            current_length: current_length,
                            index: index
                        });
                    },
                    onChange: function(orient) {
                        if(vrDraw.states.is_active && vrDraw.gifts.length+vrDraw.gifts_done.length > 0) {
                            var angle = vrDraw.getAlphaBeta(vrDraw.controls.object.getWorldDirection());
                            angle.alpha = -angle.alpha-90;
                            if(angle.alpha<0) angle.alpha+=360;
                            angle.beta += 90;
                            myFirebaseRef.ref(firebase_conf.get).push({
                                action: 'vrmoveto',
                                euler: {
                                    alpha: angle.alpha,
                                    beta: angle.beta
                                }
                            });
                        }
                    }
                });
                vrDraw.$div.bind('vrcleargift', function(e, data){
                    vrDraw.clearGift(data.current_length, data.index);
                });
                vrDraw.$div.bind('clearvr', function(){
                    vrDraw.resetAll();
                    vrDraw.setActive(true);
                    vrDraw.$main.find('.vr-result').removeClass('inactive');
                    /*
                    clearTimeout(clear_timer);
                    clear_timer = setTimeout(function(){
                        $('body').removeClass('vring');
                        vrDraw.setActive(false);
                    }, 2000);
                    */
                });
                vrDraw.$div.bind('clearvr', function(){
                    vrDraw.resetAll();
                    vrDraw.setActive(true);
                    vrDraw.$main.find('.vr-result').removeClass('inactive');
                    /*
                    clearTimeout(clear_timer);
                    clear_timer = setTimeout(function(){
                        $('body').removeClass('vring');
                        vrDraw.setActive(false);
                    }, 2000);
                    */
                });
                vrDraw.$div.bind('initvr', function(e, data){
                    vrDraw.resetAll();
                    data.pos_array.forEach(function(pos){
                        vrDraw.putGift(new THREE.Vector3(pos.x, pos.y, pos.z), pos.digit);
                    });
                    vrDraw.setActive(true);
                    vrDraw.$main.find('.vr-result').addClass('inactive');
                    vrDraw.$main.find('.drawmode-name').text(data.name);
                    vrDraw.$main.find('.drawmode-sn').text(data.sn);
                    vrDraw.$main.find('.drawmode-group').text(data.group);
                    myFirebaseRef.ref(firebase_conf.get).push({
                        action: 'vrinited'
                    });
                    //clearTimeout(clear_timer);
                    $('body').addClass('vring');
                });
            })();
        } else {
            $('.drawmode-vr').hide();
        }
    }
