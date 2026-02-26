export const ellipseVert = `
precision highp float;

attribute vec2 aPosition;        // quad corners (-1..1)
attribute vec4 iCenterAB;        // cx, cy, a, b
attribute float iRot;
attribute vec4 iFill;

uniform mat3 uWorldToScreen;
uniform vec2 uViewport;

varying vec2 vLocal;
varying vec4 vFill;

void main() {
  vLocal = aPosition;
  vFill = iFill;

  float cx = iCenterAB.x;
  float cy = iCenterAB.y;
  float a  = iCenterAB.z;
  float b  = iCenterAB.w;

  // quad local -> world local (scale by semiaxes)
  vec2 localWorld = vec2(vLocal.x * a, vLocal.y * b);

  // rotate
  float c = cos(iRot);
  float s = sin(iRot);
  vec2 rotated = vec2(
    localWorld.x * c - localWorld.y * s,
    localWorld.x * s + localWorld.y * c
  );

  vec2 world = vec2(cx, cy) + rotated;

  vec3 sp = uWorldToScreen * vec3(world, 1.0);

  // screen px -> NDC
  vec2 ndc = vec2(
    (sp.x / uViewport.x) * 2.0 - 1.0,
    1.0 - (sp.y / uViewport.y) * 2.0
  );

  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

export const ellipseFrag = `
precision highp float;

varying vec2 vLocal;
varying vec4 vFill;

void main() {
  // inside ellipse in normalized quad space
  float d = (vLocal.x * vLocal.x) + (vLocal.y * vLocal.y);
  if (d > 1.0) discard;

  gl_FragColor = vFill;
}
`;
