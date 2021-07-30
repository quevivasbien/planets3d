// set up some helpers for procedural generation of textures
// create permutation table
var perm_ = [];
for (let i = 0; i < 256; i++) {
    perm_[i] = Math.floor(Math.random() * 256);
}
var perm = [];
for (let i = 0; i < 512; i++) {
    perm[i] = perm_[i % 255];
}
// create linear interpolation function
function lerp(a, b, t) {
    return (1-t) * a + t * b;
}
// a smoother interpolation function
return fade(t) {
    return t**3 * (t * (t * 6 - 15) + 10);
}
// list of possible gradients
var grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1],
			 [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
// Perlin dot product
function perlinDot(g, x, y, z) {
    return g[0] * x + g[1] * y + g[2] * z;
}
// noise function
function noise(x, y, z) {
    let x_ = Math.floor(x);
    let y_ = Math.floor(y);
    let z_ = Math.floor(z);

    x -= x_;
    y -= y_;
    z -= z_;
    x_ %= 255;
    y_ %= 255;
    z_ %= 255;

    let gi000 = perm[x_ + perm[y_ + perm[z_]]] % 12;
	let gi001 = perm[x_ + perm[y_ + perm[z_ + 1]]] % 12;
	let gi010 = perm[x_ + perm[y_ + 1 + perm[z_]]] % 12;
	let gi011 = perm[x_ + perm[y_ + 1 + perm[z_ + 1]]] % 12;
	let gi100 = perm[x_ + 1 + perm[y_ + perm[z_]]] % 12;
	let gi101 = perm[x_ + 1 + perm[y_ + perm[z_ + 1]]] % 12;
	let gi110 = perm[x_ + 1 + perm[y_ + 1 + perm[z_]]] % 12;
	let gi111 = perm[x_ + 1 + perm[y_ + 1 + perm[z_ + 1]]] % 12;

    let n000 = perlinDot(grad3[gi000], x, y, z);
	let n100 = perlinDot(grad3[gi100], x - 1, y, z);
	let n010 = perlinDot(grad3[gi010], x, y - 1, z);
	let n110 = perlinDot(grad3[gi110], x - 1, y - 1, z);
	let n001 = perlinDot(grad3[gi001], x, y, z - 1);
	let n101 = perlinDot(grad3[gi101], x - 1, y, z - 1);
	let n011 = perlinDot(grad3[gi011], x, y - 1, z - 1);
	let n111 = perlinDot(grad3[gi111], x - 1, y - 1, z - 1);

    let u = fade(x);
    let v = fade(y);
    let w = fade(z);

    let nx00 = lerp(n000, n100, u);
    let nx01 = lerp(n001, n101, u);
    let nx10 = lerp(n010, n110, u);
    let nx11 = lerp(n011, n111, u);

    let nxy0 = lerp(nx00, nx10, v);
    let nxy1 = lerp(nx01, nx11, v);

    return lerp(nxy0, nxy1, w);
}
