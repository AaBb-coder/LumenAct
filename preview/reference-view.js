// Independent reference renderer: public skinning, direct morph weights,
// and a small deterministic head idle used only to keep the local showcase alive.
import * as THREE from './three.module.js';

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

// Aim from the eye midpoint in one neutral head frame. Both eyes share the
// same filtered rotation and keep their rest alignment without convergence.
// Inverting the complete world matrix also handles the reflected Unity model.
export function createCameraGaze(eyes, camera) {
  const states = eyes.map(node => ({node, rest: node.quaternion.clone()}));
  const frame = states[0]?.node.parent;
  if (!frame) return () => {};
  const neutral = states[0].rest.clone();
  const inverseNeutral = neutral.clone().invert();
  const filtered = new THREE.Quaternion();
  const midpoint = new THREE.Vector3(), eyePosition = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3(), localTarget = new THREE.Vector3();
  const turn = new THREE.Quaternion(), goal = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const yawLimit = THREE.MathUtils.degToRad(8);
  const pitchLimit = THREE.MathUtils.degToRad(10);
  return dt => {
    const alpha = 1 - Math.exp(-14 * Math.max(0, Number(dt) || 0));
    for (const {node, rest} of states) node.quaternion.copy(rest);
    frame.updateWorldMatrix(true, true);
    midpoint.set(0, 0, 0);
    for (const {node} of states) {
      node.getWorldPosition(eyePosition);
      midpoint.add(frame.worldToLocal(eyePosition));
    }
    midpoint.multiplyScalar(1 / states.length);
    camera.getWorldPosition(cameraPosition);
    frame.worldToLocal(localTarget.copy(cameraPosition));
    localTarget.sub(midpoint).applyQuaternion(inverseNeutral);
    let yaw = 0, pitch = 0;
    if (localTarget.z > 0.0001) {
      yaw = clamp(Math.atan2(localTarget.x, localTarget.z), -yawLimit, yawLimit);
      pitch = clamp(-Math.atan2(localTarget.y, Math.hypot(localTarget.x, localTarget.z)), -pitchLimit, pitchLimit);
      const radius = Math.hypot(yaw / yawLimit, pitch / pitchLimit);
      if (radius > 1) { yaw /= radius; pitch /= radius; }
    }
    goal.setFromEuler(euler.set(pitch, yaw, 0, 'YXZ'));
    filtered.slerp(goal, alpha).normalize();
    turn.copy(neutral).multiply(filtered).multiply(inverseNeutral);
    for (const {node, rest} of states) node.quaternion.copy(turn).multiply(rest);
  };
}

