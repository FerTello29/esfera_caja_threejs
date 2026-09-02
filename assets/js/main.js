import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);
scene.fog = new THREE.FogExp2(0x07111f, 0.018);

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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ---- Controles de cámara ----
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 6;
controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI * 0.49; // no dejar que la cámara se meta bajo la alfombra

// ---- Iluminación ----
scene.add(new THREE.HemisphereLight(0xbfe8ff, 0x0a1a2c, 0.7));

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5, 9, 6);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
light.shadow.camera.left = -14;
light.shadow.camera.right = 14;
light.shadow.camera.top = 14;
light.shadow.camera.bottom = -14;
light.shadow.camera.near = 1;
light.shadow.camera.far = 40;
light.shadow.bias = -0.0015;
scene.add(light);

// Luz cálida y baja que "respira" desde el centro de la alfombra, para dar ambiente.
const emberLight = new THREE.PointLight(0xffb703, 0, 14, 2);
emberLight.position.set(0, -4.6, 0);
scene.add(emberLight);

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

// ================= ALFOMBRA PROCEDURAL (sin imágenes externas) =================
// Toda la textura se dibuja en un <canvas> en tiempo de ejecución y se sube a la
// GPU como THREE.CanvasTexture: un mandala geométrico que combina los mismos
// tonos que ya usa la interfaz (cian, celeste, ámbar) para que la alfombra se
// sienta parte del mismo mundo que la caja de cristal.

function createRugColorTexture() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    const backdrop = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2
    );
    backdrop.addColorStop(0, '#0e2740');
    backdrop.addColorStop(0.7, '#081729');
    backdrop.addColorStop(1, '#050e1a');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);

    const ringPalette = ['#22d3ee', '#bfe8ff', '#ffb703'];
    for (let ring = 0; ring < 5; ring++) {
        const r = 70 + ring * 85;
        const petals = 14 + ring * 6;
        const color = ringPalette[ring % ringPalette.length];

        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = ring % 2 === 0 ? 3 : 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.65;
        for (let p = 0; p < petals; p++) {
            const angle = (p / petals) * Math.PI * 2;
            const innerR = r - 22;
            const outerR = r + 22;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
            ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(Math.cos(angle) * outerR, Math.sin(angle) * outerR, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }
    }

    // Estrella central, como si fuera el corazón de la caja de cristal reflejado en el suelo.
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    const spikes = 8;
    const outerR = 46;
    const innerR = 20;
    for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i / (spikes * 2)) * Math.PI * 2;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Marco tipo "borde de alfombra tejida".
    ctx.strokeStyle = '#bfe8ff';
    ctx.lineWidth = 16;
    ctx.strokeRect(24, 24, size - 48, size - 48);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 5;
    ctx.strokeRect(52, 52, size - 104, size - 104);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

function createRugRoughnessTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const shade = 150 + Math.random() * 90; // variación tipo "hilo" para que no se vea plano
        imageData.data[i] = shade;
        imageData.data[i + 1] = shade;
        imageData.data[i + 2] = shade;
        imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
}

const rugColorMap = createRugColorTexture();
const rugRoughnessMap = createRugRoughnessTexture();

const rugMaterial = new THREE.MeshStandardMaterial({
    map: rugColorMap,
    roughnessMap: rugRoughnessMap,
    roughness: 1,
    metalness: 0.04
});
const rug = new THREE.Mesh(new THREE.CircleGeometry(13, 96), rugMaterial);
rug.rotation.x = -Math.PI / 2;
rug.position.y = -half - 0.01;
rug.receiveShadow = true;
scene.add(rug);

// Halo de luz suave bajo la caja, como si el cristal iluminara la alfombra.
const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const halo = new THREE.Mesh(new THREE.CircleGeometry(8, 64), haloMaterial);
halo.rotation.x = -Math.PI / 2;
halo.position.y = -half + 0.01;
scene.add(halo);

// ================= CAMPO DE ESTRELLAS (ambientación) =================
function createStarfield() {
    const starCount = 900;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const r = THREE.MathUtils.randFloat(22, 55);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(THREE.MathUtils.randFloatSpread(1.6));
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.6 + 2;
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color: 0xbfe8ff,
        size: 0.09,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
    });
    return new THREE.Points(geometry, material);
}
const starfield = createStarfield();
scene.add(starfield);

// ================= SONIDO SINTETIZADO (Web Audio API, sin archivos) =================

let audioCtx = null;
let masterGain = null;
let userVolume = 0.5;
let isMuted = false;

