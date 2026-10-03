import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HOME_POSE, PROTOCOL_DURATION_MS, poseAt, poseToOffset } from './cameraPath';
import { frameStats, loadTimings, type FrameStats, type LoadTimings } from './metrics';

/**
 * Framework-free three.js viewer used by the SMF-13 and SMF-14 probes. It owns one canvas and
 * one WebGL context; dispose() releases every GPU resource and the context, and reports the
 * renderer.info counts before and after so evidence can show what was released.
 */

export interface PartInfo {
  name: string;
  partId: string;
  label: string;
}

export interface RendererInfoSnapshot {
  geometries: number;
  textures: number;
  programs: number;
  calls: number;
  triangles: number;
}

export interface SceneStats {
  meshes: number;
  triangles: number;
  materials: number;
  textures: number;
  textureResolutions: string[];
}

export interface LoadResult {
  timings: LoadTimings;
  scene: SceneStats;
  parts: PartInfo[];
  rendererInfo: RendererInfoSnapshot;
  /** Every URL the loader asked for while parsing (embedded textures appear as blob: URLs). */
  requestedUrls: string[];
  /** Requested URLs that were not blob:/data: — these would be network fetches and are refused. */
  blockedExternalUrls: string[];
}

export interface DisposeReport {
  before: RendererInfoSnapshot;
  afterResourceDispose: RendererInfoSnapshot;
  contextReleased: boolean;
  canvasRemoved: boolean;
}

export type ViewerEvent =
  | { type: 'context-lost' }
  | { type: 'context-restored' }
  | { type: 'resize'; size: string }
  | { type: 'orientation'; orientation: string }
  | { type: 'select'; part: PartInfo | null; via: 'pointer' | 'list' | 'protocol' }
  | { type: 'reset' };

export interface ViewerOptions {
  onEvent?: (event: ViewerEvent) => void;
  /** Cap on devicePixelRatio (recorded in evidence; part of the scene budget). */
  maxPixelRatio?: number;
}

const HIGHLIGHT = new THREE.Color('#f59e0b');
const TAP_SLOP_PX = 6;

function isMesh(o: THREE.Object3D): o is THREE.Mesh {
  return (o as THREE.Mesh).isMesh === true;
}

function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function texturesOf(material: THREE.Material): THREE.Texture[] {
  const out: THREE.Texture[] = [];
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) out.push(value);
  }
  return out;
}

function partFromObject(o: THREE.Object3D | null): { node: THREE.Object3D; info: PartInfo } | null {
  for (let n = o; n; n = n.parent) {
    const data = n.userData as { partId?: unknown; label?: unknown };
    if (typeof data.partId === 'string') {
      return { node: n, info: { name: n.name, partId: data.partId, label: typeof data.label === 'string' ? data.label : n.name } };
    }
  }
  return null;
}

export class PumpViewer {
  readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly onEvent: (event: ViewerEvent) => void;
  private readonly loseExt: WEBGL_lose_context | null;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly cleanups: (() => void)[] = [];
  private model: THREE.Object3D | null = null;
  private partNodes: { node: THREE.Object3D; info: PartInfo }[] = [];
  private selected: THREE.Object3D | null = null;
  private savedEmissive = new Map<THREE.Material, THREE.Color>();
  private target = new THREE.Vector3();
  private framing = 2;
  private frameHook: ((now: number) => void) | null = null;
  private firstFrameResolvers: ((now: number) => void)[] = [];
  private contextLost = false;
  private syncEachFrame = false;
  private readonly pixel = new Uint8Array(4);
  private disposed = false;

