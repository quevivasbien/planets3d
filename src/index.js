import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

let textureLoader = new THREE.TextureLoader();

// variables for each of the planets in the scene:
let planetVars = [
    {
        radius: 2,
        texture: '../img/surface0.png',
        bumpmap: '../img/height0.png',
        pos: new THREE.Vector3(-5, 0, -5),
        mass: 1,
        orbit: 1,
        spin: 0.001
    },
    {
        radius: 1.5,
        texture: '../img/surface1.png',
        bumpmap: '../img/height1.png',
        pos: new THREE.Vector3(30, 0, -60),
        mass: 0.5,
        orbit: 1,
        spin: 0.002
    },
    {
        radius: 1,
        texture: '../img/surface2.png',
        bumpmap: '../img/height2.png',
        pos: new THREE.Vector3(-200, 0, -800),
        mass: 0.1,
        orbit: 1,
        spin: -0.0015
    }
];

// will store planet objects once initialized
let planets = [];

// variables related to speed and direction of camera "spaceship":

let cameraEuler = new THREE.Euler(0, 0, 0, 'XYZ');
let cameraDirection = new THREE.Vector3();

let linearThrust = 0.0001;  // how fast the camera spaceship can accelerate
let angularThrust = 0.0002;  // ditto, but for rotation
let G = 0.01;  // universal gravitational constant
let cameraMass = 0.00001;  // mass of the camera spaceship, used for gravity

let cameraVelocity = {
    forward: 0,
    linear: new THREE.Vector3(0, 0, 0),
    angular: new THREE.Vector3(0, 0, 0)
};

let keyPresses = {
    period: false,
    comma: false,
    w: false,
    a: false,
    s: false,
    d: false,
    q: false,
    e: false,
    space: false
};


// helper to create planets
function createSphere(radius=1, texture_src=null, bumpmap_src=null, specular_src=null) {
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const material = new THREE.MeshPhongMaterial();
    if (texture_src) {
        material.map = textureLoader.load(texture_src);
    }
    if (bumpmap_src) {
        let texture = textureLoader.load(bumpmap_src)
        material.bumpMap = texture;
        material.bumpScale = 0.05;
        material.displacementMap = texture;
        material.displacementScale = 0.05;
    }
    if (specular_src) {
        material.specularMap = textureLoader.load(specular_src);
        material.specularMap = new THREE.Color(0xffffff)
    }
	const sphere = new THREE.Mesh(geometry, material);
    return sphere;
}

// set up ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);


// create the sun
const sunGeometry = new THREE.SphereGeometry(10, 64, 64);
const sunMaterial = new THREE.MeshLambertMaterial({
    color: 0xf0df75,
    emissive: 0xf0df75,
    emissiveIntensity: 1
})
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(0, 0, -1000);
scene.add(sun);
const sunLight = new THREE.PointLight(0xffffff, 1, 0, 2);
sunLight.position.copy(sun.position);
scene.add(sunLight);
const textureFlare0 = textureLoader.load('../img/lensflare0.png');
const textureFlare3 = textureLoader.load('../img/lensflare3.png');
const sunLensflare = new Lensflare();
sunLensflare.addElement(new LensflareElement(textureFlare0, 300, 0, sunLight.color));
sunLensflare.addElement(new LensflareElement(textureFlare3, 70, 0.4));
sunLensflare.addElement(new LensflareElement(textureFlare3, 100, 0.6));
sunLight.add(sunLensflare);
let sunMass = 100;
let sunVel = new THREE.Vector3(0, 0, 0);

// initialize planets
let relative_pos = new THREE.Vector3();
let J = new THREE.Vector3(0, 1, 0);
for (let i = 0; i < planetVars.length; i++) {
    let vars = planetVars[i];
    const planet = createSphere(vars.radius, vars.texture,
                              vars.bumpmap, vars.specular);
    if (vars.vel == null && vars.orbit) {
        // compute velocity needed for circular orbit about the sun
        relative_pos.subVectors(planet.position, sun.position);
        let v = Math.sqrt(G * sunMass / relative_pos.length());
        let direction = relative_pos.cross(J).normalize();
        vars.vel = direction.multiplyScalar(v * vars.orbit);
    }
    planets.push(planet);
    scene.add(planet);
}
// set planet positions. for some reason this doesn't work in the main loop
for (let i = 0; i < planets.length; i++) {
    planets[i].position.copy(planetVars[i].pos);
}

