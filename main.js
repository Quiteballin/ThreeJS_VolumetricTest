import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

//assets
import cloudBaseVert from './shaders/cloudBase.vert?raw'
import cloudBaseFrag from './shaders/cloudBase.frag?raw'
import cloudEdgeFrag from './shaders/cloudEdge.frag?raw'

let scene, renderer, camera, floor, orbitControls;
let group, followGroup, model, skeleton, mixer, timer;
let baseSphereCloud, edgeSphereCloud1, edgeSphereCloud2;
let actions;

const PI = Math.PI;
const PI90 = Math.PI / 2;

const controls = {

	key: [ 0, 0 ],
	ease: new THREE.Vector3(),
	position: new THREE.Vector3(),
	up: new THREE.Vector3( 0, 1, 0 ),
	rotate: new THREE.Quaternion(),
	current: 'Idle',
	fadeDuration: 0.5,
	runVelocity: 5,
	walkVelocity: 1.8,
	rotateSpeed: 0.05,
	floorDecale: 0,

};

//base cloud material
const cloudBaseMat = new THREE.ShaderMaterial( {
		transparent: true,
		depthWrite: false,
		side: THREE.DoubleSide,
		uniforms: {
			uOffset: {
				value: 0
				},
			uMaskPos: {
				value: new THREE.Vector3(0,0,0)
			},
			uTime: {
				value: 1.0
			}
		},
		vertexShader: cloudBaseVert,
		fragmentShader: cloudBaseFrag,
	} );

//first cloud edge material
const cloudEdge1Mat = new THREE.ShaderMaterial( {
		transparent: true,
		depthWrite: false,
		uniforms: {
			uOffset: {
				value: 0.03
				},
			uMaskPos: {
				value: new THREE.Vector3(0,0,0)
			},
			wispSize: {
				value: 0.25
			},
			wispSpeed: {
				value: .5
			},
			uTime: {
				value: 1.0
			}
		},
		vertexShader: cloudBaseVert,
		fragmentShader: cloudEdgeFrag,
	} );
	
//second cloud edge material
const cloudEdge2Mat = new THREE.ShaderMaterial( {
		transparent: true,
		depthWrite: false,
		side: THREE.DoubleSide,
		uniforms: {
			uOffset: {
				value: 0.06
				},
			uMaskPos: {
				value: new THREE.Vector3(0,0,0)
			},
			wispSize: {
				value: 0.5
			},
			wispSpeed: {
				value: 1
			},
			uTime: {
				value: 1.0
			}
		},
		vertexShader: cloudBaseVert,
		fragmentShader: cloudEdgeFrag,
	} );

init();

function init() {

	const container = document.getElementById( 'container' );

	//setup camera
	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 0, 2, - 5 );

	//setup tick loop
	timer = new THREE.Timer();
	timer.connect( document );


	//create scene
	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0.05,0.08,0.12 );
	//scene.fog = new THREE.Fog( 0x5e5d5d, 2, 20 );

	group = new THREE.Group();
	scene.add( group );

	followGroup = new THREE.Group();
	scene.add( followGroup );

	//create renderer
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( Tick );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 0.5;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	container.appendChild( renderer.domElement );

	//handle camera controls
	orbitControls = new OrbitControls( camera, renderer.domElement );
	orbitControls.target.set( 0, 1, 0 );
	orbitControls.enableDamping = true;
	orbitControls.enablePan = false;
	orbitControls.maxPolarAngle = PI90 - 0.05;
	orbitControls.update();

	// EVENTS
	window.addEventListener( 'resize', onWindowResize );
	document.addEventListener( 'keydown', onKeyDown );
	document.addEventListener( 'keyup', onKeyUp );


	//load HDR for soft lighting on Three objects
	new HDRLoader()
		.setPath('./resources/textures/' )
		.load( 'lobe.hdr', function ( texture ) {

			texture.mapping = THREE.EquirectangularReflectionMapping;
			scene.environment = texture;
			scene.environmentIntensity = 1.5;

			loadCharacter();
			addFloor();
			addCloudMesh();
		} );

}

