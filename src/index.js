import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

let textureLoader = new THREE.TextureLoader();

//

// variables related to speed and direction of camera "spaceship":

let cameraEuler = new THREE.Euler(0, 0, 0, 'XYZ');
let cameraDirection = new THREE.Vector3();

let linearThrust = 0.0001;
let angularThrust = 0.0001;

let cameraVelocity = {
    forward: 0,
    linear: new THREE.Vector3(0, 0, 0),
    angular: new THREE.Vector3(0, 0, 0)
}

let keyPresses = {
    period: false,
    comma: false,
    w: false,
    a: false,
    s: false,
    d: false,
    q: false,
    e: false
}


// functions for generating and displaying the world:

function createSphere(radius=1, texture_src=null, bumpmap_src=null, specular_src=null) {
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const material = new THREE.MeshPhongMaterial();
    if (texture_src) {
        material.map = textureLoader.load(texture_src);
    }
    if (bumpmap_src) {
        let texture = textureLoader.load(bumpmap_src)
        material.bumpMap = texture;
        material.bumpScale = 0.1;
        material.displacementMap = texture;
        material.displacementScale = 0.1;
    }
    if (specular_src) {
        material.specularMap = textureLoader.load(specular_src);
        material.specularMap = new THREE.Color(0xffffff)
    }
	const sphere = new THREE.Mesh(geometry, material);
    return sphere;
}

const planet = createSphere(2, '../img/earth.jpg', '../img/earth_bumpmap.jpg', '../img/earth_specular.jpg');
planet.position.z = -10;
scene.add(planet);


//
// const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
// scene.add(ambientLight);


// create the sun
const sunGeometry = new THREE.SphereGeometry(10, 64, 64);
const sunMaterial = new THREE.MeshLambertMaterial({
    color: 0xf0df75,
    emissive: 0xf0df75,
    emissiveIntensity: 1
})
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(0, 200, -1000);
scene.add(sun);
const sunLight = new THREE.PointLight(0xffffff, 3, 0, 2);
sunLight.position.set(0, 200, -1000);
scene.add(sunLight);
const textureFlare0 = textureLoader.load('../img/lensflare0.png');
const textureFlare3 = textureLoader.load('../img/lensflare3.png');
const sunLensflare = new Lensflare();
sunLensflare.addElement(new LensflareElement(textureFlare0, 300, 0, sunLight.color));
sunLensflare.addElement(new LensflareElement(textureFlare3, 100, 0.6));
sunLight.add(sunLensflare);

// create starfield
const starfieldGeometry = new THREE.SphereGeometry(90, 64, 64);
const starfieldMaterial = new THREE.MeshBasicMaterial();
starfieldMaterial.map = textureLoader.load('../img/starfield.png');
starfieldMaterial.side = THREE.BackSide;
const starfield = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
scene.add(starfield);


// Functions for controlling the camera "spaceship":

document.addEventListener("keydown", function onEvent(event) {
    if (event.key === ".") keyPresses.period = true;
    else if (event.key === ",") keyPresses.comma = true;
    else if (event.key === "w") keyPresses.w = true;
    else if (event.key === "a") keyPresses.a = true;
    else if (event.key === "s") keyPresses.s = true;
    else if (event.key === "d") keyPresses.d = true;
    else if (event.key === "q") keyPresses.q = true;
    else if (event.key === "e") keyPresses.e = true;
});

document.addEventListener("keyup", function onEvent(event) {
    if (event.key === ".") keyPresses.period = false;
    else if (event.key === ",") keyPresses.comma = false;
    else if (event.key === "w") keyPresses.w = false;
    else if (event.key === "a") keyPresses.a = false;
    else if (event.key === "s") keyPresses.s = false;
    else if (event.key === "d") keyPresses.d = false;
    else if (event.key === "q") keyPresses.q = false;
    else if (event.key === "e") keyPresses.e = false;
});

function updateCamera() {
    // update camera direction
    camera.getWorldDirection(cameraDirection);
    // update velocities
    if (keyPresses.period) {
        cameraVelocity.linear.addScaledVector(cameraDirection, linearThrust);
    }
    if (keyPresses.comma) {
        cameraVelocity.linear.addScaledVector(cameraDirection, -linearThrust);
    }
    if (keyPresses.d) {
        cameraVelocity.angular.y -= angularThrust;
    }
    if (keyPresses.a) {
        cameraVelocity.angular.y += angularThrust;
    }
    if (keyPresses.w) {
        cameraVelocity.angular.x += angularThrust;
    }
    if (keyPresses.s) {
        cameraVelocity.angular.x -= angularThrust;
    }
    if (keyPresses.e) {
        cameraVelocity.angular.z -= angularThrust;
    }
    if (keyPresses.q) {
        cameraVelocity.angular.z += angularThrust;
    }
    // update position and angle
    camera.position.add(cameraVelocity.linear);
    cameraEuler.y += cameraVelocity.angular.y;
    cameraEuler.x += cameraVelocity.angular.x;
    cameraEuler.z += cameraVelocity.angular.z;
    camera.quaternion.setFromEuler(cameraEuler);
    // make starfield follow camera
    starfield.position.set(camera.position);
}

// Define animation loop

function animate() {
    requestAnimationFrame(animate);
    updateCamera();
    planet.rotation.y += 0.001;
    renderer.render(scene, camera);
}
animate();
