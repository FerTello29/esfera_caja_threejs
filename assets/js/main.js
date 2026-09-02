import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);
camera.position.set(9, 7, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ---- Controles de cámara ----
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

scene.add(new THREE.AmbientLight(0xffffff, 1.4));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5, 8, 6);
scene.add(light);

const boxSize = 10;
const radius = 0.5;
const limit = boxSize / 2 - radius;
const half = boxSize / 2;

const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x8fd3ff,
    transparent: true,
    opacity: 0.18,
    transmission: 0.9,
    roughness: 0.05,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false
});
const glassBox = new THREE.Mesh(boxGeometry, glassMaterial);
scene.add(glassBox);

const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(boxGeometry),
    new THREE.LineBasicMaterial({ color: 0xbfe8ff })
);
scene.add(edges);

const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.35 })
);
scene.add(sphere);

const velocity = new THREE.Vector3(0.035, 0.027, 0.041);

// ================= MARCAS DE IMPACTO =================
// Cada marca es un anillo que aparece en el punto de contacto
// y se desvanece poco a poco antes de desaparecer.

const marksGroup = new THREE.Group();
scene.add(marksGroup);

const MARK_LIFETIME = 800; // ms que dura visible la marca antes de esfumarse
const activeMarks = [];

const markGeometry = new THREE.RingGeometry(radius * 0.55, radius * 0.85, 32);

function spawnImpactMark(position, normal) {
    const material = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const mark = new THREE.Mesh(markGeometry, material);

    // Coloca el anillo justo sobre la cara tocada, pegado a la superficie.
    mark.position.copy(position).addScaledVector(normal, 0.01);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    marksGroup.add(mark);
    activeMarks.push({ mesh: mark, bornAt: performance.now() });
}

function updateImpactMarks() {
    const now = performance.now();

    for (let i = activeMarks.length - 1; i >= 0; i--) {
        const mark = activeMarks[i];
        const age = now - mark.bornAt;
        const t = age / MARK_LIFETIME;

        if (t >= 1) {
            marksGroup.remove(mark.mesh);
            mark.mesh.material.dispose();
            activeMarks.splice(i, 1);
            continue;
        }

        // Se desvanece y crece ligeramente mientras dura.
        mark.mesh.material.opacity = 1 - t;
        const scale = 1 + t * 0.6;
        mark.mesh.scale.set(scale, scale, scale);
    }
}

function animate() {
    sphere.position.add(velocity);

    if (sphere.position.x >= limit || sphere.position.x <= -limit) {
        velocity.x *= -1;
        sphere.position.x = THREE.MathUtils.clamp(sphere.position.x, -limit, limit);

        const sign = Math.sign(sphere.position.x);
        spawnImpactMark(
            new THREE.Vector3(sign * half, sphere.position.y, sphere.position.z),
            new THREE.Vector3(sign, 0, 0)
        );
    }
    if (sphere.position.y >= limit || sphere.position.y <= -limit) {
        velocity.y *= -1;
        sphere.position.y = THREE.MathUtils.clamp(sphere.position.y, -limit, limit);

        const sign = Math.sign(sphere.position.y);
        spawnImpactMark(
            new THREE.Vector3(sphere.position.x, sign * half, sphere.position.z),
            new THREE.Vector3(0, sign, 0)
        );
    }
    if (sphere.position.z >= limit || sphere.position.z <= -limit) {
        velocity.z *= -1;
        sphere.position.z = THREE.MathUtils.clamp(sphere.position.z, -limit, limit);

        const sign = Math.sign(sphere.position.z);
        spawnImpactMark(
            new THREE.Vector3(sphere.position.x, sphere.position.y, sign * half),
            new THREE.Vector3(0, 0, sign)
        );
    }

    updateImpactMarks();
    controls.update();
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});