// create starfield
// const starfieldGeometry = new THREE.SphereGeometry(500, 64, 64);
// const starfieldMaterial = new THREE.MeshBasicMaterial();
// starfieldMaterial.map = textureLoader.load('../img/starfield.png');
// starfieldMaterial.side = THREE.BackSide;
// const starfield = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
// scene.add(starfield);


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
    else if (event.key === " ") keyPresses.space = true;
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
    else if (event.key === " ") keyPresses.space = false;
});

// function for simulating gravity
let accelVec = new THREE.Vector3();  // helper vector to store intermediate accelerations
function gravityStep() {
    // calculate accelerations
    for (let i = 0; i < planets.length - 1; i++) {
        for (let j = i + 1; j < planets.length; j++) {
            let force = G * planetVars[i].mass * planetVars[j].mass / planets[i].position.distanceToSquared(planets[j].position);
            accelVec.subVectors(planets[j].position, planets[i].position).setLength(force / planetVars[i].mass);
            // adjust velocities
            planetVars[i].vel.add(accelVec);
            accelVec.multiplyScalar(planetVars[i].mass / planetVars[j].mass);
            planetVars[j].vel.sub(accelVec);
        }
    }
    // interact with sun and change positions
    for (let i = 0; i < planets.length; i++) {
        let force = G * planetVars[i].mass * sunMass / planets[i].position.distanceToSquared(sun.position);
        accelVec.subVectors(sun.position, planets[i].position).setLength(force / planetVars[i].mass);
        planetVars[i].vel.add(accelVec);
        accelVec.multiplyScalar(planetVars[i].mass / sunMass);
        sunVel.sub(accelVec);
        planets[i].position.add(planetVars[i].vel);
    }
    sun.position.add(sunVel);
    sunLight.position.copy(sun.position);
}

// function for rotating planets
function rotatePlanets() {
    for (let i = 0; i < planetVars.length; i++) {
        planets[i].rotation.y += planetVars[i].spin;
    }
}

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
    // account for gravity
    for (let i = 0; i < planets.length; i++) {
        let force = G * planetVars[i].mass * cameraMass / planets[i].position.distanceToSquared(camera.position);
        accelVec.subVectors(planets[i].position, camera.position).setLength(force / cameraMass);
        cameraVelocity.linear.add(accelVec);
        // (ignore effect of camera's gravity on planets)
    }
    let force = G * sunMass * cameraMass / sun.position.distanceToSquared(camera.position);
    accelVec.subVectors(sun.position, camera.position).setLength(force / cameraMass);
    cameraVelocity.linear.add(accelVec);
    // update angular velocity
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
    // space bar stabilizes craft
    if (keyPresses.space) {
        cameraVelocity.angular.x -= (0.01 * cameraVelocity.angular.x);
        cameraVelocity.angular.y -= (0.01 * cameraVelocity.angular.y);
        cameraVelocity.angular.z -= (0.01 * cameraVelocity.angular.z);
    }
    // update position and angle
    camera.position.add(cameraVelocity.linear);
    camera.rotation.y += cameraVelocity.angular.y;
    camera.rotation.x += cameraVelocity.angular.x;
    camera.rotation.z += cameraVelocity.angular.z;
    // cameraEuler.y += cameraVelocity.angular.y;
    // cameraEuler.x += cameraVelocity.angular.x;
    // cameraEuler.z += cameraVelocity.angular.z;
    // camera.quaternion.setFromEuler(cameraEuler);
    // make starfield follow camera
    // starfield.position.set(camera.position);
}

// Define animation loop

function animate() {
    requestAnimationFrame(animate);
    updateCamera();
    gravityStep();
    rotatePlanets();
    renderer.render(scene, camera);
}
animate();
