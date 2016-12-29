
var VRDraw = function(div, opts){
    var animation_frame_id;
    var _size = {w: opts.width || window.innerWidth, h: opts.height || window.innerHeight};
    if(opts.dualmode) {
        _size.w /= 2;
    }
    var touch = opts.touch || false;
    opts.arrow_delay = opts.arrow_delay || 0;

    var that = this;
    var container, camera, scene, renderer, renderer2, controls, geometry, mesh, candidate_digit;

    var animate = that.animate = function(){
        if(that.states.is_active) {
            cancelAnimationFrame(animation_frame_id);
            animation_frame_id = requestAnimationFrame( animate );
        }
        controls.update();
        renderer.render(scene, camera);
        if(opts.dualmode) {
            renderer2.render(scene, camera);
        }
        var d = controls.object.getWorldDirection();
        var min_angle = 300, min_index = 0;
        that.states.y_pos = (that.states.y_pos+1)%20;
        var y_diff = (that.states.y_pos >= 10)?-0.01:0.01;
        that.gifts.forEach(function(gift, i){
            var angle = THREE.Math.radToDeg(gift.position.angleTo(d));
            gift.position.y+=y_diff;
            if(angle < min_angle) {
                min_angle = angle;
                min_index = i;
            }
        });
        if(min_angle<10) {
            if(!that.states.is_focusing){
                that.states.is_focusing = true;
                that.$focus.addClass('vr-focusing').data('min-index', min_index);
            }
        } else {
            if(that.states.is_focusing){
                that.states.is_focusing = false;
                that.$focus.removeClass('vr-focusing').data('min-index', null);
            }
        }
        var scale = ((1-Math.sin(min_angle/180*Math.PI/2))*3+0.2);
        if(scale != that.states.current_scale && that.gifts[min_index]) {
            that.states.current_scale = scale;
            var pos0 = that.getAlphaBeta(controls.object.getWorldDirection());
            var pos1 = that.getAlphaBeta(that.gifts[min_index].position);
            var new_pos = {alpha: pos1.alpha-pos0.alpha, beta: pos1.beta-pos0.beta};
            if(new_pos.alpha > 180) new_pos.alpha -= 360;
            if(new_pos.alpha < -180) new_pos.alpha += 360;
            if(new_pos.beta > 90) new_pos.beta -= 180;
            if(new_pos.beta < -90) new_pos.beta += 180;

            var rotate = THREE.Math.radToDeg(Math.atan2(new_pos.alpha, new_pos.beta)+controls.object.getWorldRotation().z);
            that.$focus.css('transform', 'scale('+scale+') rotate('+rotate+'deg)');
            if((new Date()).getTime() - that.states.arrow_time > opts.arrow_delay && !that.states.arrow_appear) {
                that.$focus.removeClass('vr-no-arrow');
                that.states.arrow_appear = true;
            }
            if((new Date()).getTime() - that.states.arrow_time < opts.arrow_delay && that.states.arrow_appear) {
                that.$focus.addClass('vr-no-arrow');
                that.states.arrow_appear = false;
            }
        }
    };
    that.candidate_digit = candidate_digit = "0123456789YZ";
    that.scene = scene = new THREE.Scene();
    that.$div = $(div).css({
        width: (opts.dualmode?_size.w*2:_size.w), height: _size.h
    });
    that.$main = that.$div.find('.vr-main');
    that.$digit_container = that.$div.find('.vr-digits');
    that.$digit = that.$digit_container.find('.vr-digit').detach().removeClass('tpl-data');
    that.states = {
        is_active: opts.is_active || false,
        is_focusing: false,
        current_scale: 0,
        y_pos: 0,
        checked_fullscreen: false,
        dualmode: opts.dualmode,
        arrow_time: 0,
        arrow_appear: false
    };
    that.gifts = [];
    that.gifts_done = [];
    that.num_textures = [];
    for(var i = 0; i < candidate_digit.length; i++) {
        that.num_textures.push(new THREE.TextureLoader().load( 'images/vr_num'+candidate_digit[i]+'.png' ));
    }
    that.gift_textures = [
        new THREE.TextureLoader().load( 'images/gift1.png' ),
        new THREE.TextureLoader().load( 'images/gift2.png' ),
        new THREE.TextureLoader().load( 'images/gift3.png' ),
        new THREE.TextureLoader().load( 'images/gift4.png' ),
        new THREE.TextureLoader().load( 'images/gift5.png' ),
        new THREE.TextureLoader().load( 'images/gift6.png' )
    ];

    container = div;
    camera = new THREE.PerspectiveCamera(75, _size.w / _size.h , 1, 1100);
    window.controls = that.controls = controls = new THREE.DeviceOrientationControls( camera, {
        onChange: opts.onChange,
        onChange_threshold: 10
    });

    var geometry = new THREE.SphereGeometry( 500, 160, 80 );
    geometry.scale( - 1, 1, 1 );
    var material = new THREE.MeshBasicMaterial( {
        map: new THREE.TextureLoader().load( 'images/360.jpg' )
    } );
    var mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );

/*
var d = controls.object.getWorldDirection();
d.multiplyScalar(10);
mesh.position.copy(d);
mesh.quaternion.copy(controls.object.getWorldQuaternion())

*/

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(_size.w, _size.h);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = 0;
    if(opts.dualmode) {
        renderer2 = new THREE.WebGLRenderer();
        renderer2.setPixelRatio( window.devicePixelRatio );
        renderer2.setSize(_size.w, _size.h);
        renderer2.domElement.style.position = 'absolute';
        renderer2.domElement.style.top = 0;

        that.$main.addClass('vr-dual');
        that.$main.clone().appendTo(that.$div);
        that.$main = that.$div.find('.vr-dual');
        that.$main.eq(0).addClass('vr-dual-left').append(renderer.domElement);
        that.$main.eq(1).addClass('vr-dual-right').append(renderer2.domElement);

        that.$digit_container.clone().appendTo(that.$main.eq(1));
        that.$digit_container = that.$div.find('.vr-digits');
    } else {
        that.$main.append(renderer.domElement);
    }
    that.$main.css({
        width: _size.w, height: _size.h
    });
    that.$focus = that.$div.find('.vr-focus');
    that.$focus.eq(0).bind('animationend', function(){
        if(that.states.is_active) {
            var index = $(this).data('min-index');
            var gift = that.gifts[index];
            if(candidate_digit.indexOf(gift.digit)!=-1){
                gift.material.map = that.num_textures[candidate_digit.toLowerCase().indexOf(gift.digit.toLowerCase())];
            } else {
                alert('不存在的號碼 "'+digit+'"');
                scene.remove(gift);
            }
            gift.$digit.addClass('active animated bounceInUp').text(gift.digit);
            that.gifts_done.push.apply(that.gifts_done, that.gifts.splice(index, 1));
            if(that.$digit_container.eq(0).children().length == that.$digit_container.eq(0).find('.active').length) {
                that.$div.addClass('vr-cleared').trigger('allclear');
            }
            that.states.arrow_time = (new Date()).getTime();
        }
    });
    if(opts.fullscreen) {
        window.addEventListener('resize', function() {
            var w = (opts.dualmode)?(window.innerWidth/2):(window.innerWidth);
            var h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            if(opts.dualmode) {
                renderer2.setSize(w, h);
            }
            that.$div.css({
                width: window.innerWidth,
                height: h
            });
            that.$main.css({
                width: w,
                height: h
            });
        }, false);
    }
    if(opts.debug) {
        window.addEventListener('keydown', function(e){
            //console.log(e.keyCode);
            switch(e.keyCode) {
            case 32:
                window.p = that.putGift();
                break;
            case 70:
                window.p.position.multiplyScalar(1.01);
                break;
            case 86:
                window.p.position.multiplyScalar(0.99);
                break;
            }
        });
    }
    var toggleFullscreen = function(){
        if(document.webkitIsFullScreen) {
            document.webkitExitFullscreen();
            screen.orientation.unlock();
        } else {
            document.body.webkitRequestFullscreen();
            screen.orientation.lock('landscape');
        }
    };
    var viewHandler = (function(){
        var x0, y0, alpha0 = null, beta0 = null;
        return {
            mousedown: function(e){
                if(e.touches && !that.states.checked_fullscreen && !document.webkitIsFullScreen) {
                    that.states.checked_fullscreen = true;
                    toggleFullscreen();
                }
                if(e.touches && e.touches.length == 4) {
                    toggleFullscreen();
                }
                if(!touch) {
                    e = e.touches && e.touches[0] || e;
                    x0 = e.clientX; y0 = e.clientY;
                    alpha0 = controls.deviceOrientation.alpha;
                    beta0 = controls.deviceOrientation.beta;
                    controls.deviceOrientation.gamma = 0;
                }
            },
            mousemove: function(e){
                e = e.touches && e.touches[0] || e;
                if(alpha0 !== null && beta0 != null) {
                    var x = e.clientX, y = e.clientY;
                    that.setEuler(alpha0 + ((x - x0) / window.innerWidth)*360, beta0 + ((y - y0) / window.innerWidth)*180, 0);
                    opts.onChange && opts.onChange.apply(controls, [controls.deviceOrientation]);
                    //controls.deviceOrientation.beta = beta0;
                    /*
                    console.clear();
                    if(window.onRotate) {
                        window.onRotate();
                    }
                    */
                }
            },
            mouseup: function(e){
                alpha0 = beta0 = null;
            }
        };
    })();
    if(touch) {
        that.$div[0].addEventListener('touchstart', viewHandler.mousedown, false);
        that.$div[0].addEventListener('touchmove', viewHandler.mousemove, false);
        that.$div[0].addEventListener('touchend', viewHandler.mouseup, false);
    } else {
        that.$div[0].addEventListener('mousedown', viewHandler.mousedown, false);
        that.$div[0].addEventListener('mousemove', viewHandler.mousemove, false);
        that.$div[0].addEventListener('mouseup', viewHandler.mouseup, false);
    }
    animate();
};
VRDraw.prototype = {
    constructor: VRDraw,
    setEuler: function(alpha, beta, gamma){
        var that = this;
        var controls = that.controls;
        controls.deviceOrientation.alpha = alpha;
        controls.deviceOrientation.beta = beta;
        controls.deviceOrientation.gamma = gamma;
    },
    _giftFaceTo: function(gift, d){
        //http://stackoverflow.com/questions/32849600/direction-vector-to-a-rotation-three-js
        var d2 = d.clone().multiplyScalar(-1);
        var mx = new THREE.Matrix4().lookAt(d2,new THREE.Vector3(0,0,0),new THREE.Vector3(0,1,0));
        var qt = new THREE.Quaternion().setFromRotationMatrix(mx);
        gift.quaternion.copy(qt);
    },
    putGift: function(d, digit) {
        var that = this;
        var scene = that.scene, controls = that.controls;
        var w = 1, h = 1;
        var material = new THREE.MeshBasicMaterial({
            map: that.gift_textures[that.gifts.length%6],
            side: THREE.DoubleSide,
            transparent: true
        });
        var plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
        if(!d) {
            d = controls.object.getWorldDirection();
            d.multiplyScalar(Math.random()*5+3);
        }
        plane.position.copy(d);
        that._giftFaceTo(plane, d);

        scene.add(plane);
        plane.digit = digit;
        plane.$digit = that.$digit.clone().appendTo(that.$digit_container);
        that.gifts.push(plane);
        return plane;
    },
    putRandomGift: function(digit){
        var that = this;
        var candidate_digit = that.candidate_digit;
        if(!digit) {
            digit = candidate_digit[parseInt(candidate_digit.length*Math.random())];
        }
        var v = new THREE.Vector3(1,0,0);
        v.applyAxisAngle(new THREE.Vector3(0,0,1), (Math.random()*0.6-0.3)*Math.PI);
        v.applyAxisAngle(new THREE.Vector3(0,1,0), Math.random()*Math.PI*2);
        v.multiplyScalar(Math.random()*5+3);

        var p = that.putGift(v, digit);

        var pos = p.position;
        while(true) {
            var min_distance = 100000, min_angle = 10000;
            that.gifts.forEach(function(gift){
                if(gift != p) {
                    var distance = p.position.distanceTo(gift.position);
                    if(distance < min_distance) {
                        min_distance = distance;
                    }
                    var angle = THREE.Math.radToDeg(gift.position.angleTo(p.position));
                    if(angle < min_angle) {
                        min_angle = angle;
                    }
                }
            });
            if(min_distance < 4 || min_angle < 20) {
                console.log(min_distance, '太近了，重跑', min_angle);
                var v = new THREE.Vector3(1,0,0);
                v.applyAxisAngle(new THREE.Vector3(0,0,1), (Math.random()*0.6-0.3)*Math.PI);
                v.applyAxisAngle(new THREE.Vector3(0,1,0), Math.random()*Math.PI*2);
                v.multiplyScalar(Math.random()*5+3);
                pos = v;
                p.position.copy(pos);
                that._giftFaceTo(p, pos);
            } else {
                console.log(min_distance, '距離剛好', min_angle);
                break;
            }
        }
        return p;
    },
    setGiftsByPos: function(pos_array){
        var that = this;
        pos_array.forEach(function(pos){
            that.putGift(new THREE.Vector3(pos.x, pos.y, pos.z), pos.digit);
        });
    },
    getGiftsPos: function(){
        var that = this;
        return that.gifts.map(function (g) {
            var pos = g.position;
            return {
                digit: g.digit,
                x: pos.x,
                y: pos.y,
                z: pos.z
            }
        });
    },
    getAlphaBeta: function (p) {
        p = p.clone().normalize();
        //給定一個 vector 回傳指向此 vector 的 alpha / beta 角 並以 deg 表示
        // alpha 在 [-180, 180] 間
        // beta 在 [-90, 90] 間
        if(p.y == -1 || p.y == 1) {
            return {
                alpha: 0,
                beta: 90*p.y
            }
        }
        var beta = Math.asin(p.y);
        var alpha = Math.asin(p.z / Math.cos(beta));
        var alpha2 = Math.acos(p.x / Math.cos(beta));
        var d1 = Math.abs(alpha - alpha2);
        var d2 = Math.abs(alpha - ( - alpha2));
        var d3 = Math.abs(Math.PI - alpha - alpha2);
        var d4 = Math.abs(Math.PI - alpha - (-alpha2+Math.PI*2));
        if (d1 <= d2 && d1 <= d3 && d1 <= d4) {
            alpha = alpha;
        } else if (d2 <= d1 && d2 <= d3 && d2 <= d4) {
        alpha =  alpha;
        } else if (d3 <= d1 && d3 <= d2 && d3 <= d4) {
        alpha = alpha2;
        } else if (d4 <= d1 && d4 <= d2 && d4 <= d3) {
            alpha = Math.PI - alpha;
        }
        if(alpha > Math.PI) {
            alpha -= Math.PI*2;
        }
        return {
            alpha: THREE.Math.radToDeg(alpha),
            beta: THREE.Math.radToDeg(beta)
        }
    },
    setActive: function(is_active){
        var that = this;
        if(is_active != that.states.is_active) {
            that.states.is_active = is_active;
            if(is_active) {
                that.animate();
            }
        }
    },
    resetAll: function(){
        var that = this;
        var scene = that.scene;
        var removeGift = function(gift){
            gift.$digit.remove();
            scene.remove(gift);
        };
        that.setEuler(0, 90, 0);
        that.gifts.forEach(removeGift);
        that.gifts_done.forEach(removeGift);
        that.gifts = [];
        that.gifts_done = [];
        that.$div.removeClass('vr-cleared');
        that.$focus.attr('style', null).removeClass('vr-focusing').data('min-index', null);
        that.$digit_container.empty();
        that.states.is_focusing = false;
        that.states.current_scale = 0;
        that.setActive(false);
    },
    _worldReset: function(){
        var that = this;
        var world = that.world;
        world.defaultContactMaterial.restitution = 1;
        world.defaultContactMaterial.friction = 0;
        world.gravity.y = - 10;
    },
    _ballReset: function(){
        var that = this;
        var sphereBody = that.sphereBody;
        sphereBody.velocity.set(0, 0, 0);
        sphereBody.angularVelocity.set(0, 3, 10);
        sphereBody.position.set(0, 3, 0);
        sphereBody.quaternion.set(0, 0, 0, 1);
    },
    _statesReset: function(){
        var that = this;
        var states = that.states;
        states.collision = false;
        states.gotcha = false;
        states.throwed = false;
        states.start_collision = false;
    },
    resetBall: function(){
        var that = this;
        that._worldReset();
        that._statesReset();
        that._ballReset();
    },
    setPokemon: function(pokemon_id){
        var that = this;
        var pokemon_texture = that.pokemon_texture;
        if(pokemon_id === undefined) {
            pokemon_id = parseInt(Math.random()*pokemon_texture.length, 10);
        }
        if(pokemon_id != that.current_pokemon_id && pokemon_texture[pokemon_id]) {
            that.$div.attr('data-pokemon-id', pokemon_id);
            that.current_pokemon_id = pokemon_id;
            that.pokemon.material.map = pokemon_texture[that.current_pokemon_id].normal;
        }
    }
};
/*
$(function(){
    $('.drawmode-vr').bind('allclear', function(){
        setTimeout(function(){
            vrDraw.resetAll();
        }, 5000);
    });
    if(false) {
        window.vrDraw = new VRDraw($('.drawmode-vr')[0], {
            fullscreen: true, dualmode: true, arrow_delay: 2000,
            onChange: function(orient) {
                console.log(orient.alpha, orient.beta, orient.gamma, (new Date()).getTime());
            }
        });
    } else {
        var vrDraw = window.vrDraw = new VRDraw($('.drawmode-vr')[0], {width: 1024, height: 608});
    }
    
    for(var i = 0; i < 6; i++) {
        vrDraw.putRandomGift();
    }
    vrDraw.setActive(true);
});
*/