export async function createReferenceView({container, manifest, assets}) {
  if (manifest.schema !== 'lumen.web.avatar.v1') throw new Error('不支持的脸部清单格式');
  const buffer = await assets.binary('geometry');
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xe9e8e3, 1);
  renderer.domElement.setAttribute('aria-label', '脸部参考三维预览');
  const scene = new THREE.Scene();
  const model = new THREE.Group();
  model.scale.z = -1; // Unity +Z forward to the browser's mirrored model space.
  scene.add(model);
  const nodes = manifest.nodes.map((item) => {
    const bone = new THREE.Bone();
    bone.name = item.name;
    bone.position.fromArray(item.position);
    bone.quaternion.fromArray(item.rotation);
    bone.scale.fromArray(item.scale);
    return bone;
  });
  manifest.nodes.forEach((item, index) =>
    (item.parent >= 0 ? nodes[item.parent] : model).add(nodes[index]));
  function values(desc) {
    const Type = desc.type === 'uint32' ? Uint32Array : Float32Array;
    if (desc.offset < 0 || desc.count < 0 || desc.offset + desc.count * 4 > buffer.byteLength)
      throw new Error('几何属性超出缓冲区');
    return new Type(buffer, desc.offset, desc.count);
  }
  function attribute(desc, integer = false) {
    const data = values(desc);
    return new THREE.BufferAttribute(integer ? Uint16Array.from(data) : data, desc.itemSize);
  }
  const textures = [], materials = [], geometries = [], driven = [];
  let observer = null, attached = false;
  const canvas = renderer.domElement;
  try {
    for (const item of manifest.textures || []) {
      const blob = await assets.blob(item.file);
      const url = URL.createObjectURL(blob);
      try {
        const texture = await new THREE.TextureLoader().loadAsync(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        textures.push(texture);
      } finally { URL.revokeObjectURL(url); }
    }
    for (const item of manifest.materials) {
      const color = item.color || [1, 1, 1, 1];
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color[0], color[1], color[2]),
        map: textures[item.texture] || null,
        transparent: !!item.transparent, opacity: color[3] ?? 1,
        alphaTest: Number(item.alphaTest) || 0,
        depthWrite: !item.transparent, side: THREE.DoubleSide,
      });
      if (material.map) {
        material.map.offset.fromArray(item.offset || [0, 0]);
        material.map.repeat.fromArray(item.repeat || [1, 1]);
      }
      materials.push(material);
    }
    model.updateMatrixWorld(true);
    for (const item of manifest.meshes) {
      const geometry = new THREE.BufferGeometry();
      geometries.push(geometry);
      for (const key of ['position', 'normal', 'uv', 'skinWeight'])
        if (item[key]) geometry.setAttribute(key, attribute(item[key]));
      geometry.setAttribute('skinIndex', attribute(item.skinIndex, true));
      const count = item.primitives.reduce((sum, part) => sum + part.indices.count, 0);
      const indices = new Uint32Array(count);
      let offset = 0;
      for (const part of item.primitives) {
        indices.set(values(part.indices), offset);
        geometry.addGroup(offset, part.indices.count, part.material);
        offset += part.indices.count;
      }
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.morphTargetsRelative = true;
      geometry.morphAttributes.position = (item.morphs || []).map(morph => {
        const attr = attribute(morph.position); attr.name = morph.name; return attr;
      });
      if (item.morphs?.every(morph => morph.normal))
        geometry.morphAttributes.normal = item.morphs.map(morph => attribute(morph.normal));
      const inverses = values(item.inverseBind);
      const skeleton = new THREE.Skeleton(
        item.bones.map(index => nodes[index]),
        item.bones.map((_, index) => new THREE.Matrix4().fromArray(inverses, index * 16).transpose()));
      const mesh = new THREE.SkinnedMesh(geometry, materials);
      mesh.bind(skeleton, new THREE.Matrix4());
      mesh.frustumCulled = false;
      model.add(mesh);
      driven.push({mesh, skeleton, morphs: item.morphs || []});
    }
    // A static exported pose is asset data, not an animation policy.
    for (const pose of manifest.preview_pose?.nodes || []) {
      const node = nodes[pose.index];
      if (!node) continue;
      if (pose.position) node.position.fromArray(pose.position);
      if (pose.rotation) node.quaternion.fromArray(pose.rotation);
      if (pose.scale) node.scale.fromArray(pose.scale);
    }
    model.updateMatrixWorld(true);
    const headNode = nodes.find(node => /^(head|头)$/i.test(node.name));
    const neckNode = nodes.find(node => /^(neck|颈)$/i.test(node.name));
    const headRest = headNode?.quaternion.clone();
    const neckRest = neckNode?.quaternion.clone();
    let motionRaf = 0;
    let previousMotionTime = null;
    function animateHead(now) {
      const t = now * 0.001;
      const dt = previousMotionTime === null ? 1 / 60 : clamp(t - previousMotionTime, 0, .1);
      previousMotionTime = t;
      const neckTurn = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        Math.sin(t * .43) * THREE.MathUtils.degToRad(1.5),
        Math.sin(t * .31 + .8) * THREE.MathUtils.degToRad(2.4),
        Math.sin(t * .23) * THREE.MathUtils.degToRad(.45), 'YXZ'));
      const headTurn = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        Math.sin(t * .61 + 1.1) * THREE.MathUtils.degToRad(.8),
        Math.sin(t * .37) * THREE.MathUtils.degToRad(1.4),
        Math.sin(t * .29 + .4) * THREE.MathUtils.degToRad(.25), 'YXZ'));
      if (neckNode && neckRest) neckNode.quaternion.copy(neckRest).multiply(neckTurn);
      if (headNode && headRest) headNode.quaternion.copy(headRest).multiply(headTurn);
      model.updateMatrixWorld(true);
      updateGaze(dt);
      draw();
      motionRaf = requestAnimationFrame(animateHead);
    }
    const camera = new THREE.PerspectiveCamera(35, 1, .005, 50);
    const eyes = ['leftEye', 'rightEye'].map(name => nodes[manifest.joints?.[name]]).filter(Boolean);
    const updateGaze = createCameraGaze(eyes, camera);
    const bounds = new THREE.Box3().setFromObject(model, true);
    const focus = bounds.getCenter(new THREE.Vector3());
    focus.add(new THREE.Vector3().fromArray(manifest.preview_focus_offset || [0, 0, 0]));
    const frameHeight = Math.max(manifest.preview_height || .32,
      bounds.getSize(new THREE.Vector3()).y * 1.15);
    const initialDistance = frameHeight /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    let yaw = 0, pitch = 0, distance = initialDistance, pointer = null;
    const draw = () => renderer.render(scene, camera);
    function updateCamera() {
      camera.position.set(focus.x + Math.sin(yaw) * Math.cos(pitch) * distance,
        focus.y + Math.sin(pitch) * distance,
        focus.z - Math.cos(yaw) * Math.cos(pitch) * distance);
      camera.lookAt(focus); draw();
    }
    function resize() {
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.setSize(width, height, false); draw();
    }
    function down(event) {
      if (event.button !== 0) return;
      pointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
      canvas.setPointerCapture(event.pointerId);
    }
    function move(event) {
      if (!pointer || pointer.id !== event.pointerId) return;
      yaw += (event.clientX - pointer.x) * .007;
      pitch = clamp(pitch + (event.clientY - pointer.y) * .007, -1.4, 1.4);
      pointer.x = event.clientX; pointer.y = event.clientY; updateCamera();
    }
    function end(event) { if (pointer?.id === event.pointerId) pointer = null; }
    function wheel(event) {
      event.preventDefault();
      distance = clamp(distance * Math.exp(event.deltaY * .001), initialDistance * .25, initialDistance * 6);
      updateCamera();
    }
    function setShapes(shapes = {}) {
      for (const {mesh, morphs} of driven) morphs.forEach((morph, index) => {
        const value = shapes[morph.name];
        mesh.morphTargetInfluences[index] = Number.isFinite(value) ?
          clamp(value / 100, 0, 1) : clamp(Number(morph.weight) || 0, 0, 1);
      });
      draw();
    }
    function setView(name) {
      yaw = ({front: 0, left: -.65, right: .65, top: 0})[name] ?? 0;
      pitch = name === 'top' ? .55 : 0;
      distance = initialDistance; updateCamera();
    }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', wheel, {passive: false});
    container.replaceChildren(canvas); attached = true;
    observer = new ResizeObserver(resize); observer.observe(container);
    setShapes(); updateCamera(); resize();
    motionRaf = requestAnimationFrame(animateHead);
    return {
      setShapes, setView,
      channels: [...new Map(driven.flatMap(({morphs}) =>
        morphs.filter(morph => !morph.name.startsWith('---'))
          .map(morph => [morph.name, {name: morph.name, default: (morph.weight || 0) * 100}]))).values()],
      dispose() {
        cancelAnimationFrame(motionRaf);
        observer.disconnect();
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', end);
        canvas.removeEventListener('pointercancel', end);
        canvas.removeEventListener('wheel', wheel);
        for (const {skeleton} of driven) skeleton.dispose();
        for (const geometry of geometries) geometry.dispose();
        for (const material of materials) material.dispose();
        for (const texture of textures) texture.dispose();
        renderer.dispose(); canvas.remove();
      },
    };
  } catch (error) {
    observer?.disconnect();
    for (const {skeleton} of driven) skeleton.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    renderer.dispose(); if (attached) canvas.remove();
    throw error;
  }
}
