
        var world, sphereBody;
        var dt = 1 / 60;

        var constraintDown = false;
        var camera, scene, renderer, gplane=false, clickMarker=false;
        var geometry, material, mesh, ballMaterial;
        var controls,time = Date.now();

        var jointBody, constrainedBody, mouseConstraint;

        var N = 1;
        var ballSize = 0.3;

        var container, camera, scene, renderer, projector;

        // To be synced
        var meshes=[], bodies=[];

        // Initialize Three.js
        if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

        initCannon();
        init();
        animate();

        function init() {

            projector = new THREE.Projector();

            container = document.createElement( 'div' );
            document.body.appendChild( container );

            // scene
            scene = new THREE.Scene();
            scene.fog = new THREE.Fog( 0x000000, 500, 10000 );

            // camera
            camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 0.01, 1000 );
            camera.position.set(7, 2, 0);
            camera.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI/2);
            scene.add(camera);

            // lights
            var light, materials;
            scene.add( new THREE.AmbientLight( 0x666666 ) );

            light = new THREE.DirectionalLight( 0xffffff, 1.75 );
            var d = 20;

            light.position.set( d, d, d );

            light.castShadow = true;
            //light.shadowCameraVisible = true;

            light.shadowMapWidth = 1024;
            light.shadowMapHeight = 1024;

            light.shadowCameraLeft = -d;
            light.shadowCameraRight = d;
            light.shadowCameraTop = d;
            light.shadowCameraBottom = -d;

            light.shadowCameraFar = 3*d;
            light.shadowCameraNear = d;
            light.shadowDarkness = 0.5;

            scene.add( light );

            // floor
            geometry = new THREE.PlaneGeometry( 100, 100, 1, 1 );
            //geometry.applyMatrix( new THREE.Matrix4().makeRotationX( -Math.PI / 2 ) );
            var texture = THREE.ImageUtils.loadTexture('images/grass.png');
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(5,5);
            material = new THREE.MeshBasicMaterial( {map:texture, side: THREE.DoubleSide} );
            markerMaterial = new THREE.MeshLambertMaterial( { color: 0xff0000 } );
            //THREE.ColorUtils.adjustHSV( material.color, 0, 0, 0.9 );
            mesh = new THREE.Mesh( geometry, material );
            mesh.castShadow = true;
            mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI / 2);
            mesh.receiveShadow = true;
            scene.add(mesh);
            // sphere
            var ballGeo = new THREE.SphereGeometry( ballSize, 20, 20 );
            ballMaterial = new THREE.MeshPhongMaterial( { color: 0x888888 } );
            ballMaterial.map = THREE.ImageUtils.loadTexture('images/ball.jpg');

            sphereMesh = new THREE.Mesh( ballGeo, ballMaterial );
            sphereMesh.castShadow = true;
            //sphereMesh.receiveShadow = true;
            meshes.push(sphereMesh);
            scene.add( sphereMesh );

            renderer = new THREE.WebGLRenderer( { antialias: true } );
            renderer.setSize( window.innerWidth, window.innerHeight );
            renderer.setClearColor( scene.fog.color );

            container.appendChild( renderer.domElement );

            renderer.gammaInput = true;
            renderer.gammaOutput = true;
            renderer.shadowMapEnabled = true;

            window.addEventListener( 'resize', onWindowResize, false );

            window.addEventListener("touchmove", onMouseMove, false );
            window.addEventListener("touchstart", onMouseDown, false );
            window.addEventListener("touchend", onMouseUp, false );
        }

        function setClickMarker(x,y,z) {
            if(!clickMarker){
                var shape = new THREE.SphereGeometry(0.2, 8, 8);
                clickMarker = new THREE.Mesh(shape, markerMaterial);
                scene.add(clickMarker);
            }
            clickMarker.visible = true;
            clickMarker.position.set(x,y,z);
        }

        function removeClickMarker(){
          clickMarker.visible = false;
        }

        function onMouseMove(e){
            e.preventDefault();
            e.stopPropagation();
            e = e.touches[0];
            // Move and project on the plane
            if (gplane && mouseConstraint) {
                var pos = projectOntoPlane(e.clientX,e.clientY,gplane,camera);
                if(pos){
                    setClickMarker(pos.x,pos.y,pos.z,scene);
                    moveJointToPoint(pos.x,pos.y,pos.z);
                }
            }
            return false;
        }

        function onMouseDown(e){
            e.preventDefault();
            e.stopPropagation();
            e = e.touches[0];
            // Find mesh from a ray
            var entity = findNearestIntersectingObject(e.clientX,e.clientY,camera,meshes);
            var pos = entity.point;
            if(pos && entity.object.geometry instanceof THREE.SphereGeometry){
                constraintDown = true;
                // Set marker on contact point
                setClickMarker(pos.x,pos.y,pos.z,scene);

                // Set the movement plane
                setScreenPerpCenter(pos,camera);

                var idx = meshes.indexOf(entity.object);
                if(idx !== -1){
                    addMouseConstraint(pos.x,pos.y,pos.z,bodies[idx]);
                }
            }
            return false;
        }

        // This function creates a virtual movement plane for the mouseJoint to move in
        function setScreenPerpCenter(point, camera) {
            // If it does not exist, create a new one
            if(!gplane) {
              var planeGeo = new THREE.PlaneGeometry(100,100);
              var plane = gplane = new THREE.Mesh(planeGeo,material);
              plane.visible = false; // Hide it..
              scene.add(gplane);
            }

            // Center at mouse position
            gplane.position.copy(point);

            // Make it face toward the camera
            gplane.quaternion.copy(camera.quaternion);
        }

        function onMouseUp(e) {
          constraintDown = false;
          // remove the marker
          removeClickMarker();

          // Send the remove mouse joint to server
          removeJointConstraint();

          var shootDirection = new THREE.Vector3();
          getShootDir(shootDirection);
          var v = sphereBody.velocity;
          v = Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z)*1.3;
          sphereBody.velocity.set(  shootDirection.x * v,
                                    shootDirection.y * v,
                                    shootDirection.z * v);
          return false;
        }

        var lastx,lasty,last;
        function projectOntoPlane(screenX,screenY,thePlane,camera) {
            var x = screenX;
            var y = screenY;
            var now = new Date().getTime();
            // project mouse to that plane
            var hit = findNearestIntersectingObject(screenX,screenY,camera,[thePlane]);
            lastx = x;
            lasty = y;
            last = now;
            if(hit)
                return hit.point;
            return false;
        }
        function findNearestIntersectingObject(clientX,clientY,camera,objects) {
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
        function getRayCasterFromScreenCoord (screenX, screenY, camera, projector) {
            var mouse3D = new THREE.Vector3();
            // Get 3D point form the client x y
            mouse3D.x = (screenX / window.innerWidth) * 2 - 1;
            mouse3D.y = -(screenY / window.innerHeight) * 2 + 1;
            mouse3D.z = 0.5;
            return projector.pickingRay(mouse3D, camera);
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            //controls.handleResize();
            renderer.setSize( window.innerWidth, window.innerHeight );
        }

        function animate() {
            requestAnimationFrame( animate );
            //controls.update();
            updatePhysics();
            render();
        }

        function updatePhysics(){
            world.step(dt);
            for(var i=0; i !== meshes.length; i++){
                meshes[i].position.copy(bodies[i].position);
                meshes[i].quaternion.copy(bodies[i].quaternion);
            }
        }

        function render() {
            renderer.render(scene, camera);
        }

        function initCannon(){
            // Setup our world
            world = new CANNON.World();
            world.quatNormalizeSkip = 0;
            world.quatNormalizeFast = false;

            world.gravity.set(0,-12,0);
            world.broadphase = new CANNON.NaiveBroadphase();
            world.defaultContactMaterial.restitution = 1;
            world.defaultContactMaterial.friction = 0;

            var mass = 5;
            // Create sphere
            var sphereShape = new CANNON.Sphere(ballSize);
            sphereBody = new CANNON.Body({
                mass: mass
            });
            sphereBody.addShape(sphereShape);
            sphereBody.position.set(0,0,0);
            sphereBody.addEventListener("collide",function(e){ console.log('collide') });
            sphereBody.angularVelocity.set(0,3,10);

            world.add(sphereBody);
            bodies.push(sphereBody);


            // Create a plane
            var groundShape = new CANNON.Plane();
            var groundBody = new CANNON.Body({ mass: 0 });
            groundBody.addShape(groundShape);
            groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
            world.add(groundBody);

            // Joint body
            var shape = new CANNON.Sphere(0.1);
            jointBody = new CANNON.Body({ mass: 0 });
            jointBody.addShape(shape);
            jointBody.collisionFilterGroup = 0;
            jointBody.collisionFilterMask = 0;
            world.add(jointBody)
        }

        function addMouseConstraint(x,y,z,body) {
          // The cannon body constrained by the mouse joint
          constrainedBody = body;

          // Vector to the clicked point, relative to the body
          var v1 = new CANNON.Vec3(x,y,z).vsub(constrainedBody.position);

          // Apply anti-quaternion to vector to tranform it into the local body coordinate system
          var antiRot = constrainedBody.quaternion.inverse();
          pivot = antiRot.vmult(v1); // pivot is not in local body coordinates

          // Move the cannon click marker particle to the click position
          jointBody.position.set(x,y,z);

          // Create a new constraint
          // The pivot for the jointBody is zero
          mouseConstraint = new CANNON.PointToPointConstraint(constrainedBody, pivot, jointBody, new CANNON.Vec3(0,0,0));

          // Add the constriant to world
          world.addConstraint(mouseConstraint);
        }

        // This functions moves the transparent joint body to a new postion in space
        function moveJointToPoint(x,y,z) {
            // Move the joint body to a new position
            jointBody.position.set(x,y,z);
            mouseConstraint.update();
        }

        function removeJointConstraint(){
          // Remove constriant from world
          world.removeConstraint(mouseConstraint);
          mouseConstraint = false;
        }

        function getShootDir(targetVec){
            var vector = targetVec;
            targetVec.set(0,0,1);
            projector.unprojectVector(vector, camera);
            var ray = new THREE.Ray(sphereBody.position, vector.sub(sphereBody.position).normalize() );
            targetVec.x = ray.direction.x;
            targetVec.y = ray.direction.y;
            targetVec.z = ray.direction.z;
        }
        