  constructor(container: HTMLElement, options: ViewerOptions = {}) {
    this.container = container;
    this.onEvent = options.onEvent ?? (() => undefined);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'block h-full w-full touch-none outline-none';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Interactive 3D view of synthetic pump MF-PUMP-001. Drag to orbit, pinch or scroll to zoom, tap a part to select it.');
    this.canvas.tabIndex = 0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.maxPixelRatio ?? 2));
    this.loseExt = this.renderer.getContext().getExtension('WEBGL_lose_context');
    container.appendChild(this.canvas);

    this.scene.background = new THREE.Color('#e8edf2');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#5b6470', 1.6));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(-2, 3, 2.5);
    const rim = new THREE.DirectionalLight('#ffffff', 0.8);
    rim.position.set(2.5, 1, -2);
    this.scene.add(key, rim);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    this.listen(this.canvas, 'webglcontextlost', () => {
      this.contextLost = true;
      this.onEvent({ type: 'context-lost' });
    });
    this.listen(this.canvas, 'webglcontextrestored', () => {
      this.contextLost = false;
      this.onEvent({ type: 'context-restored' });
    });
    let down: { x: number; y: number } | null = null;
    this.listen(this.canvas, 'pointerdown', e => {
      const p = e as PointerEvent;
      down = { x: p.clientX, y: p.clientY };
    });
    this.listen(this.canvas, 'pointerup', e => {
      const p = e as PointerEvent;
      if (down && Math.hypot(p.clientX - down.x, p.clientY - down.y) <= TAP_SLOP_PX) this.pickAt(p.clientX, p.clientY);
      down = null;
    });
    const onOrientation = (): void => {
      this.onEvent({ type: 'orientation', orientation: window.screen?.orientation?.type ?? String(window.orientation ?? 'unknown') });
      this.resize();
    };
    if (window.screen?.orientation) this.listen(window.screen.orientation, 'change', onOrientation);
    else this.listen(window, 'orientationchange', onOrientation);
    this.listen(window, 'resize', () => this.resize());

    this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null;
    this.resizeObserver?.observe(container);
    this.resize();
    this.applyPose(HOME_POSE);
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private listen(target: EventTarget, type: string, fn: (e: Event) => void): void {
    target.addEventListener(type, fn);
    this.cleanups.push(() => target.removeEventListener(type, fn));
  }

  /**
   * One frame. Timing uses performance.now(), not the rAF timestamp: with a software or busy GPU
   * the browser can keep issuing rAF callbacks with vsync-spaced timestamps while frames queue up
   * (observed on SwiftShader). When `syncEachFrame` is set (protocol runs and load marks) a
   * 1-pixel readPixels forces the frame to finish on the GPU, so intervals are completed frames —
   * a conservative measure that removes GPU pipelining.
   */
  private tick(): void {
    if (this.disposed || this.contextLost) return;
    const start = performance.now();
    this.frameHook?.(start);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.syncEachFrame || this.firstFrameResolvers.length) this.syncGpu();
    if (this.firstFrameResolvers.length) {
      const resolvers = this.firstFrameResolvers;
      this.firstFrameResolvers = [];
      const done = performance.now();
      resolvers.forEach(r => r(done));
    }
  }

  private syncGpu(): void {
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixel);
  }

  private nextFrame(): Promise<number> {
    return new Promise(resolve => this.firstFrameResolvers.push(resolve));
  }

  resize(): void {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const size = `${w}x${h}`;
    if (this.canvas.dataset.size === size) return;
    this.canvas.dataset.size = size;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.onEvent({ type: 'resize', size });
  }

  /**
   * Parses GLB bytes (already fetched by the caller so the delivery path is explicit) and adds
   * the model. `requestStart` is the performance.now() taken before the caller's fetch began.
   */
  async load(bytes: ArrayBuffer, requestStart: number, bytesReceivedAt: number): Promise<LoadResult> {
    const requestedUrls: string[] = [];
    const blockedExternalUrls: string[] = [];
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => {
      requestedUrls.push(url.startsWith('blob:') ? 'blob:(in-page object URL)' : url);
      if (url.startsWith('blob:') || url.startsWith('data:')) return url;
      blockedExternalUrls.push(url);
      return 'data:,'; // refuse: models must be self-contained
    });
    const loader = new GLTFLoader(manager);
    const gltf = await loader.parseAsync(bytes, '');
    const parsedAt = performance.now();
    if (this.disposed) throw new Error('viewer disposed during load');
    if (this.model) this.disposeModel();
    this.model = gltf.scene;
    this.scene.add(gltf.scene);

    const textures = new Set<THREE.Texture>();
    const materials = new Set<THREE.Material>();
    let triangles = 0;
    let meshes = 0;
    this.partNodes = [];
    gltf.scene.traverse(o => {
      if (isMesh(o)) {
        meshes++;
        const g = o.geometry;
        triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        for (const m of materialsOf(o)) {
          materials.add(m);
          texturesOf(m).forEach(t => textures.add(t));
        }
      }
      const part = partFromObject(o);
      if (part && part.node === o) this.partNodes.push(part);
    });

    const box = new THREE.Box3().setFromObject(gltf.scene);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.target.copy(sphere.center);
    this.framing = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.05;
    this.camera.near = this.framing / 100;
    this.camera.far = this.framing * 20;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = this.framing * 0.25;
    this.controls.maxDistance = this.framing * 3;
    this.applyPose(HOME_POSE);

    const firstFrame = await this.nextFrame();
    const interactive = await this.nextFrame(); // one more frame: controls attached and main thread free
    const resolutions = [...textures].map(t => {
      const img = t.image as { width?: number; height?: number } | undefined;
      return img?.width ? `${img.width}x${img.height}` : 'unknown';
    });
    return {
      timings: loadTimings({ request: requestStart, bytes: bytesReceivedAt, parsed: parsedAt, firstFrame, interactive }),
      scene: { meshes, triangles, materials: materials.size, textures: textures.size, textureResolutions: resolutions },
      parts: this.partNodes.map(p => p.info),
      rendererInfo: this.info(),
      requestedUrls,
      blockedExternalUrls,
    };
  }

  info(): RendererInfoSnapshot {
    const i = this.renderer.info;
    return {
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      programs: i.programs?.length ?? 0,
      calls: i.render.calls,
      triangles: i.render.triangles,
    };
  }

  get isContextLost(): boolean {
    return this.contextLost;
  }

  get parts(): PartInfo[] {
    return this.partNodes.map(p => p.info);
  }

  private applyPose(pose: typeof HOME_POSE): void {
    const [x, y, z] = poseToOffset(pose, this.framing);
    this.camera.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
    this.controls.target.copy(this.target);
    this.camera.lookAt(this.target);
    this.controls.update();
  }

  reset(): void {
    this.applyPose(HOME_POSE);
    this.select(null, 'list');
    this.onEvent({ type: 'reset' });
  }

  private pickAt(clientX: number, clientY: number): void {
    if (!this.model) return;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.model, true)[0];
    const part = hit ? partFromObject(hit.object) : null;
    this.highlight(part?.node ?? null);
    this.onEvent({ type: 'select', part: part?.info ?? null, via: 'pointer' });
  }

  select(name: string | null, via: 'list' | 'protocol' = 'list'): void {
    const part = name ? (this.partNodes.find(p => p.info.name === name) ?? null) : null;
    this.highlight(part?.node ?? null);
    this.onEvent({ type: 'select', part: part?.info ?? null, via });
  }

  private highlight(node: THREE.Object3D | null): void {
    for (const [m, c] of this.savedEmissive) {
      if (m instanceof THREE.MeshStandardMaterial) m.emissive.copy(c);
    }
    this.savedEmissive.clear();
    this.selected = node;
    node?.traverse(o => {
      if (!isMesh(o)) return;
      for (const m of materialsOf(o)) {
        if (m instanceof THREE.MeshStandardMaterial) {
          this.savedEmissive.set(m, m.emissive.clone());
          m.emissive.copy(HIGHLIGHT).multiplyScalar(0.55);
        }
      }
    });
  }

  get selectedName(): string | null {
    return this.selected?.name ?? null;
  }

  /**
   * Runs the scripted 60 s camera path (cameraPath.ts) with user input disabled and samples
   * every frame interval. Resolves with frame statistics; rejects if the context is lost.
   */
  runProtocol(onProgress?: (elapsedMs: number) => void, durationMs = PROTOCOL_DURATION_MS): Promise<FrameStats & { contextLostDuringRun: boolean }> {
    return new Promise((resolve, reject) => {
      const intervals: number[] = [];
      let start = -1;
      let last = -1;
      let lostDuring = false;
      let lastReported = 0;
      const lostListener = (): void => {
        lostDuring = true;
      };
      this.canvas.addEventListener('webglcontextlost', lostListener);
      this.controls.enabled = false;
      this.syncEachFrame = true;
      const parts = this.partNodes.map(p => p.info.name);
      let lastSelect: number | null = null;
      this.frameHook = now => {
        if (start < 0) {
          start = now;
          last = now;
        } else {
          intervals.push(now - last);
          last = now;
        }
        const elapsed = now - start;
        const pose = poseAt(elapsed, parts.length);
        this.applyPose(pose);
        if (pose.selectIndex !== null && pose.selectIndex !== lastSelect) {
          lastSelect = pose.selectIndex;
          this.select(parts[pose.selectIndex], 'protocol');
        }
        if (onProgress && elapsed - lastReported >= 1000) {
          lastReported = elapsed;
          onProgress(elapsed);
        }
        if (elapsed >= durationMs || this.disposed) {
          this.frameHook = null;
          this.syncEachFrame = false;
          this.controls.enabled = true;
          this.canvas.removeEventListener('webglcontextlost', lostListener);
          this.reset();
          if (this.disposed) reject(new Error('viewer disposed during protocol'));
          else resolve({ ...frameStats(intervals), contextLostDuringRun: lostDuring });
        }
      };
    });
  }

  /** Simulates loss with WEBGL_lose_context (the same event path a real GPU reset takes). */
  simulateContextLoss(): boolean {
    if (!this.loseExt || this.contextLost) return false;
    this.loseExt.loseContext();
    return true;
  }

  simulateContextRestore(): boolean {
    if (!this.loseExt || !this.contextLost) return false;
    this.loseExt.restoreContext();
    return true;
  }

  private disposeModel(): void {
    if (!this.model) return;
    this.highlight(null);
    this.model.traverse(o => {
      if (!isMesh(o)) return;
      o.geometry.dispose();
      for (const m of materialsOf(o)) {
        for (const t of texturesOf(m)) {
          const img = t.image as { close?: () => void } | undefined;
          t.dispose();
          img?.close?.(); // ImageBitmap decoded by GLTFLoader
        }
        m.dispose();
      }
    });
    this.scene.remove(this.model);
    this.model = null;
    this.partNodes = [];
  }

  dispose(): DisposeReport {
    const before = this.info();
    this.disposed = true;
    this.frameHook = null;
    this.renderer.setAnimationLoop(null);
    this.disposeModel();
    this.renderer.renderLists.dispose();
    const afterResourceDispose = this.info();
    this.controls.dispose();
    this.resizeObserver?.disconnect();
    this.cleanups.splice(0).forEach(fn => fn());
    this.renderer.dispose();
    let contextReleased = false;
    try {
      this.renderer.forceContextLoss();
      contextReleased = true;
    } catch {
      contextReleased = false;
    }
    this.canvas.remove();
    return { before, afterResourceDispose, contextReleased, canvasRemoved: !this.canvas.isConnected };
  }
}
