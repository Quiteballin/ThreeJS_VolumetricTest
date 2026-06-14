//inputs
uniform float uOffset;
uniform float uTime;

//shared
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewDir;

//constants
const float AMPLITUDE = 0.03;
const float FREQUENCY = 2.2;
const float SPEED = 1.2;

void main() {

    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;

    float dist = length(position.xz);
    float wave = sin(dist * FREQUENCY - uTime * SPEED);

    //offsetting according to the wave and according to the 
    //input base offset (used for shell rendering)
    vec3 pos = position
        + normal * uOffset
        + normal * wave * AMPLITUDE;

    //set position of vertex
    gl_Position =
        projectionMatrix *
        modelViewMatrix *
        vec4(pos, 1.0);

    //cache for use in fragment shader for edge calculation
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
}