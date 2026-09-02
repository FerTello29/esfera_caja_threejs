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

// ================= ESFERAS (múltiples) =================
const MAX_SPHERES = 20;
const sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);

// Rapidez actual por eje (magnitud), controlada por los sliders.
const speeds = {
    x: parseFloat(document.getElementById('speed-x').value),
    y: parseFloat(document.getElementById('speed-y').value),
    z: parseFloat(document.getElementById('speed-z').value)
};

const spheres = []; // cada item: { mesh, velocity }

function randomSign() {
    return Math.random() < 0.5 ? -1 : 1;
}

function createSphereMaterial() {
    const hue = Math.random();
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(hue, 0.8, 0.55),
        roughness: 0.35
    });
}

function randomPositionInsideBox() {
    return new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(2 * limit),
        THREE.MathUtils.randFloatSpread(2 * limit),
        THREE.MathUtils.randFloatSpread(2 * limit)
    );
}

function spawnSphere() {
    const mesh = new THREE.Mesh(sphereGeometry, createSphereMaterial());

    // Intenta encontrar una posición sin encimarse con esferas existentes.
    let position = randomPositionInsideBox();
    let attempts = 0;
    while (
        attempts < 20 &&
        spheres.some((s) => s.mesh.position.distanceTo(position) < radius * 2.2)
    ) {
        position = randomPositionInsideBox();
        attempts++;
    }
    mesh.position.copy(position);

    const velocity = new THREE.Vector3(
        randomSign() * speeds.x,
        randomSign() * speeds.y,
        randomSign() * speeds.z
    );

    scene.add(mesh);
    spheres.push({ mesh, velocity });
}

function removeLastSphere() {
    const removed = spheres.pop();
    if (removed) {
        scene.remove(removed.mesh);
        removed.mesh.material.dispose();
    }
}

function setSphereCount(target) {
    target = THREE.MathUtils.clamp(target, 1, MAX_SPHERES);
    while (spheres.length < target) spawnSphere();
    while (spheres.length > target) removeLastSphere();
}

// ================= PANEL DE CONTROLES =================

function bindSpeedSlider(inputId, valueId, axis) {
    const input = document.getElementById(inputId);
    const valueLabel = document.getElementById(valueId);

    input.addEventListener('input', () => {
        const speed = parseFloat(input.value);
        valueLabel.textContent = speed.toFixed(3);
        speeds[axis] = speed;

        spheres.forEach(({ velocity }) => {
            const currentSign = Math.sign(velocity[axis]) || 1;
            velocity[axis] = currentSign * speed;
        });
    });
}

bindSpeedSlider('speed-x', 'speed-x-value', 'x');
bindSpeedSlider('speed-y', 'speed-y-value', 'y');
bindSpeedSlider('speed-z', 'speed-z-value', 'z');

const sphereCountInput = document.getElementById('sphere-count');
const sphereCountValue = document.getElementById('sphere-count-value');

sphereCountInput.addEventListener('input', () => {
    const target = parseInt(sphereCountInput.value, 10);
    sphereCountValue.textContent = target;
    setSphereCount(target);
});

// Población inicial de esferas.
setSphereCount(parseInt(sphereCountInput.value, 10));

// ================= MARCAS DE IMPACTO (paredes) =================

const marksGroup = new THREE.Group();
scene.add(marksGroup);

const MARK_LIFETIME = 800;
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
    mark.position.copy(position).addScaledVector(normal, 0.01);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    marksGroup.add(mark);
    activeMarks.push({ mesh: mark, bornAt: performance.now() });
}

function updateImpactMarks() {
    const now = performance.now();

    for (let i = activeMarks.length - 1; i >= 0; i--) {
        const mark = activeMarks[i];
        const t = (now - mark.bornAt) / MARK_LIFETIME;

        if (t >= 1) {
            marksGroup.remove(mark.mesh);
            mark.mesh.material.dispose();
            activeMarks.splice(i, 1);
            continue;
        }

        mark.mesh.material.opacity = 1 - t;
        const scale = 1 + t * 0.6;
        mark.mesh.scale.set(scale, scale, scale);
    }
}

// ================= EXPLOSIONES (colisiones entre esferas) =================
// Ráfaga de partículas con brillo aditivo que se dispersan y se apagan.

const explosionsGroup = new THREE.Group();
scene.add(explosionsGroup);

const EXPLOSION_LIFETIME = 600;
const EXPLOSION_PARTICLES = 18;
const activeExplosions = [];

