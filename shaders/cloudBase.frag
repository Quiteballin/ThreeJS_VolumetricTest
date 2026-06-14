//inputs
uniform vec3 uMaskPos;

//shared
varying vec3 vWorldPosition;

//constants
const float MASK_RADIUS = 0.65;

void main() {

    //create the mask for an object walking through the cloud
    vec2 world2D = vec2(vWorldPosition.x, vWorldPosition.z);
    vec2 mask2D = vec2(uMaskPos.x, uMaskPos.z);

    float d = distance(world2D, mask2D);

    float alpha = smoothstep(
        MASK_RADIUS - 0.25,
        MASK_RADIUS,
        d
    );

    alpha = clamp(alpha, 0.0, 0.95);

    gl_FragColor = vec4(.8, .8, .84, alpha);
}