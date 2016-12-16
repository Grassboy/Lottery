var PokemonGo = function(div, opts){
    var _size = {w: 1024, h: 608};
    var world, sphereBody, cylinderBody, pokemon, ball, pokemon_texture, ball_texture;
    var dt = 1 / 60;
    var touch = (location.href.indexOf('touch') != - 1 ? true: false);
    var camera, scene, renderer, gplane = false, container, projector;
    var geometry, material, mesh, ballMaterial;
    var controls;
    var jointBody, constrainedBody, mouseConstraint;
    var ballSize = 0.6;
    var states = {
        is_active: opts.is_active || false,
        cylinder_mode: false,
        start_collision: false,
        collision: false,
        gotcha: false,
        throwed: false,
        constraintDown: false
    };
    var $ball_boom, $div;
    // To be synced
    var meshes = [], bodies = [];

    var that = this;
    that.$div = $div = $(div);
    that.pokemon_texture = pokemon_texture = [];
    that.ball_texture = ball_texture = [];
    that.current_pokemon_id = that.current_ball_id = 0;
    that.states = states;

    // Initialize Three.js
    if (!Detector.webgl) Detector.addGetWebGLMessage();

    function init() {

        projector = new THREE.Projector();

        container = document.createElement('div');
        $div.append(container);
        $(container).attr('id', 'pokemon');

        // scene
        scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0xFF8300, 500, 10000);

        // camera
        that.camera = camera = new THREE.PerspectiveCamera(20, _size.w / _size.h, 0.01, 1000);
        camera.position.set(10, 10, 0);
        camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        scene.add(camera);

        // lights
        var light, materials;
        scene.add(new THREE.AmbientLight(0x666666));

        light = new THREE.DirectionalLight(0xffffff, 1.75);
        var d = 20;

        light.position.set(d, d, d);

        light.castShadow = true;
        //light.shadowCameraVisible = true;
        light.shadowMapWidth = 1024;
        light.shadowMapHeight = 1024;

        light.shadowCameraLeft = - d;
        light.shadowCameraRight = d;
        light.shadowCameraTop = d;
        light.shadowCameraBottom = - d;

        light.shadowCameraFar = 3 * d;
        light.shadowCameraNear = d;
        light.shadowDarkness = 0.5;

        scene.add(light);

        // floor
        geometry = new THREE.PlaneGeometry(200, 200, 5, 5);
        //geometry.applyMatrix( new THREE.Matrix4().makeRotationX( -Math.PI / 2 ) );
        var texture = THREE.ImageUtils.loadTexture('images/grass.png');
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(5, 5);
        material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide
        });
        markerMaterial = new THREE.MeshLambertMaterial({
            color: 0xff0000
        });
        //THREE.ColorUtils.adjustHSV( material.color, 0, 0, 0.9 );
        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), - Math.PI / 2);
        mesh.receiveShadow = true;
        scene.add(mesh);
        // sphere
        ballGeo = new THREE.SphereGeometry(ballSize, 20, 20);
        ballMaterial = new THREE.MeshPhongMaterial({
            color: 0x888888
        });
        opts.ball.forEach(function(d){
            ball_texture.push( THREE.ImageUtils.loadTexture('images/'+d) );
        });
        ballMaterial.map = ball_texture[that.current_ball_id];

        sphereMesh = new THREE.Mesh(ballGeo, ballMaterial);
        sphereMesh.castShadow = true;
        //sphereMesh.receiveShadow = true;
        that.ball = ball = sphereMesh;
        meshes.push(sphereMesh);
        scene.add(sphereMesh);

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        renderer.setSize(_size.w, _size.h);
        //renderer.setClearColor( 0xffffff, 0 );
        renderer.setClearColor(0x000000, 0); // the default
        container.appendChild(renderer.domElement);

        renderer.gammaInput = true;
        renderer.gammaOutput = true;
        renderer.shadowMapEnabled = true;

        (function(scene) {
            var material;
            var f = 0.04, w = 100 * f, h = 116 * f;
            opts.pokemon.forEach(function(d){
                pokemon_texture.push({
                    normal: THREE.ImageUtils.loadTexture("images/"+d.normal),
                    hit: THREE.ImageUtils.loadTexture("images/"+d.hit)
                });
            });
            material = new THREE.MeshBasicMaterial({
                map: pokemon_texture[that.current_pokemon_id].normal,
                side: THREE.DoubleSide,
                transparent: true
            });
            plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
            plane.doubleSided = true;
            plane.position.set( - 15, h / 2, 0); // Not sure what this number represents.
            plane.rotation.set(0, Math.PI / 2, 0); // Not sure what this number represents.
            if (states.cylinder_mode) {
                var cylinder = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h, 18, 3), markerMaterial);
                scene.add(cylinder);
                that.pokemon = pokemon = cylinder;
                meshes.push(cylinder);
            } else {
                scene.add(plane);
                that.pokemon = pokemon = plane;
                meshes.push(plane);
            }
            var cylinderShape = new CANNON.Cylinder(w / 2, w / 2, h, 20);
            var mat = new CANNON.Material();
            var mat_g = new CANNON.ContactMaterial(groundBody.material, mat, {
                friction: 3,
                restitution: 0.5
            });
            that.cylinderBody = cylinderBody = new CANNON.Body({
                mass: 5,
                material: mat
            });
            cylinderBody.addShape(cylinderShape);
            cylinderBody.position.set( - 15, h / 2 + 10, 0);
            cylinderBody.addEventListener("collide", function(e) {
                if (e.body.index == 0) {
                    pokemon.material.map = pokemon_texture[that.current_pokemon_id].hit;
                    if(!states.start_collision) {
                        states.start_collision = true;
                        setTimeout(function() {
                            states.collision = true;
                        },
                        1000);
                        setTimeout(function() {
                            states.gotcha = true;
                            var pos = get2DPos(ball.position, camera, renderer.domElement);
                            ball.visible = false;
                            $ball_boom.show().offset({left: pos.x, top: pos.y}).toggleClass('animation_toggle');
                        },
                        2000);
                    }
                }
            });
            world.addContactMaterial(mat_g);
            world.add(cylinderBody);
            bodies.push(cylinderBody);
        })(scene);

        if (touch) {
            container.addEventListener("touchmove", onMouseMove, false);
            container.addEventListener("touchstart", onMouseDown, false);
            container.addEventListener("touchend", onMouseUp, false);
        } else {
            container.addEventListener("mousemove", onMouseMove, false);
            container.addEventListener("mousedown", onMouseDown, false);
            container.addEventListener("mouseup", onMouseUp, false);
            /*
            var container2 = $('.toucharea')[0];
            container2.addEventListener("mousemove", fakeTouchHandler.move, false);
            container2.addEventListener("mousedown", fakeTouchHandler.down, false);
            container2.addEventListener("mouseup", fakeTouchHandler.up, false);
            */
        }
        //controls = new THREE.OrbitControls(camera, renderer.domElement);
    }


    var handler = {
        mousedown: function(x, y) {
            // Find mesh from a ray
            var entity = findNearestIntersectingObject(x, y, camera, meshes);
            var pos = entity.point;
            if (pos && entity.object.geometry instanceof THREE.SphereGeometry) {
                states.constraintDown = true;

                // Set the movement plane
                setScreenPerpCenter(pos, camera);

                var idx = meshes.indexOf(entity.object);
                if (idx !== - 1) {
                    addMouseConstraint(pos.x, pos.y, pos.z, bodies[idx]);
                }
            }
        },
        mousemove: function(x, y) {
            // Move and project on the plane
            if (gplane && mouseConstraint) {
                var pos = projectOntoPlane(x, y, gplane, camera);
                if (pos) {
                    moveJointToPoint(pos.x, pos.y, pos.z);
                }
            }
        },
        mouseup: function() {
            if (gplane && mouseConstraint) {
                states.constraintDown = false;
                states.throwed = true;
                //world.gravity.y = -20;

                // Send the remove mouse joint to server
                removeJointConstraint();

                var shootDirection = new THREE.Vector3();
                var v = sphereBody.velocity;
                getShootDir(shootDirection, v);
                v = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) * 1.3;
                v = (v > 10 ? 10: v) * 5;
                //console.log(shootDirection.y * v / 4);
                sphereBody.velocity.set(
                shootDirection.x * v, (shootDirection.y * v / 4) > 6 ? 6: (shootDirection.y * v / 4), shootDirection.z * v * 3);
                //console.log(sphereBody.velocity.y);
                world.defaultContactMaterial.restitution = 0.9;
            }
        }
    };
    function onMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();
        e = e.touches && e.touches[0] || e;
        var offset = $('#pokemon').offset();
        handler.mousedown(e.clientX - offset.left, e.clientY - offset.top);
        return false;
    }
    function onMouseMove(e) {
        e.preventDefault();
        e.stopPropagation();
        e = e.touches && e.touches[0] || e;
        var offset = $('#pokemon').offset();
        handler.mousemove(e.clientX - offset.left, e.clientY - offset.top);
        return false;
    }

    function onMouseUp(e) {
        handler.mouseup();
        return false;
    }
    that.fakeTouchHandler = (function() {
        var x0, y0;
        return {
            down: function(e) {
                e.preventDefault && e.preventDefault();
                e.stopPropagation && e.stopPropagation();
                e = e.touches && e.touches[0] || e;
                var offset = $('#pokemon').offset();
                var pos_self = {
                    x: e.clientX,
                    y: e.clientY
                };
                var pos0 = get2DPos(meshes[0].position, camera, renderer.domElement);
                x0 = pos0.x - pos_self.x;
                y0 = pos0.y - pos_self.y;
                handler.mousedown(pos_self.x + x0 - offset.left, pos_self.y + y0 - offset.top);
                return false;
            },
            move: function(e) {
                e.preventDefault && e.preventDefault();
                e.stopPropagation && e.stopPropagation();
                e = e.touches && e.touches[0] || e;
                var offset = $('#pokemon').offset();
                var pos_self = {
                    x: e.clientX,
                    y: e.clientY
                };
                handler.mousemove(pos_self.x + x0 - offset.left, pos_self.y + y0 - offset.top);
                return false;
            },
            up: function() {
                x0 = y0 = 0;
                handler.mouseup();
                return false;
            }
        };
    })();

    // This function creates a virtual movement plane for the mouseJoint to move in
    function setScreenPerpCenter(point, camera) {
        // If it does not exist, create a new one
        if (!gplane) {
            var planeGeo = new THREE.PlaneGeometry(100, 100);
            var plane = gplane = new THREE.Mesh(planeGeo, material);
            plane.visible = false; // Hide it..
            scene.add(gplane);
        }

        // Center at mouse position
        gplane.position.copy(point);

        // Make it face toward the camera
        gplane.quaternion.copy(camera.quaternion);
    }

    var lastx, lasty, last;
    function projectOntoPlane(screenX, screenY, thePlane, camera) {
        var x = screenX;
        var y = screenY;
        var now = new Date().getTime();
        // project mouse to that plane
        var hit = findNearestIntersectingObject(screenX, screenY, camera, [thePlane]);
        lastx = x;
        lasty = y;
        last = now;
        if (hit) return hit.point;
        return false;
    }
    function findNearestIntersectingObject(clientX, clientY, camera, objects) {
        // Get the picking ray from the point
        var raycaster = getRayCasterFromScreenCoord(clientX, clientY, camera, projector);

        // Find the closest intersecting object
        // Now, cast the ray all render objects in the scene to see if they collide. Take the closest one.
        var hits = raycaster.intersectObjects(objects);
        var closest = false;
        if (hits.length > 0) {
            closest = hits[0];
        }

        return closest;
    }

    // Function that returns a raycaster to use to find intersecting objects
    // in a scene given screen pos and a camera, and a projector
    function getRayCasterFromScreenCoord(screenX, screenY, camera, projector) {
        var mouse3D = new THREE.Vector3();
        // Get 3D point form the client x y
        mouse3D.x = (screenX / _size.w) * 2 - 1;
        mouse3D.y = - (screenY / _size.h) * 2 + 1;
        mouse3D.z = 0.5;
        return projector.pickingRay(mouse3D, camera);
    }

    that.animate = function() {
        if (states.is_active) requestAnimationFrame(that.animate);
        if (!states.gotcha) {
            if (camera.position.y > 2) camera.position.y -= 0.1;
            //controls.update();
            updatePhysics();
            render();
        } else {
            if ((Math.abs(ball.position.x - pokemon.position.x) + Math.abs(ball.position.y - pokemon.position.y) + Math.abs(ball.position.z - pokemon.position.z)) > 0.0001) {
                pokemon.position.x += (ball.position.x - pokemon.position.x) * 0.12;
                pokemon.position.y += (ball.position.y - pokemon.position.y) * 0.12;
                pokemon.position.z += (ball.position.z - pokemon.position.z) * 0.12;
            }
            if (pokemon.scale.x > 0.0001) {
                pokemon.scale.x *= 0.90;
                pokemon.scale.y *= 0.90;
                pokemon.scale.z *= 0.90;
            }
            render();
        }
    };

    function updatePhysics() {
        world.step(dt);
        for (var i = 0; i !== meshes.length; i++) {
            meshes[i].position.copy(bodies[i].position);
            if (!states.cylinder_mode && i == 1){
                meshes[i].position.y += 0.2;
            }
            if (states.cylinder_mode || i < 1){
                meshes[i].quaternion.copy(bodies[i].quaternion);
            }
            if (states.collision) {
                if (world.gravity.y > - 100) world.gravity.y -= 1;
            }
        }
    }

    function render() {
        renderer.render(scene, camera);
    }

    function initCannon() {
        // Setup our world
        that.world = world = new CANNON.World();
        world.quatNormalizeSkip = 0;
        world.quatNormalizeFast = false;

        world.gravity.set(0, - 10, 0);
        world.broadphase = new CANNON.NaiveBroadphase();
        world.defaultContactMaterial.restitution = 1;
        world.defaultContactMaterial.friction = 0;

        var mass = 5;
        // Create sphere
        var sphereShape = new CANNON.Sphere(ballSize);
        that.sphereBody = sphereBody = new CANNON.Body({
            mass: mass
        });
        sphereBody.addShape(sphereShape);
        sphereBody.position.set(0, 3, 0);
        sphereBody.addEventListener("collide", function(e) {
            if (states.throwed) {
                world.gravity.set(0, - 60, 0);
                sphereBody.velocity.x *= 0.9;
                sphereBody.velocity.y *= 0.9;
                sphereBody.velocity.z *= 0.9;
                sphereBody.angularVelocity.x *= 0.6;
                sphereBody.angularVelocity.y *= 0.6;
                sphereBody.angularVelocity.z *= 0.6;
            }
        });
        sphereBody.angularVelocity.set(0, 3, 10);

        world.add(sphereBody);
        bodies.push(sphereBody);

        // Create a plane
        var groundShape = new CANNON.Plane();
        groundBody = new CANNON.Body({
            mass: 0,
            material: new CANNON.Material()
        });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), - Math.PI / 2);
        world.add(groundBody);

        // Joint body
        var shape = new CANNON.Sphere(0.1);
        jointBody = new CANNON.Body({
            mass: 0
        });
        jointBody.addShape(shape);
        jointBody.collisionFilterGroup = 0;
        jointBody.collisionFilterMask = 0;
        world.add(jointBody)
    }

    function addMouseConstraint(x, y, z, body) {
        // The cannon body constrained by the mouse joint
        constrainedBody = body;

        // Vector to the clicked point, relative to the body
        var v1 = new CANNON.Vec3(x, y, z).vsub(constrainedBody.position);

        // Apply anti-quaternion to vector to tranform it into the local body coordinate system
        var antiRot = constrainedBody.quaternion.inverse();
        pivot = antiRot.vmult(v1); // pivot is not in local body coordinates
        // Move the cannon click marker particle to the click position
        jointBody.position.set(x, y, z);

        // Create a new constraint
        // The pivot for the jointBody is zero
        if (mouseConstraint) {
            world.removeConstraint(mouseConstraint);
        }
        mouseConstraint = new CANNON.PointToPointConstraint(constrainedBody, pivot, jointBody, new CANNON.Vec3(0, 0, 0));

        // Add the constriant to world
        world.addConstraint(mouseConstraint);
    }

    // This functions moves the transparent joint body to a new postion in space
    function moveJointToPoint(x, y, z) {
        // Move the joint body to a new position
        jointBody.position.set(x, y, z);
        mouseConstraint.update();
    }

    function removeJointConstraint() {
        // Remove constriant from world
        world.removeConstraint(mouseConstraint);
        mouseConstraint = false;
    }

    function getShootDir(targetVec, v) {
        var vector = targetVec;
        targetVec.set(0, v.y, 1);
        projector.unprojectVector(vector, camera);
        var ray = new THREE.Ray(sphereBody.position, vector.sub(sphereBody.position).normalize());
        targetVec.x = ray.direction.x;
        targetVec.y = ray.direction.y;
        targetVec.z = ray.direction.z;
    }
    function get2DPos(p, camera, div) {
        var pos = new THREE.Vector3(p.x, p.y, p.z);
        projScreenMat = new THREE.Matrix4();
        projScreenMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        pos.applyProjection(projScreenMat);
        var offset = findOffset(div);
        return {
            x: (pos.x + 1) * div.width / 2 + offset.left,
            y: ( - pos.y + 1) * div.height / 2 + offset.top
        };

    }
    function findOffset(element) {
        var pos = new Object();
        pos.left = pos.top = 0;
        if (element.offsetParent) {
            do {
                pos.left += element.offsetLeft;
                pos.top += element.offsetTop;
            } while (element = element.offsetParent);
        }
        return pos;
    }
    $(function() {
        $div.find('.reset-area').click(function(){
            that.resetBall();
            that.setBall();
        });
        $ball_boom = $div.find('.boom_outer').hide().bind('animationend', function(e){
                        e.stopPropagation();
                        $ball_boom.hide();
                        ball.visible = true;
                        pokemon.visible = false;
                        $div.trigger('gotcha');
                    });
        initCannon();
        init();
        that.animate();
    });
};
PokemonGo.prototype = {
    constructor: PokemonGo,
    setActive: function(is_active){
        var that = this;
        if(is_active != that.states.is_active) {
            that.states.is_active = is_active;
            if(is_active) {
                that.animate();
            }
        }
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
    resetAll: function(){
        var that = this;
        var camera = that.camera, pokemon = that.pokemon, pokemon_texture = that.pokemon_texture;
        var cylinderBody = that.cylinderBody;
        var f = 0.04, w = 100 * f, h = 116 * f;
        camera.position.y = 10;
        that._worldReset();
        that._statesReset();

        cylinderBody.velocity.set(0, 0, 0);
        cylinderBody.angularVelocity.set(0, 0, 0);
        cylinderBody.position.set( - 15, h / 2 + 10, 0);
        cylinderBody.quaternion.set(0, 0, 0, 1);
        pokemon.scale.set(1, 1, 1);
        pokemon.visible = true;
        pokemon.material.map = pokemon_texture[that.current_pokemon_id].normal;

        that._ballReset();
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
    },
    setBall: function(ball_id){
        var that = this;
        var ball_texture = that.ball_texture;
        if(ball_id === undefined) {
            ball_id = parseInt(Math.random()*ball_texture.length, 10);
        }
        if(ball_id != that.current_ball_id && ball_texture[ball_id]) {
            that.$div.attr('data-ball-id', ball_id);
            that.current_ball_id = ball_id;
            that.ball.material.map = ball_texture[that.current_ball_id];
        }
    }
};