function ensureAudioContext() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;

    const compressor = audioCtx.createDynamicsCompressor();
    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);

    // Aparición suave del volumen para que no "explote" al entrar.
    masterGain.gain.linearRampToValueAtTime(
        isMuted ? 0 : userVolume,
        audioCtx.currentTime + 2
    );

    startAmbientPad();
}

function startAmbientPad() {
    const frequencies = [55, 82.4, 110]; // acorde grave, tipo colchón atmosférico
    frequencies.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;

        const gain = audioCtx.createGain();
        gain.gain.value = 0.05 - i * 0.012;

        // LFO lento que mueve el filtro para que el fondo "respire".
        const lfo = audioCtx.createOscillator();
        lfo.frequency.value = 0.04 + i * 0.015;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 120;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        osc.start();
    });
}

function playWallPing(axis, intensity) {
    if (!audioCtx) return;
    const baseFrequencies = { x: 440, y: 554.37, z: 659.25 };
    const freq = baseFrequencies[axis] * (0.85 + intensity * 0.6);

    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.55, 40), audioCtx.currentTime + 0.18);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.22 * (0.4 + intensity), audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, audioCtx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);

    // Pulso de luz cálida sincronizado con el impacto.
    emberLight.intensity = Math.min(emberLight.intensity + intensity * 1.2, 3);
}

function playCollisionClack() {
    if (!audioCtx) return;
    const duration = 0.09;
    const bufferSize = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 5;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();

    emberLight.intensity = Math.min(emberLight.intensity + 1.4, 3.5);
}

// ---- Pantalla de entrada / activación de audio ----
const startOverlay = document.getElementById('start-overlay');
const startButton = document.getElementById('start-button');
startButton.addEventListener('click', () => {
    ensureAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startOverlay.classList.add('is-hidden');
});

// ---- Controles de sonido ----
const volumeInput = document.getElementById('volume');
const volumeValue = document.getElementById('volume-value');
const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');

volumeInput.addEventListener('input', () => {
    userVolume = parseFloat(volumeInput.value);
    volumeValue.textContent = `${Math.round(userVolume * 100)}%`;
    if (masterGain && !isMuted) {
        masterGain.gain.linearRampToValueAtTime(userVolume, audioCtx.currentTime + 0.1);
    }
});

muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.setAttribute('aria-pressed', String(isMuted));
    muteIcon.textContent = isMuted ? '🔇' : '🔊';
    muteBtn.lastChild.textContent = isMuted ? ' Sonido silenciado' : ' Sonido activado';
    if (masterGain) {
        masterGain.gain.linearRampToValueAtTime(isMuted ? 0 : userVolume, audioCtx.currentTime + 0.1);
    }
});

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
    mesh.castShadow = true;
    mesh.receiveShadow = true;

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
                playCollisionClack();
            }
        }
    }
}

// ================= POST-PROCESADO (bloom) =================
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.85, // intensidad
    0.45, // radio
    0.18  // umbral
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

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
            playWallPing('x', Math.min(Math.abs(velocity.x) / 0.15, 1));
        }
        if (mesh.position.y >= limit || mesh.position.y <= -limit) {
            velocity.y *= -1;
            mesh.position.y = THREE.MathUtils.clamp(mesh.position.y, -limit, limit);
            const sign = Math.sign(mesh.position.y);
            spawnImpactMark(
                new THREE.Vector3(mesh.position.x, sign * half, mesh.position.z),
                new THREE.Vector3(0, sign, 0)
            );
            playWallPing('y', Math.min(Math.abs(velocity.y) / 0.15, 1));
        }
        if (mesh.position.z >= limit || mesh.position.z <= -limit) {
            velocity.z *= -1;
            mesh.position.z = THREE.MathUtils.clamp(mesh.position.z, -limit, limit);
            const sign = Math.sign(mesh.position.z);
            spawnImpactMark(
                new THREE.Vector3(mesh.position.x, mesh.position.y, sign * half),
                new THREE.Vector3(0, 0, sign)
            );
            playWallPing('z', Math.min(Math.abs(velocity.z) / 0.15, 1));
        }
    });

    resolveSphereCollisions();
    updateImpactMarks();
    updateExplosions();

    // El halo y la luz cálida se apagan lentamente entre impactos.
    emberLight.intensity *= 0.9;
    halo.material.opacity = 0.1 + Math.min(emberLight.intensity / 3, 1) * 0.15;

    starfield.rotation.y += 0.0002;

    controls.update();
    composer.render();
}

renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.setSize(window.innerWidth, window.innerHeight);
});