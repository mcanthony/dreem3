// MIT License.

// some shapes based on http://iquilezles.org/www/articles/distfunctions/distfunctions.htm

define(function (require, exports) {
	
	
	exports.roundedrectdistance = function(pixpos, width, height, topleftcorner, toprightcorner, bottomleftcorner, bottomrightcorner){

		var c1 = vec2(topleftcorner-0.5 , topleftcorner -0.5);
		var c2 = vec2(bottomleftcorner -0.5, height - bottomleftcorner -0.5);
		var c3 = vec2(width - bottomrightcorner -.50 , height - bottomrightcorner -.5);
		var c4 = vec2(width - toprightcorner - .50, toprightcorner -0.5 );

		var dist = 0.0
		if (sized.x <= c1.x && sized.y < c1.y) {
			dist = distcircle(sized - c1, topleftcorner);
		} else {
			if (sized.x >= c3.x && sized.y >= c3.y) {
				dist = distcircle(sized - c3, bottomrightcorner);
			} else {
				if (sized.x <= c2.x && sized.y >= c2.y) {
					dist = distcircle(sized - c2, bottomleftcorner);
				} else {
					if (sized.x >= c4.x && sized.y <= c4.y) {
						dist = distcircle(sized - c4, toprightcorner);
					} else {
							dist = max(max(-sized.y, sized.y-height), max(-sized.x, sized.x-width))
					}
				}
			}
		}
				
		return dist;
	}

	exports.circle = function (texpos, radius) {
		var c = texpos - vec2(0.5);
		var distance = length(c) - radius;
		var sdf = distance < 0. ? 1. : 0.0;
		return sdf;
	}

	exports.distcircle = function (texpos, radius) {
		var c = texpos - vec2(0.5);
		var distance = length(c) - radius;
		return distance;
		}

	//Sphere - signed
	exports.sdSphere = function (p, s) {
		return length(p) - s;
	}

	//Box - unsigned
	exports.udBox = function (p, b) {
		return length(max(abs(p) - b, 0.0));
	}

	//Round Box - unsigned
	exports.udRoundBox = function(p, b, r) {
		return length(max(abs(p) - b, 0.0)) - r;
	}

	//Box - signed
	exports.sdBox = function(p, b) {
		var d = abs(p) - b;
		return min(max(d.x, max(d.y, d.z)), 0.0) +
		length(max(d, 0.0));
	}

	//Torus - signed
	exports.sdTorus = function(p, t) {
		var q = vec2(length(p.xz) - t.x, p.y);
		return length(q) - t.y;
	}

	//Cylinder - signed
	exports.sdCylinder = function(p, c) {
		return length(p.xz - c.xy) - c.z;
	}

	//Cone - signed
	exports.sdCone = function(p, c) {
		// c must be normalized
		var q = length(p.xy);
		return dot(c, vec2(q, p.z));
	}

	//Plane - signed
	exports.sdPlane = function(p, n) {
		// n must be normalized
		return dot(p, n.xyz) + n.w;
	}

	//Hexagonal Prism - signed
	exports.sdHexPrism = function(p, h) {
		var q = abs(p);
		return max(q.z - h.y, max((q.x * 0.866025 + q.y * 0.5), q.y) - h.x);
	}

	//Triangular Prism - signed
	exports.sdTriPrism  = function(p, h) {
		var q = abs(p);
		return max(q.z - h.y, max(q.x * 0.866025 + p.y * 0.5, -p.y) - h.x * 0.5);
	}

	//Capsule / Line - signed
	exports.sdCapsule = function(p, a, b, r) {
		var pa = p - a,
		ba = b - a;
		var h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
		return length(pa - ba * h) - r;
	}

	//Capped cylinder - signed
	exports.sdCappedCylinder = function(p, h) {
		var d = abs(vec2(length(p.xz), p.y)) - h;
		return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
	}

	//Triangle - unsigned
	exports.dot2  = function(v) {
		return dot(v, v);
	}

	exports.udTriangle = function (p, a, b, c) {
		var ba = b - a;
		var pa = p - a;
		var cb = c - b;
		var pb = p - b;
		var ac = a - c;
		var pc = p - c;
		var nor = cross(ba, ac);

		return sqrt(
			(sign(dot(cross(ba, nor), pa)) +
				sign(dot(cross(cb, nor), pb)) +
				sign(dot(cross(ac, nor), pc)) < 2.0)
			 ?
			min(min(
					dot2(ba * clamp(dot(ba, pa) / dot2(ba), 0.0, 1.0) - pa),
					dot2(cb * clamp(dot(cb, pb) / dot2(cb), 0.0, 1.0) - pb)),
				dot2(ac * clamp(dot(ac, pc) / dot2(ac), 0.0, 1.0) - pc))
			 :
			dot(nor, pa) * dot(nor, pa) / dot2(nor));
	}

	
	exports.udQuad = function(p, a, b, c, d) {
		var ba = b - a;
		var pa = p - a;
		var cb = c - b;
		var pb = p - b;
		var dc = d - c;
		var pc = p - c;
		var ad = a - d;
		var pd = p - d;
		var nor = cross(ba, ad);

		return sqrt(
			(sign(dot(cross(ba, nor), pa)) +
				sign(dot(cross(cb, nor), pb)) +
				sign(dot(cross(dc, nor), pc)) +
				sign(dot(cross(ad, nor), pd)) < 3.0)
			 ?
			min(min(min(
						dot2(ba * clamp(dot(ba, pa) / dot2(ba), 0.0, 1.0) - pa),
						dot2(cb * clamp(dot(cb, pb) / dot2(cb), 0.0, 1.0) - pb)),
					dot2(dc * clamp(dot(dc, pc) / dot2(dc), 0.0, 1.0) - pc)),
				dot2(ad * clamp(dot(ad, pd) / dot2(ad), 0.0, 1.0) - pd))
			 :
			dot(nor, pa) * dot(nor, pa) / dot2(nor));
	}

	//Capped Cone - signed

	exports.sdCappedCone = function(p, c) {
		var q = vec2(length(p.xz), p.y);
		var v = vec2(c.z * c.y / c.x, -c.z);

		var w = v - q;

		var vv = vec2(dot(v, v), v.x * v.x);
		var qv = vec2(dot(v, w), v.x * w.x);

		var d = max(qv, 0.0) * qv / vv;

		return sqrt(dot(w, w) - max(d.x, d.y)) * sign(max(q.y * v.x - q.x * v.y, w.y));
	}

	//Torus82 - signed

	exports.sdTorus82 = function(p, t) {
		var q = vec2(length2(p.xz) - t.x, p.y);
		return length8(q) - t.y;
	}

	//Torus88 - signed

	exports.sdTorus88 = function(p, t) {
		var q = vec2(length8(p.xz) - t.x, p.y);
		return length8(q) - t.y;
	}

	//Union
	exports.opU = function(d1, d2) {
		return min(d1, d2);
	}

	//Substraction
	exports.opS = function(d1, d2) {
		return max(-d1, d2);
	}

	//Intersection
	exports.opI = function(d1, d2) {
		return max(d1, d2);
	}
})
