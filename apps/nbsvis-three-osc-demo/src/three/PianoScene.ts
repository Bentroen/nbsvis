import * as THREE from 'three';

import { getWhiteKeyIndex, isBlackKey, MIDI_END, MIDI_START } from './PianoLayout';

type KeyMeta = {
  midi: number;
  baseColor: number;
};

export type CameraState = {
  position: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  fpsMode: boolean;
};

export class PianoScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly keyMeshes = new Map<number, THREE.Mesh>();
  private readonly clock = new THREE.Clock();
  private readonly keyState = new Set<string>();
  private frameId: number | undefined;
  private fpsMode = false;
  private yaw = 2.266;
  private pitch = -0.8762;

  constructor(private readonly container: HTMLElement) {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x121722);
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(20, 30, 15);
    this.scene.add(dir);

    this.camera.position.set(-27.921, 40.644, 22.045);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.updateCameraDirection();

    this.buildPiano();
    this.bindFpsInput();
    this.animate();
  }

  private buildPiano(): void {
    const whiteWidth = 1;
    const whiteHeight = 0.6;
    const whiteDepth = 6.4;
    const blackWidth = 0.62;
    const blackHeight = 0.9;
    const blackDepth = 4.1;

    const whiteCount = 52;
    const span = (whiteCount - 1) * whiteWidth;
    const centerOffset = span / 2;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 50),
      new THREE.MeshStandardMaterial({ color: 0x1b1f2a, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.31;
    this.scene.add(floor);

    for (let midi = MIDI_START; midi <= MIDI_END; midi++) {
      if (isBlackKey(midi)) {
        continue;
      }

      const whiteIndex = getWhiteKeyIndex(midi);
      const x = whiteIndex * whiteWidth - centerOffset;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(whiteWidth, whiteHeight, whiteDepth),
        new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.45, metalness: 0.02 }),
      );
      mesh.position.set(x, 0, 0);
      mesh.userData = { midi, baseColor: 0xf2f2f2 } satisfies KeyMeta;
      this.keyMeshes.set(midi, mesh);
      this.scene.add(mesh);
    }

    for (let midi = MIDI_START; midi <= MIDI_END; midi++) {
      if (!isBlackKey(midi)) {
        continue;
      }

      const leftWhite = getWhiteKeyIndex(midi) - 1;
      const x = leftWhite * whiteWidth - centerOffset + whiteWidth * 0.67;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(blackWidth, blackHeight, blackDepth),
        new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.3 }),
      );
      mesh.position.set(x, 0.25, -0.9);
      mesh.userData = { midi, baseColor: 0x101214 } satisfies KeyMeta;
      this.keyMeshes.set(midi, mesh);
      this.scene.add(mesh);
    }
  }

  setKeyActive(midi: number, active: boolean): void {
    const mesh = this.keyMeshes.get(midi);
    if (!mesh) return;

    const mat = mesh.material as THREE.MeshStandardMaterial;
    const baseColor = (mesh.userData as KeyMeta).baseColor;
    mat.color.setHex(active ? 0x4ac3ff : baseColor);
    mat.emissive.setHex(active ? 0x0a2440 : 0x000000);
  }

  pickMidiAt(clientX: number, clientY: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(Array.from(this.keyMeshes.values()), false);
    if (!hits.length) return null;
    const top = hits[0].object as THREE.Mesh;
    return (top.userData as KeyMeta).midi ?? null;
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  toggleFpsMode(): boolean {
    this.fpsMode = !this.fpsMode;
    if (this.fpsMode) {
      this.renderer.domElement.requestPointerLock();
    } else if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    return this.fpsMode;
  }

  isFpsModeEnabled(): boolean {
    return this.fpsMode;
  }

  getCameraState(): CameraState {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      yaw: this.yaw,
      pitch: this.pitch,
      fpsMode: this.fpsMode,
    };
  }

  private bindFpsInput(): void {
    document.addEventListener('pointerlockchange', () => {
      this.fpsMode = document.pointerLockElement === this.renderer.domElement;
      if (!this.fpsMode) {
        this.keyState.clear();
      }
    });

    window.addEventListener('keydown', (event) => {
      this.keyState.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keyState.delete(event.code);
    });

    window.addEventListener('mousemove', (event) => {
      if (!this.fpsMode) return;
      const lookSpeed = 0.0022;
      this.yaw -= event.movementX * lookSpeed;
      this.pitch -= event.movementY * lookSpeed;
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
      this.updateCameraDirection();
    });
  }

  private updateCameraDirection(): void {
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.camera.lookAt(this.camera.position.clone().add(dir));
  }

  private updateFpsMovement(deltaSeconds: number): void {
    if (!this.fpsMode) return;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const move = new THREE.Vector3();
    if (this.keyState.has('KeyW')) move.add(forward);
    if (this.keyState.has('KeyS')) move.sub(forward);
    if (this.keyState.has('KeyD')) move.add(right);
    if (this.keyState.has('KeyA')) move.sub(right);
    if (this.keyState.has('Space')) move.y += 1;
    if (this.keyState.has('ShiftLeft') || this.keyState.has('ShiftRight')) move.y -= 1;
    if (move.lengthSq() === 0) return;
    const speed = 12;
    move.normalize().multiplyScalar(speed * deltaSeconds);
    this.camera.position.add(move);
  }

  private animate = (): void => {
    this.frameId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.updateFpsMovement(dt);
    this.renderer.render(this.scene, this.camera);
  };

  destroy(): void {
    if (this.frameId !== undefined) {
      cancelAnimationFrame(this.frameId);
    }
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