//create floor
function addFloor() {

	const size = 10;
	const repeat = 4;

	const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

	const floorT = new THREE.TextureLoader().load( './resources/textures/FloorTile_BC.jpg' );
	floorT.colorSpace = THREE.SRGBColorSpace;
	floorT.repeat.set( repeat, repeat );
	floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
	floorT.anisotropy = maxAnisotropy;

	const floorN = new THREE.TextureLoader().load( './resources/textures/FloorTile_N.jpg' );
	floorN.repeat.set( repeat, repeat );
	floorN.wrapS = floorN.wrapT = THREE.RepeatWrapping;
	floorN.anisotropy = maxAnisotropy;

	const mat = new THREE.MeshStandardMaterial(
		{ map: floorT, normalMap: floorN,
		normalScale: new THREE.Vector2( 0.5, 0.5 ), color:  new THREE.Color(.8,.8,.8), depthWrite: false, roughness: 0.85 } );

	const g = new THREE.PlaneGeometry( size, size, 50, 50 );
	g.rotateX( - PI90 );

	floor = new THREE.Mesh( g, mat );
	floor.receiveShadow = true;
	scene.add( floor );

	controls.floorDecale = ( size / repeat ) * 4;
}

//create cloud
function addCloudMesh() {
	//base sphere geo
	const sphereGeo = new THREE.SphereGeometry(0.8);
	sphereGeo.translate(0,0,-0.65)
	sphereGeo.scale(1.5,1.5,.75);
	sphereGeo.rotateX(PI90);
	baseSphereCloud = new THREE.Mesh(sphereGeo, cloudBaseMat)
	baseSphereCloud.renderOrder = 1;
	//edge torus
	edgeSphereCloud1 = new THREE.Mesh(sphereGeo, cloudEdge1Mat)
	edgeSphereCloud1.renderOrder = 2;
	edgeSphereCloud2 = new THREE.Mesh(sphereGeo, cloudEdge2Mat)
	edgeSphereCloud2.renderOrder = 3;
	//adding toruses
	scene.add(baseSphereCloud, edgeSphereCloud1, edgeSphereCloud2);
}

//load character
function loadCharacter() {

	const loader = new GLTFLoader();
	loader.load( './resources/character.glb', function ( gltf ) {


		model = gltf.scene;
		group.add( model );
		model.rotation.y = PI/180;
		group.rotation.y = PI;

		model.traverse( function ( object ) {
			if ( object.isMesh ) {

					object.material.metalness = 1;
					object.material.roughness = 1;
					object.material.transparent = true;
					object.material.opacity = 1;
			}
		} );

		skeleton = new THREE.SkeletonHelper( model );
		skeleton.setColors( new THREE.Color(1,1,1), new THREE.Color( 0x00e0ff ) );
		skeleton.rotateX(90);
		skeleton.visible = false;
		scene.add( skeleton );

		const animations = gltf.animations;

		mixer = new THREE.AnimationMixer( model );

		actions = {
			Idle: mixer.clipAction( animations[ 0 ] ),
			Walk: mixer.clipAction( animations[ 3 ] ),
			Run: mixer.clipAction( animations[ 1 ] )
		};

		for ( const m in actions ) {

			actions[ m ].enabled = true;
			actions[ m ].setEffectiveTimeScale( 1 );
			if ( m !== 'Idle' ) actions[ m ].setEffectiveWeight( 0 );

		}

		actions.Idle.play();

		Tick();

	} );

}