function spawnExplosion(position) {
    const positions = new Float32Array(EXPLOSION_PARTICLES * 3);
    const velocities = [];

    for (let i = 0; i < EXPLOSION_PARTICLES; i++) {
        positions[i * 3] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;

        const dir = new THREE.Vector3(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            Math.random() * 2 - 1
        ).normalize();

        const speed = THREE.MathUtils.randFloat(0.03, 0.09);
        velocities.push(dir.multiplyScalar(speed));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffb703,
        size: 0.18,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    explosionsGroup.add(points);

    activeExplosions.push({ points, velocities, bornAt: performance.now() });
}

function updateExplosions() {
    const now = performance.now();

    for (let i = activeExplosions.length - 1; i >= 0; i--) {
        const exp = activeExplosions[i];
        const t = (now - exp.bornAt) / EXPLOSION_LIFETIME;

        if (t >= 1) {
            explosionsGroup.remove(exp.points);
            exp.points.geometry.dispose();
            exp.points.material.dispose();
            activeExplosions.splice(i, 1);
            continue;
        }

        const posAttr = exp.points.geometry.attributes.position;
        for (let p = 0; p < EXPLOSION_PARTICLES; p++) {
            posAttr.array[p * 3] += exp.velocities[p].x;
            posAttr.array[p * 3 + 1] += exp.velocities[p].y;
            posAttr.array[p * 3 + 2] += exp.velocities[p].z;
        }
        posAttr.needsUpdate = true;

        exp.points.material.opacity = 1 - t;
    }
}

// ================= COLISIÓN ENTRE ESFERAS =================
// Colisión elástica de masas iguales: se intercambia la componente
// de velocidad normal a la línea que une los dos centros.

function resolveSphereCollisions() {
    for (let i = 0; i < spheres.length; i++) {
        for (let j = i + 1; j < spheres.length; j++) {
            const a = spheres[i];
            const b = spheres[j];

            const delta = b.mesh.position.clone().sub(a.mesh.position);
            const distance = delta.length();
            const minDistance = radius * 2;

            if (distance > 0 && distance < minDistance) {
                const normal = delta.multiplyScalar(1 / distance);

                // Separa las esferas para que no se sigan encimando.
                const overlap = minDistance - distance;
                const correction = normal.clone().multiplyScalar(overlap / 2);
                a.mesh.position.sub(correction);
                b.mesh.position.add(correction);

                // Intercambia componente normal de la velocidad.
                const aNormalVel = normal.clone().multiplyScalar(a.velocity.dot(normal));
                const aTangentVel = a.velocity.clone().sub(aNormalVel);
                const bNormalVel = normal.clone().multiplyScalar(b.velocity.dot(normal));
                const bTangentVel = b.velocity.clone().sub(bNormalVel);

                a.velocity.copy(bNormalVel).add(aTangentVel);
                b.velocity.copy(aNormalVel).add(bTangentVel);

                const contactPoint = a.mesh.position.clone().addScaledVector(normal, radius);
                spawnExplosion(contactPoint);
            }
        }
    }
}

function animate() {
    spheres.forEach(({ mesh, velocity }) => {
        mesh.position.add(velocity);

        if (mesh.position.x >= limit || mesh.position.x <= -limit) {
            velocity.x *= -1;
            mesh.position.x = THREE.MathUtils.clamp(mesh.position.x, -limit, limit);
            const sign = Math.sign(mesh.position.x);
            spawnImpactMark(
                new THREE.Vector3(sign * half, mesh.position.y, mesh.position.z),
                new THREE.Vector3(sign, 0, 0)
            );
        }
        if (mesh.position.y >= limit || mesh.position.y <= -limit) {
            velocity.y *= -1;
            mesh.position.y = THREE.MathUtils.clamp(mesh.position.y, -limit, limit);
            const sign = Math.sign(mesh.position.y);
            spawnImpactMark(
                new THREE.Vector3(mesh.position.x, sign * half, mesh.position.z),
                new THREE.Vector3(0, sign, 0)
            );
        }
        if (mesh.position.z >= limit || mesh.position.z <= -limit) {
            velocity.z *= -1;
            mesh.position.z = THREE.MathUtils.clamp(mesh.position.z, -limit, limit);
            const sign = Math.sign(mesh.position.z);
            spawnImpactMark(
                new THREE.Vector3(mesh.position.x, mesh.position.y, sign * half),
                new THREE.Vector3(0, 0, sign)
            );
        }
    });

    resolveSphereCollisions();
    updateImpactMarks();
    updateExplosions();
    controls.update();
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});