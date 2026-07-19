'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type AvatarState = 'idle' | 'speaking' | 'listening' | 'thinking';

interface Props {
  state: AvatarState;
  micLevel?: number; // 0..1
  className?: string;
  /** Rigged humanoid .glb (Ready Player Me works great). Falls back to a stylized head. */
  modelUrl?: string;
  /** Reports whether the real human model loaded or we fell back. */
  onStatus?: (status: 'loading' | 'loaded' | 'fallback') => void;
}

// Create your own free avatar at https://readyplayer.me → copy the .glb URL →
// set NEXT_PUBLIC_VIVA_AVATAR_URL in frontend/.env.local
const DEFAULT_MODEL =
  process.env.NEXT_PUBLIC_VIVA_AVATAR_URL ||
  'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb';

/**
 * The AI examiner. Loads a real rigged human avatar and drives:
 *  - lip-sync (mouthOpen / jawOpen / viseme morph targets)
 *  - eye blinking
 *  - head nodding + natural idle sway (Head/Neck bones)
 * If the model can't load, it degrades to a stylized 3D head so the viva still works.
 */
export const VivaAvatar3D: React.FC<Props> = ({ state, micLevel = 0, className = '', modelUrl, onStatus }) => {
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;
  const mountRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ state, micLevel });
  propsRef.current = { state, micLevel };
  const [usingFallback, setUsingFallback] = useState(false);
  // read by the animation loop without re-running the effect
  const usingFallbackRef = useRef(false);
  usingFallbackRef.current = usingFallback;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 400;
    const height = mount.clientHeight || 400;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // ---- Studio lighting (flattering on skin) ----
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(1.5, 2.5, 2.5);
    scene.add(key);
    const fillL = new THREE.PointLight(0x99bbff, 1.2, 20);
    fillL.position.set(-2.5, 1, 1.5);
    scene.add(fillL);
    const rim = new THREE.PointLight(0xffffff, 1.4, 20);
    rim.position.set(0, 1.5, -2.5);
    scene.add(rim);

    // ---- Animation targets, filled once a model (or fallback) is built ----
    let headBone: THREE.Object3D | null = null;
    let neckBone: THREE.Object3D | null = null;
    const mouthMorphs: { mesh: THREE.Mesh; index: number }[] = [];
    const blinkMorphs: { mesh: THREE.Mesh; index: number }[] = [];
    let fallbackMouth: THREE.Mesh | null = null;
    let fallbackEyes: THREE.Mesh[] = [];
    let root: THREE.Object3D | null = null;
    let disposed = false;

    const MOUTH_KEYS = ['mouthOpen', 'jawOpen', 'viseme_aa', 'viseme_O', 'mouthFunnel'];
    const BLINK_KEYS = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed', 'blink'];

    const collectMorphs = (obj: THREE.Object3D) => {
      obj.traverse((child: any) => {
        if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
          const dict = child.morphTargetDictionary as Record<string, number>;
          MOUTH_KEYS.forEach((k) => { if (dict[k] !== undefined) mouthMorphs.push({ mesh: child, index: dict[k] }); });
          BLINK_KEYS.forEach((k) => { if (dict[k] !== undefined) blinkMorphs.push({ mesh: child, index: dict[k] }); });
        }
        const n = (child.name || '').toLowerCase();
        if (!headBone && n === 'head') headBone = child;
        if (!neckBone && n === 'neck') neckBone = child;
      });
    };

    // ---- Fallback stylized head (used if the GLB fails) ----
    const buildFallback = () => {
      setUsingFallback(true);
      statusRef.current?.('fallback');
      const head = new THREE.Group();
      root = head;
      scene.add(head);
      camera.position.set(0, 0.15, 4.2);

      const skull = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 64),
        new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.35, metalness: 0.35 })
      );
      skull.scale.set(1, 1.12, 0.95);
      head.add(skull);

      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbcd0ff, emissiveIntensity: 0.9 });
      const eyeGeo = new THREE.SphereGeometry(0.12, 32, 32);
      const eL = new THREE.Mesh(eyeGeo, eyeMat); eL.position.set(-0.34, 0.18, 0.86);
      const eR = new THREE.Mesh(eyeGeo, eyeMat); eR.position.set(0.34, 0.18, 0.86);
      head.add(eL, eR);
      fallbackEyes = [eL, eR];

      const mouth = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.06, 0.34, 6, 16),
        new THREE.MeshStandardMaterial({ color: 0x14141a })
      );
      mouth.rotation.z = Math.PI / 2;
      mouth.position.set(0, -0.28, 0.88);
      head.add(mouth);
      fallbackMouth = mouth;
      headBone = head;
    };

    // ---- Try the real human model first ----
    const url = modelUrl || DEFAULT_MODEL;
    const loader = new GLTFLoader();
    statusRef.current?.('loading');
    if (!url) { buildFallback(); }
    else loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        statusRef.current?.('loaded');
        const model = gltf.scene;
        root = model;

        // Frame the head/shoulders (RPM avatars are ~1.7m tall, head near y=1.6)
        model.position.set(0, -1.45, 0);
        model.scale.setScalar(1);
        scene.add(model);
        camera.position.set(0, 0.18, 0.85);
        camera.lookAt(0, 0.1, 0);

        collectMorphs(model);
        if (mouthMorphs.length === 0 && !headBone) {
          // Model loaded but has no usable rig — still show it, just less animated
          console.warn('Avatar loaded without morph targets; lip-sync limited.');
        }
      },
      undefined,
      (err) => {
        console.warn('Viva avatar model failed to load, using stylized head:', err);
        if (!disposed) buildFallback();
      }
    );

    // ---- Animation loop ----
    const clock = new THREE.Clock();
    let raf = 0;
    let blinkTimer = 0;
    let nextBlink = 2 + Math.random() * 3;
    let nodT = -1;          // >=0 while a nod is playing
    let lastState: AvatarState = state;
    let mouthCur = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta(), 0.05);
      const { state: s, micLevel: mic } = propsRef.current;

      // Trigger a nod when she starts speaking, and occasionally while listening (acknowledgement)
      if (s !== lastState) {
        if (s === 'speaking' || s === 'listening') nodT = 0;
        lastState = s;
      }
      if (s === 'listening' && nodT < 0 && Math.random() < 0.004) nodT = 0;

      let nod = 0;
      if (nodT >= 0) {
        nodT += dt;
        nod = Math.sin(nodT * 7) * Math.max(0, 1 - nodT / 1.1) * 0.22;
        if (nodT > 1.1) nodT = -1;
      }

      // Head motion: idle sway + nod (+ thinking tilt)
      const swayY = Math.sin(t * 0.45) * 0.12;
      const swayX = Math.sin(t * 0.7) * 0.04;
      const tilt = s === 'thinking' ? 0.13 : 0;

      if (headBone) {
        (headBone as any).rotation.y = swayY;
        (headBone as any).rotation.x = swayX + nod + tilt;
        (headBone as any).rotation.z = s === 'thinking' ? 0.1 : Math.sin(t * 0.3) * 0.02;
      }
      if (neckBone) {
        (neckBone as any).rotation.x = nod * 0.4;
      }
      if (root && usingFallbackRef.current) {
        root.position.y = Math.sin(t * 1.3) * 0.03;
      }

      // ---- Lip sync ----
      let target = 0;
      if (s === 'speaking') {
        // layered sine waves ≈ natural syllable rhythm
        target = 0.35 + (Math.sin(t * 12) * 0.5 + Math.sin(t * 19.3) * 0.3 + 0.8) * 0.28;
        target = Math.min(1, Math.max(0.05, target));
      } else if (s === 'listening') {
        target = Math.min(0.35, mic * 0.5); // slight reactive movement
      } else if (s === 'thinking') {
        target = 0.05 + Math.abs(Math.sin(t * 2)) * 0.06;
      }
      mouthCur += (target - mouthCur) * 0.35;

      mouthMorphs.forEach(({ mesh, index }) => {
        if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = mouthCur;
      });
      if (fallbackMouth) fallbackMouth.scale.x = 0.15 + mouthCur * 1.6;

      // ---- Blink ----
      blinkTimer += dt;
      let blink = 0;
      if (blinkTimer > nextBlink) {
        const p = (blinkTimer - nextBlink) / 0.14;
        blink = p < 1 ? Math.sin(p * Math.PI) : 0;
        if (p >= 1) { blinkTimer = 0; nextBlink = 2 + Math.random() * 3; }
      }
      blinkMorphs.forEach(({ mesh, index }) => {
        if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = blink;
      });
      fallbackEyes.forEach((e) => { e.scale.y = 1 - blink; });

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  return <div ref={mountRef} className={className} style={{ width: '100%', height: '100%' }} />;
};

export default VivaAvatar3D;