//called every frame, updating the character animations and controls
function updateCharacter( delta ) {

	const fade = controls.fadeDuration;
	const key = controls.key;
	const up = controls.up;
	const ease = controls.ease;
	const rotate = controls.rotate;
	const position = controls.position;
	const azimuth = orbitControls.getAzimuthalAngle();

	const active = key[ 0 ] === 0 && key[ 1 ] === 0 ? false : true;
	const play = active ? ( key[ 2 ] ? 'Run' : 'Walk' ) : 'Idle';

	// change animation

	if ( controls.current != play ) {
		const current = actions[ play ];
		const old = actions[ controls.current ];
		controls.current = play;

		current.reset();
		current.weight = 1.0;
		current.stopFading();
		old.stopFading();
		// synchro if not idle
		if ( play !== 'Idle' ) current.time = old.time * ( current.getClip().duration / old.getClip().duration );
		old._scheduleFading( fade, old.getEffectiveWeight(), 0 );
		current._scheduleFading( fade, current.getEffectiveWeight(), 1 );
		current.play();
	}

	// move object

	if ( controls.current !== 'Idle' ) {

		// run/walk velocity
		const velocity = controls.current == 'Run' ? controls.runVelocity : controls.walkVelocity;

		// direction with key
		ease.set( key[ 1 ], 0, key[ 0 ] ).multiplyScalar( velocity * delta );

		// calculate camera direction
		const angle = unwrapRad( Math.atan2( ease.x, ease.z ) + azimuth );
		rotate.setFromAxisAngle( up, angle );

		// apply camera angle on ease
		controls.ease.applyAxisAngle( up, azimuth );

		position.add( ease );
		camera.position.add( ease );

		group.position.copy( position );
		group.quaternion.rotateTowards( rotate, controls.rotateSpeed );

		orbitControls.target.copy( position ).add( { x: 0, y: 1, z: 0 } );
		followGroup.position.copy( position );
	}

	if ( mixer ) mixer.update( delta );

	orbitControls.update();

}

function unwrapRad( r ) {

	return Math.atan2( Math.sin( r ), Math.cos( r ) );

}

function onKeyDown( event ) {

	const key = controls.key;
	switch ( event.code ) {

		case 'ArrowUp': case 'KeyW': case 'KeyZ': key[ 0 ] = - 1; break;
		case 'ArrowDown': case 'KeyS': key[ 0 ] = 1; break;
		case 'ArrowLeft': case 'KeyA': case 'KeyQ': key[ 1 ] = - 1; break;
		case 'ArrowRight': case 'KeyD': key[ 1 ] = 1; break;
		case 'ShiftLeft' : case 'ShiftRight' : key[ 2 ] = 1; break;
	}

}

function onKeyUp( event ) {

	const key = controls.key;
	switch ( event.code ) {

		case 'ArrowUp': case 'KeyW': case 'KeyZ': key[ 0 ] = key[ 0 ] < 0 ? 0 : key[ 0 ]; break;
		case 'ArrowDown': case 'KeyS': key[ 0 ] = key[ 0 ] > 0 ? 0 : key[ 0 ]; break;
		case 'ArrowLeft': case 'KeyA': case 'KeyQ': key[ 1 ] = key[ 1 ] < 0 ? 0 : key[ 1 ]; break;
		case 'ArrowRight': case 'KeyD': key[ 1 ] = key[ 1 ] > 0 ? 0 : key[ 1 ]; break;
		case 'ShiftLeft' : case 'ShiftRight' : key[ 2 ] = 0; break;

	}
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );

}

//Tick loop, called every frame
function Tick() {

	//handle time
	timer.update();
	const delta = timer.getDelta();

	//update character
	updateCharacter( delta );

	//update clouds
	cloudBaseMat.uniforms.uMaskPos.value.copy(controls.position);
	cloudEdge1Mat.uniforms.uMaskPos.value.copy(controls.position);
	cloudEdge2Mat.uniforms.uMaskPos.value.copy(controls.position);
	cloudBaseMat.uniforms.uTime.value = timer.getElapsed();
	cloudEdge1Mat.uniforms.uTime.value = timer.getElapsed();
	cloudEdge2Mat.uniforms.uTime.value = timer.getElapsed();


	renderer.render( scene, camera );
}